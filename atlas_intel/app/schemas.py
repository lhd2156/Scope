from marshmallow import Schema, ValidationError, fields, validates_schema

class ItineraryRequestSchema(Schema):
    destination = fields.String(required=True)
    startDate = fields.Date(required=True)
    endDate = fields.Date(required=True)
    budget = fields.Float(required=True)
    interests = fields.List(fields.String(), required=True)
    pace = fields.String(required=True)
    groupSize = fields.Integer(required=True)

    @validates_schema
    def validate_dates(self, data, **kwargs):
        if data["endDate"] < data["startDate"]:
            raise ValidationError({"endDate": ["Must be on or after startDate"]})

class RecommendationRequestSchema(Schema):
    userId = fields.String(required=True)
    likedSpotIds = fields.List(fields.String(), load_default=[])
    interests = fields.List(fields.String(), load_default=[])
    limit = fields.Integer(load_default=5)

class VibeMatchRequestSchema(Schema):
    description = fields.String(required=True)
    limit = fields.Integer(load_default=5)

class RouteOptimizeRequestSchema(Schema):
    spots = fields.List(fields.Dict(), required=True)
    startLat = fields.Float(load_default=None, allow_none=True)
    startLng = fields.Float(load_default=None, allow_none=True)
