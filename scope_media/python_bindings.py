from __future__ import annotations

import ctypes
import shutil
import subprocess
import sys
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

SCOPE_MEDIA_ROOT = Path(__file__).resolve().parent
BUILD_DIR = SCOPE_MEDIA_ROOT / 'build'
BUILD_SCRIPT = SCOPE_MEDIA_ROOT / 'build.py'
LIBRARY_NAME = 'scope_media.dll' if sys.platform.startswith('win') else 'libscope_media.so'

STATUS_OK = 0
STATUS_INVALID_ARGUMENT = 1
STATUS_UNSUPPORTED_FORMAT = 2
STATUS_DECODE_ERROR = 3
STATUS_IO_ERROR = 4
STATUS_NO_MEMORY = 5
STATUS_NOT_IMPLEMENTED = 6

FORMAT_UNKNOWN = 0
FORMAT_JPEG = 1
FORMAT_PNG = 2
FORMAT_GIF = 3
FORMAT_WEBP = 4

STATUS_NAMES = {
    STATUS_OK: 'ok',
    STATUS_INVALID_ARGUMENT: 'invalid_argument',
    STATUS_UNSUPPORTED_FORMAT: 'unsupported_format',
    STATUS_DECODE_ERROR: 'decode_error',
    STATUS_IO_ERROR: 'io_error',
    STATUS_NO_MEMORY: 'no_memory',
    STATUS_NOT_IMPLEMENTED: 'not_implemented',
}
FORMAT_NAMES = {
    FORMAT_JPEG: 'jpeg',
    FORMAT_PNG: 'png',
    FORMAT_GIF: 'gif',
    FORMAT_WEBP: 'webp',
}
FORMAT_EXTENSIONS = {
    'jpeg': '.jpg',
    'png': '.png',
    'gif': '.gif',
    'webp': '.webp',
}
FORMAT_CONTENT_TYPES = {
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'gif': 'image/gif',
    'webp': 'image/webp',
}


class ScopeMediaError(RuntimeError):
    pass


class ScopeMediaUnavailable(ScopeMediaError):
    pass


class ScopeMediaOperationError(ScopeMediaError):
    def __init__(self, operation: str, status: int):
        self.operation = operation
        self.status = status
        super().__init__(f'{operation} failed with status {status_name(status)}')


class ScopeMediaBuffer(ctypes.Structure):
    _fields_ = [
        ('data', ctypes.POINTER(ctypes.c_uint8)),
        ('length', ctypes.c_size_t),
    ]


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


@dataclass(frozen=True)
class ThumbnailResult:
    width: int
    height: int
    channels: int
    pixels: bytes


@lru_cache(maxsize=1)
def _configured_library(path: str) -> ctypes.CDLL:
    library = ctypes.CDLL(path)
    library.scope_media_status_name.argtypes = [ctypes.c_int]
    library.scope_media_status_name.restype = ctypes.c_char_p
    library.scope_media_detect_format.argtypes = [
        ctypes.POINTER(ctypes.c_uint8),
        ctypes.c_size_t,
        ctypes.POINTER(ctypes.c_int),
    ]
    library.scope_media_detect_format.restype = ctypes.c_int
    library.scope_media_strip_exif.argtypes = [
        ctypes.POINTER(ctypes.c_uint8),
        ctypes.c_size_t,
        ctypes.POINTER(ScopeMediaBuffer),
    ]
    library.scope_media_strip_exif.restype = ctypes.c_int
    library.scope_media_generate_thumbnail.argtypes = [
        ctypes.POINTER(ScopeMediaImage),
        ctypes.POINTER(ScopeMediaThumbnailOptions),
        ctypes.POINTER(ScopeMediaImage),
    ]
    library.scope_media_generate_thumbnail.restype = ctypes.c_int
    library.scope_media_encode_blurhash.argtypes = [
        ctypes.POINTER(ScopeMediaImage),
        ctypes.c_uint32,
        ctypes.c_uint32,
        ctypes.POINTER(ctypes.c_char),
        ctypes.c_size_t,
    ]
    library.scope_media_encode_blurhash.restype = ctypes.c_int
    library.scope_media_free_buffer.argtypes = [ctypes.POINTER(ScopeMediaBuffer)]
    library.scope_media_free_buffer.restype = None
    library.scope_media_free_image.argtypes = [ctypes.POINTER(ScopeMediaImage)]
    library.scope_media_free_image.restype = None
    return library


def compiler_available() -> bool:
    return shutil.which('cl') is not None or shutil.which('gcc') is not None


def library_path() -> Path:
    return BUILD_DIR / LIBRARY_NAME


