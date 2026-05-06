from datetime import date

from app.services.itinerary_engine import WeatherSnapshot


class WeatherService:
    def get_forecast(self, latitude: float, longitude: float, target_date: date) -> dict:
        summary = "Sunny, 75F" if target_date.day % 2 else "Cloudy, 68F"
        return {"latitude": latitude, "longitude": longitude, "date": target_date.isoformat(), "forecast": summary}

    def get_planning_snapshot(self, target_date: date) -> WeatherSnapshot:
        sunny = target_date.day % 2 == 1
        return WeatherSnapshot(summary="Sunny, 75F" if sunny else "Cloudy, 68F", sunny_bias=0.5 if sunny else 0.1)
