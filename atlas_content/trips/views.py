from django.db.models import Q
from django.shortcuts import get_object_or_404
from rest_framework import generics, permissions
from rest_framework.decorators import api_view, permission_classes

from common.access import can_manage_trip, can_view_trip, is_admin
from common.kafka_producer import AtlasKafkaProducer
from common.permissions import IsAuthenticatedJWT
from common.responses import data_response
from trips.models import Trip, TripMember, TripSpot
from trips.serializers import (
    TripAddSpotSerializer,
    TripMemberCreateSerializer,
    TripMemberSerializer,
    TripReorderSerializer,
    TripSerializer,
)

producer = AtlasKafkaProducer()


def trip_base_queryset():
    return Trip.objects.prefetch_related('trip_spots__spot', 'members')


class TripListCreateView(generics.ListCreateAPIView):
    serializer_class = TripSerializer
    permission_classes = [IsAuthenticatedJWT]

    def get_queryset(self):
        if is_admin(self.request.user):
            return trip_base_queryset()
        user_id = getattr(self.request.user, 'id', None)
        return trip_base_queryset().filter(Q(creator_id=user_id) | Q(members__user_id=user_id)).distinct()

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        trip = serializer.save(creator_id=request.user.id)
        TripMember.objects.get_or_create(trip=trip, user_id=request.user.id, role='owner')
        created_trip = trip_base_queryset().get(pk=trip.pk)
        producer.publish('trip.created', {'tripId': str(trip.id), 'userId': str(request.user.id)})
        return data_response(self.get_serializer(created_trip).data, status_code=201)


class TripDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = TripSerializer
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        if is_admin(self.request.user):
            return trip_base_queryset()
        user_id = getattr(self.request.user, 'id', None)
        return trip_base_queryset().filter(Q(is_public=True) | Q(creator_id=user_id) | Q(members__user_id=user_id)).distinct()

    def retrieve(self, request, *args, **kwargs):
        trip = self.get_object()
        return data_response(self.get_serializer(trip).data)

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop('partial', False)
        trip = self.get_object()
        if not can_manage_trip(request.user, trip):
            return data_response({'message': 'forbidden'}, status_code=403)

        serializer = self.get_serializer(trip, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        updated_trip = trip_base_queryset().get(pk=trip.pk)
        return data_response(self.get_serializer(updated_trip).data)

    def destroy(self, request, *args, **kwargs):
        trip = self.get_object()
        if not can_manage_trip(request.user, trip):
            return data_response({'message': 'forbidden'}, status_code=403)
        trip.delete()
        return data_response({'deleted': True, 'tripId': str(trip.id)})


@api_view(['GET'])
def public_trips(request):
    queryset = trip_base_queryset().filter(is_public=True)
    paginator = TripListCreateView.pagination_class()
    page = paginator.paginate_queryset(queryset, request)
    return paginator.get_paginated_response(TripSerializer(page, many=True).data)


@api_view(['POST'])
@permission_classes([IsAuthenticatedJWT])
def add_trip_spot(request, pk):
    trip = get_object_or_404(trip_base_queryset(), pk=pk)
    if not can_manage_trip(request.user, trip):
        return data_response({'message': 'forbidden'}, status_code=403)

    serializer = TripAddSpotSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    TripSpot.objects.update_or_create(
        trip=trip,
        spot_id=serializer.validated_data['spot_id'],
        defaults={
            'day_number': serializer.validated_data.get('day_number'),
            'sort_order': serializer.validated_data.get('sort_order', 0),
            'notes': serializer.validated_data.get('notes', ''),
        },
    )
    updated_trip = trip_base_queryset().get(pk=trip.pk)
    return data_response(TripSerializer(updated_trip).data, status_code=201)


@api_view(['DELETE'])
@permission_classes([IsAuthenticatedJWT])
def remove_trip_spot(request, pk, spot_id):
    trip = get_object_or_404(trip_base_queryset(), pk=pk)
    if not can_manage_trip(request.user, trip):
        return data_response({'message': 'forbidden'}, status_code=403)

    TripSpot.objects.filter(trip=trip, spot_id=spot_id).delete()
    updated_trip = trip_base_queryset().get(pk=trip.pk)
    return data_response(TripSerializer(updated_trip).data)


@api_view(['PUT'])
@permission_classes([IsAuthenticatedJWT])
def reorder_trip_spots(request, pk):
    trip = get_object_or_404(trip_base_queryset(), pk=pk)
    if not can_manage_trip(request.user, trip):
        return data_response({'message': 'forbidden'}, status_code=403)

    serializer = TripReorderSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    for index, spot_data in enumerate(serializer.validated_data['spots']):
        TripSpot.objects.filter(trip=trip, spot_id=spot_data['spotId']).update(
            sort_order=spot_data.get('sortOrder', index),
            day_number=spot_data.get('dayNumber'),
        )
    updated_trip = trip_base_queryset().get(pk=trip.pk)
    return data_response(TripSerializer(updated_trip).data)


@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticatedJWT])
def trip_members(request, pk):
    trip = get_object_or_404(trip_base_queryset(), pk=pk)
    if request.method == 'GET':
        if not can_view_trip(request.user, trip):
            return data_response({'message': 'forbidden'}, status_code=403)
        return data_response(TripMemberSerializer(trip.members.all(), many=True).data)

    if not can_manage_trip(request.user, trip):
        return data_response({'message': 'forbidden'}, status_code=403)

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

    producer.publish('trip.member.added', {'tripId': str(trip.id), 'userId': str(serializer.validated_data['user_id'])})
    return data_response(TripMemberSerializer(member).data, status_code=201 if created else 200)


@api_view(['DELETE'])
@permission_classes([IsAuthenticatedJWT])
def remove_trip_member(request, pk, user_id):
    trip = get_object_or_404(trip_base_queryset(), pk=pk)
    if not can_manage_trip(request.user, trip):
        return data_response({'message': 'forbidden'}, status_code=403)

    TripMember.objects.filter(trip=trip, user_id=user_id).exclude(role='owner').delete()
    return data_response({'removed': True, 'userId': str(user_id)})
