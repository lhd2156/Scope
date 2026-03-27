from rest_framework import serializers
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
