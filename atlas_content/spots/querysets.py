from __future__ import annotations

from django.db.models import Avg, Count, OuterRef, Prefetch, QuerySet, Subquery

from photos.models import Photo
from reviews.models import Review
from spots.models import Spot

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
