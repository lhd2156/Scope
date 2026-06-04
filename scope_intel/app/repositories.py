import json
from datetime import datetime, timedelta, timezone
from hashlib import sha256

from app.extensions import db
from app.models import (
    FriendEdge,
    ItineraryCache,
    RecommendationAudit,
    SpotFeature,
    UserInteraction,
    UserPreference,
)
from config import settings

# Per-signal weight for the interaction ledger. Tune these in one place so
# offline replays stay consistent with live scoring.
# "dismiss" is negative and strong enough that three dismissals of the same
# category visibly suppress that category in the next session.
INTERACTION_WEIGHTS: dict[str, float] = {
    "view": 0.5,
    "dwell": 1.0,
    "click": 1.5,
    "like": 3.0,
    "save": 4.0,
    "visit": 5.0,
    "review": 5.0,
    "share": 2.5,
    "dismiss": -4.0,
    "hide": -6.0,
}


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
    def get_itinerary(itinerary_id: str, user_id: str) -> dict | None:
        record = ItineraryCache.query.filter_by(id=itinerary_id, user_id=user_id).first()
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

    @staticmethod
    def record_interaction(
        user_id: str,
        spot_id: str,
        interaction_type: str,
        context: dict | None = None,
        occurred_at: datetime | None = None,
        source_event_id: str | None = None,
    ) -> None:
        """Append a single user<->spot interaction. Called by the Kafka consumer
        on `interaction.recorded`. Unknown interaction_types are still stored
        (with weight 0) so we don't silently drop novel signals. When Kafka
        redelivers an already-seen envelope, `source_event_id` makes the write
        idempotent so replay does not inflate the user's affinity profile.
        """
        if source_event_id:
            existing = UserInteraction.query.filter_by(source_event_id=source_event_id).first()
            if existing is not None:
                return
        weight = INTERACTION_WEIGHTS.get(interaction_type, 0.0)
        record = UserInteraction(
            user_id=user_id,
            spot_id=spot_id,
            interaction_type=interaction_type,
            weight=weight,
            context=json.dumps(context) if context else None,
            occurred_at=occurred_at or utcnow(),
            source_event_id=source_event_id,
        )
        db.session.add(record)
        db.session.commit()

    @staticmethod
    def get_recently_dismissed_spot_ids(user_id: str, window_days: int = 14) -> set[str]:
        """Return spots this user explicitly rejected in the last window.
        Used by the ranker to suppress re-recommendations.
        """
        cutoff = utcnow() - timedelta(days=window_days)
        rows = (
            db.session.query(UserInteraction.spot_id)
            .filter(
                UserInteraction.user_id == user_id,
                UserInteraction.interaction_type.in_(("dismiss", "hide")),
                UserInteraction.occurred_at >= cutoff,
            )
            .all()
        )
        dismissed = {row[0] for row in rows}
        audit_rows = (
            db.session.query(RecommendationAudit.spot_id)
            .filter(
                RecommendationAudit.user_id == user_id,
                RecommendationAudit.dismissed_at.isnot(None),
                RecommendationAudit.dismissed_at >= cutoff,
            )
            .all()
        )
        dismissed.update(row[0] for row in audit_rows)
        return dismissed

    @staticmethod
    def get_user_interaction_weights(
        user_id: str,
        window_days: int = 60,
    ) -> dict[str, float]:
        """Aggregate a user's per-spot affinity score from their interaction
        history. Higher score == stronger positive signal for that spot's
        category neighborhood. Returns spot_id -> cumulative weight.
        """
        cutoff = utcnow() - timedelta(days=window_days)
        rows = (
            db.session.query(UserInteraction.spot_id, UserInteraction.weight)
            .filter(
                UserInteraction.user_id == user_id,
                UserInteraction.occurred_at >= cutoff,
            )
            .all()
        )
        totals: dict[str, float] = {}
        for spot_id, weight in rows:
            totals[spot_id] = totals.get(spot_id, 0.0) + float(weight)
        return totals

    @staticmethod
    def record_recommendation_audit(
        user_id: str,
        entries: list[dict],
    ) -> None:
        """Persist one audit row per served recommendation. Errors are swallowed
        so recommendation latency is never blocked by an audit write failure --
        we log and move on; the audit log is best-effort.

        `entries` items look like:
            {"spotId": "...", "rank": 0, "score": 0.812,
             "signalBreakdown": {"text": 0.4, "collab": 0.1, ...},
             "reason": "Matches your culture interests"}
        """
        if not entries:
            return
        try:
            now = utcnow()
            records = [
                RecommendationAudit(
                    user_id=user_id,
                    spot_id=entry["spotId"],
                    rank=int(entry.get("rank", index)),
                    score=float(entry.get("score", 0.0)),
                    signal_breakdown=json.dumps(entry.get("signalBreakdown") or {}),
                    reason=entry.get("reason"),
                    served_at=now,
                )
                for index, entry in enumerate(entries)
            ]
            db.session.add_all(records)
            db.session.commit()
        except Exception:
            db.session.rollback()

    @staticmethod
    def record_friend_edge(user_id: str, friend_id: str) -> None:
        """Upsert a bidirectional friendship mirror. Called by the Kafka consumer
        on `friend.accepted`. Creates two rows (u->f, f->u) so friend lookups
        are always a single-column index scan regardless of which side accepted.
        """
        if not user_id or not friend_id or user_id == friend_id:
            return
        pairs = ((user_id, friend_id), (friend_id, user_id))
        for left, right in pairs:
            exists = FriendEdge.query.filter_by(user_id=left, friend_id=right).first()
            if exists is None:
                db.session.add(FriendEdge(user_id=left, friend_id=right))
        db.session.commit()

    @staticmethod
    def remove_friend_edge(user_id: str, friend_id: str) -> None:
        """Remove a bidirectional friendship mirror. Called by the Kafka consumer
        on `friend.removed` / `friend.rejected`. Silent no-op if the pair is
        absent so replays are idempotent.
        """
        if not user_id or not friend_id:
            return
        FriendEdge.query.filter(
            db.or_(
                db.and_(FriendEdge.user_id == user_id, FriendEdge.friend_id == friend_id),
                db.and_(FriendEdge.user_id == friend_id, FriendEdge.friend_id == user_id),
            )
        ).delete(synchronize_session=False)
        db.session.commit()

    @staticmethod
    def get_friend_ids(user_id: str) -> set[str]:
        """Return the set of accepted-friend user ids for the caller."""
        if not user_id:
            return set()
        rows = db.session.query(FriendEdge.friend_id).filter_by(user_id=user_id).all()
        return {row[0] for row in rows}

    @staticmethod
    def get_spots_liked_by_friends(
        user_id: str,
        window_days: int = 60,
        max_spots: int = 200,
    ) -> dict[str, int]:
        """For each spot, count how many of `user_id`'s friends liked/saved/visited
        it in the last window. Returns spot_id -> friend-like-count. Used as a
        candidate source and a scoring boost ("friends are into this").
        """
        friend_ids = IntelRepository.get_friend_ids(user_id)
        if not friend_ids:
            return {}
        cutoff = utcnow() - timedelta(days=window_days)
        rows = (
            db.session.query(UserInteraction.spot_id, db.func.count(UserInteraction.spot_id))
            .filter(
                UserInteraction.user_id.in_(friend_ids),
                UserInteraction.interaction_type.in_(("like", "save", "visit", "review")),
                UserInteraction.occurred_at >= cutoff,
            )
            .group_by(UserInteraction.spot_id)
            .order_by(db.func.count(UserInteraction.spot_id).desc())
            .limit(max_spots)
            .all()
        )
        return {spot_id: int(count) for spot_id, count in rows}

    @staticmethod
    def has_any_interaction(user_id: str) -> bool:
        """Cold-start gate: true if the user has any logged interaction at all.
        Cheap existence check -- feeds the "curated vs personalized" branch in
        the ranker.
        """
        if not user_id:
            return False
        row = (
            db.session.query(UserInteraction.id)
            .filter(UserInteraction.user_id == user_id)
            .limit(1)
            .first()
        )
        return row is not None

    @staticmethod
    def get_audit_history(
        user_id: str,
        since: datetime | None = None,
    ) -> list[RecommendationAudit]:
        """Fetch audit rows for offline eval / debugging. Not used by live ranking."""
        query = RecommendationAudit.query.filter_by(user_id=user_id)
        if since is not None:
            query = query.filter(RecommendationAudit.served_at >= since)
        return query.order_by(RecommendationAudit.served_at.asc()).all()

    @staticmethod
    def mark_recommendation_feedback(
        user_id: str,
        spot_id: str,
        action: str,
    ) -> bool:
        """Mark the most recent audit row for (user, spot) as clicked or dismissed.
        Returns True if a row was updated. Used by `POST /recommend/feedback`.
        """
        if action not in ("click", "dismiss"):
            return False
        row = (
            RecommendationAudit.query.filter_by(user_id=user_id, spot_id=spot_id)
            .order_by(RecommendationAudit.served_at.desc())
            .first()
        )
        if row is None:
            return False
        now = utcnow()
        if action == "click":
            row.clicked_at = now
        else:
            row.dismissed_at = now
        db.session.commit()
        return True
