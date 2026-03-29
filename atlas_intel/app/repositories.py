import json
from datetime import datetime, timedelta, timezone
from hashlib import sha256
from app.extensions import db
from app.models import ItineraryCache, SpotFeature, UserPreference
from config import settings


def utcnow() -> datetime:
    return datetime.now(tz=timezone.utc)


def normalize_utc(value: datetime) -> datetime:
    return value if value.tzinfo is not None else value.replace(tzinfo=timezone.utc)


class IntelRepository:
    @staticmethod
    def itinerary_request_hash(payload: dict) -> str:
        return sha256(json.dumps(payload, sort_keys=True, default=str).encode()).hexdigest()

    @staticmethod
    def get_cached_itinerary_for_request(user_id: str, payload: dict) -> tuple[str, dict] | None:
        request_hash = IntelRepository.itinerary_request_hash(payload)
        record = ItineraryCache.query.filter_by(user_id=user_id, request_hash=request_hash).first()
        if record is None:
            return None
        if normalize_utc(record.expires_at) <= utcnow():
            db.session.delete(record)
            db.session.commit()
            return None
        return record.id, json.loads(record.result_json)

    @staticmethod
    def cache_itinerary(user_id: str, payload: dict, result: dict) -> str:
        request_hash = IntelRepository.itinerary_request_hash(payload)
        existing = ItineraryCache.query.filter_by(user_id=user_id, request_hash=request_hash).first()
        expires_at = utcnow() + timedelta(hours=settings.itinerary_ttl_hours)
        result_json = json.dumps(result)
        if existing:
            existing.result_json = result_json
            existing.expires_at = expires_at
            db.session.commit()
            return existing.id
        record = ItineraryCache(user_id=user_id, request_hash=request_hash, result_json=result_json, expires_at=expires_at)
        db.session.add(record)
        db.session.commit()
        return record.id

    @staticmethod
    def get_itinerary(itinerary_id: str) -> dict | None:
        record = ItineraryCache.query.filter_by(id=itinerary_id).first()
        if record is None:
            return None
        if normalize_utc(record.expires_at) <= utcnow():
            db.session.delete(record)
            db.session.commit()
            return None
        return json.loads(record.result_json)

    @staticmethod
    def upsert_preference(user_id: str, categories: list[str], budget_level: str | None, pace_preference: str | None) -> None:
        record = UserPreference.query.filter_by(user_id=user_id).first()
        categories_value = ",".join(categories)
        if record is None:
            record = UserPreference(
                user_id=user_id,
                preferred_categories=categories_value,
                budget_level=budget_level,
                pace_preference=pace_preference,
            )
            db.session.add(record)
        else:
            record.preferred_categories = categories_value
            record.budget_level = budget_level
            record.pace_preference = pace_preference
        db.session.commit()

    @staticmethod
    def upsert_spot_feature(spot_id: str, feature_vector: str, popularity_score: float = 0.0, sentiment_score: float = 0.0) -> None:
        record = SpotFeature.query.filter_by(spot_id=spot_id).first()
        if record is None:
            record = SpotFeature(
                spot_id=spot_id,
                feature_vector=feature_vector,
                popularity_score=popularity_score,
                sentiment_score=sentiment_score,
            )
            db.session.add(record)
        else:
            record.feature_vector = feature_vector
            record.popularity_score = popularity_score
            record.sentiment_score = sentiment_score
        db.session.commit()
