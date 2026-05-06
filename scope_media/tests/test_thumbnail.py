from __future__ import annotations

import ctypes
import shutil
import subprocess
import sys
from pathlib import Path

import pytest

SCOPE_MEDIA_ROOT = Path(__file__).resolve().parents[1]
BUILD_SCRIPT = SCOPE_MEDIA_ROOT / 'build.py'
BUILD_DIR = SCOPE_MEDIA_ROOT / 'build'
STATUS_OK = 0
STATUS_INVALID_ARGUMENT = 1
STATUS_NOT_IMPLEMENTED = 6


class ScopeMediaImage(ctypes.Structure):
    _fields_ = [
        ('width', ctypes.c_uint32),
        ('height', ctypes.c_uint32),
        ('channels', ctypes.c_uint8),
        ('pixels', ctypes.POINTER(ctypes.c_uint8)),
        ('length', ctypes.c_size_t),
    ]


class ScopeMediaThumbnailOptions(ctypes.Structure):
    _fields_ = [
        ('max_width', ctypes.c_uint32),
        ('max_height', ctypes.c_uint32),
        ('channels', ctypes.c_uint8),
    ]


@pytest.fixture(scope='session')
def compiled_library() -> ctypes.CDLL:
    if shutil.which('cl') is None and shutil.which('gcc') is None:
        pytest.skip('No C compiler found in PATH, skipping native scope_media thumbnail tests.')

    subprocess.run([sys.executable, str(BUILD_SCRIPT)], cwd=SCOPE_MEDIA_ROOT, check=True)
    library_name = 'scope_media.dll' if sys.platform.startswith('win') else 'libscope_media.so'
    library_path = BUILD_DIR / library_name
    assert library_path.exists(), f'Expected compiled library at {library_path}'

    library = ctypes.CDLL(str(library_path))
    library.scope_media_generate_thumbnail.argtypes = [
        ctypes.POINTER(ScopeMediaImage),
        ctypes.POINTER(ScopeMediaThumbnailOptions),
        ctypes.POINTER(ScopeMediaImage),
    ]
    library.scope_media_generate_thumbnail.restype = ctypes.c_int
    library.scope_media_free_image.argtypes = [ctypes.POINTER(ScopeMediaImage)]
    library.scope_media_free_image.restype = None
    return library


def _call_thumbnail(
    library: ctypes.CDLL,
    payload: bytes,
    width: int,
    height: int,
    channels: int,
    max_width: int,
    max_height: int,
    output_channels: int = 0,
) -> tuple[int, int, int, int, bytes]:
    input_buffer = (ctypes.c_uint8 * len(payload)).from_buffer_copy(payload)
    input_image = ScopeMediaImage(
        width=width,
        height=height,
        channels=channels,
        pixels=ctypes.cast(input_buffer, ctypes.POINTER(ctypes.c_uint8)),
        length=len(payload),
    )
    options = ScopeMediaThumbnailOptions(
        max_width=max_width,
        max_height=max_height,
        channels=output_channels,
    )
    output_image = ScopeMediaImage()
    status = library.scope_media_generate_thumbnail(ctypes.byref(input_image), ctypes.byref(options), ctypes.byref(output_image))

    thumbnail_bytes = b''
    output_width = output_image.width
    output_height = output_image.height
    output_channels = output_image.channels
    if bool(output_image.pixels):
        thumbnail_bytes = ctypes.string_at(output_image.pixels, output_image.length)
        library.scope_media_free_image(ctypes.byref(output_image))

    return status, output_width, output_height, output_channels, thumbnail_bytes


def test_generate_thumbnail_preserves_aspect_ratio_without_upscaling(compiled_library: ctypes.CDLL) -> None:
    payload = bytes(range(24))

    status, width, height, channels, thumbnail_bytes = _call_thumbnail(
        compiled_library,
        payload,
        width=4,
        height=2,
        channels=3,
        max_width=2,
        max_height=2,
    )

    assert status == STATUS_OK
    assert width == 2
    assert height == 1
    assert channels == 3
    assert len(thumbnail_bytes) == 6


def test_generate_thumbnail_uses_bilinear_interpolation_for_single_pixel(compiled_library: ctypes.CDLL) -> None:
    payload = bytes([
        0, 64,
        128, 255,
    ])

    status, width, height, channels, thumbnail_bytes = _call_thumbnail(
        compiled_library,
        payload,
        width=2,
        height=2,
        channels=1,
        max_width=1,
        max_height=1,
    )

    assert status == STATUS_OK
    assert width == 1
    assert height == 1
    assert channels == 1
    assert thumbnail_bytes == bytes([112])


def test_generate_thumbnail_returns_copy_when_bounds_are_larger_than_input(compiled_library: ctypes.CDLL) -> None:
    payload = bytes([10, 20, 30, 40, 50, 60])

    status, width, height, channels, thumbnail_bytes = _call_thumbnail(
        compiled_library,
        payload,
        width=2,
        height=1,
        channels=3,
        max_width=8,
        max_height=8,
    )

    assert status == STATUS_OK
    assert width == 2
    assert height == 1
    assert channels == 3
    assert thumbnail_bytes == payload


def test_generate_thumbnail_rejects_invalid_arguments(compiled_library: ctypes.CDLL) -> None:
    output = ScopeMediaImage()
    options = ScopeMediaThumbnailOptions(max_width=2, max_height=2, channels=0)
    image_buffer = (ctypes.c_uint8 * 4)(0, 64, 128, 255)
    image = ScopeMediaImage(
        width=2,
        height=2,
        channels=1,
        pixels=ctypes.cast(image_buffer, ctypes.POINTER(ctypes.c_uint8)),
        length=4,
    )

    assert compiled_library.scope_media_generate_thumbnail(None, ctypes.byref(options), ctypes.byref(output)) == STATUS_INVALID_ARGUMENT
    assert compiled_library.scope_media_generate_thumbnail(ctypes.byref(image), None, ctypes.byref(output)) == STATUS_INVALID_ARGUMENT
    assert compiled_library.scope_media_generate_thumbnail(ctypes.byref(image), ctypes.byref(options), None) == STATUS_INVALID_ARGUMENT

    zero_bounds = ScopeMediaThumbnailOptions(max_width=0, max_height=2, channels=0)
    assert compiled_library.scope_media_generate_thumbnail(ctypes.byref(image), ctypes.byref(zero_bounds), ctypes.byref(output)) == STATUS_INVALID_ARGUMENT


def test_generate_thumbnail_rejects_channel_conversion_for_now(compiled_library: ctypes.CDLL) -> None:
    payload = bytes([10, 20, 30, 40, 50, 60])

    status, width, height, channels, thumbnail_bytes = _call_thumbnail(
        compiled_library,
        payload,
        width=2,
        height=1,
        channels=3,
        max_width=1,
        max_height=1,
        output_channels=4,
    )

    assert status == STATUS_NOT_IMPLEMENTED
    assert width == 0
    assert height == 0
    assert channels == 0
    assert thumbnail_bytes == b''
