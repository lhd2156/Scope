from __future__ import annotations

import logging
from collections.abc import Callable
from concurrent.futures import ThreadPoolExecutor
from concurrent.futures import TimeoutError as FuturesTimeoutError
from typing import Any, TypeVar

from flask import current_app, has_app_context

logger = logging.getLogger(__name__)
_ML_EXECUTOR = ThreadPoolExecutor(max_workers=4, thread_name_prefix="scope-intel-ml")
ResultT = TypeVar("ResultT")


class MlComputationTimeoutError(TimeoutError):
    def __init__(self, operation: str, timeout_seconds: float) -> None:
        super().__init__(f"ML computation '{operation}' timed out after {timeout_seconds:.3f}s")
        self.operation = operation
        self.timeout_seconds = timeout_seconds


def run_ml_with_timeout(operation: str, fn: Callable[..., ResultT], *args: Any, **kwargs: Any) -> ResultT:
    timeout_seconds = float(current_app.config["ML_REQUEST_TIMEOUT_SECONDS"])

    # Flask's app context is thread-local. Worker threads from our executor
    # therefore can't read `current_app`, hit `db.session`, or run any code
    # that depends on Flask config (e.g. the recommendation engine's audit
    # write path or dismissal filter). Capture the real app instance here and
    # re-bind it inside the worker so ML functions keep the same runtime
    # guarantees as code running on the request thread.
    app = current_app._get_current_object()  # type: ignore[attr-defined]

    def _runner() -> ResultT:
        with app.app_context():
            return fn(*args, **kwargs)

    future = _ML_EXECUTOR.submit(_runner)
    try:
        return future.result(timeout=timeout_seconds)
    except FuturesTimeoutError as error:
        future.cancel()
        logger.warning(
            "ml_computation_timed_out",
            extra={"operation": operation, "timeout_seconds": timeout_seconds},
        )
        raise MlComputationTimeoutError(operation, timeout_seconds) from error


__all__ = ["run_ml_with_timeout", "MlComputationTimeoutError", "has_app_context"]
