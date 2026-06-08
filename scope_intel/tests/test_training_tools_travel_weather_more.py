from __future__ import annotations

import sys
from types import SimpleNamespace

import pandas as pd
import pytest
import requests

from app.agents import tools
from app.ml.training import train_sentiment, train_trip
from app.services.spot import Spot
from app.services.travel_nearby_service import CachedTravelNearbyResult, TravelNearbyService
from app.services.weather_service import WeatherService, WeatherUnavailableError


class Response:
    def __init__(self, payload, ok=True, status_code=200):
        self._payload = payload
        self.ok = ok
        self.status_code = status_code

    def raise_for_status(self):
        if self.status_code >= 400:
            raise requests.HTTPError("bad", response=self)

    def json(self):
        return self._payload


def _invoke(tool_obj, **kwargs):
    return tool_obj.invoke(kwargs)


def test_agent_tools_call_content_and_prediction(monkeypatch):
    calls = []

    def fake_get(url, params, timeout):
        calls.append((url, params, timeout))
        if "reviews" in url:
            return Response({"data": [{"id": 1}, {"id": 2}, {"id": 3}]})
        return Response({"results": [{"name": "Spot"}]})

    monkeypatch.setattr(tools.requests, "get", fake_get)
    assert _invoke(tools.search_spots, query="tacos", limit=2) == [{"name": "Spot"}]
    assert _invoke(tools.search_nearby, lat=1, lon=2, radius_km=3) == [{"name": "Spot"}]
    assert len(_invoke(tools.get_spot_reviews, spot_id="spot-1", limit=2)) == 2

    monkeypatch.setattr(tools.requests, "get", lambda *args, **kwargs: Response({}, ok=False))
    assert _invoke(tools.search_spots, query="x", limit=1) == []
    assert _invoke(tools.search_nearby, lat=1, lon=2, radius_km=3) == []
    assert _invoke(tools.get_spot_reviews, spot_id="spot-1", limit=2) == []

    assert _invoke(tools.get_weather, location="Dallas", date="2026-01-01")["conditions"] == "Partly Cloudy"
    assert _invoke(tools.calculate_distance, lat1=0, lon1=0, lat2=0, lon2=1)["distance_km"] > 100
    monkeypatch.setattr("app.ml.inference.predictor.predict_trip", lambda payload: {"source": "tool", **payload})
    assert _invoke(tools.predict_trip_cost, num_spots=2, total_distance_km=10, month=5)["source"] == "tool"


def test_train_sentiment_and_trip_main_with_fakes(monkeypatch, tmp_path):
    sentiment_data = tmp_path / "reviews.csv"
    sentiment_output = tmp_path / "sentiment"
    pd.DataFrame([{"text": "great", "label": 1}, {"text": "bad", "label": 0}]).to_csv(sentiment_data, index=False)

    class FakeTokenizer:
        def __call__(self, text, **kwargs):
            return {"input_ids": [[1, 2]]}

        def save_pretrained(self, output):
            (tmp_path / "tokenizer-saved").write_text(str(output))

    class FakeDataset:
        def __init__(self, frame):
            self.frame = frame

        @classmethod
        def from_pandas(cls, frame):
            return cls(frame)

        def map(self, fn, batched):
            fn({"text": ["great"]})
            return self

        def train_test_split(self, test_size):
            return {"train": ["train"], "test": ["test"]}

    class FakeTrainingArguments:
        def __init__(self, evaluation_strategy=None, **kwargs):
            self.kwargs = kwargs
            self.evaluation_strategy = evaluation_strategy

    class FakeTrainer:
        def __init__(self, model, args, train_dataset, eval_dataset):
            self.args = args

        def train(self):
            pass

        def save_model(self, output):
            (tmp_path / "model-saved").write_text(str(output))

    loaded_models = []

    def fake_tokenizer_from_pretrained(name, revision):
        loaded_models.append(("tokenizer", name, revision))
        return FakeTokenizer()

    def fake_model_from_pretrained(name, revision, num_labels):
        loaded_models.append(("model", name, revision))
        return {"model": name, "labels": num_labels}

    monkeypatch.setattr(
        train_sentiment,
        "AutoTokenizer",
        SimpleNamespace(from_pretrained=fake_tokenizer_from_pretrained),
    )
    monkeypatch.setattr(
        train_sentiment,
        "AutoModelForSequenceClassification",
        SimpleNamespace(from_pretrained=fake_model_from_pretrained),
    )
    monkeypatch.setattr(train_sentiment, "Dataset", FakeDataset)
    monkeypatch.setattr(train_sentiment, "TrainingArguments", FakeTrainingArguments)
    monkeypatch.setattr(train_sentiment, "Trainer", FakeTrainer)
    monkeypatch.setattr(sys, "argv", ["train_sentiment", "--data", str(sentiment_data), "--output", str(sentiment_output), "--epochs", "1", "--batch-size", "1"])

    train_sentiment.main()
    assert (tmp_path / "model-saved").exists()
    assert (tmp_path / "tokenizer-saved").exists()
    assert loaded_models == [
        ("tokenizer", train_sentiment.MODEL_NAME, train_sentiment.MODEL_REVISION),
        ("model", train_sentiment.MODEL_NAME, train_sentiment.MODEL_REVISION),
    ]

    trip_data = tmp_path / "trips.csv"
    trip_output = tmp_path / "trip-models"
    pd.DataFrame(
        [
            {
                "num_spots": 2,
                "total_distance_km": 100,
                "avg_rating": 4.5,
                "num_outdoor": 1,
                "num_food": 1,
                "num_cultural": 0,
                "month": 5,
                "duration_days": 2,
                "cost_usd": 300,
            }
        ]
    ).to_csv(trip_data, index=False)

    class FakeRegressor:
        def __init__(self, **kwargs):
            self.kwargs = kwargs

        def fit(self, x, y):
            self.columns = list(x.columns)

        def save_model(self, path):
            path.write_text(",".join(self.columns))

    monkeypatch.setattr(train_trip.xgb, "XGBRegressor", FakeRegressor)
    monkeypatch.setattr(sys, "argv", ["train_trip", "--data", str(trip_data), "--output", str(trip_output)])
    train_trip.main()
    assert (trip_output / "trip_duration.json").exists()
    assert (trip_output / "trip_cost.json").exists()


