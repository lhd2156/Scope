from __future__ import annotations

from typing import Any

from marshmallow import ValidationError


def validate_required_text(value: Any, *, field_name: str, label: str, max_length: int) -> None:
    normalized = " ".join(str(value or "").split())
    if not normalized:
        raise ValidationError(f"{label} is required", field_name=field_name)
    if len(normalized) > max_length:
        raise ValidationError(f"{label} is too long", field_name=field_name)


def validate_latitude(value: Any, *, field_name: str = "latitude") -> None:
    if value is None or not -90 <= value <= 90:
        raise ValidationError("Latitude out of range", field_name=field_name)


def validate_longitude(value: Any, *, field_name: str = "longitude") -> None:
    if value is None or not -180 <= value <= 180:
        raise ValidationError("Longitude out of range", field_name=field_name)
