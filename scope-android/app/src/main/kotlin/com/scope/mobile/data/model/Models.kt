package com.scope.mobile.data.model

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

// -------- Envelope ---------------------------------------------------------

/**
 * Envelope shared by Scope.Core (`ApiResponse<T>`) and the Django/Flask
 * services (`{ data, meta? }`). `EnvelopeAwareCallAdapter` unwraps `data`.
 */
@JsonClass(generateAdapter = true)
data class ApiEnvelope<T>(
    val data: T?,
    val meta: ApiMeta? = null
)

@JsonClass(generateAdapter = true)
data class ApiMeta(
    val page: Int? = null,
    val pageSize: Int? = null,
    val total: Int? = null,
    val totalPages: Int? = null
)

// -------- Auth ------------------------------------------------------------

@JsonClass(generateAdapter = true)
data class LoginRequest(val email: String, val password: String)

@JsonClass(generateAdapter = true)
data class RegisterRequest(
    val username: String,
    val email: String,
    val password: String,
    val displayName: String
)

@JsonClass(generateAdapter = true)
data class RefreshRequest(val refreshToken: String)

@JsonClass(generateAdapter = true)
data class LogoutRequest(val refreshToken: String)

@JsonClass(generateAdapter = true)
data class AuthPayload(
    val id: String,
    val username: String,
    val email: String,
    val displayName: String?,
    val accessToken: String,
    val refreshToken: String
)

// -------- Users / notifications -------------------------------------------

@JsonClass(generateAdapter = true)
data class ScopeUser(
    val id: String,
    val username: String,
    val displayName: String,
    val email: String? = null,
    val bio: String? = null,
    val avatarUrl: String? = null,
    val createdAt: String? = null
)

@JsonClass(generateAdapter = true)
data class ScopeNotification(
    val id: String,
    val userId: String,
    val type: String,
    val title: String,
    val referenceId: String? = null,
    val readAt: String? = null,
    val createdAt: String
)

@JsonClass(generateAdapter = true)
data class Friendship(
    val id: String,
    val requesterId: String,
    val addresseeId: String,
    val status: String,
    val createdAt: String? = null
)

// -------- Spots / trips ---------------------------------------------------

enum class SpotCategory {
    @Json(name = "food") FOOD,
    @Json(name = "nature") NATURE,
    @Json(name = "nightlife") NIGHTLIFE,
    @Json(name = "culture") CULTURE,
    @Json(name = "adventure") ADVENTURE,
    @Json(name = "shopping") SHOPPING,
    @Json(name = "scenic") SCENIC,
    @Json(name = "other") OTHER;

    val label: String get() = name.lowercase().replaceFirstChar(Char::uppercase)
}

@JsonClass(generateAdapter = true)
data class Spot(
    val id: String,
    val userId: String? = null,
    val title: String,
    val description: String? = null,
    val latitude: Double,
    val longitude: Double,
    val category: SpotCategory,
    val city: String? = null,
    val country: String? = null,
    val vibe: String? = null,
    val isPublic: Boolean = true,
    val likeCount: Int? = null,
    val coverPhotoUrl: String? = null,
    val createdAt: String? = null
)

@JsonClass(generateAdapter = true)
data class CreateSpotRequest(
    val title: String,
    val description: String?,
    val latitude: Double,
    val longitude: Double,
    val category: SpotCategory,
    val city: String? = null,
    val country: String? = null,
    val vibe: String? = null,
    val isPublic: Boolean = true
)

@JsonClass(generateAdapter = true)
data class SpotPhoto(
    val id: String,
    val storageUrl: String,
    val caption: String? = null
)

@JsonClass(generateAdapter = true)
data class Trip(
    val id: String,
    val ownerId: String,
    val title: String,
    val description: String? = null,
    val startDate: String? = null,
    val endDate: String? = null,
    val isPublic: Boolean = true,
    val coverPhotoUrl: String? = null
)

@JsonClass(generateAdapter = true)
data class FeedItem(
    val id: String,
    val type: String,
    val actorId: String,
    val actorName: String? = null,
    val spotId: String? = null,
    val tripId: String? = null,
    val photoUrl: String? = null,
    val createdAt: String
)

// -------- Live sessions ---------------------------------------------------

@JsonClass(generateAdapter = true)
data class LiveSession(
    val id: String,
    val tripId: String,
    val userId: String,
    val latitude: Double,
    val longitude: Double,
    val isActive: Boolean,
    val lastPingAt: String? = null
)

@JsonClass(generateAdapter = true)
data class PingLocationRequest(
    val tripId: String,
    val latitude: Double,
    val longitude: Double
)

// -------- Intel ----------------------------------------------------------

@JsonClass(generateAdapter = true)
data class ItineraryRequest(
    val originLat: Double,
    val originLng: Double,
    val durationHours: Int,
    val preferences: List<String>,
    val transport: String = "walking"
)

@JsonClass(generateAdapter = true)
data class Itinerary(
    val id: String,
    val stops: List<ItineraryStop>,
    val totalDurationMinutes: Int,
    val totalDistanceKm: Double
)

@JsonClass(generateAdapter = true)
data class ItineraryStop(
    val id: String,
    val spotId: String,
    val title: String,
    val latitude: Double,
    val longitude: Double,
    val arrivalMinute: Int,
    val stayMinutes: Int
)

@JsonClass(generateAdapter = true)
data class SpotRecommendationRequest(
    val userId: String,
    val latitude: Double,
    val longitude: Double,
    val limit: Int = 10
)

@JsonClass(generateAdapter = true)
data class VibeMatchRequest(
    val userId: String,
    val vibes: List<String>,
    val latitude: Double,
    val longitude: Double
)

@JsonClass(generateAdapter = true)
data class VibeMatch(
    val id: String,
    val spotId: String,
    val score: Double,
    val explanation: String? = null
)

@JsonClass(generateAdapter = true)
data class WeatherSnapshot(
    val temperatureC: Double,
    val condition: String,
    val humidity: Int? = null,
    val windKph: Double? = null
)

@JsonClass(generateAdapter = true)
data class GeocodeResult(
    val id: String,
    val label: String,
    val latitude: Double,
    val longitude: Double
)

@JsonClass(generateAdapter = true)
data class RouteOptimizeRequest(
    val spots: List<String>,
    val startLat: Double? = null,
    val startLng: Double? = null
)

@JsonClass(generateAdapter = true)
data class RouteOptimizeResponse(
    val orderedSpotIds: List<String>,
    val distanceKm: Double,
    val durationMinutes: Int
)
