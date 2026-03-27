from rest_framework import serializers
from reviews.models import Review
class ReviewSerializer(serializers.ModelSerializer):
    class Meta:
        model = Review
        fields = ['id','spot','user_id','rating','comment','created_at']
        read_only_fields = ['id','user_id','created_at','spot']
    def validate_rating(self, value):
        if not 1 <= value <= 5:
            raise serializers.ValidationError('Out of range')
        return value
