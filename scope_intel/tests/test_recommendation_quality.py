"""Quality tests for the upgraded recommendation engine.

These lock in the invariants added in the real-data-recommendation work:
    1. Dismissed spots do not re-appear in a user's rec list for 14 days.
    2. Every recommendation carries a `signalBreakdown` so the UI (and offline
       eval) can explain why a spot ranked where it did.
    3. MMR diversification keeps the top-K from being dominated by a single
       category when a diverse candidate pool exists.
    4. Every recommend_spots call writes one audit row per served spot.
    5. Interaction-affinity boosts categories the user has engaged with.
"""

from __future__ import annotations

from app.models import RecommendationAudit
from app.repositories import IntelRepository
from app.services.content_client import Spot
from app.services.recommendation_engine import (
    MMR_MIN_CANDIDATES,
    RecommendationEngine,
)


class _AllSimilarModel:
    """Every document is equally similar. Forces scoring differences to come
    from non-text signals so tests of diversity / affinity are deterministic.
    """

    def fit_transform(self, documents):
        return list(documents)

    def transform(self, documents):
        return list(documents)

    @staticmethod
    def cosine_similarity(_left, right):
        return [[0.5 for _ in right]]


class _SimpleLoader:
    def build_text_similarity_model(self):
        return _AllSimilarModel()


class _InMemoryClient:
    def __init__(self, spots):
        self._spots = list(spots)

    def get_all_spots(self):
        return list(self._spots)

    def get_spot(self, spot_id):
        return next((spot for spot in self._spots if spot.spot_id == spot_id), None)


def _diverse_candidate_pool() -> list[Spot]:
    """Enough candidates (>= MMR_MIN_CANDIDATES) across 4 categories that
    diversity post-processing has something to do.
    """
    assert MMR_MIN_CANDIDATES <= 6, "Test assumes MMR engages with >=4 candidates"
    return [
        Spot("food-a", "Taco Trail", "Street tacos", "food", "lively", 4.8, 90, 10, 32.75, -97.33, False, 10, ()),
        Spot("food-b", "Bakery Brunch", "Pastries and coffee", "food", "chill", 4.7, 88, 8, 32.751, -97.331, False, 9, ()),
        Spot("food-c", "BBQ Pit", "Smokey brisket", "food", "social", 4.6, 86, 12, 32.752, -97.332, False, 11, ()),
        Spot("culture-a", "Modern Museum", "Contemporary art", "culture", "inspiring", 4.8, 80, 15, 32.753, -97.334, False, 20, ()),
        Spot("outdoors-a", "River Trail", "Scenic walk", "outdoors", "serene", 4.7, 82, 0, 32.754, -97.335, True, 14, ()),
        Spot("nightlife-a", "Jazz Cellar", "Live jazz", "nightlife", "electric", 4.5, 84, 25, 32.755, -97.336, False, 8, ()),
    ]


def test_recommend_spots_returns_signal_breakdown_for_each_item(client, auth_header):
    response = client.post(
        "/api/intel/recommend/spots",
        json={"userId": "user-1", "likedSpotIds": ["spot-1"], "interests": ["culture"], "limit": 3},
        headers=auth_header,
    )

    assert response.status_code == 200
    recommendations = response.get_json()["data"]["recommendations"]
    assert recommendations
    for rec in recommendations:
        breakdown = rec.get("signalBreakdown")
        assert isinstance(breakdown, dict)
        # Every signal the ranker advertises must be present, even if 0. This
        # stops a future "silent" removal of a signal from breaking offline
        # replay / explanation UI without notice.
        assert set(breakdown.keys()) == {
            "text",
            "interaction",
            "friend",
            "collab",
            "geo",
            "popularity",
            "quality",
        }


def test_recommend_spots_persists_audit_rows(app, client, auth_header):
    response = client.post(
        "/api/intel/recommend/spots",
        json={"userId": "user-1", "likedSpotIds": ["spot-1"], "interests": ["culture"], "limit": 3},
        headers=auth_header,
    )
    assert response.status_code == 200
    recommendations = response.get_json()["data"]["recommendations"]

    with app.app_context():
        audit_rows = RecommendationAudit.query.filter_by(user_id="user-1").all()

    assert len(audit_rows) == len(recommendations)
    for rank, (rec, row) in enumerate(zip(recommendations, audit_rows)):
        assert row.spot_id == rec["spotId"]
        assert row.rank == rank
        assert row.reason == rec["reason"]


