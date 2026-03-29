from __future__ import annotations

from django.shortcuts import get_object_or_404
from rest_framework import permissions
from rest_framework.decorators import api_view, permission_classes
from rest_framework.exceptions import PermissionDenied

from common.cache_utils import FEED_CACHE_NAMESPACE, SPOTS_CACHE_NAMESPACE, invalidate_cache_namespaces
from common.kafka_producer import AtlasKafkaProducer
from common.permissions import IsAuthenticatedJWT
from common.responses import data_response
from reviews.models import Review
from reviews.serializers import ReviewSerializer
from spots.models import Spot

producer = AtlasKafkaProducer()


@api_view(['POST', 'GET'])
@permission_classes([permissions.IsAuthenticatedOrReadOnly])
def spot_reviews(request, spot_id):
    spot = get_object_or_404(Spot, pk=spot_id)
    if request.method == 'GET':
        return data_response(ReviewSerializer(Review.objects.filter(spot=spot), many=True).data)
    instance = Review.objects.filter(spot=spot, user_id=request.user.id).first()
    serializer = ReviewSerializer(instance, data=request.data, partial=bool(instance))
    serializer.is_valid(raise_exception=True)
    review = serializer.save(spot=spot, user_id=request.user.id)
    invalidate_cache_namespaces(SPOTS_CACHE_NAMESPACE, FEED_CACHE_NAMESPACE)
    producer.publish('review.created', {'reviewId': str(review.id), 'spotId': str(spot.id), 'userId': str(request.user.id)})
    return data_response(ReviewSerializer(review).data, status_code=201 if instance is None else 200)


@api_view(['PUT', 'DELETE'])
@permission_classes([IsAuthenticatedJWT])
def review_detail(request, pk):
    review = get_object_or_404(Review, pk=pk)
    if str(review.user_id) != str(request.user.id) and not getattr(request.user, 'is_admin', False):
        raise PermissionDenied
    if request.method == 'DELETE':
        review.delete()
        invalidate_cache_namespaces(SPOTS_CACHE_NAMESPACE, FEED_CACHE_NAMESPACE)
        return data_response({'deleted': True})
    serializer = ReviewSerializer(review, data=request.data, partial=True)
    serializer.is_valid(raise_exception=True)
    serializer.save()
    invalidate_cache_namespaces(SPOTS_CACHE_NAMESPACE, FEED_CACHE_NAMESPACE)
    return data_response(serializer.data)
