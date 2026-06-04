-- Migration 005: align Core date/time columns with DateTimeOffset domain models.
--
-- Older local and long-lived SQL Server databases may have been bootstrapped
-- from scripts that used DATETIME2 while the Core EF entities use
-- DateTimeOffset. SQL Server's provider materializes those as DateTime, which
-- breaks live production paths that read the rows back. This idempotent repair
-- keeps existing data and moves the storage type to DATETIMEOFFSET.

SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

CREATE OR ALTER PROCEDURE core.__AlignDateTimeOffsetColumn
    @TableName SYSNAME,
    @ColumnName SYSNAME,
    @IsNullable BIT,
    @DefaultExpression NVARCHAR(128) = NULL
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @ObjectId INT = OBJECT_ID(N'core.' + QUOTENAME(@TableName), N'U');
    IF @ObjectId IS NULL
        RETURN;

    IF NOT EXISTS (
        SELECT 1
        FROM sys.columns
        WHERE object_id = @ObjectId
          AND name = @ColumnName
    )
        RETURN;

    DECLARE @DefaultName SYSNAME;
    SELECT @DefaultName = dc.name
    FROM sys.default_constraints dc
    INNER JOIN sys.columns c
        ON c.object_id = dc.parent_object_id
       AND c.column_id = dc.parent_column_id
    WHERE dc.parent_object_id = @ObjectId
      AND c.name = @ColumnName;

    IF @DefaultName IS NOT NULL
    BEGIN
        DECLARE @DropSql NVARCHAR(MAX) =
            N'ALTER TABLE core.' + QUOTENAME(@TableName) +
            N' DROP CONSTRAINT ' + QUOTENAME(@DefaultName) + N';';
        EXEC sp_executesql @DropSql;
    END;

    IF EXISTS (
        SELECT 1
        FROM sys.columns c
        INNER JOIN sys.types t ON t.user_type_id = c.user_type_id
        WHERE c.object_id = @ObjectId
          AND c.name = @ColumnName
          AND t.name <> N'datetimeoffset'
    )
    BEGIN
        DECLARE @AlterSql NVARCHAR(MAX) =
            N'ALTER TABLE core.' + QUOTENAME(@TableName) +
            N' ALTER COLUMN ' + QUOTENAME(@ColumnName) +
            N' DATETIMEOFFSET ' +
            CASE WHEN @IsNullable = 1 THEN N'NULL' ELSE N'NOT NULL' END + N';';
        EXEC sp_executesql @AlterSql;
    END;

    IF @DefaultExpression IS NOT NULL
       AND NOT EXISTS (
           SELECT 1
           FROM sys.default_constraints dc
           INNER JOIN sys.columns c
               ON c.object_id = dc.parent_object_id
              AND c.column_id = dc.parent_column_id
           WHERE dc.parent_object_id = @ObjectId
             AND c.name = @ColumnName
       )
    BEGIN
        DECLARE @ConstraintName SYSNAME = LEFT(N'DF_core_' + @TableName + N'_' + @ColumnName, 128);
        DECLARE @AddSql NVARCHAR(MAX) =
            N'ALTER TABLE core.' + QUOTENAME(@TableName) +
            N' ADD CONSTRAINT ' + QUOTENAME(@ConstraintName) +
            N' DEFAULT ' + @DefaultExpression +
            N' FOR ' + QUOTENAME(@ColumnName) + N';';
        EXEC sp_executesql @AddSql;
    END;
END;
GO

IF OBJECT_ID('core.PasswordResets', 'U') IS NOT NULL
   AND EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_core_PasswordResets_UserId_Expires' AND object_id = OBJECT_ID('core.PasswordResets'))
BEGIN
    DROP INDEX IX_core_PasswordResets_UserId_Expires ON core.PasswordResets;
END;
GO

IF OBJECT_ID('core.UserPresence', 'U') IS NOT NULL
   AND EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_core_UserPresence_Status_LastActiveAt' AND object_id = OBJECT_ID('core.UserPresence'))
BEGIN
    DROP INDEX IX_core_UserPresence_Status_LastActiveAt ON core.UserPresence;
END;
GO

IF OBJECT_ID('core.Notifications', 'U') IS NOT NULL
   AND EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_core_Notifications_User_Category_CreatedAt' AND object_id = OBJECT_ID('core.Notifications'))
