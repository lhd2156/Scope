# Scope SQL bootstrap and seed scripts

This directory contains SQL Server scripts for creating and seeding the logical Scope schemas.

## Order of execution

`scope-cli seed` discovers SQL files by numeric prefix, then service folder. Run
`scope-cli seed --dry-run --directory scripts/sql` to see the exact plan before
execution.

The single-host deploy script bootstraps Core schema scripts
`001`, `003`, `004`, `005`, and `006` before starting the app services. It then
runs the full idempotent seed only when `SCOPE_RUN_STARTER_SEED=true`, after the
app health checks have confirmed Django migrations are in place.

## What the seed data provides

The seed set is intentionally showcase-oriented and cross-linked:

- 18 fictional showcase personas in `core.Users` with `IsShowcase = 1`
- no accepted seed friendships between showcase personas
- 72 public place anchors in the Django content tables, with photos, reviews, likes, and trips
- 12 public trips spanning Texas, US icons, regional road trips, national parks, and international city routes
- 12 user preference rows, 50 spot feature rows, and 5 cached itineraries in `intel.*`
- media source metadata in `showcase_media_sources.json` and aggregate place context in `showcase_place_profiles.json`

This is enough to support:

- authentication/friend/search smoke tests
- Explore, map, spot detail, feed, public profile, and trip surfaces
- trip planning UI demos
- itinerary cache / preference-based Intel smoke checks

`content/002_content_seed_data.sql` targets the Django-managed `dbo.spots_spot`, `dbo.photos_photo`, `dbo.reviews_review`, and `dbo.trips_*` tables. Run Django content migrations before executing that seed file.

## Idempotency

All `002_*_seed_data.sql` and showcase expansion scripts are idempotent and use fixed GUIDs with upsert guards, so they can be re-run safely in local development and deployment.

## Example invocation

```powershell
cargo run --manifest-path scope-cli/Cargo.toml -- seed --dry-run --directory scripts/sql
```

For execution, make sure SQL Server is healthy and the app migrations have run,
then run `scope-cli seed --directory scripts/sql` or use the deploy script with
`SCOPE_RUN_STARTER_SEED=true`.
