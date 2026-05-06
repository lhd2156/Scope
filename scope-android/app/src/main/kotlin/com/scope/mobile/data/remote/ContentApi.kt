package com.scope.mobile.data.remote

import com.scope.mobile.data.model.CreateSpotRequest
import com.scope.mobile.data.model.FeedItem
import com.scope.mobile.data.model.Spot
import com.scope.mobile.data.model.SpotPhoto
import com.scope.mobile.data.model.Trip
import retrofit2.http.Body
import retrofit2.http.DELETE
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.Path
import retrofit2.http.Query

/** Client for the Django `scope_content` service (`/api/content/*`). */
interface ContentApi {

    // ---- Spots ----

    @GET("api/content/spots/")
    suspend fun listSpots(
        @Query("category") category: String? = null,
        @Query("city") city: String? = null,
        @Query("q") search: String? = null
    ): List<Spot>

    @GET("api/content/spots/{id}")
    suspend fun spot(@Path("id") id: String): Spot

    @GET("api/content/spots/nearby")
    suspend fun nearbySpots(
        @Query("lat") latitude: Double,
        @Query("lng") longitude: Double,
        @Query("radius") radiusKm: Double = 5.0
    ): List<Spot>

    @GET("api/content/spots/explore")
    suspend fun exploreSpots(): List<Spot>

    @GET("api/content/spots/user/{userId}")
    suspend fun userSpots(@Path("userId") userId: String): List<Spot>

    @POST("api/content/spots/")
    suspend fun createSpot(@Body body: CreateSpotRequest): Spot

    @POST("api/content/spots/{id}/like")
    suspend fun likeSpot(@Path("id") id: String): Map<String, Any>

    @DELETE("api/content/spots/{id}/like")
    suspend fun unlikeSpot(@Path("id") id: String): Map<String, Any>

    @GET("api/content/spots/{id}/photos")
    suspend fun spotPhotos(@Path("id") id: String): List<SpotPhoto>

    // ---- Trips ----

    @GET("api/content/trips/")
    suspend fun listTrips(): List<Trip>

    @GET("api/content/trips/public")
    suspend fun publicTrips(): List<Trip>

    @GET("api/content/trips/{id}")
    suspend fun trip(@Path("id") id: String): Trip

    // ---- Feed ----

    @GET("api/content/feed/")
    suspend fun socialFeed(): List<FeedItem>

    @GET("api/content/feed/trending")
    suspend fun trendingSpots(): List<Spot>
}
