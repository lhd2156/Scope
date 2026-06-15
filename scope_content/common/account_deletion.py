from __future__ import annotations

import uuid
from dataclasses import dataclass

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


@dataclass(frozen=True, slots=True)
class _UserContentDeletion:
    user_id: object
    owned_spot_ids: list
    owned_trip_ids: list
    photos: list[dict]
    review_ids: list
    comment_ids: list
    photo_filter: Q
    comment_filter: Q


def _build_deletion_plan(user_id) -> _UserContentDeletion:
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
    return _UserContentDeletion(
        user_id=user_id,
        owned_spot_ids=owned_spot_ids,
        owned_trip_ids=owned_trip_ids,
        photos=photos,
        review_ids=review_ids,
        comment_ids=comment_ids,
        photo_filter=photo_filter,
        comment_filter=comment_filter,
    )


def _delete_stored_assets(plan: _UserContentDeletion) -> None:
    storage = S3StorageService()
    for photo in plan.photos:
        storage.delete_asset(photo['storage_key'])
        if photo['thumbnail_url']:
            storage.delete_asset(photo['thumbnail_url'])
    storage.delete_prefix(f'avatars/{uuid.UUID(str(plan.user_id)).hex}/')


def _delete_database_records(plan: _UserContentDeletion) -> None:
    with transaction.atomic():
        CommentMention.objects.filter(
            Q(comment_id__in=plan.comment_ids) | Q(mentioned_user_id=plan.user_id)
        ).delete()
        Comment.objects.filter(plan.comment_filter).delete()
        Interaction.objects.filter(
            Q(user_id=plan.user_id) | Q(spot_id__in=plan.owned_spot_ids)
        ).delete()
        Review.objects.filter(
            Q(user_id=plan.user_id) | Q(spot_id__in=plan.owned_spot_ids)
        ).delete()
        Like.objects.filter(user_id=plan.user_id).delete()
        Photo.objects.filter(plan.photo_filter).delete()
        TripMember.objects.filter(user_id=plan.user_id).delete()
        Trip.objects.filter(id__in=plan.owned_trip_ids).delete()
        Spot.objects.filter(id__in=plan.owned_spot_ids).delete()


def _delete_index_documents(plan: _UserContentDeletion) -> None:
    for review_id in plan.review_ids:
        delete_review(str(review_id))
    for trip_id in plan.owned_trip_ids:
        delete_trip(str(trip_id))
    for spot_id in plan.owned_spot_ids:
        delete_spot(str(spot_id))


def _deletion_counts(plan: _UserContentDeletion) -> dict[str, int]:
    return {
        'spots': len(plan.owned_spot_ids),
        'trips': len(plan.owned_trip_ids),
        'photos': len(plan.photos),
        'reviews': len(plan.review_ids),
        'comments': len(plan.comment_ids),
    }


def delete_content_for_user(user_id) -> dict[str, int]:
    plan = _build_deletion_plan(user_id)
    _delete_stored_assets(plan)
    _delete_database_records(plan)
    _delete_index_documents(plan)
    invalidate_cache_namespaces(SPOTS_CACHE_NAMESPACE, FEED_CACHE_NAMESPACE)
    return _deletion_counts(plan)
