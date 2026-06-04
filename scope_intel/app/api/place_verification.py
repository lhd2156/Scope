from marshmallow import Schema, fields, validates_schema
from flask import Blueprint, request

from app.auth import require_auth
from app.api.validation import validate_latitude, validate_longitude, validate_required_text
from app.rate_limit import rate_limited
from app.responses import success_response
from app.services.place_verification_service import PlaceVerificationService


place_verification_bp = Blueprint("place_verification", __name__)
service = PlaceVerificationService()


class PlaceVerificationRequestSchema(Schema):
    title = fields.String(required=True)
    address = fields.String(load_default="")
    city = fields.String(load_default="")
    country = fields.String(load_default="")
    postalCode = fields.String(load_default="")
    latitude = fields.Float(required=True)
    longitude = fields.Float(required=True)
    providerPlaceId = fields.String(load_default="")

    @validates_schema
    def validate_payload(self, data, **kwargs):
        validate_required_text(data.get("title"), field_name="title", label="Place title", max_length=160)
        validate_latitude(data.get("latitude"))
        validate_longitude(data.get("longitude"))


request_schema = PlaceVerificationRequestSchema()


@place_verification_bp.post("/place/verify")
@rate_limited
@require_auth
def verify_place():
    payload = request_schema.load(request.get_json(silent=True) or {})
    return success_response(service.verify(payload))
