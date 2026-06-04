import sys
import types
from types import SimpleNamespace

from app import embeddings, vectorstore


def test_embeddings_singleton_and_batch_helpers(monkeypatch):
    created = []

    class FakeOllamaEmbeddings:
        def __init__(self, **kwargs):
            created.append(kwargs)

        def embed_query(self, text):
            return [float(len(text))]

        def embed_documents(self, texts):
            return [[float(index), float(len(text))] for index, text in enumerate(texts)]

    fake_module = types.SimpleNamespace(OllamaEmbeddings=FakeOllamaEmbeddings)
    monkeypatch.setitem(sys.modules, "langchain_ollama", fake_module)
    monkeypatch.setattr(embeddings, "_embeddings", None)
    monkeypatch.setattr(embeddings.settings, "embedding_model", "embed-test")
    monkeypatch.setattr(embeddings.settings, "ollama_base_url", "http://ollama.test")

    first = embeddings.get_embeddings()
    second = embeddings.get_embeddings()

    assert first is second
    assert created == [{"model": "embed-test", "base_url": "http://ollama.test"}]
    assert embeddings.embed_text("trail") == [5.0]
    assert embeddings.embed_texts(["a", "bb"]) == [[0.0, 1.0], [1.0, 2.0]]


def test_vectorstore_singleton_add_count_and_search(monkeypatch):
    created = []

    class FakeChroma:
        def __init__(self, **kwargs):
            created.append(kwargs)
            self.added = []
            self._collection = SimpleNamespace(count=lambda: 12)

        def add_texts(self, texts, metadatas, ids):
            self.added.append({"texts": texts, "metadatas": metadatas, "ids": ids})

        def similarity_search_with_score(self, query, k, filter):
            doc = SimpleNamespace(page_content=f"match for {query}", metadata={"spot_id": "spot-1"})
            return [(doc, 0.125)]

    fake_module = types.SimpleNamespace(Chroma=FakeChroma)
    monkeypatch.setitem(sys.modules, "langchain_chroma", fake_module)
    monkeypatch.setattr(vectorstore, "_vectorstore", None)
    monkeypatch.setattr(vectorstore, "get_embeddings", lambda: "embeddings")
    monkeypatch.setattr(vectorstore.settings, "chroma_collection_name", "scope-test")
    monkeypatch.setattr(vectorstore.settings, "chroma_persist_dir", "/tmp/chroma")

    store = vectorstore.get_vectorstore()
    assert vectorstore.get_vectorstore() is store
    assert created == [
        {
            "collection_name": "scope-test",
            "embedding_function": "embeddings",
            "persist_directory": "/tmp/chroma",
        }
    ]

    vectorstore.add_document("doc-1", "One trail", {"source": "spot"})
    vectorstore.add_documents(
        [
            {"id": "doc-2", "text": "Two trail", "metadata": {"source": "review"}},
            {"id": "doc-3", "text": "Three trail", "metadata": {"source": "spot"}},
        ]
    )

    assert store.added[0] == {
        "texts": ["One trail"],
        "metadatas": [{"source": "spot"}],
        "ids": ["doc-1"],
    }
    assert store.added[1]["ids"] == ["doc-2", "doc-3"]
    assert vectorstore.get_vector_count() == 12
    assert vectorstore.search("sunset", k=3, filter_dict={"city": "Austin"}) == [
        {"text": "match for sunset", "metadata": {"spot_id": "spot-1"}, "score": 0.125}
    ]


def test_vectorstore_quarantines_incompatible_chroma_config(monkeypatch, tmp_path):
    created = []
    cache_clears = []
    persist_dir = tmp_path / "chroma"
    persist_dir.mkdir()
    (persist_dir / "chroma.sqlite3").write_text("old chroma format", encoding="utf-8")

    class FakeChroma:
        def __init__(self, **kwargs):
            created.append(kwargs)
            if len(created) == 1:
                raise KeyError("_type")
            self._collection = SimpleNamespace(count=lambda: 0)

    fake_module = types.SimpleNamespace(Chroma=FakeChroma)
    monkeypatch.setitem(sys.modules, "langchain_chroma", fake_module)
    monkeypatch.setattr(vectorstore, "_vectorstore", None)
    monkeypatch.setattr(vectorstore, "get_embeddings", lambda: "embeddings")
    monkeypatch.setattr(vectorstore, "_clear_chroma_system_cache", lambda: cache_clears.append("cleared"))
    monkeypatch.setattr(vectorstore.settings, "chroma_collection_name", "scope-test")
    monkeypatch.setattr(vectorstore.settings, "chroma_persist_dir", str(persist_dir))

    store = vectorstore.get_vectorstore()

    assert store is vectorstore.get_vectorstore()
    assert len(created) == 2
    assert cache_clears == ["cleared"]
    assert persist_dir.exists()
    quarantined_dirs = list(tmp_path.glob("chroma.incompatible-*"))
    assert len(quarantined_dirs) == 1
    assert (quarantined_dirs[0] / "chroma.sqlite3").read_text(encoding="utf-8") == "old chroma format"
