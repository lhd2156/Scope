SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

IF OBJECT_ID('core.Users', 'U') IS NOT NULL
   AND COL_LENGTH('core.Users', 'IsShowcase') IS NULL
BEGIN
    ALTER TABLE core.Users
        ADD IsShowcase BIT NOT NULL CONSTRAINT DF_core_Users_IsShowcase DEFAULT 0 WITH VALUES;
END;
GO

IF OBJECT_ID('core.Users', 'U') IS NOT NULL
   AND COL_LENGTH('core.Users', 'IsShowcase') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_core_Users_Showcase_Active_CreatedAt' AND object_id = OBJECT_ID('core.Users'))
BEGIN
    CREATE INDEX IX_core_Users_Showcase_Active_CreatedAt ON core.Users (IsShowcase, IsActive, CreatedAt);
END;
GO

DECLARE @Now DATETIMEOFFSET = SYSDATETIMEOFFSET();

DECLARE @ShowcaseUsers TABLE (
    Id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
    Username NVARCHAR(30) NOT NULL,
    Email NVARCHAR(255) NOT NULL,
    PasswordHash NVARCHAR(500) NOT NULL,
    DisplayName NVARCHAR(60) NOT NULL,
    AvatarUrl NVARCHAR(500) NOT NULL,
    Bio NVARCHAR(500) NOT NULL,
    HomeBase NVARCHAR(120) NOT NULL,
    InterestsJson NVARCHAR(1000) NOT NULL,
    CreatedOffsetDays INT NOT NULL
);

INSERT INTO @ShowcaseUsers (Id, Username, Email, PasswordHash, DisplayName, AvatarUrl, Bio, HomeBase, InterestsJson, CreatedOffsetDays)
VALUES
    ('11111111-1111-1111-1111-111111111111', N'alex.morgan', N'alex.morgan@showcase.scope.local', N'showcase-login-disabled-v1', N'Alex Morgan', N'https://images.pexels.com/photos/774909/pexels-photo-774909.jpeg?auto=compress&cs=tinysrgb&w=600', N'Fictional Scope starter persona for food-first city routes, late dinners, and walkable culture loops.', N'Fort Worth, TX', N'["food","culture","nightlife"]', 1),
    ('22222222-2222-2222-2222-222222222222', N'maya.chen', N'maya.chen@showcase.scope.local', N'showcase-login-disabled-v1', N'Maya Chen', N'https://images.pexels.com/photos/220453/pexels-photo-220453.jpeg?auto=compress&cs=tinysrgb&w=600', N'Fictional Scope starter persona for gardens, museums, and design-forward weekend pacing.', N'Dallas, TX', N'["scenic","culture","shopping"]', 2),
    ('33333333-3333-3333-3333-333333333333', N'elijah.brooks', N'elijah.brooks@showcase.scope.local', N'showcase-login-disabled-v1', N'Elijah Brooks', N'https://images.pexels.com/photos/1239291/pexels-photo-1239291.jpeg?auto=compress&cs=tinysrgb&w=600', N'Fictional Scope starter persona for outdoor resets, strong coffee, and high-energy city walks.', N'Austin, TX', N'["adventure","food","nature"]', 3),
    ('44444444-4444-4444-4444-444444444441', N'sofia.ramirez', N'sofia.ramirez@showcase.scope.local', N'showcase-login-disabled-v1', N'Sofia Ramirez', N'https://images.pexels.com/photos/1181686/pexels-photo-1181686.jpeg?auto=compress&cs=tinysrgb&w=600', N'Fictional Scope starter persona for market mornings, heritage districts, and food-led itineraries.', N'San Antonio, TX', N'["food","culture","shopping"]', 4),
    ('55555555-5555-5555-5555-555555555551', N'jordan.reed', N'jordan.reed@showcase.scope.local', N'showcase-login-disabled-v1', N'Jordan Reed', N'https://images.pexels.com/photos/415829/pexels-photo-415829.jpeg?auto=compress&cs=tinysrgb&w=600', N'Fictional Scope starter persona for scenic overlooks, rail stations, and daylight-efficient routes.', N'Denver, CO', N'["scenic","nature","adventure"]', 5),
    ('66666666-6666-6666-6666-666666666661', N'aisha.bello', N'aisha.bello@showcase.scope.local', N'showcase-login-disabled-v1', N'Aisha Bello', N'https://images.pexels.com/photos/733872/pexels-photo-733872.jpeg?auto=compress&cs=tinysrgb&w=600', N'Fictional Scope starter persona for waterfront walks, art districts, and polished group dinners.', N'Houston, TX', N'["culture","food","scenic"]', 6),
    ('77777777-7777-7777-7777-777777777771', N'theo.alvarez', N'theo.alvarez@showcase.scope.local', N'showcase-login-disabled-v1', N'Theo Alvarez', N'https://images.pexels.com/photos/91227/pexels-photo-91227.jpeg?auto=compress&cs=tinysrgb&w=600', N'Fictional Scope starter persona for markets, architecture, and late-night city energy.', N'Barcelona, ES', N'["culture","shopping","nightlife"]', 7),
    ('88888888-8888-8888-8888-888888888881', N'priya.nair', N'priya.nair@showcase.scope.local', N'showcase-login-disabled-v1', N'Priya Nair', N'https://images.pexels.com/photos/1681010/pexels-photo-1681010.jpeg?auto=compress&cs=tinysrgb&w=600', N'Fictional Scope starter persona for gardens, skyline walks, and compact international stopovers.', N'Singapore', N'["scenic","culture","food"]', 8);

DELETE FROM core.LiveSessions
WHERE Id = '77777777-7777-7777-7777-777777777770';

DELETE FROM core.Notifications
WHERE Id IN (
    '55555555-5555-5555-5555-555555555555',
    '66666666-6666-6666-6666-666666666666'
);

DELETE friendships
FROM core.Friendships AS friendships
WHERE friendships.RequesterId IN (SELECT Id FROM @ShowcaseUsers)
  AND friendships.AddresseeId IN (SELECT Id FROM @ShowcaseUsers);

MERGE core.Users AS target
USING @ShowcaseUsers AS source
ON target.Id = source.Id
WHEN MATCHED THEN UPDATE SET
    Username = source.Username,
    Email = source.Email,
    PasswordHash = source.PasswordHash,
    DisplayName = source.DisplayName,
    AvatarUrl = source.AvatarUrl,
    Bio = source.Bio,
    HomeBase = source.HomeBase,
    InterestsJson = source.InterestsJson,
    ShowActivityStatus = 1,
    Role = N'user',
    FailedLoginAttempts = 0,
    MfaEnabled = 0,
    IsActive = 1,
    IsShowcase = 1,
    ProfileVisibility = N'public',
    UpdatedAt = @Now
WHEN NOT MATCHED THEN INSERT (
    Id, Username, Email, PasswordHash, DisplayName, AvatarUrl, Bio, HomeBase, InterestsJson,
    ShowActivityStatus, Role, FailedLoginAttempts, MfaEnabled, IsActive, IsShowcase, ProfileVisibility, CreatedAt, UpdatedAt
) VALUES (
    source.Id, source.Username, source.Email, source.PasswordHash, source.DisplayName, source.AvatarUrl, source.Bio, source.HomeBase, source.InterestsJson,
    1, N'user', 0, 0, 1, 1, N'public', DATEADD(DAY, -source.CreatedOffsetDays, @Now), @Now
);
GO
