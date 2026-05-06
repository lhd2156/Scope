from __future__ import annotations

WEATHER_CACHE_SECONDS = 300
GEOCODE_CACHE_SECONDS = 86400


def build_private_cache_headers(max_age_seconds: int) -> dict[str, str]:
    return {
        "Cache-Control": f"private, max-age={max_age_seconds}",
        "Vary": "Authorization",
    }
