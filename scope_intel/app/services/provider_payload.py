from __future__ import annotations

from typing import Any


def normalize_provider_text(value: Any, max_length: int) -> str:
    return " ".join(str(value or "").split()).strip()[:max_length]


def safe_provider_coordinate(value: Any) -> float | None:
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None

    return number if -180 <= number <= 180 else None
