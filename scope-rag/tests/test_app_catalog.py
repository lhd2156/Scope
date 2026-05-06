from app import app_catalog


def test_app_catalog_finds_frontend_routes():
    results = app_catalog.search_app_knowledge("What frontend routes does Scope have?", k=5)

    assert results
    assert results[0]["metadata"]["source"] == "app_catalog"
    assert any(result["metadata"]["source_type"] == "frontend_routes_index" for result in results)


def test_app_catalog_finds_api_endpoint_owner():
    results = app_catalog.search_app_knowledge("Which service owns POST /api/intel/agent/plan-trip?", k=5)

    assert results
    assert results[0]["metadata"]["service"] == "intel"
    assert results[0]["metadata"]["path"] == "/api/intel/agent/plan-trip"


def test_app_catalog_ignores_plain_spot_recommendations():
    results = app_catalog.search_app_knowledge("What are the best sunset spots?", k=5)

    assert results == []
