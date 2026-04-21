import time
from flask import Blueprint, jsonify
from app.rate_limit import rate_limited
from app.services.health_service import HealthService
from config import settings

health_bp = Blueprint("health", __name__)
START_TIME = time.time()
service = HealthService()


@health_bp.get("/health")
@rate_limited
def health():
    payload, status_code = service.payload(version=settings.version, uptime=int(time.time() - START_TIME))
    return jsonify(payload), status_code
