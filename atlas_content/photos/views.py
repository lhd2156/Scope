from __future__ import annotations

from django.shortcuts import get_object_or_404
from rest_framework.decorators import api_view, permission_classes
from rest_framework.exceptions import PermissionDenied

from common.cache_utils import FEED_CACHE_NAMESPACE, SPOTS_CACHE_NAMESPACE, invalidate_cache_namespaces
from common.permissions import IsAuthenticatedJWT
from common.responses import data_response
from photos.models import Photo
from photos.serializers import PhotoSerializer, PhotoUploadSerializer
from photos.services.s3_service import S3StorageService


@api_view(['POST'])
@permission_classes([IsAuthenticatedJWT])
def upload_photo(request):
    serializer = PhotoUploadSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    stored = S3StorageService().store(serializer.validated_data['file'])
    photo = Photo.objects.create(
        spot_id=serializer.validated_data['spot_id'],
        user_id=request.user.id,
        storage_key=stored['storage_key'],
        storage_url=stored['storage_url'],
        thumbnail_url=stored['thumbnail_url'],
        caption=serializer.validated_data.get('caption', ''),
        sort_order=serializer.validated_data.get('sort_order', 0),
    )
    invalidate_cache_namespaces(SPOTS_CACHE_NAMESPACE, FEED_CACHE_NAMESPACE)
    return data_response(PhotoSerializer(photo).data, status_code=201)


@api_view(['GET'])
@permission_classes([IsAuthenticatedJWT])
def presigned_upload(request):
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
