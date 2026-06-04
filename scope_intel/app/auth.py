from collections.abc import Callable
from functools import wraps
from typing import Any, ParamSpec

import jwt
from flask import current_app, g, request

from app.responses import error_response

RouteParams = ParamSpec("RouteParams")


def extract_bearer_token(header_value: str | None) -> str | None:
    if not header_value:
        return None
    scheme, _, credentials = header_value.partition(" ")
    if scheme.lower() != "bearer" or not credentials.strip():
        return None
    return credentials.strip()


def require_auth(handler: Callable[RouteParams, Any]) -> Callable[RouteParams, Any]:
    @wraps(handler)
    def wrapper(*args: RouteParams.args, **kwargs: RouteParams.kwargs) -> Any:
        token = extract_bearer_token(request.headers.get("Authorization", ""))
        if token is None:
            return error_response(401, "UNAUTHORIZED", "Missing or expired token", trace_id=getattr(g, "trace_id", None))
        try:
            payload = jwt.decode(
                token,
                current_app.config["JWT_SECRET"],
                algorithms=["HS256"],
                audience=current_app.config["JWT_AUDIENCE"],
                issuer=current_app.config["JWT_ISSUER"],
            )
        except jwt.PyJWTError:
            return error_response(401, "UNAUTHORIZED", "Missing or expired token", trace_id=getattr(g, "trace_id", None))
        g.current_user = payload
        return handler(*args, **kwargs)

    wrapper._scope_require_auth = True
    return wrapper