def test_recently_dismissed_spot_is_suppressed_from_future_recs(app, client, auth_header):
    # Mark spot-3 as explicitly dismissed by user-1. The next rec call for
    # user-1 must not include spot-3 at any rank.
    with app.app_context():
        IntelRepository.record_interaction(
            user_id="user-1",
            spot_id="spot-3",
            interaction_type="dismiss",
            context={"source": "rec-card"},
        )

    response = client.post(
        "/api/intel/recommend/spots",
        json={"userId": "user-1", "likedSpotIds": ["spot-1"], "interests": ["outdoors", "culture"], "limit": 5},
        headers=auth_header,
    )
    assert response.status_code == 200
    spot_ids = {rec["spotId"] for rec in response.get_json()["data"]["recommendations"]}
    assert "spot-3" not in spot_ids
    assert "spot-1" not in spot_ids  # liked spot is also still excluded


def test_recommend_feedback_marks_audit_row(app, client, auth_header):
    # Serve recs so there's an audit row to feedback against.
    serve_response = client.post(
        "/api/intel/recommend/spots",
        json={"userId": "user-1", "likedSpotIds": ["spot-1"], "interests": ["culture"], "limit": 3},
        headers=auth_header,
    )
    recommendations = serve_response.get_json()["data"]["recommendations"]
    assert recommendations, "Expected at least one recommendation to audit"
    target_spot_id = recommendations[0]["spotId"]

    response = client.post(
        "/api/intel/recommend/feedback",
        json={"spotId": target_spot_id, "action": "dismiss"},
        headers=auth_header,
    )
    assert response.status_code == 200
    assert response.get_json()["data"]["updated"] is True

    with app.app_context():
        row = (
            RecommendationAudit.query.filter_by(user_id="user-1", spot_id=target_spot_id)
            .order_by(RecommendationAudit.served_at.desc())
            .first()
        )
        assert row is not None
        assert row.dismissed_at is not None


def test_recommend_feedback_returns_false_when_no_audit_row_exists(client, auth_header):
    # Dismiss a spot that was never served to this user. The endpoint must
    # return 200 (user has already taken the UX action; failure here would
    # just confuse clients) but signal `updated: false` so the caller can log
    # it as a stale / missing-audit case.
    response = client.post(
        "/api/intel/recommend/feedback",
        json={"spotId": "spot-never-served", "action": "dismiss"},
        headers=auth_header,
    )
    assert response.status_code == 200
    assert response.get_json()["data"]["updated"] is False


def test_recommend_feedback_rejects_invalid_action(client, auth_header):
    response = client.post(
        "/api/intel/recommend/feedback",
        json={"spotId": "spot-2", "action": "hover"},
        headers=auth_header,
    )
    assert response.status_code == 400
    error = response.get_json()["error"]
    assert error["code"] == "VALIDATION_ERROR"
    assert {detail["field"] for detail in error["details"]} == {"action"}


def test_mmr_diversifies_top_k_when_pool_has_multiple_categories(app):
    # Pool is biased: 3 food candidates, 1 each of culture / outdoors / nightlife.
    # Without MMR, top-3 on equal text similarity collapses into all 3 food
    # results (highest popularity category). With MMR, at least one non-food
    # category must appear in top-3.
    engine = RecommendationEngine(_InMemoryClient(_diverse_candidate_pool()), _SimpleLoader())
    with app.app_context():
        recs = engine.recommend_spots("user-new", [], [], limit=3)

    assert len(recs) == 3
    categories = {rec["category"] for rec in recs}
    assert len(categories) >= 2, f"MMR failed to diversify; got {categories}"


