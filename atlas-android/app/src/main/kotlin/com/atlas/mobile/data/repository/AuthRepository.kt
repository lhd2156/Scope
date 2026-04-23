package com.atlas.mobile.data.repository

import com.atlas.mobile.data.model.AtlasUser
import com.atlas.mobile.data.model.AuthPayload
import com.atlas.mobile.data.model.LoginRequest
import com.atlas.mobile.data.model.LogoutRequest
import com.atlas.mobile.data.model.RefreshRequest
import com.atlas.mobile.data.model.RegisterRequest
import com.atlas.mobile.data.network.AtlasTokens
import com.atlas.mobile.data.network.TokenStore
import com.atlas.mobile.data.network.toAtlasError
import com.atlas.mobile.data.remote.CoreApi
import kotlinx.coroutines.flow.StateFlow
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class AuthRepository @Inject constructor(
    private val core: CoreApi,
    private val tokens: TokenStore
) {
    val session: StateFlow<AtlasTokens> = tokens.tokens

    suspend fun login(email: String, password: String): Result<AuthPayload> = runCatching {
        val payload = core.login(LoginRequest(email.trim(), password))
        tokens.save(payload.accessToken, payload.refreshToken)
        payload
    }.recoverCatching { throw it.toAtlasError() }

    suspend fun register(username: String, email: String, password: String, displayName: String): Result<AuthPayload> = runCatching {
        val payload = core.register(RegisterRequest(username.trim(), email.trim(), password, displayName))
        tokens.save(payload.accessToken, payload.refreshToken)
        payload
    }.recoverCatching { throw it.toAtlasError() }

    suspend fun me(): Result<AtlasUser> = runCatching { core.me() }
        .recoverCatching { throw it.toAtlasError() }

    suspend fun logout(): Result<Unit> = runCatching {
        val refresh = tokens.tokens.value.refreshToken
        if (refresh.isNotBlank()) core.logout(LogoutRequest(refresh))
        tokens.clear()
    }.recoverCatching { throw it.toAtlasError() }

    suspend fun refresh(refreshToken: String): AtlasTokens? = runCatching {
        val fresh = core.refresh(RefreshRequest(refreshToken))
        tokens.save(fresh.accessToken, fresh.refreshToken)
        AtlasTokens(fresh.accessToken, fresh.refreshToken)
    }.getOrNull()
}
