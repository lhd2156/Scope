from rest_framework import serializers

from common.serializers import AliasModelSerializer, AliasSerializer
from spots.models import Spot
from trips.models import Trip, TripMember, TripSpot


class TripSpotSerializer(AliasModelSerializer):
    spotId = serializers.UUIDField(source='spot_id')
    spotTitle = serializers.CharField(source='spot.title', read_only=True)
    dayNumber = serializers.IntegerField(source='day_number', allow_null=True, required=False)
    sortOrder = serializers.IntegerField(source='sort_order', required=False)

    input_aliases = {
        'spot_id': 'spotId',
        'spot_title': 'spotTitle',
        'day_number': 'dayNumber',
        'sort_order': 'sortOrder',
    }

    class Meta:
        model = TripSpot
        fields = ['id', 'spotId', 'spotTitle', 'dayNumber', 'sortOrder', 'notes']
        read_only_fields = ['id', 'spotTitle']


class TripMemberSerializer(AliasModelSerializer):
    userId = serializers.UUIDField(source='user_id')
    joinedAt = serializers.DateTimeField(source='joined_at', read_only=True)

    input_aliases = {
        'user_id': 'userId',
        'joined_at': 'joinedAt',
    }

    class Meta:
        model = TripMember
        fields = ['id', 'userId', 'role', 'joinedAt']
        read_only_fields = ['id', 'joinedAt']


class TripSerializer(AliasModelSerializer):
    creatorId = serializers.UUIDField(source='creator_id', read_only=True)
    startDate = serializers.DateField(source='start_date', allow_null=True, required=False)
    endDate = serializers.DateField(source='end_date', allow_null=True, required=False)
    isPublic = serializers.BooleanField(source='is_public', required=False)
    coverPhotoUrl = serializers.CharField(source='cover_photo_url', required=False, allow_blank=True)
    createdAt = serializers.DateTimeField(source='created_at', read_only=True)
    spots = TripSpotSerializer(source='trip_spots', many=True, read_only=True)
    members = TripMemberSerializer(many=True, read_only=True)

    input_aliases = {
        'creator_id': 'creatorId',
        'start_date': 'startDate',
        'end_date': 'endDate',
        'is_public': 'isPublic',
        'cover_photo_url': 'coverPhotoUrl',
        'created_at': 'createdAt',
    }

    class Meta:
        model = Trip
        fields = [
            'id',
            'creatorId',
            'title',
            'description',
            'startDate',
            'endDate',
            'budget',
            'currency',
            'status',
            'isPublic',
            'coverPhotoUrl',
            'createdAt',
            'spots',
            'members',
        ]
        read_only_fields = ['id', 'creatorId', 'createdAt', 'spots', 'members']

    def validate(self, attrs):
        start = attrs.get('start_date', getattr(self.instance, 'start_date', None))
        end = attrs.get('end_date', getattr(self.instance, 'end_date', None))
        if start and end and end < start:
            raise serializers.ValidationError({'endDate': 'End date must be on or after start date'})
        return attrs


class TripAddSpotSerializer(AliasSerializer):
    spotId = serializers.UUIDField(source='spot_id')
    dayNumber = serializers.IntegerField(source='day_number', required=False, allow_null=True)
    sortOrder = serializers.IntegerField(source='sort_order', required=False, default=0)
    notes = serializers.CharField(required=False, allow_blank=True, max_length=500)

    input_aliases = {
        'spot_id': 'spotId',
        'day_number': 'dayNumber',
        'sort_order': 'sortOrder',
    }

    def validate_spotId(self, value):
        if not Spot.objects.filter(id=value).exists():
            raise serializers.ValidationError('Spot does not exist')
        return value


class TripReorderItemSerializer(AliasSerializer):
    spotId = serializers.UUIDField()
    dayNumber = serializers.IntegerField(required=False, allow_null=True)
    sortOrder = serializers.IntegerField(required=False)


class TripReorderSerializer(AliasSerializer):
    spots = TripReorderItemSerializer(many=True, allow_empty=False)


class TripMemberCreateSerializer(AliasModelSerializer):
    userId = serializers.UUIDField(source='user_id')

    input_aliases = {
        'user_id': 'userId',
    }

    class Meta:
        model = TripMember
        fields = ['userId', 'role']
