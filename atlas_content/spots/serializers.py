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

    def to_internal_value(self, data):
        if hasattr(data, 'copy'):
            normalized_data = data.copy()
            if 'visitedAt' in normalized_data and 'visited_at' not in normalized_data:
                normalized_data['visited_at'] = normalized_data['visitedAt']
            if 'isPublic' in normalized_data and 'is_public' not in normalized_data:
                normalized_data['is_public'] = normalized_data['isPublic']
            data = normalized_data
        return super().to_internal_value(data)

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


class AppendixBSpotCreateResponseSerializer(serializers.ModelSerializer):
    createdAt = serializers.DateTimeField(source='created_at', read_only=True)
    rating = serializers.SerializerMethodField()

    class Meta:
        model = Spot
        fields = ['id', 'title', 'latitude', 'longitude', 'category', 'rating', 'createdAt']

    @staticmethod
    def get_rating(obj) -> float | None:
        return float(obj.rating) if obj.rating is not None else None


class AppendixBSpotListItemSerializer(serializers.ModelSerializer):
    createdAt = serializers.DateTimeField(source='created_at', read_only=True)
    photoUrl = serializers.SerializerMethodField()
    rating = serializers.SerializerMethodField()

    class Meta:
        model = Spot
        fields = ['id', 'title', 'latitude', 'longitude', 'category', 'rating', 'photoUrl', 'createdAt']

    @staticmethod
    def get_rating(obj) -> float | None:
        return float(obj.rating) if obj.rating is not None else None

    @staticmethod
    def get_photoUrl(obj) -> str | None:
        photos = _ordered_prefetched_related(obj, 'photos', ('sort_order', 'created_at'))
        first = photos[0] if photos else None
        if first is None:
            return None
        return first.thumbnail_url or first.storage_url


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

        candidate_queryset = self._apply_bounding_box(queryset, lat, lng, radius)

        for spot in candidate_queryset.only('id', 'latitude', 'longitude'):
            distance = self._distance_km(lat, lng, spot.latitude, spot.longitude)
            if distance <= radius:
                ids.append(spot.id)

        if not ids:
            return queryset.none()

        return queryset.filter(id__in=ids)

    @staticmethod
    def _distance_km(lat_a: float, lng_a: float, lat_b: float, lng_b: float) -> float:
        return 6371 * 2 * asin(
            sqrt(
                sin(radians(lat_b - lat_a) / 2) ** 2
                + cos(radians(lat_a)) * cos(radians(lat_b)) * sin(radians(lng_b - lng_a) / 2) ** 2
            )
        )

    def _apply_bounding_box(self, queryset, lat: float, lng: float, radius: float):
        latitude_delta = self._latitude_delta(radius)
        bounded_queryset = queryset.filter(
            latitude__gte=max(-90, lat - latitude_delta),
            latitude__lte=min(90, lat + latitude_delta),
        )

        longitude_bounds = self._longitude_bounds(lat, lng, radius)
        if longitude_bounds is None:
            return bounded_queryset

        min_lng, max_lng = longitude_bounds
        if min_lng <= max_lng:
            return bounded_queryset.filter(longitude__gte=min_lng, longitude__lte=max_lng)

        return bounded_queryset.filter(longitude__gte=min_lng) | bounded_queryset.filter(longitude__lte=max_lng)

    @staticmethod
    def _latitude_delta(radius_km: float) -> float:
        return radius_km / 111.0

    @staticmethod
    def _longitude_bounds(lat: float, lng: float, radius_km: float) -> tuple[float, float] | None:
        cosine_latitude = cos(radians(lat))
        if abs(cosine_latitude) < 1e-12:
            return None

        longitude_delta = radius_km / (111.320 * cosine_latitude)
        if longitude_delta >= 180:
            return None

        min_lng = lng - longitude_delta
        max_lng = lng + longitude_delta

        if min_lng < -180:
            min_lng += 360
        if max_lng > 180:
            max_lng -= 360

        return min_lng, max_lng
