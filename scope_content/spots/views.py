from __future__ import annotations

import json
import os

from django.conf import settings
from django.db import connection
from django.db import transaction
from django.db.models import Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import generics, permissions, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.exceptions import PermissionDenied, ValidationError

from common.cache_utils import (
    FEED_CACHE_NAMESPACE,
    SPOTS_CACHE_NAMESPACE,
    cached_api_response,
    invalidate_cache_namespaces,
)
from common.content_safety import evaluate_text_fields
from common.db_router import read_from_primary
from common.etag import apply_conditional_etag
from common.events import record_and_publish
from common.indexing import delete_review, delete_spot, index_spot
from common.kafka_producer import ScopeKafkaProducer
from common.permissions import IsAuthenticatedJWT
from common.responses import data_response
from photos.delivery import photo_delivery_url
from photos.models import Photo
from photos.serializers import PhotoUploadSerializer
from photos.services.s3_service import S3StorageService
from reviews.models import Review
from spots.models import Spot
from spots.querysets import visible_to_request, with_spot_detail_relations, with_spot_list_relations, with_spot_viewer_state
from spots.serializers import (
    AppendixBSpotCreateResponseSerializer,
    AppendixBSpotListItemSerializer,
    NearbyQuerySerializer,
    SpotDetailSerializer,
    SpotSerializer,
)
from spots.services.place_verification import verify_spot_place
from trips.models import Like

producer = ScopeKafkaProducer()
_MSSQL_FULLTEXT_AVAILABLE: bool | None = None
_OUTDOOR_CATEGORIES = {'nature', 'outdoors', 'scenic', 'adventure'}


def _iso_timestamp(value) -> str:
    return value.isoformat().replace('+00:00', 'Z')


def _spot_event_payload(spot: Spot, user_id) -> dict:
    rating = getattr(spot, 'rating', None)
    return {
        'spotId': str(spot.id),
        'userId': str(user_id),
        'ownerUserId': str(spot.user_id),
        'title': spot.title,
        'spotTitle': spot.title,
        'description': spot.description,
        'latitude': float(spot.latitude),
        'longitude': float(spot.longitude),
        'postalCode': spot.postal_code,
        'category': spot.category,
        'vibe': spot.vibe,
        'isPublic': bool(spot.is_public),
        'rating': float(rating) if rating is not None else 0.0,
        'isOutdoor': spot.category in _OUTDOOR_CATEGORIES,
        'photosCount': spot.photos.count() if getattr(spot, 'pk', None) else 0,
        'likedByUsers': [str(user_id) for user_id in Like.objects.filter(spot=spot).values_list('user_id', flat=True)],
        'occurredAt': _iso_timestamp(getattr(spot, 'updated_at', None) or timezone.now()),
    }


def _friendly_safety_error(field: str | None = None) -> ValidationError:
    return ValidationError({field or 'content': ['This contains a blocked slur or hate term.']})


def _check_spot_safety(spot_data: dict, captions: list[str] | None = None):
    pillar_labels = spot_data.get('pillars') if isinstance(spot_data.get('pillars'), list) else []
    result = evaluate_text_fields(
        [
            ('title', spot_data.get('title', '')),
            ('description', spot_data.get('description', '')),
            ('vibe', spot_data.get('vibe', '')),
            ('pillars', pillar_labels),
            ('captions', captions or []),
        ]
    )
    if not result.clean:
        raise _friendly_safety_error(result.field)
    return result


def _coerce_json_object(raw_value) -> dict:
    if isinstance(raw_value, dict):
        return raw_value
    if isinstance(raw_value, str):
        try:
            parsed = json.loads(raw_value)
        except ValueError:
            raise ValidationError({'spot': ['Spot metadata must be valid JSON.']})
        if isinstance(parsed, dict):
            return parsed
    raise ValidationError({'spot': ['Spot metadata is required.']})


def _extract_spot_payload(request) -> dict:
    raw_spot = request.data.get('spot') if hasattr(request.data, 'get') else None
    if raw_spot is not None:
        return _coerce_json_object(raw_spot)

    payload = request.data.copy() if hasattr(request.data, 'copy') else dict(request.data)
    for key in ('photos', 'photo', 'files', 'captions', 'sortOrders'):
        payload.pop(key, None)
    return payload


