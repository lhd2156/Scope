import json

from app.services.content_client import Spot


def extract_feature_vector(spot: Spot) -> str:
    payload = {
        "category": spot.category,
        "vibe": spot.vibe,
        "rating": spot.rating,
        "popularity": spot.popularity,
        "photosCount": spot.photos_count,
        "isOutdoor": spot.is_outdoor,
    }
    return json.dumps(payload, sort_keys=True)
