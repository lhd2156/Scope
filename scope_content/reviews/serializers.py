from __future__ import annotations

from decimal import Decimal

from rest_framework import serializers

from common.serializer_utils import copy_with_aliases
from common.user_profiles import anonymous_user_profile, resolve_user_profile
from reviews.models import Review

REVIEW_INPUT_ALIASES = {
    'is_anonymous': 'isAnonymous',
}


class ReviewSerializer(serializers.ModelSerializer):
    user_id = serializers.SerializerMethodField()
    user = serializers.SerializerMethodField()
    rating = serializers.DecimalField(max_digits=2, decimal_places=1, min_value=Decimal('1.0'), max_value=Decimal('5.0'))
    isAnonymous = serializers.BooleanField(source='is_anonymous', required=False, default=False)

    class Meta:
        model = Review
        fields = ['id', 'spot', 'user_id', 'user', 'rating', 'comment', 'isAnonymous', 'created_at']
        read_only_fields = ['id', 'user_id', 'created_at', 'spot']

    def to_internal_value(self, data):
        return super().to_internal_value(copy_with_aliases(data, REVIEW_INPUT_ALIASES))

    def get_user_id(self, obj) -> str:
        return 'anonymous' if getattr(obj, 'is_anonymous', False) else str(obj.user_id)

    def get_user(self, obj) -> dict | None:
        if getattr(obj, 'is_anonymous', False):
            return anonymous_user_profile()
        return resolve_user_profile(obj.user_id, request=self.context.get('request'))

    def validate_rating(self, value):
        if not Decimal('1.0') <= value <= Decimal('5.0'):
            raise serializers.ValidationError('Rating must be between 1.0 and 5.0')
        return value

    def validate_comment(self, value: str) -> str:
        return value.strip()