def _extract_list_field(request, field_name: str) -> list[str]:
    if not hasattr(request.data, 'getlist'):
        raw_value = request.data.get(field_name) if hasattr(request.data, 'get') else None
        if isinstance(raw_value, list):
            return [str(value) for value in raw_value]
        if isinstance(raw_value, str):
            try:
                parsed = json.loads(raw_value)
            except ValueError:
                return [raw_value]
            if isinstance(parsed, list):
                return [str(value) for value in parsed]
            return [raw_value]
        return []

    values = [str(value) for value in request.data.getlist(field_name)]
    if len(values) == 1:
        try:
            parsed = json.loads(values[0])
        except ValueError:
            return values
        if isinstance(parsed, list):
            return [str(value) for value in parsed]
    return values


def _build_verification_payload(spot_data: dict) -> dict:
    provider_place_id = spot_data.get('providerPlaceId') or spot_data.get('provider_place_id') or ''
    provider_place_name = spot_data.get('providerPlaceName') or spot_data.get('provider_place_name') or ''
    provider_place_address = spot_data.get('providerPlaceAddress') or spot_data.get('provider_place_address') or ''
    return {
        'title': provider_place_name if provider_place_id and provider_place_name else spot_data.get('title', ''),
        'address': provider_place_address if provider_place_id and provider_place_address else spot_data.get('address', ''),
        'city': spot_data.get('city', ''),
        'country': spot_data.get('country', ''),
        'postalCode': spot_data.get('postalCode') or spot_data.get('postal_code') or '',
        'latitude': spot_data.get('latitude'),
        'longitude': spot_data.get('longitude'),
        'providerPlaceId': provider_place_id,
    }


def _apply_clean_state(spot: Spot) -> None:
    spot.safety_status = Spot.SAFETY_CLEAN
    spot.safety_reason = ''


def _apply_verified_state(spot: Spot, verification: dict) -> None:
    spot.verification_status = Spot.VERIFICATION_VERIFIED
    spot.verification_source = str(verification.get('source') or '')[:40]
    spot.provider_place_id = str(verification.get('providerPlaceId') or verification.get('provider_place_id') or '')[:255]
    spot.provider_place_name = str(verification.get('providerPlaceName') or verification.get('provider_place_name') or '')[:255]
    spot.provider_place_address = str(verification.get('providerPlaceAddress') or verification.get('provider_place_address') or '')[:500]
    if spot.provider_place_address:
        spot.address = spot.provider_place_address[:500]
    city = str(verification.get('city') or '').strip()
    country = str(verification.get('country') or '').strip()
    postal_code = str(verification.get('postalCode') or verification.get('postal_code') or '').strip()
    if city and not spot.city:
        spot.city = city[:100]
    if country and not spot.country:
        spot.country = country[:100]
    if postal_code and not spot.postal_code:
        spot.postal_code = postal_code[:32]
    distance = verification.get('distanceMeters') or verification.get('verificationDistanceMeters') or verification.get('distance_meters')
    try:
        spot.verification_distance_meters = float(distance) if distance is not None else None
    except (TypeError, ValueError):
        spot.verification_distance_meters = None
    spot.verified_at = timezone.now()


def _apply_unverified_state(spot: Spot) -> None:
    spot.verification_status = Spot.VERIFICATION_UNVERIFIED
    spot.verification_source = ''
    spot.provider_place_id = ''
    spot.provider_place_name = ''
    spot.provider_place_address = ''
    spot.verification_distance_meters = None
    spot.verified_at = None


def _verification_error(verification: dict) -> ValidationError:
    reason = str(verification.get('reason') or 'Choose a real provider-backed place before publishing.')
    details: dict = {'location': [reason]}
    candidates = verification.get('candidates')
    if isinstance(candidates, list) and candidates:
        details['candidates'] = candidates[:3]
    return ValidationError(details)


