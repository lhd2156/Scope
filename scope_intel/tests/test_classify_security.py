import io

import pytest
from PIL import Image

from app.ml.inference import tagger


def _png_bytes() -> bytes:
    image = Image.new("RGB", (1, 1), color=(255, 255, 255))
    buffer = io.BytesIO()
    image.save(buffer, format="PNG")
    return buffer.getvalue()


def test_classify_endpoint_requires_auth(client):
    response = client.post("/api/intel/classify-image", json={"url": "https://example.com/image.png"})

    assert response.status_code == 401
    assert response.get_json()["error"]["code"] == "UNAUTHORIZED"


@pytest.mark.parametrize(
    "url",
    [
        "file:///etc/passwd",
        "http://127.0.0.1/private.png",
        "http://169.254.169.254/latest/meta-data/",
        "http://localhost/private.png",
        "https://user:pass@example.com/private.png",
    ],
)
def test_classify_from_url_rejects_non_public_or_credentialed_urls(url):
    with pytest.raises(ValueError):
        tagger.classify_from_url(url)


def test_classify_from_url_rejects_oversized_response(monkeypatch):
    class Response:
        status = 200
        headers = {"Content-Type": "image/png", "Content-Length": "20"}

        def close(self):
            return None

        def iter_content(self, chunk_size):
            yield _png_bytes()

    monkeypatch.setattr(tagger.socket, "getaddrinfo", lambda *args, **kwargs: [(None, None, None, None, ("93.184.216.34", 443))])
    monkeypatch.setattr(tagger, "_open_public_image_url", lambda url, timeout_seconds: Response())

    with pytest.raises(ValueError, match="too large"):
        tagger.classify_from_url("https://example.com/image.png", max_bytes=10)


def test_classify_from_url_validates_redirect_target(monkeypatch):
    class RedirectResponse:
        status = 302
        headers = {"Location": "http://127.0.0.1/private.png"}

        def close(self):
            return None

    monkeypatch.setattr(tagger.socket, "getaddrinfo", lambda *args, **kwargs: [(None, None, None, None, ("93.184.216.34", 443))])
    monkeypatch.setattr(tagger, "_open_public_image_url", lambda url, timeout_seconds: RedirectResponse())

    with pytest.raises(ValueError, match="public addresses"):
        tagger.classify_from_url("https://example.com/image.png")
