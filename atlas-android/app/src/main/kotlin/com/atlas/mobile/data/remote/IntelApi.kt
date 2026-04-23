package com.atlas.mobile.data.remote

import com.atlas.mobile.data.model.GeocodeResult
import com.atlas.mobile.data.model.Itinerary
import com.atlas.mobile.data.model.ItineraryRequest
import com.atlas.mobile.data.model.RouteOptimizeRequest
import com.atlas.mobile.data.model.RouteOptimizeResponse
import com.atlas.mobile.data.model.Spot
import com.atlas.mobile.data.model.SpotRecommendationRequest
import com.atlas.mobile.data.model.VibeMatch
import com.atlas.mobile.data.model.VibeMatchRequest
import com.atlas.mobile.data.model.WeatherSnapshot
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.Path
import retrofit2.http.Query

/** Client for the Flask `atlas_intel` service (`/api/intel/*`). */
interface IntelApi {

    @POST("api/intel/itinerary/generate")
    suspend fun generateItinerary(@Body body: ItineraryRequest): Itinerary

    @GET("api/intel/itinerary/{id}")
    suspend fun itinerary(@Path("id") id: String): Itinerary

    @POST("api/intel/recommend/spots")
    suspend fun recommendSpots(@Body body: SpotRecommendationRequest): List<Spot>

    @POST("api/intel/recommend/similar/{spotId}")
    suspend fun similarSpots(@Path("spotId") spotId: String): List<Spot>

    @POST("api/intel/vibe-match")
    suspend fun vibeMatch(@Body body: VibeMatchRequest): List<VibeMatch>

    @POST("api/intel/route/optimize")
    suspend fun optimizeRoute(@Body body: RouteOptimizeRequest): RouteOptimizeResponse

    @GET("api/intel/weather")
    suspend fun weather(
        @Query("lat") latitude: Double,
        @Query("lng") longitude: Double
    ): WeatherSnapshot

    @GET("api/intel/geocode")
    suspend fun geocode(@Query("q") query: String): List<GeocodeResult>

    @GET("api/intel/reverse-geocode")
    suspend fun reverseGeocode(
        @Query("lat") latitude: Double,
        @Query("lng") longitude: Double
    ): GeocodeResult
}
