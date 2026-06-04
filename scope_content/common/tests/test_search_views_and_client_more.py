from __future__ import annotations


from django.test import RequestFactory

from common import search, views_search


def test_search_client_singleton_connection_failure_and_index_creation(monkeypatch):
    monkeypatch.setattr(search, "_client", "cached")
    assert search.get_es_client() == "cached"

    monkeypatch.setattr(search, "_client", None)
    monkeypatch.delenv("ELASTICSEARCH_URL", raising=False)
    assert search.get_es_client() is None

    class FailingClient:
        def __init__(self, *args, **kwargs):
            pass

        def info(self):
            raise RuntimeError("down")

    monkeypatch.setenv("ELASTICSEARCH_URL", "http://es:9200")
    monkeypatch.setattr(search, "Elasticsearch", FailingClient)
    assert search.get_es_client() is None

    created = []

    class FakeIndices:
        def __init__(self):
            self.calls = 0

        def exists(self, index):
            self.calls += 1
            return self.calls == 2

        def create(self, index, body):
            created.append((index, body))

    class GoodClient:
        def __init__(self, *args, **kwargs):
            self.indices = FakeIndices()

        def info(self):
            return {"version": {"number": "8.0"}}

    monkeypatch.setattr(search, "_client", None)
    monkeypatch.setattr(search, "Elasticsearch", GoodClient)
    client = search.get_es_client()
    assert client is not None
    search.ensure_indexes()
    assert created[0][0] == search.SPOT_INDEX


def test_search_view_validation_unavailable_exception_and_success(monkeypatch):
    factory = RequestFactory()
    view = views_search.SearchView()

    assert view.get(factory.get("/api/content/search")).status_code == 400
    assert view.get(factory.get("/api/content/search?q=x&type=bad")).status_code == 400

    monkeypatch.setattr(views_search, "get_es_client", lambda: None)
    assert view.get(factory.get("/api/content/search?q=x&type=spots")).status_code == 503

    class BrokenClient:
        def search(self, *args, **kwargs):
            raise RuntimeError("query failed")

    monkeypatch.setattr(views_search, "get_es_client", lambda: BrokenClient())
    assert view.get(factory.get("/api/content/search?q=x&type=spots")).status_code == 500

    captured = {}

    class FakeClient:
        def search(self, *, index, body):
            captured["index"] = index
            captured["body"] = body
            return {
                "hits": {
                    "hits": [
                        {"_source": {"name": "Visible", "is_public": True}, "_score": 2.0, "highlight": {"name": ["<em>Visible</em>"]}},
                        {"_source": {"name": "Hidden", "is_public": False}, "_score": 1.0},
                    ]
                }
            }

    monkeypatch.setattr(views_search, "get_es_client", lambda: FakeClient())
    response = view.get(factory.get("/api/content/search?q=sunset&type=spots&limit=500&offset=bad"))

    assert response.status_code == 200
    assert captured["body"]["size"] == 100
    assert captured["body"]["from"] == 0
    assert b"Visible" in response.content
    assert b"Hidden" not in response.content
    assert views_search.SearchView._fields_for("other") == ["name", "description", "text"]


def test_geo_search_validation_unavailable_exception_and_success(monkeypatch):
    factory = RequestFactory()
    view = views_search.GeoSearchView()

    assert view.get(factory.get("/api/content/search/geo?lat=bad&lon=2")).status_code == 400

    monkeypatch.setattr(views_search, "get_es_client", lambda: None)
    assert view.get(factory.get("/api/content/search/geo?lat=1&lon=2")).status_code == 503

    class BrokenClient:
        def search(self, *args, **kwargs):
            raise RuntimeError("query failed")

    monkeypatch.setattr(views_search, "get_es_client", lambda: BrokenClient())
    assert view.get(factory.get("/api/content/search/geo?lat=1&lon=2")).status_code == 500

    class FakeClient:
        def search(self, *, index, body):
            return {
                "hits": {
                    "hits": [
                        {"_source": {"name": "Near", "is_public": True}, "sort": [1.7]},
                        {"_source": {"name": "Hidden", "is_public": False}, "sort": [0.5]},
                    ]
                }
            }

    monkeypatch.setattr(views_search, "get_es_client", lambda: FakeClient())
    response = view.get(factory.get("/api/content/search/geo?lat=1&lon=2&radius=5km&limit=-1"))

    assert response.status_code == 200
    assert b"Near" in response.content
    assert b"Hidden" not in response.content
    assert views_search._visibility_filter_for("reviews") == {"term": {"spot_is_public": True}}
    assert views_search._is_visible_search_hit("reviews", {"spot_is_public": True}) is True
    assert views_search._bounded_int("not-an-int", 20, 100) == 20
