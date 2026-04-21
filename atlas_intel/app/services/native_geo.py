from __future__ import annotations

import sys
from functools import lru_cache
from pathlib import Path
from types import ModuleType


def _repo_root() -> Path:
    return Path(__file__).resolve().parents[3]


def _ensure_repo_root_on_path() -> None:
    repo_root = str(_repo_root())
    if repo_root not in sys.path:
        sys.path.insert(0, repo_root)


@lru_cache(maxsize=1)
def get_native_geo() -> ModuleType | None:
    _ensure_repo_root_on_path()

    try:
        import atlas_geo
    except (ImportError, ModuleNotFoundError):
        return None

    return atlas_geo


def native_geo_available() -> bool:
    return get_native_geo() is not None
