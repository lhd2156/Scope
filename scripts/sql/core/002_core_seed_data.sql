DECLARE @ScopeAdminId UNIQUEIDENTIFIER = '11111111-1111-1111-1111-111111111111';
DECLARE @TripCreatorId UNIQUEIDENTIFIER = '22222222-2222-2222-2222-222222222222';
DECLARE @ExplorerId UNIQUEIDENTIFIER = '33333333-3333-3333-3333-333333333333';
DECLARE @Now DATETIME2 = GETUTCDATE();

IF NOT EXISTS (SELECT 1 FROM core.Users WHERE Id = @ScopeAdminId)
BEGIN
    INSERT INTO core.Users (
        Id,
        Username,
        Email,
        PasswordHash,
        DisplayName,
        AvatarUrl,
        Bio,
        CreatedAt,
        UpdatedAt,
        IsActive,
        LastLoginAt
    )
    VALUES (
        @ScopeAdminId,
        N'scopeadmin',
        N'admin@scope.local',
        N'seeded-password-hash',
        N'Scope Admin',
        N'https://images.scope.local/avatars/admin.png',
        N'Scope demo admin account for local integration and smoke tests.',
        @Now,
        @Now,
        1,
        @Now
    );
END;

IF NOT EXISTS (SELECT 1 FROM core.Users WHERE Id = @TripCreatorId)
BEGIN
    INSERT INTO core.Users (
        Id,
        Username,
        Email,
        PasswordHash,
        DisplayName,
        AvatarUrl,
        Bio,
        CreatedAt,
        UpdatedAt,
        IsActive,
        LastLoginAt
    )
    VALUES (
        @TripCreatorId,
        N'roadcaptain',
        N'captain@scope.local',
        N'seeded-password-hash',
        N'Road Captain',
        N'https://images.scope.local/avatars/captain.png',
        N'Curates shareable city adventures and weekend itineraries.',
        DATEADD(DAY, -14, @Now),
        @Now,
        1,
        DATEADD(HOUR, -8, @Now)
    );
END;

IF NOT EXISTS (SELECT 1 FROM core.Users WHERE Id = @ExplorerId)
BEGIN
    INSERT INTO core.Users (
        Id,
        Username,
        Email,
        PasswordHash,
        DisplayName,
        AvatarUrl,
        Bio,
        CreatedAt,
        UpdatedAt,
        IsActive,
        LastLoginAt
    )
    VALUES (
        @ExplorerId,
        N'cityscout',
        N'scout@scope.local',
        N'seeded-password-hash',
        N'City Scout',
        N'https://images.scope.local/avatars/scout.png',
        N'Always looking for golden-hour food spots and walkable trip plans.',
        DATEADD(DAY, -10, @Now),
        @Now,
        1,
        DATEADD(HOUR, -2, @Now)
    );
END;

IF NOT EXISTS (SELECT 1 FROM core.Friendships WHERE RequesterId = @TripCreatorId AND AddresseeId = @ExplorerId)
BEGIN
    INSERT INTO core.Friendships (Id, RequesterId, AddresseeId, Status, CreatedAt)
    VALUES (
        '44444444-4444-4444-4444-444444444444',
        @TripCreatorId,
        @ExplorerId,
        N'accepted',
        DATEADD(DAY, -7, @Now)
    );
END;

IF NOT EXISTS (SELECT 1 FROM core.Notifications WHERE Id = '55555555-5555-5555-5555-555555555555')
BEGIN
    INSERT INTO core.Notifications (Id, UserId, Type, Title, Body, ReferenceId, IsRead, CreatedAt)
    VALUES (
        '55555555-5555-5555-5555-555555555555',
        @ExplorerId,
        N'friend_request_accepted',
        N'Road Captain accepted your friend request',
        N'You can now collaborate on Scope trip plans together.',
        CONVERT(NVARCHAR(100), @TripCreatorId),
        0,
        DATEADD(HOUR, -6, @Now)
    );
END;

IF NOT EXISTS (SELECT 1 FROM core.Notifications WHERE Id = '66666666-6666-6666-6666-666666666666')
BEGIN
    INSERT INTO core.Notifications (Id, UserId, Type, Title, Body, ReferenceId, IsRead, CreatedAt)
    VALUES (
        '66666666-6666-6666-6666-666666666666',
        @TripCreatorId,
        N'trip_collaboration',
        N'City Scout joined the Austin food crawl',
        N'Your collaborator is now following the itinerary updates.',
        N'77777777-7777-7777-7777-777777777777',
        1,
        DATEADD(HOUR, -20, @Now)
    );
END;

IF NOT EXISTS (SELECT 1 FROM core.LiveSessions WHERE Id = '77777777-7777-7777-7777-777777777770')
BEGIN
    INSERT INTO core.LiveSessions (Id, TripId, UserId, Latitude, Longitude, IsActive, LastPingAt)
    VALUES (
        '77777777-7777-7777-7777-777777777770',
        '77777777-7777-7777-7777-777777777777',
        @TripCreatorId,
        30.2672,
        -97.7431,
        1,
        DATEADD(MINUTE, -5, @Now)
    );
END;
GO
