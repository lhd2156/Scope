from __future__ import annotations

import logging
from sklearn.feature_extraction.text import TfidfVectorizer
from app.extensions import db

logger = logging.getLogger(__name__)


class HealthService:
    def database_ready(self) -> bool:
        try:
            with db.engine.connect():
                return True
        except Exception:
            logger.warning("health_database_check_failed", extra={"dependency": "database"})
            return False

    def ml_model_ready(self) -> bool:
        try:
            vectorizer = TfidfVectorizer()
            matrix = vectorizer.fit_transform(["atlas intel health", "ml model ready"])
            return matrix.shape[0] == 2
        except Exception:
            logger.warning("health_ml_check_failed", extra={"dependency": "ml"})
            return False

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
