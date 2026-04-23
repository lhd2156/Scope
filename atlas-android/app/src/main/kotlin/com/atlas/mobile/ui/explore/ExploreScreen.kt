package com.atlas.mobile.ui.explore

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextField
import androidx.compose.material3.TextFieldDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.atlas.mobile.data.model.SpotCategory
import com.atlas.mobile.ui.components.AtlasSpacing
import com.atlas.mobile.ui.components.EmptyHint
import com.atlas.mobile.ui.home.SpotCard
import com.atlas.mobile.ui.spots.SpotsViewModel
import com.atlas.mobile.ui.theme.AtlasTokens

@Composable
fun ExploreScreen(
    onOpenSpot: (String) -> Unit,
    viewModel: SpotsViewModel = hiltViewModel()
) {
    val state by viewModel.state.collectAsStateWithLifecycle()

    Column(
        Modifier
            .fillMaxSize()
            .background(AtlasTokens.BgPrimary)
            .padding(AtlasSpacing.Xl),
        verticalArrangement = Arrangement.spacedBy(AtlasSpacing.Lg)
    ) {
        TextField(
            value = state.search,
            onValueChange = viewModel::updateSearch,
            placeholder = { Text("Search spots, cities, vibes", color = AtlasTokens.TextMuted) },
            leadingIcon = { Icon(Icons.Filled.Search, contentDescription = null, tint = AtlasTokens.TextMuted) },
            singleLine = true,
            shape = RoundedCornerShape(12.dp),
            colors = TextFieldDefaults.colors(
                focusedContainerColor = AtlasTokens.BgSecondary,
                unfocusedContainerColor = AtlasTokens.BgSecondary,
                focusedIndicatorColor = Color.Transparent,
                unfocusedIndicatorColor = Color.Transparent,
                focusedTextColor = AtlasTokens.TextPrimary,
                unfocusedTextColor = AtlasTokens.TextPrimary
            ),
            keyboardOptions = KeyboardOptions(imeAction = ImeAction.Search),
            keyboardActions = KeyboardActions(onSearch = { viewModel.submitSearch() }),
            modifier = Modifier.fillMaxWidth()
        )

        LazyRow(horizontalArrangement = Arrangement.spacedBy(AtlasSpacing.Sm)) {
            item {
                CategoryPill(label = "All", active = state.category == null) {
                    viewModel.selectCategory(null)
                }
            }
            items(SpotCategory.entries, key = { it.name }) { category ->
                CategoryPill(
                    label = category.label,
                    active = state.category == category,
                    onClick = { viewModel.selectCategory(category) }
                )
            }
        }

        when {
            state.isLoading && state.spots.isEmpty() ->
                EmptyHint("Searching the Atlas…")
            state.error != null -> Text(state.error!!, color = AtlasTokens.Danger)
            state.spots.isEmpty() ->
                EmptyHint("No spots match your filters. Try another category.")
            else -> LazyColumn(
                verticalArrangement = Arrangement.spacedBy(AtlasSpacing.Base),
                modifier = Modifier.fillMaxWidth()
            ) {
                items(state.spots, key = { it.id }) { spot ->
                    SpotCard(spot = spot, onClick = { onOpenSpot(spot.id) })
                }
            }
        }
    }
}

@Composable
private fun CategoryPill(label: String, active: Boolean, onClick: () -> Unit) {
    val bg = if (active) AtlasTokens.AccentTeal else AtlasTokens.BgSecondary
    val fg = if (active) Color(0xFF0B1020) else AtlasTokens.TextPrimary

    Row(
        Modifier
            .clickable(onClick = onClick)
            .background(bg, RoundedCornerShape(999.dp))
            .border(1.dp, if (active) Color.Transparent else AtlasTokens.Border, RoundedCornerShape(999.dp))
            .padding(horizontal = AtlasSpacing.Base, vertical = AtlasSpacing.Sm)
    ) {
        Text(label, style = MaterialTheme.typography.bodyMedium, color = fg)
    }
}
