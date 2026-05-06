package com.scope.mobile.data.network

import android.content.Context
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import javax.inject.Inject
import javax.inject.Singleton

data class ScopeTokens(
    val accessToken: String,
    val refreshToken: String
) {
    companion object {
        val Empty = ScopeTokens("", "")
    }
    val hasSession: Boolean get() = accessToken.isNotBlank() && refreshToken.isNotBlank()
}

interface TokenStore {
    val tokens: StateFlow<ScopeTokens>
    suspend fun save(access: String, refresh: String)
    suspend fun clear()
}

@Singleton
class EncryptedTokenStore @Inject constructor(@ApplicationContext context: Context) : TokenStore {
    private val prefs = EncryptedSharedPreferences.create(
        context,
        "scope.secure.tokens",
        MasterKey.Builder(context).setKeyScheme(MasterKey.KeyScheme.AES256_GCM).build(),
        EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
        EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
    )

    private val _tokens = MutableStateFlow(
        ScopeTokens(
            accessToken = prefs.getString("access", null).orEmpty(),
            refreshToken = prefs.getString("refresh", null).orEmpty()
        )
    )

    override val tokens: StateFlow<ScopeTokens> = _tokens.asStateFlow()

    override suspend fun save(access: String, refresh: String) {
        prefs.edit()
            .putString("access", access)
            .putString("refresh", refresh)
            .apply()
        _tokens.value = ScopeTokens(access, refresh)
    }

    override suspend fun clear() {
        prefs.edit().clear().apply()
        _tokens.value = ScopeTokens.Empty
    }
}

/**
 * In-memory store used by unit tests and previews.
 */
class InMemoryTokenStore(initial: ScopeTokens = ScopeTokens.Empty) : TokenStore {
    private val _tokens = MutableStateFlow(initial)
    override val tokens: StateFlow<ScopeTokens> = _tokens.asStateFlow()
    override suspend fun save(access: String, refresh: String) {
        _tokens.value = ScopeTokens(access, refresh)
    }
    override suspend fun clear() {
        _tokens.value = ScopeTokens.Empty
    }
}
