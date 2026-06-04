"""gRPC service implementations for Content API."""

from __future__ import annotations

import logging
import sys
from datetime import datetime
from pathlib import Path
from typing import Any

import grpc
from django.core.exceptions import FieldError
from django.db.models import Avg, Count
from django.utils import timezone
from google.protobuf.timestamp_pb2 import Timestamp

logger = logging.getLogger(__name__)

PROTO_DIR = Path(__file__).resolve().parent / "proto"
if str(PROTO_DIR) not in sys.path:
    sys.path.insert(0, str(PROTO_DIR))

from scope.v1 import common_pb2, spot_pb2, spot_pb2_grpc  # noqa: E402


class SpotServiceServicer(spot_pb2_grpc.SpotServiceServicer):
    """Implements the SpotService gRPC interface."""

    def GetSpot(self, request, context):
        from spots.models import Spot

        try:
            spot = self._base_queryset().get(id=request.id)
        except (Spot.DoesNotExist, ValueError):
            context.set_code(grpc.StatusCode.NOT_FOUND)
            context.set_details(f"Spot {request.id} not found")
            return spot_pb2.Spot()

        return self._spot_to_proto(spot)

    def ListSpots(self, request, context):

        page = request.pagination.page if request.HasField("pagination") and request.pagination.page > 0 else 1
        page_size = request.pagination.page_size if request.HasField("pagination") and request.pagination.page_size > 0 else 20
        page_size = min(page_size, 100)
        offset = (page - 1) * page_size

        qs = self._base_queryset()
        if request.category:
            qs = qs.filter(category=request.category)
        if request.creator_id:
            qs = qs.filter(user_id=request.creator_id)
        if request.ordering:
            try:
                qs = qs.order_by(request.ordering)
            except FieldError:
                context.set_code(grpc.StatusCode.INVALID_ARGUMENT)
                context.set_details(f"Invalid ordering: {request.ordering}")
                return spot_pb2.ListSpotsResponse()

        total = qs.count()
        spots = [self._spot_to_proto(spot) for spot in qs[offset:offset + page_size]]
        return spot_pb2.ListSpotsResponse(
            spots=spots,
            meta=common_pb2.PaginatedMeta(
                total=total,
                page=page,
                page_size=page_size,
                total_pages=(total + page_size - 1) // page_size if page_size else 0,
            ),
        )

    def SearchSpots(self, request, context):
        from common.search import SPOT_INDEX, get_es_client

        client = get_es_client()
        if client is None:
            context.set_code(grpc.StatusCode.UNAVAILABLE)
            context.set_details("Search service unavailable")
            return spot_pb2.ListSpotsResponse()

        body: dict[str, Any] = {
            "query": {
                "multi_match": {
                    "query": request.query,
                    "fields": ["name^3", "title^3", "description", "tags^2", "category", "vibe"],
                }
            },
            "size": request.limit or 20,
        }
        result = client.search(index=SPOT_INDEX, body=body)
        hits = result.get("hits", {})
        spots = [self._source_to_proto(hit.get("_source", {})) for hit in hits.get("hits", [])]
        total = hits.get("total", {})
        total_value = total.get("value", 0) if isinstance(total, dict) else int(total or 0)
        return spot_pb2.ListSpotsResponse(
            spots=spots,
            meta=common_pb2.PaginatedMeta(total=total_value, page=1, page_size=len(spots), total_pages=1 if spots else 0),
        )

    def GetSpotsByIds(self, request, context):
        spots = [self._spot_to_proto(spot) for spot in self._base_queryset().filter(id__in=list(request.ids))]
        return spot_pb2.ListSpotsResponse(
            spots=spots,
            meta=common_pb2.PaginatedMeta(total=len(spots), page=1, page_size=len(spots), total_pages=1 if spots else 0),
        )

    @staticmethod
    def _base_queryset():
        from spots.models import Spot

        return Spot.objects.annotate(grpc_review_count=Count("reviews"), grpc_avg_rating=Avg("reviews__rating"))

    @staticmethod
    def _spot_to_proto(spot) -> spot_pb2.Spot:
        rating = getattr(spot, "grpc_avg_rating", None) or getattr(spot, "rating", None) or 0
        review_count = getattr(spot, "grpc_review_count", 0) or 0
        tags = [tag for tag in [getattr(spot, "vibe", ""), getattr(spot, "city", ""), getattr(spot, "country", "")] if tag]
        return spot_pb2.Spot(
            id=str(spot.id),
            name=getattr(spot, "title", "") or getattr(spot, "name", ""),
            description=getattr(spot, "description", "") or "",
            location=common_pb2.GeoPoint(
                latitude=float(getattr(spot, "latitude", 0) or 0),
                longitude=float(getattr(spot, "longitude", 0) or 0),
            ),
            category=getattr(spot, "category", "") or "",
            tags=tags,
            creator_id=str(getattr(spot, "user_id", "") or getattr(spot, "creator_id", "")),
            avg_rating=float(rating or 0),
            review_count=int(review_count),
            created_at=SpotServiceServicer._timestamp(getattr(spot, "created_at", None)),
            updated_at=SpotServiceServicer._timestamp(getattr(spot, "updated_at", None)),
        )

    @staticmethod
    def _source_to_proto(source: dict[str, Any]) -> spot_pb2.Spot:
        location = source.get("location") or {}
        if isinstance(location, str):
            location = {}
        return spot_pb2.Spot(
            id=str(source.get("id", "")),
            name=str(source.get("name") or source.get("title") or ""),
            description=str(source.get("description") or ""),
            location=common_pb2.GeoPoint(
                latitude=float(location.get("lat") or location.get("latitude") or source.get("latitude") or 0),
                longitude=float(location.get("lon") or location.get("longitude") or source.get("longitude") or 0),
            ),
            category=str(source.get("category") or ""),
            tags=[str(tag) for tag in source.get("tags", [])],
            creator_id=str(source.get("creator_id") or source.get("user_id") or ""),
            avg_rating=float(source.get("avg_rating") or source.get("rating") or 0),
            review_count=int(source.get("review_count") or 0),
        )

    @staticmethod
    def _timestamp(value: datetime | None) -> Timestamp:
        timestamp = Timestamp()
        if value is None:
            return timestamp
        if timezone.is_naive(value):
            value = timezone.make_aware(value, timezone.get_default_timezone())
        timestamp.FromDatetime(value)
        return timestamp
