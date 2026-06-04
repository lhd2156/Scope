from __future__ import annotations

from uuid import UUID, uuid4

from django.db.models import Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import generics, permissions, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response

from common.cache_utils import FEED_CACHE_NAMESPACE, invalidate_cache_namespaces
from common.etag import apply_conditional_etag
from common.events import record_and_publish
from common.indexing import delete_trip, index_trip
from common.kafka_producer import ScopeKafkaProducer
from common.permissions import IsAuthenticatedJWT
from common.responses import data_response
from spots.models import Spot
from trips.models import Trip, TripMember, TripSpot
from trips.querysets import with_trip_relations
from trips.serializers import (
    TripAddSpotSerializer,
    TripMemberCreateSerializer,
    TripMemberSerializer,
    TripReorderSerializer,
    TripSerializer,
)

producer = ScopeKafkaProducer()


def _iso_timestamp(value) -> str:
    return value.isoformat().replace('+00:00', 'Z')


def _trip_event_payload(trip: Trip, user_id) -> dict:
    return {
        'tripId': str(trip.id),
        'userId': str(user_id),
        'creatorId': str(trip.creator_id),
        'ownerUserId': str(trip.creator_id),
        'title': trip.title,
        'tripTitle': trip.title,
        'description': trip.description,
        'destination': trip.destination,
        'isPublic': bool(trip.is_public),
        'occurredAt': _iso_timestamp(getattr(trip, 'created_at', None) or timezone.now()),
    }


def load_trip_with_relations(trip_id):
    return with_trip_relations(Trip.objects.filter(pk=trip_id)).get()


def is_trip_owner(user, trip):
    if not getattr(user, 'is_authenticated', False):
        return False
    if str(trip.creator_id) == str(user.id) or getattr(user, 'is_admin', False):
        return True
    return TripMember.objects.filter(trip=trip, user_id=user.id, role='owner').exists()


def is_trip_member(user, trip):
    if not getattr(user, 'is_authenticated', False):
        return False
    if getattr(user, 'is_admin', False):
        return True
    return TripMember.objects.filter(trip=trip, user_id=user.id).exists()


def can_edit_trip(user, trip):
    if is_trip_owner(user, trip):
        return True
    if not getattr(user, 'is_authenticated', False):
        return False
    return TripMember.objects.filter(trip=trip, user_id=user.id, role='editor').exists()


def can_manage_trip(user, trip):
    return can_edit_trip(user, trip)


def can_view_trip(user, trip):
    return bool(trip.is_public or is_trip_owner(user, trip) or is_trip_member(user, trip))


def _coerce_uuid(value):
    try:
        return UUID(str(value))
    except (TypeError, ValueError):
        return None


def _delete_generated_spot_if_orphaned(trip_spot):
    if trip_spot.source != 'planner_generated':
        return
    spot = trip_spot.spot
    remaining_references = TripSpot.objects.filter(spot=spot).exclude(id=trip_spot.id).exists()
    if not remaining_references:
        spot.delete()


def _resolve_spot_for_trip(trip, user, spot_data):
    raw_spot_id = str(spot_data.get('spot_id') or '').strip()
    parsed_spot_id = _coerce_uuid(raw_spot_id)
    if parsed_spot_id:
        spot_queryset = Spot.objects.filter(id=parsed_spot_id)
        if not getattr(user, 'is_admin', False):
            spot_queryset = spot_queryset.filter(Q(is_public=True) | Q(user_id=user.id))
        spot = spot_queryset.first()
        if spot is not None:
            existing_trip_spot = TripSpot.objects.filter(trip=trip, spot=spot).first()
            if existing_trip_spot and existing_trip_spot.source == 'planner_generated':
                return spot, 'planner_generated'
            return spot, 'saved_spot'

    title = str(spot_data.get('title') or '').strip()
    latitude = spot_data.get('latitude')
    longitude = spot_data.get('longitude')
    if not title or latitude is None or longitude is None:
        raise ValidationError({'spot_id': 'Spot does not exist'})

    spot = Spot.objects.create(
        user_id=user.id,
        title=title,
        latitude=latitude,
        longitude=longitude,
        city=str(spot_data.get('city') or '').strip(),
        category=spot_data.get('category') or 'other',
        is_public=False,
        vibe='trip-planner',
        description=f"Generated from trip planner for {trip.title}",
    )
    return spot, 'planner_generated'


