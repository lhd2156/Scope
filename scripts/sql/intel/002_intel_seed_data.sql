DECLARE @MayaId UNIQUEIDENTIFIER = '22222222-2222-2222-2222-222222222222';
DECLARE @ElijahId UNIQUEIDENTIFIER = '33333333-3333-3333-3333-333333333333';
DECLARE @MuleAlleySpotId UNIQUEIDENTIFIER = '90000000-0000-0000-0000-000000000001';
DECLARE @LadyBirdSpotId UNIQUEIDENTIFIER = '90000000-0000-0000-0000-000000000005';
DECLARE @Now DATETIME2 = SYSUTCDATETIME();

DECLARE @Preferences TABLE (
    Id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
    UserId UNIQUEIDENTIFIER NOT NULL,
    PreferredCategories NVARCHAR(500) NOT NULL,
    BudgetLevel NVARCHAR(20) NOT NULL,
    PacePreference NVARCHAR(20) NOT NULL,
    UpdatedOffsetHours INT NOT NULL
);

INSERT INTO @Preferences (Id, UserId, PreferredCategories, BudgetLevel, PacePreference, UpdatedOffsetHours)
VALUES
    ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee1', @MayaId, N'scenic,culture,shopping', N'mid', N'balanced', 24),
    ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee2', @ElijahId, N'adventure,food,nature', N'low', N'relaxed', 8);

MERGE intel.UserPreferences AS target
USING @Preferences AS source
ON target.UserId = source.UserId
WHEN MATCHED THEN UPDATE SET
    PreferredCategories = source.PreferredCategories,
    BudgetLevel = source.BudgetLevel,
    PacePreference = source.PacePreference,
    UpdatedAt = DATEADD(HOUR, -source.UpdatedOffsetHours, @Now)
WHEN NOT MATCHED THEN INSERT (Id, UserId, PreferredCategories, BudgetLevel, PacePreference, UpdatedAt)
VALUES (source.Id, source.UserId, source.PreferredCategories, source.BudgetLevel, source.PacePreference, DATEADD(HOUR, -source.UpdatedOffsetHours, @Now));

DELETE FROM intel.SpotFeatures
WHERE SpotId IN (
    '88888888-8888-8888-8888-888888888881',
    '88888888-8888-8888-8888-888888888882'
);

DELETE FROM intel.ItineraryCache
WHERE RequestHash = N'austin-food-river-weekend-demo';

DECLARE @SpotFeatures TABLE (
    Id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
    SpotId UNIQUEIDENTIFIER NOT NULL,
    FeatureVector NVARCHAR(MAX) NOT NULL,
    PopularityScore FLOAT NOT NULL,
    SentimentScore FLOAT NOT NULL,
    UpdatedOffsetHours INT NOT NULL
);

INSERT INTO @SpotFeatures (Id, SpotId, FeatureVector, PopularityScore, SentimentScore, UpdatedOffsetHours)
VALUES
    ('ffffffff-ffff-ffff-ffff-fffffffffff1', @MuleAlleySpotId, N'{"shopping":0.93,"photo_worthy":0.9,"heritage":0.86}', 0.91, 0.88, 12),
    ('ffffffff-ffff-ffff-ffff-fffffffffff2', @LadyBirdSpotId, N'{"scenic":0.96,"active":0.88,"outdoor":0.93}', 0.89, 0.92, 6);

MERGE intel.SpotFeatures AS target
USING @SpotFeatures AS source
ON target.SpotId = source.SpotId
WHEN MATCHED THEN UPDATE SET
    FeatureVector = source.FeatureVector,
    PopularityScore = source.PopularityScore,
    SentimentScore = source.SentimentScore,
    UpdatedAt = DATEADD(HOUR, -source.UpdatedOffsetHours, @Now)
WHEN NOT MATCHED THEN INSERT (Id, SpotId, FeatureVector, PopularityScore, SentimentScore, UpdatedAt)
VALUES (source.Id, source.SpotId, source.FeatureVector, source.PopularityScore, source.SentimentScore, DATEADD(HOUR, -source.UpdatedOffsetHours, @Now));

MERGE intel.ItineraryCache AS target
USING (
    SELECT
        CAST('12121212-1212-1212-1212-121212121212' AS UNIQUEIDENTIFIER) AS Id,
        @MayaId AS UserId,
        N'texas-starter-loop-showcase' AS RequestHash,
        N'{"title":"Texas Starter Loop","days":[{"day":1,"stops":["Mule Alley Mercantile Row","Fort Worth Water Gardens"]},{"day":2,"stops":["Pearl District Market Hall","San Antonio River Walk Blue Hour"]},{"day":3,"stops":["Lady Bird Skyline Boardwalk","Klyde Warren Park Lawn"]}],"estimatedBudget":1180}' AS ResultJson,
        DATEADD(DAY, 7, @Now) AS ExpiresAt,
        DATEADD(HOUR, -1, @Now) AS CreatedAt
) AS source
ON target.RequestHash = source.RequestHash
WHEN MATCHED THEN UPDATE SET
    UserId = source.UserId,
    ResultJson = source.ResultJson,
    ExpiresAt = source.ExpiresAt
WHEN NOT MATCHED THEN INSERT (Id, UserId, RequestHash, ResultJson, ExpiresAt, CreatedAt)
VALUES (source.Id, source.UserId, source.RequestHash, source.ResultJson, source.ExpiresAt, source.CreatedAt);
GO
