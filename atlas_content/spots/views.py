from django.db.models import Avg, Count, Q
from django.shortcuts import get_object_or_404
from rest_framework import generics, permissions, status
from rest_framework.decorators import api_view, permission_classes

from common.access import can_view_spot, is_admin
from common.kafka_producer import AtlasKafkaProducer
from common.permissions import IsAuthenticatedJWT
from common.responses import data_response
from photos.models import Photo
from photos.serializers import PhotoSerializer
from spots.models import Spot
from spots.serializers import NearbyQuerySerializer, SpotDetailSerializer, SpotSerializer
from trips.models import Like

producer = AtlasKafkaProducer()


def spot_base_queryset():
    return (
        Spot.objects.annotate(
            likes_count=Count('likes', distinct=True),
            average_rating=Avg('reviews__rating'),
        )
        .prefetch_related('photos', 'reviews')
        .order_by('-created_at')
    )


class SpotListCreateView(generics.ListCreateAPIView):
    serializer_class = SpotSerializer
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        queryset = spot_base_queryset()
        user_id = getattr(self.request.user, 'id', None)
        if is_admin(self.request.user):
            visible_queryset = queryset
        else:
            visible_queryset = queryset.filter(Q(is_public=True) | Q(user_id=user_id))

        if category := self.request.query_params.get('category'):
            visible_queryset = visible_queryset.filter(category=category)
        if city := self.request.query_params.get('city'):
            visible_queryset = visible_queryset.filter(city__iexact=city)
        if q := self.request.query_params.get('q'):
            visible_queryset = visible_queryset.filter(
                Q(title__icontains=q) | Q(description__icontains=q) | Q(vibe__icontains=q)
            )
        return visible_queryset

    def create(self, request, *args, **kwargs):
        if not getattr(request.user, 'is_authenticated', False):
            return data_response({'message': 'auth required'}, status_code=401)

        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(user_id=request.user.id)
        created_spot = spot_base_queryset().get(pk=serializer.instance.pk)
        producer.publish('spot.created', {'spotId': str(serializer.instance.id), 'userId': str(request.user.id)})
        return data_response(self.get_serializer(created_spot).data, status_code=status.HTTP_201_CREATED)


class SpotDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = SpotDetailSerializer
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        queryset = spot_base_queryset()
        user_id = getattr(self.request.user, 'id', None)
        if is_admin(self.request.user):
            return queryset
        return queryset.filter(Q(is_public=True) | Q(user_id=user_id))

    def retrieve(self, request, *args, **kwargs):
        spot = self.get_object()
        return data_response(self.get_serializer(spot).data)

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop('partial', False)
        spot = self.get_object()
        if str(spot.user_id) != str(getattr(request.user, 'id', '')) and not is_admin(request.user):
            return data_response({'message': 'forbidden'}, status_code=403)

        serializer = self.get_serializer(spot, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        updated_spot = spot_base_queryset().get(pk=spot.pk)
        producer.publish('spot.updated', {'spotId': str(spot.id), 'userId': str(request.user.id)})
        return data_response(self.get_serializer(updated_spot).data)

    def destroy(self, request, *args, **kwargs):
        spot = self.get_object()
        if str(spot.user_id) != str(getattr(request.user, 'id', '')) and not is_admin(request.user):
            return data_response({'message': 'forbidden'}, status_code=403)
        spot.delete()
        return data_response({'deleted': True, 'spotId': str(spot.id)})


@api_view(['GET'])
def nearby_spots(request):
    serializer = NearbyQuerySerializer(data=request.query_params)
    serializer.is_valid(raise_exception=True)
    queryset = serializer.filter_queryset(spot_base_queryset().filter(is_public=True))
    paginator = SpotListCreateView.pagination_class()
    page = paginator.paginate_queryset(queryset, request)
    return paginator.get_paginated_response(SpotSerializer(page, many=True).data)


@api_view(['GET'])
def user_spots(request, user_id):
    queryset = spot_base_queryset().filter(user_id=user_id)
    if str(getattr(request.user, 'id', '')) != str(user_id) and not is_admin(request.user):
        queryset = queryset.filter(is_public=True)

    paginator = SpotListCreateView.pagination_class()
    page = paginator.paginate_queryset(queryset, request)
    return paginator.get_paginated_response(SpotSerializer(page, many=True).data)


@api_view(['GET'])
def explore_spots(request):
    view = SpotListCreateView()
    view.request = request
    queryset = view.get_queryset().filter(is_public=True)
    paginator = SpotListCreateView.pagination_class()
    page = paginator.paginate_queryset(queryset, request)
    return paginator.get_paginated_response(SpotSerializer(page, many=True).data)


@api_view(['POST', 'DELETE'])
@permission_classes([IsAuthenticatedJWT])
def like_spot(request, pk):
    spot = get_object_or_404(spot_base_queryset(), pk=pk)
    if not can_view_spot(request.user, spot):
        return data_response({'message': 'forbidden'}, status_code=403)

    if request.method == 'POST':
        like, created = Like.objects.get_or_create(spot=spot, user_id=request.user.id)
        if created:
            producer.publish('spot.liked', {'spotId': str(spot.id), 'userId': str(request.user.id)})
        return data_response(
            {
                'spotId': str(spot.id),
                'liked': True,
                'likesCount': Like.objects.filter(spot=spot).count(),
            },
            status_code=201 if created else 200,
        )

    Like.objects.filter(spot=spot, user_id=request.user.id).delete()
    return data_response(
        {
            'spotId': str(spot.id),
            'liked': False,
            'likesCount': Like.objects.filter(spot=spot).count(),
        }
    )


@api_view(['GET'])
def spot_photos(request, pk):
    spot = get_object_or_404(spot_base_queryset(), pk=pk)
    if not can_view_spot(request.user, spot):
        return data_response({'message': 'forbidden'}, status_code=403)

    photos = Photo.objects.filter(spot_id=pk).order_by('sort_order', 'created_at')
    return data_response(PhotoSerializer(photos, many=True).data)
