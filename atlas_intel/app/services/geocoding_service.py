class GeocodingService:
    def geocode(self, query: str) -> dict:
        return {"query": query, "latitude": 32.7555, "longitude": -97.3308, "formattedAddress": f"{query}, USA"}

    def reverse_geocode(self, latitude: float, longitude: float) -> dict:
        return {"latitude": latitude, "longitude": longitude, "formattedAddress": "Fort Worth, TX, USA"}
