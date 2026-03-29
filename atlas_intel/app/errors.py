from flask import Flask, g
from marshmallow import ValidationError
from werkzeug.exceptions import BadRequest, BadRequestKeyError, HTTPException
from app.responses import error_response


HTTP_ERROR_CODES: dict[int, tuple[str, str]] = {
    400: ("VALIDATION_ERROR", "Invalid input data"),
    401: ("UNAUTHORIZED", "Missing or expired token"),
    403: ("FORBIDDEN", "Insufficient permissions"),
    404: ("NOT_FOUND", "Resource does not exist"),
    405: ("METHOD_NOT_ALLOWED", "Method not allowed"),
    409: ("CONFLICT", "Duplicate resource"),
    422: ("UNPROCESSABLE", "Business rule violation"),
    429: ("RATE_LIMITED", "Too many requests"),
}


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

    @app.errorhandler(BadRequestKeyError)
    def handle_bad_request_key_error(error: BadRequestKeyError):
        missing_field = str(error.args[0]).strip("'\"") if error.args else "_schema"
        details = [{"field": missing_field, "message": "Missing required query parameter"}]
        return error_response(400, "VALIDATION_ERROR", "Invalid input data", details, getattr(g, "trace_id", None))

    @app.errorhandler(BadRequest)
    def handle_bad_request(error: BadRequest):
        details = [{"field": "_schema", "message": error.description}] if error.description else []
        return error_response(400, "VALIDATION_ERROR", "Invalid input data", details, getattr(g, "trace_id", None))

    @app.errorhandler(ValueError)
    def handle_value_error(error: ValueError):
        details = [{"field": "_schema", "message": str(error)}] if str(error) else []
        return error_response(400, "VALIDATION_ERROR", "Invalid input data", details, getattr(g, "trace_id", None))

    @app.errorhandler(404)
    def handle_not_found(_error):
        return error_response(404, "NOT_FOUND", "Resource does not exist", trace_id=getattr(g, "trace_id", None))

    @app.errorhandler(HTTPException)
    def handle_http_exception(error: HTTPException):
        status_code = error.code or 500
        code, message = HTTP_ERROR_CODES.get(status_code, ("VALIDATION_ERROR", error.description or "Invalid input data"))
        return error_response(status_code, code, message, trace_id=getattr(g, "trace_id", None))

    @app.errorhandler(Exception)
    def handle_exception(error: Exception):
        app.logger.exception("unhandled_exception", extra={"correlation_id": getattr(g, "trace_id", None)})
        return error_response(500, "INTERNAL_ERROR", "Unexpected server error", trace_id=getattr(g, "trace_id", None))
