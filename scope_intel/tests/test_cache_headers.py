def test_weather_response_includes_private_cache_headers(client, auth_header):
    response = client.get("/api/intel/weather?lat=32.7555&lng=-97.3308&date=2026-04-01", headers=auth_header)

    assert response.status_code == 200
    assert response.headers["Cache-Control"] == "private, max-age=300"
    assert "Authorization" in response.headers["Vary"]


def test_geocode_response_includes_private_cache_headers(client, auth_header):
    response = client.get("/api/intel/geocode?q=Fort%20Worth%2C%20TX", headers=auth_header)

    assert response.status_code == 200
    assert response.headers["Cache-Control"] == "private, max-age=86400"
    assert "Authorization" in response.headers["Vary"]


def test_reverse_geocode_response_includes_private_cache_headers(client, auth_header):
    response = client.get("/api/intel/reverse-geocode?lat=32.7555&lng=-97.3308", headers=auth_header)

    assert response.status_code == 200
    assert response.headers["Cache-Control"] == "private, max-age=86400"
    assert "Authorization" in response.headers["Vary"]