BEGIN
    DROP INDEX IX_core_Notifications_User_Category_CreatedAt ON core.Notifications;
END;
GO

IF OBJECT_ID('core.NotificationOutbox', 'U') IS NOT NULL
   AND EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_core_NotificationOutbox_Status_AvailableAt' AND object_id = OBJECT_ID('core.NotificationOutbox'))
BEGIN
    DROP INDEX IX_core_NotificationOutbox_Status_AvailableAt ON core.NotificationOutbox;
END;
GO

IF OBJECT_ID('core.NotificationDeliveries', 'U') IS NOT NULL
   AND EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_core_NotificationDeliveries_Status_NextAttemptAt' AND object_id = OBJECT_ID('core.NotificationDeliveries'))
BEGIN
    DROP INDEX IX_core_NotificationDeliveries_Status_NextAttemptAt ON core.NotificationDeliveries;
END;
GO

IF OBJECT_ID('core.UserReports', 'U') IS NOT NULL
   AND EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_core_UserReports_Status_CreatedAt' AND object_id = OBJECT_ID('core.UserReports'))
BEGIN
    DROP INDEX IX_core_UserReports_Status_CreatedAt ON core.UserReports;
END;
GO

EXEC core.__AlignDateTimeOffsetColumn N'Users', N'CreatedAt', 0, N'SYSDATETIMEOFFSET()';
EXEC core.__AlignDateTimeOffsetColumn N'Users', N'UpdatedAt', 0, N'SYSDATETIMEOFFSET()';
EXEC core.__AlignDateTimeOffsetColumn N'Users', N'LastLoginAt', 1, NULL;
EXEC core.__AlignDateTimeOffsetColumn N'Users', N'LockoutUntil', 1, NULL;
EXEC core.__AlignDateTimeOffsetColumn N'Users', N'EmailVerifiedAt', 1, NULL;
EXEC core.__AlignDateTimeOffsetColumn N'Users', N'EmailVerificationSentAt', 1, NULL;

EXEC core.__AlignDateTimeOffsetColumn N'RefreshTokens', N'ExpiresAt', 0, NULL;
EXEC core.__AlignDateTimeOffsetColumn N'RefreshTokens', N'RevokedAt', 1, NULL;
EXEC core.__AlignDateTimeOffsetColumn N'RefreshTokens', N'CreatedAt', 0, N'SYSDATETIMEOFFSET()';

EXEC core.__AlignDateTimeOffsetColumn N'PasswordResets', N'ExpiresAt', 0, NULL;
EXEC core.__AlignDateTimeOffsetColumn N'PasswordResets', N'CreatedAt', 0, N'SYSDATETIMEOFFSET()';
EXEC core.__AlignDateTimeOffsetColumn N'PasswordResets', N'ConsumedAt', 1, NULL;

EXEC core.__AlignDateTimeOffsetColumn N'Friendships', N'CreatedAt', 0, N'SYSDATETIMEOFFSET()';

EXEC core.__AlignDateTimeOffsetColumn N'Notifications', N'CreatedAt', 0, N'SYSDATETIMEOFFSET()';
EXEC core.__AlignDateTimeOffsetColumn N'Notifications', N'ReadAt', 1, NULL;
EXEC core.__AlignDateTimeOffsetColumn N'Notifications', N'ExpiresAt', 1, NULL;
EXEC core.__AlignDateTimeOffsetColumn N'Notifications', N'ArchivedAt', 1, NULL;

EXEC core.__AlignDateTimeOffsetColumn N'NotificationPreferences', N'CreatedAt', 0, N'SYSDATETIMEOFFSET()';
EXEC core.__AlignDateTimeOffsetColumn N'NotificationPreferences', N'UpdatedAt', 0, N'SYSDATETIMEOFFSET()';

EXEC core.__AlignDateTimeOffsetColumn N'PushSubscriptions', N'CreatedAt', 0, N'SYSDATETIMEOFFSET()';
EXEC core.__AlignDateTimeOffsetColumn N'PushSubscriptions', N'UpdatedAt', 0, N'SYSDATETIMEOFFSET()';
EXEC core.__AlignDateTimeOffsetColumn N'PushSubscriptions', N'LastUsedAt', 1, NULL;
EXEC core.__AlignDateTimeOffsetColumn N'PushSubscriptions', N'RevokedAt', 1, NULL;