def test_travel_nearby_helpers_error_branches_and_static_labels(app, monkeypatch):
    service = TravelNearbyService(content_client=SimpleNamespace(nearby_spots=lambda *args, **kwargs: (_ for _ in ()).throw(RuntimeError("offline"))))
    anchor = {"id": "a", "placeLabel": "Anchor", "latitude": 32.75, "longitude": -97.33}
    context = {"interests": {"food"}, "latest_intent": "need gas hotel", "budget_ceiling": 500, "pace": "packed", "fuel_type": "regular", "radiusKm": 10}

    with app.app_context():
        app.config["GOOGLE_PLACES_API_KEY"] = ""
        assert service.get_nearby({"anchors": [], "category": "bad"})["coverage"].startswith("Add a route")
        assert service._load_scope_spots(anchor, 10, 5) == []
        assert service._load_google_places(anchor, "food", 10, "all")["messages"][0].startswith("Set GOOGLE")

        app.config["GOOGLE_PLACES_API_KEY"] = "key"
        cached = {"places": [{"id": "cached"}], "messages": []}
        service._cache[service._google_cache_key(anchor, "food", 10, "all")] = CachedTravelNearbyResult(expires_at=9999999999, payload=cached)
        assert service._load_google_places(anchor, "food", 10, "all") is cached

        service._cache.clear()
        monkeypatch.setattr(service._usage_guard, "consume", lambda bucket, cap: {"allowed": True, "cap": cap})
        monkeypatch.setattr("app.services.travel_nearby_service.requests.post", lambda *args, **kwargs: (_ for _ in ()).throw(requests.Timeout("slow")))
        assert "temporarily unavailable" in service._load_google_places(anchor, "food", 10, "all")["messages"][0]

        monkeypatch.setattr("app.services.travel_nearby_service.requests.post", lambda *args, **kwargs: Response({}, status_code=200))
        assert service._load_google_places(anchor, "food", 10, "all")["places"] == []

        bad_place = {"displayName": {"text": "Bad"}, "location": {"latitude": 999, "longitude": 0}}
        assert service._normalize_google_place(bad_place, anchor, "food", context) is None

        fuel_place = {
            "id": "fuel-1",
            "displayName": {"text": "Fuel Stop"},
            "formattedAddress": "1 Road",
            "location": {"latitude": 32.751, "longitude": -97.331},
            "primaryType": "gas_station",
            "types": ["gas_station"],
            "fuelOptions": {"fuelPrices": [{"type": "REGULAR_UNLEADED", "price": {"units": "3", "nanos": 250000000, "currencyCode": "USD"}}]},
            "currentOpeningHours": {"openNow": False},
        }
        normalized = service._normalize_google_place(fuel_place, anchor, "fuel", context)
        assert normalized["sourceLabel"] == "Fuel price"
        assert normalized["priceLabel"] == "$3.25/gal"

        suggestions = [
            {"source": "google", "_photoName": "photos/1", "_photoAttribution": "A", "_photoAttributionUrl": "https://a"},
            {"source": "google", "_photoName": "photos/2"},
        ]
        monkeypatch.setattr(service._usage_guard, "consume", lambda bucket, cap: {"allowed": False, "cap": cap})
        assert "Photos monthly" in service._hydrate_google_photos(suggestions, "food")[0]
        assert service._hydrate_google_photos(suggestions, "fuel") == []

        assert service._normalize_category("entertainment") == "entertainment"
        assert service._normalize_category("not-real") == "recommended"
        assert service._normalize_fuel_type("rocket") == "all"
        assert len(service._normalize_anchors(["bad", {"latitude": 91, "longitude": 0}, {"latitude": 1, "longitude": 2, "title": "T"}])) == 1
        assert service._normalize_route_points(["bad", {"latitude": 1, "longitude": 2}]) == [{"latitude": 1.0, "longitude": 2.0}]
        assert service._monthly_cap("MISSING_CAP", 123) == 123
        assert service._scope_price_label(None) == ""
        assert service._scope_reason(Spot("s", "", "", "other", "", 0, 5, 0, 0, 0, False, 0, ()), "other") == "Scope community pick with nearby activity"
        assert service._infer_google_category(["bowling_alley"], "entertainment") == "entertainment"
        assert service._infer_google_category(["unknown"], "food") == "other"
        assert service._first_photo({"photos": ["bad", {"name": "photo"}]}) == {"name": "photo"}
        assert service._first_photo_attribution({"authorAttributions": ["bad", {"uri": "https://u"}]}) == {"displayName": None, "uri": "https://u"}
        assert service._google_subtitle({}, "fuel") == "Fuel"
        assert service._price_level_label("PRICE_LEVEL_VERY_EXPENSIVE") == "$$$$"
        err = requests.HTTPError(response=Response({"error": {"message": "Quota"}}, status_code=429))
        assert "Quota" in service._google_error_message(err)
        bad_json_err = requests.HTTPError(response=SimpleNamespace(status_code=500, json=lambda: (_ for _ in ()).throw(ValueError("bad"))))
        assert "status 500" in service._google_error_message(bad_json_err)
        assert service._build_coverage_message(True, [], []) == "No travel suggestions were found for this route point and radius."


