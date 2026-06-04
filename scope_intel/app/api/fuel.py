from marshmallow import Schema, ValidationError, fields, validates_schema
from flask import Blueprint, request

from app.auth import require_auth
from app.rate_limit import rate_limited
from app.responses import success_response
from app.services.fuel_price_service import FuelPriceService


fuel_bp = Blueprint("fuel", __name__)
service = FuelPriceService()


class FuelStationsQuerySchema(Schema):
    lat = fields.Float(required=True)
    lng = fields.Float(required=True)
    radiusKm = fields.Float(load_default=10)
    fuelType = fields.String(load_default="all")
    limit = fields.Integer(load_default=5)
    sortBy = fields.String(load_default="closest")

    @validates_schema
    def validate_coordinates(self, data, **kwargs):
        lat = data.get("lat")
        lng = data.get("lng")
        if lat is None or not -90 <= lat <= 90:
            raise ValidationError("Latitude out of range", field_name="lat")
        if lng is None or not -180 <= lng <= 180:
            raise ValidationError("Longitude out of range", field_name="lng")


query_schema = FuelStationsQuerySchema()


@fuel_bp.get("/fuel/stations")
@rate_limited(limit_config_key="FUEL_RATE_LIMIT_PER_MINUTE")
@require_auth
def get_fuel_stations():
    payload = query_schema.load(request.args)
    return success_response(
        service.get_nearby_stations(
            lat=payload["lat"],
            lng=payload["lng"],
            radius_km=payload["radiusKm"],
            fuel_type=payload["fuelType"],
            limit=payload["limit"],
            sort_by=payload["sortBy"],
        )
    )
