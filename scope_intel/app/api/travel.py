from marshmallow import Schema, ValidationError, fields, validates_schema
from flask import Blueprint, request

from app.auth import require_auth
from app.api.validation import validate_latitude, validate_longitude
from app.rate_limit import rate_limited
from app.responses import success_response
from app.services.travel_nearby_service import TravelNearbyService


travel_bp = Blueprint("travel", __name__)
service = TravelNearbyService()


class TravelAnchorSchema(Schema):
    id = fields.String(load_default="")
    placeLabel = fields.String(load_default="")
    latitude = fields.Float(required=True)
    longitude = fields.Float(required=True)
    routeRole = fields.String(load_default="")


class TravelNearbyRequestSchema(Schema):
    anchors = fields.List(fields.Nested(TravelAnchorSchema), required=True)
    routePoints = fields.List(fields.Dict(), load_default=list)
    category = fields.String(load_default="recommended")
    radiusKm = fields.Float(load_default=16.09)
    limit = fields.Integer(load_default=8)
    interests = fields.List(fields.String(), load_default=list)
    pace = fields.String(load_default="relaxed")
    budgetFloor = fields.Float(load_default=0)
    budgetCeiling = fields.Float(load_default=0)
    startDate = fields.String(load_default="")
    endDate = fields.String(load_default="")
    fuelType = fields.String(load_default="all")
    latestIntent = fields.String(load_default="")

    @validates_schema
    def validate_payload(self, data, **kwargs):
        for index, anchor in enumerate(data.get("anchors") or []):
            validate_latitude(anchor.get("latitude"), field_name=f"anchors.{index}.latitude")
            validate_longitude(anchor.get("longitude"), field_name=f"anchors.{index}.longitude")

        radius_km = data.get("radiusKm", 16.09)
        if radius_km <= 0:
            raise ValidationError("Radius must be greater than zero", field_name="radiusKm")


request_schema = TravelNearbyRequestSchema()


@travel_bp.post("/travel/nearby")
@rate_limited(limit_config_key="RATE_LIMIT_PER_MINUTE")
@require_auth
def get_travel_nearby():
    payload = request_schema.load(request.get_json() or {})
    return success_response(service.get_nearby(payload))