def load_library(*, allow_build: bool = True) -> ctypes.CDLL:
    output = library_path()
    if not output.exists():
        if not allow_build:
            raise ScopeMediaUnavailable(f'Compiled scope_media library not found at {output}')
        if not compiler_available():
            raise ScopeMediaUnavailable('No C compiler found in PATH (expected cl or gcc).')
        try:
            subprocess.run([sys.executable, str(BUILD_SCRIPT)], cwd=SCOPE_MEDIA_ROOT, check=True)
        except subprocess.CalledProcessError as exc:  # pragma: no cover - depends on host toolchain
            raise ScopeMediaUnavailable('Failed to build scope_media native library.') from exc
        if not output.exists():
            raise ScopeMediaUnavailable(f'Compiled scope_media library not found at {output}')
    return _configured_library(str(output))


def is_available() -> bool:
    try:
        load_library()
        return True
    except ScopeMediaUnavailable:
        return False


def status_name(status: int) -> str:
    output = library_path()
    if output.exists():
        try:
            value = _configured_library(str(output)).scope_media_status_name(status)
            if value:
                return value.decode('ascii')
        except OSError:  # pragma: no cover - depends on dynamic loader state
            pass
    return STATUS_NAMES.get(status, 'unknown_status')


def _require_non_empty_payload(payload: bytes) -> bytes:
    if not payload:
        raise ValueError('payload must not be empty')
    return payload


def _byte_buffer(payload: bytes):
    return (ctypes.c_uint8 * len(payload)).from_buffer_copy(payload)


def _raise_for_status(operation: str, status: int) -> None:
    if status != STATUS_OK:
        raise ScopeMediaOperationError(operation, status)


def detect_format(payload: bytes) -> str | None:
    data = _require_non_empty_payload(payload)
    detected_format = ctypes.c_int(FORMAT_UNKNOWN)
    status = load_library().scope_media_detect_format(_byte_buffer(data), len(data), ctypes.byref(detected_format))
    if status == STATUS_UNSUPPORTED_FORMAT:
        return None
    _raise_for_status('detect_format', status)
    return FORMAT_NAMES.get(detected_format.value)


def strip_exif(payload: bytes) -> bytes:
    data = _require_non_empty_payload(payload)
    output = ScopeMediaBuffer()
    library = load_library()
    status = library.scope_media_strip_exif(_byte_buffer(data), len(data), ctypes.byref(output))
    try:
        _raise_for_status('strip_exif', status)
        return ctypes.string_at(output.data, output.length) if bool(output.data) else b''
    finally:
        if bool(output.data):
            library.scope_media_free_buffer(ctypes.byref(output))


def generate_thumbnail_pixels(
    pixels: bytes,
    *,
    width: int,
    height: int,
    channels: int,
    max_width: int,
    max_height: int,
    output_channels: int = 0,
) -> ThumbnailResult:
    payload = _require_non_empty_payload(pixels)
    library = load_library()
    input_pixels = _byte_buffer(payload)
    input_image = ScopeMediaImage(
        width=width,
        height=height,
        channels=channels,
        pixels=ctypes.cast(input_pixels, ctypes.POINTER(ctypes.c_uint8)),
        length=len(payload),
    )
    options = ScopeMediaThumbnailOptions(
        max_width=max_width,
        max_height=max_height,
        channels=output_channels,
    )
    output_image = ScopeMediaImage()
    status = library.scope_media_generate_thumbnail(ctypes.byref(input_image), ctypes.byref(options), ctypes.byref(output_image))
    try:
        _raise_for_status('generate_thumbnail_pixels', status)
        width_value = int(output_image.width)
        height_value = int(output_image.height)
        channels_value = int(output_image.channels)
        thumbnail_bytes = ctypes.string_at(output_image.pixels, output_image.length) if bool(output_image.pixels) else b''
        return ThumbnailResult(
            width=width_value,
            height=height_value,
            channels=channels_value,
            pixels=thumbnail_bytes,
        )
    finally:
        if bool(output_image.pixels):
            library.scope_media_free_image(ctypes.byref(output_image))


def expected_blurhash_length(components_x: int, components_y: int) -> int:
    return 4 + (2 * components_x * components_y)


def encode_blurhash_pixels(
    pixels: bytes,
    *,
    width: int,
    height: int,
    channels: int,
    components_x: int,
    components_y: int,
) -> str:
    payload = _require_non_empty_payload(pixels)
    library = load_library()
    input_pixels = _byte_buffer(payload)
    image = ScopeMediaImage(
        width=width,
        height=height,
        channels=channels,
        pixels=ctypes.cast(input_pixels, ctypes.POINTER(ctypes.c_uint8)),
        length=len(payload),
    )
    output = ctypes.create_string_buffer(expected_blurhash_length(components_x, components_y) + 1)
    status = library.scope_media_encode_blurhash(
        ctypes.byref(image),
        components_x,
        components_y,
        output,
        ctypes.sizeof(output),
    )
    _raise_for_status('encode_blurhash_pixels', status)
    return output.value.decode('ascii')
