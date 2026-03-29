from __future__ import annotations

from django.conf import settings
from django.db.models import Q
from django.shortcuts import get_object_or_404
from rest_framework import generics, permissions, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.exceptions import PermissionDenied

from common.cache_utils import FEED_CACHE_NAMESPACE, SPOTS_CACHE_NAMESPACE, cached_api_response, invalidate_cache_namespaces
from common.etag import apply_conditional_etag
from common.kafka_producer import AtlasKafkaProducer
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

producer = AtlasKafkaProducer()


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
            queryset = queryset.filter(Q(title__icontains=q) | Q(description__icontains=q) | Q(vibe__icontains=q))
        return queryset.order_by('-created_at')

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(user_id=request.user.id)
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
    queryset = with_spot_detail_relations(Spot.objects.all())
    serializer_class = SpotDetailSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]
    http_method_names = ['get', 'put', 'delete', 'options']

    def retrieve(self, request, *args, **kwargs):
        parent = super()
        response = cached_api_response(
            request,
            SPOTS_CACHE_NAMESPACE,
            settings.CACHE_SPOTS_TIMEOUT_SECONDS,
            lambda: parent.retrieve(request, *args, **kwargs),
            extra=f'spot-detail:{kwargs.get("pk")}',
        )
        return apply_conditional_etag(request, response)

    def update(self, request, *args, **kwargs):
        spot = self.get_object()
        if str(spot.user_id) != str(getattr(request.user, 'id', '')) and not getattr(request.user, 'is_admin', False):
            raise PermissionDenied
        response = super().update(request, *args, **kwargs)
        invalidate_cache_namespaces(SPOTS_CACHE_NAMESPACE, FEED_CACHE_NAMESPACE)
        producer.publish('spot.updated', {'spotId': str(spot.id), 'userId': str(request.user.id)})
        return response

    def destroy(self, request, *args, **kwargs):
        spot = self.get_object()
        if str(spot.user_id) != str(getattr(request.user, 'id', '')) and not getattr(request.user, 'is_admin', False):
            raise PermissionDenied
        response = super().destroy(request, *args, **kwargs)
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
        return data_response({'liked': True}, status_code=201 if created else 200)
    Like.objects.filter(spot=spot, user_id=request.user.id).delete()
    invalidate_cache_namespaces(SPOTS_CACHE_NAMESPACE, FEED_CACHE_NAMESPACE)
    return data_response({'liked': False})


@api_view(['GET'])
def spot_photos(request, pk):
    def build_response():
        photos = Photo.objects.filter(spot_id=pk).order_by('sort_order', 'created_at')
        return data_response([{'id': str(photo.id), 'storageUrl': photo.storage_url, 'caption': photo.caption} for photo in photos])

    return cached_api_response(
        request,
        SPOTS_CACHE_NAMESPACE,
        settings.CACHE_SPOTS_TIMEOUT_SECONDS,
        build_response,
        extra=f'spot-photos:{pk}',
    )
