SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

IF OBJECT_ID('dbo.spots_spot', 'U') IS NULL
   OR OBJECT_ID('dbo.photos_photo', 'U') IS NULL
   OR OBJECT_ID('dbo.reviews_review', 'U') IS NULL
   OR OBJECT_ID('dbo.trips_trip', 'U') IS NULL
   OR OBJECT_ID('dbo.trips_tripspot', 'U') IS NULL
   OR OBJECT_ID('dbo.trips_tripmember', 'U') IS NULL
   OR OBJECT_ID('dbo.trips_like', 'U') IS NULL
BEGIN
    THROW 51000, 'Showcase content seed requires Django content migrations to run before scripts/sql/content/002_content_seed_data.sql.', 1;
END;
GO

CREATE OR ALTER FUNCTION dbo.__scope_seed_uuid32 (@value UNIQUEIDENTIFIER)
RETURNS CHAR(32)
AS
BEGIN
    RETURN LOWER(REPLACE(CONVERT(CHAR(36), @value), '-', ''));
END;
GO

DECLARE @Now DATETIME2 = SYSUTCDATETIME();

DECLARE @ShowcaseSpots TABLE (Id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY, UserId UNIQUEIDENTIFIER NOT NULL, Title NVARCHAR(200) NOT NULL, Description NVARCHAR(MAX) NOT NULL, Latitude FLOAT NOT NULL, Longitude FLOAT NOT NULL, Address NVARCHAR(500) NOT NULL, City NVARCHAR(100) NOT NULL, Country NVARCHAR(100) NOT NULL, Category NVARCHAR(50) NOT NULL, Vibe NVARCHAR(50) NOT NULL, Pillars NVARCHAR(MAX) NOT NULL, Rating DECIMAL(2,1) NOT NULL, VisitedOffsetDays INT NOT NULL, CreatedOffsetDays INT NOT NULL);

INSERT INTO @ShowcaseSpots (Id, UserId, Title, Description, Latitude, Longitude, Address, City, Country, Category, Vibe, Pillars, Rating, VisitedOffsetDays, CreatedOffsetDays)
VALUES
    ('90000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', N'Mule Alley Mercantile Row', N'A polished Stockyards retail lane with heritage storefronts, western texture, and easy golden-hour browsing before dinner.', 32.7899, -97.3484, N'128 E Exchange Ave', N'Fort Worth', N'US', N'shopping', N'heritage retail', N'["photo-worthy","quick-stop","lively"]', 4.6, 2, 1),
    ('90000000-0000-0000-0000-000000000002', '44444444-4444-4444-4444-444444444441', N'San Antonio River Walk Blue Hour', N'A classic downtown river bend for water-level photos, slow dinner pacing, and easy hotel-to-market walks.', 29.4252, -98.4897, N'849 E Commerce St', N'San Antonio', N'US', N'scenic', N'riverwalk evening', N'["photo-worthy","date-night","lively"]', 4.8, 3, 2),
    ('90000000-0000-0000-0000-000000000003', '22222222-2222-2222-2222-222222222222', N'Fort Worth Water Gardens', N'Terraced concrete pools and shaded plazas that create a dramatic downtown reset between meals and museums.', 32.7478, -97.324, N'1502 Commerce St', N'Fort Worth', N'US', N'scenic', N'architectural calm', N'["photo-worthy","quick-stop","calm"]', 4.7, 4, 3),
    ('90000000-0000-0000-0000-000000000004', '44444444-4444-4444-4444-444444444441', N'Pearl District Market Hall', N'San Antonio food halls, river access, and design-forward courtyards that work well for a flexible group stop.', 29.4438, -98.4807, N'303 Pearl Pkwy', N'San Antonio', N'US', N'food', N'market district', N'["group-friendly","photo-worthy","lively"]', 4.7, 5, 4),
    ('90000000-0000-0000-0000-000000000005', '33333333-3333-3333-3333-333333333333', N'Lady Bird Skyline Boardwalk', N'An Austin boardwalk stretch with skyline views, kayak energy, and an easy active reset near downtown.', 30.249, -97.7256, N'Ann and Roy Butler Hike-and-Bike Trail', N'Austin', N'US', N'scenic', N'active skyline', N'["solo-friendly","photo-worthy","calm"]', 4.8, 6, 5),
    ('90000000-0000-0000-0000-000000000006', '22222222-2222-2222-2222-222222222222', N'Klyde Warren Park Lawn', N'A deck park linking museums, food trucks, and downtown Dallas energy without needing a complicated transfer.', 32.7894, -96.8017, N'2012 Woodall Rodgers Fwy', N'Dallas', N'US', N'entertainment', N'urban green', N'["group-friendly","quick-stop","lively"]', 4.6, 7, 6),
    ('90000000-0000-0000-0000-000000000007', '66666666-6666-6666-6666-666666666661', N'Buffalo Bayou Skyline Run', N'Houston skyline trails, public art moments, and open lawn pauses that make the city feel immediately legible.', 29.7629, -95.3836, N'105 Sabine St', N'Houston', N'US', N'scenic', N'bayou skyline', N'["solo-friendly","photo-worthy","worth-the-drive"]', 4.7, 8, 7),
    ('90000000-0000-0000-0000-000000000008', '55555555-5555-5555-5555-555555555551', N'Big Bend Window Trail', N'A desert hike with a cinematic canyon finish, best saved for daylight-first travelers who want a real nature anchor.', 29.2709, -103.302, N'Window Trail', N'Big Bend National Park', N'US', N'adventure', N'desert overlook', N'["worth-the-drive","photo-worthy","solo-friendly"]', 4.9, 9, 8),
    ('90000000-0000-0000-0000-000000000009', '44444444-4444-4444-4444-444444444441', N'Historic Market Square San Antonio', N'A colorful market district for snack stops, music spillover, and souvenir browsing close to downtown hotels.', 29.4241, -98.4998, N'514 W Commerce St', N'San Antonio', N'US', N'shopping', N'market color', N'["budget-friendly","lively","group-friendly"]', 4.5, 10, 9),
    ('90000000-0000-0000-0000-000000000010', '22222222-2222-2222-2222-222222222222', N'Millennium Park Bean Loop', N'Chicago public art, skyline framing, and lakefront adjacency for a first-day culture walk that stays compact.', 41.8826, -87.6233, N'201 E Randolph St', N'Chicago', N'US', N'culture', N'public art', N'["photo-worthy","quick-stop","family-friendly"]', 4.8, 11, 10),
    ('90000000-0000-0000-0000-000000000011', '11111111-1111-1111-1111-111111111111', N'Empire State Observation Window', N'A classic New York skyline anchor for first-timers who want one unmistakable city-view moment.', 40.7484, -73.9857, N'20 W 34th St', N'New York', N'US', N'scenic', N'iconic skyline', N'["photo-worthy","date-night","worth-the-drive"]', 4.7, 12, 11),
    ('90000000-0000-0000-0000-000000000012', '66666666-6666-6666-6666-666666666661', N'Pike Place Market Morning', N'Seattle seafood counters, flower stands, coffee lines, and waterfront views in one dense morning block.', 47.6097, -122.3425, N'85 Pike St', N'Seattle', N'US', N'food', N'market morning', N'["lively","budget-friendly","group-friendly"]', 4.8, 13, 12),
    ('90000000-0000-0000-0000-000000000013', '77777777-7777-7777-7777-777777777771', N'Wynwood Walls Color Walk', N'A mural-heavy Miami art walk with bright facades, gallery pop-ins, and easy late-afternoon photo stops.', 25.8013, -80.1995, N'2516 NW 2nd Ave', N'Miami', N'US', N'culture', N'street art', N'["photo-worthy","lively","quick-stop"]', 4.6, 14, 13),
    ('90000000-0000-0000-0000-000000000014', '22222222-2222-2222-2222-222222222222', N'Walt Disney Concert Hall Curve', N'A downtown Los Angeles architecture stop with reflective steel curves and a clean arts-district route fit.', 34.0553, -118.2498, N'111 S Grand Ave', N'Los Angeles', N'US', N'culture', N'design landmark', N'["photo-worthy","luxury-feel","quick-stop"]', 4.7, 15, 14),
    ('90000000-0000-0000-0000-000000000015', '55555555-5555-5555-5555-555555555551', N'Denver Union Station Great Hall', N'A rail-hall anchor with coffee, cocktails, transit access, and a built-in meeting point for mountain-bound trips.', 39.7528, -104.9999, N'1701 Wynkoop St', N'Denver', N'US', N'culture', N'rail hall', N'["group-friendly","date-night","quick-stop"]', 4.7, 16, 15),
    ('90000000-0000-0000-0000-000000000016', '33333333-3333-3333-3333-333333333333', N'Jackson Square Brass Corner', N'A New Orleans plaza stop for cathedral views, street music, cafe breaks, and a compact French Quarter route.', 29.9574, -90.0632, N'701 Decatur St', N'New Orleans', N'US', N'culture', N'historic plaza', N'["lively","photo-worthy","quick-stop"]', 4.6, 17, 16),
    ('90000000-0000-0000-0000-000000000017', '88888888-8888-8888-8888-888888888881', N'Shibuya Crossing Pulse', N'Tokyo crosswalk energy, neon storefronts, and station-side routing for a high-signal first night.', 35.6595, 139.7005, N'Shibuya Scramble Crossing', N'Tokyo', N'JP', N'entertainment', N'neon crossing', N'["lively","photo-worthy","quick-stop"]', 4.8, 18, 17),
    ('90000000-0000-0000-0000-000000000018', '11111111-1111-1111-1111-111111111111', N'Senso-ji Lantern Approach', N'Historic temple gates, market snacks, and an easy Asakusa walking route with strong cultural texture.', 35.7148, 139.7967, N'2 Chome-3-1 Asakusa', N'Tokyo', N'JP', N'culture', N'temple approach', N'["photo-worthy","hidden-gem","group-friendly"]', 4.9, 19, 18),
    ('90000000-0000-0000-0000-000000000019', '77777777-7777-7777-7777-777777777771', N'Park Guell Mosaic Terrace', N'Barcelona hillside mosaics, playful architecture, and city views that reward a planned ticket window.', 41.4145, 2.1527, N'08024 Barcelona', N'Barcelona', N'ES', N'culture', N'mosaic overlook', N'["photo-worthy","worth-the-drive","family-friendly"]', 4.7, 20, 19),
    ('90000000-0000-0000-0000-000000000020', '22222222-2222-2222-2222-222222222222', N'Portobello Road Market Stroll', N'A London market lane for antiques, pastel storefronts, street food, and neighborhood wandering.', 51.513, -0.205, N'Portobello Rd', N'London', N'GB', N'shopping', N'market lane', N'["budget-friendly","lively","photo-worthy"]', 4.6, 21, 20),
    ('90000000-0000-0000-0000-000000000021', '88888888-8888-8888-8888-888888888881', N'Gardens by the Bay Supertree Walk', N'Singapore garden paths, skyline framing, and a night-light spectacle that makes a short stopover feel complete.', 1.2816, 103.8636, N'18 Marina Gardens Dr', N'Singapore', N'SG', N'nature', N'future garden', N'["photo-worthy","family-friendly","date-night"]', 4.9, 22, 21),
    ('90000000-0000-0000-0000-000000000022', '66666666-6666-6666-6666-666666666661', N'V&A Waterfront Table Mountain View', N'Cape Town harbor walks, restaurants, shops, and mountain views bundled into a low-friction waterfront anchor.', -33.903, 18.4225, N'19 Dock Rd', N'Cape Town', N'ZA', N'scenic', N'harbor mountain', N'["group-friendly","photo-worthy","lively"]', 4.7, 23, 22),
    ('90000000-0000-0000-0000-000000000023', '77777777-7777-7777-7777-777777777771', N'Palacio de Bellas Artes Marble Steps', N'Mexico City architecture, murals, and Alameda Central access for a culture-heavy downtown route.', 19.4352, -99.1412, N'Av. Juarez S/N', N'Mexico City', N'MX', N'culture', N'marble landmark', N'["photo-worthy","hidden-gem","quick-stop"]', 4.8, 24, 23),
    ('90000000-0000-0000-0000-000000000024', '55555555-5555-5555-5555-555555555551', N'Sydney Opera House Circular Quay', N'Harbor views, ferry movement, and landmark architecture that give Sydney a clean first-viewport moment.', -33.8568, 151.2153, N'Bennelong Point', N'Sydney', N'AU', N'scenic', N'harbor icon', N'["photo-worthy","date-night","family-friendly"]', 4.9, 25, 24);

