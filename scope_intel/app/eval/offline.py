"""Offline evaluation for the recommendation engine.

The goal is to let us answer, without user traffic:
  - "Did this ranker change raise or lower NDCG@10 vs the previous ranker?"
  - "Are we surfacing enough distinct spots (coverage), or are we recommending
     the same 10 spots to everyone (low Gini)?"
  - "How novel are our recs relative to what the user has already seen?"

This module is deliberately pure-Python and has ZERO Flask / DB imports at
module load time. Callers provide:
  * a `spots` collection (list[Spot])
  * a `ground_truth` dict: user_id -> set of spot_ids the user positively
    engaged with after timestamp T (the held-out set)
  * a `rank_fn(user_id) -> list[spot_id]` callable that produces the ranked
    output of whichever ranker we're scoring

So it works for replays against the live `RecommendationEngine`, against a
pickled baseline, or against any future ranker prototype.
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Callable, Iterable, Mapping


@dataclass(frozen=True, slots=True)
class EvalMetrics:
    """Single-run evaluation results. All scalars, so easy to JSON-dump into
    a CI artifact and diff between ranker versions.
    """

    users_evaluated: int
    ndcg_at_k: float
    map_at_k: float
    hit_rate_at_k: float
    precision_at_k: float
    recall_at_k: float
    coverage: float
    gini: float
    novelty: float
    k: int

    def as_dict(self) -> dict[str, float | int]:
        return {
            "usersEvaluated": self.users_evaluated,
            "k": self.k,
            "ndcg@k": round(self.ndcg_at_k, 4),
            "map@k": round(self.map_at_k, 4),
            "hitRate@k": round(self.hit_rate_at_k, 4),
            "precision@k": round(self.precision_at_k, 4),
            "recall@k": round(self.recall_at_k, 4),
            "coverage": round(self.coverage, 4),
            "gini": round(self.gini, 4),
            "novelty": round(self.novelty, 4),
        }


def evaluate(
    *,
    users: Iterable[str],
    ground_truth: Mapping[str, set[str]],
    rank_fn: Callable[[str], list[str]],
    catalog_size: int,
    k: int = 10,
    seen_by_user: Mapping[str, set[str]] | None = None,
) -> EvalMetrics:
    """Run a full leave-out evaluation pass.

    Args:
        users: iterable of user ids to evaluate.
        ground_truth: user_id -> set of spot ids the user actually engaged
            with (positively) in the held-out window. Users missing from
            this mapping are skipped because we'd have nothing to score
            their recs against.
        rank_fn: callable that returns the ranked list of spot ids for a user.
            The evaluator treats only the first `k` as a recommendation list.
        catalog_size: total number of spots in the active catalog. Used for
            coverage normalization.
        k: top-k cutoff for all rank-aware metrics.
        seen_by_user: optional user_id -> set of spot ids already engaged with
            BEFORE the held-out window. Used for novelty (how many recs
            would be new to this user).

    Returns:
        `EvalMetrics` with per-metric averages over scored users, plus
        system-level coverage / Gini.
    """
    if k <= 0:
        raise ValueError("k must be positive")
    if catalog_size <= 0:
        raise ValueError("catalog_size must be positive")
    seen_by_user = seen_by_user or {}

    user_ids = [uid for uid in users if uid in ground_truth and ground_truth[uid]]
    if not user_ids:
        return EvalMetrics(0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, k)

    total_ndcg = 0.0
    total_map = 0.0
    total_hit = 0.0
    total_precision = 0.0
    total_recall = 0.0
    total_novel = 0.0
    spot_frequency: dict[str, int] = {}

    for user_id in user_ids:
        truth = ground_truth[user_id]
        ranked = rank_fn(user_id)[:k]
        for spot_id in ranked:
            spot_frequency[spot_id] = spot_frequency.get(spot_id, 0) + 1

        relevance = [1.0 if sid in truth else 0.0 for sid in ranked]
        total_ndcg += _ndcg(relevance)
        total_map += _average_precision(relevance)
        total_hit += 1.0 if any(relevance) else 0.0
        hits = sum(relevance)
        total_precision += hits / float(k)
        total_recall += hits / float(len(truth))

        already_seen = seen_by_user.get(user_id) or set()
        novel_hits = sum(1 for sid in ranked if sid not in already_seen)
        total_novel += novel_hits / float(len(ranked)) if ranked else 0.0

    n = float(len(user_ids))
    coverage = len(spot_frequency) / float(catalog_size)
    gini = _gini(list(spot_frequency.values()), catalog_size)

    return EvalMetrics(
        users_evaluated=len(user_ids),
        ndcg_at_k=total_ndcg / n,
        map_at_k=total_map / n,
        hit_rate_at_k=total_hit / n,
        precision_at_k=total_precision / n,
        recall_at_k=total_recall / n,
        coverage=coverage,
        gini=gini,
        novelty=total_novel / n,
        k=k,
    )


def _ndcg(relevance: list[float]) -> float:
    """Normalized DCG. Assumes binary relevance (0 or 1)."""
    if not relevance:
        return 0.0
    dcg = sum(rel / math.log2(idx + 2) for idx, rel in enumerate(relevance))
    ideal_hits = int(sum(relevance))
    ideal = sum(1.0 / math.log2(idx + 2) for idx in range(ideal_hits))
    return dcg / ideal if ideal > 0 else 0.0


def _average_precision(relevance: list[float]) -> float:
    """Mean Average Precision contribution for one user. Binary relevance."""
    if not any(relevance):
        return 0.0
    hits = 0
    summed = 0.0
    for idx, rel in enumerate(relevance, start=1):
        if rel:
            hits += 1
            summed += hits / idx
    total_positives = int(sum(relevance))
    return summed / total_positives


def _gini(frequencies: list[int], catalog_size: int) -> float:
    """Gini coefficient over rec frequency across the catalog. 0 == perfectly
    uniform (every spot shown equally often); 1 == one spot shown to everyone.
    We pad with zeros for catalog entries that were never recommended so an
    under-diverse ranker is properly penalized.
    """
    if catalog_size <= 0:
        return 0.0
    padded = list(frequencies) + [0] * max(0, catalog_size - len(frequencies))
    padded.sort()
    total = float(sum(padded))
    if total <= 0:
        return 0.0
    n = len(padded)
    cumulative = 0.0
    weighted = 0.0
    for idx, value in enumerate(padded, start=1):
        cumulative += value
        weighted += idx * value
    return (2.0 * weighted) / (n * total) - (n + 1.0) / n
