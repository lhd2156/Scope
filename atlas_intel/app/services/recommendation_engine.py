"""Two-stage recommendation engine for the Intelligence service.

Stage 1 (candidate pool): pull all active spots via the Content client (HTTP in
prod, fixtures in tests), then drop spots the user already liked, recently
dismissed, or the user authored themselves.

Stage 2 (scoring): compute a weighted sum of per-signal scores:
    text similarity     0.50  TF-IDF cosine against user's vibe/interests
    interaction affinity 0.20 cumulative weight of past interactions with this
                               spot AND other spots in the same category
    collaborative       0.10  shared likers with the user's liked_spot_ids
    geo proximity       0.08  r-tree nearest-neighbor bonus from liked spots
    popularity          0.07  global popularity normalized to [0,1]
    quality             0.05  rating normalized to [0,1]

Post-processing: MMR diversity (lambda=0.7) so the top-K isn't dominated by a
single category. Every rec carries its per-signal breakdown so the frontend
can render an explanation and so we can replay ranking offline.

Every list served is also written to `intel.RecommendationAudits` (best-effort)
so we can measure click/dismiss rates and filter the same spot from showing up
after an explicit dismiss.

The engine still accepts any duck-typed content client with
`get_all_spots()` / `get_spot()`; injection is how tests supply fixture data.
"""

from __future__ import annotations

import logging
import threading
from dataclasses import dataclass
from typing import Any

from flask import has_app_context

from app.ml.model_loader import MlModelLoader, ml_model_loader
from app.services.content_client import ContentServiceClient, Spot
from app.services.native_geo import get_native_geo

logger = logging.getLogger(__name__)

# Score weights. Sum is intentionally ~1.0 so a single "perfect" spot caps
# near 1.0 and scores stay interpretable. See RESEARCH.md §5.6.
TEXT_SIMILARITY_WEIGHT = 0.50
INTERACTION_AFFINITY_WEIGHT = 0.20
COLLABORATIVE_WEIGHT = 0.10
GEO_PROXIMITY_WEIGHT = 0.08
POPULARITY_WEIGHT = 0.07
QUALITY_WEIGHT = 0.05

# Kept for backward-compat with existing tests that assert relative weights.
SIMILARITY_TEXT_WEIGHT = 0.85
SIMILARITY_GEO_WEIGHT = 0.15

GEO_PROXIMITY_DISTANCE_CAP_KM = 25.0
NATIVE_R_TREE_NODE_CAPACITY = 8

# MMR: 1.0 = pure relevance, 0.0 = pure diversity. 0.7 keeps recs relevant
# while still surfacing 1-2 off-category picks in a top-5 list.
MMR_LAMBDA = 0.7
# Turn off MMR for tiny candidate pools where diversity can't meaningfully
# reorder anything and where tests assert a specific order.
MMR_MIN_CANDIDATES = 4

# How far back to read user interactions when computing affinity.
INTERACTION_WINDOW_DAYS = 60


@dataclass(slots=True)
class SpotSimilarityIndex:
    signature: tuple[Spot, ...]
    spots: list[Spot]
    model: Any
    matrix: Any
    spot_index_by_id: dict[str, int]


@dataclass(slots=True)
class _ScoredCandidate:
    spot: Spot
    score: float
    signal_breakdown: dict[str, float]
    reason: str


