DECLARE @TripCreatorId UNIQUEIDENTIFIER = '22222222-2222-2222-2222-222222222222';
DECLARE @ExplorerId UNIQUEIDENTIFIER = '33333333-3333-3333-3333-333333333333';
DECLARE @TacoSpotId UNIQUEIDENTIFIER = '88888888-8888-8888-8888-888888888881';
DECLARE @RiverSpotId UNIQUEIDENTIFIER = '88888888-8888-8888-8888-888888888882';
DECLARE @Now DATETIME2 = GETUTCDATE();

IF NOT EXISTS (SELECT 1 FROM intel.UserPreferences WHERE UserId = @TripCreatorId)
BEGIN
    INSERT INTO intel.UserPreferences (
        Id,
        UserId,
        PreferredCategories,
        BudgetLevel,
        PacePreference,
        UpdatedAt
    )
    VALUES (
        'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee1',
        @TripCreatorId,
        N'food,nightlife,scenic',
        N'mid',
        N'balanced',
        DATEADD(DAY, -1, @Now)
    );
END;

IF NOT EXISTS (SELECT 1 FROM intel.UserPreferences WHERE UserId = @ExplorerId)
BEGIN
    INSERT INTO intel.UserPreferences (
        Id,
        UserId,
        PreferredCategories,
        BudgetLevel,
        PacePreference,
        UpdatedAt
    )
    VALUES (
        'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee2',
        @ExplorerId,
        N'scenic,adventure,food',
        N'low',
        N'relaxed',
        DATEADD(HOUR, -8, @Now)
    );
END;

IF NOT EXISTS (SELECT 1 FROM intel.SpotFeatures WHERE SpotId = @TacoSpotId)
BEGIN
    INSERT INTO intel.SpotFeatures (
        Id,
        SpotId,
        FeatureVector,
        PopularityScore,
        SentimentScore,
        UpdatedAt
    )
    VALUES (
        'ffffffff-ffff-ffff-ffff-fffffffffff1',
        @TacoSpotId,
        N'{"food":0.98,"rooftop":0.91,"social":0.84}',
        0.92,
        0.89,
        DATEADD(HOUR, -12, @Now)
    );
END;

IF NOT EXISTS (SELECT 1 FROM intel.SpotFeatures WHERE SpotId = @RiverSpotId)
BEGIN
    INSERT INTO intel.SpotFeatures (
        Id,
        SpotId,
        FeatureVector,
        PopularityScore,
        SentimentScore,
        UpdatedAt
    )
    VALUES (
        'ffffffff-ffff-ffff-ffff-fffffffffff2',
        @RiverSpotId,
        N'{"scenic":0.95,"active":0.87,"outdoor":0.93}',
        0.88,
        0.91,
        DATEADD(HOUR, -6, @Now)
    );
END;

IF NOT EXISTS (SELECT 1 FROM intel.ItineraryCache WHERE RequestHash = N'austin-food-river-weekend-demo')
BEGIN
    INSERT INTO intel.ItineraryCache (
        Id,
        UserId,
        RequestHash,
        ResultJson,
        ExpiresAt,
        CreatedAt
    )
    VALUES (
        '12121212-1212-1212-1212-121212121212',
        @TripCreatorId,
        N'austin-food-river-weekend-demo',
        N'{"title":"Austin Food & River Weekend","days":[{"day":1,"stops":["Sunset Tacos & Rooftop","Lady Bird River Loop"]}],"estimatedBudget":450}',
        DATEADD(DAY, 7, @Now),
        DATEADD(HOUR, -1, @Now)
    );
END;
GO
