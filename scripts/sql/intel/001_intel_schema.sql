IF NOT EXISTS (SELECT 1 FROM sys.schemas WHERE name = 'intel')
BEGIN
    EXEC('CREATE SCHEMA intel');
END;
GO

IF OBJECT_ID('intel.ItineraryCache', 'U') IS NULL
BEGIN
    CREATE TABLE intel.ItineraryCache (
        Id UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_intel_ItineraryCache PRIMARY KEY DEFAULT NEWID(),
        UserId UNIQUEIDENTIFIER NOT NULL,
        RequestHash NVARCHAR(64) NOT NULL,
        ResultJson NVARCHAR(MAX) NOT NULL,
        ExpiresAt DATETIME2 NOT NULL,
        CreatedAt DATETIME2 NOT NULL CONSTRAINT DF_intel_ItineraryCache_CreatedAt DEFAULT GETUTCDATE()
    );
END;
GO

IF OBJECT_ID('intel.UserPreferences', 'U') IS NULL
BEGIN
    CREATE TABLE intel.UserPreferences (
        Id UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_intel_UserPreferences PRIMARY KEY DEFAULT NEWID(),
        UserId UNIQUEIDENTIFIER NOT NULL,
        PreferredCategories NVARCHAR(500) NULL,
        BudgetLevel NVARCHAR(20) NULL,
        PacePreference NVARCHAR(20) NULL,
        UpdatedAt DATETIME2 NOT NULL CONSTRAINT DF_intel_UserPreferences_UpdatedAt DEFAULT GETUTCDATE(),
        CONSTRAINT UQ_intel_UserPreferences_UserId UNIQUE (UserId)
    );
END;
GO

IF OBJECT_ID('intel.SpotFeatures', 'U') IS NULL
BEGIN
    CREATE TABLE intel.SpotFeatures (
        Id UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_intel_SpotFeatures PRIMARY KEY DEFAULT NEWID(),
        SpotId UNIQUEIDENTIFIER NOT NULL,
        FeatureVector NVARCHAR(MAX) NOT NULL,
        PopularityScore FLOAT NOT NULL CONSTRAINT DF_intel_SpotFeatures_PopularityScore DEFAULT 0,
        SentimentScore FLOAT NOT NULL CONSTRAINT DF_intel_SpotFeatures_SentimentScore DEFAULT 0,
        UpdatedAt DATETIME2 NOT NULL CONSTRAINT DF_intel_SpotFeatures_UpdatedAt DEFAULT GETUTCDATE(),
        CONSTRAINT UQ_intel_SpotFeatures_SpotId UNIQUE (SpotId)
    );
END;
GO
