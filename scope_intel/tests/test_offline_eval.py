"""Tests for the offline evaluation harness.

Guards the correctness of NDCG / MAP / coverage / Gini so a future regression
in the scoring code or the weights can't silently pass an offline replay.
"""

from __future__ import annotations

from app.eval.offline import EvalMetrics, evaluate


def _rank(order: list[str]):
    return lambda _user_id: order


def test_evaluate_returns_perfect_scores_when_all_hits_are_top_ranked():
    users = ["u1"]
    ground_truth = {"u1": {"a", "b", "c"}}
    metrics = evaluate(
        users=users,
        ground_truth=ground_truth,
        rank_fn=_rank(["a", "b", "c", "x", "y", "z"]),
        catalog_size=6,
        k=3,
    )
    assert metrics.hit_rate_at_k == 1.0
    assert metrics.precision_at_k == 1.0
    assert metrics.recall_at_k == 1.0
    assert round(metrics.ndcg_at_k, 4) == 1.0
    assert round(metrics.map_at_k, 4) == 1.0


def test_evaluate_zero_relevance_gives_zero_ranking_metrics():
    metrics = evaluate(
        users=["u1"],
        ground_truth={"u1": {"hidden"}},
        rank_fn=_rank(["x", "y", "z"]),
        catalog_size=10,
        k=3,
    )
    assert metrics.hit_rate_at_k == 0.0
    assert metrics.ndcg_at_k == 0.0
    assert metrics.map_at_k == 0.0


def test_evaluate_respects_k_cutoff():
    # The truth is at rank 4 (index 3), outside k=3 -- must count as a miss.
    metrics = evaluate(
        users=["u1"],
        ground_truth={"u1": {"d"}},
        rank_fn=_rank(["a", "b", "c", "d", "e"]),
        catalog_size=5,
        k=3,
    )
    assert metrics.hit_rate_at_k == 0.0


def test_coverage_scales_with_distinct_recs_across_users():
    # Two users, each getting a disjoint 2-spot list -> 4 distinct spots
    # recommended out of a 10-spot catalog = 0.4 coverage.
    def rank(user_id: str):
        return {"u1": ["a", "b"], "u2": ["c", "d"]}[user_id]

    metrics = evaluate(
        users=["u1", "u2"],
        ground_truth={"u1": {"a"}, "u2": {"c"}},
        rank_fn=rank,
        catalog_size=10,
        k=2,
    )
    assert round(metrics.coverage, 4) == 0.4


def test_gini_rewards_uniform_rec_distribution():
    # Distribute differently:
    #   fair: every user gets a unique spot (low Gini)
    #   skewed: every user gets the same spot (very high Gini)
    fair_metrics = evaluate(
        users=["u1", "u2", "u3"],
        ground_truth={"u1": {"a"}, "u2": {"b"}, "u3": {"c"}},
        rank_fn=lambda uid: {"u1": ["a"], "u2": ["b"], "u3": ["c"]}[uid],
        catalog_size=3,
        k=1,
    )
    skewed_metrics = evaluate(
        users=["u1", "u2", "u3"],
        ground_truth={"u1": {"a"}, "u2": {"a"}, "u3": {"a"}},
        rank_fn=lambda _uid: ["a"],
        catalog_size=3,
        k=1,
    )
    assert fair_metrics.gini < skewed_metrics.gini
    assert skewed_metrics.gini > 0.5


def test_novelty_measures_unseen_rec_fraction():
    metrics = evaluate(
        users=["u1"],
        ground_truth={"u1": {"new"}},
        rank_fn=_rank(["seen", "new"]),
        catalog_size=5,
        k=2,
        seen_by_user={"u1": {"seen"}},
    )
    # 1 of 2 rec'd spots is unseen -> novelty 0.5.
    assert metrics.novelty == 0.5


def test_evaluate_skips_users_with_no_ground_truth():
    metrics = evaluate(
        users=["u1", "u2"],
        ground_truth={"u1": {"a"}},  # u2 omitted
        rank_fn=_rank(["a"]),
        catalog_size=5,
        k=1,
    )
    assert metrics.users_evaluated == 1


def test_eval_metrics_as_dict_is_jsonable():
    metrics = EvalMetrics(
        users_evaluated=1,
        ndcg_at_k=0.5,
        map_at_k=0.5,
        hit_rate_at_k=1.0,
        precision_at_k=0.5,
        recall_at_k=1.0,
        coverage=0.25,
        gini=0.3,
        novelty=1.0,
        k=10,
    )
    payload = metrics.as_dict()
    assert payload["usersEvaluated"] == 1
    assert payload["k"] == 10
    assert payload["ndcg@k"] == 0.5
    assert payload["novelty"] == 1.0
