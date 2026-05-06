package com.scope.mobile.ui.spotdetail

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.scope.mobile.data.model.Spot
import com.scope.mobile.data.model.SpotPhoto
import com.scope.mobile.data.repository.SpotsRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class SpotDetailViewModel @Inject constructor(
    private val repo: SpotsRepository
) : ViewModel() {

    data class UiState(
        val spot: Spot? = null,
        val photos: List<SpotPhoto> = emptyList(),
        val isLoading: Boolean = false,
        val liked: Boolean = false,
        val error: String? = null
    )

    private val _state = MutableStateFlow(UiState())
    val state: StateFlow<UiState> = _state.asStateFlow()

    fun load(id: String) = viewModelScope.launch {
        _state.value = _state.value.copy(isLoading = true, error = null)
        val spot = repo.detail(id).getOrNull()
        val photos = repo.photos(id).getOrDefault(emptyList())
        _state.value = _state.value.copy(
            spot = spot,
            photos = photos,
            isLoading = false
        )
    }

    fun toggleLike() = viewModelScope.launch {
        val current = _state.value
        val id = current.spot?.id ?: return@launch
        val nextLiked = !current.liked
        _state.value = current.copy(liked = nextLiked)
        repo.like(id, nextLiked).onFailure {
            _state.value = current // revert on failure
        }
    }
}