MERGE dbo.spots_spot AS target
USING @ShowcaseSpots AS source
ON target.id = dbo.__scope_seed_uuid32(source.Id)
WHEN MATCHED THEN UPDATE SET user_id = dbo.__scope_seed_uuid32(source.UserId), title = source.Title, description = source.Description, latitude = source.Latitude, longitude = source.Longitude, address = source.Address, city = source.City, country = source.Country, postal_code = N'', category = source.Category, vibe = source.Vibe, pillars = source.Pillars, rating = source.Rating, visited_at = CAST(DATEADD(DAY, -source.VisitedOffsetDays, @Now) AS date), is_public = 1, verification_status = N'verified', verification_source = N'showcase_seed', provider_place_id = CONCAT(N'showcase:', CONVERT(NVARCHAR(36), source.Id)), provider_place_name = source.Title, provider_place_address = source.Address, verification_distance_meters = 0, verified_at = @Now, safety_status = N'clean', safety_reason = N'seeded showcase place', updated_at = @Now
WHEN NOT MATCHED THEN INSERT (id, user_id, title, description, latitude, longitude, address, city, country, postal_code, category, vibe, pillars, rating, visited_at, is_public, verification_status, verification_source, provider_place_id, provider_place_name, provider_place_address, verification_distance_meters, verified_at, safety_status, safety_reason, created_at, updated_at) VALUES (dbo.__scope_seed_uuid32(source.Id), dbo.__scope_seed_uuid32(source.UserId), source.Title, source.Description, source.Latitude, source.Longitude, source.Address, source.City, source.Country, N'', source.Category, source.Vibe, source.Pillars, source.Rating, CAST(DATEADD(DAY, -source.VisitedOffsetDays, @Now) AS date), 1, N'verified', N'showcase_seed', CONCAT(N'showcase:', CONVERT(NVARCHAR(36), source.Id)), source.Title, source.Address, 0, @Now, N'clean', N'seeded showcase place', DATEADD(DAY, -source.CreatedOffsetDays, @Now), @Now);

