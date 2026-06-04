from __future__ import annotations

import json
import os
import tempfile
import threading
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from flask import current_app


_usage_lock = threading.Lock()


class GooglePlacesUsageGuard:
    def consume(self, sku: str, monthly_cap: int, units: int = 1) -> dict[str, Any]:
        normalized_cap = int(monthly_cap)
        normalized_units = max(int(units), 1)

        if normalized_cap < 0:
            return {
                "allowed": True,
                "sku": sku,
                "used": 0,
                "cap": normalized_cap,
                "remaining": None,
            }

        with _usage_lock:
            usage = self._read_usage()
            counters = usage.setdefault("counters", {})
            used = int(counters.get(sku, 0))
            remaining = normalized_cap - used
            if remaining < normalized_units:
                return {
                    "allowed": False,
                    "sku": sku,
                    "used": used,
                    "cap": normalized_cap,
                    "remaining": max(remaining, 0),
                }

            counters[sku] = used + normalized_units
            self._write_usage(usage)
            return {
                "allowed": True,
                "sku": sku,
                "used": counters[sku],
                "cap": normalized_cap,
                "remaining": max(normalized_cap - counters[sku], 0),
            }

    def _read_usage(self) -> dict[str, Any]:
        usage_path = self._usage_path()
        current_month = self._current_month()
        try:
            payload = json.loads(usage_path.read_text(encoding="utf-8")) if usage_path.exists() else {}
        except (OSError, json.JSONDecodeError):
            payload = {}

        if payload.get("month") != current_month or not isinstance(payload.get("counters"), dict):
            return {"month": current_month, "counters": {}}

        return payload

    def _write_usage(self, payload: dict[str, Any]) -> None:
        usage_path = self._usage_path()
        usage_path.parent.mkdir(parents=True, exist_ok=True)
        fd, temp_name = tempfile.mkstemp(prefix=f"{usage_path.name}.", dir=str(usage_path.parent), text=True)
        try:
            with os.fdopen(fd, "w", encoding="utf-8") as temp_file:
                json.dump(payload, temp_file, sort_keys=True)
            os.replace(temp_name, usage_path)
        finally:
            if os.path.exists(temp_name):
                os.unlink(temp_name)

    @staticmethod
    def _current_month() -> str:
        return datetime.now(UTC).strftime("%Y-%m")

    @staticmethod
    def _usage_path() -> Path:
        configured_path = current_app.config.get("GOOGLE_PLACES_USAGE_FILE")
        if configured_path:
            return Path(str(configured_path))

        return Path(current_app.instance_path) / "google_places_usage.json"
