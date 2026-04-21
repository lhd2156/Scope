# Atlas SQL bootstrap and seed scripts

This directory contains SQL Server scripts for creating and seeding the logical Atlas schemas.

## Order of execution

Run the files in this order:

1. `core/001_core_schema.sql`
2. `content/001_content_schema.sql`
3. `intel/001_intel_schema.sql`
4. `core/002_core_seed_data.sql`
5. `content/002_content_seed_data.sql`
6. `intel/002_intel_seed_data.sql`

## What the seed data provides

The seed set is intentionally small but cross-linked:

- 3 demo users in `core.Users`
- accepted friendship + notifications + one live session in `core.*`
- 2 demo spots, 1 trip, trip membership, photo, review, and like in `content.*`
- 2 user preference rows, 2 spot feature rows, and 1 cached itinerary in `intel.*`

This is enough to support:

- authentication/friend/notification smoke tests
- spot detail and feed surfaces
- trip planning UI demos
- itinerary cache / preference-based Intel smoke checks

## Idempotency

All `002_*_seed_data.sql` scripts are idempotent and use fixed GUIDs with `IF NOT EXISTS` guards, so they can be re-run safely in local development.

## Example invocation with sqlcmd

```powershell
sqlcmd -S localhost,1433 -U sa -P "$env:SA_PASSWORD" -d Atlas \
  -i scripts/sql/core/001_core_schema.sql \
  -i scripts/sql/content/001_content_schema.sql \
  -i scripts/sql/intel/001_intel_schema.sql \
  -i scripts/sql/core/002_core_seed_data.sql \
  -i scripts/sql/content/002_content_seed_data.sql \
  -i scripts/sql/intel/002_intel_seed_data.sql
```

If you use Docker Compose locally, make sure the SQL Server container is healthy before running the scripts.
