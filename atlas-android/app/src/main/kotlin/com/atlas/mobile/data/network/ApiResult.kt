package com.atlas.mobile.data.network

import retrofit2.HttpException
import java.io.IOException

sealed class AtlasError : Throwable() {
    data class Transport(override val message: String) : AtlasError()
    object Unauthorized : AtlasError()
    object Forbidden : AtlasError()
    object NotFound : AtlasError()
    data class Conflict(override val message: String) : AtlasError()
    data class Server(val status: Int, override val message: String) : AtlasError()
    data class Unknown(override val message: String = "Something went wrong") : AtlasError()
}

fun Throwable.toAtlasError(): AtlasError = when (this) {
    is AtlasError -> this
    is IOException -> AtlasError.Transport(localizedMessage ?: "Network error")
    is HttpException -> when (code()) {
        401 -> AtlasError.Unauthorized
        403 -> AtlasError.Forbidden
        404 -> AtlasError.NotFound
        409 -> AtlasError.Conflict(message())
        in 500..599 -> AtlasError.Server(code(), message())
        else -> AtlasError.Unknown(message())
    }
    else -> AtlasError.Unknown(localizedMessage ?: "Unknown error")
}
