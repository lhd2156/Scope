from bootstrap_content import w

w('spots/__init__.py', '')
w('spots/apps.py', "from django.apps import AppConfig\n\nclass SpotsConfig(AppConfig):\n    default_auto_field = 'django.db.models.BigAutoField'\n    name = 'spots'\n")
w('spots/models.py', '''import uuid
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
class Spot(models.Model):
    CATEGORY_CHOICES = [('food','food'),('nature','nature'),('nightlife','nightlife'),('culture','culture'),('adventure','adventure'),('shopping','shopping'),('scenic','scenic'),('other','other')]
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user_id = models.UUIDField(db_index=True)
    title = models.CharField(max_length=200)
    description = models.TextField(max_length=2000, blank=True)
    latitude = models.FloatField()
    longitude = models.FloatField()
    address = models.CharField(max_length=500, blank=True)
    city = models.CharField(max_length=100, blank=True)
    country = models.CharField(max_length=100, blank=True)
    category = models.CharField(max_length=50, choices=CATEGORY_CHOICES)
    vibe = models.CharField(max_length=50, blank=True)
    rating = models.DecimalField(max_digits=2, decimal_places=1, validators=[MinValueValidator(1.0), MaxValueValidator(5.0)], null=True, blank=True)
    visited_at = models.DateField(null=True, blank=True)
    is_public = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    class Meta:
        ordering = ['-created_at']
        indexes = [models.Index(fields=['latitude', 'longitude']), models.Index(fields=['category'])]
''')
w('spots/serializers.py', '''from math import asin, cos, radians, sin, sqrt
from rest_framework import serializers
from spots.models import Spot
class SpotSerializer(serializers.ModelSerializer):
    photo_url = serializers.SerializerMethodField()
    likes_count = serializers.IntegerField(read_only=True)
    average_rating = serializers.DecimalField(max_digits=3, decimal_places=2, read_only=True)
    class Meta:
        model = Spot
        fields = ['id','user_id','title','description','latitude','longitude','address','city','country','category','vibe','rating','visited_at','is_public','created_at','updated_at','photo_url','likes_count','average_rating']
        read_only_fields = ['id','user_id','created_at','updated_at','photo_url','likes_count','average_rating']
    def validate_latitude(self, value):
        if not -90 <= value <= 90:
            raise serializers.ValidationError('Latitude out of range')
        return value
    def validate_longitude(self, value):
        if not -180 <= value <= 180:
            raise serializers.ValidationError('Longitude out of range')
        return value
    def get_photo_url(self, obj):
        first = obj.photos.order_by('sort_order','created_at').first()
        return first.storage_url if first else None
class SpotDetailSerializer(SpotSerializer):
    photos = serializers.SerializerMethodField()
    reviews = serializers.SerializerMethodField()
    class Meta(SpotSerializer.Meta):
        fields = SpotSerializer.Meta.fields + ['photos','reviews']
    def get_photos(self, obj):
        return [{'id': str(photo.id), 'storageUrl': photo.storage_url, 'caption': photo.caption} for photo in obj.photos.order_by('sort_order','created_at')]
    def get_reviews(self, obj):
        return [{'id': str(review.id), 'rating': str(review.rating), 'comment': review.comment, 'userId': str(review.user_id)} for review in obj.reviews.order_by('-created_at')[:5]]
class NearbyQuerySerializer(serializers.Serializer):
    lat = serializers.FloatField()
    lng = serializers.FloatField()
    radius = serializers.FloatField(default=10)
    def filter_queryset(self, queryset):
        lat = self.validated_data['lat']; lng = self.validated_data['lng']; radius = self.validated_data['radius']
        ids = []
        for spot in queryset:
            distance = 6371 * 2 * asin(sqrt(sin(radians(spot.latitude-lat)/2)**2 + cos(radians(lat))*cos(radians(spot.latitude))*sin(radians(spot.longitude-lng)/2)**2))
            if distance <= radius:
                ids.append(spot.id)
        return queryset.filter(id__in=ids)
''')
w('trips/__init__.py', '')
w('trips/apps.py', "from django.apps import AppConfig\n\nclass TripsConfig(AppConfig):\n    default_auto_field = 'django.db.models.BigAutoField'\n    name = 'trips'\n")
w('trips/models.py', '''import uuid
from django.db import models
from spots.models import Spot
class Trip(models.Model):
    STATUS_CHOICES = [('planning','planning'),('active','active'),('completed','completed'),('cancelled','cancelled')]
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    creator_id = models.UUIDField()
    title = models.CharField(max_length=200)
    description = models.TextField(max_length=2000, blank=True)
    start_date = models.DateField(null=True, blank=True)
    end_date = models.DateField(null=True, blank=True)
    budget = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    currency = models.CharField(max_length=3, default='USD')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='planning')
    is_public = models.BooleanField(default=True)
    cover_photo_url = models.URLField(max_length=1000, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    class Meta:
        ordering = ['-created_at']
class TripSpot(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    trip = models.ForeignKey(Trip, related_name='trip_spots', on_delete=models.CASCADE)
    spot = models.ForeignKey(Spot, related_name='trip_references', on_delete=models.CASCADE)
    day_number = models.IntegerField(null=True, blank=True)
    sort_order = models.IntegerField(default=0)
    notes = models.CharField(max_length=500, blank=True)
    class Meta:
        ordering = ['day_number', 'sort_order', 'id']
        unique_together = ('trip', 'spot')
class TripMember(models.Model):
    ROLE_CHOICES = [('owner','owner'),('editor','editor'),('viewer','viewer')]
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    trip = models.ForeignKey(Trip, related_name='members', on_delete=models.CASCADE)
    user_id = models.UUIDField()
    role = models.CharField(max_length=20, choices=ROLE_CHOICES)
    joined_at = models.DateTimeField(auto_now_add=True)
    class Meta:
        unique_together = ('trip', 'user_id')
class Like(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    spot = models.ForeignKey(Spot, related_name='likes', on_delete=models.CASCADE)
    user_id = models.UUIDField()
    created_at = models.DateTimeField(auto_now_add=True)
    class Meta:
        unique_together = ('spot', 'user_id')
''')
w('photos/__init__.py', '')
w('photos/apps.py', "from django.apps import AppConfig\n\nclass PhotosConfig(AppConfig):\n    default_auto_field = 'django.db.models.BigAutoField'\n    name = 'photos'\n")
w('photos/models.py', '''import uuid
from django.db import models
from spots.models import Spot
class Photo(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    spot = models.ForeignKey(Spot, related_name='photos', on_delete=models.CASCADE)
    user_id = models.UUIDField()
    storage_key = models.CharField(max_length=500)
    storage_url = models.URLField(max_length=1000)
    thumbnail_url = models.URLField(max_length=1000, blank=True)
    caption = models.CharField(max_length=500, blank=True)
    sort_order = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    class Meta:
        ordering = ['sort_order', 'created_at']
''')
w('reviews/__init__.py', '')
w('reviews/apps.py', "from django.apps import AppConfig\n\nclass ReviewsConfig(AppConfig):\n    default_auto_field = 'django.db.models.BigAutoField'\n    name = 'reviews'\n")
w('reviews/models.py', '''import uuid
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
from spots.models import Spot
class Review(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    spot = models.ForeignKey(Spot, related_name='reviews', on_delete=models.CASCADE)
    user_id = models.UUIDField()
    rating = models.DecimalField(max_digits=2, decimal_places=1, validators=[MinValueValidator(1.0), MaxValueValidator(5.0)])
    comment = models.CharField(max_length=1000, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    class Meta:
        ordering = ['-created_at']
        unique_together = ('spot', 'user_id')
''')
w('feed/__init__.py', '')
w('feed/apps.py', "from django.apps import AppConfig\n\nclass FeedConfig(AppConfig):\n    default_auto_field = 'django.db.models.BigAutoField'\n    name = 'feed'\n")
