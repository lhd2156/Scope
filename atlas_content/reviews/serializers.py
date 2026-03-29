from decimal import Decimal

from rest_framework import serializers

from common.serializers import AliasModelSerializer
from reviews.models import Review


class ReviewSerializer(AliasModelSerializer):
    spotId = serializers.UUIDField(source='spot_id', read_only=True)
    userId = serializers.UUIDField(source='user_id', read_only=True)
    rating = serializers.DecimalField(
        max_digits=2,
        decimal_places=1,
        min_value=Decimal('1.0'),
        max_value=Decimal('5.0'),
    )
    createdAt = serializers.DateTimeField(source='created_at', read_only=True)

    input_aliases = {
        'spot_id': 'spotId',
        'user_id': 'userId',
        'created_at': 'createdAt',
    }

    class Meta:
        model = Review
        fields = ['id', 'spotId', 'userId', 'rating', 'comment', 'createdAt']
        read_only_fields = ['id', 'spotId', 'userId', 'createdAt']

    def validate_rating(self, value):
        if not 1 <= value <= 5:
            raise serializers.ValidationError('Out of range')
        return value
