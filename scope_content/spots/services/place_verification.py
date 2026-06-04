from __future__ import annotations

import os
from typing import Any

import requests


VERIFY_TIMEOUT_SECONDS = 5


def _intel_base_url() -> str:
    return (
        os.getenv('INTEL_SERVICE_URL')
        or os.getenv('SCOPE_INTEL_URL')
        or os.getenv('CONTENT_INTEL_URL')
        or 'http://intel:5000'
    ).rstrip('/')


def verify_spot_place(payload: dict[str, Any], authorization: str = '') -> dict[str, Any]:
    headers = {'Accept': 'application/json', 'Content-Type': 'application/json'}
    if authorization:
        headers['Authorization'] = authorization

    try:
        response = requests.post(
            f'{_intel_base_url()}/api/intel/place/verify',
            json=payload,
            headers=headers,
            timeout=VERIFY_TIMEOUT_SECONDS,
        )
        response.raise_for_status()
        body = response.json()
    except (requests.RequestException, ValueError):
        return {
            'verified': False,
            'reason': 'Place verification is unavailable right now. Try again in a moment.',
            'source': '',
            'candidates': [],
        }

    data = body.get('data') if isinstance(body, dict) and 'data' in body else body
    if not isinstance(data, dict):
        return {
            'verified': False,
            'reason': 'Place verification returned an unreadable response.',
            'source': '',
            'candidates': [],
        }

    return data
