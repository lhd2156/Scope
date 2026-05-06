-- Migration 003: security enhancements.
--
-- Additive migration for the security work shipped in Phase 14:
--   * account lockout columns on Users (failed logins + lockout window)
--   * Role on Users, for older databases created before role claims shipped
--   * refresh-token rotation / replay metadata on RefreshTokens
--   * RefreshTokens itself, if running against a pre-`EnsureCreated` database
--   * email verification + TOTP MFA state on Users
--   * PasswordResets table for single-use, expiring reset tokens
--
-- Every block is guarded so this file is safe to run on any database that
-- already has the Scope core schema. Run it after `001_core_schema.sql`.

IF COL_LENGTH('core.Users', 'Role') IS NULL
BEGIN
    ALTER TABLE core.Users
        ADD Role NVARCHAR(20) NOT NULL CONSTRAINT DF_core_Users_Role DEFAULT 'user';
END;
GO

IF COL_LENGTH('core.Users', 'PhoneNumber') IS NULL
BEGIN
    ALTER TABLE core.Users ADD PhoneNumber NVARCHAR(32) NULL;
END;
GO

IF COL_LENGTH('core.Users', 'DateOfBirth') IS NULL
BEGIN
    ALTER TABLE core.Users ADD DateOfBirth DATE NULL;
END;
GO

IF OBJECT_ID('core.Users', 'U') IS NOT NULL
   AND COL_LENGTH('core.Users', 'PhoneNumber') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_core_Users_PhoneNumber' AND object_id = OBJECT_ID('core.Users'))
BEGIN
    CREATE UNIQUE INDEX IX_core_Users_PhoneNumber ON core.Users (PhoneNumber) WHERE PhoneNumber IS NOT NULL;
END;
GO

IF COL_LENGTH('core.Users', 'FailedLoginAttempts') IS NULL
BEGIN
    ALTER TABLE core.Users
        ADD FailedLoginAttempts INT NOT NULL CONSTRAINT DF_core_Users_FailedLoginAttempts DEFAULT 0;
END;
GO

IF COL_LENGTH('core.Users', 'LockoutUntil') IS NULL
BEGIN
    ALTER TABLE core.Users ADD LockoutUntil DATETIME2 NULL;
END;
GO

IF COL_LENGTH('core.Users', 'EmailVerifiedAt') IS NULL
BEGIN
    ALTER TABLE core.Users ADD EmailVerifiedAt DATETIME2 NULL;
END;
GO

IF COL_LENGTH('core.Users', 'EmailVerificationTokenHash') IS NULL
BEGIN
    ALTER TABLE core.Users ADD EmailVerificationTokenHash NVARCHAR(128) NULL;
END;
GO

IF COL_LENGTH('core.Users', 'EmailVerificationSentAt') IS NULL
BEGIN
    ALTER TABLE core.Users ADD EmailVerificationSentAt DATETIME2 NULL;
END;
GO

IF COL_LENGTH('core.Users', 'MfaEnabled') IS NULL
BEGIN
    ALTER TABLE core.Users
        ADD MfaEnabled BIT NOT NULL CONSTRAINT DF_core_Users_MfaEnabled DEFAULT 0;
END;
GO

IF COL_LENGTH('core.Users', 'MfaSecret') IS NULL
BEGIN
    -- Encrypted/base32-encoded TOTP shared secret. Never return to the client
    -- after enrollment; once MFA is active the secret must be rotated to change.
    ALTER TABLE core.Users ADD MfaSecret NVARCHAR(128) NULL;
END;
GO

IF COL_LENGTH('core.Users', 'MfaRecoveryCodesHash') IS NULL
BEGIN
    -- Comma-separated SHA-256 hashes of single-use recovery codes.
    ALTER TABLE core.Users ADD MfaRecoveryCodesHash NVARCHAR(MAX) NULL;
END;
GO

IF OBJECT_ID('core.RefreshTokens', 'U') IS NULL
BEGIN
    CREATE TABLE core.RefreshTokens (
        Id UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_core_RefreshTokens PRIMARY KEY DEFAULT NEWID(),
        UserId UNIQUEIDENTIFIER NOT NULL,
        Token NVARCHAR(128) NOT NULL,
        ExpiresAt DATETIME2 NOT NULL,
        RevokedAt DATETIME2 NULL,
        CreatedAt DATETIME2 NOT NULL CONSTRAINT DF_core_RefreshTokens_CreatedAt DEFAULT GETUTCDATE(),
        ReplacedByTokenHash NVARCHAR(128) NULL,
        RevokedReason NVARCHAR(64) NULL,
        CONSTRAINT FK_core_RefreshTokens_User FOREIGN KEY (UserId) REFERENCES core.Users(Id),
        CONSTRAINT UQ_core_RefreshTokens_Token UNIQUE (Token)
    );
END;
GO

IF COL_LENGTH('core.RefreshTokens', 'ReplacedByTokenHash') IS NULL
BEGIN
    ALTER TABLE core.RefreshTokens ADD ReplacedByTokenHash NVARCHAR(128) NULL;
END;
GO

IF COL_LENGTH('core.RefreshTokens', 'RevokedReason') IS NULL
BEGIN
    ALTER TABLE core.RefreshTokens ADD RevokedReason NVARCHAR(64) NULL;
END;
GO

IF OBJECT_ID('core.PasswordResets', 'U') IS NULL
BEGIN
    CREATE TABLE core.PasswordResets (
        Id UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_core_PasswordResets PRIMARY KEY DEFAULT NEWID(),
        UserId UNIQUEIDENTIFIER NOT NULL,
        -- SHA-256 hash of the token we email to the user. The plaintext token
        -- lives only in the outbound email and the user's clipboard.
        TokenHash NVARCHAR(128) NOT NULL,
        ExpiresAt DATETIME2 NOT NULL,
        CreatedAt DATETIME2 NOT NULL CONSTRAINT DF_core_PasswordResets_CreatedAt DEFAULT GETUTCDATE(),
        ConsumedAt DATETIME2 NULL,
        RequestIpHash NVARCHAR(128) NULL,
        CONSTRAINT FK_core_PasswordResets_User FOREIGN KEY (UserId) REFERENCES core.Users(Id),
        CONSTRAINT UQ_core_PasswordResets_TokenHash UNIQUE (TokenHash)
    );
    CREATE INDEX IX_core_PasswordResets_UserId_Expires ON core.PasswordResets (UserId, ExpiresAt);
END;
GO
