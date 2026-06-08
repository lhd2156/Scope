from __future__ import annotations

import uuid

from django.db import transaction
from django.db.models import Q

from comments.models import Comment, CommentMention
from common.cache_utils import FEED_CACHE_NAMESPACE, SPOTS_CACHE_NAMESPACE, invalidate_cache_namespaces
from common.indexing import delete_review, delete_spot, delete_trip
from interactions.models import Interaction
from photos.models import Photo
from photos.services.s3_service import S3StorageService
from reviews.models import Review
from spots.models import Spot
from trips.models import Like, Trip, TripMember


def delete_content_for_user(user_id) -> dict[str, int]:
    owned_spot_ids = list(Spot.objects.filter(user_id=user_id).values_list('id', flat=True))
    owned_trip_ids = list(Trip.objects.filter(creator_id=user_id).values_list('id', flat=True))

    photo_filter = Q(user_id=user_id) | Q(spot_id__in=owned_spot_ids)
    photos = list(
        Photo.objects.filter(photo_filter).values('id', 'storage_key', 'thumbnail_url')
    )
    review_ids = list(
        Review.objects.filter(Q(user_id=user_id) | Q(spot_id__in=owned_spot_ids))
        .values_list('id', flat=True)
    )
    comment_filter = (
        Q(user_id=user_id)
        | Q(target_type=Comment.TARGET_SPOT, target_id__in=owned_spot_ids)
        | Q(target_type=Comment.TARGET_TRIP, target_id__in=owned_trip_ids)
    )
    comment_ids = list(Comment.objects.filter(comment_filter).values_list('id', flat=True))

    storage = S3StorageService()
    for photo in photos:
        storage.delete_asset(photo['storage_key'])
        if photo['thumbnail_url']:
            storage.delete_asset(photo['thumbnail_url'])
    storage.delete_prefix(f'avatars/{uuid.UUID(str(user_id)).hex}/')

    counts = {
        'spots': len(owned_spot_ids),
        'trips': len(owned_trip_ids),
        'photos': len(photos),
        'reviews': len(review_ids),
        'comments': len(comment_ids),
    }

    with transaction.atomic():
        CommentMention.objects.filter(
            Q(comment_id__in=comment_ids) | Q(mentioned_user_id=user_id)
        ).delete()
        Comment.objects.filter(comment_filter).delete()
        Interaction.objects.filter(
            Q(user_id=user_id) | Q(spot_id__in=owned_spot_ids)
        ).delete()
        Review.objects.filter(
            Q(user_id=user_id) | Q(spot_id__in=owned_spot_ids)
        ).delete()
        Like.objects.filter(user_id=user_id).delete()
        Photo.objects.filter(photo_filter).delete()
        TripMember.objects.filter(user_id=user_id).delete()
        Trip.objects.filter(id__in=owned_trip_ids).delete()
        Spot.objects.filter(id__in=owned_spot_ids).delete()

    for review_id in review_ids:
        delete_review(str(review_id))
    for trip_id in owned_trip_ids:
        delete_trip(str(trip_id))
    for spot_id in owned_spot_ids:
        delete_spot(str(spot_id))

    invalidate_cache_namespaces(SPOTS_CACHE_NAMESPACE, FEED_CACHE_NAMESPACE)
    return counts
