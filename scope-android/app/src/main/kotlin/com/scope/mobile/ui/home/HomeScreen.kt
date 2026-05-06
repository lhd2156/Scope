package com.scope.mobile.ui.home

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.scope.mobile.data.model.Spot
import com.scope.mobile.ui.components.ScopeSpacing
import com.scope.mobile.ui.components.CategoryBadge
import com.scope.mobile.ui.components.EmptyHint
import com.scope.mobile.ui.components.GlassPanel
import com.scope.mobile.ui.components.SectionHeader
import com.scope.mobile.ui.session.SessionViewModel
import com.scope.mobile.ui.spots.SpotsViewModel
import com.scope.mobile.ui.theme.ScopeTokens

@Composable
fun HomeScreen(
    onOpenSpot: (String) -> Unit,
    spotsViewModel: SpotsViewModel = hiltViewModel(),
    sessionViewModel: SessionViewModel = hiltViewModel()
) {
    val spots by spotsViewModel.state.collectAsStateWithLifecycle()
    val session by sessionViewModel.state.collectAsStateWithLifecycle()

    Column(
        Modifier
            .fillMaxSize()
            .background(ScopeTokens.BgPrimary)
            .verticalScroll(rememberScrollState())
            .padding(ScopeSpacing.Xl),
        verticalArrangement = Arrangement.spacedBy(ScopeSpacing.Xl)
    ) {
        Hero(name = session.user?.displayName?.split(" ")?.firstOrNull() ?: "Explorer")

        Column(verticalArrangement = Arrangement.spacedBy(ScopeSpacing.Md)) {
            SectionHeader(title = "Trending this week", eyebrow = "Community")
            if (spots.trending.isEmpty()) {
                EmptyHint("No trending spots yet. Be the first to drop a pin.")
            } else {
                LazyRow(horizontalArrangement = Arrangement.spacedBy(ScopeSpacing.Base)) {
                    items(spots.trending, key = { it.id }) { spot ->
                        SpotCard(spot = spot, compact = true, onClick = { onOpenSpot(spot.id) })
                    }
                }
            }
        }

        Column(verticalArrangement = Arrangement.spacedBy(ScopeSpacing.Md)) {
            SectionHeader(title = "Fresh finds", eyebrow = "Explore")
            when {
                spots.isLoading && spots.spots.isEmpty() ->
                    EmptyHint("Loading the latest adventures…")
                spots.error != null ->
                    Text(spots.error!!, color = ScopeTokens.Danger)
                spots.spots.isEmpty() ->
                    EmptyHint("No spots yet. Drop your first pin on the map.")
                else -> spots.spots.take(10).forEach { spot ->
                    SpotCard(spot = spot, onClick = { onOpenSpot(spot.id) })
                }
            }
        }
    }
}

@Composable
private fun Hero(name: String) {
    GlassPanel {
        Text("ADVENTURE PLATFORM", style = MaterialTheme.typography.labelSmall, color = ScopeTokens.AccentTeal)
        Text(
            "Hey $name,\nwhere to next?",
            style = MaterialTheme.typography.displayLarge,
            color = ScopeTokens.TextPrimary
        )
        Text(
            "Discover, plan, and share unforgettable journeys.",
            style = MaterialTheme.typography.bodyLarge,
            color = ScopeTokens.TextSecondary
        )
    }
}

@Composable
fun SpotCard(spot: Spot, onClick: () -> Unit, compact: Boolean = false) {
    val cardModifier = Modifier
        .let { base -> if (compact) base.width(260.dp) else base.fillMaxWidth() }
        .clickable(onClick = onClick)
        .background(ScopeTokens.BgSecondary, RoundedCornerShape(16.dp))
        .padding(ScopeSpacing.Base)

    Column(cardModifier, verticalArrangement = Arrangement.spacedBy(ScopeSpacing.Sm)) {
        Box(
            Modifier
                .fillMaxWidth()
                .height(if (compact) 120.dp else 160.dp)
                .background(
                    Brush.linearGradient(
                        listOf(ScopeTokens.badge(spot.category).background, ScopeTokens.BgTertiary)
                    ),
                    RoundedCornerShape(12.dp)
                )
        )
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
            Text(
                spot.title,
                style = MaterialTheme.typography.headlineSmall,
                color = ScopeTokens.TextPrimary,
                maxLines = 1
            )
            CategoryBadge(spot.category)
        }
        if (!compact) {
            spot.description?.let {
                Text(
                    it,
                    style = MaterialTheme.typography.bodyMedium,
                    color = ScopeTokens.TextSecondary,
                    maxLines = 2
                )
            }
        }
        Row(horizontalArrangement = Arrangement.spacedBy(ScopeSpacing.Md)) {
            Text(
                spot.city ?: "Unknown",
                style = MaterialTheme.typography.labelSmall,
                color = ScopeTokens.TextMuted
            )
            spot.likeCount?.let {
                Text("$it likes", style = MaterialTheme.typography.labelSmall, color = ScopeTokens.TextMuted)
            }
        }
    }
}
