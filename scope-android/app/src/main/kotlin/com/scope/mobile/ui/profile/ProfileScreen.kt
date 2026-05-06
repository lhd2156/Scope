package com.scope.mobile.ui.profile

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
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import com.scope.mobile.data.model.ScopeUser
import com.scope.mobile.ui.components.ScopeGhostButton
import com.scope.mobile.ui.components.ScopeSpacing
import com.scope.mobile.ui.components.GlassPanel
import com.scope.mobile.ui.components.SectionHeader
import com.scope.mobile.ui.theme.ScopeTokens

@Composable
fun ProfileScreen(
    user: ScopeUser?,
    onSignOut: () -> Unit
) {
    Column(
        Modifier
            .fillMaxSize()
            .background(ScopeTokens.BgPrimary)
            .verticalScroll(rememberScrollState())
            .padding(ScopeSpacing.Xl),
        verticalArrangement = Arrangement.spacedBy(ScopeSpacing.Xl)
    ) {
        GlassPanel {
            Column(
                Modifier.fillMaxWidth(),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(ScopeSpacing.Md)
            ) {
                Box(
                    Modifier
                        .size(96.dp)
                        .background(
                            Brush.linearGradient(listOf(ScopeTokens.AccentTeal, ScopeTokens.AccentGold)),
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
                    color = ScopeTokens.TextPrimary
                )
                user?.username?.let {
                    Text(
                        "@$it",
                        style = MaterialTheme.typography.bodyMedium,
                        color = ScopeTokens.TextMuted
                    )
                }
                user?.bio?.let {
                    Text(
                        it,
                        style = MaterialTheme.typography.bodyLarge,
                        color = ScopeTokens.TextSecondary
                    )
                }
            }
        }

        Row(
            Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(ScopeSpacing.Md)
        ) {
            StatTile(value = "0", label = "Spots", modifier = Modifier.weight(1f))
            StatTile(value = "0", label = "Trips", modifier = Modifier.weight(1f))
            StatTile(value = "0", label = "Friends", modifier = Modifier.weight(1f))
        }

        Column(verticalArrangement = Arrangement.spacedBy(ScopeSpacing.Md)) {
            SectionHeader(title = "Settings", eyebrow = "Account")
            ScopeGhostButton(label = "Sign out", onClick = onSignOut)
        }
    }
}

@Composable
private fun StatTile(value: String, label: String, modifier: Modifier = Modifier) {
    Column(
        modifier
            .background(ScopeTokens.BgSecondary, RoundedCornerShape(16.dp))
            .padding(ScopeSpacing.Base),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(ScopeSpacing.Xs)
    ) {
        Text(value, style = MaterialTheme.typography.headlineLarge, color = ScopeTokens.AccentTeal)
        Text(label, style = MaterialTheme.typography.labelSmall, color = ScopeTokens.TextMuted)
    }
}
