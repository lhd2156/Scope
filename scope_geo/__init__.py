from __future__ import annotations

import importlib
import os
import sys
from pathlib import Path


def _candidate_paths() -> list[Path]:
    package_dir = Path(__file__).resolve().parent
    build_directories = [
        package_dir / "build",
        package_dir.parent / "build",
    ]

    candidates = [package_dir]
    for build_dir in build_directories:
        candidates.extend(
            [
                build_dir / "python",
                build_dir / "python" / "Debug",
                build_dir / "python" / "Release",
                build_dir / "python" / "RelWithDebInfo",
                build_dir / "python" / "MinSizeRel",
                build_dir,
                build_dir / "Debug",
                build_dir / "Release",
                build_dir / "RelWithDebInfo",
                build_dir / "MinSizeRel",
            ]
        )

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
__version__ = getattr(_native, "__version__", version())
