from marshmallow import Schema, ValidationError, fields, pre_load, validate, validates_schema

MAX_INTERESTS = 10
MAX_RECOMMENDATION_LIMIT = 20
MAX_NCF_RECOMMENDATION_LIMIT = 50
MAX_ROUTE_SPOTS = 50
MAX_ITINERARY_DAYS = 14
MAX_AGENT_PROMPT_LENGTH = 8000
PACE_CHOICES = ("relaxed", "moderate", "packed")
QUERY_REQUIRED_ERROR = "Missing required query parameter"
LATITUDE_RANGE = validate.Range(min=-90, max=90)
LONGITUDE_RANGE = validate.Range(min=-180, max=180)


def _not_blank(value: str) -> None:
    if not value.strip():
        raise ValidationError("Field cannot be blank")


def _non_blank_string(min_length: int, max_length: int):
    return validate.And(_not_blank, validate.Length(min=min_length, max=max_length))


def _trim_text(value):
    return value.strip() if isinstance(value, str) else value


def _trim_text_list(values):
    if not isinstance(values, list):
        return values

    trimmed: list = []
    seen: set[str] = set()
    for value in values:
        normalized = _trim_text(value)
        dedupe_key = normalized.casefold() if isinstance(normalized, str) else str(normalized)
        if dedupe_key in seen:
            continue
        seen.add(dedupe_key)
        trimmed.append(normalized)
    return trimmed


class ItineraryRequestSchema(Schema):
    destination = fields.String(required=True, validate=_non_blank_string(2, 255))
    endDestination = fields.String(load_default=None, allow_none=True, validate=_non_blank_string(2, 255))
    destinationLatitude = fields.Float(load_default=None, allow_none=True, validate=LATITUDE_RANGE)
    destinationLongitude = fields.Float(load_default=None, allow_none=True, validate=LONGITUDE_RANGE)
    endDestinationLatitude = fields.Float(load_default=None, allow_none=True, validate=LATITUDE_RANGE)
    endDestinationLongitude = fields.Float(load_default=None, allow_none=True, validate=LONGITUDE_RANGE)
    startDate = fields.Date(required=True)
    endDate = fields.Date(required=True)
    budgetFloor = fields.Float(load_default=0, validate=validate.Range(min=0))
    budget = fields.Float(required=True, validate=validate.Range(min=0))
    interests = fields.List(
        fields.String(validate=_non_blank_string(1, 50)),
        required=True,
        validate=validate.Length(min=1, max=MAX_INTERESTS),
    )
    pace = fields.String(required=True, validate=validate.OneOf(PACE_CHOICES))
    groupSize = fields.Integer(required=True, validate=validate.Range(min=1, max=20))

    @pre_load
    def normalize_payload(self, data, **kwargs):
        if not isinstance(data, dict):
            return data

        normalized = dict(data)
        for key in ("destination", "endDestination", "pace"):
            if key in normalized:
                normalized[key] = _trim_text(normalized[key])
        if "interests" in normalized:
            normalized["interests"] = _trim_text_list(normalized["interests"])
        return normalized

    @validates_schema
    def validate_dates(self, data, **kwargs):
        if data["endDate"] < data["startDate"]:
            raise ValidationError({"endDate": ["Must be on or after startDate"]})
        if (data["endDate"] - data["startDate"]).days + 1 > MAX_ITINERARY_DAYS:
            raise ValidationError({"endDate": [f"Itinerary cannot be longer than {MAX_ITINERARY_DAYS} days"]})
        if data.get("budgetFloor", 0) > data["budget"]:
            raise ValidationError({"budgetFloor": ["Must be less than or equal to budget"]})

        coordinate_pairs = (
            ("destinationLatitude", "destinationLongitude"),
            ("endDestinationLatitude", "endDestinationLongitude"),
        )
        for latitude_key, longitude_key in coordinate_pairs:
            has_latitude = data.get(latitude_key) is not None
            has_longitude = data.get(longitude_key) is not None
            if has_latitude != has_longitude:
                raise ValidationError({longitude_key: [f"{latitude_key} and {longitude_key} must be provided together"]})


