from __future__ import annotations

from decimal import Decimal

from rest_framework import serializers

from reviews.models import Review


class ReviewSerializer(serializers.ModelSerializer):
    rating = serializers.DecimalField(max_digits=2, decimal_places=1, min_value=Decimal('1.0'), max_value=Decimal('5.0'))

    class Meta:
        model = Review
        fields = ['id', 'spot', 'user_id', 'rating', 'comment', 'created_at']
        read_only_fields = ['id', 'user_id', 'created_at', 'spot']

    def validate_rating(self, value):
        if not Decimal('1.0') <= value <= Decimal('5.0'):
            raise serializers.ValidationError('Rating must be between 1.0 and 5.0')
        return value

    def validate_comment(self, value: str) -> str:
        return value.strip()
