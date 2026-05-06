import Foundation

/// Client for the C# ASP.NET Core backend (`Scope.Core`). Handles auth,
/// users, friends, notifications, and live trip sessions.
public actor CoreService {
    private let client: APIClient
    private let tokens: any TokenStoring

    public init(client: APIClient, tokens: any TokenStoring) {
        self.client = client
        self.tokens = tokens
    }

    // MARK: - Auth

    public func login(email: String, password: String) async throws -> AuthPayload {
        let payload: AuthPayload = try await client.post(
            "/api/core/auth/login",
            body: LoginRequest(email: email, password: password)
        )
        await tokens.save(ScopeTokens(accessToken: payload.accessToken, refreshToken: payload.refreshToken))
        return payload
    }

    public func register(username: String, email: String, password: String, displayName: String) async throws -> AuthPayload {
        let payload: AuthPayload = try await client.post(
            "/api/core/auth/register",
            body: RegisterRequest(username: username, email: email, password: password, displayName: displayName)
        )
        await tokens.save(ScopeTokens(accessToken: payload.accessToken, refreshToken: payload.refreshToken))
        return payload
    }

    public func refresh(using refreshToken: String) async throws -> AuthPayload {
        let payload: AuthPayload = try await client.post(
            "/api/core/auth/refresh",
            body: RefreshRequest(refreshToken: refreshToken)
        )
        await tokens.save(ScopeTokens(accessToken: payload.accessToken, refreshToken: payload.refreshToken))
        return payload
    }

    public func logout() async throws {
        guard let current = await tokens.load() else { return }
        let _: Empty = try await client.post(
            "/api/core/auth/logout",
            body: LogoutRequest(refreshToken: current.refreshToken)
        )
        await tokens.clear()
    }

    public func me() async throws -> ScopeUser {
        try await client.get("/api/core/auth/me")
    }

    // MARK: - Users

    public func user(id: String) async throws -> ScopeUser {
        try await client.get("/api/core/users/\(id)")
    }

    public func searchUsers(query: String) async throws -> [ScopeUser] {
        try await client.get("/api/core/users/search", query: ["q": query])
    }

    // MARK: - Friends

    public struct Friendship: Codable, Identifiable, Sendable {
        public let id: String
        public let requesterId: String
        public let addresseeId: String
        public let status: String
        public let createdAt: Date?
    }

    public func requestFriendship(userId: String) async throws -> Friendship {
        try await client.post("/api/core/friends/request/\(userId)", body: Empty())
    }

    public func acceptFriendship(id: String) async throws -> Friendship {
        try await client.put("/api/core/friends/\(id)/accept", body: Empty())
    }

    // MARK: - Notifications

    public func notifications(page: Int = 1, pageSize: Int = 20) async throws -> [ScopeNotification] {
        try await client.get(
            "/api/core/notifications",
            query: ["page": String(page), "pageSize": String(pageSize)]
        )
    }

    // MARK: - Live sessions

    public struct LiveSession: Codable, Identifiable, Sendable {
        public let id: String
        public let tripId: String
        public let userId: String
        public let latitude: Double
        public let longitude: Double
        public let isActive: Bool
        public let lastPingAt: Date?
    }

    public func startLiveSession(tripId: String) async throws -> LiveSession {
        try await client.post("/api/core/live/start/\(tripId)", body: Empty())
    }

    public struct PingLocationRequest: Codable, Sendable {
        public let tripId: String
        public let latitude: Double
        public let longitude: Double
    }

    public func pingLocation(tripId: String, latitude: Double, longitude: Double) async throws -> LiveSession {
        try await client.put(
            "/api/core/live/ping",
            body: PingLocationRequest(tripId: tripId, latitude: latitude, longitude: longitude)
        )
    }

    public func liveSessions(tripId: String) async throws -> [LiveSession] {
        try await client.get("/api/core/live/trip/\(tripId)")
    }
}