def _detail_queryset_for_request(request):
    queryset = Spot.objects.all()
    user = getattr(request, 'user', None)
    if getattr(user, 'is_authenticated', False):
        queryset = queryset.using('default')

    return with_spot_viewer_state(
        with_spot_detail_relations(visible_to_request(queryset, request)),
        request,
    )


def _list_queryset_for_request(request, queryset):
    return with_spot_viewer_state(with_spot_list_relations(visible_to_request(queryset, request)), request)


def _mssql_fulltext_available() -> bool:
    global _MSSQL_FULLTEXT_AVAILABLE
    if _MSSQL_FULLTEXT_AVAILABLE is not None:
        return _MSSQL_FULLTEXT_AVAILABLE
    _MSSQL_FULLTEXT_AVAILABLE = os.getenv('CONTENT_MSSQL_FULLTEXT_ENABLED', '').strip().lower() in {
        '1',
        'true',
        'yes',
        'on',
    }
    return _MSSQL_FULLTEXT_AVAILABLE


def _sanitize_fts_term(term: str) -> str:
    """Strip characters that would turn CONTAINS / to_tsquery into a syntax
    error or an injection vector. We keep alphanumerics, spaces, and hyphens
    (plenty for substring-flavored search) and fall back to an empty string
    when nothing remains.
    """
    allowed = [c for c in term if c.isalnum() or c.isspace() or c == '-']
    cleaned = ''.join(allowed).strip()
    return cleaned


def _apply_search(queryset, term: str):
    """Route the ``q=`` filter through a backend-native FTS index when one
    exists (see migration 0003). SQLite/MySQL — our test + dev harnesses and
    any shop not on SQL Server/Postgres — fall back to LIKE scans so behavior
    stays identical, it's just slower.

    Safety: ``extra(where=..., params=...)`` binds the term as a parameter so
    we're not building SQL with raw user input. The sanitizer above is belt
    + suspenders against the CONTAINS / to_tsquery parsers, which have their
    own escaping rules that Django's ORM doesn't know about.
    """
    vendor = connection.vendor
    cleaned = _sanitize_fts_term(term)
    if not cleaned:
        return queryset

    if vendor == 'microsoft' and _mssql_fulltext_available():
        # SQL Server CONTAINS requires a prefix-quoted term for FORMSOF. Wrap
        # in double quotes so multi-word queries act as phrase-ish matches.
        return queryset.extra(
            where=[
                'CONTAINS((title, description, vibe, city), %s)'
            ],
            params=[f'"{cleaned}*"'],
        )

    if vendor == 'postgresql':
        return queryset.extra(
            where=[
                "to_tsvector('english', "
                "coalesce(title,'') || ' ' || coalesce(description,'') || ' ' || "
                "coalesce(vibe,'') || ' ' || coalesce(city,'')"
                ") @@ plainto_tsquery('english', %s)"
            ],
            params=[cleaned],
        )

    # sqlite / mysql / anything else: original LIKE-based search so tests and
    # local dev keep working identically.
    return queryset.filter(
        Q(title__icontains=term) | Q(description__icontains=term) | Q(vibe__icontains=term)
    )


class SpotListCreateView(generics.ListCreateAPIView):
    serializer_class = SpotSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]

    def list(self, request, *args, **kwargs):
        def build_response():
            queryset = self.filter_queryset(self.get_queryset())
            page = self.paginate_queryset(queryset)
            serializer = AppendixBSpotListItemSerializer(page, many=True, context={'request': request})
            return self.get_paginated_response(serializer.data)

        return cached_api_response(
            request,
            SPOTS_CACHE_NAMESPACE,
            settings.CACHE_SPOTS_TIMEOUT_SECONDS,
            build_response,
            extra='spots-list',
        )

    def get_queryset(self):
        queryset = _list_queryset_for_request(self.request, Spot.objects.all())
        if category := self.request.query_params.get('category'):
            queryset = queryset.filter(category=category)
        if city := self.request.query_params.get('city'):
            queryset = queryset.filter(city__iexact=city)
        if q := self.request.query_params.get('q'):
            queryset = _apply_search(queryset, q)
        return queryset.order_by('-created_at')

    def create(self, request, *args, **kwargs):
        incoming_is_public = request.data.get('is_public', request.data.get('isPublic', True))
        if str(incoming_is_public).lower() not in {'false', '0', 'no', 'off'}:
            raise ValidationError({'isPublic': ['Public spot publishing must use the verified compose flow.']})

        _check_spot_safety(request.data)
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(
            user_id=request.user.id,
            is_public=False,
            safety_status=Spot.SAFETY_CLEAN,
            safety_reason='',
            verification_status=Spot.VERIFICATION_UNVERIFIED,
        )
        index_spot(serializer.instance)
        invalidate_cache_namespaces(SPOTS_CACHE_NAMESPACE, FEED_CACHE_NAMESPACE)
        record_and_publish(producer, 'spot.created', _spot_event_payload(serializer.instance, request.user.id))
        return data_response(
            AppendixBSpotCreateResponseSerializer(serializer.instance).data,
            status_code=status.HTTP_201_CREATED,
        )


class SpotDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = SpotDetailSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]
    http_method_names = ['get', 'put', 'delete', 'options']

    def get_queryset(self):
        return _detail_queryset_for_request(self.request)

    def retrieve(self, request, *args, **kwargs):
        parent = super()
        response = cached_api_response(
            request,
            SPOTS_CACHE_NAMESPACE,
            settings.CACHE_SPOTS_TIMEOUT_SECONDS,
            lambda: parent.retrieve(request, *args, **kwargs),
            extra=f'spot-detail:{kwargs.get("pk")}:u={getattr(request.user, "id", "anon")}',
        )
        return apply_conditional_etag(request, response)

    def update(self, request, *args, **kwargs):
        spot = self.get_object()
        if str(spot.user_id) != str(getattr(request.user, 'id', '')) and not getattr(request.user, 'is_admin', False):
            raise PermissionDenied
        _check_spot_safety(request.data)
        was_public = spot.is_public
        response = super().update(request, *args, **kwargs)
        updated_spot = self.get_object()
        if not was_public and updated_spot.is_public and updated_spot.verification_status != Spot.VERIFICATION_VERIFIED:
            updated_spot.is_public = False
            updated_spot.verification_status = Spot.VERIFICATION_REJECTED
            updated_spot.save(update_fields=['is_public', 'verification_status', 'updated_at'])
            raise ValidationError({'isPublic': ['Verify this spot before making it public.']})
        updated_spot.safety_status = Spot.SAFETY_CLEAN
        updated_spot.safety_reason = ''
        updated_spot.save(update_fields=['safety_status', 'safety_reason', 'updated_at'])
        index_spot(updated_spot)
        invalidate_cache_namespaces(SPOTS_CACHE_NAMESPACE, FEED_CACHE_NAMESPACE)
        record_and_publish(producer, 'spot.updated', _spot_event_payload(updated_spot, request.user.id))
        return response

    def destroy(self, request, *args, **kwargs):
        spot = self.get_object()
        if str(spot.user_id) != str(getattr(request.user, 'id', '')) and not getattr(request.user, 'is_admin', False):
            raise PermissionDenied
        review_ids = list(Review.objects.filter(spot_id=spot.id).values_list('id', flat=True))
        response = super().destroy(request, *args, **kwargs)
        for review_id in review_ids:
            delete_review(str(review_id))
        delete_spot(str(spot.id))
        invalidate_cache_namespaces(SPOTS_CACHE_NAMESPACE, FEED_CACHE_NAMESPACE)
        return response


