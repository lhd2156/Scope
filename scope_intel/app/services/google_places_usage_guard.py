from __future__ import annotations

import json
import logging
import os
import tempfile
import threading
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from flask import current_app


_usage_lock = threading.Lock()
_redis_lock = threading.Lock()
_redis_clients: dict[str, Any] = {}
logger = logging.getLogger(__name__)

_REDIS_CONSUME_SCRIPT = """
local used = tonumber(redis.call('GET', KEYS[1]) or '0')
local units = tonumber(ARGV[1])
local cap = tonumber(ARGV[2])
if used + units > cap then
  return {0, used}
end
local updated = redis.call('INCRBY', KEYS[1], units)
if updated == units then
  redis.call('EXPIRE', KEYS[1], tonumber(ARGV[3]))
end
return {1, updated}
"""
_REDIS_TTL_SECONDS = 63 * 24 * 60 * 60


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

        redis_url = str(current_app.config.get("GOOGLE_PLACES_USAGE_REDIS_URL") or "").strip()
        if redis_url:
            return self._consume_redis(redis_url, sku, normalized_cap, normalized_units)

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
            try:
                self._write_usage(usage)
            except OSError:
                logger.exception("Google Places usage ledger could not be persisted")
                return self._unavailable(sku, normalized_cap, used)
            return {
                "allowed": True,
                "sku": sku,
                "used": counters[sku],
                "cap": normalized_cap,
                "remaining": max(normalized_cap - counters[sku], 0),
            }

    def _consume_redis(self, redis_url: str, sku: str, cap: int, units: int) -> dict[str, Any]:
        try:
            client = _redis_client_for(redis_url)
            allowed, used = client.eval(
                _REDIS_CONSUME_SCRIPT,
                1,
                f"scope:intel:google-places-usage:{self._current_month()}:{sku}",
                units,
                cap,
                _REDIS_TTL_SECONDS,
            )
            normalized_used = int(used)
            return {
                "allowed": bool(allowed),
                "sku": sku,
                "used": normalized_used,
                "cap": cap,
                "remaining": max(cap - normalized_used, 0),
            }
        except Exception:
            logger.exception("Google Places Redis usage ledger is unavailable")
            return self._unavailable(sku, cap, 0)

    @staticmethod
    def _unavailable(sku: str, cap: int, used: int) -> dict[str, Any]:
        return {
            "allowed": False,
            "sku": sku,
            "used": used,
            "cap": cap,
            "remaining": 0,
            "reason": "usage_store_unavailable",
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


def _redis_client_for(redis_url: str):
    with _redis_lock:
        client = _redis_clients.get(redis_url)
        if client is None:
            import redis

            client = redis.from_url(
                redis_url,
                socket_connect_timeout=1,
                socket_timeout=2,
                health_check_interval=30,
            )
            _redis_clients[redis_url] = client
        return client
