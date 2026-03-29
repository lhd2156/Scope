from typing import Any
from flask import jsonify


def success_response(data: Any, status_code: int = 200):
    return jsonify({"data": data}), status_code


def error_response(
    status_code: int,
    code: str,
    message: str,
    details: list[dict[str, str]] | None = None,
    trace_id: str | None = None,
    headers: dict[str, str] | None = None,
):
    response = jsonify({"error": {"code": code, "message": message, "details": details or [], "traceId": trace_id}})
    response.status_code = status_code
    if headers:
        response.headers.update(headers)
    return response
