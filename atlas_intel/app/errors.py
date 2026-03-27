from flask import Flask, g
from marshmallow import ValidationError
from app.responses import error_response


def register_error_handlers(app: Flask) -> None:
    @app.errorhandler(ValidationError)
    def handle_validation_error(error: ValidationError):
        details = [{"field": key, "message": ", ".join(value)} for key, value in error.messages.items()]
        return error_response(400, "VALIDATION_ERROR", "Invalid input data", details, getattr(g, "trace_id", None))

    @app.errorhandler(404)
    def handle_not_found(_error):
        return error_response(404, "NOT_FOUND", "Resource does not exist", trace_id=getattr(g, "trace_id", None))

    @app.errorhandler(Exception)
    def handle_exception(error: Exception):
        app.logger.exception("unhandled_exception", extra={"correlation_id": getattr(g, "trace_id", None)})
        return error_response(500, "INTERNAL_ERROR", "Unexpected server error", trace_id=getattr(g, "trace_id", None))
