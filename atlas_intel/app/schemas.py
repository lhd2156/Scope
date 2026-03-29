from marshmallow import Schema, ValidationError, fields, validate, validates_schema

MAX_INTERESTS = 10
MAX_RECOMMENDATION_LIMIT = 20
MAX_ROUTE_SPOTS = 50
PACE_CHOICES = ("relaxed", "moderate", "packed")


class ItineraryRequestSchema(Schema):
    destination = fields.String(required=True, validate=validate.Length(min=2, max=255))
    startDate = fields.Date(required=True)
    endDate = fields.Date(required=True)
    budget = fields.Float(required=True, validate=validate.Range(min=0))
    interests = fields.List(
        fields.String(validate=validate.Length(min=1, max=50)),
        required=True,
        validate=validate.Length(min=1, max=MAX_INTERESTS),
    )
    pace = fields.String(required=True, validate=validate.OneOf(PACE_CHOICES))
    groupSize = fields.Integer(required=True, validate=validate.Range(min=1, max=20))

    @validates_schema
    def validate_dates(self, data, **kwargs):
        if data["endDate"] < data["startDate"]:
            raise ValidationError({"endDate": ["Must be on or after startDate"]})


class RecommendationRequestSchema(Schema):
    userId = fields.String(required=True, validate=validate.Length(min=1, max=64))
    likedSpotIds = fields.List(
        fields.String(validate=validate.Length(min=1, max=64)),
        load_default=[],
        validate=validate.Length(max=MAX_RECOMMENDATION_LIMIT),
    )
    interests = fields.List(
        fields.String(validate=validate.Length(min=1, max=50)),
        load_default=[],
        validate=validate.Length(max=MAX_INTERESTS),
    )
    limit = fields.Integer(load_default=5, validate=validate.Range(min=1, max=MAX_RECOMMENDATION_LIMIT))


class SimilarRecommendationRequestSchema(Schema):
    limit = fields.Integer(load_default=5, validate=validate.Range(min=1, max=MAX_RECOMMENDATION_LIMIT))


class VibeMatchRequestSchema(Schema):
    description = fields.String(required=True, validate=validate.Length(min=5, max=500))
    limit = fields.Integer(load_default=5, validate=validate.Range(min=1, max=MAX_RECOMMENDATION_LIMIT))


class RouteSpotSchema(Schema):
    spotId = fields.String(required=True, validate=validate.Length(min=1, max=64))
    latitude = fields.Float(required=True, validate=validate.Range(min=-90, max=90))
    longitude = fields.Float(required=True, validate=validate.Range(min=-180, max=180))


class RouteOptimizeRequestSchema(Schema):
    spots = fields.List(fields.Nested(RouteSpotSchema), required=True, validate=validate.Length(min=1, max=MAX_ROUTE_SPOTS))
    startLat = fields.Float(load_default=None, allow_none=True, validate=validate.Range(min=-90, max=90))
    startLng = fields.Float(load_default=None, allow_none=True, validate=validate.Range(min=-180, max=180))

    @validates_schema
    def validate_start_coordinates(self, data, **kwargs):
        has_start_lat = data.get("startLat") is not None
        has_start_lng = data.get("startLng") is not None
        if has_start_lat != has_start_lng:
            raise ValidationError({"startLng": ["startLat and startLng must be provided together"]})
