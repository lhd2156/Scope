from __future__ import annotations

from django.db.models import Q
from django.shortcuts import get_object_or_404
from rest_framework import generics, permissions
from rest_framework.decorators import api_view, permission_classes
from rest_framework.exceptions import PermissionDenied

from common.cache_utils import FEED_CACHE_NAMESPACE, invalidate_cache_namespaces
from common.etag import apply_conditional_etag
from common.kafka_producer import AtlasKafkaProducer
from common.permissions import IsAuthenticatedJWT
from common.responses import data_response
from trips.models import Trip, TripMember, TripSpot
from trips.querysets import with_trip_relations
from trips.serializers import (
    TripAddSpotSerializer,
    TripMemberCreateSerializer,
    TripMemberSerializer,
    TripReorderSerializer,
    TripSerializer,
)

producer = AtlasKafkaProducer()


def load_trip_with_relations(trip_id):
    return with_trip_relations(Trip.objects.filter(pk=trip_id)).get()


def can_manage_trip(user, trip):
    if not getattr(user, 'is_authenticated', False):
        return False
    if str(trip.creator_id) == str(user.id) or getattr(user, 'is_admin', False):
        return True
    return TripMember.objects.filter(trip=trip, user_id=user.id, role__in=['owner', 'editor']).exists()


class TripListCreateView(generics.ListCreateAPIView):
    serializer_class = TripSerializer
    permission_classes = [IsAuthenticatedJWT]

    def get_queryset(self):
        user_id = getattr(self.request.user, 'id', None)
        return with_trip_relations(
            Trip.objects.filter(Q(creator_id=user_id) | Q(members__user_id=user_id)).distinct()
        )

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        trip = serializer.save(creator_id=request.user.id)
        TripMember.objects.get_or_create(trip=trip, user_id=request.user.id, role='owner')
        invalidate_cache_namespaces(FEED_CACHE_NAMESPACE)
        producer.publish('trip.created', {'tripId': str(trip.id), 'userId': str(request.user.id)})
        return data_response(self.get_serializer(trip).data, status_code=201)


class TripDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = with_trip_relations(Trip.objects.all())
    serializer_class = TripSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]
    http_method_names = ['get', 'put', 'delete', 'options']

    def retrieve(self, request, *args, **kwargs):
        response = super().retrieve(request, *args, **kwargs)
        return apply_conditional_etag(request, response)

    def update(self, request, *args, **kwargs):
        trip = self.get_object()
        if not can_manage_trip(request.user, trip):
            raise PermissionDenied
        response = super().update(request, *args, **kwargs)
        invalidate_cache_namespaces(FEED_CACHE_NAMESPACE)
        return response

    def destroy(self, request, *args, **kwargs):
        trip = self.get_object()
        if not can_manage_trip(request.user, trip):
            raise PermissionDenied
        response = super().destroy(request, *args, **kwargs)
        invalidate_cache_namespaces(FEED_CACHE_NAMESPACE)
        return response


@api_view(['GET'])
def public_trips(request):
    queryset = with_trip_relations(Trip.objects.filter(is_public=True))
    paginator = TripListCreateView.pagination_class()
    page = paginator.paginate_queryset(queryset, request)
    return paginator.get_paginated_response(TripSerializer(page, many=True).data)


@api_view(['POST'])
@permission_classes([IsAuthenticatedJWT])
def add_trip_spot(request, pk):
    trip = get_object_or_404(Trip, pk=pk)
    if not can_manage_trip(request.user, trip):
        raise PermissionDenied
    serializer = TripAddSpotSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    _, created = TripSpot.objects.update_or_create(
        trip=trip,
        spot_id=serializer.validated_data['spot_id'],
        defaults={
            'day_number': serializer.validated_data.get('day_number'),
            'sort_order': serializer.validated_data.get('sort_order', 0),
            'notes': serializer.validated_data.get('notes', ''),
        },
    )
    invalidate_cache_namespaces(FEED_CACHE_NAMESPACE)
    return data_response(TripSerializer(load_trip_with_relations(trip.id)).data, status_code=201 if created else 200)


@api_view(['DELETE'])
@permission_classes([IsAuthenticatedJWT])
def remove_trip_spot(request, pk, spot_id):
    trip = get_object_or_404(Trip, pk=pk)
    if not can_manage_trip(request.user, trip):
        raise PermissionDenied
    TripSpot.objects.filter(trip=trip, spot_id=spot_id).delete()
    invalidate_cache_namespaces(FEED_CACHE_NAMESPACE)
    return data_response({'removed': True})


@api_view(['PUT'])
@permission_classes([IsAuthenticatedJWT])
def reorder_trip_spots(request, pk):
    trip = get_object_or_404(Trip, pk=pk)
    if not can_manage_trip(request.user, trip):
        raise PermissionDenied
    serializer = TripReorderSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    requested_spot_ids = [spot_data['spotId'] for spot_data in serializer.validated_data['spots']]
    trip_spots_by_spot_id = {
        trip_spot.spot_id: trip_spot
        for trip_spot in TripSpot.objects.filter(trip=trip, spot_id__in=requested_spot_ids).only(
            'id',
            'spot_id',
            'day_number',
            'sort_order',
        )
    }
    trip_spots_to_update = []
    for index, spot_data in enumerate(serializer.validated_data['spots']):
        trip_spot = trip_spots_by_spot_id.get(spot_data['spotId'])
        if trip_spot is None:
            continue
        trip_spot.sort_order = spot_data.get('sortOrder', index)
        trip_spot.day_number = spot_data.get('dayNumber')
        trip_spots_to_update.append(trip_spot)
    if trip_spots_to_update:
        TripSpot.objects.bulk_update(trip_spots_to_update, ['sort_order', 'day_number'])
    invalidate_cache_namespaces(FEED_CACHE_NAMESPACE)
    return data_response(TripSerializer(load_trip_with_relations(trip.id)).data)


@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticatedJWT])
def trip_members(request, pk):
    trip = get_object_or_404(Trip, pk=pk)
    if request.method == 'GET':
        if not can_manage_trip(request.user, trip) and not trip.is_public:
            raise PermissionDenied
        return data_response(TripMemberSerializer(trip.members.all(), many=True).data)
    if not can_manage_trip(request.user, trip):
        raise PermissionDenied
    serializer = TripMemberCreateSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    member, created = TripMember.objects.get_or_create(
        trip=trip,
        user_id=serializer.validated_data['user_id'],
        defaults={'role': serializer.validated_data['role']},
    )
    if not created and member.role != serializer.validated_data['role']:
        member.role = serializer.validated_data['role']
        member.save(update_fields=['role'])
    invalidate_cache_namespaces(FEED_CACHE_NAMESPACE)
    if created:
        producer.publish('trip.member.added', {'tripId': str(trip.id), 'userId': str(serializer.validated_data['user_id'])})
    return data_response(TripMemberSerializer(member).data, status_code=201 if created else 200)


@api_view(['DELETE'])
@permission_classes([IsAuthenticatedJWT])
def remove_trip_member(request, pk, user_id):
    trip = get_object_or_404(Trip, pk=pk)
    if not can_manage_trip(request.user, trip):
        raise PermissionDenied
    TripMember.objects.filter(trip=trip, user_id=user_id).exclude(role='owner').delete()
    invalidate_cache_namespaces(FEED_CACHE_NAMESPACE)
    return data_response({'removed': True})
