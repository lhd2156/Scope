from __future__ import annotations

from django.db.models import Q
from django.shortcuts import get_object_or_404
from rest_framework import generics, permissions, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.exceptions import PermissionDenied

from common.kafka_producer import AtlasKafkaProducer
from common.permissions import IsAuthenticatedJWT
from common.responses import data_response
from photos.models import Photo
from spots.models import Spot
from spots.querysets import with_spot_detail_relations, with_spot_list_relations
from spots.serializers import NearbyQuerySerializer, SpotDetailSerializer, SpotSerializer
from trips.models import Like

producer = AtlasKafkaProducer()


class SpotListCreateView(generics.ListCreateAPIView):
    serializer_class = SpotSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]

    def get_queryset(self):
        queryset = with_spot_list_relations(
            Spot.objects.filter(Q(is_public=True) | Q(user_id=getattr(self.request.user, 'id', None)))
        )
        if category := self.request.query_params.get('category'):
            queryset = queryset.filter(category=category)
        if city := self.request.query_params.get('city'):
            queryset = queryset.filter(city__iexact=city)
        if q := self.request.query_params.get('q'):
            queryset = queryset.filter(Q(title__icontains=q) | Q(description__icontains=q) | Q(vibe__icontains=q))
        return queryset.order_by('-created_at')

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(user_id=request.user.id)
        producer.publish('spot.created', {'spotId': str(serializer.instance.id), 'userId': str(request.user.id)})
        return data_response(self.get_serializer(serializer.instance).data, status_code=status.HTTP_201_CREATED)


class SpotDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = with_spot_detail_relations(Spot.objects.all())
    serializer_class = SpotDetailSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]

    def update(self, request, *args, **kwargs):
        spot = self.get_object()
        if str(spot.user_id) != str(getattr(request.user, 'id', '')) and not getattr(request.user, 'is_admin', False):
            raise PermissionDenied
        response = super().update(request, *args, **kwargs)
        producer.publish('spot.updated', {'spotId': str(spot.id), 'userId': str(request.user.id)})
        return response

    def destroy(self, request, *args, **kwargs):
        spot = self.get_object()
        if str(spot.user_id) != str(getattr(request.user, 'id', '')) and not getattr(request.user, 'is_admin', False):
            raise PermissionDenied
        return super().destroy(request, *args, **kwargs)


@api_view(['GET'])
def nearby_spots(request):
    serializer = NearbyQuerySerializer(data=request.query_params)
    serializer.is_valid(raise_exception=True)
    queryset = serializer.filter_queryset(Spot.objects.filter(is_public=True))
    queryset = with_spot_list_relations(queryset).order_by('-created_at')
    paginator = SpotListCreateView.pagination_class()
    page = paginator.paginate_queryset(queryset, request)
    return paginator.get_paginated_response(SpotSerializer(page, many=True).data)


@api_view(['GET'])
def user_spots(request, user_id):
    queryset = with_spot_list_relations(Spot.objects.filter(user_id=user_id, is_public=True)).order_by('-created_at')
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
    spot = get_object_or_404(Spot, pk=pk)
    if request.method == 'POST':
        like, created = Like.objects.get_or_create(spot=spot, user_id=request.user.id)
        if created:
            producer.publish('spot.liked', {'spotId': str(spot.id), 'userId': str(request.user.id)})
        return data_response({'liked': True}, status_code=201 if created else 200)
    Like.objects.filter(spot=spot, user_id=request.user.id).delete()
    return data_response({'liked': False})


@api_view(['GET'])
def spot_photos(request, pk):
    photos = Photo.objects.filter(spot_id=pk).order_by('sort_order', 'created_at')
    return data_response([{'id': str(photo.id), 'storageUrl': photo.storage_url, 'caption': photo.caption} for photo in photos])
