import time
from flask import Blueprint, jsonify
from config import settings

health_bp = Blueprint("health", __name__)
START_TIME = time.time()


@health_bp.get("/health")
def health():
    return jsonify({"status": "healthy", "version": settings.version, "uptime": int(time.time() - START_TIME)})
