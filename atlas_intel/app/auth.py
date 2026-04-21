from functools import wraps
from typing import Any, Callable, TypeVar
import jwt
from flask import current_app, g, request
from app.responses import error_response

RouteHandler = TypeVar("RouteHandler", bound=Callable[..., Any])


def require_auth(handler: RouteHandler) -> RouteHandler:
    @wraps(handler)
    def wrapper(*args: Any, **kwargs: Any):
        authorization = request.headers.get("Authorization", "")
        if not authorization.startswith("Bearer "):
            return error_response(401, "UNAUTHORIZED", "Missing or expired token", trace_id=getattr(g, "trace_id", None))
        token = authorization.replace("Bearer ", "", 1)
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

    setattr(wrapper, "_atlas_require_auth", True)
    return wrapper  # type: ignore[return-value]