def _sync_trip_spots_from_payload(trip, user, spots_payload):
    if spots_payload is None:
        return

    if not isinstance(spots_payload, list):
        raise ValidationError({'spots': 'Expected a list of trip stops'})

    kept_trip_spot_ids = set()
    for index, raw_spot_data in enumerate(spots_payload):
        serializer = TripAddSpotSerializer(data=raw_spot_data, context={'user': user})
        serializer.is_valid(raise_exception=True)
        spot, source = _resolve_spot_for_trip(trip, user, serializer.validated_data)
        trip_spot, _ = TripSpot.objects.update_or_create(
            trip=trip,
            spot=spot,
            defaults={
                'day_number': serializer.validated_data.get('day_number'),
                'sort_order': serializer.validated_data.get('sort_order', index),
                'notes': serializer.validated_data.get('notes', ''),
                'source': source,
            },
        )
        kept_trip_spot_ids.add(trip_spot.id)

    stale_trip_spots = list(TripSpot.objects.select_related('spot').filter(trip=trip).exclude(id__in=kept_trip_spot_ids))
    for trip_spot in stale_trip_spots:
        _delete_generated_spot_if_orphaned(trip_spot)
    TripSpot.objects.filter(id__in=[trip_spot.id for trip_spot in stale_trip_spots]).delete()


def _sync_trip_members_from_payload(trip, members_payload):
    if members_payload is None:
        return

    if not isinstance(members_payload, list):
        raise ValidationError({'members': 'Expected a list of trip members'})

    for raw_member_data in members_payload:
        user_id = raw_member_data.get('user_id') or raw_member_data.get('userId') or raw_member_data.get('id')
        role = raw_member_data.get('role') or raw_member_data.get('status')
        if not user_id or not role or str(role) == 'owner' or str(user_id) == str(trip.creator_id):
            continue
        serializer = TripMemberCreateSerializer(data={'user_id': user_id, 'role': role})
        serializer.is_valid(raise_exception=True)
        member = TripMember.objects.filter(trip=trip, user_id=serializer.validated_data['user_id']).first()
        if member is not None and member.role == 'owner':
            continue
        TripMember.objects.update_or_create(
            trip=trip,
            user_id=serializer.validated_data['user_id'],
            defaults={'role': serializer.validated_data['role']},
        )


def _delete_generated_spots_for_trip(trip):
    generated_spots = list(TripSpot.objects.select_related('spot').filter(trip=trip, source='planner_generated'))
    for trip_spot in generated_spots:
        _delete_generated_spot_if_orphaned(trip_spot)


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
        _sync_trip_spots_from_payload(trip, request.user, getattr(serializer, 'nested_spots_payload', None))
        _sync_trip_members_from_payload(trip, getattr(serializer, 'nested_members_payload', None))
        index_trip(trip)
        invalidate_cache_namespaces(FEED_CACHE_NAMESPACE)
        record_and_publish(producer, 'trip.created', _trip_event_payload(trip, request.user.id))
        return data_response(self.get_serializer(load_trip_with_relations(trip.id)).data, status_code=status.HTTP_201_CREATED)


class TripDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = TripSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]
    http_method_names = ['get', 'put', 'delete', 'options']

    def get_queryset(self):
        # Read access: public trips OR trips the caller created / is a member of.
        # Write access (put/delete) reuses the same queryset but is further
        # gated by can_manage_trip() in update()/destroy() below.
        base = with_trip_relations(Trip.objects.all())
        user = getattr(self.request, 'user', None)
        user_id = getattr(user, 'id', None)
        if user_id is None:
            return base.filter(is_public=True)
        return base.filter(
            Q(is_public=True)
            | Q(creator_id=user_id)
            | Q(members__user_id=user_id)
        ).distinct()

    def retrieve(self, request, *args, **kwargs):
        response = super().retrieve(request, *args, **kwargs)
        return apply_conditional_etag(request, response)

    def update(self, request, *args, **kwargs):
        trip = self.get_object()
        if not can_edit_trip(request.user, trip):
            raise PermissionDenied
        serializer = self.get_serializer(trip, data=request.data)
        serializer.is_valid(raise_exception=True)
        trip = serializer.save()
        _sync_trip_spots_from_payload(trip, request.user, getattr(serializer, 'nested_spots_payload', None))
        if is_trip_owner(request.user, trip):
            _sync_trip_members_from_payload(trip, getattr(serializer, 'nested_members_payload', None))
        trip = load_trip_with_relations(trip.id)
        index_trip(trip)
        invalidate_cache_namespaces(FEED_CACHE_NAMESPACE)
        return Response(self.get_serializer(trip).data)

    def destroy(self, request, *args, **kwargs):
        trip = self.get_object()
        if not is_trip_owner(request.user, trip):
            raise PermissionDenied
        trip_id = str(trip.id)
        _delete_generated_spots_for_trip(trip)
        response = super().destroy(request, *args, **kwargs)
        delete_trip(trip_id)
        invalidate_cache_namespaces(FEED_CACHE_NAMESPACE)
        record_and_publish(producer, 'trip.deleted', {'tripId': trip_id, 'userId': str(request.user.id), 'occurredAt': _iso_timestamp(timezone.now())})
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
    if not can_edit_trip(request.user, trip):
        raise PermissionDenied
    serializer = TripAddSpotSerializer(data=request.data, context={'user': request.user})
    serializer.is_valid(raise_exception=True)
    spot, source = _resolve_spot_for_trip(trip, request.user, serializer.validated_data)
    _, created = TripSpot.objects.update_or_create(
        trip=trip,
        spot=spot,
        defaults={
            'day_number': serializer.validated_data.get('day_number'),
            'sort_order': serializer.validated_data.get('sort_order', 0),
            'notes': serializer.validated_data.get('notes', ''),
            'source': source,
        },
    )
    invalidate_cache_namespaces(FEED_CACHE_NAMESPACE)
    return data_response(
        TripSerializer(load_trip_with_relations(trip.id)).data,
        status_code=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
    )


