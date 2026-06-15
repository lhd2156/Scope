from __future__ import annotations

import importlib
import os
import sys
from pathlib import Path

BUILD_CONFIGURATIONS = ("Debug", "Release", "RelWithDebInfo", "MinSizeRel")


def _build_output_candidates(build_dir: Path) -> list[Path]:
    return [
        build_dir / "python",
        *[build_dir / "python" / configuration for configuration in BUILD_CONFIGURATIONS],
        build_dir,
        *[build_dir / configuration for configuration in BUILD_CONFIGURATIONS],
    ]


def _candidate_paths() -> list[Path]:
    package_dir = Path(__file__).resolve().parent
    configured_build_directories = [
        Path(path).expanduser()
        for path in os.environ.get("SCOPE_GEO_BUILD_DIR", "").split(os.pathsep)
        if path
    ]
    build_directories = [
        *configured_build_directories,
        package_dir / "build",
        package_dir.parent / "build",
    ]

    candidates = [package_dir]
    for build_dir in build_directories:
        candidates.extend(_build_output_candidates(build_dir))

    return candidates


_dll_directory_handles: list[object] = []


def _prepare_windows_dll_search_paths() -> None:
    if sys.platform != "win32" or not hasattr(os, "add_dll_directory"):
        return

    seen_paths: set[str] = set()
    candidate_directories = _candidate_paths()
    candidate_directories.extend(Path(path) for path in os.environ.get("PATH", "").split(os.pathsep) if path)

    for candidate in candidate_directories:
        if not candidate.is_dir():
            continue

        candidate_str = str(candidate)
        if candidate_str in seen_paths:
            continue

        seen_paths.add(candidate_str)
        try:
            _dll_directory_handles.append(os.add_dll_directory(candidate_str))
        except OSError:
            continue


def _load_native_module():
    _prepare_windows_dll_search_paths()

    for candidate in _candidate_paths():
        if candidate.is_dir():
            candidate_str = str(candidate)
            if candidate_str not in sys.path:
                sys.path.insert(0, candidate_str)

        try:
            return importlib.import_module("_scope_geo")
        except ModuleNotFoundError:
            continue

    raise ModuleNotFoundError(
        "scope_geo native extension '_scope_geo' is not built. "
        "Run the CMake build for scope_geo before importing this package."
    )


_native = _load_native_module()

__all__ = [name for name in dir(_native) if not name.startswith("_")]
globals().update({name: getattr(_native, name) for name in __all__})
__version__ = getattr(_native, "__version__", _native.version())
