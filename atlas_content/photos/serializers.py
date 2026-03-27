from django.conf import settings
from rest_framework import serializers
from photos.models import Photo
from spots.models import Spot
class PhotoUploadSerializer(serializers.Serializer):
    spot_id = serializers.UUIDField()
    file = serializers.ImageField()
    caption = serializers.CharField(required=False, allow_blank=True, max_length=500)
    sort_order = serializers.IntegerField(required=False, default=0)
    def validate_file(self, value):
        if value.size > settings.MAX_UPLOAD_BYTES:
            raise serializers.ValidationError('File too large')
        if value.content_type not in settings.ALLOWED_IMAGE_TYPES:
            raise serializers.ValidationError('Unsupported file type')
        return value
    def validate_spot_id(self, value):
        if not Spot.objects.filter(id=value).exists():
            raise serializers.ValidationError('Spot does not exist')
        return value
class PhotoSerializer(serializers.ModelSerializer):
    class Meta:
        model = Photo
        fields = ['id','spot','user_id','storage_key','storage_url','thumbnail_url','caption','sort_order','created_at']
        read_only_fields = ['id','user_id','storage_key','storage_url','thumbnail_url','created_at']
