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
STATUS_UNSUPPORTED_FORMAT = 2
FORMAT_UNKNOWN = 0
FORMAT_JPEG = 1
FORMAT_PNG = 2
FORMAT_GIF = 3
FORMAT_WEBP = 4


@pytest.fixture(scope='session')
def compiled_library() -> ctypes.CDLL:
    if shutil.which('cl') is None and shutil.which('gcc') is None:
        pytest.skip('No C compiler found in PATH, skipping native scope_media detection tests.')

    subprocess.run([sys.executable, str(BUILD_SCRIPT)], cwd=SCOPE_MEDIA_ROOT, check=True)
    library_name = 'scope_media.dll' if sys.platform.startswith('win') else 'libscope_media.so'
    library_path = BUILD_DIR / library_name
    assert library_path.exists(), f'Expected compiled library at {library_path}'

    library = ctypes.CDLL(str(library_path))
    library.scope_media_detect_format.argtypes = [
        ctypes.POINTER(ctypes.c_uint8),
        ctypes.c_size_t,
        ctypes.POINTER(ctypes.c_int),
    ]
    library.scope_media_detect_format.restype = ctypes.c_int
    return library


def _call_detect(library: ctypes.CDLL, payload: bytes) -> tuple[int, int]:
    buffer = (ctypes.c_uint8 * len(payload)).from_buffer_copy(payload)
    detected_format = ctypes.c_int(FORMAT_UNKNOWN)
    status = library.scope_media_detect_format(buffer, len(payload), ctypes.byref(detected_format))
    return status, detected_format.value


@pytest.mark.parametrize(
    ('payload', 'expected_format'),
    [
        (b'\xFF\xD8\xFF\xE0\x00\x10JFIF', FORMAT_JPEG),
        (b'\x89PNG\r\n\x1A\n\x00\x00\x00\rIHDR', FORMAT_PNG),
        (b'GIF87a\x01\x00\x01\x00', FORMAT_GIF),
        (b'GIF89a\x01\x00\x01\x00', FORMAT_GIF),
        (b'RIFF\x24\x00\x00\x00WEBPVP8 ', FORMAT_WEBP),
    ],
)
def test_detect_format_matches_common_magic_bytes(compiled_library: ctypes.CDLL, payload: bytes, expected_format: int) -> None:
    status, detected_format = _call_detect(compiled_library, payload)

    assert status == STATUS_OK
    assert detected_format == expected_format


def test_detect_format_returns_unsupported_for_unknown_payload(compiled_library: ctypes.CDLL) -> None:
    status, detected_format = _call_detect(compiled_library, b'not-a-known-image-header')

    assert status == STATUS_UNSUPPORTED_FORMAT
    assert detected_format == FORMAT_UNKNOWN


def test_detect_format_rejects_invalid_arguments(compiled_library: ctypes.CDLL) -> None:
    detected_format = ctypes.c_int(FORMAT_UNKNOWN)

    assert compiled_library.scope_media_detect_format(None, 0, ctypes.byref(detected_format)) == STATUS_INVALID_ARGUMENT
    assert compiled_library.scope_media_detect_format(None, 10, ctypes.byref(detected_format)) == STATUS_INVALID_ARGUMENT
    assert compiled_library.scope_media_detect_format((ctypes.c_uint8 * 3)(0xFF, 0xD8, 0xFF), 3, None) == STATUS_INVALID_ARGUMENT
