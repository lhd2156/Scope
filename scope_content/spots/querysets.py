from __future__ import annotations

from django.db.models import Avg, BooleanField, Count, Exists, OuterRef, Prefetch, Q, QuerySet, Subquery, Value

from photos.models import Photo
from reviews.models import Review
from spots.models import Spot
from trips.models import Like

PHOTO_PREFETCH = Prefetch(
    'photos',
    queryset=Photo.objects.only('id', 'spot_id', 'storage_url', 'thumbnail_url', 'caption', 'sort_order', 'created_at')
    .order_by('sort_order', 'created_at'),
)
REVIEW_PREFETCH = Prefetch(
    'reviews',
    queryset=Review.objects.only('id', 'spot_id', 'user_id', 'rating', 'comment', 'created_at').order_by('-created_at'),
)
FIRST_PHOTO_QUERYSET = Photo.objects.filter(spot_id=OuterRef('pk')).order_by('sort_order', 'created_at')


def visible_to_user(queryset: QuerySet[Spot], user) -> QuerySet[Spot]:
    if getattr(user, 'is_admin', False):
        return queryset

    user_id = getattr(user, 'id', None) if getattr(user, 'is_authenticated', False) else None
    if user_id:
        return queryset.filter(Q(is_public=True) | Q(user_id=user_id))

    return queryset.filter(is_public=True)


def visible_to_request(queryset: QuerySet[Spot], request) -> QuerySet[Spot]:
    return visible_to_user(queryset, getattr(request, 'user', None))


def with_spot_summary(queryset: QuerySet[Spot]) -> QuerySet[Spot]:
    return queryset.annotate(likes_count=Count('likes', distinct=True), average_rating=Avg('reviews__rating'))


def with_spot_list_annotations(queryset: QuerySet[Spot]) -> QuerySet[Spot]:
    return with_spot_summary(queryset).annotate(
        list_photo_storage_url=Subquery(FIRST_PHOTO_QUERYSET.values('storage_url')[:1]),
        list_photo_thumbnail_url=Subquery(FIRST_PHOTO_QUERYSET.values('thumbnail_url')[:1]),
    )


def with_spot_list_relations(queryset: QuerySet[Spot]) -> QuerySet[Spot]:
    return with_spot_list_annotations(queryset)


def with_spot_detail_relations(queryset: QuerySet[Spot]) -> QuerySet[Spot]:
    return with_spot_summary(queryset).prefetch_related(PHOTO_PREFETCH, REVIEW_PREFETCH)


def with_spot_viewer_state(queryset: QuerySet[Spot], request) -> QuerySet[Spot]:
    user = getattr(request, 'user', None)
    user_id = getattr(user, 'id', None) if getattr(user, 'is_authenticated', False) else None
    if not user_id:
        return queryset.annotate(liked=Value(False, output_field=BooleanField()))

    return queryset.annotate(
        liked=Exists(Like.objects.filter(spot_id=OuterRef('pk'), user_id=user_id))
    )
