IF NOT EXISTS (SELECT 1 FROM sys.schemas WHERE name = 'content')
BEGIN
    EXEC('CREATE SCHEMA content');
END;
GO

IF OBJECT_ID('content.Spots', 'U') IS NULL
BEGIN
    CREATE TABLE content.Spots (
        Id UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_content_Spots PRIMARY KEY DEFAULT NEWID(),
        UserId UNIQUEIDENTIFIER NOT NULL,
        Title NVARCHAR(200) NOT NULL,
        Description NVARCHAR(2000) NULL,
        Latitude FLOAT NOT NULL,
        Longitude FLOAT NOT NULL,
        Address NVARCHAR(500) NULL,
        City NVARCHAR(100) NULL,
        Country NVARCHAR(100) NULL,
        Category NVARCHAR(50) NULL,
        Vibe NVARCHAR(50) NULL,
        Rating DECIMAL(2,1) NULL,
        VisitedAt DATE NULL,
        IsPublic BIT NOT NULL CONSTRAINT DF_content_Spots_IsPublic DEFAULT 1,
        CreatedAt DATETIME2 NOT NULL CONSTRAINT DF_content_Spots_CreatedAt DEFAULT GETUTCDATE(),
        UpdatedAt DATETIME2 NOT NULL CONSTRAINT DF_content_Spots_UpdatedAt DEFAULT GETUTCDATE(),
        CONSTRAINT CK_content_Spots_Category CHECK (Category IN ('food', 'nature', 'nightlife', 'culture', 'adventure', 'shopping', 'entertainment', 'scenic', 'other')),
        CONSTRAINT CK_content_Spots_Rating CHECK (Rating BETWEEN 1.0 AND 5.0)
    );
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Spots_Location' AND object_id = OBJECT_ID('content.Spots'))
    CREATE INDEX IX_Spots_Location ON content.Spots(Latitude, Longitude);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Spots_UserId' AND object_id = OBJECT_ID('content.Spots'))
    CREATE INDEX IX_Spots_UserId ON content.Spots(UserId);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Spots_Category' AND object_id = OBJECT_ID('content.Spots'))
    CREATE INDEX IX_Spots_Category ON content.Spots(Category);
GO

IF OBJECT_ID('content.Photos', 'U') IS NULL
BEGIN
    CREATE TABLE content.Photos (
        Id UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_content_Photos PRIMARY KEY DEFAULT NEWID(),
        SpotId UNIQUEIDENTIFIER NOT NULL,
        UserId UNIQUEIDENTIFIER NOT NULL,
        S3Key NVARCHAR(500) NOT NULL,
        S3Url NVARCHAR(1000) NOT NULL,
        ThumbnailUrl NVARCHAR(1000) NULL,
        Caption NVARCHAR(500) NULL,
        SortOrder INT NOT NULL CONSTRAINT DF_content_Photos_SortOrder DEFAULT 0,
        CreatedAt DATETIME2 NOT NULL CONSTRAINT DF_content_Photos_CreatedAt DEFAULT GETUTCDATE(),
        CONSTRAINT FK_content_Photos_Spot FOREIGN KEY (SpotId) REFERENCES content.Spots(Id) ON DELETE CASCADE
    );
END;
GO

IF OBJECT_ID('content.Trips', 'U') IS NULL
BEGIN
    CREATE TABLE content.Trips (
        Id UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_content_Trips PRIMARY KEY DEFAULT NEWID(),
        CreatorId UNIQUEIDENTIFIER NOT NULL,
        Title NVARCHAR(200) NOT NULL,
        Description NVARCHAR(2000) NULL,
        StartDate DATE NULL,
        EndDate DATE NULL,
        Budget DECIMAL(10,2) NULL,
        Currency NVARCHAR(3) NOT NULL CONSTRAINT DF_content_Trips_Currency DEFAULT 'USD',
        Status NVARCHAR(20) NULL,
        IsPublic BIT NOT NULL CONSTRAINT DF_content_Trips_IsPublic DEFAULT 1,
        CoverPhotoUrl NVARCHAR(1000) NULL,
        CreatedAt DATETIME2 NOT NULL CONSTRAINT DF_content_Trips_CreatedAt DEFAULT GETUTCDATE(),
        CONSTRAINT CK_content_Trips_Status CHECK (Status IN ('planning', 'active', 'completed', 'cancelled'))
    );
