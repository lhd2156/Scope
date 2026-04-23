package com.atlas.mobile.ui.profile

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.atlas.mobile.ui.components.AtlasGhostButton
import com.atlas.mobile.ui.components.AtlasSpacing
import com.atlas.mobile.ui.components.GlassPanel
import com.atlas.mobile.ui.components.SectionHeader
import com.atlas.mobile.ui.session.SessionViewModel
import com.atlas.mobile.ui.theme.AtlasTokens

@Composable
fun ProfileScreen(
    onSignOut: () -> Unit,
    sessionViewModel: SessionViewModel = hiltViewModel()
) {
    val state by sessionViewModel.state.collectAsStateWithLifecycle()
    val user = state.user

    Column(
        Modifier
            .fillMaxSize()
            .background(AtlasTokens.BgPrimary)
            .verticalScroll(rememberScrollState())
            .padding(AtlasSpacing.Xl),
        verticalArrangement = Arrangement.spacedBy(AtlasSpacing.Xl)
    ) {
        GlassPanel {
            Column(
                Modifier.fillMaxWidth(),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(AtlasSpacing.Md)
            ) {
                Box(
                    Modifier
                        .size(96.dp)
                        .background(
                            Brush.linearGradient(listOf(AtlasTokens.AccentTeal, AtlasTokens.AccentGold)),
                            CircleShape
                        ),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = user?.displayName
                            ?.split(" ")
                            ?.mapNotNull { it.firstOrNull()?.toString() }
                            ?.take(2)
                            ?.joinToString("")
                            ?.uppercase()
                            ?: "A",
                        style = MaterialTheme.typography.headlineLarge,
                        color = Color(0xFF0B1020)
                    )
                }
                Text(
                    user?.displayName ?: "Explorer",
                    style = MaterialTheme.typography.headlineMedium,
                    color = AtlasTokens.TextPrimary
                )
                user?.username?.let {
                    Text(
                        "@$it",
                        style = MaterialTheme.typography.bodyMedium,
                        color = AtlasTokens.TextMuted
                    )
                }
                user?.bio?.let {
                    Text(
                        it,
                        style = MaterialTheme.typography.bodyLarge,
                        color = AtlasTokens.TextSecondary
                    )
                }
            }
        }

        Row(
            Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(AtlasSpacing.Md)
        ) {
            StatTile(value = "0", label = "Spots", modifier = Modifier.weight(1f))
            StatTile(value = "0", label = "Trips", modifier = Modifier.weight(1f))
            StatTile(value = "0", label = "Friends", modifier = Modifier.weight(1f))
        }

        Column(verticalArrangement = Arrangement.spacedBy(AtlasSpacing.Md)) {
            SectionHeader(title = "Settings", eyebrow = "Account")
            AtlasGhostButton(label = "Sign out", onClick = onSignOut)
        }
    }
}

@Composable
private fun StatTile(value: String, label: String, modifier: Modifier = Modifier) {
    Column(
        modifier
            .background(AtlasTokens.BgSecondary, RoundedCornerShape(16.dp))
            .padding(AtlasSpacing.Base),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(AtlasSpacing.Xs)
    ) {
        Text(value, style = MaterialTheme.typography.headlineLarge, color = AtlasTokens.AccentTeal)
        Text(label, style = MaterialTheme.typography.labelSmall, color = AtlasTokens.TextMuted)
    }
}
