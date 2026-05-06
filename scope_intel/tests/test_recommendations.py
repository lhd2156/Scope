def test_recommend_spots(client, auth_header):
    response = client.post("/api/intel/recommend/spots", json={"userId": "user-1", "likedSpotIds": ["spot-1"], "interests": ["culture", "nightlife"], "limit": 3}, headers=auth_header)
    assert response.status_code == 200
    recommendations = response.get_json()["data"]["recommendations"]
    assert len(recommendations) == 3
    assert recommendations[0]["spotId"] != "spot-1"

def test_similar_spots(client, auth_header):
    response = client.post("/api/intel/recommend/similar/spot-2", json={"limit": 2}, headers=auth_header)
    assert response.status_code == 200
    assert len(response.get_json()["data"]["recommendations"]) == 2


def test_recommendation_engine_returns_empty_when_catalog_is_empty():
    from app.services.content_client import FixtureContentServiceClient
    from app.services.recommendation_engine import RecommendationEngine

    engine = RecommendationEngine(FixtureContentServiceClient(spots=[]))

    assert engine.recommend_spots("user-1", [], ["culture"], 5) == []
    assert engine.similar_spots("spot-1", 5) == []