class RecommendationRequestSchema(Schema):
    userId = fields.String(load_default=None, allow_none=True, validate=_non_blank_string(1, 64))
    likedSpotIds = fields.List(
        fields.String(validate=_non_blank_string(1, 64)),
        load_default=[],
        validate=validate.Length(max=MAX_RECOMMENDATION_LIMIT),
    )
    interests = fields.List(
        fields.String(validate=_non_blank_string(1, 50)),
        load_default=[],
        validate=validate.Length(max=MAX_INTERESTS),
    )
    limit = fields.Integer(load_default=5, validate=validate.Range(min=1, max=MAX_RECOMMENDATION_LIMIT))

    @pre_load
    def normalize_payload(self, data, **kwargs):
        if not isinstance(data, dict):
            return data

        normalized = dict(data)
        if "userId" in normalized:
            normalized["userId"] = _trim_text(normalized["userId"])
        if "likedSpotIds" in normalized:
            normalized["likedSpotIds"] = _trim_text_list(normalized["likedSpotIds"])
        if "interests" in normalized:
            normalized["interests"] = _trim_text_list(normalized["interests"])
        # The frontend may include destination context for local ranking. Intel
        # recs currently rank against the full catalog, so accept and ignore it
        # instead of failing an otherwise valid request.
        normalized.pop("destination", None)
        return normalized


class SimilarRecommendationRequestSchema(Schema):
    limit = fields.Integer(load_default=5, validate=validate.Range(min=1, max=MAX_RECOMMENDATION_LIMIT))


class NcfRecommendationRequestSchema(Schema):
    userId = fields.String(load_default=None, allow_none=True, validate=_non_blank_string(1, 64))
    limit = fields.Integer(load_default=10, validate=validate.Range(min=1, max=MAX_NCF_RECOMMENDATION_LIMIT))

    @pre_load
    def normalize_payload(self, data, **kwargs):
        if not isinstance(data, dict):
            return data
        normalized = dict(data)
        if "userId" in normalized:
            normalized["userId"] = _trim_text(normalized["userId"])
        return normalized


class RecommendationFeedbackSchema(Schema):
    spotId = fields.String(required=True, validate=_non_blank_string(1, 64))
    action = fields.String(required=True, validate=validate.OneOf(("click", "dismiss")))

    @pre_load
    def normalize_payload(self, data, **kwargs):
        if not isinstance(data, dict):
            return data
        normalized = dict(data)
        for key in ("spotId", "action"):
            if key in normalized:
                normalized[key] = _trim_text(normalized[key])
        return normalized


class VibeMatchRequestSchema(Schema):
    description = fields.String(required=True, validate=_non_blank_string(5, 500))
    limit = fields.Integer(load_default=5, validate=validate.Range(min=1, max=MAX_RECOMMENDATION_LIMIT))

    @pre_load
    def normalize_payload(self, data, **kwargs):
        if not isinstance(data, dict):
            return data

        normalized = dict(data)
        if "description" not in normalized and "vibe" in normalized:
            normalized["description"] = normalized["vibe"]
        normalized.pop("vibe", None)
        if "description" in normalized:
            normalized["description"] = _trim_text(normalized["description"])
        return normalized


class RouteSpotSchema(Schema):
    id = fields.String(load_default=None, allow_none=True, validate=_non_blank_string(1, 128))
    spotId = fields.String(required=True, validate=_non_blank_string(1, 64))
    title = fields.String(load_default=None, allow_none=True, validate=_non_blank_string(1, 255))
    latitude = fields.Float(required=True, validate=LATITUDE_RANGE)
    longitude = fields.Float(required=True, validate=LONGITUDE_RANGE)
    category = fields.String(load_default=None, allow_none=True, validate=_non_blank_string(1, 50))
    city = fields.String(load_default=None, allow_none=True, validate=_non_blank_string(1, 120))
    vibe = fields.String(load_default=None, allow_none=True, validate=_non_blank_string(1, 120))
    rating = fields.Float(load_default=None, allow_none=True, validate=validate.Range(min=0, max=5))
    photoUrl = fields.String(load_default=None, allow_none=True, validate=_non_blank_string(1, 500))
    routeRole = fields.String(load_default=None, allow_none=True, validate=validate.OneOf(("start", "stop", "end")))
    routeLabel = fields.String(load_default=None, allow_none=True, validate=_non_blank_string(1, 255))

    @pre_load
    def normalize_payload(self, data, **kwargs):
        if not isinstance(data, dict):
            return data

        normalized = dict(data)
        if "spotId" not in normalized and "id" in normalized:
            normalized["spotId"] = normalized["id"]
        for key in ("id", "spotId", "title", "category", "city", "vibe", "photoUrl", "routeRole", "routeLabel"):
            if key in normalized:
                normalized[key] = _trim_text(normalized[key])
        return normalized


