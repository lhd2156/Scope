import Foundation

/// Client for the Flask Intelligence API (`scope_intel`). Handles AI
/// itineraries, vibe matching, recommendations, weather, and geocoding.
public actor IntelService {
    private let client: APIClient
    public init(client: APIClient) { self.client = client }

    public func generateItinerary(_ request: ItineraryRequest) async throws -> Itinerary {
        try await client.post("/api/intel/itinerary/generate", body: request)
    }

    public func itinerary(id: String) async throws -> Itinerary {
        try await client.get("/api/intel/itinerary/\(id)")
    }

    public struct SpotRecommendationRequest: Codable, Sendable {
        public let userId: String
        public let latitude: Double
        public let longitude: Double
        public let limit: Int

        public init(userId: String, latitude: Double, longitude: Double, limit: Int = 10) {
            self.userId = userId
            self.latitude = latitude
            self.longitude = longitude
            self.limit = limit
        }
    }

    public func recommendSpots(_ request: SpotRecommendationRequest) async throws -> [Spot] {
        try await client.post("/api/intel/recommend/spots", body: request)
    }

    public func similarSpots(spotId: String) async throws -> [Spot] {
        try await client.post("/api/intel/recommend/similar/\(spotId)", body: Empty())
    }

    public struct VibeMatchRequest: Codable, Sendable {
        public let userId: String
        public let vibes: [String]
        public let latitude: Double
        public let longitude: Double

        public init(userId: String, vibes: [String], latitude: Double, longitude: Double) {
            self.userId = userId
            self.vibes = vibes
            self.latitude = latitude
            self.longitude = longitude
        }
    }

    public struct VibeMatch: Codable, Identifiable, Sendable {
        public let id: String
        public let spotId: String
        public let score: Double
        public let explanation: String?
    }

    public func vibeMatch(_ request: VibeMatchRequest) async throws -> [VibeMatch] {
        try await client.post("/api/intel/vibe-match", body: request)
    }

    public struct RouteOptimizeRequest: Codable, Sendable {
        public let spots: [String]
        public let startLat: Double?
        public let startLng: Double?
    }

    public struct RouteOptimizeResponse: Codable, Sendable {
        public let orderedSpotIds: [String]
        public let distanceKm: Double
        public let durationMinutes: Int
    }

    public func optimizeRoute(_ request: RouteOptimizeRequest) async throws -> RouteOptimizeResponse {
        try await client.post("/api/intel/route/optimize", body: request)
    }

    public func weather(latitude: Double, longitude: Double) async throws -> WeatherSnapshot {
        try await client.get(
            "/api/intel/weather",
            query: ["lat": String(latitude), "lng": String(longitude)]
        )
    }

    public struct GeocodeResult: Codable, Identifiable, Sendable {
        public let id: String
        public let label: String
        public let latitude: Double
        public let longitude: Double
    }

    public func geocode(query: String) async throws -> [GeocodeResult] {
        try await client.get("/api/intel/geocode", query: ["q": query])
    }

    public func reverseGeocode(latitude: Double, longitude: Double) async throws -> GeocodeResult {
        try await client.get(
            "/api/intel/reverse-geocode",
            query: ["lat": String(latitude), "lng": String(longitude)]
        )
    }
}
