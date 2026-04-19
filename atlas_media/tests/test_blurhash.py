from __future__ import annotations

import ctypes
import math
import shutil
import subprocess
import sys
from pathlib import Path

import pytest

ATLAS_MEDIA_ROOT = Path(__file__).resolve().parents[1]
BUILD_SCRIPT = ATLAS_MEDIA_ROOT / 'build.py'
BUILD_DIR = ATLAS_MEDIA_ROOT / 'build'
BASE83_ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz#$%*+,-.:;=?@[]^_{|}~'
STATUS_OK = 0
STATUS_INVALID_ARGUMENT = 1


class AtlasMediaImage(ctypes.Structure):
    _fields_ = [
        ('width', ctypes.c_uint32),
        ('height', ctypes.c_uint32),
        ('channels', ctypes.c_uint8),
        ('pixels', ctypes.POINTER(ctypes.c_uint8)),
        ('length', ctypes.c_size_t),
    ]


@pytest.fixture(scope='session')
def compiled_library() -> ctypes.CDLL:
    if shutil.which('cl') is None and shutil.which('gcc') is None:
        pytest.skip('No C compiler found in PATH, skipping native atlas_media blurhash tests.')

    subprocess.run([sys.executable, str(BUILD_SCRIPT)], cwd=ATLAS_MEDIA_ROOT, check=True)
    library_name = 'atlas_media.dll' if sys.platform.startswith('win') else 'libatlas_media.so'
    library_path = BUILD_DIR / library_name
    assert library_path.exists(), f'Expected compiled library at {library_path}'

    library = ctypes.CDLL(str(library_path))
    library.atlas_media_encode_blurhash.argtypes = [
        ctypes.POINTER(AtlasMediaImage),
        ctypes.c_uint32,
        ctypes.c_uint32,
        ctypes.POINTER(ctypes.c_char),
        ctypes.c_size_t,
    ]
    library.atlas_media_encode_blurhash.restype = ctypes.c_int
    return library


def _expected_blurhash_length(components_x: int, components_y: int) -> int:
    return 4 + (2 * components_x * components_y)


