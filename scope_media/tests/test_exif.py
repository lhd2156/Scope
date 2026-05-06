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
STATUS_DECODE_ERROR = 3


class ScopeMediaBuffer(ctypes.Structure):
    _fields_ = [
        ('data', ctypes.POINTER(ctypes.c_uint8)),
        ('length', ctypes.c_size_t),
    ]


@pytest.fixture(scope='session')
def compiled_library() -> ctypes.CDLL:
    if shutil.which('cl') is None and shutil.which('gcc') is None:
        pytest.skip('No C compiler found in PATH, skipping native scope_media EXIF tests.')

    subprocess.run([sys.executable, str(BUILD_SCRIPT)], cwd=SCOPE_MEDIA_ROOT, check=True)
    library_name = 'scope_media.dll' if sys.platform.startswith('win') else 'libscope_media.so'
    library_path = BUILD_DIR / library_name
    assert library_path.exists(), f'Expected compiled library at {library_path}'

    library = ctypes.CDLL(str(library_path))
    library.scope_media_strip_exif.argtypes = [
        ctypes.POINTER(ctypes.c_uint8),
        ctypes.c_size_t,
        ctypes.POINTER(ScopeMediaBuffer),
    ]
    library.scope_media_strip_exif.restype = ctypes.c_int
    library.scope_media_free_buffer.argtypes = [ctypes.POINTER(ScopeMediaBuffer)]
    library.scope_media_free_buffer.restype = None
    return library


def _jpeg_segment(marker: int, payload: bytes) -> bytes:
    return b'\xFF' + bytes([marker]) + (len(payload) + 2).to_bytes(2, 'big') + payload


def _sample_jpeg(*segments: bytes) -> bytes:
    jfif = _jpeg_segment(0xE0, b'JFIF\x00\x01\x01\x00\x00\x01\x00\x01\x00\x00')
    sos = _jpeg_segment(0xDA, b'\x01\x01\x00\x00\x3F\x00')
    entropy = b'\x11\x22\xFF\x00\x33'
    return b'\xFF\xD8' + jfif + b''.join(segments) + sos + entropy + b'\xFF\xD9'


def _call_strip(library: ctypes.CDLL, payload: bytes) -> tuple[int, bytes]:
    buffer = (ctypes.c_uint8 * len(payload)).from_buffer_copy(payload)
    output = ScopeMediaBuffer()
    status = library.scope_media_strip_exif(buffer, len(payload), ctypes.byref(output))

    if bool(output.data):
        stripped = ctypes.string_at(output.data, output.length)
        library.scope_media_free_buffer(ctypes.byref(output))
        return status, stripped

    return status, b''


def test_strip_exif_removes_only_exif_app1_segments(compiled_library: ctypes.CDLL) -> None:
    exif_segment = _jpeg_segment(0xE1, b'Exif\x00\x00MM\x00*\x00\x00\x00\x08\x00\x00')
    xmp_segment = _jpeg_segment(0xE1, b'http://ns.adobe.com/xap/1.0/\x00<rdf:RDF />')
    app2_segment = _jpeg_segment(0xE2, b'ICC_PROFILE\x00\x01\x01')
    payload = _sample_jpeg(exif_segment, xmp_segment, app2_segment)

    status, stripped = _call_strip(compiled_library, payload)

    assert status == STATUS_OK
    assert b'Exif\x00\x00' not in stripped
    assert xmp_segment in stripped
    assert app2_segment in stripped
    assert stripped.startswith(b'\xFF\xD8')
    assert stripped.endswith(b'\xFF\xD9')
    assert len(stripped) == len(payload) - len(exif_segment)


def test_strip_exif_removes_multiple_exif_segments(compiled_library: ctypes.CDLL) -> None:
    exif_a = _jpeg_segment(0xE1, b'Exif\x00\x00II*\x00\x08\x00\x00\x00\x00\x00')
    exif_b = _jpeg_segment(0xE1, b'Exif\x00\x00MM\x00*\x00\x00\x00\x08\x00\x01')
    payload = _sample_jpeg(exif_a, _jpeg_segment(0xEE, b'Adobe'), exif_b)

    status, stripped = _call_strip(compiled_library, payload)

    assert status == STATUS_OK
    assert b'Exif\x00\x00' not in stripped
    assert len(stripped) == len(payload) - len(exif_a) - len(exif_b)


@pytest.mark.parametrize(
    'payload',
    [
        b'\x89PNG\r\n\x1A\n\x00\x00\x00\rIHDR',
        b'GIF89a\x01\x00\x01\x00',
        b'RIFF\x24\x00\x00\x00WEBPVP8 ',
    ],
)
def test_strip_exif_leaves_non_jpeg_inputs_unchanged(compiled_library: ctypes.CDLL, payload: bytes) -> None:
    status, stripped = _call_strip(compiled_library, payload)

    assert status == STATUS_OK
    assert stripped == payload


def test_strip_exif_rejects_unknown_payloads(compiled_library: ctypes.CDLL) -> None:
    status, stripped = _call_strip(compiled_library, b'not-a-known-image-header')

    assert status == STATUS_UNSUPPORTED_FORMAT
    assert stripped == b''


def test_strip_exif_rejects_invalid_arguments(compiled_library: ctypes.CDLL) -> None:
    output = ScopeMediaBuffer()
    jpeg_header = (ctypes.c_uint8 * 3)(0xFF, 0xD8, 0xFF)

    assert compiled_library.scope_media_strip_exif(None, 0, ctypes.byref(output)) == STATUS_INVALID_ARGUMENT
    assert compiled_library.scope_media_strip_exif(jpeg_header, 3, None) == STATUS_INVALID_ARGUMENT


def test_strip_exif_reports_decode_errors_for_truncated_jpeg(compiled_library: ctypes.CDLL) -> None:
    payload = b'\xFF\xD8\xFF\xE1\x00\x18Exif\x00\x00short'

    status, stripped = _call_strip(compiled_library, payload)

    assert status == STATUS_DECODE_ERROR
    assert stripped == b''
