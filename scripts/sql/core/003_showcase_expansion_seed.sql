SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

IF OBJECT_ID('core.Users', 'U') IS NULL
BEGIN
    THROW 51000, 'Showcase expansion seed requires core.Users before scripts/sql/core/003_showcase_expansion_seed.sql.', 1;
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
    ('99999999-9999-9999-9999-999999999991', N'camille.laurent', N'camille.laurent@showcase.scope.local', N'showcase-login-disabled-v1', N'Camille Laurent', N'https://images.pexels.com/photos/697509/pexels-photo-697509.jpeg?auto=compress&cs=tinysrgb&w=600', N'Fictional scope starter profile for museum mornings, city walks, and design-forward neighborhoods.', N'Paris, FR', N'["culture","shopping","scenic"]', 9),
    ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', N'noah.kim', N'noah.kim@showcase.scope.local', N'showcase-login-disabled-v1', N'Noah Kim', N'https://images.pexels.com/photos/2379004/pexels-photo-2379004.jpeg?auto=compress&cs=tinysrgb&w=600', N'Fictional scope starter profile for mountain gateways, waterfront walks, and low-friction outdoor days.', N'Vancouver, CA', N'["nature","adventure","scenic"]', 10),
    ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1', N'luca.moretti', N'luca.moretti@showcase.scope.local', N'showcase-login-disabled-v1', N'Luca Moretti', N'https://images.pexels.com/photos/614810/pexels-photo-614810.jpeg?auto=compress&cs=tinysrgb&w=600', N'Fictional scope starter profile for rail-linked city breaks, market lunches, and late scenic walks.', N'Lisbon, PT', N'["scenic","food","nightlife"]', 11),
    ('cccccccc-cccc-cccc-cccc-ccccccccccc1', N'harper.singh', N'harper.singh@showcase.scope.local', N'showcase-login-disabled-v1', N'Harper Singh', N'https://images.pexels.com/photos/3763188/pexels-photo-3763188.jpeg?auto=compress&cs=tinysrgb&w=600', N'Fictional scope starter profile for national parks, gear-light adventures, and efficient road-trip stops.', N'Denver, CO', N'["adventure","shopping","nature"]', 12),
    ('dddddddd-dddd-dddd-dddd-ddddddddddd1', N'emilia.soto', N'emilia.soto@showcase.scope.local', N'showcase-login-disabled-v1', N'Emilia Soto', N'https://images.pexels.com/photos/3760854/pexels-photo-3760854.jpeg?auto=compress&cs=tinysrgb&w=600', N'Fictional scope starter profile for heritage markets, neighborhood food walks, and big-city cultural anchors.', N'Buenos Aires, AR', N'["culture","food","shopping"]', 13),
    ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee9', N'lena.ortiz', N'lena.ortiz@showcase.scope.local', N'showcase-login-disabled-v1', N'Lena Ortiz', N'https://images.pexels.com/photos/1181690/pexels-photo-1181690.jpeg?auto=compress&cs=tinysrgb&w=600', N'Fictional scope starter profile for desert color, gallery blocks, and warm-weather weekend pacing.', N'Phoenix, AZ', N'["scenic","shopping","culture"]', 14),
    ('ffffffff-ffff-ffff-ffff-fffffffffff9', N'marcus.grant', N'marcus.grant@showcase.scope.local', N'showcase-login-disabled-v1', N'Marcus Grant', N'https://images.pexels.com/photos/3775534/pexels-photo-3775534.jpeg?auto=compress&cs=tinysrgb&w=600', N'Fictional scope starter profile for live music, food halls, historic streets, and energetic group nights.', N'Nashville, TN', N'["nightlife","food","culture"]', 15),
    ('abababab-abab-abab-abab-ababababab01', N'nia.okafor', N'nia.okafor@showcase.scope.local', N'showcase-login-disabled-v1', N'Nia Okafor', N'https://images.pexels.com/photos/3769021/pexels-photo-3769021.jpeg?auto=compress&cs=tinysrgb&w=600', N'Fictional scope starter profile for public art, civic parks, and culture-first urban routes.', N'Atlanta, GA', N'["culture","scenic","food"]', 16),
    ('bcbcbcbc-bcbc-bcbc-bcbc-bcbcbcbcbc01', N'owen.park', N'owen.park@showcase.scope.local', N'showcase-login-disabled-v1', N'Owen Park', N'https://images.pexels.com/photos/3762800/pexels-photo-3762800.jpeg?auto=compress&cs=tinysrgb&w=600', N'Fictional scope starter profile for coastal trails, markets, coffee stops, and weather-aware scenic days.', N'Seattle, WA', N'["nature","scenic","food"]', 17),
    ('cdcdcdcd-cdcd-cdcd-cdcd-cdcdcdcdcd01', N'clara.jensen', N'clara.jensen@showcase.scope.local', N'showcase-login-disabled-v1', N'Clara Jensen', N'https://images.pexels.com/photos/3824771/pexels-photo-3824771.jpeg?auto=compress&cs=tinysrgb&w=600', N'Fictional scope starter profile for riverfront paths, museums, and relaxed city-to-nature weekends.', N'Minneapolis, MN', N'["culture","nature","scenic"]', 18);

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
