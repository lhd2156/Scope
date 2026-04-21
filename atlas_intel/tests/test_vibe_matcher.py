def test_vibe_matching(client, auth_header):
    response = client.post("/api/intel/vibe-match", json={"description": "I want a chill outdoor walk with sunset views", "limit": 2}, headers=auth_header)
    assert response.status_code == 200
    matches = response.get_json()["data"]["matches"]
    assert len(matches) == 2
    assert matches[0]["score"] >= matches[1]["score"]

def test_health_route(client):
    response = client.get("/api/intel/health")
    assert response.status_code == 200
    payload = response.get_json()
    assert payload["status"] == "healthy"
    assert set(payload.keys()) == {"status", "version", "uptime"}
