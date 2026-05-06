from __future__ import annotations

from rest_framework import status
from rest_framework.decorators import api_view, permission_classes

from common.kafka_producer import ScopeKafkaProducer
from common.permissions import IsAuthenticatedJWT
from common.responses import data_response
from interactions.models import Interaction
from interactions.serializers import InteractionSerializer

producer = ScopeKafkaProducer()


@api_view(['POST'])
@permission_classes([IsAuthenticatedJWT])
def record_interaction(request):
    """Log a single interaction and fan it out via Kafka.

    The frontend calls this on view / click / dismiss / save / share events.
    Kept intentionally low-friction: no pagination, no filtering, just writes.
    All reads should go through the Intel service so we don't expose a
    per-user timeline from Content (which would be a PII leak surface).
    """
    serializer = InteractionSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    interaction = Interaction.objects.create(
        user_id=request.user.id,
        spot_id=serializer.validated_data['spot_id'],
        interaction_type=serializer.validated_data['interaction_type'],
        context=serializer.validated_data.get('context'),
    )
    producer.publish(
        'interaction.recorded',
        {
            'interactionId': str(interaction.id),
            'userId': str(interaction.user_id),
            'spotId': str(interaction.spot_id),
            'interactionType': interaction.interaction_type,
            'context': interaction.context,
            'occurredAt': interaction.occurred_at.isoformat().replace('+00:00', 'Z'),
        },
    )
    return data_response(InteractionSerializer(interaction).data, status_code=status.HTTP_201_CREATED)
