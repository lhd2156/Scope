from __future__ import annotations

from collections.abc import Mapping


def copy_with_aliases(data, aliases: Mapping[str, str]):
    """Return a mutable serializer payload copy with fallback key aliases applied."""
    if not hasattr(data, 'copy'):
        return data

    normalized = data.copy()
    for source_key, target_key in aliases.items():
        if source_key in normalized and target_key not in normalized:
            normalized[target_key] = normalized[source_key]
    return normalized


def normalize_text(value: str) -> str:
    return value.strip()