class RecommendationEngine:
    def __init__(
        self,
        content_client: ContentServiceClient,
        model_loader: MlModelLoader = ml_model_loader,
        native_geo_module: Any | None = None,
    ) -> None:
        self.content_client = content_client
        self.model_loader = model_loader
        self.native_geo = native_geo_module if native_geo_module is not None else get_native_geo()
        self._spot_similarity_index: SpotSimilarityIndex | None = None
        # Protects the TF-IDF index rebuild. gthread gunicorn runs multiple
        # requests concurrently on the same engine singleton, so the
        # read-check-write pattern below must be serialized. The hot path (a
        # cache hit) only takes the lock briefly because `fit_transform` is
        # skipped when signatures match.
        self._similarity_index_lock = threading.Lock()

    def recommend_spots(self, user_id: str, liked_spot_ids: list[str], interests: list[str], limit: int) -> list[dict]:
        similarity_index = self._get_spot_similarity_index()
        spots = similarity_index.spots
        liked_spots = [spot for spot in spots if spot.spot_id in liked_spot_ids]
        liked_spot_likers = self._likers_for_spots(spots, liked_spot_ids)
        location_bonus_by_spot_id = self._location_bonus_by_spot_id(spots, liked_spots)

        # Read durable user state only when we're inside a real request. This
        # preserves direct-construction usage in unit tests that don't spin up
        # a Flask app context.
        dismissed_ids: set[str] = set()
        interaction_weights: dict[str, float] = {}
        category_affinity: dict[str, float] = {}
        if has_app_context() and user_id:
            try:
                from app.repositories import IntelRepository

                dismissed_ids = IntelRepository.get_recently_dismissed_spot_ids(user_id)
                interaction_weights = IntelRepository.get_user_interaction_weights(
                    user_id, window_days=INTERACTION_WINDOW_DAYS
                )
            except Exception:
                logger.warning("rec_engine_interaction_lookup_failed", extra={"user_id": user_id})
                dismissed_ids = set()
                interaction_weights = {}
        category_affinity = self._category_affinity_from_weights(spots, interaction_weights)

        user_profile = " ".join(interests + [spot.vibe for spot in liked_spots]) or "adventure culture food"
        user_vector = similarity_index.model.transform([user_profile])
        similarities = similarity_index.model.cosine_similarity(user_vector, similarity_index.matrix)[0]

        max_popularity = max((spot.popularity for spot in spots), default=0.0) or 1.0
        scored: list[_ScoredCandidate] = []

        for index, spot in enumerate(spots):
            if spot.spot_id in liked_spot_ids or spot.spot_id in dismissed_ids:
                continue

            text_component = float(similarities[index])
            collaborative_raw = sum(
                1
                for liker in spot.liked_by_users
                if liker == user_id or liker in liked_spot_likers
            )
            # Normalize collab into [0,1] using a soft cap (5 shared likers -> 1.0).
            collaborative_component = min(collaborative_raw, 5) / 5.0
            popularity_component = spot.popularity / max_popularity
            quality_component = max(0.0, (spot.rating - 1.0) / 4.0)  # 1..5 -> 0..1
            geo_component = location_bonus_by_spot_id.get(spot.spot_id, 0.0)

            # Interaction affinity: direct-spot weight (if user previously
            # engaged with THIS spot) plus category rollup so a strong "food"
            # history lifts under-seen food spots.
            direct_affinity = interaction_weights.get(spot.spot_id, 0.0)
            cat_affinity = category_affinity.get(spot.category, 0.0)
            affinity_component = self._normalize_affinity(direct_affinity + 0.5 * cat_affinity)

            breakdown = {
                "text": round(text_component * TEXT_SIMILARITY_WEIGHT, 4),
                "interaction": round(affinity_component * INTERACTION_AFFINITY_WEIGHT, 4),
                "collab": round(collaborative_component * COLLABORATIVE_WEIGHT, 4),
                "geo": round(geo_component * GEO_PROXIMITY_WEIGHT, 4),
                "popularity": round(popularity_component * POPULARITY_WEIGHT, 4),
                "quality": round(quality_component * QUALITY_WEIGHT, 4),
            }
            total_score = round(sum(breakdown.values()), 4)
            reason = self._build_reason(spot, geo_component, affinity_component, collaborative_component)

            scored.append(
                _ScoredCandidate(
                    spot=spot,
                    score=total_score,
                    signal_breakdown=breakdown,
                    reason=reason,
                )
            )

        # Rank by relevance first, then diversify via MMR if we have enough pool.
        scored.sort(key=lambda c: c.score, reverse=True)
        ranked = self._apply_mmr(scored, limit) if len(scored) >= MMR_MIN_CANDIDATES else scored[:limit]

        recommendations = [
            {
                "spotId": candidate.spot.spot_id,
                "title": candidate.spot.title,
                "category": candidate.spot.category,
                "score": candidate.score,
                "reason": candidate.reason,
                "signalBreakdown": candidate.signal_breakdown,
            }
            for candidate in ranked
        ]

        self._write_audit(user_id, recommendations)
        return recommendations

    def similar_spots(self, spot_id: str, limit: int = 5) -> list[dict]:
        similarity_index = self._get_spot_similarity_index()
        spots = similarity_index.spots
        source_index = similarity_index.spot_index_by_id.get(spot_id)
        if source_index is None:
            return []

        source = spots[source_index]
        similarities = similarity_index.model.cosine_similarity(
            similarity_index.matrix[source_index],
            similarity_index.matrix,
        )[0]
        similar = []

        for index, candidate in enumerate(spots):
            if candidate.spot_id == spot_id:
                continue

            location_bonus = self._location_bonus_from_distance_km(
                self._native_distance_km(source, candidate)
            )
            score = round(
                (float(similarities[index]) * SIMILARITY_TEXT_WEIGHT)
                + (location_bonus * SIMILARITY_GEO_WEIGHT),
                4,
            )
            similar.append(
                {
                    "spotId": candidate.spot_id,
                    "title": candidate.title,
                    "score": score,
                }
            )

        return sorted(similar, key=lambda item: item["score"], reverse=True)[:limit]

    # -- scoring helpers ------------------------------------------------------

    @staticmethod
    def _category_affinity_from_weights(
        spots: list[Spot],
        interaction_weights: dict[str, float],
    ) -> dict[str, float]:
        if not interaction_weights:
            return {}
        spot_by_id = {spot.spot_id: spot for spot in spots}
        rollup: dict[str, float] = {}
        for spot_id, weight in interaction_weights.items():
            spot = spot_by_id.get(spot_id)
            if spot is None:
                continue
            rollup[spot.category] = rollup.get(spot.category, 0.0) + weight
        return rollup

    @staticmethod
    def _normalize_affinity(raw: float) -> float:
        """Squash the unbounded cumulative interaction weight into [0, 1].

        tanh(raw / 10) gives a smooth curve where:
            raw = 0   -> 0.0   (no history)
            raw = 5   -> 0.46  (moderate engagement)
            raw = 15  -> 0.90  (heavy engagement)
            raw = -5  -> 0.0   (negative clamped)
        """
        if raw <= 0:
            return 0.0
        from math import tanh

        return tanh(raw / 10.0)

    @staticmethod
    def _build_reason(
        spot: Spot,
        geo_component: float,
        affinity_component: float,
        collaborative_component: float,
    ) -> str:
        # Keep the historical phrasing that tests / frontend copy depend on, but
        # append additional context so users get a richer "why".
        reason = f"Matches interests in {spot.category} with {spot.vibe} vibe"
        if geo_component > 0.0:
            reason = f"{reason}; close to spots you already liked"
        if affinity_component > 0.25:
            reason = f"{reason}; aligns with your recent activity"
        elif collaborative_component > 0.2:
            reason = f"{reason}; popular with people who share your taste"
        return reason

    def _apply_mmr(
        self,
        candidates: list[_ScoredCandidate],
        limit: int,
    ) -> list[_ScoredCandidate]:
        """Maximal Marginal Relevance with a lightweight category-Jaccard
        similarity. Good enough to prevent "all six recs are food" while we
        stay on TF-IDF; RESEARCH.md §5.7 upgrades this to embedding-cosine.
        """
        if limit <= 0 or not candidates:
            return []
        pool = list(candidates)
        selected: list[_ScoredCandidate] = []
        selected.append(pool.pop(0))

        def similarity(a: _ScoredCandidate, b: _ScoredCandidate) -> float:
            # Category match contributes 0.6; vibe match contributes 0.4.
            score = 0.0
            if a.spot.category == b.spot.category:
                score += 0.6
            if a.spot.vibe == b.spot.vibe:
                score += 0.4
            return score

        while pool and len(selected) < limit:
            best_index = 0
            best_mmr = float("-inf")
            for idx, candidate in enumerate(pool):
                max_similarity = max((similarity(candidate, s) for s in selected), default=0.0)
                mmr = MMR_LAMBDA * candidate.score - (1.0 - MMR_LAMBDA) * max_similarity
                if mmr > best_mmr:
                    best_mmr = mmr
                    best_index = idx
            selected.append(pool.pop(best_index))
        return selected

    def _write_audit(self, user_id: str, recommendations: list[dict]) -> None:
        """Fire-and-forget audit log. Never raise; rec latency MUST NOT be gated
        on a DB write."""
        if not has_app_context() or not user_id or not recommendations:
            return
        try:
            from app.repositories import IntelRepository

            entries = [
                {
                    "spotId": rec["spotId"],
                    "rank": rank,
                    "score": rec["score"],
                    "signalBreakdown": rec.get("signalBreakdown") or {},
                    "reason": rec.get("reason"),
                }
                for rank, rec in enumerate(recommendations)
            ]
            IntelRepository.record_recommendation_audit(user_id, entries)
        except Exception:
            logger.warning("rec_engine_audit_write_failed", extra={"user_id": user_id})

    def _get_spot_similarity_index(self) -> SpotSimilarityIndex:
        spots = self.content_client.get_all_spots()
        signature = tuple(spots)
        # Fast-path: lock-free check for the common case where the cached
        # signature matches. We still re-check under the lock below to avoid
        # two concurrent requests both rebuilding after a content refresh.
        cached = self._spot_similarity_index
        if cached is not None and cached.signature == signature:
            return cached

        with self._similarity_index_lock:
            cached = self._spot_similarity_index
            if cached is not None and cached.signature == signature:
                return cached

            model = self.model_loader.build_text_similarity_model()
            matrix = model.fit_transform([f"{spot.description} {spot.category} {spot.vibe}" for spot in spots])
            self._spot_similarity_index = SpotSimilarityIndex(
                signature=signature,
                spots=spots,
                model=model,
                matrix=matrix,
                spot_index_by_id={spot.spot_id: index for index, spot in enumerate(spots)},
            )
            return self._spot_similarity_index

    def _location_bonus_by_spot_id(self, spots: list[Spot], reference_spots: list[Spot]) -> dict[str, float]:
        if self.native_geo is None or not reference_spots:
            return {}

        reference_points = [
            self.native_geo.SpatialPoint(
                spot.spot_id,
                self.native_geo.Coordinate(spot.latitude, spot.longitude),
            )
            for spot in reference_spots
        ]
        index = self.native_geo.RTreeIndex(reference_points, NATIVE_R_TREE_NODE_CAPACITY)
        bonuses: dict[str, float] = {}

        for spot in spots:
            nearest = index.nearest_neighbor(
                self.native_geo.Coordinate(spot.latitude, spot.longitude)
            )
            if nearest is None:
                continue
            bonuses[spot.spot_id] = self._location_bonus_from_distance_km(float(nearest.distance_km))

        return bonuses

    def _native_distance_km(self, left: Spot, right: Spot) -> float | None:
        if self.native_geo is None:
            return None

        return float(
            self.native_geo.haversine_distance_km(
                self.native_geo.Coordinate(left.latitude, left.longitude),
                self.native_geo.Coordinate(right.latitude, right.longitude),
            )
        )

    @staticmethod
    def _location_bonus_from_distance_km(distance_km: float | None) -> float:
        if distance_km is None:
            return 0.0

        bounded_distance = min(max(distance_km, 0.0), GEO_PROXIMITY_DISTANCE_CAP_KM)
        return 1.0 - (bounded_distance / GEO_PROXIMITY_DISTANCE_CAP_KM)

    @staticmethod
    def _likers_for_spots(spots: list[Spot], liked_spot_ids: list[str]) -> set[str]:
        return {liker for spot in spots if spot.spot_id in liked_spot_ids for liker in spot.liked_by_users}
