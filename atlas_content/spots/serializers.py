from math import asin, cos, radians, sin, sqrt
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