EXEC core.__AlignDateTimeOffsetColumn N'NotificationOutbox', N'AvailableAt', 0, N'SYSDATETIMEOFFSET()';
EXEC core.__AlignDateTimeOffsetColumn N'NotificationOutbox', N'CreatedAt', 0, N'SYSDATETIMEOFFSET()';
EXEC core.__AlignDateTimeOffsetColumn N'NotificationOutbox', N'UpdatedAt', 0, N'SYSDATETIMEOFFSET()';

EXEC core.__AlignDateTimeOffsetColumn N'NotificationDeliveries', N'NextAttemptAt', 0, N'SYSDATETIMEOFFSET()';
EXEC core.__AlignDateTimeOffsetColumn N'NotificationDeliveries', N'CreatedAt', 0, N'SYSDATETIMEOFFSET()';
EXEC core.__AlignDateTimeOffsetColumn N'NotificationDeliveries', N'UpdatedAt', 0, N'SYSDATETIMEOFFSET()';

EXEC core.__AlignDateTimeOffsetColumn N'UserBlocks', N'CreatedAt', 0, N'SYSDATETIMEOFFSET()';

EXEC core.__AlignDateTimeOffsetColumn N'UserReports', N'CreatedAt', 0, N'SYSDATETIMEOFFSET()';
EXEC core.__AlignDateTimeOffsetColumn N'UserReports', N'ResolvedAt', 1, NULL;

EXEC core.__AlignDateTimeOffsetColumn N'LiveSessions', N'LastPingAt', 0, N'SYSDATETIMEOFFSET()';

EXEC core.__AlignDateTimeOffsetColumn N'UserPresence', N'LastActiveAt', 0, N'SYSDATETIMEOFFSET()';
EXEC core.__AlignDateTimeOffsetColumn N'UserPresence', N'LastPlanningAt', 1, NULL;
EXEC core.__AlignDateTimeOffsetColumn N'UserPresence', N'UpdatedAt', 0, N'SYSDATETIMEOFFSET()';
GO

IF OBJECT_ID('core.PasswordResets', 'U') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_core_PasswordResets_UserId_Expires' AND object_id = OBJECT_ID('core.PasswordResets'))
BEGIN
    CREATE INDEX IX_core_PasswordResets_UserId_Expires ON core.PasswordResets (UserId, ExpiresAt);
END;
GO

IF OBJECT_ID('core.UserPresence', 'U') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_core_UserPresence_Status_LastActiveAt' AND object_id = OBJECT_ID('core.UserPresence'))
BEGIN
    CREATE INDEX IX_core_UserPresence_Status_LastActiveAt ON core.UserPresence (Status, LastActiveAt);
END;
GO

IF OBJECT_ID('core.Notifications', 'U') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_core_Notifications_User_Category_CreatedAt' AND object_id = OBJECT_ID('core.Notifications'))
BEGIN
    CREATE INDEX IX_core_Notifications_User_Category_CreatedAt ON core.Notifications (UserId, Category, CreatedAt);
END;
GO

IF OBJECT_ID('core.NotificationOutbox', 'U') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_core_NotificationOutbox_Status_AvailableAt' AND object_id = OBJECT_ID('core.NotificationOutbox'))
BEGIN
    CREATE INDEX IX_core_NotificationOutbox_Status_AvailableAt ON core.NotificationOutbox (Status, AvailableAt);
END;
GO

IF OBJECT_ID('core.NotificationDeliveries', 'U') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_core_NotificationDeliveries_Status_NextAttemptAt' AND object_id = OBJECT_ID('core.NotificationDeliveries'))
BEGIN
    CREATE INDEX IX_core_NotificationDeliveries_Status_NextAttemptAt ON core.NotificationDeliveries (Status, NextAttemptAt);
END;
GO

IF OBJECT_ID('core.UserReports', 'U') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_core_UserReports_Status_CreatedAt' AND object_id = OBJECT_ID('core.UserReports'))
BEGIN
    CREATE INDEX IX_core_UserReports_Status_CreatedAt ON core.UserReports (Status, CreatedAt);
END;
GO

DROP PROCEDURE core.__AlignDateTimeOffsetColumn;
GO
