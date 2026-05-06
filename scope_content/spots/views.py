from __future__ import annotations

import os

from django.conf import settings
from django.db import connection
from django.db.models import Q
from django.shortcuts import get_object_or_404
from rest_framework import generics, permissions, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.exceptions import PermissionDenied

from common.cache_utils import (
    FEED_CACHE_NAMESPACE,
    SPOTS_CACHE_NAMESPACE,
    cached_api_response,
    invalidate_cache_namespaces,
)
from common.etag import apply_conditional_etag
from common.indexing import delete_spot, index_spot
from common.kafka_producer import ScopeKafkaProducer
from common.permissions import IsAuthenticatedJWT
from common.responses import data_response
from photos.models import Photo
from spots.models import Spot
from spots.querysets import with_spot_detail_relations, with_spot_list_relations
from spots.serializers import (
    AppendixBSpotCreateResponseSerializer,
    AppendixBSpotListItemSerializer,
    NearbyQuerySerializer,
    SpotDetailSerializer,
    SpotSerializer,
)
from trips.models import Like

producer = ScopeKafkaProducer()
_MSSQL_FULLTEXT_AVAILABLE: bool | None = None


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
            serializer = AppendixBSpotListItemSerializer(page, many=True)
            return self.get_paginated_response(serializer.data)

        return cached_api_response(
            request,
            SPOTS_CACHE_NAMESPACE,
            settings.CACHE_SPOTS_TIMEOUT_SECONDS,
            build_response,
            extra='spots-list',
        )

    def get_queryset(self):
        queryset = with_spot_list_relations(
            Spot.objects.filter(Q(is_public=True) | Q(user_id=getattr(self.request.user, 'id', None)))
        )
        if category := self.request.query_params.get('category'):
            queryset = queryset.filter(category=category)
        if city := self.request.query_params.get('city'):
            queryset = queryset.filter(city__iexact=city)
        if q := self.request.query_params.get('q'):
            queryset = _apply_search(queryset, q)
        return queryset.order_by('-created_at')

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(user_id=request.user.id)
        index_spot(serializer.instance)
        invalidate_cache_namespaces(SPOTS_CACHE_NAMESPACE, FEED_CACHE_NAMESPACE)
        producer.publish(
            'spot.created',
            {
                'spotId': str(serializer.instance.id),
                'userId': str(request.user.id),
                'title': serializer.instance.title,
                'latitude': float(serializer.instance.latitude),
                'longitude': float(serializer.instance.longitude),
                'category': serializer.instance.category,
            },
        )
        return data_response(
            AppendixBSpotCreateResponseSerializer(serializer.instance).data,
            status_code=status.HTTP_201_CREATED,
        )


class SpotDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = SpotDetailSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]
    http_method_names = ['get', 'put', 'delete', 'options']

    def get_queryset(self):
        requester_id = getattr(self.request.user, 'id', None)
        is_admin = getattr(self.request.user, 'is_admin', False)
        base = with_spot_detail_relations(Spot.objects.all())
        if is_admin:
            return base
        return base.filter(Q(is_public=True) | Q(user_id=requester_id))

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
        response = super().update(request, *args, **kwargs)
        index_spot(self.get_object())
        invalidate_cache_namespaces(SPOTS_CACHE_NAMESPACE, FEED_CACHE_NAMESPACE)
        producer.publish('spot.updated', {'spotId': str(spot.id), 'userId': str(request.user.id)})
        return response

    def destroy(self, request, *args, **kwargs):
        spot = self.get_object()
        if str(spot.user_id) != str(getattr(request.user, 'id', '')) and not getattr(request.user, 'is_admin', False):
            raise PermissionDenied
        response = super().destroy(request, *args, **kwargs)
        delete_spot(str(spot.id))
        invalidate_cache_namespaces(SPOTS_CACHE_NAMESPACE, FEED_CACHE_NAMESPACE)
        return response


@api_view(['GET'])
def nearby_spots(request):
    def build_response():
        serializer = NearbyQuerySerializer(data=request.query_params)
        serializer.is_valid(raise_exception=True)
        queryset = serializer.filter_queryset(Spot.objects.filter(is_public=True))
        queryset = with_spot_list_relations(queryset).order_by('-created_at')
        paginator = SpotListCreateView.pagination_class()
        page = paginator.paginate_queryset(queryset, request)
        return paginator.get_paginated_response(SpotSerializer(page, many=True).data)

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
        queryset = with_spot_list_relations(Spot.objects.filter(user_id=user_id, is_public=True)).order_by('-created_at')
        paginator = SpotListCreateView.pagination_class()
        page = paginator.paginate_queryset(queryset, request)
        return paginator.get_paginated_response(SpotSerializer(page, many=True).data)

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
        return paginator.get_paginated_response(SpotSerializer(page, many=True).data)

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
    spot = get_object_or_404(Spot, pk=pk)
    if request.method == 'POST':
        like, created = Like.objects.get_or_create(spot=spot, user_id=request.user.id)
        invalidate_cache_namespaces(SPOTS_CACHE_NAMESPACE, FEED_CACHE_NAMESPACE)
        if created:
            producer.publish('spot.liked', {'spotId': str(spot.id), 'userId': str(request.user.id)})
        return data_response(
            {'liked': True},
            status_code=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )
    Like.objects.filter(spot=spot, user_id=request.user.id).delete()
    invalidate_cache_namespaces(SPOTS_CACHE_NAMESPACE, FEED_CACHE_NAMESPACE)
    return data_response({'liked': False})


@api_view(['GET'])
def spot_photos(request, pk):
    def build_response():
        photos = (
            Photo.objects.filter(spot_id=pk)
            .order_by('sort_order', 'created_at')
            .values('id', 'storage_url', 'caption')
        )
        return data_response(
            [{'id': str(photo['id']), 'storageUrl': photo['storage_url'], 'caption': photo['caption']} for photo in photos]
        )

    return cached_api_response(
        request,
        SPOTS_CACHE_NAMESPACE,
        settings.CACHE_SPOTS_TIMEOUT_SECONDS,
        build_response,
        extra=f'spot-photos:{pk}',
    )
