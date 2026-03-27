from bootstrap_content import w

w('spots/views.py', '''from django.db.models import Avg, Count, Q
from django.shortcuts import get_object_or_404
from rest_framework import generics, permissions, status
from rest_framework.decorators import api_view, permission_classes
from common.kafka_producer import AtlasKafkaProducer
from common.permissions import IsAuthenticatedJWT
from common.responses import data_response
from photos.models import Photo
from spots.models import Spot
from spots.serializers import NearbyQuerySerializer, SpotDetailSerializer, SpotSerializer
from trips.models import Like
producer = AtlasKafkaProducer()
class SpotListCreateView(generics.ListCreateAPIView):
    serializer_class = SpotSerializer
    permission_classes = [permissions.AllowAny]
    def get_queryset(self):
        queryset = Spot.objects.filter(Q(is_public=True) | Q(user_id=getattr(self.request.user, 'id', None))).annotate(likes_count=Count('likes', distinct=True), average_rating=Avg('reviews__rating')).prefetch_related('photos')
        if category := self.request.query_params.get('category'):
            queryset = queryset.filter(category=category)
        if city := self.request.query_params.get('city'):
            queryset = queryset.filter(city__iexact=city)
        if q := self.request.query_params.get('q'):
            queryset = queryset.filter(Q(title__icontains=q) | Q(description__icontains=q) | Q(vibe__icontains=q))
        return queryset
    def create(self, request, *args, **kwargs):
        if not getattr(request.user, 'is_authenticated', False):
            return data_response({'message': 'auth required'}, status_code=401)
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(user_id=request.user.id)
        producer.publish('spot.created', {'spotId': str(serializer.instance.id), 'userId': str(request.user.id)})
        return data_response(self.get_serializer(serializer.instance).data, status_code=status.HTTP_201_CREATED)
class SpotDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Spot.objects.all().prefetch_related('photos', 'reviews')
    serializer_class = SpotDetailSerializer
    permission_classes = [permissions.AllowAny]
    def update(self, request, *args, **kwargs):
        spot = self.get_object()
        if str(spot.user_id) != str(getattr(request.user, 'id', '')) and not getattr(request.user, 'is_admin', False):
            return data_response({'message': 'forbidden'}, status_code=403)
        response = super().update(request, *args, **kwargs)
        producer.publish('spot.updated', {'spotId': str(spot.id), 'userId': str(request.user.id)})
        return response
    def destroy(self, request, *args, **kwargs):
        spot = self.get_object()
        if str(spot.user_id) != str(getattr(request.user, 'id', '')) and not getattr(request.user, 'is_admin', False):
            return data_response({'message': 'forbidden'}, status_code=403)
        return super().destroy(request, *args, **kwargs)
@api_view(['GET'])
def nearby_spots(request):
    serializer = NearbyQuerySerializer(data=request.query_params)
    serializer.is_valid(raise_exception=True)
    queryset = serializer.filter_queryset(Spot.objects.filter(is_public=True))
    paginator = SpotListCreateView.pagination_class()
    page = paginator.paginate_queryset(queryset, request)
    return paginator.get_paginated_response(SpotSerializer(page, many=True).data)
@api_view(['GET'])
def user_spots(request, user_id):
    queryset = Spot.objects.filter(user_id=user_id, is_public=True)
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
@api_view(['POST','DELETE'])
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
''')

