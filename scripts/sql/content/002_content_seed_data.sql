DECLARE @ScopeAdminId UNIQUEIDENTIFIER = '11111111-1111-1111-1111-111111111111';
DECLARE @TripCreatorId UNIQUEIDENTIFIER = '22222222-2222-2222-2222-222222222222';
DECLARE @ExplorerId UNIQUEIDENTIFIER = '33333333-3333-3333-3333-333333333333';
DECLARE @TacoSpotId UNIQUEIDENTIFIER = '88888888-8888-8888-8888-888888888881';
DECLARE @RiverSpotId UNIQUEIDENTIFIER = '88888888-8888-8888-8888-888888888882';
DECLARE @AustinTripId UNIQUEIDENTIFIER = '77777777-7777-7777-7777-777777777777';
DECLARE @Now DATETIME2 = GETUTCDATE();

IF NOT EXISTS (SELECT 1 FROM content.Spots WHERE Id = @TacoSpotId)
BEGIN
    INSERT INTO content.Spots (
        Id,
        UserId,
        Title,
        Description,
        Latitude,
        Longitude,
        Address,
        City,
        Country,
        Category,
        Vibe,
        Rating,
        VisitedAt,
        IsPublic,
        CreatedAt,
        UpdatedAt
    )
    VALUES (
        @TacoSpotId,
        @TripCreatorId,
        N'Sunset Tacos & Rooftop',
        N'Golden-hour taco counter with skyline views and fast-moving communal tables.',
        30.2675,
        -97.7428,
        N'123 Sunset Ave',
        N'Austin',
        N'USA',
        N'food',
        N'rooftop',
        4.8,
        DATEADD(DAY, -3, CAST(@Now AS date)),
        1,
        DATEADD(DAY, -4, @Now),
        @Now
    );
END;

IF NOT EXISTS (SELECT 1 FROM content.Spots WHERE Id = @RiverSpotId)
BEGIN
    INSERT INTO content.Spots (
        Id,
        UserId,
        Title,
        Description,
        Latitude,
        Longitude,
        Address,
        City,
        Country,
        Category,
        Vibe,
        Rating,
        VisitedAt,
        IsPublic,
        CreatedAt,
        UpdatedAt
    )
    VALUES (
        @RiverSpotId,
        @ExplorerId,
        N'Lady Bird River Loop',
        N'Scenic downtown stretch with run-friendly paths, skyline overlooks, and kayak access.',
        30.2609,
        -97.7444,
        N'Ann and Roy Butler Hike-and-Bike Trail',
        N'Austin',
        N'USA',
        N'scenic',
        N'active',
        4.6,
        DATEADD(DAY, -2, CAST(@Now AS date)),
        1,
        DATEADD(DAY, -3, @Now),
        @Now
    );
END;

IF NOT EXISTS (SELECT 1 FROM content.Photos WHERE Id = '99999999-9999-9999-9999-999999999991')
BEGIN
    INSERT INTO content.Photos (
        Id,
        SpotId,
        UserId,
        S3Key,
        S3Url,
        ThumbnailUrl,
        Caption,
        SortOrder,
        CreatedAt
    )
    VALUES (
        '99999999-9999-9999-9999-999999999991',
        @TacoSpotId,
        @TripCreatorId,
        N'spots/sunset-tacos/hero.jpg',
        N'https://cdn.scope.local/spots/sunset-tacos/hero.jpg',
        N'https://cdn.scope.local/spots/sunset-tacos/hero-thumb.jpg',
        N'Rooftop taco spread at golden hour.',
        0,
        DATEADD(DAY, -4, @Now)
    );
END;

IF NOT EXISTS (SELECT 1 FROM content.Trips WHERE Id = @AustinTripId)
BEGIN
    INSERT INTO content.Trips (
        Id,
        CreatorId,
        Title,
        Description,
        StartDate,
        EndDate,
        Budget,
        Currency,
        Status,
        IsPublic,
        CoverPhotoUrl,
        CreatedAt
    )
    VALUES (
        @AustinTripId,
        @TripCreatorId,
        N'Austin Food & River Weekend',
        N'A two-day city itinerary mixing tacos, river views, and walkable nightlife.',
        DATEADD(DAY, 5, CAST(@Now AS date)),
        DATEADD(DAY, 7, CAST(@Now AS date)),
        450.00,
        N'USD',
        N'planning',
        1,
        N'https://cdn.scope.local/trips/austin-food-river-cover.jpg',
        DATEADD(DAY, -2, @Now)
    );
END;

IF NOT EXISTS (SELECT 1 FROM content.TripSpots WHERE TripId = @AustinTripId AND SpotId = @TacoSpotId)
BEGIN
    INSERT INTO content.TripSpots (Id, TripId, SpotId, DayNumber, SortOrder, Notes)
    VALUES (
        'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1',
        @AustinTripId,
        @TacoSpotId,
        1,
        1,
        N'Start here for lunch before checking into the hotel.'
    );
END;

IF NOT EXISTS (SELECT 1 FROM content.TripSpots WHERE TripId = @AustinTripId AND SpotId = @RiverSpotId)
BEGIN
    INSERT INTO content.TripSpots (Id, TripId, SpotId, DayNumber, SortOrder, Notes)
    VALUES (
        'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2',
        @AustinTripId,
        @RiverSpotId,
        1,
        2,
        N'Walk the river trail at sunset and catch skyline photos.'
    );
END;

IF NOT EXISTS (SELECT 1 FROM content.TripMembers WHERE TripId = @AustinTripId AND UserId = @TripCreatorId)
BEGIN
    INSERT INTO content.TripMembers (Id, TripId, UserId, Role, JoinedAt)
    VALUES (
        'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1',
        @AustinTripId,
        @TripCreatorId,
        N'owner',
        DATEADD(DAY, -2, @Now)
    );
END;

IF NOT EXISTS (SELECT 1 FROM content.TripMembers WHERE TripId = @AustinTripId AND UserId = @ExplorerId)
BEGIN
    INSERT INTO content.TripMembers (Id, TripId, UserId, Role, JoinedAt)
    VALUES (
        'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2',
        @AustinTripId,
        @ExplorerId,
        N'editor',
        DATEADD(DAY, -1, @Now)
    );
END;

IF NOT EXISTS (SELECT 1 FROM content.Reviews WHERE SpotId = @TacoSpotId AND UserId = @ExplorerId)
BEGIN
    INSERT INTO content.Reviews (Id, SpotId, UserId, Rating, Comment, CreatedAt)
    VALUES (
        'cccccccc-cccc-cccc-cccc-ccccccccccc1',
        @TacoSpotId,
        @ExplorerId,
        4.5,
        N'Perfect quick-stop dinner before a downtown walk. Order the al pastor and stay for sunset.',
        DATEADD(HOUR, -18, @Now)
    );
END;

IF NOT EXISTS (SELECT 1 FROM content.Likes WHERE SpotId = @TacoSpotId AND UserId = @ExplorerId)
BEGIN
    INSERT INTO content.Likes (Id, SpotId, UserId, CreatedAt)
    VALUES (
        'dddddddd-dddd-dddd-dddd-ddddddddddd1',
        @TacoSpotId,
        @ExplorerId,
        DATEADD(HOUR, -17, @Now)
    );
END;
GO
