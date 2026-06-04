-- Production notification platform expansion.
-- Idempotent: safe to run after 001_core_schema.sql and 003_security_enhancements.sql.

SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

IF OBJECT_ID('core.Notifications', 'U') IS NOT NULL
BEGIN
    IF COL_LENGTH('core.Notifications', 'TemplateKey') IS NULL
        ALTER TABLE core.Notifications ADD TemplateKey NVARCHAR(120) NOT NULL CONSTRAINT DF_core_Notifications_TemplateKey DEFAULT 'general';
    IF COL_LENGTH('core.Notifications', 'TemplateVersion') IS NULL
        ALTER TABLE core.Notifications ADD TemplateVersion INT NOT NULL CONSTRAINT DF_core_Notifications_TemplateVersion DEFAULT 1;
    IF COL_LENGTH('core.Notifications', 'Category') IS NULL
        ALTER TABLE core.Notifications ADD Category NVARCHAR(40) NOT NULL CONSTRAINT DF_core_Notifications_Category DEFAULT 'general';
    IF COL_LENGTH('core.Notifications', 'Priority') IS NULL
        ALTER TABLE core.Notifications ADD Priority NVARCHAR(20) NOT NULL CONSTRAINT DF_core_Notifications_Priority DEFAULT 'normal';
    IF COL_LENGTH('core.Notifications', 'ActionUrl') IS NULL
        ALTER TABLE core.Notifications ADD ActionUrl NVARCHAR(500) NULL;
    IF COL_LENGTH('core.Notifications', 'ActorUserId') IS NULL
        ALTER TABLE core.Notifications ADD ActorUserId UNIQUEIDENTIFIER NULL;
    IF COL_LENGTH('core.Notifications', 'ReferenceType') IS NULL
        ALTER TABLE core.Notifications ADD ReferenceType NVARCHAR(60) NULL;
    IF COL_LENGTH('core.Notifications', 'SourceEventId') IS NULL
        ALTER TABLE core.Notifications ADD SourceEventId NVARCHAR(160) NULL;
    IF COL_LENGTH('core.Notifications', 'GroupKey') IS NULL
        ALTER TABLE core.Notifications ADD GroupKey NVARCHAR(180) NULL;
    IF COL_LENGTH('core.Notifications', 'MetadataJson') IS NULL
        ALTER TABLE core.Notifications ADD MetadataJson NVARCHAR(4000) NULL;
    IF COL_LENGTH('core.Notifications', 'ReadAt') IS NULL
        ALTER TABLE core.Notifications ADD ReadAt DATETIMEOFFSET NULL;
    IF COL_LENGTH('core.Notifications', 'ExpiresAt') IS NULL
        ALTER TABLE core.Notifications ADD ExpiresAt DATETIMEOFFSET NULL;
    IF COL_LENGTH('core.Notifications', 'ArchivedAt') IS NULL
        ALTER TABLE core.Notifications ADD ArchivedAt DATETIMEOFFSET NULL;
END;
GO

IF OBJECT_ID('core.Notifications', 'U') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_core_Notifications_User_Category_CreatedAt' AND object_id = OBJECT_ID('core.Notifications'))
BEGIN
    CREATE INDEX IX_core_Notifications_User_Category_CreatedAt ON core.Notifications (UserId, Category, CreatedAt);
END;
GO

IF OBJECT_ID('core.Notifications', 'U') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_core_Notifications_User_SourceEvent' AND object_id = OBJECT_ID('core.Notifications'))
BEGIN
    CREATE UNIQUE INDEX UX_core_Notifications_User_SourceEvent ON core.Notifications (UserId, SourceEventId) WHERE SourceEventId IS NOT NULL;
END;
GO

IF OBJECT_ID('core.Notifications', 'U') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_core_Notifications_GroupKey' AND object_id = OBJECT_ID('core.Notifications'))
BEGIN
    CREATE INDEX IX_core_Notifications_GroupKey ON core.Notifications (GroupKey) WHERE GroupKey IS NOT NULL;
END;
GO

