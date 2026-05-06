-- Scope least-privilege application login.
--
-- Purpose: the services (Core, Content, Intel) must NEVER connect as `sa`.
-- This script creates a single server login + database user scoped to the
-- three app schemas with the minimum DML permissions they need. It is safe
-- to re-run (guards on existence) and is run before any schema scripts.
--
-- Usage (local docker-compose):
--   1. `SA_PASSWORD` bootstraps the container
--   2. This script creates `scope_app` with `${DB_PASSWORD}`
--   3. Services connect using `DB_USER=scope_app` + `DB_PASSWORD=...`
--
-- Production: drop `sa` entirely behind the network boundary, rotate both
-- credentials, and consider Managed Identity / Entra ID auth. See SECURITY.md.

USE master;
GO

DECLARE @AppLogin SYSNAME = N'scope_app';
DECLARE @AppPassword NVARCHAR(256) = ISNULL(
    NULLIF(CONVERT(NVARCHAR(256), SERVERPROPERTY('ScopeAppPassword')), N''),
    N'$(DB_PASSWORD)'
);

IF @AppPassword IS NULL OR @AppPassword = N'' OR @AppPassword LIKE N'%DB_PASSWORD%'
BEGIN
    RAISERROR(N'DB_PASSWORD must be provided via sqlcmd :setvar DB_PASSWORD "<secret>"', 16, 1);
    RETURN;
END;

IF NOT EXISTS (SELECT 1 FROM sys.server_principals WHERE name = @AppLogin)
BEGIN
    DECLARE @sql NVARCHAR(MAX) = N'CREATE LOGIN [' + @AppLogin + N'] WITH PASSWORD = N''' +
        REPLACE(@AppPassword, N'''', N'''''') +
        N''', CHECK_POLICY = ON, CHECK_EXPIRATION = OFF, DEFAULT_DATABASE = [ScopeDb];';
    EXEC sp_executesql @sql;
END;
GO

IF DB_ID(N'ScopeDb') IS NULL
BEGIN
    CREATE DATABASE ScopeDb;
END;
GO

USE ScopeDb;
GO

IF NOT EXISTS (SELECT 1 FROM sys.database_principals WHERE name = N'scope_app')
BEGIN
    CREATE USER [scope_app] FOR LOGIN [scope_app];
END;
GO

-- Grant per-schema permissions instead of db_owner. Services can read, write,
-- and execute procs in their own schema but cannot ALTER schema or drop
-- objects. Schema migrations should be run by a separate migration user
-- (not yet provisioned here; tracked in SECURITY.md).
IF SCHEMA_ID(N'core') IS NOT NULL
BEGIN
    GRANT SELECT, INSERT, UPDATE, DELETE, EXECUTE ON SCHEMA::core TO [scope_app];
END;
IF SCHEMA_ID(N'content') IS NOT NULL
BEGIN
    GRANT SELECT, INSERT, UPDATE, DELETE, EXECUTE ON SCHEMA::content TO [scope_app];
END;
IF SCHEMA_ID(N'intel') IS NOT NULL
BEGIN
    GRANT SELECT, INSERT, UPDATE, DELETE, EXECUTE ON SCHEMA::intel TO [scope_app];
END;
IF SCHEMA_ID(N'dbo') IS NOT NULL
BEGIN
    -- Needed for EF Core's migration history table which defaults to dbo.
    GRANT SELECT, INSERT, UPDATE, DELETE ON SCHEMA::dbo TO [scope_app];
END;
GO
