from __future__ import annotations

from decimal import Decimal
from uuid import UUID

from django.db.models import Q
from rest_framework import serializers

from common.serializer_utils import copy_with_aliases, normalize_text
from common.user_profiles import resolve_user_profile
from spots.models import Spot
from trips.models import Trip, TripMember, TripSpot


TRIP_CAMEL_TO_SNAKE = {
    'startDate': 'start_date',
    'endDate': 'end_date',
    'isPublic': 'is_public',
    'coverImageUrl': 'cover_photo_url',
}

TRIP_SPOT_CAMEL_TO_SNAKE = {
    'spotId': 'spot_id',
    'dayNumber': 'day_number',
    'sortOrder': 'sort_order',
}


class TripSpotSerializer(serializers.ModelSerializer):
    spot_title = serializers.CharField(source='spot.title', read_only=True)
    spotId = serializers.UUIDField(source='spot_id', read_only=True)
    title = serializers.CharField(source='spot.title', read_only=True)
    latitude = serializers.FloatField(source='spot.latitude', read_only=True)
    longitude = serializers.FloatField(source='spot.longitude', read_only=True)
    category = serializers.CharField(source='spot.category', read_only=True)
    city = serializers.CharField(source='spot.city', read_only=True)

    class Meta:
        model = TripSpot
        fields = [
            'id',
            'spot',
            'spot_title',
            'spotId',
            'title',
            'latitude',
            'longitude',
            'category',
            'city',
            'day_number',
            'sort_order',
            'notes',
            'source',
        ]


class TripMemberSerializer(serializers.ModelSerializer):
    userId = serializers.UUIDField(source='user_id', read_only=True)
    status = serializers.CharField(source='role', read_only=True)
    displayName = serializers.SerializerMethodField()
    avatarUrl = serializers.SerializerMethodField()
    inviteStatus = serializers.SerializerMethodField()

    class Meta:
        model = TripMember
        fields = ['id', 'user_id', 'userId', 'role', 'status', 'displayName', 'avatarUrl', 'inviteStatus', 'joined_at']
        read_only_fields = ['id', 'joined_at']

    def get_displayName(self, obj: TripMember) -> str:
        return resolve_user_profile(obj.user_id, request=self.context.get('request'))['displayName']

    def get_avatarUrl(self, obj: TripMember) -> str:
        return resolve_user_profile(obj.user_id, request=self.context.get('request')).get('avatarUrl', '')

    def get_inviteStatus(self, obj: TripMember) -> str:
        return 'accepted'


class TripSerializer(serializers.ModelSerializer):
    spots = TripSpotSerializer(source='trip_spots', many=True, read_only=True)
    members = TripMemberSerializer(many=True, read_only=True)

    class Meta:
        model = Trip
        fields = [
            'id',
            'creator_id',
            'title',
            'destination',
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

    def to_internal_value(self, data):
        if hasattr(data, 'copy'):
            normalized_data = copy_with_aliases(data, TRIP_CAMEL_TO_SNAKE)
            self.nested_spots_payload = normalized_data.pop('spots', None)
            self.nested_members_payload = normalized_data.pop('members', None)
            data = normalized_data
        return super().to_internal_value(data)

    def validate_title(self, value: str) -> str:
        normalized = normalize_text(value)
        if not normalized:
            raise serializers.ValidationError('Title cannot be blank')
        return normalized

    def validate_destination(self, value: str) -> str:
        return normalize_text(value)

    def validate_description(self, value: str) -> str:
        return normalize_text(value)

    def validate_budget(self, value: Decimal | None) -> Decimal | None:
        if value is not None and value < Decimal('0'):
            raise serializers.ValidationError('Budget must be greater than or equal to zero')
        return value

    def validate_currency(self, value: str) -> str:
        normalized = normalize_text(value).upper()
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
    spot_id = serializers.CharField(required=False, allow_blank=True)
    day_number = serializers.IntegerField(required=False, allow_null=True, min_value=1)
    sort_order = serializers.IntegerField(required=False, default=0, min_value=0)
    notes = serializers.CharField(required=False, allow_blank=True, max_length=500)
    title = serializers.CharField(required=False, allow_blank=True, max_length=200)
    latitude = serializers.FloatField(required=False)
    longitude = serializers.FloatField(required=False)
    category = serializers.ChoiceField(required=False, choices=Spot.CATEGORY_CHOICES, default='other')
    city = serializers.CharField(required=False, allow_blank=True, max_length=100)

    def to_internal_value(self, data):
        return super().to_internal_value(copy_with_aliases(data, TRIP_SPOT_CAMEL_TO_SNAKE))

    def validate(self, attrs):
        spot_id = str(attrs.get('spot_id') or '').strip()
        if spot_id:
            try:
                parsed_spot_id = UUID(spot_id)
            except ValueError:
                pass
            else:
                spot_queryset = Spot.objects.filter(id=parsed_spot_id)
                user = self.context.get('user')
                if user is not None and not getattr(user, 'is_admin', False):
                    spot_queryset = spot_queryset.filter(Q(is_public=True) | Q(user_id=getattr(user, 'id', None)))
                if spot_queryset.exists():
                    return attrs

        if attrs.get('title') and attrs.get('latitude') is not None and attrs.get('longitude') is not None:
            return attrs

        raise serializers.ValidationError({'spot_id': 'Spot does not exist'})

    def validate_notes(self, value: str) -> str:
        return normalize_text(value)


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

    def validate_role(self, value: str) -> str:
        if value == 'owner':
            raise serializers.ValidationError('Owner access cannot be assigned here')
        return value