IF OBJECT_ID('core.NotificationPreferences', 'U') IS NULL
BEGIN
    CREATE TABLE core.NotificationPreferences (
        Id UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_core_NotificationPreferences PRIMARY KEY DEFAULT NEWID(),
        UserId UNIQUEIDENTIFIER NOT NULL,
        Category NVARCHAR(40) NOT NULL,
        InAppEnabled BIT NOT NULL CONSTRAINT DF_core_NotificationPreferences_InApp DEFAULT 1,
        PushEnabled BIT NOT NULL CONSTRAINT DF_core_NotificationPreferences_Push DEFAULT 1,
        EmailEnabled BIT NOT NULL CONSTRAINT DF_core_NotificationPreferences_Email DEFAULT 0,
        DigestCadence NVARCHAR(20) NOT NULL CONSTRAINT DF_core_NotificationPreferences_Digest DEFAULT 'daily',
        QuietHoursStartMinutes INT NULL,
        QuietHoursEndMinutes INT NULL,
        TimeZoneId NVARCHAR(80) NOT NULL CONSTRAINT DF_core_NotificationPreferences_TimeZone DEFAULT 'UTC',
        CreatedAt DATETIMEOFFSET NOT NULL CONSTRAINT DF_core_NotificationPreferences_CreatedAt DEFAULT SYSDATETIMEOFFSET(),
        UpdatedAt DATETIMEOFFSET NOT NULL CONSTRAINT DF_core_NotificationPreferences_UpdatedAt DEFAULT SYSDATETIMEOFFSET(),
        CONSTRAINT FK_core_NotificationPreferences_User FOREIGN KEY (UserId) REFERENCES core.Users(Id),
        CONSTRAINT UX_core_NotificationPreferences_User_Category UNIQUE (UserId, Category)
    );
END;
GO

IF OBJECT_ID('core.PushSubscriptions', 'U') IS NULL
BEGIN
    CREATE TABLE core.PushSubscriptions (
        Id UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_core_PushSubscriptions PRIMARY KEY DEFAULT NEWID(),
        UserId UNIQUEIDENTIFIER NOT NULL,
        Endpoint NVARCHAR(1200) NOT NULL,
        P256dh NVARCHAR(256) NOT NULL,
        Auth NVARCHAR(256) NOT NULL,
        UserAgent NVARCHAR(300) NULL,
        IsEnabled BIT NOT NULL CONSTRAINT DF_core_PushSubscriptions_IsEnabled DEFAULT 1,
        CreatedAt DATETIMEOFFSET NOT NULL CONSTRAINT DF_core_PushSubscriptions_CreatedAt DEFAULT SYSDATETIMEOFFSET(),
        UpdatedAt DATETIMEOFFSET NOT NULL CONSTRAINT DF_core_PushSubscriptions_UpdatedAt DEFAULT SYSDATETIMEOFFSET(),
        LastUsedAt DATETIMEOFFSET NULL,
        RevokedAt DATETIMEOFFSET NULL,
        CONSTRAINT FK_core_PushSubscriptions_User FOREIGN KEY (UserId) REFERENCES core.Users(Id),
        CONSTRAINT UX_core_PushSubscriptions_Endpoint UNIQUE (Endpoint)
    );
    CREATE INDEX IX_core_PushSubscriptions_User_Enabled ON core.PushSubscriptions (UserId, IsEnabled);
END;
GO

IF OBJECT_ID('core.NotificationOutbox', 'U') IS NULL
BEGIN
    CREATE TABLE core.NotificationOutbox (
        Id UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_core_NotificationOutbox PRIMARY KEY DEFAULT NEWID(),
        SourceEventId NVARCHAR(160) NOT NULL,
        EventType NVARCHAR(80) NOT NULL,
        PayloadJson NVARCHAR(MAX) NOT NULL,
        Status NVARCHAR(20) NOT NULL CONSTRAINT DF_core_NotificationOutbox_Status DEFAULT 'pending',
        Attempts INT NOT NULL CONSTRAINT DF_core_NotificationOutbox_Attempts DEFAULT 0,
        AvailableAt DATETIMEOFFSET NOT NULL CONSTRAINT DF_core_NotificationOutbox_AvailableAt DEFAULT SYSDATETIMEOFFSET(),
        CreatedAt DATETIMEOFFSET NOT NULL CONSTRAINT DF_core_NotificationOutbox_CreatedAt DEFAULT SYSDATETIMEOFFSET(),
        UpdatedAt DATETIMEOFFSET NOT NULL CONSTRAINT DF_core_NotificationOutbox_UpdatedAt DEFAULT SYSDATETIMEOFFSET(),
        LastError NVARCHAR(1000) NULL,
        CONSTRAINT UX_core_NotificationOutbox_SourceEvent UNIQUE (SourceEventId)
    );
    CREATE INDEX IX_core_NotificationOutbox_Status_AvailableAt ON core.NotificationOutbox (Status, AvailableAt);