def _encode83(value: int, length: int) -> str:
    encoded = []
    for index in range(length):
        divisor = 83 ** (length - index - 1)
        encoded.append(BASE83_ALPHABET[(value // divisor) % 83])
    return ''.join(encoded)


def _srgb_to_linear(value: int) -> float:
    normalized = value / 255.0
    if normalized <= 0.04045:
        return normalized / 12.92
    return ((normalized + 0.055) / 1.055) ** 2.4


def _linear_to_srgb(value: float) -> int:
    clamped = max(0.0, min(1.0, value))
    if clamped <= 0.0031308:
        return int(clamped * 12.92 * 255 + 0.5)
    return int((1.055 * (clamped ** (1 / 2.4)) - 0.055) * 255 + 0.5)


def _sign_pow(value: float, exponent: float) -> float:
    return math.copysign(abs(value) ** exponent, value)


def _linear_pixel(payload: bytes, offset: int, channels: int) -> tuple[float, float, float]:
    if channels == 1:
        gray = _srgb_to_linear(payload[offset])
        return gray, gray, gray

    if channels == 2:
        gray = _srgb_to_linear(payload[offset])
        alpha = payload[offset + 1] / 255.0
        flattened = (gray * alpha) + (1.0 - alpha)
        return flattened, flattened, flattened

    if channels == 3:
        return (
            _srgb_to_linear(payload[offset]),
            _srgb_to_linear(payload[offset + 1]),
            _srgb_to_linear(payload[offset + 2]),
        )

    alpha = payload[offset + 3] / 255.0
    return (
        (_srgb_to_linear(payload[offset]) * alpha) + (1.0 - alpha),
        (_srgb_to_linear(payload[offset + 1]) * alpha) + (1.0 - alpha),
        (_srgb_to_linear(payload[offset + 2]) * alpha) + (1.0 - alpha),
    )


def _multiply_basis(
    payload: bytes,
    width: int,
    height: int,
    channels: int,
    component_x: int,
    component_y: int,
) -> tuple[float, float, float]:
    normalization = 1.0 if component_x == 0 and component_y == 0 else 2.0
    red = 0.0
    green = 0.0
    blue = 0.0

    for y in range(height):
        basis_y = math.cos(math.pi * component_y * y / height)
        for x in range(width):
            offset = ((y * width) + x) * channels
            basis = normalization * math.cos(math.pi * component_x * x / width) * basis_y
            pixel_red, pixel_green, pixel_blue = _linear_pixel(payload, offset, channels)
            red += basis * pixel_red
            green += basis * pixel_green
            blue += basis * pixel_blue

    scale = 1.0 / (width * height)
    return red * scale, green * scale, blue * scale


def _encode_dc(factor: tuple[float, float, float]) -> int:
    red = _linear_to_srgb(factor[0])
    green = _linear_to_srgb(factor[1])
    blue = _linear_to_srgb(factor[2])
    return (red << 16) + (green << 8) + blue


def _encode_ac(factor: tuple[float, float, float], maximum_value: float) -> int:
    quantized_red = max(0, min(18, math.floor(_sign_pow(factor[0] / maximum_value, 0.5) * 9 + 9.5)))
    quantized_green = max(0, min(18, math.floor(_sign_pow(factor[1] / maximum_value, 0.5) * 9 + 9.5)))
    quantized_blue = max(0, min(18, math.floor(_sign_pow(factor[2] / maximum_value, 0.5) * 9 + 9.5)))
    return (quantized_red * 19 * 19) + (quantized_green * 19) + quantized_blue


def _reference_blurhash(
    payload: bytes,
    width: int,
    height: int,
    channels: int,
    components_x: int,
    components_y: int,
) -> str:
    factors = [
        _multiply_basis(payload, width, height, channels, component_x, component_y)
        for component_y in range(components_y)
        for component_x in range(components_x)
    ]
    dc = factors[0]
    ac = factors[1:]

    blurhash = _encode83((components_x - 1) + ((components_y - 1) * 9), 1)
    if ac:
        actual_maximum = max(max(abs(red), abs(green), abs(blue)) for red, green, blue in ac)
        quantized_maximum = max(0, min(82, math.floor(actual_maximum * 166 - 0.5)))
        maximum_value = (quantized_maximum + 1) / 166
        blurhash += _encode83(quantized_maximum, 1)
    else:
        maximum_value = 1.0
        blurhash += _encode83(0, 1)

    blurhash += _encode83(_encode_dc(dc), 4)
    for factor in ac:
        blurhash += _encode83(_encode_ac(factor, maximum_value), 2)

    return blurhash


def _call_blurhash(
    library: ctypes.CDLL,
    payload: bytes,
    width: int,
    height: int,
    channels: int,
    components_x: int,
    components_y: int,
    buffer_size: int | None = None,
) -> tuple[int, str]:
    input_buffer = (ctypes.c_uint8 * len(payload)).from_buffer_copy(payload)
    image = AtlasMediaImage(
        width=width,
        height=height,
        channels=channels,
        pixels=ctypes.cast(input_buffer, ctypes.POINTER(ctypes.c_uint8)),
        length=len(payload),
    )
    output = ctypes.create_string_buffer(buffer_size or (_expected_blurhash_length(components_x, components_y) + 1))
    status = library.atlas_media_encode_blurhash(
        ctypes.byref(image),
        components_x,
        components_y,
        output,
        ctypes.sizeof(output),
    )
    return status, output.value.decode('ascii')


@pytest.mark.parametrize(
    ('payload', 'width', 'height', 'channels', 'components_x', 'components_y'),
    [
        (bytes([0, 64, 128, 255]), 2, 2, 1, 3, 2),
        (bytes([0, 0, 255, 255, 255, 255, 64, 128]), 2, 2, 2, 2, 2),
        (
            bytes([
                255, 0, 0,
                0, 255, 0,
                0, 0, 255,
                255, 255, 255,
            ]),
            2,
            2,
            3,
            2,
            2,
        ),
        (
            bytes([
                0, 0, 0, 0,
                255, 0, 0, 255,
                0, 255, 0, 128,
                0, 0, 255, 255,
            ]),
            2,
            2,
            4,
            3,
            2,
        ),
    ],
)
def test_encode_blurhash_matches_reference_encoder(
    compiled_library: ctypes.CDLL,
    payload: bytes,
    width: int,
    height: int,
    channels: int,
    components_x: int,
    components_y: int,
) -> None:
    status, blurhash = _call_blurhash(
        compiled_library,
        payload,
        width=width,
        height=height,
        channels=channels,
        components_x=components_x,
        components_y=components_y,
    )

    assert status == STATUS_OK
    assert blurhash == _reference_blurhash(payload, width, height, channels, components_x, components_y)
    assert len(blurhash) == _expected_blurhash_length(components_x, components_y)


def test_encode_blurhash_supports_single_component_hashes(compiled_library: ctypes.CDLL) -> None:
    payload = bytes([12, 34, 56])

    status, blurhash = _call_blurhash(
        compiled_library,
        payload,
        width=1,
        height=1,
        channels=3,
        components_x=1,
        components_y=1,
    )

    assert status == STATUS_OK
    assert blurhash == _reference_blurhash(payload, 1, 1, 3, 1, 1)
    assert len(blurhash) == 6


def test_encode_blurhash_rejects_invalid_arguments(compiled_library: ctypes.CDLL) -> None:
    payload = bytes([
        255, 0, 0,
        0, 255, 0,
        0, 0, 255,
        255, 255, 255,
    ])
    input_buffer = (ctypes.c_uint8 * len(payload)).from_buffer_copy(payload)
    image = AtlasMediaImage(
        width=2,
        height=2,
        channels=3,
        pixels=ctypes.cast(input_buffer, ctypes.POINTER(ctypes.c_uint8)),
        length=len(payload),
    )
    output = ctypes.create_string_buffer(_expected_blurhash_length(2, 2) + 1)

    assert compiled_library.atlas_media_encode_blurhash(None, 2, 2, output, ctypes.sizeof(output)) == STATUS_INVALID_ARGUMENT
    assert compiled_library.atlas_media_encode_blurhash(ctypes.byref(image), 0, 2, output, ctypes.sizeof(output)) == STATUS_INVALID_ARGUMENT
    assert compiled_library.atlas_media_encode_blurhash(ctypes.byref(image), 2, 0, output, ctypes.sizeof(output)) == STATUS_INVALID_ARGUMENT
    assert compiled_library.atlas_media_encode_blurhash(ctypes.byref(image), 10, 2, output, ctypes.sizeof(output)) == STATUS_INVALID_ARGUMENT
    assert compiled_library.atlas_media_encode_blurhash(ctypes.byref(image), 2, 10, output, ctypes.sizeof(output)) == STATUS_INVALID_ARGUMENT
    assert compiled_library.atlas_media_encode_blurhash(ctypes.byref(image), 2, 2, None, ctypes.sizeof(output)) == STATUS_INVALID_ARGUMENT

    too_short_output = ctypes.create_string_buffer(_expected_blurhash_length(2, 2))
    assert compiled_library.atlas_media_encode_blurhash(
        ctypes.byref(image),
        2,
        2,
        too_short_output,
        ctypes.sizeof(too_short_output),
    ) == STATUS_INVALID_ARGUMENT
    assert too_short_output.value == b''
