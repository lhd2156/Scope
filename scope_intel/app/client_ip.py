from __future__ import annotations

import os
from ipaddress import ip_address, ip_network

from flask import current_app, request


def get_client_ip() -> str:
    remote_addr = request.remote_addr or "unknown"
    forwarded_for = request.headers.get("X-Forwarded-For", "")

    if forwarded_for and _is_trusted_proxy(remote_addr):
        candidate = forwarded_for.split(",", 1)[0].strip()
        try:
            ip_address(candidate)
            return candidate
        except ValueError:
            pass

    return remote_addr


def _is_trusted_proxy(remote_addr: str) -> bool:
    try:
        remote_ip = ip_address(remote_addr)
    except ValueError:
        return False

    raw_value = current_app.config.get("TRUSTED_PROXY_CIDRS") or os.getenv(
        "INTEL_TRUSTED_PROXY_CIDRS",
        "",
    )
    entries = raw_value.replace(";", ",").split(",") if isinstance(raw_value, str) else raw_value

    for entry in entries:
        value = str(entry).strip()
        if not value:
            continue
        try:
            if remote_ip in ip_network(value, strict=False):
                return True
        except ValueError:
            current_app.logger.warning(
                "Ignoring invalid Intel trusted proxy CIDR",
                extra={"cidr": value},
            )

    return False