@api_view(['DELETE'])
@permission_classes([IsAuthenticatedJWT])
def remove_trip_spot(request, pk, spot_id):
    trip = get_object_or_404(Trip, pk=pk)
    if not can_edit_trip(request.user, trip):
        raise PermissionDenied
    trip_spots = list(TripSpot.objects.select_related('spot').filter(trip=trip, spot_id=spot_id))
    for trip_spot in trip_spots:
        _delete_generated_spot_if_orphaned(trip_spot)
    TripSpot.objects.filter(id__in=[trip_spot.id for trip_spot in trip_spots]).delete()
    invalidate_cache_namespaces(FEED_CACHE_NAMESPACE)
    return data_response({'removed': True, 'trip': TripSerializer(load_trip_with_relations(trip.id)).data})


@api_view(['PUT'])
@permission_classes([IsAuthenticatedJWT])
def reorder_trip_spots(request, pk):
    trip = get_object_or_404(Trip, pk=pk)
    if not can_edit_trip(request.user, trip):
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
    missing_spot_ids = [str(spot_id) for spot_id in requested_spot_ids if spot_id not in trip_spots_by_spot_id]
    if missing_spot_ids:
        raise ValidationError({'spots': f'Spots are not on this trip: {", ".join(missing_spot_ids)}'})
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
        if not (is_trip_owner(request.user, trip) or is_trip_member(request.user, trip)):
            raise PermissionDenied
        members = TripMember.objects.filter(trip=trip).only('id', 'trip_id', 'user_id', 'role', 'joined_at').order_by('joined_at')
        return data_response(TripMemberSerializer(members, many=True).data)
    if not is_trip_owner(request.user, trip):
        raise PermissionDenied
    serializer = TripMemberCreateSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    member, created = TripMember.objects.get_or_create(
        trip=trip,
        user_id=serializer.validated_data['user_id'],
        defaults={'role': serializer.validated_data['role']},
    )
    if not created and (member.role == 'owner' or member.user_id == trip.creator_id):
        raise ValidationError({'role': 'Owner membership cannot be changed here'})
    if not created and member.role != serializer.validated_data['role']:
        member.role = serializer.validated_data['role']
        member.save(update_fields=['role'])
    invalidate_cache_namespaces(FEED_CACHE_NAMESPACE)
    if created:
        record_and_publish(
            producer,
            'trip.member.added',
            {
                'tripId': str(trip.id),
                'userId': str(serializer.validated_data['user_id']),
                'addedUserId': str(serializer.validated_data['user_id']),
                'actorUserId': str(request.user.id),
                'ownerUserId': str(trip.creator_id),
                'tripTitle': trip.title,
                'role': serializer.validated_data['role'],
                'occurredAt': _iso_timestamp(timezone.now()),
            },
        )
    return data_response(
        TripMemberSerializer(member).data,
        status_code=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
    )


@api_view(['DELETE'])
@permission_classes([IsAuthenticatedJWT])
def remove_trip_member(request, pk, user_id):
    trip = get_object_or_404(Trip, pk=pk)
    if not is_trip_owner(request.user, trip):
        raise PermissionDenied
    deleted, _ = TripMember.objects.filter(trip=trip, user_id=user_id).exclude(role='owner').exclude(user_id=trip.creator_id).delete()
    invalidate_cache_namespaces(FEED_CACHE_NAMESPACE)
    return data_response({'removed': deleted > 0})


@api_view(['POST'])
@permission_classes([IsAuthenticatedJWT])
def share_trip(request, pk):
    trip = get_object_or_404(Trip, pk=pk)
    if not is_trip_owner(request.user, trip):
        raise PermissionDenied
    if trip.share_token is None:
        trip.share_token = uuid4()
    trip.share_created_at = timezone.now()
    trip.save(update_fields=['share_token', 'share_created_at'])
    return data_response({
        'token': str(trip.share_token),
        'path': f'/trips/shared/{trip.share_token}',
    })


@api_view(['GET'])
def shared_trip_detail(request, token):
    trip = get_object_or_404(with_trip_relations(Trip.objects.all()), share_token=token)
    return data_response(TripSerializer(trip).data)
