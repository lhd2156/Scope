package com.scope.mobile.data.repository

import com.scope.mobile.data.model.GeocodeResult
import com.scope.mobile.data.model.Itinerary
import com.scope.mobile.data.model.ItineraryRequest
import com.scope.mobile.data.model.RouteOptimizeRequest
import com.scope.mobile.data.model.RouteOptimizeResponse
import com.scope.mobile.data.model.Spot
import com.scope.mobile.data.model.SpotRecommendationRequest
import com.scope.mobile.data.model.VibeMatch
import com.scope.mobile.data.model.VibeMatchRequest
import com.scope.mobile.data.model.WeatherSnapshot
import com.scope.mobile.data.network.toScopeError
import com.scope.mobile.data.remote.IntelApi
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class IntelRepository @Inject constructor(private val intel: IntelApi) {

    suspend fun generateItinerary(request: ItineraryRequest): Result<Itinerary> =
        runCatching { intel.generateItinerary(request) }.recoverCatching { throw it.toScopeError() }

    suspend fun recommendSpots(request: SpotRecommendationRequest): Result<List<Spot>> =
        runCatching { intel.recommendSpots(request) }.recoverCatching { throw it.toScopeError() }

    suspend fun similarSpots(spotId: String): Result<List<Spot>> =
        runCatching { intel.similarSpots(spotId) }.recoverCatching { throw it.toScopeError() }

    suspend fun vibeMatch(request: VibeMatchRequest): Result<List<VibeMatch>> =
        runCatching { intel.vibeMatch(request) }.recoverCatching { throw it.toScopeError() }

    suspend fun optimizeRoute(request: RouteOptimizeRequest): Result<RouteOptimizeResponse> =
        runCatching { intel.optimizeRoute(request) }.recoverCatching { throw it.toScopeError() }

    suspend fun weather(latitude: Double, longitude: Double): Result<WeatherSnapshot> =
        runCatching { intel.weather(latitude, longitude) }.recoverCatching { throw it.toScopeError() }

    suspend fun geocode(query: String): Result<List<GeocodeResult>> =
        runCatching { intel.geocode(query) }.recoverCatching { throw it.toScopeError() }
}
