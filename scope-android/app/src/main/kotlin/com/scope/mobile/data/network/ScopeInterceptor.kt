package com.scope.mobile.data.network

import dagger.Lazy
import kotlinx.coroutines.runBlocking
import okhttp3.Interceptor
import okhttp3.Response
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Injects the JWT access token on every outbound request.
 */
@Singleton
class AuthInterceptor @Inject constructor(private val store: TokenStore) : Interceptor {
    override fun intercept(chain: Interceptor.Chain): Response {
        val tokens = store.tokens.value
        val builder = chain.request().newBuilder()
            .addHeader("Accept", "application/json")
            .addHeader("User-Agent", "scope-android/1.0")
        if (tokens.accessToken.isNotBlank()) {
            builder.addHeader("Authorization", "Bearer ${tokens.accessToken}")
        }
        return chain.proceed(builder.build())
    }
}

/**
 * Refreshes the JWT on 401 responses. Uses OkHttp's `Authenticator` contract
 * so the retry happens automatically, once per failed request.
 */
@Singleton
class ScopeAuthenticator @Inject constructor(
    private val store: TokenStore,
    private val refresher: Lazy<TokenRefresher>
) : okhttp3.Authenticator {
    override fun authenticate(route: okhttp3.Route?, response: Response): okhttp3.Request? {
        if (response.request.header("X-Scope-Retried") != null) return null

        val current = store.tokens.value
        if (current.refreshToken.isBlank()) return null

        val fresh = runBlocking { refresher.get().refresh(current.refreshToken) } ?: return null

        return response.request.newBuilder()
            .header("Authorization", "Bearer ${fresh.accessToken}")
            .header("X-Scope-Retried", "1")
            .build()
    }
}

fun interface TokenRefresher {
    suspend fun refresh(refreshToken: String): ScopeTokens?
}
