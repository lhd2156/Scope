package com.scope.mobile.ui.spots

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.scope.mobile.data.model.Spot
import com.scope.mobile.data.model.SpotCategory
import com.scope.mobile.data.repository.SpotsRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class SpotsViewModel @Inject constructor(
    private val repo: SpotsRepository
) : ViewModel() {

    data class UiState(
        val spots: List<Spot> = emptyList(),
        val trending: List<Spot> = emptyList(),
        val isLoading: Boolean = false,
        val category: SpotCategory? = null,
        val search: String = "",
        val error: String? = null
    )

    private val _state = MutableStateFlow(UiState())
    val state: StateFlow<UiState> = _state.asStateFlow()

    init {
        refresh()
    }

    fun refresh() = viewModelScope.launch {
        _state.value = _state.value.copy(isLoading = true, error = null)
        val listResult = repo.list(category = _state.value.category, search = _state.value.search)
        val trendingResult = repo.trending()
        _state.value = _state.value.copy(
            spots = listResult.getOrDefault(emptyList()),
            trending = trendingResult.getOrDefault(emptyList()),
            isLoading = false,
            error = listResult.exceptionOrNull()?.localizedMessage
        )
    }

    fun selectCategory(category: SpotCategory?) {
        _state.value = _state.value.copy(category = category)
        refresh()
    }

    fun updateSearch(query: String) {
        _state.value = _state.value.copy(search = query)
    }

    fun submitSearch() {
        refresh()
    }
}
