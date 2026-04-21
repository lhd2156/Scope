EXPECTED_INTEL_ENDPOINTS = {
    "/api/intel/geocode": {"GET"},
    "/api/intel/health": {"GET"},
    "/api/intel/itinerary/<itinerary_id>": {"GET"},
    "/api/intel/itinerary/generate": {"POST"},
    "/api/intel/recommend/similar/<spot_id>": {"POST"},
    "/api/intel/recommend/spots": {"POST"},
    "/api/intel/reverse-geocode": {"GET"},
    "/api/intel/route/optimize": {"POST"},
    "/api/intel/vibe-match": {"POST"},
    "/api/intel/weather": {"GET"},
}

PUBLIC_INTEL_ENDPOINTS = {"/api/intel/health"}


def test_intel_route_map_matches_architecture_endpoint_set(app):
    actual_routes = {
        rule.rule: {method for method in rule.methods if method not in {"HEAD", "OPTIONS"}}
        for rule in app.url_map.iter_rules()
        if rule.rule.startswith("/api/intel")
    }

    assert actual_routes == EXPECTED_INTEL_ENDPOINTS


def test_intel_endpoint_security_posture_matches_architecture_contract(app):
    for rule in app.url_map.iter_rules():
        if not rule.rule.startswith("/api/intel"):
            continue

        view_function = app.view_functions[rule.endpoint]
        assert getattr(view_function, "_atlas_rate_limited", False), f"{rule.rule} is missing @rate_limited"

        if rule.rule in PUBLIC_INTEL_ENDPOINTS:
            assert not getattr(view_function, "_atlas_require_auth", False), f"{rule.rule} should remain public"
        else:
            assert getattr(view_function, "_atlas_require_auth", False), f"{rule.rule} should require auth"