@api_view(['POST'])
@permission_classes([IsAuthenticatedJWT])
def compose_spot(request):
    spot_payload = _extract_spot_payload(request)
    captions = _extract_list_field(request, 'captions')
    photos = list(request.FILES.getlist('photos')) if hasattr(request, 'FILES') else []
    is_public = str(spot_payload.get('is_public', spot_payload.get('isPublic', True))).lower() not in {
        'false',
        '0',
        'no',
        'off',
    }

    _check_spot_safety(spot_payload, captions)

    serializer = SpotSerializer(data=spot_payload)
    serializer.is_valid(raise_exception=True)
    pillars = serializer.validated_data.get('pillars') or []
    if not pillars:
        raise ValidationError({'pillars': ['Choose at least one vibe pillar.']})
    if len(pillars) > 4:
        raise ValidationError({'pillars': ['Choose up to 4 vibe pillars.']})

    if is_public and not photos:
        raise ValidationError({'photos': ['Public spots need at least one valid photo.']})

    verification = {}
    if is_public:
        verification = verify_spot_place(
            _build_verification_payload({**spot_payload, **serializer.validated_data}),
            request.headers.get('Authorization', ''),
        )
        if not verification.get('verified'):
            raise _verification_error(verification)

    photo_rows: list[Photo] = []
    service = S3StorageService()

    with transaction.atomic():
        spot = serializer.save(
            user_id=request.user.id,
            is_public=is_public,
            safety_status=Spot.SAFETY_CLEAN,
            safety_reason='',
        )
        if is_public:
            _apply_verified_state(spot, verification)
        else:
            _apply_unverified_state(spot)
        _apply_clean_state(spot)
        spot.save(
            update_fields=[
                'is_public',
                'verification_status',
                'verification_source',
                'provider_place_id',
                'provider_place_name',
                'provider_place_address',
                'verification_distance_meters',
                'verified_at',
                'address',
                'city',
                'country',
                'postal_code',
                'safety_status',
                'safety_reason',
                'updated_at',
            ]
        )

        for index, upload in enumerate(photos):
            photo_serializer = PhotoUploadSerializer(
                data={
                    'spot_id': str(spot.id),
                    'file': upload,
                    'caption': captions[index] if index < len(captions) else '',
                    'sort_order': index,
                }
            )
            photo_serializer.is_valid(raise_exception=True)
            stored = service.store(photo_serializer.validated_data['file'])
            photo = Photo.objects.create(
                spot_id=spot.id,
                user_id=request.user.id,
                storage_key=stored['storage_key'],
                storage_url=stored['storage_url'],
                thumbnail_url=stored['thumbnail_url'],
                caption=photo_serializer.validated_data.get('caption', ''),
                sort_order=photo_serializer.validated_data.get('sort_order', index),
            )
            photo_rows.append(photo)

    index_spot(spot)
    invalidate_cache_namespaces(SPOTS_CACHE_NAMESPACE, FEED_CACHE_NAMESPACE)
    record_and_publish(producer, 'spot.created', _spot_event_payload(spot, request.user.id))
    for photo in photo_rows:
        record_and_publish(
            producer,
            'photo.uploaded',
            {
                'photoId': str(photo.id),
                'spotId': str(photo.spot_id),
                'userId': str(request.user.id),
                'storageUrl': photo.storage_url,
                'thumbnailUrl': photo.thumbnail_url,
            },
        )

    with read_from_primary():
        refreshed_spot = with_spot_viewer_state(
            with_spot_detail_relations(Spot.objects.filter(pk=spot.pk)),
            request,
        ).get()
    return data_response(SpotDetailSerializer(refreshed_spot, context={'request': request}).data, status_code=status.HTTP_201_CREATED)


@api_view(['GET'])
def nearby_spots(request):
    def build_response():
        serializer = NearbyQuerySerializer(data=request.query_params)
        serializer.is_valid(raise_exception=True)
        queryset = serializer.filter_queryset(visible_to_request(Spot.objects.all(), request))
        queryset = with_spot_viewer_state(with_spot_list_relations(queryset), request).order_by('-created_at')
        paginator = SpotListCreateView.pagination_class()
        page = paginator.paginate_queryset(queryset, request)
        return paginator.get_paginated_response(SpotSerializer(page, many=True, context={'request': request}).data)

    return cached_api_response(
        request,
        SPOTS_CACHE_NAMESPACE,
        settings.CACHE_SPOTS_TIMEOUT_SECONDS,
        build_response,
        extra='spots-nearby',
    )


