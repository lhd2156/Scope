package com.atlas.mobile.ui.home

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
import com.atlas.mobile.data.model.Spot
import com.atlas.mobile.ui.components.AtlasSpacing
import com.atlas.mobile.ui.components.CategoryBadge
import com.atlas.mobile.ui.components.EmptyHint
import com.atlas.mobile.ui.components.GlassPanel
import com.atlas.mobile.ui.components.SectionHeader
import com.atlas.mobile.ui.session.SessionViewModel
import com.atlas.mobile.ui.spots.SpotsViewModel
import com.atlas.mobile.ui.theme.AtlasTokens

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
            .background(AtlasTokens.BgPrimary)
            .verticalScroll(rememberScrollState())
            .padding(AtlasSpacing.Xl),
        verticalArrangement = Arrangement.spacedBy(AtlasSpacing.Xl)
    ) {
        Hero(name = session.user?.displayName?.split(" ")?.firstOrNull() ?: "Explorer")

        Column(verticalArrangement = Arrangement.spacedBy(AtlasSpacing.Md)) {
            SectionHeader(title = "Trending this week", eyebrow = "Community")
            if (spots.trending.isEmpty()) {
                EmptyHint("No trending spots yet. Be the first to drop a pin.")
            } else {
                LazyRow(horizontalArrangement = Arrangement.spacedBy(AtlasSpacing.Base)) {
                    items(spots.trending, key = { it.id }) { spot ->
                        SpotCard(spot = spot, compact = true, onClick = { onOpenSpot(spot.id) })
                    }
                }
            }
        }

        Column(verticalArrangement = Arrangement.spacedBy(AtlasSpacing.Md)) {
            SectionHeader(title = "Fresh finds", eyebrow = "Explore")
            when {
                spots.isLoading && spots.spots.isEmpty() ->
                    EmptyHint("Loading the latest adventures…")
                spots.error != null ->
                    Text(spots.error!!, color = AtlasTokens.Danger)
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
        Text("ADVENTURE PLATFORM", style = MaterialTheme.typography.labelSmall, color = AtlasTokens.AccentTeal)
        Text(
            "Hey $name,\nwhere to next?",
            style = MaterialTheme.typography.displayLarge,
            color = AtlasTokens.TextPrimary
        )
        Text(
            "Discover, plan, and share unforgettable journeys.",
            style = MaterialTheme.typography.bodyLarge,
            color = AtlasTokens.TextSecondary
        )
    }
}

@Composable
fun SpotCard(spot: Spot, onClick: () -> Unit, compact: Boolean = false) {
    val cardModifier = Modifier
        .let { base -> if (compact) base.width(260.dp) else base.fillMaxWidth() }
        .clickable(onClick = onClick)
        .background(AtlasTokens.BgSecondary, RoundedCornerShape(16.dp))
        .padding(AtlasSpacing.Base)

    Column(cardModifier, verticalArrangement = Arrangement.spacedBy(AtlasSpacing.Sm)) {
        Box(
            Modifier
                .fillMaxWidth()
                .height(if (compact) 120.dp else 160.dp)
                .background(
                    Brush.linearGradient(
                        listOf(AtlasTokens.badge(spot.category).background, AtlasTokens.BgTertiary)
                    ),
                    RoundedCornerShape(12.dp)
                )
        )
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
            Text(
                spot.title,
                style = MaterialTheme.typography.headlineSmall,
                color = AtlasTokens.TextPrimary,
                maxLines = 1
            )
            CategoryBadge(spot.category)
        }
        if (!compact) {
            spot.description?.let {
                Text(
                    it,
                    style = MaterialTheme.typography.bodyMedium,
                    color = AtlasTokens.TextSecondary,
                    maxLines = 2
                )
            }
        }
        Row(horizontalArrangement = Arrangement.spacedBy(AtlasSpacing.Md)) {
            Text(
                spot.city ?: "Unknown",
                style = MaterialTheme.typography.labelSmall,
                color = AtlasTokens.TextMuted
            )
            spot.likeCount?.let {
                Text("$it likes", style = MaterialTheme.typography.labelSmall, color = AtlasTokens.TextMuted)
            }
        }
    }
}