def test_weather_additional_error_and_stale_paths(app, monkeypatch):
    service = WeatherService()
    app.config.update(
        TESTING=False,
        WEATHER_NWS_ENABLED=False,
        WEATHER_CURRENT_STALE_SECONDS=1,
        WEATHER_CACHE_REDIS_URL="",
        WEATHER_GEOCODE_BASE_URL="https://geo.test",
        ML_REQUEST_TIMEOUT_SECONDS=1,
    )

    with app.app_context():
        with pytest.raises(WeatherUnavailableError):
            service._fetch_nws_current({"latitude": 1, "longitude": 2})

        monkeypatch.setattr(service, "_request_nws_json", lambda path: {"bad": True})
        app.config["WEATHER_NWS_ENABLED"] = True
        with pytest.raises(WeatherUnavailableError):
            service._get_nws_point_metadata(1, 2)
        with pytest.raises(WeatherUnavailableError):
            service._get_nws_station_ids(1, 2, "stations")
        with pytest.raises(WeatherUnavailableError):
            service._fetch_nws_station_observation({"latitude": 1, "longitude": 2}, "KBAD")

        stale = {"isStale": True, "freshnessSeconds": 999}
        fresher = {"isStale": True, "freshnessSeconds": 20}
        calls = iter([WeatherUnavailableError("nws"), stale, fresher])

        def fake_provider(provider, location):
            result = next(calls)
            if isinstance(result, Exception):
                raise result
            return result

        monkeypatch.setattr(service, "_provider_order", lambda location: ["nws", "openweather", "openmeteo"])
        monkeypatch.setattr(service, "_fetch_current_snapshot_for_provider", fake_provider)
        assert service._fetch_current_snapshot({"latitude": 1, "longitude": 2}) is fresher

        def fake_geocode(url, params, timeout):
            return Response({"results": [{"name": "Austin", "admin1": "Texas", "country": "US", "latitude": 30.26, "longitude": -97.74}]})

        monkeypatch.setattr("app.services.weather_service.requests.get", fake_geocode)
        assert service._resolve_current_location(None, None, "Austin")["label"] == "Austin, Texas, US"

        geocode_calls = []

        def fake_geocode_city_state(url, params, timeout):
            geocode_calls.append(params["name"])
            return Response(
                {
                    "results": [
                        {
                            "name": "Fort Worth",
                            "admin1": "Texas",
                            "country": "United States",
                            "country_code": "US",
                            "latitude": 32.72541,
                            "longitude": -97.32085,
                        },
                    ],
                }
            )

        monkeypatch.setattr("app.services.weather_service.requests.get", fake_geocode_city_state)
        resolved = service._resolve_current_location(None, None, "Fort Worth, TX")
        assert geocode_calls[0] == "Fort Worth"
        assert resolved["label"] == "Fort Worth, Texas, United States"
        assert resolved["latitude"] == 32.72541

        monkeypatch.setattr("app.services.weather_service.requests.get", lambda *args, **kwargs: Response({"results": []}))
        with pytest.raises(WeatherUnavailableError):
            service._resolve_current_location(None, None, "Nowhere")

        monkeypatch.setattr(service, "_request_nws_json", WeatherService._request_nws_json.__get__(service, WeatherService))
        monkeypatch.setattr("app.services.weather_service.requests.get", lambda *args, **kwargs: Response([], status_code=200))
        with pytest.raises(WeatherUnavailableError):
            service._request_nws_json("/points/1,2")

        assert service._current_payload_freshness_sort_key({"freshnessSeconds": "bad", "isStale": True})[0] == 1
        assert service._pick_fresher_current_payload({"isStale": True, "freshnessSeconds": 10}, {"isStale": False, "freshnessSeconds": 100})["isStale"] is False
