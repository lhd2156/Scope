"""Full-text search index for spot title/description/vibe/city.

The spot search endpoint (`GET /api/content/spots?q=...`) currently compiles
to ``WHERE title LIKE '%q%' OR description LIKE '%q%' OR vibe LIKE '%q%'``.
A leading wildcard defeats every btree index in every SQL dialect, so at
scale this is a table scan per request. This migration adds a proper FTS
index where the database supports one natively:

* **SQL Server** — CONTAINS / FREETEXT via a fulltext catalog + index.
  Requires the Full-Text Search feature to be installed (it is on Azure SQL,
  SQL Server Developer/Standard/Enterprise; it is NOT on SQL Server Express
  Core edition). We ship a FT catalog and index on title/description/vibe/city
  so operator-tuned LANGUAGE clauses work.
* **PostgreSQL** — a GIN index over tsvector('english', title || description).
  Works out of the box; no extension beyond the default `btree_gin` is
  required (tsvector is a core type).
* **SQLite / MySQL / others** — skipped. SQLite dev/test DBs don't need it,
  and MySQL's FT index is less flexible than a follow-up patch warrants.

The search endpoint can then prefer FTS when `connection.vendor` is `mssql`
or `postgresql`, falling back to `__icontains` otherwise. That plumbing is
a separate, reversible view change; this migration is index-only.

Safety:
  * Idempotent: `IF NOT EXISTS` guards every DDL statement, so re-running
    the migration on a DB that already has the catalog/index is a no-op.
  * Reversible: the `reverse_sql` block drops the catalog + index cleanly.
  * Skipped on unsupported engines: `RunSQL` bodies are gated on
    `schema_editor.connection.vendor`, so sqlite tests don't explode.
"""

from __future__ import annotations

import os

from django.db import migrations


MSSQL_CREATE_FTS = """
IF ISNULL(FULLTEXTSERVICEPROPERTY('IsFullTextInstalled'), 0) = 1
BEGIN
    IF NOT EXISTS (SELECT 1 FROM sys.fulltext_catalogs WHERE name = 'scope_spots_ftc')
    BEGIN
        CREATE FULLTEXT CATALOG scope_spots_ftc AS DEFAULT;
    END
    IF NOT EXISTS (
        SELECT 1 FROM sys.fulltext_indexes fi
        JOIN sys.objects o ON fi.object_id = o.object_id
        WHERE o.name = 'spots_spot'
    )
    BEGIN
        CREATE FULLTEXT INDEX ON dbo.spots_spot(
            title LANGUAGE 1033,
            description LANGUAGE 1033,
            vibe LANGUAGE 1033,
            city LANGUAGE 1033
        )
        KEY INDEX PK_spots_spot
        ON scope_spots_ftc
        WITH CHANGE_TRACKING AUTO;
    END
END
"""

MSSQL_DROP_FTS = """
IF ISNULL(FULLTEXTSERVICEPROPERTY('IsFullTextInstalled'), 0) = 1
BEGIN
    IF EXISTS (
        SELECT 1 FROM sys.fulltext_indexes fi
        JOIN sys.objects o ON fi.object_id = o.object_id
        WHERE o.name = 'spots_spot'
    )
    BEGIN
        DROP FULLTEXT INDEX ON dbo.spots_spot;
    END
    IF EXISTS (SELECT 1 FROM sys.fulltext_catalogs WHERE name = 'scope_spots_ftc')
    BEGIN
        DROP FULLTEXT CATALOG scope_spots_ftc;
    END
END
"""

POSTGRES_CREATE_FTS = """
CREATE INDEX IF NOT EXISTS spot_fts_idx
    ON spots_spot
    USING GIN (
        to_tsvector('english',
            coalesce(title,'') || ' ' ||
            coalesce(description,'') || ' ' ||
            coalesce(vibe,'') || ' ' ||
            coalesce(city,'')
        )
    );
"""

POSTGRES_DROP_FTS = "DROP INDEX IF EXISTS spot_fts_idx;"


def _apply_fts(apps, schema_editor):
    vendor = schema_editor.connection.vendor
    if vendor == 'microsoft':
        enabled = os.getenv('SCOPE_ENABLE_MSSQL_FTS', '').lower() in {'1', 'true', 'yes'}
        if not enabled:
            return
        schema_editor.execute(MSSQL_CREATE_FTS)
    elif vendor == 'postgresql':
        schema_editor.execute(POSTGRES_CREATE_FTS)
    # sqlite / mysql: fall back to icontains scan (dev + test harnesses).


def _drop_fts(apps, schema_editor):
    vendor = schema_editor.connection.vendor
    if vendor == 'microsoft':
        schema_editor.execute(MSSQL_DROP_FTS)
    elif vendor == 'postgresql':
        schema_editor.execute(POSTGRES_DROP_FTS)


class Migration(migrations.Migration):

    dependencies = [
        ('spots', '0002_perf_indexes'),
    ]

    operations = [
        migrations.RunPython(_apply_fts, reverse_code=_drop_fts),
    ]