END;
GO

IF OBJECT_ID('core.NotificationDeliveries', 'U') IS NULL
BEGIN
    CREATE TABLE core.NotificationDeliveries (
        Id UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_core_NotificationDeliveries PRIMARY KEY DEFAULT NEWID(),
        NotificationId UNIQUEIDENTIFIER NOT NULL,
        UserId UNIQUEIDENTIFIER NOT NULL,
        Channel NVARCHAR(20) NOT NULL,
        Status NVARCHAR(20) NOT NULL CONSTRAINT DF_core_NotificationDeliveries_Status DEFAULT 'pending',
        Attempts INT NOT NULL CONSTRAINT DF_core_NotificationDeliveries_Attempts DEFAULT 0,
        NextAttemptAt DATETIMEOFFSET NOT NULL CONSTRAINT DF_core_NotificationDeliveries_NextAttemptAt DEFAULT SYSDATETIMEOFFSET(),
        CreatedAt DATETIMEOFFSET NOT NULL CONSTRAINT DF_core_NotificationDeliveries_CreatedAt DEFAULT SYSDATETIMEOFFSET(),
        UpdatedAt DATETIMEOFFSET NOT NULL CONSTRAINT DF_core_NotificationDeliveries_UpdatedAt DEFAULT SYSDATETIMEOFFSET(),
        ProviderMessageId NVARCHAR(200) NULL,
        ErrorCode NVARCHAR(80) NULL,
        LastError NVARCHAR(1000) NULL,
        CONSTRAINT FK_core_NotificationDeliveries_Notification FOREIGN KEY (NotificationId) REFERENCES core.Notifications(Id),
        CONSTRAINT UX_core_NotificationDeliveries_Notification_Channel UNIQUE (NotificationId, Channel)
    );
    CREATE INDEX IX_core_NotificationDeliveries_Status_NextAttemptAt ON core.NotificationDeliveries (Status, NextAttemptAt);
END;
GO

IF OBJECT_ID('core.UserBlocks', 'U') IS NULL
BEGIN
    CREATE TABLE core.UserBlocks (
        Id UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_core_UserBlocks PRIMARY KEY DEFAULT NEWID(),
        BlockerId UNIQUEIDENTIFIER NOT NULL,
        BlockedId UNIQUEIDENTIFIER NOT NULL,
        CreatedAt DATETIMEOFFSET NOT NULL CONSTRAINT DF_core_UserBlocks_CreatedAt DEFAULT SYSDATETIMEOFFSET(),
        CONSTRAINT FK_core_UserBlocks_Blocker FOREIGN KEY (BlockerId) REFERENCES core.Users(Id),
        CONSTRAINT FK_core_UserBlocks_Blocked FOREIGN KEY (BlockedId) REFERENCES core.Users(Id),
        CONSTRAINT UX_core_UserBlocks_Blocker_Blocked UNIQUE (BlockerId, BlockedId)
    );
END;
GO

IF OBJECT_ID('core.UserReports', 'U') IS NULL
BEGIN
    CREATE TABLE core.UserReports (
        Id UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_core_UserReports PRIMARY KEY DEFAULT NEWID(),
        ReporterId UNIQUEIDENTIFIER NOT NULL,
        TargetUserId UNIQUEIDENTIFIER NULL,
        TargetType NVARCHAR(60) NOT NULL,
        TargetId NVARCHAR(120) NOT NULL,
        Reason NVARCHAR(80) NOT NULL,
        Details NVARCHAR(1000) NULL,
        Status NVARCHAR(20) NOT NULL CONSTRAINT DF_core_UserReports_Status DEFAULT 'open',
        CreatedAt DATETIMEOFFSET NOT NULL CONSTRAINT DF_core_UserReports_CreatedAt DEFAULT SYSDATETIMEOFFSET(),
        ResolvedAt DATETIMEOFFSET NULL,
        CONSTRAINT FK_core_UserReports_Reporter FOREIGN KEY (ReporterId) REFERENCES core.Users(Id)
    );
    CREATE INDEX IX_core_UserReports_Status_CreatedAt ON core.UserReports (Status, CreatedAt);
END;
GO
