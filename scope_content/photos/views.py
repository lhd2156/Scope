from __future__ import annotations

import os

from django.conf import settings
from django.http import Http404
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.exceptions import PermissionDenied

from common.cache_utils import (
    FEED_CACHE_NAMESPACE,
    SPOTS_CACHE_NAMESPACE,
    invalidate_cache_namespaces,
)
from common.kafka_producer import ScopeKafkaProducer
from common.permissions import IsAuthenticatedJWT
from common.responses import data_response
from photos.models import Photo
from photos.serializers import PhotoSerializer, PhotoUploadSerializer
from photos.services.s3_service import S3StorageService
from spots.models import Spot

producer = ScopeKafkaProducer()


def _async_thumbnails_enabled() -> bool:
    """Async thumbnail generation requires both the env opt-in AND an
    operational Kafka topic to receive the work item. If Kafka is disabled
    (e.g. local dev without a broker) we silently fall back to the legacy
    inline path so callers don't get photos stuck at thumbnail_url=''."""
    flag = os.getenv('PHOTO_UPLOAD_ASYNC_THUMBNAILS', 'false').lower() == 'true'
    return flag and bool(getattr(settings, 'KAFKA_ENABLED', False))


@api_view(['POST'])
@permission_classes([IsAuthenticatedJWT])
def upload_photo(request):
    serializer = PhotoUploadSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    # Enforce that the caller owns the target spot (or the spot is public) so
    # we don't let anyone drop photos onto someone else's private spot.
    spot_id = serializer.validated_data['spot_id']
    spot = get_object_or_404(Spot, pk=spot_id)
    user_id = request.user.id
    is_admin = bool(getattr(request.user, 'is_admin', False))
    owns_spot = str(spot.user_id) == str(user_id)
    if not owns_spot and not is_admin:
        if getattr(spot, 'is_public', False):
            # Public spots still require contribution privileges; reject by default
            # and let a future "contributor" role expand this if/when needed.
            raise PermissionDenied
        # Private spot: hide existence entirely.
        raise Http404

    service = S3StorageService()
    caption = serializer.validated_data.get('caption', '')
    sort_order = serializer.validated_data.get('sort_order', 0)

    if _async_thumbnails_enabled():
        # Fast path: upload original only, hand off thumbnail work to the
        # `scope_thumbnail_worker` consumer. Response returns in a fraction of
        # the time the sync path needs because we skip Pillow + a second S3
        # round-trip in the critical section.
        stored = service.store_original(serializer.validated_data['file'])
        photo = Photo.objects.create(
            spot_id=spot_id,
            user_id=user_id,
            storage_key=stored['storage_key'],
            storage_url=stored['storage_url'],
            thumbnail_url='',
            caption=caption,
            sort_order=sort_order,
        )
        invalidate_cache_namespaces(SPOTS_CACHE_NAMESPACE, FEED_CACHE_NAMESPACE)
        producer.publish(
            'photo.thumbnail.requested',
            {
                'photoId': str(photo.id),
                'storageKey': photo.storage_key,
                'spotId': str(photo.spot_id),
                'userId': str(request.user.id),
            },
        )
        producer.publish(
            'photo.uploaded',
            {
                'photoId': str(photo.id),
                'spotId': str(photo.spot_id),
                'userId': str(request.user.id),
                'storageUrl': photo.storage_url,
                'thumbnailUrl': photo.thumbnail_url,
            },
        )
        return data_response(PhotoSerializer(photo).data, status_code=status.HTTP_201_CREATED)

    # Legacy sync path. Kept as default so existing deployments don't require
    # a worker service to be healthy before photos can be uploaded.
    stored = service.store(serializer.validated_data['file'])
    photo = Photo.objects.create(
        spot_id=spot_id,
        user_id=user_id,
        storage_key=stored['storage_key'],
        storage_url=stored['storage_url'],
        thumbnail_url=stored['thumbnail_url'],
        caption=caption,
        sort_order=sort_order,
    )
    invalidate_cache_namespaces(SPOTS_CACHE_NAMESPACE, FEED_CACHE_NAMESPACE)
    producer.publish(
        'photo.uploaded',
        {
            'photoId': str(photo.id),
            'spotId': str(photo.spot_id),
            'userId': str(request.user.id),
            'storageUrl': photo.storage_url,
            'thumbnailUrl': photo.thumbnail_url,
        },
    )
    return data_response(PhotoSerializer(photo).data, status_code=status.HTTP_201_CREATED)


@api_view(['GET'])
@permission_classes([IsAuthenticatedJWT])
def presigned_url(request):
    key = f'uploads/{request.user.id}'
    url = S3StorageService().presigned_upload_url(key)
    return data_response({'url': url, 'key': key, 'enabled': bool(url)})


@api_view(['PUT', 'DELETE'])
@permission_classes([IsAuthenticatedJWT])
def photo_detail(request, pk):
    photo = get_object_or_404(Photo, pk=pk)
    if str(photo.user_id) != str(request.user.id) and not getattr(request.user, 'is_admin', False):
        raise PermissionDenied
    if request.method == 'DELETE':
        photo.delete()
        invalidate_cache_namespaces(SPOTS_CACHE_NAMESPACE, FEED_CACHE_NAMESPACE)
        return data_response({'deleted': True})
    serializer = PhotoSerializer(photo, data=request.data, partial=True)
    serializer.is_valid(raise_exception=True)
    serializer.save()
    invalidate_cache_namespaces(SPOTS_CACHE_NAMESPACE, FEED_CACHE_NAMESPACE)
    return data_response(serializer.data)