def test_interaction_affinity_boosts_previously_engaged_category(app):
    pool = _diverse_candidate_pool()
    # Tip the scales: no text signal, no location, no popularity differences.
    # Only differentiator will be the user's history via record_interaction.
    normalized_pool = [
        Spot(
            spot.spot_id,
            spot.title,
            "identical description",
            spot.category,
            "identical",
            4.0,
            50.0,
            10,
            32.75,
            -97.33,
            False,
            5,
            (),
        )
        for spot in pool
    ]
    engine = RecommendationEngine(_InMemoryClient(normalized_pool), _SimpleLoader())

    with app.app_context():
        # Heavy engagement with the single culture candidate. Category rollup
        # should then lift OTHER culture spots too -- here there are none, but
        # the direct-spot affinity must still rank 'culture-a' highest.
        for _ in range(5):
            IntelRepository.record_interaction("user-aff", "culture-a", "like")

        recs = engine.recommend_spots("user-aff", [], [], limit=2)

    assert recs[0]["spotId"] == "culture-a"
    assert recs[0]["signalBreakdown"]["interaction"] > 0.0


def test_friend_signal_boosts_spots_liked_by_friends(app):
    """When a user has no personal affinity of their own but their friends have
    all liked a specific spot, the friend signal must be non-zero on that spot
    and zero on others.
    """
    pool = [
        Spot("food-a", "Taco Trail", "identical", "food", "identical", 4.0, 50.0, 10, 32.75, -97.33, False, 5, ()),
        Spot("food-b", "Bakery", "identical", "food", "identical", 4.0, 50.0, 10, 32.75, -97.33, False, 5, ()),
        Spot("culture-a", "Museum", "identical", "culture", "identical", 4.0, 50.0, 10, 32.75, -97.33, False, 5, ()),
        Spot("outdoors-a", "Trail", "identical", "outdoors", "identical", 4.0, 50.0, 10, 32.75, -97.33, False, 5, ()),
    ]
    engine = RecommendationEngine(_InMemoryClient(pool), _SimpleLoader())

    with app.app_context():
        IntelRepository.record_friend_edge("user-social", "friend-1")
        IntelRepository.record_friend_edge("user-social", "friend-2")
        IntelRepository.record_friend_edge("user-social", "friend-3")
        for friend in ("friend-1", "friend-2", "friend-3"):
            IntelRepository.record_interaction(friend, "culture-a", "like")

        recs = engine.recommend_spots("user-social", [], ["food"], limit=4)

    by_id = {rec["spotId"]: rec for rec in recs}
    assert by_id["culture-a"]["signalBreakdown"]["friend"] > 0.0
    assert by_id["food-a"]["signalBreakdown"]["friend"] == 0.0
    assert recs[0]["spotId"] == "culture-a", "Friend signal should push culture-a to #1"


def test_cold_start_user_receives_diversified_recommendations(app):
    """A user with no history, no liked spots, and no interests should still
    get a usable list -- driven by popularity/quality + aggressive diversity.
    """
    engine = RecommendationEngine(_InMemoryClient(_diverse_candidate_pool()), _SimpleLoader())
    with app.app_context():
        recs = engine.recommend_spots("brand-new-user", [], [], limit=4)

    assert len(recs) == 4
    categories = {rec["category"] for rec in recs}
    # Cold-start MMR is lambda=0.4 so we expect strong diversity; at least
    # three distinct categories across a 4-rec list.
    assert len(categories) >= 3, f"Cold-start list not diverse enough: {categories}"
    for rec in recs:
        # Cold-start breakdown is a different (smaller) set, but every rec
        # must still carry the signal keys so the explanation UI doesn't NaN.
        assert "popularity" in rec["signalBreakdown"]
        assert "quality" in rec["signalBreakdown"]
        # The personal-history signals should NOT be present on cold start.
        assert "interaction" not in rec["signalBreakdown"]
        assert "collab" not in rec["signalBreakdown"]


def test_friend_edge_removal_is_idempotent_and_bidirectional(app):
    with app.app_context():
        IntelRepository.record_friend_edge("user-a", "user-b")
        assert IntelRepository.get_friend_ids("user-a") == {"user-b"}
        assert IntelRepository.get_friend_ids("user-b") == {"user-a"}

        IntelRepository.remove_friend_edge("user-a", "user-b")
        assert IntelRepository.get_friend_ids("user-a") == set()
        assert IntelRepository.get_friend_ids("user-b") == set()

        IntelRepository.remove_friend_edge("user-a", "user-b")  # replay
        assert IntelRepository.get_friend_ids("user-a") == set()
