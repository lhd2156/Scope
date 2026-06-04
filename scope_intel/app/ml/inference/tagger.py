"""Image classification / auto-tagging using EfficientNet."""

import io
import ipaddress
import logging
import ssl
import socket
from typing import Any
from urllib.parse import urljoin, urlparse

from PIL import Image

logger = logging.getLogger(__name__)
DEFAULT_IMAGE_FETCH_TIMEOUT_SECONDS = 10.0
DEFAULT_IMAGE_FETCH_MAX_BYTES = 5 * 1024 * 1024
DEFAULT_IMAGE_FETCH_MAX_REDIRECTS = 3


def classify_image(image_bytes: bytes, top_k: int = 5) -> list[dict[str, Any]]:
    """Classify an image and return top-k predicted tags.

    Args:
        image_bytes: Raw image bytes (JPEG/PNG).
        top_k: Number of top predictions to return.

    Returns: [{"tag": "beach", "confidence": 0.92}, ...]
    """
    import torch

    from app.ml.registry import load_tagger_model

    tagger = load_tagger_model()
    model = tagger["model"]
    transform = tagger["transform"]
    categories = tagger["categories"]
    device = tagger["device"]

    image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    tensor = transform(image).unsqueeze(0).to(device)

    with torch.no_grad():
        outputs = model(tensor)
        probabilities = torch.nn.functional.softmax(outputs[0], dim=0)

    top_probs, top_indices = torch.topk(probabilities, min(top_k * 10, len(probabilities)))

    results = []
    for prob, idx in zip(top_probs, top_indices):
        cat_idx = idx.item() % len(categories)
        tag = categories[cat_idx]
        if not any(r["tag"] == tag for r in results):
            results.append({"tag": tag, "confidence": round(prob.item(), 4)})
        if len(results) >= top_k:
            break

    return results


def classify_from_url(
    url: str,
    top_k: int = 5,
    *,
    timeout_seconds: float = DEFAULT_IMAGE_FETCH_TIMEOUT_SECONDS,
    max_bytes: int = DEFAULT_IMAGE_FETCH_MAX_BYTES,
    max_redirects: int = DEFAULT_IMAGE_FETCH_MAX_REDIRECTS,
) -> list[dict[str, Any]]:
    """Download a public image URL with SSRF and payload-size guards."""
    import urllib3

    current_url = _validate_public_image_url(url)
    try:
        for _ in range(max_redirects + 1):
            response = _open_public_image_url(current_url, timeout_seconds=timeout_seconds)
            try:
                status = getattr(response, "status", 200)
                if status in {301, 302, 303, 307, 308}:
                    location = response.headers.get("Location", "")
                    if not location:
                        raise ValueError("Image URL redirect did not include a location")
                    current_url = _validate_public_image_url(urljoin(current_url, location))
                    continue

                if status >= 400:
                    raise ValueError("Image URL returned an error status")

                content_type = response.headers.get("Content-Type", "")
                if content_type and not content_type.lower().split(";", 1)[0].startswith("image/"):
                    raise ValueError("Image URL did not return an image content type")

                image_bytes = _read_limited_response(response, max_bytes=max_bytes)
                return classify_image(image_bytes, top_k)
            finally:
                close = getattr(response, "close", None)
                if callable(close):
                    close()
    except urllib3.exceptions.HTTPError as exc:
        raise ValueError("Unable to fetch image URL") from exc

    raise ValueError("Image URL redirected too many times")


class _PinnedImageResponse:
    def __init__(self, response, pool) -> None:
        self._response = response
        self._pool = pool
        self.status = response.status
        self.headers = response.headers

    def iter_content(self, chunk_size: int):
        yield from self._response.stream(chunk_size, decode_content=False)

    def close(self) -> None:
        self._response.release_conn()
        self._pool.close()


def _open_public_image_url(raw_url: str, *, timeout_seconds: float):
    import urllib3

    current_url, parsed, addresses = _resolve_public_image_url(raw_url)
    address = str(addresses[0])
    port = parsed.port or (443 if parsed.scheme == "https" else 80)
    target = _request_target(parsed)
    headers = {
        "Accept": "image/*",
        "Connection": "close",
        "Host": _host_header(parsed),
        "User-Agent": "ScopeIntelImageFetcher/1.0",
    }

    if parsed.scheme == "https":
        pool = urllib3.HTTPSConnectionPool(
            address,
            port=port,
            timeout=timeout_seconds,
            retries=False,
            ssl_context=ssl.create_default_context(),
            assert_hostname=parsed.hostname,
            server_hostname=parsed.hostname,
        )
    else:
        pool = urllib3.HTTPConnectionPool(address, port=port, timeout=timeout_seconds, retries=False)

    try:
        response = pool.urlopen("GET", target, headers=headers, preload_content=False, redirect=False)
        return _PinnedImageResponse(response, pool)
    except Exception:
        pool.close()
        raise


def _request_target(parsed) -> str:
    path = parsed.path or "/"
    return f"{path}?{parsed.query}" if parsed.query else path


def _host_header(parsed) -> str:
    host = parsed.hostname or ""
    if ":" in host and not host.startswith("["):
        host = f"[{host}]"
    if parsed.port and parsed.port not in {80, 443}:
        return f"{host}:{parsed.port}"
    return host


def _resolve_public_image_url(raw_url: str):
    parsed = urlparse((raw_url or "").strip())
    if parsed.scheme not in {"http", "https"} or not parsed.hostname:
        raise ValueError("Image URL must be an absolute http(s) URL")
    if parsed.username or parsed.password:
        raise ValueError("Image URL must not include credentials")

    host = parsed.hostname
    port = parsed.port or (443 if parsed.scheme == "https" else 80)
    try:
        addresses = [ipaddress.ip_address(host)]
    except ValueError:
        try:
            addresses = [
                ipaddress.ip_address(info[4][0])
                for info in socket.getaddrinfo(host, port, type=socket.SOCK_STREAM)
            ]
        except socket.gaierror as exc:
            raise ValueError("Image URL host could not be resolved") from exc

    unique_addresses = list(dict.fromkeys(addresses))
    if not unique_addresses or any(not _is_public_address(address) for address in unique_addresses):
        raise ValueError("Image URL host must resolve to public addresses only")
    return raw_url.strip(), parsed, unique_addresses


def _validate_public_image_url(raw_url: str) -> str:
    current_url, _, _ = _resolve_public_image_url(raw_url)
    return current_url


def _is_public_address(address: ipaddress.IPv4Address | ipaddress.IPv6Address) -> bool:
    return bool(
        address.is_global
        and not address.is_private
        and not address.is_loopback
        and not address.is_link_local
        and not address.is_multicast
        and not address.is_reserved
        and not address.is_unspecified
    )


def _read_limited_response(response, *, max_bytes: int) -> bytes:
    content_length = response.headers.get("Content-Length")
    if content_length:
        try:
            if int(content_length) > max_bytes:
                raise ValueError("Image URL response is too large")
        except ValueError:
            raise ValueError("Image URL response is too large")

    chunks: list[bytes] = []
    total = 0
    for chunk in response.iter_content(chunk_size=64 * 1024):
        if not chunk:
            continue
        total += len(chunk)
        if total > max_bytes:
            raise ValueError("Image URL response is too large")
        chunks.append(chunk)
    return b"".join(chunks)
