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


class UserInteraction(db.Model):
    """Normalized ledger of every user<->spot interaction Intel learns from.

    Populated by the Kafka consumer on `interaction.recorded` (authoritative
    writer is the Content service). Writes MUST be append-only; no UPDATE /
    DELETE so backfills and offline eval can replay history.
    """

    __tablename__ = "UserInteractions"
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = db.Column(db.String(36), nullable=False, index=True)
    spot_id = db.Column(db.String(36), nullable=False, index=True)
    interaction_type = db.Column(db.String(32), nullable=False, index=True)
    # Source event id from the Kafka envelope. Nullable so historical/local
    # fixture writes still work, unique so at-least-once replay does not double
    # count user affinity.
    source_event_id = db.Column(db.String(64), nullable=True, unique=True)
    # Precomputed per-signal weight (see IntelRepository.INTERACTION_WEIGHTS).
    # Stored on the row so replay with updated weights is as simple as a SELECT.
    weight = db.Column(db.Float, nullable=False, default=0.0)
    # JSON-encoded context: {"source": "explore"|"detail"|"rec-card"|"search", "query": "..."}
    context = db.Column(db.Text, nullable=True)
    occurred_at = db.Column(db.DateTime, nullable=False, default=utcnow, index=True)

    __table_args__ = (
        db.Index("ix_user_interaction_user_time", "user_id", "occurred_at"),
        db.Index("ix_user_interaction_spot_time", "spot_id", "occurred_at"),
        db.Index("ix_user_interaction_event", "source_event_id"),
    )


class FriendEdge(db.Model):
    """Mirror of accepted friendships from Core. Populated via Kafka:
    `friend.accepted` adds a bidirectional pair of rows; `friend.removed`
    deletes them. Intel reads this to surface "liked by your friends"
    candidates without exposing Core's tables directly.
    """

    __tablename__ = "FriendEdges"
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = db.Column(db.String(36), nullable=False, index=True)
    friend_id = db.Column(db.String(36), nullable=False, index=True)
    created_at = db.Column(db.DateTime, nullable=False, default=utcnow)

    __table_args__ = (
        db.UniqueConstraint("user_id", "friend_id", name="uq_friend_edge_pair"),
    )


class RecommendationAudit(db.Model):
    """One row per (user, spot) recommendation served. Used to:
      - filter recently-dismissed spots out of future rec lists
      - measure CTR / conversion for offline eval
      - explain to the user why a spot was suggested
    """

    __tablename__ = "RecommendationAudits"
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = db.Column(db.String(36), nullable=False, index=True)
    spot_id = db.Column(db.String(36), nullable=False, index=True)
    rank = db.Column(db.Integer, nullable=False)
    score = db.Column(db.Float, nullable=False)
    # JSON-encoded: {"text": 0.4, "collab": 0.12, "geo": 0.05, "popularity": 0.03, ...}
    signal_breakdown = db.Column(db.Text, nullable=False, default="{}")
    reason = db.Column(db.String(500), nullable=True)
    served_at = db.Column(db.DateTime, nullable=False, default=utcnow, index=True)
    clicked_at = db.Column(db.DateTime, nullable=True)
    dismissed_at = db.Column(db.DateTime, nullable=True)

    __table_args__ = (
        db.Index("ix_rec_audit_user_served", "user_id", "served_at"),
        db.Index("ix_rec_audit_user_spot_served", "user_id", "spot_id", "served_at"),
    )