w('trips/views.py', '''from django.db.models import Q
from django.shortcuts import get_object_or_404
from rest_framework import generics, permissions
from rest_framework.decorators import api_view, permission_classes
from common.kafka_producer import AtlasKafkaProducer
from common.permissions import IsAuthenticatedJWT
from common.responses import data_response
from trips.models import Trip, TripMember, TripSpot
from trips.serializers import TripAddSpotSerializer, TripMemberCreateSerializer, TripMemberSerializer, TripReorderSerializer, TripSerializer
producer = AtlasKafkaProducer()
def can_manage_trip(user, trip):
    if not getattr(user, 'is_authenticated', False):
        return False
    if str(trip.creator_id) == str(user.id) or getattr(user, 'is_admin', False):
        return True
    return TripMember.objects.filter(trip=trip, user_id=user.id, role__in=['owner', 'editor']).exists()
class TripListCreateView(generics.ListCreateAPIView):
    serializer_class = TripSerializer
    permission_classes = [permissions.AllowAny]
    def get_queryset(self):
        user_id = getattr(self.request.user, 'id', None)
        return Trip.objects.prefetch_related('trip_spots__spot', 'members').filter(Q(is_public=True) | Q(creator_id=user_id) | Q(members__user_id=user_id)).distinct()
    def create(self, request, *args, **kwargs):
        if not getattr(request.user, 'is_authenticated', False):
            return data_response({'message': 'auth required'}, status_code=401)
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        trip = serializer.save(creator_id=request.user.id)
        TripMember.objects.get_or_create(trip=trip, user_id=request.user.id, role='owner')
        producer.publish('trip.created', {'tripId': str(trip.id), 'userId': str(request.user.id)})
        return data_response(self.get_serializer(trip).data, status_code=201)
class TripDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Trip.objects.prefetch_related('trip_spots__spot', 'members')
    serializer_class = TripSerializer
    permission_classes = [permissions.AllowAny]
    def update(self, request, *args, **kwargs):
        trip = self.get_object()
        if not can_manage_trip(request.user, trip):
            return data_response({'message': 'forbidden'}, status_code=403)
        return super().update(request, *args, **kwargs)
    def destroy(self, request, *args, **kwargs):
        trip = self.get_object()
        if not can_manage_trip(request.user, trip):
            return data_response({'message': 'forbidden'}, status_code=403)
        return super().destroy(request, *args, **kwargs)
@api_view(['GET'])
def public_trips(request):
    queryset = Trip.objects.filter(is_public=True).prefetch_related('trip_spots__spot', 'members')
    paginator = TripListCreateView.pagination_class()
    page = paginator.paginate_queryset(queryset, request)
    return paginator.get_paginated_response(TripSerializer(page, many=True).data)
@api_view(['POST'])
@permission_classes([IsAuthenticatedJWT])
def add_trip_spot(request, pk):
    trip = get_object_or_404(Trip, pk=pk)
    if not can_manage_trip(request.user, trip):
        return data_response({'message': 'forbidden'}, status_code=403)
    serializer = TripAddSpotSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    TripSpot.objects.update_or_create(trip=trip, spot_id=serializer.validated_data['spot_id'], defaults={'day_number': serializer.validated_data.get('day_number'), 'sort_order': serializer.validated_data.get('sort_order', 0), 'notes': serializer.validated_data.get('notes', '')})
    return data_response(TripSerializer(trip).data, status_code=201)
@api_view(['DELETE'])
@permission_classes([IsAuthenticatedJWT])
def remove_trip_spot(request, pk, spot_id):
    trip = get_object_or_404(Trip, pk=pk)
    if not can_manage_trip(request.user, trip):
        return data_response({'message': 'forbidden'}, status_code=403)
    TripSpot.objects.filter(trip=trip, spot_id=spot_id).delete()
    return data_response({'removed': True})
@api_view(['PUT'])
@permission_classes([IsAuthenticatedJWT])
def reorder_trip_spots(request, pk):
    trip = get_object_or_404(Trip, pk=pk)
    if not can_manage_trip(request.user, trip):
        return data_response({'message': 'forbidden'}, status_code=403)
    serializer = TripReorderSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    for index, spot_data in enumerate(serializer.validated_data['spots']):
        TripSpot.objects.filter(trip=trip, spot_id=spot_data['spotId']).update(sort_order=spot_data.get('sortOrder', index), day_number=spot_data.get('dayNumber'))
    return data_response(TripSerializer(trip).data)
@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticatedJWT])
def trip_members(request, pk):
    trip = get_object_or_404(Trip, pk=pk)
    if request.method == 'GET':
        if not can_manage_trip(request.user, trip) and not trip.is_public:
            return data_response({'message': 'forbidden'}, status_code=403)
        return data_response(TripMemberSerializer(trip.members.all(), many=True).data)
    if not can_manage_trip(request.user, trip):
        return data_response({'message': 'forbidden'}, status_code=403)
    serializer = TripMemberCreateSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    member, created = TripMember.objects.get_or_create(trip=trip, user_id=serializer.validated_data['user_id'], defaults={'role': serializer.validated_data['role']})
    if not created and member.role != serializer.validated_data['role']:
        member.role = serializer.validated_data['role']
        member.save(update_fields=['role'])
    producer.publish('trip.member.added', {'tripId': str(trip.id), 'userId': str(serializer.validated_data['user_id'])})
    return data_response(TripMemberSerializer(member).data, status_code=201 if created else 200)
@api_view(['DELETE'])
@permission_classes([IsAuthenticatedJWT])
def remove_trip_member(request, pk, user_id):
    trip = get_object_or_404(Trip, pk=pk)
    if not can_manage_trip(request.user, trip):
        return data_response({'message': 'forbidden'}, status_code=403)
    TripMember.objects.filter(trip=trip, user_id=user_id).exclude(role='owner').delete()
    return data_response({'removed': True})
''')
