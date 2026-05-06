from __future__ import annotations

from decimal import Decimal

from rest_framework import serializers

from spots.models import Spot
from trips.models import Trip, TripMember, TripSpot


class TripSpotSerializer(serializers.ModelSerializer):
    spot_title = serializers.CharField(source='spot.title', read_only=True)

    class Meta:
        model = TripSpot
        fields = ['id', 'spot', 'spot_title', 'day_number', 'sort_order', 'notes']


class TripMemberSerializer(serializers.ModelSerializer):
    class Meta:
        model = TripMember
        fields = ['id', 'user_id', 'role', 'joined_at']
        read_only_fields = ['id', 'joined_at']


class TripSerializer(serializers.ModelSerializer):
    spots = TripSpotSerializer(source='trip_spots', many=True, read_only=True)
    members = TripMemberSerializer(many=True, read_only=True)

    class Meta:
        model = Trip
        fields = [
            'id',
            'creator_id',
            'title',
            'description',
            'start_date',
            'end_date',
            'budget',
            'currency',
            'status',
            'is_public',
            'cover_photo_url',
            'created_at',
            'spots',
            'members',
        ]
        read_only_fields = ['id', 'creator_id', 'created_at', 'spots', 'members']

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

    def validate_budget(self, value: Decimal | None) -> Decimal | None:
        if value is not None and value < Decimal('0'):
            raise serializers.ValidationError('Budget must be greater than or equal to zero')
        return value

    def validate_currency(self, value: str) -> str:
        normalized = value.strip().upper()
        if len(normalized) != 3 or not normalized.isalpha():
            raise serializers.ValidationError('Currency must be a 3-letter ISO code')
        return normalized

    def validate(self, attrs):
        start = attrs.get('start_date', getattr(self.instance, 'start_date', None))
        end = attrs.get('end_date', getattr(self.instance, 'end_date', None))
        if start and end and end < start:
            raise serializers.ValidationError({'end_date': 'End date must be on or after start date'})
        return attrs


class TripAddSpotSerializer(serializers.Serializer):
    spot_id = serializers.UUIDField()
    day_number = serializers.IntegerField(required=False, allow_null=True, min_value=1)
    sort_order = serializers.IntegerField(required=False, default=0, min_value=0)
    notes = serializers.CharField(required=False, allow_blank=True, max_length=500)

    def validate_spot_id(self, value):
        if not Spot.objects.filter(id=value).exists():
            raise serializers.ValidationError('Spot does not exist')
        return value

    def validate_notes(self, value: str) -> str:
        return value.strip()


class TripReorderSpotItemSerializer(serializers.Serializer):
    spotId = serializers.UUIDField()
    sortOrder = serializers.IntegerField(required=False, min_value=0)
    dayNumber = serializers.IntegerField(required=False, allow_null=True, min_value=1)


class TripReorderSerializer(serializers.Serializer):
    spots = TripReorderSpotItemSerializer(many=True, allow_empty=False)

    def validate_spots(self, value):
        seen_spot_ids = set()
        for item in value:
            spot_id = item['spotId']
            if spot_id in seen_spot_ids:
                raise serializers.ValidationError('Duplicate spotId entries are not allowed')
            seen_spot_ids.add(spot_id)
        return value


class TripMemberCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = TripMember
        fields = ['user_id', 'role']
