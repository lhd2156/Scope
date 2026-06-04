def test_intel_api_responses_include_security_headers(client):
    response = client.get("/api/intel/health")

    assert response.status_code == 200
    assert response.headers["X-Content-Type-Options"] == "nosniff"
    assert response.headers["X-Frame-Options"] == "DENY"
    assert response.headers["Referrer-Policy"] == "strict-origin-when-cross-origin"
    assert response.headers["Cross-Origin-Opener-Policy"] == "same-origin"
    assert response.headers["Cross-Origin-Resource-Policy"] == "same-site"
    assert response.headers["Content-Security-Policy"] == "default-src 'none'; frame-ancestors 'none'"