@api_view(['GET'])
def user_spots(request, user_id):
    def build_response():
        queryset = with_spot_viewer_state(
            with_spot_list_relations(Spot.objects.filter(user_id=user_id, is_public=True)),
            request,
        ).order_by('-created_at')
        paginator = SpotListCreateView.pagination_class()
        page = paginator.paginate_queryset(queryset, request)
        return paginator.get_paginated_response(SpotSerializer(page, many=True, context={'request': request}).data)

    return cached_api_response(
        request,
        SPOTS_CACHE_NAMESPACE,
        settings.CACHE_SPOTS_TIMEOUT_SECONDS,
        build_response,
        extra=f'spots-user:{user_id}',
    )


@api_view(['GET'])
def explore_spots(request):
    def build_response():
        view = SpotListCreateView()
        view.request = request
        queryset = view.get_queryset().filter(is_public=True)
        paginator = SpotListCreateView.pagination_class()
        page = paginator.paginate_queryset(queryset, request)
        return paginator.get_paginated_response(SpotSerializer(page, many=True, context={'request': request}).data)

    return cached_api_response(
        request,
        SPOTS_CACHE_NAMESPACE,
        settings.CACHE_SPOTS_TIMEOUT_SECONDS,
        build_response,
        extra='spots-explore',
    )


@api_view(['POST', 'DELETE'])
@permission_classes([IsAuthenticatedJWT])
def like_spot(request, pk):
    spot = get_object_or_404(visible_to_request(Spot.objects.all(), request), pk=pk)
    if request.method == 'POST':
        like, created = Like.objects.get_or_create(spot=spot, user_id=request.user.id)
        invalidate_cache_namespaces(SPOTS_CACHE_NAMESPACE, FEED_CACHE_NAMESPACE)
        if created:
            record_and_publish(
                producer,
                'spot.liked',
                {
                    'spotId': str(spot.id),
                    'userId': str(request.user.id),
                    'ownerUserId': str(spot.user_id),
                    'spotTitle': spot.title,
                    'isPublic': bool(spot.is_public),
                    'interactionType': 'like',
                    'occurredAt': _iso_timestamp(timezone.now()),
                },
            )
        refreshed_spot = get_object_or_404(_detail_queryset_for_request(request), pk=pk)
        return data_response(
            SpotDetailSerializer(refreshed_spot, context={'request': request}).data,
            status_code=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )
    Like.objects.filter(spot=spot, user_id=request.user.id).delete()
    invalidate_cache_namespaces(SPOTS_CACHE_NAMESPACE, FEED_CACHE_NAMESPACE)
    refreshed_spot = get_object_or_404(_detail_queryset_for_request(request), pk=pk)
    return data_response(SpotDetailSerializer(refreshed_spot, context={'request': request}).data)


@api_view(['GET'])
@permission_classes([IsAuthenticatedJWT])
def saved_spots(request):
    queryset = with_spot_viewer_state(
        with_spot_list_relations(
            visible_to_request(Spot.objects.filter(likes__user_id=request.user.id), request).distinct()
        ),
        request,
    ).order_by('-likes__created_at', '-created_at')
    paginator = SpotListCreateView.pagination_class()
    page = paginator.paginate_queryset(queryset, request)
    return paginator.get_paginated_response(SpotSerializer(page, many=True, context={'request': request}).data)


@api_view(['GET'])
def spot_photos(request, pk):
    def build_response():
        photo_rows = list(
            visible_to_request(Spot.objects.filter(pk=pk), request)
            .order_by('photos__sort_order', 'photos__created_at')
            .values('is_public', 'photos__id', 'photos__storage_url', 'photos__caption')
        )
        if not photo_rows:
            get_object_or_404(visible_to_request(Spot.objects.only('id'), request), pk=pk)

        return data_response(
            [
                {
                    'id': str(photo['photos__id']),
                    'storageUrl': photo_delivery_url(
                        photo_id=photo['photos__id'],
                        source_url=photo['photos__storage_url'],
                        is_public=photo['is_public'],
                        request=request,
                    ),
                    'caption': photo['photos__caption'],
                }
                for photo in photo_rows
                if photo['photos__id'] is not None
            ]
        )

    return cached_api_response(
        request,
        SPOTS_CACHE_NAMESPACE,
        settings.CACHE_SPOTS_TIMEOUT_SECONDS,
        build_response,
        extra=f'spot-photos:{pk}',
    )