END;
GO

IF OBJECT_ID('content.TripSpots', 'U') IS NULL
BEGIN
    CREATE TABLE content.TripSpots (
        Id UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_content_TripSpots PRIMARY KEY DEFAULT NEWID(),
        TripId UNIQUEIDENTIFIER NOT NULL,
        SpotId UNIQUEIDENTIFIER NOT NULL,
        DayNumber INT NULL,
        SortOrder INT NOT NULL CONSTRAINT DF_content_TripSpots_SortOrder DEFAULT 0,
        Notes NVARCHAR(500) NULL,
        CONSTRAINT FK_content_TripSpots_Trip FOREIGN KEY (TripId) REFERENCES content.Trips(Id) ON DELETE CASCADE,
        CONSTRAINT FK_content_TripSpots_Spot FOREIGN KEY (SpotId) REFERENCES content.Spots(Id)
    );
END;
GO

IF OBJECT_ID('content.TripMembers', 'U') IS NULL
BEGIN
    CREATE TABLE content.TripMembers (
        Id UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_content_TripMembers PRIMARY KEY DEFAULT NEWID(),
        TripId UNIQUEIDENTIFIER NOT NULL,
        UserId UNIQUEIDENTIFIER NOT NULL,
        Role NVARCHAR(20) NULL,
        JoinedAt DATETIME2 NOT NULL CONSTRAINT DF_content_TripMembers_JoinedAt DEFAULT GETUTCDATE(),
        CONSTRAINT FK_content_TripMembers_Trip FOREIGN KEY (TripId) REFERENCES content.Trips(Id) ON DELETE CASCADE,
        CONSTRAINT CK_content_TripMembers_Role CHECK (Role IN ('owner', 'editor', 'viewer'))
    );
END;
GO

IF OBJECT_ID('content.Reviews', 'U') IS NULL
BEGIN
    CREATE TABLE content.Reviews (
        Id UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_content_Reviews PRIMARY KEY DEFAULT NEWID(),
        SpotId UNIQUEIDENTIFIER NOT NULL,
        UserId UNIQUEIDENTIFIER NOT NULL,
        Rating DECIMAL(2,1) NULL,
        Comment NVARCHAR(1000) NULL,
        CreatedAt DATETIME2 NOT NULL CONSTRAINT DF_content_Reviews_CreatedAt DEFAULT GETUTCDATE(),
        CONSTRAINT FK_content_Reviews_Spot FOREIGN KEY (SpotId) REFERENCES content.Spots(Id) ON DELETE CASCADE,
        CONSTRAINT CK_content_Reviews_Rating CHECK (Rating BETWEEN 1.0 AND 5.0),
        CONSTRAINT UQ_content_Reviews_Spot_User UNIQUE (SpotId, UserId)
    );
END;
GO

IF OBJECT_ID('content.Likes', 'U') IS NULL
BEGIN
    CREATE TABLE content.Likes (
        Id UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_content_Likes PRIMARY KEY DEFAULT NEWID(),
        SpotId UNIQUEIDENTIFIER NOT NULL,
        UserId UNIQUEIDENTIFIER NOT NULL,
        CreatedAt DATETIME2 NOT NULL CONSTRAINT DF_content_Likes_CreatedAt DEFAULT GETUTCDATE(),
        CONSTRAINT FK_content_Likes_Spot FOREIGN KEY (SpotId) REFERENCES content.Spots(Id) ON DELETE CASCADE,
        CONSTRAINT UQ_content_Likes_Spot_User UNIQUE (SpotId, UserId)
    );
END;
GO
