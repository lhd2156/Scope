import time
from flask import Blueprint
from app.responses import success_response
from config import settings

health_bp = Blueprint("health", __name__)
START_TIME = time.time()


@health_bp.get("/health")
def health():
    return success_response({"status": "healthy", "version": settings.version, "uptime": int(time.time() - START_TIME)})
