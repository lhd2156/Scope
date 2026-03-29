from django.conf import settings
from rest_framework import serializers

from common.serializers import AliasModelSerializer, AliasSerializer
from photos.models import Photo
from spots.models import Spot


class PhotoUploadSerializer(AliasSerializer):
    spotId = serializers.UUIDField(source='spot_id')
    file = serializers.ImageField()
    caption = serializers.CharField(required=False, allow_blank=True, max_length=500)
    sortOrder = serializers.IntegerField(source='sort_order', required=False, default=0)

    input_aliases = {
        'spot_id': 'spotId',
        'sort_order': 'sortOrder',
    }

    def validate_file(self, value):
        if value.size > settings.MAX_UPLOAD_BYTES:
            raise serializers.ValidationError('File too large')
        if value.content_type not in settings.ALLOWED_IMAGE_TYPES:
            raise serializers.ValidationError('Unsupported file type')
        return value

    def validate_spotId(self, value):
        if not Spot.objects.filter(id=value).exists():
            raise serializers.ValidationError('Spot does not exist')
        return value


class PhotoSerializer(AliasModelSerializer):
    spotId = serializers.UUIDField(source='spot_id', read_only=True)
    userId = serializers.UUIDField(source='user_id', read_only=True)
    s3Key = serializers.CharField(source='storage_key', read_only=True)
    s3Url = serializers.CharField(source='storage_url', read_only=True)
    thumbnailUrl = serializers.CharField(source='thumbnail_url', read_only=True)
    sortOrder = serializers.IntegerField(source='sort_order', required=False)
    createdAt = serializers.DateTimeField(source='created_at', read_only=True)

    input_aliases = {
        'spot_id': 'spotId',
        'user_id': 'userId',
        'storage_key': 's3Key',
        'storage_url': 's3Url',
        'thumbnail_url': 'thumbnailUrl',
        'sort_order': 'sortOrder',
        'created_at': 'createdAt',
    }

    class Meta:
        model = Photo
        fields = ['id', 'spotId', 'userId', 's3Key', 's3Url', 'thumbnailUrl', 'caption', 'sortOrder', 'createdAt']
        read_only_fields = ['id', 'spotId', 'userId', 's3Key', 's3Url', 'thumbnailUrl', 'createdAt']
