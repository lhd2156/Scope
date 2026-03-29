import uuid

from django.shortcuts import get_object_or_404
from rest_framework.decorators import api_view, permission_classes

from common.access import can_view_spot, is_admin
from common.kafka_producer import AtlasKafkaProducer
from common.permissions import IsAuthenticatedJWT
from common.responses import data_response
from photos.models import Photo
from photos.serializers import PhotoSerializer, PhotoUploadSerializer
from photos.services.s3_service import S3StorageService
from spots.models import Spot

producer = AtlasKafkaProducer()


@api_view(['POST'])
@permission_classes([IsAuthenticatedJWT])
def upload_photo(request):
    serializer = PhotoUploadSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    spot = get_object_or_404(Spot, id=serializer.validated_data['spot_id'])
    if not can_view_spot(request.user, spot):
        return data_response({'message': 'forbidden'}, status_code=403)

    upload = S3StorageService().store(serializer.validated_data['file'])
    photo = Photo.objects.create(
        spot=spot,
        user_id=request.user.id,
        caption=serializer.validated_data.get('caption', ''),
        sort_order=serializer.validated_data.get('sort_order', 0),
        **upload,
    )
    producer.publish('photo.uploaded', {'photoId': str(photo.id), 'spotId': str(spot.id), 'userId': str(request.user.id)})
    return data_response(PhotoSerializer(photo).data, status_code=201)


@api_view(['PUT', 'DELETE'])
@permission_classes([IsAuthenticatedJWT])
def photo_detail(request, pk):
    photo = get_object_or_404(Photo, pk=pk)
    if str(photo.user_id) != str(request.user.id) and not is_admin(request.user):
        return data_response({'message': 'forbidden'}, status_code=403)

    if request.method == 'DELETE':
        photo.delete()
        return data_response({'deleted': True, 'photoId': str(pk)})

    serializer = PhotoSerializer(photo, data=request.data, partial=True)
    serializer.is_valid(raise_exception=True)
    serializer.save()
    return data_response(serializer.data)


@api_view(['GET'])
@permission_classes([IsAuthenticatedJWT])
def presigned_url(request):
    key = f'photos/{uuid.uuid4()}.jpg'
    url = S3StorageService().presigned_upload_url(key)
    return data_response({'key': key, 'url': url, 'enabled': bool(url)})
