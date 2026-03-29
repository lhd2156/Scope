from decimal import Decimal
from math import asin, cos, radians, sin, sqrt

from rest_framework import serializers

from common.serializers import AliasModelSerializer, AliasSerializer
from spots.models import Spot


class SpotSerializer(AliasModelSerializer):
    userId = serializers.UUIDField(source='user_id', read_only=True)
    rating = serializers.DecimalField(
        max_digits=2,
        decimal_places=1,
        min_value=Decimal('1.0'),
        max_value=Decimal('5.0'),
        required=False,
        allow_null=True,
    )
    visitedAt = serializers.DateField(source='visited_at', allow_null=True, required=False)
    isPublic = serializers.BooleanField(source='is_public', required=False)
    createdAt = serializers.DateTimeField(source='created_at', read_only=True)
    updatedAt = serializers.DateTimeField(source='updated_at', read_only=True)
    photoUrl = serializers.SerializerMethodField()
    likesCount = serializers.IntegerField(source='likes_count', read_only=True)
    averageRating = serializers.DecimalField(
        source='average_rating',
        max_digits=3,
        decimal_places=2,
        allow_null=True,
        read_only=True,
    )

    input_aliases = {
        'user_id': 'userId',
        'visited_at': 'visitedAt',
        'is_public': 'isPublic',
    }

    class Meta:
        model = Spot
        fields = [
            'id',
            'userId',
            'title',
            'description',
            'latitude',
            'longitude',
            'address',
            'city',
            'country',
            'category',
            'vibe',
            'rating',
            'visitedAt',
            'isPublic',
            'createdAt',
            'updatedAt',
            'photoUrl',
            'likesCount',
            'averageRating',
        ]
        read_only_fields = [
            'id',
            'userId',
            'createdAt',
            'updatedAt',
            'photoUrl',
            'likesCount',
            'averageRating',
        ]

    def validate_latitude(self, value):
        if not -90 <= value <= 90:
            raise serializers.ValidationError('Latitude out of range')
        return value

    def validate_longitude(self, value):
        if not -180 <= value <= 180:
            raise serializers.ValidationError('Longitude out of range')
        return value

    def get_photoUrl(self, obj):
        first_photo = obj.photos.order_by('sort_order', 'created_at').first()
        if first_photo is None:
            return None
        return first_photo.thumbnail_url or first_photo.storage_url


class SpotDetailSerializer(SpotSerializer):
    photos = serializers.SerializerMethodField()
    reviews = serializers.SerializerMethodField()

    class Meta(SpotSerializer.Meta):
        fields = SpotSerializer.Meta.fields + ['photos', 'reviews']

    def get_photos(self, obj):
        return [
            {
                'id': str(photo.id),
                'spotId': str(photo.spot_id),
                'userId': str(photo.user_id),
                's3Key': photo.storage_key,
                's3Url': photo.storage_url,
                'thumbnailUrl': photo.thumbnail_url,
                'caption': photo.caption,
                'sortOrder': photo.sort_order,
                'createdAt': photo.created_at,
            }
            for photo in obj.photos.order_by('sort_order', 'created_at')
        ]

    def get_reviews(self, obj):
        return [
            {
                'id': str(review.id),
                'spotId': str(review.spot_id),
                'userId': str(review.user_id),
                'rating': review.rating,
                'comment': review.comment,
                'createdAt': review.created_at,
            }
            for review in obj.reviews.order_by('-created_at')[:5]
        ]


class NearbyQuerySerializer(AliasSerializer):
    lat = serializers.FloatField()
    lng = serializers.FloatField()
    radius = serializers.FloatField(default=10)

    def filter_queryset(self, queryset):
        lat = self.validated_data['lat']
        lng = self.validated_data['lng']
        radius = self.validated_data['radius']
        ids = []

        for spot in queryset:
            distance = 6371 * 2 * asin(
                sqrt(
                    sin(radians(spot.latitude - lat) / 2) ** 2
                    + cos(radians(lat))
                    * cos(radians(spot.latitude))
                    * sin(radians(spot.longitude - lng) / 2) ** 2
                )
            )
            if distance <= radius:
                ids.append(spot.id)

        return queryset.filter(id__in=ids)
