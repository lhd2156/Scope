import uuid
from datetime import datetime, timezone
from app.extensions import db


def utcnow() -> datetime:
    return datetime.now(tz=timezone.utc)


class ItineraryCache(db.Model):
    __tablename__ = "ItineraryCache"
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = db.Column(db.String(36), nullable=False)
    request_hash = db.Column(db.String(64), nullable=False, index=True)
    result_json = db.Column(db.Text, nullable=False)
    expires_at = db.Column(db.DateTime, nullable=False)
    created_at = db.Column(db.DateTime, nullable=False, default=utcnow)


class UserPreference(db.Model):
    __tablename__ = "UserPreferences"
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = db.Column(db.String(36), nullable=False, unique=True)
    preferred_categories = db.Column(db.Text, nullable=True)
    budget_level = db.Column(db.String(20), nullable=True)
    pace_preference = db.Column(db.String(20), nullable=True)
    updated_at = db.Column(db.DateTime, nullable=False, default=utcnow, onupdate=utcnow)


class SpotFeature(db.Model):
    __tablename__ = "SpotFeatures"
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    spot_id = db.Column(db.String(36), nullable=False, unique=True)
    feature_vector = db.Column(db.Text, nullable=False)
    popularity_score = db.Column(db.Float, nullable=False, default=0.0)
    sentiment_score = db.Column(db.Float, nullable=False, default=0.0)
    updated_at = db.Column(db.DateTime, nullable=False, default=utcnow, onupdate=utcnow)
