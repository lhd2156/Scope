from marshmallow import Schema, ValidationError, fields, validates_schema
from flask import Blueprint, request

from app.auth import require_auth
from app.api.validation import validate_latitude, validate_longitude, validate_required_text
from app.rate_limit import rate_limited
from app.responses import success_response
from app.services.place_photo_service import PlacePhotoService


place_photos_bp = Blueprint("place_photos", __name__)
service = PlacePhotoService()


class PlacePhotoQuerySchema(Schema):
    q = fields.String(required=True)
    address = fields.String(load_default="")
    lat = fields.Float(required=True)
    lng = fields.Float(required=True)
    maxWidthPx = fields.Integer(load_default=640)

    @validates_schema
    def validate_query(self, data, **kwargs):
        validate_required_text(data.get("q"), field_name="q", label="Place name", max_length=160)
        validate_latitude(data.get("lat"), field_name="lat")
        validate_longitude(data.get("lng"), field_name="lng")

        max_width_px = data.get("maxWidthPx")
        if max_width_px is None or not 1 <= max_width_px <= 4800:
            raise ValidationError("maxWidthPx must be between 1 and 4800", field_name="maxWidthPx")


query_schema = PlacePhotoQuerySchema()


@place_photos_bp.get("/place-photo")
@rate_limited(limit_config_key="PLACE_PHOTO_RATE_LIMIT_PER_MINUTE")
@require_auth
def get_place_photo():
    payload = query_schema.load(request.args)
    return success_response(
        service.get_featured_photo(
            query=payload["q"],
            address=payload.get("address") or None,
            lat=payload["lat"],
            lng=payload["lng"],
            max_width_px=payload["maxWidthPx"],
        )
    )