DECLARE @ShowcasePhotos TABLE (Id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY, SpotId UNIQUEIDENTIFIER NOT NULL, UserId UNIQUEIDENTIFIER NOT NULL, StorageKey NVARCHAR(500) NOT NULL, StorageUrl NVARCHAR(1000) NOT NULL, ThumbnailUrl NVARCHAR(1000) NOT NULL, Caption NVARCHAR(500) NOT NULL, SortOrder INT NOT NULL, CreatedOffsetDays INT NOT NULL);
INSERT INTO @ShowcasePhotos (Id, SpotId, UserId, StorageKey, StorageUrl, ThumbnailUrl, Caption, SortOrder, CreatedOffsetDays)
VALUES
    ('b1000000-0000-0000-0000-000000000001', '90000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', N'showcase/spots/showcase-spot-1/hero.jpg', N'https://images.pexels.com/photos/32448258/pexels-photo-32448258.jpeg?auto=compress&cs=tinysrgb&w=1600', N'https://images.pexels.com/photos/32448258/pexels-photo-32448258.jpeg?auto=compress&cs=tinysrgb&w=600', N'Mule Alley Mercantile Row starter showcase photo.', 0, 1),
    ('b1000000-0000-0000-0000-000000000002', '90000000-0000-0000-0000-000000000002', '44444444-4444-4444-4444-444444444441', N'showcase/spots/showcase-spot-2/hero.jpg', N'https://images.pexels.com/photos/1548976/pexels-photo-1548976.jpeg?auto=compress&cs=tinysrgb&w=1600', N'https://images.pexels.com/photos/1548976/pexels-photo-1548976.jpeg?auto=compress&cs=tinysrgb&w=600', N'San Antonio River Walk Blue Hour starter showcase photo.', 0, 2),
    ('b1000000-0000-0000-0000-000000000003', '90000000-0000-0000-0000-000000000003', '22222222-2222-2222-2222-222222222222', N'showcase/spots/showcase-spot-3/hero.jpg', N'https://images.pexels.com/photos/37136845/pexels-photo-37136845.jpeg?auto=compress&cs=tinysrgb&w=1600', N'https://images.pexels.com/photos/37136845/pexels-photo-37136845.jpeg?auto=compress&cs=tinysrgb&w=600', N'Fort Worth Water Gardens starter showcase photo.', 0, 3),
    ('b1000000-0000-0000-0000-000000000004', '90000000-0000-0000-0000-000000000004', '44444444-4444-4444-4444-444444444441', N'showcase/spots/showcase-spot-4/hero.jpg', N'https://images.pexels.com/photos/770231/pexels-photo-770231.jpeg?auto=compress&cs=tinysrgb&w=1600', N'https://images.pexels.com/photos/770231/pexels-photo-770231.jpeg?auto=compress&cs=tinysrgb&w=600', N'Pearl District Market Hall starter showcase photo.', 0, 4),
    ('b1000000-0000-0000-0000-000000000005', '90000000-0000-0000-0000-000000000005', '33333333-3333-3333-3333-333333333333', N'showcase/spots/showcase-spot-5/hero.jpg', N'https://images.pexels.com/photos/37215506/pexels-photo-37215506.jpeg?auto=compress&cs=tinysrgb&w=1600', N'https://images.pexels.com/photos/37215506/pexels-photo-37215506.jpeg?auto=compress&cs=tinysrgb&w=600', N'Lady Bird Skyline Boardwalk starter showcase photo.', 0, 5),
    ('b1000000-0000-0000-0000-000000000006', '90000000-0000-0000-0000-000000000006', '22222222-2222-2222-2222-222222222222', N'showcase/spots/showcase-spot-6/hero.jpg', N'https://images.pexels.com/photos/31338555/pexels-photo-31338555.jpeg?auto=compress&cs=tinysrgb&w=1600', N'https://images.pexels.com/photos/31338555/pexels-photo-31338555.jpeg?auto=compress&cs=tinysrgb&w=600', N'Klyde Warren Park Lawn starter showcase photo.', 0, 6),
    ('b1000000-0000-0000-0000-000000000007', '90000000-0000-0000-0000-000000000007', '66666666-6666-6666-6666-666666666661', N'showcase/spots/showcase-spot-7/hero.jpg', N'https://images.pexels.com/photos/37106432/pexels-photo-37106432.jpeg?auto=compress&cs=tinysrgb&w=1600', N'https://images.pexels.com/photos/37106432/pexels-photo-37106432.jpeg?auto=compress&cs=tinysrgb&w=600', N'Buffalo Bayou Skyline Run starter showcase photo.', 0, 7),
    ('b1000000-0000-0000-0000-000000000008', '90000000-0000-0000-0000-000000000008', '55555555-5555-5555-5555-555555555551', N'showcase/spots/showcase-spot-8/hero.jpg', N'https://images.pexels.com/photos/13352638/pexels-photo-13352638.jpeg?auto=compress&cs=tinysrgb&w=1600', N'https://images.pexels.com/photos/13352638/pexels-photo-13352638.jpeg?auto=compress&cs=tinysrgb&w=600', N'Big Bend Window Trail starter showcase photo.', 0, 8),
    ('b1000000-0000-0000-0000-000000000009', '90000000-0000-0000-0000-000000000009', '44444444-4444-4444-4444-444444444441', N'showcase/spots/showcase-spot-9/hero.jpg', N'https://images.pexels.com/photos/15065330/pexels-photo-15065330.jpeg?auto=compress&cs=tinysrgb&w=1600', N'https://images.pexels.com/photos/15065330/pexels-photo-15065330.jpeg?auto=compress&cs=tinysrgb&w=600', N'Historic Market Square San Antonio starter showcase photo.', 0, 9),
    ('b1000000-0000-0000-0000-000000000010', '90000000-0000-0000-0000-000000000010', '22222222-2222-2222-2222-222222222222', N'showcase/spots/showcase-spot-10/hero.jpg', N'https://images.pexels.com/photos/5847695/pexels-photo-5847695.jpeg?auto=compress&cs=tinysrgb&w=1600', N'https://images.pexels.com/photos/5847695/pexels-photo-5847695.jpeg?auto=compress&cs=tinysrgb&w=600', N'Millennium Park Bean Loop starter showcase photo.', 0, 10),
    ('b1000000-0000-0000-0000-000000000011', '90000000-0000-0000-0000-000000000011', '11111111-1111-1111-1111-111111111111', N'showcase/spots/showcase-spot-11/hero.jpg', N'https://images.pexels.com/photos/31258133/pexels-photo-31258133.jpeg?auto=compress&cs=tinysrgb&w=1600', N'https://images.pexels.com/photos/31258133/pexels-photo-31258133.jpeg?auto=compress&cs=tinysrgb&w=600', N'Empire State Observation Window starter showcase photo.', 0, 11),
    ('b1000000-0000-0000-0000-000000000012', '90000000-0000-0000-0000-000000000012', '66666666-6666-6666-6666-666666666661', N'showcase/spots/showcase-spot-12/hero.jpg', N'https://images.pexels.com/photos/34996735/pexels-photo-34996735.jpeg?auto=compress&cs=tinysrgb&w=1600', N'https://images.pexels.com/photos/34996735/pexels-photo-34996735.jpeg?auto=compress&cs=tinysrgb&w=600', N'Pike Place Market Morning starter showcase photo.', 0, 12),
    ('b1000000-0000-0000-0000-000000000013', '90000000-0000-0000-0000-000000000013', '77777777-7777-7777-7777-777777777771', N'showcase/spots/showcase-spot-13/hero.jpg', N'https://images.pexels.com/photos/32745108/pexels-photo-32745108.jpeg?auto=compress&cs=tinysrgb&w=1600', N'https://images.pexels.com/photos/32745108/pexels-photo-32745108.jpeg?auto=compress&cs=tinysrgb&w=600', N'Wynwood Walls Color Walk starter showcase photo.', 0, 13),
    ('b1000000-0000-0000-0000-000000000014', '90000000-0000-0000-0000-000000000014', '22222222-2222-2222-2222-222222222222', N'showcase/spots/showcase-spot-14/hero.jpg', N'https://images.pexels.com/photos/33927053/pexels-photo-33927053.jpeg?auto=compress&cs=tinysrgb&w=1600', N'https://images.pexels.com/photos/33927053/pexels-photo-33927053.jpeg?auto=compress&cs=tinysrgb&w=600', N'Walt Disney Concert Hall Curve starter showcase photo.', 0, 14),
    ('b1000000-0000-0000-0000-000000000015', '90000000-0000-0000-0000-000000000015', '55555555-5555-5555-5555-555555555551', N'showcase/spots/showcase-spot-15/hero.jpg', N'https://images.pexels.com/photos/2706750/pexels-photo-2706750.jpeg?auto=compress&cs=tinysrgb&w=1600', N'https://images.pexels.com/photos/2706750/pexels-photo-2706750.jpeg?auto=compress&cs=tinysrgb&w=600', N'Denver Union Station Great Hall starter showcase photo.', 0, 15),
    ('b1000000-0000-0000-0000-000000000016', '90000000-0000-0000-0000-000000000016', '33333333-3333-3333-3333-333333333333', N'showcase/spots/showcase-spot-16/hero.jpg', N'https://images.pexels.com/photos/2387873/pexels-photo-2387873.jpeg?auto=compress&cs=tinysrgb&w=1600', N'https://images.pexels.com/photos/2387873/pexels-photo-2387873.jpeg?auto=compress&cs=tinysrgb&w=600', N'Jackson Square Brass Corner starter showcase photo.', 0, 16),
    ('b1000000-0000-0000-0000-000000000017', '90000000-0000-0000-0000-000000000017', '88888888-8888-8888-8888-888888888881', N'showcase/spots/showcase-spot-17/hero.jpg', N'https://images.pexels.com/photos/8002454/pexels-photo-8002454.jpeg?auto=compress&cs=tinysrgb&w=1600', N'https://images.pexels.com/photos/8002454/pexels-photo-8002454.jpeg?auto=compress&cs=tinysrgb&w=600', N'Shibuya Crossing Pulse starter showcase photo.', 0, 17),
    ('b1000000-0000-0000-0000-000000000018', '90000000-0000-0000-0000-000000000018', '11111111-1111-1111-1111-111111111111', N'showcase/spots/showcase-spot-18/hero.jpg', N'https://images.pexels.com/photos/33297793/pexels-photo-33297793.jpeg?auto=compress&cs=tinysrgb&w=1600', N'https://images.pexels.com/photos/33297793/pexels-photo-33297793.jpeg?auto=compress&cs=tinysrgb&w=600', N'Senso-ji Lantern Approach starter showcase photo.', 0, 18),
    ('b1000000-0000-0000-0000-000000000019', '90000000-0000-0000-0000-000000000019', '77777777-7777-7777-7777-777777777771', N'showcase/spots/showcase-spot-19/hero.jpg', N'https://images.pexels.com/photos/16680001/pexels-photo-16680001.jpeg?auto=compress&cs=tinysrgb&w=1600', N'https://images.pexels.com/photos/16680001/pexels-photo-16680001.jpeg?auto=compress&cs=tinysrgb&w=600', N'Park Guell Mosaic Terrace starter showcase photo.', 0, 19),
    ('b1000000-0000-0000-0000-000000000020', '90000000-0000-0000-0000-000000000020', '22222222-2222-2222-2222-222222222222', N'showcase/spots/showcase-spot-20/hero.jpg', N'https://images.pexels.com/photos/9964657/pexels-photo-9964657.jpeg?auto=compress&cs=tinysrgb&w=1600', N'https://images.pexels.com/photos/9964657/pexels-photo-9964657.jpeg?auto=compress&cs=tinysrgb&w=600', N'Portobello Road Market Stroll starter showcase photo.', 0, 20),
    ('b1000000-0000-0000-0000-000000000021', '90000000-0000-0000-0000-000000000021', '88888888-8888-8888-8888-888888888881', N'showcase/spots/showcase-spot-21/hero.jpg', N'https://images.pexels.com/photos/5229477/pexels-photo-5229477.jpeg?auto=compress&cs=tinysrgb&w=1600', N'https://images.pexels.com/photos/5229477/pexels-photo-5229477.jpeg?auto=compress&cs=tinysrgb&w=600', N'Gardens by the Bay Supertree Walk starter showcase photo.', 0, 21),
    ('b1000000-0000-0000-0000-000000000022', '90000000-0000-0000-0000-000000000022', '66666666-6666-6666-6666-666666666661', N'showcase/spots/showcase-spot-22/hero.jpg', N'https://images.pexels.com/photos/20536740/pexels-photo-20536740.jpeg?auto=compress&cs=tinysrgb&w=1600', N'https://images.pexels.com/photos/20536740/pexels-photo-20536740.jpeg?auto=compress&cs=tinysrgb&w=600', N'V&A Waterfront Table Mountain View starter showcase photo.', 0, 22),
    ('b1000000-0000-0000-0000-000000000023', '90000000-0000-0000-0000-000000000023', '77777777-7777-7777-7777-777777777771', N'showcase/spots/showcase-spot-23/hero.jpg', N'https://images.pexels.com/photos/33745931/pexels-photo-33745931.jpeg?auto=compress&cs=tinysrgb&w=1600', N'https://images.pexels.com/photos/33745931/pexels-photo-33745931.jpeg?auto=compress&cs=tinysrgb&w=600', N'Palacio de Bellas Artes Marble Steps starter showcase photo.', 0, 23),
    ('b1000000-0000-0000-0000-000000000024', '90000000-0000-0000-0000-000000000024', '55555555-5555-5555-5555-555555555551', N'showcase/spots/showcase-spot-24/hero.jpg', N'https://images.pexels.com/photos/1878293/pexels-photo-1878293.jpeg?auto=compress&cs=tinysrgb&w=1600', N'https://images.pexels.com/photos/1878293/pexels-photo-1878293.jpeg?auto=compress&cs=tinysrgb&w=600', N'Sydney Opera House Circular Quay starter showcase photo.', 0, 24);