class RouteOptimizeRequestSchema(Schema):
    spots = fields.List(fields.Nested(RouteSpotSchema), required=True, validate=validate.Length(min=1, max=MAX_ROUTE_SPOTS))
    startLat = fields.Float(load_default=None, allow_none=True, validate=LATITUDE_RANGE)
    startLng = fields.Float(load_default=None, allow_none=True, validate=LONGITUDE_RANGE)

    @pre_load
    def normalize_payload(self, data, **kwargs):
        if not isinstance(data, dict):
            return data

        normalized = dict(data)
        if "spots" not in normalized and "points" in normalized:
            normalized["spots"] = normalized["points"]
        normalized.pop("points", None)
        return normalized

    @validates_schema
    def validate_start_coordinates(self, data, **kwargs):
        has_start_lat = data.get("startLat") is not None
        has_start_lng = data.get("startLng") is not None
        if has_start_lat != has_start_lng:
            raise ValidationError({"startLng": ["startLat and startLng must be provided together"]})


class WeatherQuerySchema(Schema):
    lat = fields.Float(required=True, validate=LATITUDE_RANGE, error_messages={"required": QUERY_REQUIRED_ERROR})
    lng = fields.Float(required=True, validate=LONGITUDE_RANGE, error_messages={"required": QUERY_REQUIRED_ERROR})
    date = fields.Date(required=True, error_messages={"required": QUERY_REQUIRED_ERROR})


class CurrentWeatherQuerySchema(Schema):
    lat = fields.Float(load_default=None, allow_none=True, validate=LATITUDE_RANGE)
    lng = fields.Float(load_default=None, allow_none=True, validate=LONGITUDE_RANGE)
    q = fields.String(load_default=None, allow_none=True, validate=_non_blank_string(2, 255))

    @pre_load
    def normalize_payload(self, data, **kwargs):
        if not isinstance(data, dict):
            return data

        normalized = dict(data)
        if "q" in normalized:
            normalized["q"] = _trim_text(normalized["q"])
        return normalized

    @validates_schema
    def validate_location(self, data, **kwargs):
        has_latitude = data.get("lat") is not None
        has_longitude = data.get("lng") is not None
        has_query = bool(data.get("q"))

        if has_latitude != has_longitude:
            raise ValidationError({"lng": ["lat and lng must be provided together"]})
        if not ((has_latitude and has_longitude) or has_query):
            raise ValidationError({"weather": ["Provide lat/lng or q"]})


class GeocodeQuerySchema(Schema):
    q = fields.String(required=True, validate=_non_blank_string(2, 255), error_messages={"required": QUERY_REQUIRED_ERROR})
    limit = fields.Integer(load_default=5, validate=validate.Range(min=1, max=10))


class ReverseGeocodeQuerySchema(Schema):
    lat = fields.Float(required=True, validate=LATITUDE_RANGE, error_messages={"required": QUERY_REQUIRED_ERROR})
    lng = fields.Float(required=True, validate=LONGITUDE_RANGE, error_messages={"required": QUERY_REQUIRED_ERROR})


class AgentPlanTripRequestSchema(Schema):
    prompt = fields.String(required=True, validate=_non_blank_string(1, MAX_AGENT_PROMPT_LENGTH))
    user_id = fields.String(load_default=None, allow_none=True, validate=_non_blank_string(1, 64))
    start_date = fields.Date(load_default=None, allow_none=True)

    @pre_load
    def normalize_payload(self, data, **kwargs):
        if not isinstance(data, dict):
            return data

        normalized = dict(data)
        for key in ("prompt", "user_id"):
            if key in normalized:
                normalized[key] = _trim_text(normalized[key])
        return normalized


class AgentTripChatRequestSchema(Schema):
    message = fields.String(load_default="", validate=validate.Length(max=4000))
    prompt = fields.String(load_default="", validate=validate.Length(max=MAX_AGENT_PROMPT_LENGTH))
    user_id = fields.String(load_default=None, allow_none=True, validate=_non_blank_string(1, 64))
    start_date = fields.Date(load_default=None, allow_none=True)
    plannerState = fields.Dict(load_default=dict)
    planner_state = fields.Dict(load_default=dict)
    sessionHistory = fields.List(fields.Dict(), load_default=list)
    session_history = fields.List(fields.Dict(), load_default=list)
    preferences = fields.Dict(load_default=dict)
    locationContext = fields.Dict(load_default=dict)
    location_context = fields.Dict(load_default=dict)
    images = fields.List(fields.Dict(), load_default=list)
    responseMode = fields.String(load_default="json", validate=validate.OneOf(["json", "stream"]))

    @pre_load
    def normalize_payload(self, data, **kwargs):
        if not isinstance(data, dict):
            return data

        normalized = dict(data)
        for key in ("message", "prompt", "user_id", "responseMode"):
            if key in normalized:
                normalized[key] = _trim_text(normalized[key])
        return normalized

    @validates_schema
    def validate_message_or_prompt(self, data, **kwargs):
        if not (str(data.get("message") or "").strip() or str(data.get("prompt") or "").strip()):
            raise ValidationError({"message": ["Provide message or prompt"]})
