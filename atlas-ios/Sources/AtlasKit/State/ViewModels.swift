#if canImport(SwiftUI)
import SwiftUI
import Observation

@Observable
public final class AuthViewModel: @unchecked Sendable {
    public var email = ""
    public var password = ""
    public var username = ""
    public var displayName = ""
    public var isLoading = false
    public var error: String?

    public init() {}

    @MainActor
    public func signIn(session: AtlasSession) async {
        error = nil
        isLoading = true
        defer { isLoading = false }
        do {
            try await session.signIn(email: email.trimmingCharacters(in: .whitespacesAndNewlines),
                                     password: password)
        } catch {
            self.error = error.localizedDescription
        }
    }

    @MainActor
    public func register(session: AtlasSession) async {
        error = nil
        isLoading = true
        defer { isLoading = false }
        do {
            try await session.register(
                username: username.trimmingCharacters(in: .whitespacesAndNewlines),
                email: email.trimmingCharacters(in: .whitespacesAndNewlines),
                password: password,
                displayName: displayName.isEmpty ? username : displayName
            )
        } catch {
            self.error = error.localizedDescription
        }
    }
}

@Observable
public final class SpotsViewModel: @unchecked Sendable {
    public var spots: [Spot] = []
    public var filter: SpotCategory? = nil
    public var isLoading = false
    public var error: String?

    public init() {}

    @MainActor
    public func load(using session: AtlasSession) async {
        isLoading = true
        defer { isLoading = false }
        do {
            self.spots = try await session.content.listSpots(category: filter)
            self.error = nil
        } catch {
            self.error = error.localizedDescription
        }
    }

    @MainActor
    public func toggleFilter(_ category: SpotCategory?, session: AtlasSession) async {
        filter = category
        await load(using: session)
    }
}

@Observable
public final class ItineraryViewModel: @unchecked Sendable {
    public var itinerary: Itinerary?
    public var isGenerating = false
    public var error: String?

    public init() {}

    @MainActor
    public func generate(
        latitude: Double,
        longitude: Double,
        durationHours: Int,
        preferences: [String],
        session: AtlasSession
    ) async {
        isGenerating = true
        defer { isGenerating = false }
        do {
            self.itinerary = try await session.intel.generateItinerary(
                ItineraryRequest(
                    originLat: latitude,
                    originLng: longitude,
                    durationHours: durationHours,
                    preferences: preferences
                )
            )
            self.error = nil
        } catch {
            self.error = error.localizedDescription
        }
    }
}
#endif
