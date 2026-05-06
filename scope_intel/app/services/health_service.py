from __future__ import annotations

import logging

from app.extensions import db
from app.ml.model_loader import MlModelLoader, ml_model_loader

logger = logging.getLogger(__name__)


class HealthService:
    def __init__(self, model_loader: MlModelLoader = ml_model_loader) -> None:
        self.model_loader = model_loader

    def database_ready(self) -> bool:
        try:
            with db.engine.connect():
                return True
        except Exception:
            logger.warning("health_database_check_failed", extra={"dependency": "database"})
            return False

    def ml_model_ready(self) -> bool:
        return self.model_loader.verify()

    def payload(self, *, version: str, uptime: int) -> tuple[dict[str, object], int]:
        database_ready = self.database_ready()
        ml_model_ready = self.ml_model_ready()
        is_healthy = database_ready and ml_model_ready
        return (
            {
                "status": "healthy" if is_healthy else "unhealthy",
                "version": version,
                "uptime": uptime,
            },
            200 if is_healthy else 503,
        )
