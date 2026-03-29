from flask import Flask, g
from marshmallow import ValidationError
from app.responses import error_response


def _join_path(prefix: str, key: str | int) -> str:
    if isinstance(key, int):
        return f"{prefix}[{key}]" if prefix else f"[{key}]"
    return f"{prefix}.{key}" if prefix else str(key)


def _flatten_validation_messages(messages, prefix: str = "") -> list[dict[str, str]]:
    if isinstance(messages, dict):
        details: list[dict[str, str]] = []
        for key, value in messages.items():
            details.extend(_flatten_validation_messages(value, _join_path(prefix, key)))
        return details

    if isinstance(messages, list):
        details: list[dict[str, str]] = []
        direct_messages: list[str] = []
        for value in messages:
            if isinstance(value, (dict, list)):
                details.extend(_flatten_validation_messages(value, prefix))
            else:
                direct_messages.append(str(value))
        if direct_messages:
            details.append({"field": prefix or "_schema", "message": ", ".join(direct_messages)})
        return details

    return [{"field": prefix or "_schema", "message": str(messages)}]


def register_error_handlers(app: Flask) -> None:
    @app.errorhandler(ValidationError)
    def handle_validation_error(error: ValidationError):
        details = _flatten_validation_messages(error.messages)
        return error_response(400, "VALIDATION_ERROR", "Invalid input data", details, getattr(g, "trace_id", None))

    @app.errorhandler(404)
    def handle_not_found(_error):
        return error_response(404, "NOT_FOUND", "Resource does not exist", trace_id=getattr(g, "trace_id", None))

    @app.errorhandler(Exception)
    def handle_exception(error: Exception):
        app.logger.exception("unhandled_exception", extra={"correlation_id": getattr(g, "trace_id", None)})
        return error_response(500, "INTERNAL_ERROR", "Unexpected server error", trace_id=getattr(g, "trace_id", None))
