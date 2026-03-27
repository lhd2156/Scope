from bootstrap_content import w

w('trips/serializers.py', '''from rest_framework import serializers
from spots.models import Spot
from trips.models import Trip, TripMember, TripSpot
class TripSpotSerializer(serializers.ModelSerializer):
    spot_title = serializers.CharField(source='spot.title', read_only=True)
    class Meta:
        model = TripSpot
        fields = ['id','spot','spot_title','day_number','sort_order','notes']
class TripMemberSerializer(serializers.ModelSerializer):
    class Meta:
        model = TripMember
        fields = ['id','user_id','role','joined_at']
        read_only_fields = ['id','joined_at']
class TripSerializer(serializers.ModelSerializer):
    spots = TripSpotSerializer(source='trip_spots', many=True, read_only=True)
    members = TripMemberSerializer(many=True, read_only=True)
    class Meta:
        model = Trip
        fields = ['id','creator_id','title','description','start_date','end_date','budget','currency','status','is_public','cover_photo_url','created_at','spots','members']
        read_only_fields = ['id','creator_id','created_at','spots','members']
    def validate(self, attrs):
        start = attrs.get('start_date', getattr(self.instance, 'start_date', None))
        end = attrs.get('end_date', getattr(self.instance, 'end_date', None))
        if start and end and end < start:
            raise serializers.ValidationError({'end_date': 'End date must be on or after start date'})
        return attrs
class TripAddSpotSerializer(serializers.Serializer):
    spot_id = serializers.UUIDField()
    day_number = serializers.IntegerField(required=False, allow_null=True)
    sort_order = serializers.IntegerField(required=False, default=0)
    notes = serializers.CharField(required=False, allow_blank=True, max_length=500)
    def validate_spot_id(self, value):
        if not Spot.objects.filter(id=value).exists():
            raise serializers.ValidationError('Spot does not exist')
        return value
class TripReorderSerializer(serializers.Serializer):
    spots = serializers.ListField(child=serializers.DictField(), allow_empty=False)
class TripMemberCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = TripMember
        fields = ['user_id','role']
''')

w('photos/serializers.py', '''from django.conf import settings
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
''')

w('reviews/serializers.py', '''from rest_framework import serializers
from reviews.models import Review
class ReviewSerializer(serializers.ModelSerializer):
    class Meta:
        model = Review
        fields = ['id','spot','user_id','rating','comment','created_at']
        read_only_fields = ['id','user_id','created_at','spot']
    def validate_rating(self, value):
        if not 1 <= value <= 5:
            raise serializers.ValidationError('Out of range')
        return value
''')

w('photos/services/__init__.py', '')
w('photos/services/image_processor.py', '''from pathlib import Path
from PIL import Image
def generate_thumbnail(source_path: Path, dest_path: Path, size=(512, 512)) -> None:
    with Image.open(source_path) as image:
        image.thumbnail(size)
        image.save(dest_path)
''')
w('photos/services/s3_service.py', '''import uuid
from pathlib import Path
import boto3
from django.conf import settings
from photos.services.image_processor import generate_thumbnail
class S3StorageService:
    def __init__(self):
        self.enabled = bool(settings.AWS_STORAGE_BUCKET_NAME and settings.AWS_ACCESS_KEY_ID and settings.AWS_SECRET_ACCESS_KEY)
        self.client = None
        if self.enabled:
            self.client = boto3.client('s3', region_name=settings.AWS_REGION, aws_access_key_id=settings.AWS_ACCESS_KEY_ID, aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY)
    def store(self, uploaded_file, prefix='photos'):
        extension = Path(uploaded_file.name).suffix or '.jpg'
        key = f'{prefix}/{uuid.uuid4()}{extension}'
        if self.enabled and self.client:
            self.client.upload_fileobj(uploaded_file.file, settings.AWS_STORAGE_BUCKET_NAME, key, ExtraArgs={'ContentType': uploaded_file.content_type})
            url = f'https://{settings.AWS_STORAGE_BUCKET_NAME}.s3.{settings.AWS_REGION}.amazonaws.com/{key}'
            return {'storage_key': key, 'storage_url': url, 'thumbnail_url': url}
        media_dir = Path(settings.MEDIA_ROOT) / prefix
        media_dir.mkdir(parents=True, exist_ok=True)
        local_path = media_dir / f'{uuid.uuid4()}{extension}'
        thumb_path = media_dir / f'{local_path.stem}_thumb{extension}'
        with local_path.open('wb') as destination:
            for chunk in uploaded_file.chunks():
                destination.write(chunk)
        generate_thumbnail(local_path, thumb_path)
        relative = local_path.relative_to(settings.MEDIA_ROOT).as_posix()
        thumb_relative = thumb_path.relative_to(settings.MEDIA_ROOT).as_posix()
        return {'storage_key': relative, 'storage_url': f'{settings.MEDIA_URL}{relative}', 'thumbnail_url': f'{settings.MEDIA_URL}{thumb_relative}'}
    def presigned_upload_url(self, key: str):
        if not self.enabled or not self.client:
            return None
        return self.client.generate_presigned_url('put_object', Params={'Bucket': settings.AWS_STORAGE_BUCKET_NAME, 'Key': key}, ExpiresIn=3600)
    def health_status(self):
        return 's3' if self.enabled else 'local'
''')

w('feed/services/__init__.py', '')
w('feed/services/feed_aggregator.py', '''from django.db.models import Count
from spots.models import Spot
from trips.models import Trip
class FeedAggregator:
    def social_feed_queryset(self, user_id=None):
        return list(Spot.objects.filter(is_public=True).annotate(likes_count=Count('likes')).order_by('-created_at')[:50]) + list(Trip.objects.filter(is_public=True).order_by('-created_at')[:50])
    def trending_spots_queryset(self):
        return Spot.objects.filter(is_public=True).annotate(likes_count=Count('likes')).order_by('-likes_count', '-created_at')
''')