MERGE dbo.photos_photo AS target
USING @ShowcasePhotos AS source
ON target.id = dbo.__scope_seed_uuid32(source.Id)
WHEN MATCHED THEN UPDATE SET spot_id = dbo.__scope_seed_uuid32(source.SpotId), user_id = dbo.__scope_seed_uuid32(source.UserId), storage_key = source.StorageKey, storage_url = source.StorageUrl, thumbnail_url = source.ThumbnailUrl, caption = source.Caption, sort_order = source.SortOrder
WHEN NOT MATCHED THEN INSERT (id, spot_id, user_id, storage_key, storage_url, thumbnail_url, caption, sort_order, created_at) VALUES (dbo.__scope_seed_uuid32(source.Id), dbo.__scope_seed_uuid32(source.SpotId), dbo.__scope_seed_uuid32(source.UserId), source.StorageKey, source.StorageUrl, source.ThumbnailUrl, source.Caption, source.SortOrder, DATEADD(DAY, -source.CreatedOffsetDays, @Now));

DECLARE @ShowcaseReviews TABLE (Id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY, SpotId UNIQUEIDENTIFIER NOT NULL, UserId UNIQUEIDENTIFIER NOT NULL, Rating DECIMAL(2,1) NOT NULL, Comment NVARCHAR(1000) NOT NULL, CreatedOffsetDays INT NOT NULL);
INSERT INTO @ShowcaseReviews (Id, SpotId, UserId, Rating, Comment, CreatedOffsetDays)
VALUES
    ('c1000000-0000-0000-0000-000000000001', '90000000-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 4.7, N'Easy to understand at a glance, with enough nearby texture to build a real route around it.', 2),
    ('c1000000-0000-0000-0000-000000000002', '90000000-0000-0000-0000-000000000001', '44444444-4444-4444-4444-444444444441', 4.6, N'Worth saving because it gives the map a clear anchor and still leaves room for nearby food or coffee.', 3),
    ('c1000000-0000-0000-0000-000000000003', '90000000-0000-0000-0000-000000000002', '33333333-3333-3333-3333-333333333333', 4.9, N'Strong starter pin for a first-time visitor. The pacing works better than trying to stack too many stops.', 3),
    ('c1000000-0000-0000-0000-000000000004', '90000000-0000-0000-0000-000000000002', '55555555-5555-5555-5555-555555555551', 4.8, N'Good public-profile material: recognizable place, useful notes, and a route-friendly location.', 4),
    ('c1000000-0000-0000-0000-000000000005', '90000000-0000-0000-0000-000000000003', '44444444-4444-4444-4444-444444444441', 4.8, N'Worth saving because it gives the map a clear anchor and still leaves room for nearby food or coffee.', 4),
    ('c1000000-0000-0000-0000-000000000006', '90000000-0000-0000-0000-000000000003', '66666666-6666-6666-6666-666666666661', 4.7, N'The kind of stop that makes a city feel less abstract once you land.', 5),
    ('c1000000-0000-0000-0000-000000000007', '90000000-0000-0000-0000-000000000004', '55555555-5555-5555-5555-555555555551', 4.8, N'Good public-profile material: recognizable place, useful notes, and a route-friendly location.', 5),
    ('c1000000-0000-0000-0000-000000000008', '90000000-0000-0000-0000-000000000004', '77777777-7777-7777-7777-777777777771', 4.7, N'Simple to explain to a group and flexible enough for a short or long visit.', 6),
    ('c1000000-0000-0000-0000-000000000009', '90000000-0000-0000-0000-000000000005', '66666666-6666-6666-6666-666666666661', 4.9, N'The kind of stop that makes a city feel less abstract once you land.', 6),
    ('c1000000-0000-0000-0000-000000000010', '90000000-0000-0000-0000-000000000005', '88888888-8888-8888-8888-888888888881', 4.8, N'Easy to understand at a glance, with enough nearby texture to build a real route around it.', 7),
    ('c1000000-0000-0000-0000-000000000011', '90000000-0000-0000-0000-000000000006', '77777777-7777-7777-7777-777777777771', 4.7, N'Simple to explain to a group and flexible enough for a short or long visit.', 7),
    ('c1000000-0000-0000-0000-000000000012', '90000000-0000-0000-0000-000000000006', '11111111-1111-1111-1111-111111111111', 4.6, N'Strong starter pin for a first-time visitor. The pacing works better than trying to stack too many stops.', 8),
    ('c1000000-0000-0000-0000-000000000013', '90000000-0000-0000-0000-000000000007', '88888888-8888-8888-8888-888888888881', 4.8, N'Easy to understand at a glance, with enough nearby texture to build a real route around it.', 8),
    ('c1000000-0000-0000-0000-000000000014', '90000000-0000-0000-0000-000000000007', '22222222-2222-2222-2222-222222222222', 4.7, N'Worth saving because it gives the map a clear anchor and still leaves room for nearby food or coffee.', 9),
    ('c1000000-0000-0000-0000-000000000015', '90000000-0000-0000-0000-000000000008', '11111111-1111-1111-1111-111111111111', 5, N'Strong starter pin for a first-time visitor. The pacing works better than trying to stack too many stops.', 9),
    ('c1000000-0000-0000-0000-000000000016', '90000000-0000-0000-0000-000000000008', '33333333-3333-3333-3333-333333333333', 4.9, N'Good public-profile material: recognizable place, useful notes, and a route-friendly location.', 10),
    ('c1000000-0000-0000-0000-000000000017', '90000000-0000-0000-0000-000000000009', '22222222-2222-2222-2222-222222222222', 4.6, N'Worth saving because it gives the map a clear anchor and still leaves room for nearby food or coffee.', 10),
    ('c1000000-0000-0000-0000-000000000018', '90000000-0000-0000-0000-000000000009', '44444444-4444-4444-4444-444444444441', 4.5, N'The kind of stop that makes a city feel less abstract once you land.', 11),
    ('c1000000-0000-0000-0000-000000000019', '90000000-0000-0000-0000-000000000010', '33333333-3333-3333-3333-333333333333', 4.9, N'Good public-profile material: recognizable place, useful notes, and a route-friendly location.', 11),
    ('c1000000-0000-0000-0000-000000000020', '90000000-0000-0000-0000-000000000010', '55555555-5555-5555-5555-555555555551', 4.8, N'Simple to explain to a group and flexible enough for a short or long visit.', 12),
    ('c1000000-0000-0000-0000-000000000021', '90000000-0000-0000-0000-000000000011', '44444444-4444-4444-4444-444444444441', 4.8, N'The kind of stop that makes a city feel less abstract once you land.', 12),
    ('c1000000-0000-0000-0000-000000000022', '90000000-0000-0000-0000-000000000011', '66666666-6666-6666-6666-666666666661', 4.7, N'Easy to understand at a glance, with enough nearby texture to build a real route around it.', 13),
    ('c1000000-0000-0000-0000-000000000023', '90000000-0000-0000-0000-000000000012', '55555555-5555-5555-5555-555555555551', 4.9, N'Simple to explain to a group and flexible enough for a short or long visit.', 13),
    ('c1000000-0000-0000-0000-000000000024', '90000000-0000-0000-0000-000000000012', '77777777-7777-7777-7777-777777777771', 4.8, N'Strong starter pin for a first-time visitor. The pacing works better than trying to stack too many stops.', 14),
    ('c1000000-0000-0000-0000-000000000025', '90000000-0000-0000-0000-000000000013', '66666666-6666-6666-6666-666666666661', 4.7, N'Easy to understand at a glance, with enough nearby texture to build a real route around it.', 14),
    ('c1000000-0000-0000-0000-000000000026', '90000000-0000-0000-0000-000000000013', '88888888-8888-8888-8888-888888888881', 4.6, N'Worth saving because it gives the map a clear anchor and still leaves room for nearby food or coffee.', 15),
    ('c1000000-0000-0000-0000-000000000027', '90000000-0000-0000-0000-000000000014', '77777777-7777-7777-7777-777777777771', 4.8, N'Strong starter pin for a first-time visitor. The pacing works better than trying to stack too many stops.', 15),
    ('c1000000-0000-0000-0000-000000000028', '90000000-0000-0000-0000-000000000014', '11111111-1111-1111-1111-111111111111', 4.7, N'Good public-profile material: recognizable place, useful notes, and a route-friendly location.', 16),
    ('c1000000-0000-0000-0000-000000000029', '90000000-0000-0000-0000-000000000015', '88888888-8888-8888-8888-888888888881', 4.8, N'Worth saving because it gives the map a clear anchor and still leaves room for nearby food or coffee.', 16),
    ('c1000000-0000-0000-0000-000000000030', '90000000-0000-0000-0000-000000000015', '22222222-2222-2222-2222-222222222222', 4.7, N'The kind of stop that makes a city feel less abstract once you land.', 17),
    ('c1000000-0000-0000-0000-000000000031', '90000000-0000-0000-0000-000000000016', '11111111-1111-1111-1111-111111111111', 4.7, N'Good public-profile material: recognizable place, useful notes, and a route-friendly location.', 17),
    ('c1000000-0000-0000-0000-000000000032', '90000000-0000-0000-0000-000000000016', '33333333-3333-3333-3333-333333333333', 4.6, N'Simple to explain to a group and flexible enough for a short or long visit.', 18),
    ('c1000000-0000-0000-0000-000000000033', '90000000-0000-0000-0000-000000000017', '22222222-2222-2222-2222-222222222222', 4.9, N'The kind of stop that makes a city feel less abstract once you land.', 18),
    ('c1000000-0000-0000-0000-000000000034', '90000000-0000-0000-0000-000000000017', '44444444-4444-4444-4444-444444444441', 4.8, N'Easy to understand at a glance, with enough nearby texture to build a real route around it.', 19),
    ('c1000000-0000-0000-0000-000000000035', '90000000-0000-0000-0000-000000000018', '33333333-3333-3333-3333-333333333333', 5, N'Simple to explain to a group and flexible enough for a short or long visit.', 19),
    ('c1000000-0000-0000-0000-000000000036', '90000000-0000-0000-0000-000000000018', '55555555-5555-5555-5555-555555555551', 4.9, N'Strong starter pin for a first-time visitor. The pacing works better than trying to stack too many stops.', 20),
    ('c1000000-0000-0000-0000-000000000037', '90000000-0000-0000-0000-000000000019', '44444444-4444-4444-4444-444444444441', 4.8, N'Easy to understand at a glance, with enough nearby texture to build a real route around it.', 20),
    ('c1000000-0000-0000-0000-000000000038', '90000000-0000-0000-0000-000000000019', '66666666-6666-6666-6666-666666666661', 4.7, N'Worth saving because it gives the map a clear anchor and still leaves room for nearby food or coffee.', 21),
    ('c1000000-0000-0000-0000-000000000039', '90000000-0000-0000-0000-000000000020', '55555555-5555-5555-5555-555555555551', 4.7, N'Strong starter pin for a first-time visitor. The pacing works better than trying to stack too many stops.', 21),
    ('c1000000-0000-0000-0000-000000000040', '90000000-0000-0000-0000-000000000020', '77777777-7777-7777-7777-777777777771', 4.6, N'Good public-profile material: recognizable place, useful notes, and a route-friendly location.', 22),
    ('c1000000-0000-0000-0000-000000000041', '90000000-0000-0000-0000-000000000021', '66666666-6666-6666-6666-666666666661', 5, N'Worth saving because it gives the map a clear anchor and still leaves room for nearby food or coffee.', 22),
    ('c1000000-0000-0000-0000-000000000042', '90000000-0000-0000-0000-000000000021', '88888888-8888-8888-8888-888888888881', 4.9, N'The kind of stop that makes a city feel less abstract once you land.', 23),
    ('c1000000-0000-0000-0000-000000000043', '90000000-0000-0000-0000-000000000022', '77777777-7777-7777-7777-777777777771', 4.8, N'Good public-profile material: recognizable place, useful notes, and a route-friendly location.', 23),
    ('c1000000-0000-0000-0000-000000000044', '90000000-0000-0000-0000-000000000022', '11111111-1111-1111-1111-111111111111', 4.7, N'Simple to explain to a group and flexible enough for a short or long visit.', 24),
    ('c1000000-0000-0000-0000-000000000045', '90000000-0000-0000-0000-000000000023', '88888888-8888-8888-8888-888888888881', 4.9, N'The kind of stop that makes a city feel less abstract once you land.', 24),
    ('c1000000-0000-0000-0000-000000000046', '90000000-0000-0000-0000-000000000023', '22222222-2222-2222-2222-222222222222', 4.8, N'Easy to understand at a glance, with enough nearby texture to build a real route around it.', 25),
    ('c1000000-0000-0000-0000-000000000047', '90000000-0000-0000-0000-000000000024', '11111111-1111-1111-1111-111111111111', 5, N'Simple to explain to a group and flexible enough for a short or long visit.', 25),
    ('c1000000-0000-0000-0000-000000000048', '90000000-0000-0000-0000-000000000024', '33333333-3333-3333-3333-333333333333', 4.9, N'Strong starter pin for a first-time visitor. The pacing works better than trying to stack too many stops.', 26);
MERGE dbo.reviews_review AS target
USING @ShowcaseReviews AS source
ON target.spot_id = dbo.__scope_seed_uuid32(source.SpotId) AND target.user_id = dbo.__scope_seed_uuid32(source.UserId)
WHEN MATCHED THEN UPDATE SET rating = source.Rating, comment = source.Comment
WHEN NOT MATCHED THEN INSERT (id, spot_id, user_id, rating, comment, created_at) VALUES (dbo.__scope_seed_uuid32(source.Id), dbo.__scope_seed_uuid32(source.SpotId), dbo.__scope_seed_uuid32(source.UserId), source.Rating, source.Comment, DATEADD(DAY, -source.CreatedOffsetDays, @Now));

DECLARE @ShowcaseLikes TABLE (Id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY, SpotId UNIQUEIDENTIFIER NOT NULL, UserId UNIQUEIDENTIFIER NOT NULL, CreatedOffsetDays INT NOT NULL);
INSERT INTO @ShowcaseLikes (Id, SpotId, UserId, CreatedOffsetDays)
VALUES
    ('d1000000-0000-0000-0000-000000000001', '90000000-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 1),
    ('d1000000-0000-0000-0000-000000000002', '90000000-0000-0000-0000-000000000001', '33333333-3333-3333-3333-333333333333', 2),
    ('d1000000-0000-0000-0000-000000000003', '90000000-0000-0000-0000-000000000001', '55555555-5555-5555-5555-555555555551', 4),
    ('d1000000-0000-0000-0000-000000000004', '90000000-0000-0000-0000-000000000001', '77777777-7777-7777-7777-777777777771', 6),
    ('d1000000-0000-0000-0000-000000000005', '90000000-0000-0000-0000-000000000002', '33333333-3333-3333-3333-333333333333', 2),
    ('d1000000-0000-0000-0000-000000000006', '90000000-0000-0000-0000-000000000002', '66666666-6666-6666-6666-666666666661', 5),
    ('d1000000-0000-0000-0000-000000000007', '90000000-0000-0000-0000-000000000002', '88888888-8888-8888-8888-888888888881', 7),
    ('d1000000-0000-0000-0000-000000000008', '90000000-0000-0000-0000-000000000003', '44444444-4444-4444-4444-444444444441', 3),
    ('d1000000-0000-0000-0000-000000000009', '90000000-0000-0000-0000-000000000003', '55555555-5555-5555-5555-555555555551', 4),
    ('d1000000-0000-0000-0000-000000000010', '90000000-0000-0000-0000-000000000003', '77777777-7777-7777-7777-777777777771', 6),
    ('d1000000-0000-0000-0000-000000000011', '90000000-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', 8),
    ('d1000000-0000-0000-0000-000000000012', '90000000-0000-0000-0000-000000000004', '55555555-5555-5555-5555-555555555551', 4),
    ('d1000000-0000-0000-0000-000000000013', '90000000-0000-0000-0000-000000000004', '66666666-6666-6666-6666-666666666661', 5),
    ('d1000000-0000-0000-0000-000000000014', '90000000-0000-0000-0000-000000000004', '88888888-8888-8888-8888-888888888881', 7),
    ('d1000000-0000-0000-0000-000000000015', '90000000-0000-0000-0000-000000000004', '22222222-2222-2222-2222-222222222222', 9),
    ('d1000000-0000-0000-0000-000000000016', '90000000-0000-0000-0000-000000000005', '66666666-6666-6666-6666-666666666661', 5),
    ('d1000000-0000-0000-0000-000000000017', '90000000-0000-0000-0000-000000000005', '77777777-7777-7777-7777-777777777771', 6),
    ('d1000000-0000-0000-0000-000000000018', '90000000-0000-0000-0000-000000000005', '11111111-1111-1111-1111-111111111111', 8),
    ('d1000000-0000-0000-0000-000000000019', '90000000-0000-0000-0000-000000000006', '77777777-7777-7777-7777-777777777771', 6),
    ('d1000000-0000-0000-0000-000000000020', '90000000-0000-0000-0000-000000000006', '88888888-8888-8888-8888-888888888881', 7),
    ('d1000000-0000-0000-0000-000000000021', '90000000-0000-0000-0000-000000000006', '44444444-4444-4444-4444-444444444441', 11),
    ('d1000000-0000-0000-0000-000000000022', '90000000-0000-0000-0000-000000000007', '88888888-8888-8888-8888-888888888881', 7),
    ('d1000000-0000-0000-0000-000000000023', '90000000-0000-0000-0000-000000000007', '11111111-1111-1111-1111-111111111111', 8),
    ('d1000000-0000-0000-0000-000000000024', '90000000-0000-0000-0000-000000000007', '33333333-3333-3333-3333-333333333333', 10),
    ('d1000000-0000-0000-0000-000000000025', '90000000-0000-0000-0000-000000000007', '55555555-5555-5555-5555-555555555551', 12),
    ('d1000000-0000-0000-0000-000000000026', '90000000-0000-0000-0000-000000000008', '11111111-1111-1111-1111-111111111111', 8),
    ('d1000000-0000-0000-0000-000000000027', '90000000-0000-0000-0000-000000000008', '22222222-2222-2222-2222-222222222222', 9),
    ('d1000000-0000-0000-0000-000000000028', '90000000-0000-0000-0000-000000000008', '44444444-4444-4444-4444-444444444441', 11),
    ('d1000000-0000-0000-0000-000000000029', '90000000-0000-0000-0000-000000000008', '66666666-6666-6666-6666-666666666661', 13),
    ('d1000000-0000-0000-0000-000000000030', '90000000-0000-0000-0000-000000000009', '22222222-2222-2222-2222-222222222222', 9),
    ('d1000000-0000-0000-0000-000000000031', '90000000-0000-0000-0000-000000000009', '33333333-3333-3333-3333-333333333333', 10),
    ('d1000000-0000-0000-0000-000000000032', '90000000-0000-0000-0000-000000000009', '55555555-5555-5555-5555-555555555551', 12),
    ('d1000000-0000-0000-0000-000000000033', '90000000-0000-0000-0000-000000000009', '77777777-7777-7777-7777-777777777771', 14),
    ('d1000000-0000-0000-0000-000000000034', '90000000-0000-0000-0000-000000000010', '33333333-3333-3333-3333-333333333333', 10),
    ('d1000000-0000-0000-0000-000000000035', '90000000-0000-0000-0000-000000000010', '44444444-4444-4444-4444-444444444441', 11),
    ('d1000000-0000-0000-0000-000000000036', '90000000-0000-0000-0000-000000000010', '66666666-6666-6666-6666-666666666661', 13),
    ('d1000000-0000-0000-0000-000000000037', '90000000-0000-0000-0000-000000000010', '88888888-8888-8888-8888-888888888881', 15),
    ('d1000000-0000-0000-0000-000000000038', '90000000-0000-0000-0000-000000000011', '44444444-4444-4444-4444-444444444441', 11),
    ('d1000000-0000-0000-0000-000000000039', '90000000-0000-0000-0000-000000000011', '55555555-5555-5555-5555-555555555551', 12),
    ('d1000000-0000-0000-0000-000000000040', '90000000-0000-0000-0000-000000000011', '77777777-7777-7777-7777-777777777771', 14),
    ('d1000000-0000-0000-0000-000000000041', '90000000-0000-0000-0000-000000000012', '55555555-5555-5555-5555-555555555551', 12),
    ('d1000000-0000-0000-0000-000000000042', '90000000-0000-0000-0000-000000000012', '88888888-8888-8888-8888-888888888881', 15),
    ('d1000000-0000-0000-0000-000000000043', '90000000-0000-0000-0000-000000000012', '22222222-2222-2222-2222-222222222222', 17),
    ('d1000000-0000-0000-0000-000000000044', '90000000-0000-0000-0000-000000000013', '66666666-6666-6666-6666-666666666661', 13),
    ('d1000000-0000-0000-0000-000000000045', '90000000-0000-0000-0000-000000000013', '11111111-1111-1111-1111-111111111111', 16),
    ('d1000000-0000-0000-0000-000000000046', '90000000-0000-0000-0000-000000000013', '33333333-3333-3333-3333-333333333333', 18),
    ('d1000000-0000-0000-0000-000000000047', '90000000-0000-0000-0000-000000000014', '77777777-7777-7777-7777-777777777771', 14),
    ('d1000000-0000-0000-0000-000000000048', '90000000-0000-0000-0000-000000000014', '88888888-8888-8888-8888-888888888881', 15),
    ('d1000000-0000-0000-0000-000000000049', '90000000-0000-0000-0000-000000000014', '44444444-4444-4444-4444-444444444441', 19),
    ('d1000000-0000-0000-0000-000000000050', '90000000-0000-0000-0000-000000000015', '88888888-8888-8888-8888-888888888881', 15),
    ('d1000000-0000-0000-0000-000000000051', '90000000-0000-0000-0000-000000000015', '11111111-1111-1111-1111-111111111111', 16),
    ('d1000000-0000-0000-0000-000000000052', '90000000-0000-0000-0000-000000000015', '33333333-3333-3333-3333-333333333333', 18),
    ('d1000000-0000-0000-0000-000000000053', '90000000-0000-0000-0000-000000000016', '11111111-1111-1111-1111-111111111111', 16),
    ('d1000000-0000-0000-0000-000000000054', '90000000-0000-0000-0000-000000000016', '22222222-2222-2222-2222-222222222222', 17),
    ('d1000000-0000-0000-0000-000000000055', '90000000-0000-0000-0000-000000000016', '44444444-4444-4444-4444-444444444441', 19),
    ('d1000000-0000-0000-0000-000000000056', '90000000-0000-0000-0000-000000000016', '66666666-6666-6666-6666-666666666661', 21),
    ('d1000000-0000-0000-0000-000000000057', '90000000-0000-0000-0000-000000000017', '22222222-2222-2222-2222-222222222222', 17),
    ('d1000000-0000-0000-0000-000000000058', '90000000-0000-0000-0000-000000000017', '33333333-3333-3333-3333-333333333333', 18),
    ('d1000000-0000-0000-0000-000000000059', '90000000-0000-0000-0000-000000000017', '55555555-5555-5555-5555-555555555551', 20),
    ('d1000000-0000-0000-0000-000000000060', '90000000-0000-0000-0000-000000000017', '77777777-7777-7777-7777-777777777771', 22),
    ('d1000000-0000-0000-0000-000000000061', '90000000-0000-0000-0000-000000000018', '33333333-3333-3333-3333-333333333333', 18),
    ('d1000000-0000-0000-0000-000000000062', '90000000-0000-0000-0000-000000000018', '44444444-4444-4444-4444-444444444441', 19),
    ('d1000000-0000-0000-0000-000000000063', '90000000-0000-0000-0000-000000000018', '66666666-6666-6666-6666-666666666661', 21),
    ('d1000000-0000-0000-0000-000000000064', '90000000-0000-0000-0000-000000000018', '88888888-8888-8888-8888-888888888881', 23),
    ('d1000000-0000-0000-0000-000000000065', '90000000-0000-0000-0000-000000000019', '44444444-4444-4444-4444-444444444441', 19),
    ('d1000000-0000-0000-0000-000000000066', '90000000-0000-0000-0000-000000000019', '55555555-5555-5555-5555-555555555551', 20),
    ('d1000000-0000-0000-0000-000000000067', '90000000-0000-0000-0000-000000000019', '11111111-1111-1111-1111-111111111111', 24),
    ('d1000000-0000-0000-0000-000000000068', '90000000-0000-0000-0000-000000000020', '55555555-5555-5555-5555-555555555551', 20),
    ('d1000000-0000-0000-0000-000000000069', '90000000-0000-0000-0000-000000000020', '66666666-6666-6666-6666-666666666661', 21),
    ('d1000000-0000-0000-0000-000000000070', '90000000-0000-0000-0000-000000000020', '88888888-8888-8888-8888-888888888881', 23),
    ('d1000000-0000-0000-0000-000000000071', '90000000-0000-0000-0000-000000000021', '66666666-6666-6666-6666-666666666661', 21),
    ('d1000000-0000-0000-0000-000000000072', '90000000-0000-0000-0000-000000000021', '77777777-7777-7777-7777-777777777771', 22),
    ('d1000000-0000-0000-0000-000000000073', '90000000-0000-0000-0000-000000000021', '11111111-1111-1111-1111-111111111111', 24),
    ('d1000000-0000-0000-0000-000000000074', '90000000-0000-0000-0000-000000000021', '33333333-3333-3333-3333-333333333333', 26),
    ('d1000000-0000-0000-0000-000000000075', '90000000-0000-0000-0000-000000000022', '77777777-7777-7777-7777-777777777771', 22),
    ('d1000000-0000-0000-0000-000000000076', '90000000-0000-0000-0000-000000000022', '88888888-8888-8888-8888-888888888881', 23),
    ('d1000000-0000-0000-0000-000000000077', '90000000-0000-0000-0000-000000000022', '22222222-2222-2222-2222-222222222222', 25),
    ('d1000000-0000-0000-0000-000000000078', '90000000-0000-0000-0000-000000000022', '44444444-4444-4444-4444-444444444441', 27),
    ('d1000000-0000-0000-0000-000000000079', '90000000-0000-0000-0000-000000000023', '88888888-8888-8888-8888-888888888881', 23),
    ('d1000000-0000-0000-0000-000000000080', '90000000-0000-0000-0000-000000000023', '11111111-1111-1111-1111-111111111111', 24),
    ('d1000000-0000-0000-0000-000000000081', '90000000-0000-0000-0000-000000000023', '33333333-3333-3333-3333-333333333333', 26),
    ('d1000000-0000-0000-0000-000000000082', '90000000-0000-0000-0000-000000000023', '55555555-5555-5555-5555-555555555551', 28),
    ('d1000000-0000-0000-0000-000000000083', '90000000-0000-0000-0000-000000000024', '11111111-1111-1111-1111-111111111111', 24),
    ('d1000000-0000-0000-0000-000000000084', '90000000-0000-0000-0000-000000000024', '22222222-2222-2222-2222-222222222222', 25),
    ('d1000000-0000-0000-0000-000000000085', '90000000-0000-0000-0000-000000000024', '44444444-4444-4444-4444-444444444441', 27),
    ('d1000000-0000-0000-0000-000000000086', '90000000-0000-0000-0000-000000000024', '66666666-6666-6666-6666-666666666661', 29);
MERGE dbo.trips_like AS target
USING @ShowcaseLikes AS source
ON target.spot_id = dbo.__scope_seed_uuid32(source.SpotId) AND target.user_id = dbo.__scope_seed_uuid32(source.UserId)
WHEN NOT MATCHED THEN INSERT (id, spot_id, user_id, created_at) VALUES (dbo.__scope_seed_uuid32(source.Id), dbo.__scope_seed_uuid32(source.SpotId), dbo.__scope_seed_uuid32(source.UserId), DATEADD(DAY, -source.CreatedOffsetDays, @Now));

DECLARE @ShowcaseTrips TABLE (Id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY, CreatorId UNIQUEIDENTIFIER NOT NULL, Title NVARCHAR(200) NOT NULL, Destination NVARCHAR(300) NOT NULL, Description NVARCHAR(MAX) NOT NULL, StartDate DATE NOT NULL, EndDate DATE NOT NULL, Budget DECIMAL(10,2) NOT NULL, Currency NVARCHAR(3) NOT NULL, Status NVARCHAR(20) NOT NULL, IsPublic BIT NOT NULL, CoverPhotoUrl NVARCHAR(1000) NOT NULL, ShareToken UNIQUEIDENTIFIER NOT NULL, CreatedOffsetDays INT NOT NULL);
INSERT INTO @ShowcaseTrips (Id, CreatorId, Title, Destination, Description, StartDate, EndDate, Budget, Currency, Status, IsPublic, CoverPhotoUrl, ShareToken, CreatedOffsetDays)
VALUES
    ('a1000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', N'Texas Starter Loop', N'Fort Worth, San Antonio, Austin, Dallas, Houston, Big Bend', N'A production-ready Texas sampler that mixes market stops, water views, skyline parks, and one true desert anchor.', '2026-04-10', '2026-04-14', 1180, N'USD', N'planning', 1, N'https://images.pexels.com/photos/32448258/pexels-photo-32448258.jpeg?auto=compress&cs=tinysrgb&w=1600', 'a2000000-0000-0000-0000-000000000001', 1),
    ('a1000000-0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222', N'US City Icons', N'Chicago, New York, Seattle, Miami, Los Angeles, Denver, New Orleans', N'A recognizable US showcase route for testing cards, trip detail, and map density across different metros.', '2026-05-02', '2026-05-09', 2420, N'USD', N'planning', 1, N'https://images.pexels.com/photos/5847695/pexels-photo-5847695.jpeg?auto=compress&cs=tinysrgb&w=1600', 'a2000000-0000-0000-0000-000000000002', 2),
    ('a1000000-0000-0000-0000-000000000003', '88888888-8888-8888-8888-888888888881', N'Tokyo to Singapore Culture Route', N'Tokyo and Singapore', N'A compact international starter route with neon, temple culture, and skyline garden contrast.', '2026-06-12', '2026-06-16', 1680, N'USD', N'planning', 1, N'https://images.pexels.com/photos/8002454/pexels-photo-8002454.jpeg?auto=compress&cs=tinysrgb&w=1600', 'a2000000-0000-0000-0000-000000000003', 3),
    ('a1000000-0000-0000-0000-000000000004', '77777777-7777-7777-7777-777777777771', N'World Waterfront and Market Circuit', N'Barcelona, London, Cape Town, Mexico City, Sydney', N'A global showcase route for testing far-apart pins, public trips, and profile activity with destination variety.', '2026-07-04', '2026-07-14', 3880, N'USD', N'planning', 1, N'https://images.pexels.com/photos/1878293/pexels-photo-1878293.jpeg?auto=compress&cs=tinysrgb&w=1600', 'a2000000-0000-0000-0000-000000000004', 4);
MERGE dbo.trips_trip AS target
USING @ShowcaseTrips AS source
ON target.id = dbo.__scope_seed_uuid32(source.Id)
WHEN MATCHED THEN UPDATE SET creator_id = dbo.__scope_seed_uuid32(source.CreatorId), title = source.Title, destination = source.Destination, description = source.Description, start_date = source.StartDate, end_date = source.EndDate, budget = source.Budget, currency = source.Currency, status = source.Status, is_public = source.IsPublic, cover_photo_url = source.CoverPhotoUrl
WHEN NOT MATCHED THEN INSERT (id, creator_id, title, destination, description, start_date, end_date, budget, currency, status, is_public, cover_photo_url, share_token, share_created_at, created_at) VALUES (dbo.__scope_seed_uuid32(source.Id), dbo.__scope_seed_uuid32(source.CreatorId), source.Title, source.Destination, source.Description, source.StartDate, source.EndDate, source.Budget, source.Currency, source.Status, source.IsPublic, source.CoverPhotoUrl, dbo.__scope_seed_uuid32(source.ShareToken), @Now, DATEADD(DAY, -source.CreatedOffsetDays, @Now));

DECLARE @ShowcaseTripSpots TABLE (Id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY, TripId UNIQUEIDENTIFIER NOT NULL, SpotId UNIQUEIDENTIFIER NOT NULL, DayNumber INT NOT NULL, SortOrder INT NOT NULL, Notes NVARCHAR(500) NOT NULL, Source NVARCHAR(32) NOT NULL);
INSERT INTO @ShowcaseTripSpots (Id, TripId, SpotId, DayNumber, SortOrder, Notes, Source)
VALUES
    ('e1000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', '90000000-0000-0000-0000-000000000001', 1, 0, N'Start with the Stockyards retail lane while storefronts are active.', N'saved_spot'),
    ('e1000000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000001', '90000000-0000-0000-0000-000000000003', 1, 1, N'Use the Water Gardens as a compact downtown architecture reset.', N'saved_spot'),
    ('e1000000-0000-0000-0000-000000000003', 'a1000000-0000-0000-0000-000000000001', '90000000-0000-0000-0000-000000000004', 2, 2, N'Make Pearl the flexible lunch and browse block.', N'saved_spot'),
    ('e1000000-0000-0000-0000-000000000004', 'a1000000-0000-0000-0000-000000000001', '90000000-0000-0000-0000-000000000002', 2, 3, N'Save the River Walk for blue-hour dinner energy.', N'saved_spot'),
    ('e1000000-0000-0000-0000-000000000005', 'a1000000-0000-0000-0000-000000000001', '90000000-0000-0000-0000-000000000005', 3, 4, N'Give Austin a morning skyline walk before traffic builds.', N'saved_spot'),
    ('e1000000-0000-0000-0000-000000000006', 'a1000000-0000-0000-0000-000000000001', '90000000-0000-0000-0000-000000000006', 3, 5, N'Drop into Klyde Warren before museums or dinner.', N'saved_spot'),
    ('e1000000-0000-0000-0000-000000000007', 'a1000000-0000-0000-0000-000000000001', '90000000-0000-0000-0000-000000000007', 4, 6, N'Let Houston read from the bayou trail first.', N'saved_spot'),
    ('e1000000-0000-0000-0000-000000000008', 'a1000000-0000-0000-0000-000000000001', '90000000-0000-0000-0000-000000000008', 5, 7, N'Treat Big Bend as a daylight-first closer, not a rushed detour.', N'saved_spot'),
    ('e1000000-0000-0000-0000-000000000009', 'a1000000-0000-0000-0000-000000000002', '90000000-0000-0000-0000-000000000010', 1, 0, N'Use public art as the Chicago first-look anchor.', N'saved_spot'),
    ('e1000000-0000-0000-0000-000000000010', 'a1000000-0000-0000-0000-000000000002', '90000000-0000-0000-0000-000000000011', 2, 1, N'Make the New York skyline moment a night-view decision.', N'saved_spot'),
    ('e1000000-0000-0000-0000-000000000011', 'a1000000-0000-0000-0000-000000000002', '90000000-0000-0000-0000-000000000012', 3, 2, N'Let Pike Place cover food, flowers, and waterfront movement.', N'saved_spot'),
    ('e1000000-0000-0000-0000-000000000012', 'a1000000-0000-0000-0000-000000000002', '90000000-0000-0000-0000-000000000013', 4, 3, N'Save Wynwood for late light and dinner proximity.', N'saved_spot'),
    ('e1000000-0000-0000-0000-000000000013', 'a1000000-0000-0000-0000-000000000002', '90000000-0000-0000-0000-000000000014', 5, 4, N'Keep the concert hall as a design stop before lunch.', N'saved_spot'),
    ('e1000000-0000-0000-0000-000000000014', 'a1000000-0000-0000-0000-000000000002', '90000000-0000-0000-0000-000000000015', 6, 5, N'Use Union Station for coffee and transit orientation.', N'saved_spot'),
    ('e1000000-0000-0000-0000-000000000015', 'a1000000-0000-0000-0000-000000000002', '90000000-0000-0000-0000-000000000016', 7, 6, N'Close in Jackson Square when music and street life are active.', N'saved_spot'),
    ('e1000000-0000-0000-0000-000000000016', 'a1000000-0000-0000-0000-000000000003', '90000000-0000-0000-0000-000000000017', 1, 0, N'Start with Shibuya when the crossing feels fully alive.', N'saved_spot'),
    ('e1000000-0000-0000-0000-000000000017', 'a1000000-0000-0000-0000-000000000003', '90000000-0000-0000-0000-000000000018', 2, 1, N'Use Senso-ji early before the approach gets dense.', N'saved_spot'),
    ('e1000000-0000-0000-0000-000000000018', 'a1000000-0000-0000-0000-000000000003', '90000000-0000-0000-0000-000000000021', 4, 2, N'Let Gardens by the Bay handle the skyline night finish.', N'saved_spot'),
    ('e1000000-0000-0000-0000-000000000019', 'a1000000-0000-0000-0000-000000000004', '90000000-0000-0000-0000-000000000019', 1, 0, N'Book Park Guell early and give the terrace enough breathing room.', N'saved_spot'),
    ('e1000000-0000-0000-0000-000000000020', 'a1000000-0000-0000-0000-000000000004', '90000000-0000-0000-0000-000000000020', 3, 1, N'Use Portobello Road as a market-first London morning.', N'saved_spot'),
    ('e1000000-0000-0000-0000-000000000021', 'a1000000-0000-0000-0000-000000000004', '90000000-0000-0000-0000-000000000022', 6, 2, N'Keep the waterfront flexible for food, shops, and mountain photos.', N'saved_spot'),
    ('e1000000-0000-0000-0000-000000000022', 'a1000000-0000-0000-0000-000000000004', '90000000-0000-0000-0000-000000000023', 8, 3, N'Anchor Mexico City with Bellas Artes before Alameda wandering.', N'saved_spot'),
    ('e1000000-0000-0000-0000-000000000023', 'a1000000-0000-0000-0000-000000000004', '90000000-0000-0000-0000-000000000024', 10, 4, N'Close with Circular Quay when ferry movement and light are strongest.', N'saved_spot');
MERGE dbo.trips_tripspot AS target
USING @ShowcaseTripSpots AS source
ON target.trip_id = dbo.__scope_seed_uuid32(source.TripId) AND target.spot_id = dbo.__scope_seed_uuid32(source.SpotId)
WHEN MATCHED THEN UPDATE SET day_number = source.DayNumber, sort_order = source.SortOrder, notes = source.Notes, source = source.Source
WHEN NOT MATCHED THEN INSERT (id, trip_id, spot_id, day_number, sort_order, notes, source) VALUES (dbo.__scope_seed_uuid32(source.Id), dbo.__scope_seed_uuid32(source.TripId), dbo.__scope_seed_uuid32(source.SpotId), source.DayNumber, source.SortOrder, source.Notes, source.Source);

DECLARE @ShowcaseTripMembers TABLE (Id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY, TripId UNIQUEIDENTIFIER NOT NULL, UserId UNIQUEIDENTIFIER NOT NULL, Role NVARCHAR(20) NOT NULL, JoinedOffsetDays INT NOT NULL);
INSERT INTO @ShowcaseTripMembers (Id, TripId, UserId, Role, JoinedOffsetDays)
VALUES
    ('f1000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', N'owner', 1),
    ('f1000000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', N'viewer', 2),
    ('f1000000-0000-0000-0000-000000000003', 'a1000000-0000-0000-0000-000000000001', '44444444-4444-4444-4444-444444444441', N'editor', 3),
    ('f1000000-0000-0000-0000-000000000004', 'a1000000-0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222', N'owner', 4),
    ('f1000000-0000-0000-0000-000000000005', 'a1000000-0000-0000-0000-000000000002', '55555555-5555-5555-5555-555555555551', N'editor', 5),
    ('f1000000-0000-0000-0000-000000000006', 'a1000000-0000-0000-0000-000000000002', '66666666-6666-6666-6666-666666666661', N'viewer', 6),
    ('f1000000-0000-0000-0000-000000000007', 'a1000000-0000-0000-0000-000000000003', '88888888-8888-8888-8888-888888888881', N'owner', 7),
    ('f1000000-0000-0000-0000-000000000008', 'a1000000-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', N'viewer', 8),
    ('f1000000-0000-0000-0000-000000000009', 'a1000000-0000-0000-0000-000000000003', '33333333-3333-3333-3333-333333333333', N'viewer', 9),
    ('f1000000-0000-0000-0000-000000000010', 'a1000000-0000-0000-0000-000000000004', '77777777-7777-7777-7777-777777777771', N'owner', 10),
    ('f1000000-0000-0000-0000-000000000011', 'a1000000-0000-0000-0000-000000000004', '55555555-5555-5555-5555-555555555551', N'editor', 11),
    ('f1000000-0000-0000-0000-000000000012', 'a1000000-0000-0000-0000-000000000004', '66666666-6666-6666-6666-666666666661', N'viewer', 12);
MERGE dbo.trips_tripmember AS target
USING @ShowcaseTripMembers AS source
ON target.trip_id = dbo.__scope_seed_uuid32(source.TripId) AND target.user_id = dbo.__scope_seed_uuid32(source.UserId)
WHEN MATCHED THEN UPDATE SET role = source.Role
WHEN NOT MATCHED THEN INSERT (id, trip_id, user_id, role, joined_at) VALUES (dbo.__scope_seed_uuid32(source.Id), dbo.__scope_seed_uuid32(source.TripId), dbo.__scope_seed_uuid32(source.UserId), source.Role, DATEADD(DAY, -source.JoinedOffsetDays, @Now));
GO

DROP FUNCTION IF EXISTS dbo.__scope_seed_uuid32;
GO
