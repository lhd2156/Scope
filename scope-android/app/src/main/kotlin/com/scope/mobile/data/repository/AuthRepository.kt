package com.scope.mobile.data.repository

import com.scope.mobile.data.model.ScopeUser
import com.scope.mobile.data.model.AuthPayload
import com.scope.mobile.data.model.LoginRequest
import com.scope.mobile.data.model.LogoutRequest
import com.scope.mobile.data.model.RefreshRequest
import com.scope.mobile.data.model.RegisterRequest
import com.scope.mobile.data.network.ScopeTokens
import com.scope.mobile.data.network.TokenStore
import com.scope.mobile.data.network.toScopeError
import com.scope.mobile.data.remote.CoreApi
import kotlinx.coroutines.flow.StateFlow
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class AuthRepository @Inject constructor(
    private val core: CoreApi,
    private val tokens: TokenStore
) {
    val session: StateFlow<ScopeTokens> = tokens.tokens

    suspend fun login(email: String, password: String): Result<AuthPayload> = runCatching {
        val payload = core.login(LoginRequest(email.trim(), password))
        tokens.save(payload.accessToken, payload.refreshToken)
        payload
    }.recoverCatching { throw it.toScopeError() }

    suspend fun register(username: String, email: String, password: String, displayName: String): Result<AuthPayload> = runCatching {
        val payload = core.register(RegisterRequest(username.trim(), email.trim(), password, displayName))
        tokens.save(payload.accessToken, payload.refreshToken)
        payload
    }.recoverCatching { throw it.toScopeError() }

    suspend fun me(): Result<ScopeUser> = runCatching { core.me() }
        .recoverCatching { throw it.toScopeError() }

    suspend fun logout(): Result<Unit> = runCatching {
        val refresh = tokens.tokens.value.refreshToken
        if (refresh.isNotBlank()) core.logout(LogoutRequest(refresh))
        tokens.clear()
    }.recoverCatching { throw it.toScopeError() }

    suspend fun refresh(refreshToken: String): ScopeTokens? = runCatching {
        val fresh = core.refresh(RefreshRequest(refreshToken))
        tokens.save(fresh.accessToken, fresh.refreshToken)
        ScopeTokens(fresh.accessToken, fresh.refreshToken)
    }.getOrNull()
}
