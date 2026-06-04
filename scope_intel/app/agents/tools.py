"""LangChain tools the trip planner agent can call."""

import os

import requests

from app.services.geo_math import haversine_distance_km

try:
    from langchain_core.tools import tool
except ImportError:
    def tool(func):
        return func

CONTENT_URL = os.environ.get("CONTENT_SERVICE_URL", "http://content:8000/api/content")
ES_URL = os.environ.get("ELASTICSEARCH_URL", "http://elasticsearch:9200")


@tool
def search_spots(query: str, limit: int = 10) -> list[dict]:
    """Search Scope spots by keyword. Returns spot names, ratings, and descriptions."""
    resp = requests.get(f"{CONTENT_URL}/search", params={"q": query, "type": "spots", "limit": limit}, timeout=10)
    if resp.ok:
        return resp.json().get("results", [])
    return []


@tool
def search_nearby(lat: float, lon: float, radius_km: int = 10) -> list[dict]:
    """Find Scope spots near a geographic coordinate."""
    resp = requests.get(
        f"{CONTENT_URL}/search/nearby",
        params={"lat": lat, "lon": lon, "radius": f"{radius_km}km", "limit": 15},
        timeout=10,
    )
    if resp.ok:
        return resp.json().get("results", [])
    return []


@tool
def get_spot_reviews(spot_id: str, limit: int = 5) -> list[dict]:
    """Get reviews for a specific spot."""
    resp = requests.get(f"{CONTENT_URL}/reviews/spot/{spot_id}", params={"limit": limit}, timeout=10)
    if resp.ok:
        reviews = resp.json().get("data", [])
        return reviews[:limit]
    return []


@tool
def get_weather(location: str, date: str) -> dict:
    """Get weather forecast for a location on a specific date. Returns temp, conditions."""
    return {
        "location": location,
        "date": date,
        "temp_high_f": 75,
        "temp_low_f": 60,
        "conditions": "Partly Cloudy",
        "source": "placeholder",
    }


@tool
def calculate_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> dict:
    """Calculate distance in km between two geographic points."""
    return {"distance_km": round(haversine_distance_km(lat1, lon1, lat2, lon2, earth_radius_km=6371.0), 2)}


@tool
def predict_trip_cost(num_spots: int, total_distance_km: float, month: int) -> dict:
    """Predict trip duration and cost based on parameters."""
    from app.ml.inference.predictor import predict_trip

    return predict_trip({
        "num_spots": num_spots,
        "total_distance_km": total_distance_km,
        "month": month,
    })
