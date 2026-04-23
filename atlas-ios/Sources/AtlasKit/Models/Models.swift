import Foundation

// MARK: - Auth

public struct LoginRequest: Codable, Sendable {
    public let email: String
    public let password: String
    public init(email: String, password: String) {
        self.email = email
        self.password = password
    }
}

public struct RegisterRequest: Codable, Sendable {
    public let username: String
    public let email: String
    public let password: String
    public let displayName: String
    public init(username: String, email: String, password: String, displayName: String) {
        self.username = username
        self.email = email
        self.password = password
        self.displayName = displayName
    }
}

public struct AuthPayload: Codable, Sendable, Equatable {
    public let id: String
    public let username: String
    public let email: String
    public let displayName: String?
    public let accessToken: String
    public let refreshToken: String

    private enum CodingKeys: String, CodingKey {
        case id, username, email, displayName, accessToken, refreshToken
        case userId, access, refresh
    }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        self.id = try c.decodeIfPresent(String.self, forKey: .id)
            ?? c.decode(String.self, forKey: .userId)
        self.username = try c.decode(String.self, forKey: .username)
        self.email = try c.decode(String.self, forKey: .email)
        self.displayName = try c.decodeIfPresent(String.self, forKey: .displayName)
        self.accessToken = try c.decodeIfPresent(String.self, forKey: .accessToken)
            ?? c.decode(String.self, forKey: .access)
        self.refreshToken = try c.decodeIfPresent(String.self, forKey: .refreshToken)
            ?? c.decode(String.self, forKey: .refresh)
    }

    public func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        try c.encode(id, forKey: .id)
        try c.encode(username, forKey: .username)
        try c.encode(email, forKey: .email)
        try c.encodeIfPresent(displayName, forKey: .displayName)
        try c.encode(accessToken, forKey: .accessToken)
        try c.encode(refreshToken, forKey: .refreshToken)
    }

    public init(id: String, username: String, email: String, displayName: String?, accessToken: String, refreshToken: String) {
        self.id = id
        self.username = username
        self.email = email
        self.displayName = displayName
        self.accessToken = accessToken
        self.refreshToken = refreshToken
    }
}

public struct RefreshRequest: Codable, Sendable {
    public let refreshToken: String
}

public struct LogoutRequest: Codable, Sendable {
    public let refreshToken: String
}

// MARK: - User

public struct AtlasUser: Codable, Identifiable, Sendable, Hashable {
    public let id: String
    public let username: String
    public let displayName: String
    public let email: String?
    public let bio: String?
    public let avatarUrl: String?
    public let createdAt: Date?

    public init(id: String, username: String, displayName: String, email: String? = nil, bio: String? = nil, avatarUrl: String? = nil, createdAt: Date? = nil) {
        self.id = id
        self.username = username
        self.displayName = displayName
        self.email = email
        self.bio = bio
        self.avatarUrl = avatarUrl
        self.createdAt = createdAt
    }
}

// MARK: - Notifications

public struct AtlasNotification: Codable, Identifiable, Sendable {
    public let id: String
    public let userId: String
    public let type: String
    public let title: String
    public let referenceId: String?
    public let readAt: Date?
    public let createdAt: Date
}

// MARK: - Spots

public enum SpotCategory: String, Codable, CaseIterable, Sendable {
    case food, nature, nightlife, culture, adventure, shopping, scenic, other
}

public struct Spot: Codable, Identifiable, Sendable, Hashable {
    public let id: String
    public let userId: String?
    public let title: String
    public let description: String?
    public let latitude: Double
    public let longitude: Double
    public let category: SpotCategory
    public let city: String?
    public let country: String?
    public let vibe: String?
    public let isPublic: Bool
    public let likeCount: Int?
    public let coverPhotoUrl: String?
    public let createdAt: Date?
}

public struct CreateSpotRequest: Codable, Sendable {
    public let title: String
    public let description: String?
    public let latitude: Double
    public let longitude: Double
    public let category: SpotCategory
    public let city: String?
    public let country: String?
    public let vibe: String?
    public let isPublic: Bool

    public init(title: String, description: String?, latitude: Double, longitude: Double, category: SpotCategory, city: String? = nil, country: String? = nil, vibe: String? = nil, isPublic: Bool = true) {
        self.title = title
        self.description = description
        self.latitude = latitude
        self.longitude = longitude
        self.category = category
        self.city = city
        self.country = country
        self.vibe = vibe
        self.isPublic = isPublic
    }
}

// MARK: - Trips

public struct Trip: Codable, Identifiable, Sendable {
    public let id: String
    public let ownerId: String
    public let title: String
    public let description: String?
    public let startDate: Date?
    public let endDate: Date?
    public let isPublic: Bool
    public let coverPhotoUrl: String?
}

public struct TripSpot: Codable, Identifiable, Sendable {
    public let id: String
    public let tripId: String
    public let spotId: String
    public let sortOrder: Int
    public let notes: String?
}

// MARK: - Intel

public struct ItineraryRequest: Codable, Sendable {
    public let originLat: Double
    public let originLng: Double
    public let durationHours: Int
    public let preferences: [String]
    public let transport: String

    public init(originLat: Double, originLng: Double, durationHours: Int, preferences: [String], transport: String = "walking") {
        self.originLat = originLat
        self.originLng = originLng
        self.durationHours = durationHours
        self.preferences = preferences
        self.transport = transport
    }
}

public struct Itinerary: Codable, Identifiable, Sendable {
    public let id: String
    public let stops: [ItineraryStop]
    public let totalDurationMinutes: Int
    public let totalDistanceKm: Double
}

public struct ItineraryStop: Codable, Identifiable, Sendable {
    public let id: String
    public let spotId: String
    public let title: String
    public let latitude: Double
    public let longitude: Double
    public let arrivalMinute: Int
    public let stayMinutes: Int
}

public struct WeatherSnapshot: Codable, Sendable {
    public let temperatureC: Double
    public let condition: String
    public let humidity: Int?
    public let windKph: Double?
}
