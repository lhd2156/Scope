package com.scope.mobile.ui.spotdetail

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import coil.compose.AsyncImage
import com.scope.mobile.ui.components.ScopeGhostButton
import com.scope.mobile.ui.components.ScopePrimaryButton
import com.scope.mobile.ui.components.ScopeSpacing
import com.scope.mobile.ui.components.CategoryBadge
import com.scope.mobile.ui.theme.ScopeTokens

@Composable
fun SpotDetailScreen(
    spotId: String,
    onBack: () -> Unit,
    viewModel: SpotDetailViewModel = hiltViewModel()
) {
    val state by viewModel.state.collectAsStateWithLifecycle()

    LaunchedEffect(spotId) { viewModel.load(spotId) }

    Box(Modifier.fillMaxSize().background(ScopeTokens.BgPrimary)) {
        val spot = state.spot

        if (state.isLoading && spot == null) {
            Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                CircularProgressIndicator(color = ScopeTokens.AccentTeal)
            }
        } else if (spot != null) {
            Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState())) {
                Box(
                    Modifier
                        .fillMaxWidth()
                        .height(260.dp)
                        .background(
                            Brush.verticalGradient(
                                listOf(ScopeTokens.badge(spot.category).background, ScopeTokens.BgTertiary)
                            )
                        )
                ) {
                    spot.coverPhotoUrl?.let { url ->
                        AsyncImage(
                            model = url,
                            contentDescription = null,
                            modifier = Modifier.fillMaxSize()
                        )
                    }
                    IconButton(
                        onClick = onBack,
                        modifier = Modifier.padding(ScopeSpacing.Base)
                    ) {
                        Icon(Icons.Filled.ArrowBack, contentDescription = "Back", tint = ScopeTokens.TextPrimary)
                    }
                }

                Column(
                    Modifier.padding(ScopeSpacing.Xl),
                    verticalArrangement = Arrangement.spacedBy(ScopeSpacing.Md)
                ) {
                    Row(
                        Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            spot.title,
                            style = MaterialTheme.typography.headlineLarge,
                            color = ScopeTokens.TextPrimary
                        )
                        CategoryBadge(spot.category)
                    }
                    spot.city?.let {
                        Text(
                            "$it${spot.country?.let { c -> ", $c" } ?: ""}",
                            style = MaterialTheme.typography.bodyMedium,
                            color = ScopeTokens.TextMuted
                        )
                    }
                    spot.description?.let {
                        Text(
                            it,
                            style = MaterialTheme.typography.bodyLarge,
                            color = ScopeTokens.TextSecondary
                        )
                    }
                    spot.vibe?.let {
                        Text(
                            "“$it”",
                            style = MaterialTheme.typography.bodyMedium.copy(fontStyle = FontStyle.Italic),
                            color = ScopeTokens.AccentGold,
                            modifier = Modifier
                                .background(ScopeTokens.badge(com.scope.mobile.data.model.SpotCategory.ADVENTURE).background, RoundedCornerShape(999.dp))
                                .padding(horizontal = ScopeSpacing.Base, vertical = ScopeSpacing.Xs)
                        )
                    }

                    Row(horizontalArrangement = Arrangement.spacedBy(ScopeSpacing.Md)) {
                        ScopePrimaryButton(
                            label = if (state.liked) "Liked" else "Like",
                            onClick = viewModel::toggleLike,
                            modifier = Modifier.weight(1f)
                        )
                        ScopeGhostButton(
                            label = "Add to trip",
                            onClick = {},
                            modifier = Modifier.weight(1f)
                        )
                    }

                    if (state.photos.isNotEmpty()) {
                        Text(
                            "Photos",
                            style = MaterialTheme.typography.headlineSmall,
                            color = ScopeTokens.TextPrimary
                        )
                        LazyRow(horizontalArrangement = Arrangement.spacedBy(ScopeSpacing.Sm)) {
                            items(state.photos, key = { it.id }) { photo ->
                                AsyncImage(
                                    model = photo.storageUrl,
                                    contentDescription = photo.caption,
                                    modifier = Modifier
                                        .size(140.dp)
                                        .background(ScopeTokens.BgTertiary, RoundedCornerShape(12.dp))
                                )
                            }
                        }
                    }
                }
            }
        } else {
            Text("Spot unavailable", color = ScopeTokens.TextMuted, modifier = Modifier.align(Alignment.Center))
        }
    }
}

