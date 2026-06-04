from __future__ import annotations

import importlib.machinery
from io import BytesIO
from types import SimpleNamespace

from PIL import Image

from photos.services import image_processor


def _image_bytes(format_name="PNG", mode="RGB") -> bytes:
    buffer = BytesIO()
    Image.new(mode, (4, 3), color=0 if mode == "L" else "blue").save(buffer, format=format_name)
    return buffer.getvalue()


def test_native_bindings_missing_bad_spec_unavailable_and_available(monkeypatch, tmp_path):
    image_processor._native_bindings.cache_clear()
    monkeypatch.setattr(image_processor, "SCOPE_MEDIA_BINDINGS_PATH", tmp_path / "missing.py")
    assert image_processor._native_bindings() is None

    existing = tmp_path / "bindings.py"
    existing.write_text("x = 1")

    image_processor._native_bindings.cache_clear()
    monkeypatch.setattr(image_processor, "SCOPE_MEDIA_BINDINGS_PATH", existing)
    monkeypatch.setattr(image_processor.importlib.util, "spec_from_file_location", lambda *args, **kwargs: None)
    assert image_processor._native_bindings() is None

    class FakeLoader:
        def create_module(self, spec):
            return None

        def exec_module(self, module):
            module.is_available = lambda: False

    image_processor._native_bindings.cache_clear()
    monkeypatch.setattr(
        image_processor.importlib.util,
        "spec_from_file_location",
        lambda name, path: importlib.machinery.ModuleSpec(name, FakeLoader()),
    )
    assert image_processor._native_bindings() is None

    class AvailableLoader:
        def create_module(self, spec):
            return None

        def exec_module(self, module):
            module.is_available = lambda: True

    image_processor._native_bindings.cache_clear()
    monkeypatch.setattr(
        image_processor.importlib.util,
        "spec_from_file_location",
        lambda name, path: importlib.machinery.ModuleSpec(name, AvailableLoader()),
    )
    assert image_processor._native_bindings().is_available() is True


def test_format_resolution_and_native_payload_helpers():
    assert image_processor._normalize_format_name("JPG") == "jpeg"
    assert image_processor._normalize_format_name(" TIFF ") is None
    assert image_processor._resolve_extension("photo.webp", None) == ".webp"
    assert image_processor._resolve_extension("photo.unknown", None) == ".jpg"
    assert image_processor._resolve_content_type("image/gif", None, ".gif") == "image/gif"
    assert image_processor._resolve_content_type("bad/type", None, ".webp") == "image/webp"
    assert image_processor._resolve_content_type(None, None, ".bin") == "image/jpeg"

    for mode, channels in [("L", 1), ("LA", 2), ("RGB", 3), ("RGBA", 4), ("CMYK", 4)]:
        payload = image_processor._prepare_native_image(Image.new(mode, (2, 2)))
        assert payload.channels == channels
        assert payload.width == 2
        assert payload.height == 2


def test_save_native_thumbnail_blurhash_and_no_pillow_branch(monkeypatch):
    jpeg_bytes = image_processor._save_image_bytes(Image.new("RGBA", (2, 2), color="red"), "jpeg")
    assert jpeg_bytes.startswith(b"\xff\xd8")

    class FakeBindings:
        def generate_thumbnail_pixels(self, pixels, **kwargs):
            return SimpleNamespace(width=1, height=1, pixels=Image.new("RGB", (1, 1), color="red").tobytes())

        def encode_blurhash_pixels(self, pixels, **kwargs):
            return "blurhash"

    thumb_bytes, extension, content_type = image_processor._generate_native_thumbnail(
        Image.new("RGB", (2, 2), color="red"),
        (1, 1),
        "png",
        FakeBindings(),
    )

    assert thumb_bytes
    assert extension == ".png"
    assert content_type == "image/png"
    assert image_processor._encode_blurhash(Image.new("RGB", (2, 2)), FakeBindings()) == "blurhash"

    monkeypatch.setattr(image_processor, "Image", None)
    monkeypatch.setattr(image_processor, "_native_bindings", lambda: None)
    upload = BytesIO(b"raw")
    upload.name = "raw.gif"
    upload.content_type = "image/gif"

    payload = image_processor.process_uploaded_image(upload)

    assert payload.original_bytes == b"raw"
    assert payload.thumbnail_bytes == b"raw"
    assert payload.original_extension == ".gif"


def test_process_uploaded_image_native_fallback_and_generate_thumbnail(monkeypatch, tmp_path):
    class FakeBindings:
        def detect_format(self, raw):
            return "jpeg"

        def strip_exif(self, raw):
            raise RuntimeError("strip failed")

        def generate_thumbnail_pixels(self, *args, **kwargs):
            raise RuntimeError("native thumb failed")

        def encode_blurhash_pixels(self, *args, **kwargs):
            return "blurhash"

    monkeypatch.setattr(image_processor, "_native_bindings", lambda: FakeBindings())
    upload = BytesIO(_image_bytes("JPEG"))
    upload.name = "photo.jpg"
    upload.content_type = "image/jpeg"

    payload = image_processor.process_uploaded_image(upload, size=(2, 2))

    assert payload.original_extension == ".jpg"
    assert payload.thumbnail_extension == ".jpg"
    assert payload.blurhash == "blurhash"

    source = tmp_path / "source.png"
    dest = tmp_path / "nested" / "thumb.png"
    source.write_bytes(_image_bytes("PNG"))

    image_processor.generate_thumbnail(source, dest, size=(2, 2))

    assert dest.read_bytes()
