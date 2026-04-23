package com.atlas.mobile.data.repository

import com.atlas.mobile.data.model.CreateSpotRequest
import com.atlas.mobile.data.model.FeedItem
import com.atlas.mobile.data.model.Spot
import com.atlas.mobile.data.model.SpotCategory
import com.atlas.mobile.data.model.SpotPhoto
import com.atlas.mobile.data.network.toAtlasError
import com.atlas.mobile.data.remote.ContentApi
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class SpotsRepository @Inject constructor(private val content: ContentApi) {

    suspend fun list(category: SpotCategory? = null, search: String? = null): Result<List<Spot>> =
        runCatching {
            content.listSpots(
                category = category?.name?.lowercase(),
                search = search?.takeIf { it.isNotBlank() }
            )
        }.recoverCatching { throw it.toAtlasError() }

    suspend fun explore(): Result<List<Spot>> = runCatching { content.exploreSpots() }
        .recoverCatching { throw it.toAtlasError() }

    suspend fun trending(): Result<List<Spot>> = runCatching { content.trendingSpots() }
        .recoverCatching { throw it.toAtlasError() }

    suspend fun feed(): Result<List<FeedItem>> = runCatching { content.socialFeed() }
        .recoverCatching { throw it.toAtlasError() }

    suspend fun nearby(latitude: Double, longitude: Double, radiusKm: Double = 5.0): Result<List<Spot>> =
        runCatching { content.nearbySpots(latitude, longitude, radiusKm) }
            .recoverCatching { throw it.toAtlasError() }

    suspend fun forUser(userId: String): Result<List<Spot>> =
        runCatching { content.userSpots(userId) }
            .recoverCatching { throw it.toAtlasError() }

    suspend fun detail(id: String): Result<Spot> = runCatching { content.spot(id) }
        .recoverCatching { throw it.toAtlasError() }

    suspend fun photos(id: String): Result<List<SpotPhoto>> = runCatching { content.spotPhotos(id) }
        .recoverCatching { throw it.toAtlasError() }

    suspend fun create(request: CreateSpotRequest): Result<Spot> = runCatching { content.createSpot(request) }
        .recoverCatching { throw it.toAtlasError() }

    suspend fun like(id: String, liked: Boolean): Result<Unit> = runCatching {
        if (liked) content.likeSpot(id) else content.unlikeSpot(id)
        Unit
    }.recoverCatching { throw it.toAtlasError() }
}
