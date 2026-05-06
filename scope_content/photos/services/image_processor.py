from __future__ import annotations

import importlib.util
import sys
from dataclasses import dataclass
from functools import lru_cache
from io import BytesIO
from pathlib import Path
from types import ModuleType

try:
    from PIL import Image, ImageOps
except ModuleNotFoundError:  # pragma: no cover - environment-dependent fallback
    Image = None
    ImageOps = None

FORMAT_EXTENSIONS = {
    'jpeg': '.jpg',
    'png': '.png',
    'webp': '.webp',
    'gif': '.gif',
}
FORMAT_CONTENT_TYPES = {
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'webp': 'image/webp',
    'gif': 'image/gif',
}
ORIENTATION_TAG = 274
DEFAULT_THUMBNAIL_SIZE = (512, 512)
SCOPE_MEDIA_BINDINGS_PATH = Path(__file__).resolve().parents[3] / 'scope_media' / 'python_bindings.py'


@dataclass(frozen=True)
class PreparedImageUpload:
    original_bytes: bytes
    original_extension: str
    original_content_type: str
    thumbnail_bytes: bytes
    thumbnail_extension: str
    thumbnail_content_type: str
    detected_format: str | None
    blurhash: str | None = None


@dataclass(frozen=True)
class _NativeImagePayload:
    mode: str
    width: int
    height: int
    channels: int
    pixels: bytes


@lru_cache(maxsize=1)
def _native_bindings() -> ModuleType | None:
    if not SCOPE_MEDIA_BINDINGS_PATH.exists():
        return None

    spec = importlib.util.spec_from_file_location('scope_media_python_bindings', SCOPE_MEDIA_BINDINGS_PATH)
    if spec is None or spec.loader is None:
        return None

    module = importlib.util.module_from_spec(spec)
    sys.modules.setdefault(spec.name, module)
    spec.loader.exec_module(module)
    try:
        return module if module.is_available() else None
    except Exception:  # pragma: no cover - depends on host compiler/runtime state
        return None


def _normalize_format_name(name: str | None) -> str | None:
    if not name:
        return None
    normalized = name.strip().lower()
    if normalized in ('jpg', 'jpeg'):
        return 'jpeg'
    if normalized in ('png', 'webp', 'gif'):
        return normalized
    return None


def _resolve_extension(file_name: str | None, detected_format: str | None) -> str:
    normalized_format = _normalize_format_name(detected_format)
    if normalized_format is not None:
        return FORMAT_EXTENSIONS[normalized_format]

    suffix = Path(file_name or '').suffix.lower()
    if suffix in ('.jpg', '.jpeg'):
        return '.jpg'
    if suffix in FORMAT_EXTENSIONS.values():
        return suffix
    return '.jpg'


def _resolve_content_type(content_type: str | None, detected_format: str | None, extension: str) -> str:
    normalized_format = _normalize_format_name(detected_format)
    if normalized_format is not None:
        return FORMAT_CONTENT_TYPES[normalized_format]

    normalized_type = (content_type or '').strip().lower()
    if normalized_type in FORMAT_CONTENT_TYPES.values():
        return normalized_type

    extension_map = {
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.gif': 'image/gif',
        '.webp': 'image/webp',
    }
    return extension_map.get(extension, 'image/jpeg')


def _thumbnail_format(source_format: str | None) -> str:
    return _normalize_format_name(source_format) or 'png'


def _save_image_bytes(image, format_name: str) -> bytes:
    output = BytesIO()
    normalized_format = _thumbnail_format(format_name)
    save_format = 'JPEG' if normalized_format == 'jpeg' else normalized_format.upper()
    image_to_save = image
    if save_format == 'JPEG' and image.mode not in ('L', 'RGB'):
        image_to_save = image.convert('RGB')
    image_to_save.save(output, format=save_format)
    return output.getvalue()


def _prepare_native_image(image) -> _NativeImagePayload:
    if image.mode == 'L':
        prepared = image
        channels = 1
    elif image.mode == 'LA':
        prepared = image
        channels = 2
    elif image.mode == 'RGB':
        prepared = image
        channels = 3
    elif image.mode == 'RGBA':
        prepared = image
        channels = 4
    else:
        prepared = image.convert('RGBA')
        channels = 4

    return _NativeImagePayload(
        mode=prepared.mode,
        width=prepared.width,
        height=prepared.height,
        channels=channels,
        pixels=prepared.tobytes(),
    )


def _encode_blurhash(image, bindings: ModuleType) -> str | None:
    try:
        payload = _prepare_native_image(image)
        return bindings.encode_blurhash_pixels(
            payload.pixels,
            width=payload.width,
            height=payload.height,
            channels=payload.channels,
            components_x=max(1, min(4, payload.width)),
            components_y=max(1, min(3, payload.height)),
        )
    except Exception:  # pragma: no cover - graceful degradation path
        return None


