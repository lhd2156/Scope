from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime

from reviews.models import Review
from spots.models import Spot
from spots.querysets import with_spot_list_relations
from trips.models import Trip
from trips.querysets import with_trip_relations


@dataclass(frozen=True, slots=True)
class FeedReference:
    type: str
    item_id: object
    created_at: datetime


@dataclass(frozen=True, slots=True)
class FeedItem:
    type: str
    created_at: datetime
    item: object


@dataclass(frozen=True, slots=True)
class FeedPage:
    entries: list[FeedItem]
    has_more: bool


class FeedAggregator:
    def social_feed_page(self, *, cursor: datetime | None = None, user_id=None, page_size: int = 20) -> FeedPage:
        candidate_limit = page_size + 1
        ordered_references = self._merge_references(
            self._load_spot_references(cursor, candidate_limit),
            self._load_trip_references(cursor, candidate_limit),
            self._load_review_references(cursor, candidate_limit),
        )
        page_references = ordered_references[:page_size]
        hydrated_entries = self._hydrate_entries(page_references)
        return FeedPage(entries=hydrated_entries, has_more=len(ordered_references) > page_size)

    def trending_spots_queryset(self):
        return with_spot_list_relations(Spot.objects.filter(is_public=True)).order_by('-likes_count', '-created_at')

    @staticmethod
    def _load_spot_references(cursor: datetime | None, limit: int) -> list[FeedReference]:
        queryset = Spot.objects.filter(is_public=True)
        if cursor is not None:
            queryset = queryset.filter(created_at__lt=cursor)
        return [
            FeedReference(type='spot', item_id=item['id'], created_at=item['created_at'])
            for item in queryset.order_by('-created_at').values('id', 'created_at')[:limit]
        ]

    @staticmethod
    def _load_trip_references(cursor: datetime | None, limit: int) -> list[FeedReference]:
        queryset = Trip.objects.filter(is_public=True)
        if cursor is not None:
            queryset = queryset.filter(created_at__lt=cursor)
        return [
            FeedReference(type='trip', item_id=item['id'], created_at=item['created_at'])
            for item in queryset.order_by('-created_at').values('id', 'created_at')[:limit]
        ]

    @staticmethod
    def _load_review_references(cursor: datetime | None, limit: int) -> list[FeedReference]:
        queryset = Review.objects.filter(spot__is_public=True)
        if cursor is not None:
            queryset = queryset.filter(created_at__lt=cursor)
        return [
            FeedReference(type='review', item_id=item['id'], created_at=item['created_at'])
            for item in queryset.order_by('-created_at').values('id', 'created_at')[:limit]
        ]

    def _hydrate_entries(self, references: list[FeedReference]) -> list[FeedItem]:
        spot_ids = [reference.item_id for reference in references if reference.type == 'spot']
        trip_ids = [reference.item_id for reference in references if reference.type == 'trip']
        review_ids = [reference.item_id for reference in references if reference.type == 'review']
        spots_by_id = self._hydrate_spots(spot_ids)
        trips_by_id = self._hydrate_trips(trip_ids)
        reviews_by_id = self._hydrate_reviews(review_ids)

        hydrated_entries = []
        for reference in references:
            item = {
                'spot': spots_by_id,
                'trip': trips_by_id,
                'review': reviews_by_id,
            }[reference.type].get(reference.item_id)
            if item is None:
                continue
            hydrated_entries.append(FeedItem(type=reference.type, created_at=reference.created_at, item=item))
        return hydrated_entries

    @staticmethod
    def _hydrate_spots(spot_ids) -> dict[object, Spot]:
        if not spot_ids:
            return {}
        spots = with_spot_list_relations(Spot.objects.filter(id__in=spot_ids))
        return {spot.id: spot for spot in spots}

    @staticmethod
    def _hydrate_trips(trip_ids) -> dict[object, Trip]:
        if not trip_ids:
            return {}
        trips = with_trip_relations(Trip.objects.filter(id__in=trip_ids))
        return {trip.id: trip for trip in trips}

    @staticmethod
    def _hydrate_reviews(review_ids) -> dict[object, Review]:
        if not review_ids:
            return {}
        reviews = Review.objects.filter(id__in=review_ids, spot__is_public=True).select_related('spot').prefetch_related('spot__photos')
        return {review.id: review for review in reviews}

    @staticmethod
    def _merge_references(*reference_groups: list[FeedReference]) -> list[FeedReference]:
        return sorted(
            [reference for reference_group in reference_groups for reference in reference_group],
            key=lambda reference: reference.created_at,
            reverse=True,
        )
