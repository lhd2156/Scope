from __future__ import annotations

from rest_framework import serializers

from interactions.models import Interaction

VALID_INTERACTION_TYPES = {choice for choice, _ in Interaction.INTERACTION_TYPES}


class InteractionSerializer(serializers.ModelSerializer):
    spotId = serializers.UUIDField(source='spot_id')
    interactionType = serializers.ChoiceField(
        source='interaction_type',
        choices=Interaction.INTERACTION_TYPES,
    )
    occurredAt = serializers.DateTimeField(source='occurred_at', read_only=True)

    class Meta:
        model = Interaction
        fields = ['id', 'spotId', 'interactionType', 'context', 'occurredAt']
        read_only_fields = ['id', 'occurredAt']

    def validate_context(self, value):
        if value is None:
            return value
        if not isinstance(value, dict):
            raise serializers.ValidationError('context must be a JSON object')
        # Keep the payload small. Frontend telemetry can't be trusted to bound
        # itself, and we don't want a single bad call to bloat the row.
        if len(value) > 16:
            raise serializers.ValidationError('context has too many keys (max 16)')
        return value
