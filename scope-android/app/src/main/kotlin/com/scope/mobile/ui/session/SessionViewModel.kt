package com.scope.mobile.ui.session

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.scope.mobile.data.model.ScopeUser
import com.scope.mobile.data.network.ScopeError
import com.scope.mobile.data.repository.AuthRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

/**
 * Top-level session state holder. Owns the authenticated user and broadcasts
 * auth transitions to all screens via a single [StateFlow].
 */
@HiltViewModel
class SessionViewModel @Inject constructor(
    private val auth: AuthRepository
) : ViewModel() {

    data class UiState(
        val user: ScopeUser? = null,
        val isBootstrapping: Boolean = true,
        val isBusy: Boolean = false,
        val error: String? = null
    ) {
        val isAuthenticated: Boolean get() = user != null
    }

    private val _state = MutableStateFlow(UiState())
    val state: StateFlow<UiState> = _state.asStateFlow()

    init { bootstrap() }

    private fun bootstrap() {
        viewModelScope.launch {
            val tokens = auth.session.value
            if (!tokens.hasSession) {
                _state.value = UiState(isBootstrapping = false)
                return@launch
            }

            auth.me().fold(
                onSuccess = { user -> _state.value = UiState(user = user, isBootstrapping = false) },
                onFailure = { error ->
                    if (error is ScopeError.Unauthorized) auth.logout()
                    _state.value = UiState(isBootstrapping = false, error = error.localizedMessage)
                }
            )
        }
    }

    fun signIn(email: String, password: String) = viewModelScope.launch {
        _state.update { it.copy(isBusy = true, error = null) }
        auth.login(email, password).fold(
            onSuccess = { payload ->
                _state.value = UiState(
                    user = ScopeUser(
                        id = payload.id,
                        username = payload.username,
                        displayName = payload.displayName ?: payload.username,
                        email = payload.email
                    ),
                    isBootstrapping = false
                )
            },
            onFailure = { error -> _state.update { it.copy(isBusy = false, error = error.localizedMessage) } }
        )
    }

    fun register(username: String, email: String, password: String, displayName: String) = viewModelScope.launch {
        _state.update { it.copy(isBusy = true, error = null) }
        auth.register(username, email, password, displayName.ifBlank { username }).fold(
            onSuccess = { payload ->
                _state.value = UiState(
                    user = ScopeUser(
                        id = payload.id,
                        username = payload.username,
                        displayName = payload.displayName ?: payload.username,
                        email = payload.email
                    ),
                    isBootstrapping = false
                )
            },
            onFailure = { error -> _state.update { it.copy(isBusy = false, error = error.localizedMessage) } }
        )
    }

    fun signOut() = viewModelScope.launch {
        auth.logout()
        _state.value = UiState(isBootstrapping = false)
    }

    private inline fun <T> MutableStateFlow<T>.update(transform: (T) -> T) {
        value = transform(value)
    }
}
