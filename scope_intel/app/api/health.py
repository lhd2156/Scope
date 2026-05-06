import time

from flask import Blueprint, jsonify

from app.rate_limit import rate_limited
from app.services.health_service import HealthService
from app.telemetry import record_service_health
from config import settings

health_bp = Blueprint("health", __name__)
START_TIME = time.time()
service = HealthService()


@health_bp.get("/health")
@rate_limited
def health():
    payload, status_code = service.payload(version=settings.version, uptime=int(time.time() - START_TIME))
    record_service_health('intel', status_code == 200 and payload.get('status') == 'healthy')
    return jsonify(payload), status_code
