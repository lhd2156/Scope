from __future__ import annotations

import ctypes
import os
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
BUILD_DIR = ROOT / "build"
EXPECTED_FILES = (
    ROOT / "Makefile",
    ROOT / "include" / "atlas_media.h",
    ROOT / "src" / "core.c",
    ROOT / "tests" / "native_smoke.c",
)
EXPECTED_VERSION = "0.1.0"
_DLL_DIR_HANDLE = None


def _library_candidates() -> tuple[Path, ...]:
    return (
        BUILD_DIR / "atlas_media.dll",
        BUILD_DIR / "libatlas_media.so",
        BUILD_DIR / "libatlas_media.dylib",
    )


def _load_library() -> ctypes.CDLL:
    global _DLL_DIR_HANDLE

    for candidate in _library_candidates():
        if not candidate.exists():
            continue

        if os.name == "nt" and hasattr(os, "add_dll_directory"):
            _DLL_DIR_HANDLE = os.add_dll_directory(str(candidate.parent))

        return ctypes.CDLL(str(candidate))

    available = ", ".join(str(path) for path in _library_candidates())
    raise AssertionError(f"No built atlas_media shared library found. Expected one of: {available}")


def test_scaffold_files_exist() -> None:
    missing = [str(path.relative_to(ROOT)) for path in EXPECTED_FILES if not path.exists()]
    assert not missing, f"Missing scaffold files: {missing}"


def test_public_header_declares_foundational_api() -> None:
    header = (ROOT / "include" / "atlas_media.h").read_text(encoding="utf-8")

    assert "ATLAS_MEDIA_VERSION_STRING" in header
    assert "atlas_media_version_string" in header
    assert "atlas_media_status_string" in header
    assert "atlas_media_image_format" in header


def test_compiled_library_reports_version_metadata() -> None:
    library = _load_library()
    library.atlas_media_version_string.restype = ctypes.c_char_p
    library.atlas_media_version_major.restype = ctypes.c_int
    library.atlas_media_version_minor.restype = ctypes.c_int
    library.atlas_media_version_patch.restype = ctypes.c_int
    library.atlas_media_status_string.argtypes = [ctypes.c_int]
    library.atlas_media_status_string.restype = ctypes.c_char_p

    assert library.atlas_media_version_string().decode("utf-8") == EXPECTED_VERSION
    assert library.atlas_media_version_major() == 0
    assert library.atlas_media_version_minor() == 1
    assert library.atlas_media_version_patch() == 0
    assert library.atlas_media_status_string(0).decode("utf-8") == "ok"
    assert library.atlas_media_status_string(5).decode("utf-8") == "not_implemented"
