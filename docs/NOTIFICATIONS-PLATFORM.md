# Notifications Platform

Scope notifications now flow through one Core-owned pipeline:

1. Content writes domain data and records a replayable `common.OutboxEvent`.
2. Content publishes Kafka events with stable `eventId`s after commit.
3. Core `NotificationEventConsumerService` consumes notification topics, dedupes in `NotificationOutbox`, and creates recipient notifications.
4. Core sends in-app SignalR immediately and queues `NotificationDeliveries` for push/email based on preferences.
5. Frontend reads `/notifications`, handles deep links/actions, and stores Web Push subscriptions.

## Notify Cases

| Case | Source event | Recipient rule | Channel default |
|---|---|---|---|
| Friend request/accept | Core friendship endpoints | Target user / requester | In-app, push |
| Friend posted public spot/trip | `spot.created`, `trip.created` | Accepted friends, daily grouped digest | In-app digest |
| Like/review on a spot | `spot.liked`, `review.created` | Spot owner, excluding actor/self | In-app, push |
| Trip member added | `trip.member.added` | Added user | In-app, push, email |
| Comment/reply | `comment.created` | Target owner and parent-comment author | In-app, push |
| Mention | `mention.created` | Mentioned user ids | In-app, push |
| Account/security | Core auth/MFA/password flows | Acting account | In-app, push, email |

## Ops Notes

- Apply `scripts/sql/core/004_notifications_platform.sql` for Core schema.
- Apply Django migrations for `common.OutboxEvent` and `comments`.
- Configure Web Push with `WEB_PUSH_PUBLIC_KEY`, `WEB_PUSH_PRIVATE_KEY`, `WEB_PUSH_SUBJECT`, and frontend `VITE_WEB_PUSH_PUBLIC_KEY`.
- Replay failed Content events with `python manage.py replay_outbox_events --status failed`.
- Admin Core APIs can inspect/replay notification outbox and deliveries under `/api/core/notifications/admin`.
