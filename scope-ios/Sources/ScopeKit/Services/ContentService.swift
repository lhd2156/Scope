import Foundation

/// Client for the Django Content Engine (`scope_content`). Handles spots,
/// trips, photos, reviews, and the social feed.
public actor ContentService {
    private let client: APIClient
    public init(client: APIClient) { self.client = client }

    // MARK: - Spots

    public func listSpots(category: SpotCategory? = nil, city: String? = nil, search: String? = nil) async throws -> [Spot] {
        var query: [String: String] = [:]
        if let category { query["category"] = category.rawValue }
        if let city { query["city"] = city }
        if let search { query["q"] = search }
        return try await client.get("/api/content/spots/", query: query)
    }

    public func spot(id: String) async throws -> Spot {
        try await client.get("/api/content/spots/\(id)")
    }

    public func nearbySpots(latitude: Double, longitude: Double, radiusKm: Double = 5) async throws -> [Spot] {
        try await client.get(
            "/api/content/spots/nearby",
            query: [
                "lat": String(latitude),
                "lng": String(longitude),
                "radius": String(radiusKm)
            ]
        )
    }

    public func exploreSpots() async throws -> [Spot] {
        try await client.get("/api/content/spots/explore")
    }

    public func userSpots(userId: String) async throws -> [Spot] {
        try await client.get("/api/content/spots/user/\(userId)")
    }

    public func createSpot(_ spot: CreateSpotRequest) async throws -> Spot {
        try await client.post("/api/content/spots/", body: spot)
    }

    public func likeSpot(id: String) async throws {
        let _: Empty = try await client.post("/api/content/spots/\(id)/like", body: Empty())
    }

    public func unlikeSpot(id: String) async throws {
        let _: Empty = try await client.delete("/api/content/spots/\(id)/like")
    }

    public struct SpotPhoto: Codable, Identifiable, Sendable {
        public let id: String
        public let storageUrl: String
        public let caption: String?
    }

    public func spotPhotos(id: String) async throws -> [SpotPhoto] {
        try await client.get("/api/content/spots/\(id)/photos")
    }

    // MARK: - Trips

    public func listTrips() async throws -> [Trip] {
        try await client.get("/api/content/trips/")
    }

    public func publicTrips() async throws -> [Trip] {
        try await client.get("/api/content/trips/public")
    }

    public func trip(id: String) async throws -> Trip {
        try await client.get("/api/content/trips/\(id)")
    }

    // MARK: - Feed

    public struct FeedItem: Codable, Identifiable, Sendable {
        public let id: String
        public let type: String
        public let actorId: String
        public let actorName: String?
        public let spotId: String?
        public let tripId: String?
        public let photoUrl: String?
        public let createdAt: Date
    }

    public func socialFeed() async throws -> [FeedItem] {
        try await client.get("/api/content/feed/")
    }

    public func trendingSpots() async throws -> [Spot] {
        try await client.get("/api/content/feed/trending")
    }
}
