IF NOT EXISTS (SELECT 1 FROM sys.schemas WHERE name = 'core')
BEGIN
    EXEC('CREATE SCHEMA core');
END;
GO

IF OBJECT_ID('core.Users', 'U') IS NULL
BEGIN
    CREATE TABLE core.Users (
        Id UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_core_Users PRIMARY KEY DEFAULT NEWID(),
        Username NVARCHAR(50) NOT NULL,
        Email NVARCHAR(255) NOT NULL,
        PasswordHash NVARCHAR(MAX) NOT NULL,
        DisplayName NVARCHAR(100) NULL,
        AvatarUrl NVARCHAR(500) NULL,
        Bio NVARCHAR(500) NULL,
        CreatedAt DATETIME2 NOT NULL CONSTRAINT DF_core_Users_CreatedAt DEFAULT GETUTCDATE(),
        UpdatedAt DATETIME2 NOT NULL CONSTRAINT DF_core_Users_UpdatedAt DEFAULT GETUTCDATE(),
        IsActive BIT NOT NULL CONSTRAINT DF_core_Users_IsActive DEFAULT 1,
        LastLoginAt DATETIME2 NULL,
        CONSTRAINT UQ_core_Users_Username UNIQUE (Username),
        CONSTRAINT UQ_core_Users_Email UNIQUE (Email)
    );
END;
GO

IF OBJECT_ID('core.Friendships', 'U') IS NULL
BEGIN
    CREATE TABLE core.Friendships (
        Id UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_core_Friendships PRIMARY KEY DEFAULT NEWID(),
        RequesterId UNIQUEIDENTIFIER NOT NULL,
        AddresseeId UNIQUEIDENTIFIER NOT NULL,
        Status NVARCHAR(20) NOT NULL,
        CreatedAt DATETIME2 NOT NULL CONSTRAINT DF_core_Friendships_CreatedAt DEFAULT GETUTCDATE(),
        CONSTRAINT FK_core_Friendships_Requester FOREIGN KEY (RequesterId) REFERENCES core.Users(Id),
        CONSTRAINT FK_core_Friendships_Addressee FOREIGN KEY (AddresseeId) REFERENCES core.Users(Id),
        CONSTRAINT CK_core_Friendships_Status CHECK (Status IN ('pending', 'accepted', 'declined', 'blocked')),
        CONSTRAINT UQ_core_Friendships_Requester_Addressee UNIQUE (RequesterId, AddresseeId)
    );
END;
GO

IF OBJECT_ID('core.Notifications', 'U') IS NULL
BEGIN
    CREATE TABLE core.Notifications (
        Id UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_core_Notifications PRIMARY KEY DEFAULT NEWID(),
        UserId UNIQUEIDENTIFIER NOT NULL,
        Type NVARCHAR(50) NOT NULL,
        Title NVARCHAR(200) NOT NULL,
        Body NVARCHAR(1000) NULL,
        ReferenceId NVARCHAR(100) NULL,
        IsRead BIT NOT NULL CONSTRAINT DF_core_Notifications_IsRead DEFAULT 0,
        CreatedAt DATETIME2 NOT NULL CONSTRAINT DF_core_Notifications_CreatedAt DEFAULT GETUTCDATE(),
        CONSTRAINT FK_core_Notifications_User FOREIGN KEY (UserId) REFERENCES core.Users(Id)
    );
END;
GO

IF OBJECT_ID('core.LiveSessions', 'U') IS NULL
BEGIN
    CREATE TABLE core.LiveSessions (
        Id UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_core_LiveSessions PRIMARY KEY DEFAULT NEWID(),
        TripId UNIQUEIDENTIFIER NOT NULL,
        UserId UNIQUEIDENTIFIER NOT NULL,
        Latitude FLOAT NOT NULL,
        Longitude FLOAT NOT NULL,
        IsActive BIT NOT NULL CONSTRAINT DF_core_LiveSessions_IsActive DEFAULT 1,
        LastPingAt DATETIME2 NOT NULL CONSTRAINT DF_core_LiveSessions_LastPingAt DEFAULT GETUTCDATE(),
        CONSTRAINT FK_core_LiveSessions_User FOREIGN KEY (UserId) REFERENCES core.Users(Id)
    );
END;
GO
