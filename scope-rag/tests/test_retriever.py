from app import retriever


def test_retrieve_uses_default_top_k(monkeypatch):
    captured = {}

    def fake_search(query: str, k: int = 10, filter_dict: dict | None = None):
        captured["query"] = query
        captured["k"] = k
        captured["filter_dict"] = filter_dict
        return [{"text": "Golden gate views", "metadata": {}, "score": 0.1}]

    monkeypatch.setattr(retriever, "search", fake_search)
    monkeypatch.setattr(retriever.settings, "retriever_top_k", 7)

    results = retriever.retrieve("sunset", filters={"city": "San Francisco"})

    assert len(results) == 1
    assert captured == {
        "query": "sunset",
        "k": 7,
        "filter_dict": {"city": "San Francisco"},
    }
