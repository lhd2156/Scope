from __future__ import annotations

import logging
from concurrent.futures import ThreadPoolExecutor, TimeoutError as FuturesTimeoutError
from typing import Any, Callable, TypeVar
from flask import current_app

logger = logging.getLogger(__name__)
_ML_EXECUTOR = ThreadPoolExecutor(max_workers=4, thread_name_prefix="atlas-intel-ml")
ResultT = TypeVar("ResultT")


class MlComputationTimeoutError(TimeoutError):
    def __init__(self, operation: str, timeout_seconds: float) -> None:
        super().__init__(f"ML computation '{operation}' timed out after {timeout_seconds:.3f}s")
        self.operation = operation
        self.timeout_seconds = timeout_seconds


def run_ml_with_timeout(operation: str, fn: Callable[..., ResultT], *args: Any, **kwargs: Any) -> ResultT:
    timeout_seconds = float(current_app.config["ML_REQUEST_TIMEOUT_SECONDS"])
    future = _ML_EXECUTOR.submit(fn, *args, **kwargs)
    try:
        return future.result(timeout=timeout_seconds)
    except FuturesTimeoutError as error:
        future.cancel()
        logger.warning(
            "ml_computation_timed_out",
            extra={"operation": operation, "timeout_seconds": timeout_seconds},
        )
        raise MlComputationTimeoutError(operation, timeout_seconds) from error
