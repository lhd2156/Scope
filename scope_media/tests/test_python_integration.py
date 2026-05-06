from __future__ import annotations

import shutil

import pytest

from scope_media import python_bindings


@pytest.fixture(scope='session')
def native_bindings():
    if shutil.which('cl') is None and shutil.which('gcc') is None:
        pytest.skip('No C compiler found in PATH, skipping scope_media Python integration tests.')
    python_bindings.load_library()
    return python_bindings


def _jpeg_segment(marker: int, payload: bytes) -> bytes:
    return b'\xFF' + bytes([marker]) + (len(payload) + 2).to_bytes(2, 'big') + payload


def _sample_jpeg(*segments: bytes) -> bytes:
    jfif = _jpeg_segment(0xE0, b'JFIF\x00\x01\x01\x00\x00\x01\x00\x01\x00\x00')
    sos = _jpeg_segment(0xDA, b'\x01\x01\x00\x00\x3F\x00')
    entropy = b'\x11\x22\xFF\x00\x33'
    return b'\xFF\xD8' + jfif + b''.join(segments) + sos + entropy + b'\xFF\xD9'


def test_python_bindings_detect_and_strip_exif(native_bindings) -> None:
    exif_segment = _jpeg_segment(0xE1, b'Exif\x00\x00MM\x00*\x00\x00\x00\x08\x00\x00')
    payload = _sample_jpeg(exif_segment)

    assert native_bindings.detect_format(payload) == 'jpeg'

    stripped = native_bindings.strip_exif(payload)
    assert stripped.startswith(b'\xFF\xD8')
    assert stripped.endswith(b'\xFF\xD9')
    assert b'Exif\x00\x00' not in stripped


def test_python_bindings_generate_thumbnail_pixels(native_bindings) -> None:
    result = native_bindings.generate_thumbnail_pixels(
        bytes([
            0, 64,
            128, 255,
        ]),
        width=2,
        height=2,
        channels=1,
        max_width=1,
        max_height=1,
    )

    assert result.width == 1
    assert result.height == 1
    assert result.channels == 1
    assert result.pixels == bytes([112])


def test_python_bindings_encode_blurhash_pixels(native_bindings) -> None:
    blurhash = native_bindings.encode_blurhash_pixels(
        bytes([12, 34, 56]),
        width=1,
        height=1,
        channels=3,
        components_x=1,
        components_y=1,
    )

    assert isinstance(blurhash, str)
    assert len(blurhash) == native_bindings.expected_blurhash_length(1, 1)
    assert blurhash.isascii()
