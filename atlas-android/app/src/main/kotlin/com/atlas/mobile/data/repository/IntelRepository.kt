package com.atlas.mobile.data.repository

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
import com.atlas.mobile.data.network.toAtlasError
import com.atlas.mobile.data.remote.IntelApi
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class IntelRepository @Inject constructor(private val intel: IntelApi) {

    suspend fun generateItinerary(request: ItineraryRequest): Result<Itinerary> =
        runCatching { intel.generateItinerary(request) }.recoverCatching { throw it.toAtlasError() }

    suspend fun recommendSpots(request: SpotRecommendationRequest): Result<List<Spot>> =
        runCatching { intel.recommendSpots(request) }.recoverCatching { throw it.toAtlasError() }

    suspend fun similarSpots(spotId: String): Result<List<Spot>> =
        runCatching { intel.similarSpots(spotId) }.recoverCatching { throw it.toAtlasError() }

    suspend fun vibeMatch(request: VibeMatchRequest): Result<List<VibeMatch>> =
        runCatching { intel.vibeMatch(request) }.recoverCatching { throw it.toAtlasError() }

    suspend fun optimizeRoute(request: RouteOptimizeRequest): Result<RouteOptimizeResponse> =
        runCatching { intel.optimizeRoute(request) }.recoverCatching { throw it.toAtlasError() }

    suspend fun weather(latitude: Double, longitude: Double): Result<WeatherSnapshot> =
        runCatching { intel.weather(latitude, longitude) }.recoverCatching { throw it.toAtlasError() }

    suspend fun geocode(query: String): Result<List<GeocodeResult>> =
        runCatching { intel.geocode(query) }.recoverCatching { throw it.toAtlasError() }
}
