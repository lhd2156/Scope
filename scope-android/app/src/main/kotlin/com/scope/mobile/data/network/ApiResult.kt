package com.scope.mobile.data.network

import retrofit2.HttpException
import java.io.IOException

sealed class ScopeError : Throwable() {
    data class Transport(override val message: String) : ScopeError()
    object Unauthorized : ScopeError()
    object Forbidden : ScopeError()
    object NotFound : ScopeError()
    data class Conflict(override val message: String) : ScopeError()
    data class Server(val status: Int, override val message: String) : ScopeError()
    data class Unknown(override val message: String = "Something went wrong") : ScopeError()
}

fun Throwable.toScopeError(): ScopeError = when (this) {
    is ScopeError -> this
    is IOException -> ScopeError.Transport(localizedMessage ?: "Network error")
    is HttpException -> when (code()) {
        401 -> ScopeError.Unauthorized
        403 -> ScopeError.Forbidden
        404 -> ScopeError.NotFound
        409 -> ScopeError.Conflict(message())
        in 500..599 -> ScopeError.Server(code(), message())
        else -> ScopeError.Unknown(message())
    }
    else -> ScopeError.Unknown(localizedMessage ?: "Unknown error")
}
