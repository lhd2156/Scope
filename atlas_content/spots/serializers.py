from __future__ import annotations

from decimal import Decimal
from math import asin, cos, radians, sin, sqrt

from rest_framework import serializers

from spots.models import Spot


def _ordered_prefetched_related(obj, relation_name: str, ordering: tuple[str, ...]):
    prefetched = getattr(obj, '_prefetched_objects_cache', {}).get(relation_name)
    if prefetched is not None:
        return list(prefetched)
    return list(getattr(obj, relation_name).order_by(*ordering))


class SpotSerializer(serializers.ModelSerializer):
    photo_url = serializers.SerializerMethodField()
    likes_count = serializers.IntegerField(read_only=True)
    average_rating = serializers.DecimalField(max_digits=3, decimal_places=2, read_only=True)
    rating = serializers.DecimalField(
        max_digits=2,
        decimal_places=1,
        required=False,
        allow_null=True,
        min_value=Decimal('1.0'),
        max_value=Decimal('5.0'),
    )

    class Meta:
        model = Spot
        fields = [
            'id',
            'user_id',
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
            'visited_at',
            'is_public',
            'created_at',
            'updated_at',
            'photo_url',
            'likes_count',
            'average_rating',
        ]
        read_only_fields = ['id', 'user_id', 'created_at', 'updated_at', 'photo_url', 'likes_count', 'average_rating']

    @staticmethod
    def _normalize_text(value: str) -> str:
        return value.strip()

    def validate_title(self, value: str) -> str:
        normalized = self._normalize_text(value)
        if not normalized:
            raise serializers.ValidationError('Title cannot be blank')
        return normalized

    def validate_description(self, value: str) -> str:
        return self._normalize_text(value)

    def validate_address(self, value: str) -> str:
        return self._normalize_text(value)

    def validate_city(self, value: str) -> str:
        return self._normalize_text(value)

    def validate_country(self, value: str) -> str:
        return self._normalize_text(value)

    def validate_vibe(self, value: str) -> str:
        return self._normalize_text(value)

    def validate_latitude(self, value: float) -> float:
        if not -90 <= value <= 90:
            raise serializers.ValidationError('Latitude out of range')
        return value

    def validate_longitude(self, value: float) -> float:
        if not -180 <= value <= 180:
            raise serializers.ValidationError('Longitude out of range')
        return value

    def validate_rating(self, value: Decimal | None) -> Decimal | None:
        if value is None:
            return value
        if not Decimal('1.0') <= value <= Decimal('5.0'):
            raise serializers.ValidationError('Rating must be between 1.0 and 5.0')
        return value

    def get_photo_url(self, obj):
        photos = _ordered_prefetched_related(obj, 'photos', ('sort_order', 'created_at'))
        first = photos[0] if photos else None
        return first.storage_url if first else None


class SpotDetailSerializer(SpotSerializer):
    photos = serializers.SerializerMethodField()
    reviews = serializers.SerializerMethodField()

    class Meta(SpotSerializer.Meta):
        fields = SpotSerializer.Meta.fields + ['photos', 'reviews']

    def get_photos(self, obj):
        photos = _ordered_prefetched_related(obj, 'photos', ('sort_order', 'created_at'))
        return [
            {'id': str(photo.id), 'storageUrl': photo.storage_url, 'caption': photo.caption}
            for photo in photos
        ]

    def get_reviews(self, obj):
        reviews = _ordered_prefetched_related(obj, 'reviews', ('-created_at',))
        return [
            {'id': str(review.id), 'rating': str(review.rating), 'comment': review.comment, 'userId': str(review.user_id)}
            for review in reviews[:5]
        ]


class NearbyQuerySerializer(serializers.Serializer):
    lat = serializers.FloatField()
    lng = serializers.FloatField()
    radius = serializers.FloatField(default=10)

    def validate_lat(self, value: float) -> float:
        if not -90 <= value <= 90:
            raise serializers.ValidationError('Latitude out of range')
        return value

    def validate_lng(self, value: float) -> float:
        if not -180 <= value <= 180:
            raise serializers.ValidationError('Longitude out of range')
        return value

    def validate_radius(self, value: float) -> float:
        if value <= 0:
            raise serializers.ValidationError('Radius must be greater than zero')
        return value

    def filter_queryset(self, queryset):
        lat = self.validated_data['lat']
        lng = self.validated_data['lng']
        radius = self.validated_data['radius']
        ids = []

        for spot in queryset:
            distance = 6371 * 2 * asin(
                sqrt(
                    sin(radians(spot.latitude - lat) / 2) ** 2
                    + cos(radians(lat)) * cos(radians(spot.latitude)) * sin(radians(spot.longitude - lng) / 2) ** 2
                )
            )
            if distance <= radius:
                ids.append(spot.id)

        return queryset.filter(id__in=ids)