def _generate_native_thumbnail(image, size: tuple[int, int], source_format: str | None, bindings: ModuleType) -> tuple[bytes, str, str]:
    payload = _prepare_native_image(image)
    result = bindings.generate_thumbnail_pixels(
        payload.pixels,
        width=payload.width,
        height=payload.height,
        channels=payload.channels,
        max_width=size[0],
        max_height=size[1],
    )
    thumbnail_image = Image.frombytes(payload.mode, (result.width, result.height), result.pixels)
    format_name = _thumbnail_format(source_format)
    extension = FORMAT_EXTENSIONS[format_name]
    content_type = FORMAT_CONTENT_TYPES[format_name]
    return _save_image_bytes(thumbnail_image, format_name), extension, content_type


def _generate_pillow_thumbnail(image, size: tuple[int, int], source_format: str | None) -> tuple[bytes, str, str]:
    thumbnail = image.copy()
    thumbnail.thumbnail(size)
    format_name = _thumbnail_format(source_format)
    extension = FORMAT_EXTENSIONS[format_name]
    content_type = FORMAT_CONTENT_TYPES[format_name]
    return _save_image_bytes(thumbnail, format_name), extension, content_type


def _jpeg_orientation_value(image) -> int:
    try:
        return int(image.getexif().get(ORIENTATION_TAG, 1))
    except Exception:  # pragma: no cover - metadata parsing fallback
        return 1


def process_uploaded_image(uploaded_file, size: tuple[int, int] = DEFAULT_THUMBNAIL_SIZE) -> PreparedImageUpload:
    if hasattr(uploaded_file, 'seek'):
        uploaded_file.seek(0)
    raw_bytes = uploaded_file.read()
    if hasattr(uploaded_file, 'seek'):
        uploaded_file.seek(0)

    bindings = _native_bindings()
    detected_format = None
    if bindings is not None:
        try:
            detected_format = bindings.detect_format(raw_bytes)
        except Exception:  # pragma: no cover - graceful degradation path
            detected_format = None

    extension = _resolve_extension(getattr(uploaded_file, 'name', None), detected_format)
    content_type = _resolve_content_type(getattr(uploaded_file, 'content_type', None), detected_format, extension)

    if Image is None:
        return PreparedImageUpload(
            original_bytes=raw_bytes,
            original_extension=extension,
            original_content_type=content_type,
            thumbnail_bytes=raw_bytes,
            thumbnail_extension=extension,
            thumbnail_content_type=content_type,
            detected_format=detected_format,
            blurhash=None,
        )

    with Image.open(BytesIO(raw_bytes)) as source_image:
        detected_format = detected_format or _normalize_format_name(source_image.format)
        extension = _resolve_extension(getattr(uploaded_file, 'name', None), detected_format)
        content_type = _resolve_content_type(getattr(uploaded_file, 'content_type', None), detected_format, extension)
        orientation = _jpeg_orientation_value(source_image)
        working_image = (ImageOps.exif_transpose(source_image) if ImageOps is not None else source_image).copy()

    original_bytes = raw_bytes
    if detected_format == 'jpeg':
        if bindings is not None and orientation == 1:
            try:
                original_bytes = bindings.strip_exif(raw_bytes)
            except Exception:  # pragma: no cover - graceful degradation path
                original_bytes = _save_image_bytes(working_image, 'jpeg')
        else:
            original_bytes = _save_image_bytes(working_image, 'jpeg')
    elif detected_format in {'png', 'webp', 'gif'} and orientation != 1:
        original_bytes = _save_image_bytes(working_image, detected_format)

    if bindings is not None:
        try:
            thumbnail_bytes, thumbnail_extension, thumbnail_content_type = _generate_native_thumbnail(
                working_image,
                size,
                detected_format,
                bindings,
            )
        except Exception:  # pragma: no cover - graceful degradation path
            thumbnail_bytes, thumbnail_extension, thumbnail_content_type = _generate_pillow_thumbnail(
                working_image,
                size,
                detected_format,
            )
        blurhash = _encode_blurhash(working_image, bindings)
    else:
        thumbnail_bytes, thumbnail_extension, thumbnail_content_type = _generate_pillow_thumbnail(
            working_image,
            size,
            detected_format,
        )
        blurhash = None

    return PreparedImageUpload(
        original_bytes=original_bytes,
        original_extension=extension,
        original_content_type=content_type,
        thumbnail_bytes=thumbnail_bytes,
        thumbnail_extension=thumbnail_extension,
        thumbnail_content_type=thumbnail_content_type,
        detected_format=detected_format,
        blurhash=blurhash,
    )


def generate_thumbnail(source_path: Path, dest_path: Path, size=(512, 512)) -> None:
    with source_path.open('rb') as source_file:
        payload = process_uploaded_image(source_file, size=size)
    dest_path.parent.mkdir(parents=True, exist_ok=True)
    dest_path.write_bytes(payload.thumbnail_bytes)
