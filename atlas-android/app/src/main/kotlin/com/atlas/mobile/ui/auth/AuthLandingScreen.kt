package com.atlas.mobile.ui.auth

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import com.atlas.mobile.ui.components.AtlasGhostButton
import com.atlas.mobile.ui.components.AtlasLinkButton
import com.atlas.mobile.ui.components.AtlasPrimaryButton
import com.atlas.mobile.ui.components.AtlasSpacing
import com.atlas.mobile.ui.components.AtlasTextField
import com.atlas.mobile.ui.components.GlassPanel
import com.atlas.mobile.ui.session.SessionViewModel
import com.atlas.mobile.ui.theme.AtlasTokens

private enum class Tab { Landing, Login, Register }

@Composable
fun AuthLandingScreen(
    onSignIn: (email: String, password: String) -> Unit,
    onRegister: (username: String, email: String, password: String, displayName: String) -> Unit,
    state: SessionViewModel.UiState
) {
    var tab by rememberSaveable { mutableStateOf(Tab.Landing) }

    Box(
        Modifier
            .fillMaxSize()
            .background(Brush.verticalGradient(listOf(AtlasTokens.BgPrimary, AtlasTokens.BgSecondary)))
    ) {
        when (tab) {
            Tab.Landing -> Landing(
                onSignIn = { tab = Tab.Login },
                onRegister = { tab = Tab.Register }
            )
            Tab.Login -> LoginForm(
                state = state,
                onSubmit = onSignIn,
                onBack = { tab = Tab.Landing },
                onGoToRegister = { tab = Tab.Register }
            )
            Tab.Register -> RegisterForm(
                state = state,
                onSubmit = onRegister,
                onBack = { tab = Tab.Landing },
                onGoToLogin = { tab = Tab.Login }
            )
        }
    }
}

@Composable
private fun Landing(onSignIn: () -> Unit, onRegister: () -> Unit) {
    Column(
        Modifier
            .fillMaxSize()
            .padding(AtlasSpacing.Xl),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Spacer(Modifier.height(40.dp))
        Text(
            "ATLAS",
            style = MaterialTheme.typography.displayLarge,
            color = AtlasTokens.TextPrimary
        )
        Spacer(Modifier.height(AtlasSpacing.Md))
        Text(
            "Your adventures, mapped.",
            style = MaterialTheme.typography.headlineSmall,
            color = AtlasTokens.TextSecondary
        )
        Spacer(Modifier.height(AtlasSpacing.Xl3))
        GlassPanel {
            AtlasPrimaryButton("Sign In", onClick = onSignIn)
            AtlasGhostButton("Create account", onClick = onRegister)
        }
    }
}

@Composable
private fun LoginForm(
    state: SessionViewModel.UiState,
    onSubmit: (String, String) -> Unit,
    onBack: () -> Unit,
    onGoToRegister: () -> Unit
) {
    var email by rememberSaveable { mutableStateOf("") }
    var password by rememberSaveable { mutableStateOf("") }

    Column(
        Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(AtlasSpacing.Xl),
        verticalArrangement = Arrangement.spacedBy(AtlasSpacing.Lg)
    ) {
        AtlasLinkButton(label = "‹ Back", onClick = onBack)
        Text("Welcome back", style = MaterialTheme.typography.headlineLarge, color = AtlasTokens.TextPrimary)
        Text(
            "Sign in to sync your spots, trips, and friends.",
            style = MaterialTheme.typography.bodyLarge,
            color = AtlasTokens.TextSecondary
        )
        AtlasTextField("Email", email, { email = it }, keyboardType = KeyboardType.Email, placeholder = "you@example.com")
        AtlasTextField("Password", password, { password = it }, isPassword = true, placeholder = "••••••••")

        state.error?.let {
            Text(it, color = AtlasTokens.Danger, style = MaterialTheme.typography.bodyMedium)
        }

        AtlasPrimaryButton("Sign In", onClick = { onSubmit(email, password) }, isLoading = state.isBusy)

        Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            AtlasLinkButton("Need an account? Create one", onClick = onGoToRegister)
        }
    }
}

@Composable
private fun RegisterForm(
    state: SessionViewModel.UiState,
    onSubmit: (String, String, String, String) -> Unit,
    onBack: () -> Unit,
    onGoToLogin: () -> Unit
) {
    var displayName by rememberSaveable { mutableStateOf("") }
    var username by rememberSaveable { mutableStateOf("") }
    var email by rememberSaveable { mutableStateOf("") }
    var password by rememberSaveable { mutableStateOf("") }

    Column(
        Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(AtlasSpacing.Xl),
        verticalArrangement = Arrangement.spacedBy(AtlasSpacing.Lg)
    ) {
        AtlasLinkButton(label = "‹ Back", onClick = onBack)
        Text("Join Atlas", style = MaterialTheme.typography.headlineLarge, color = AtlasTokens.TextPrimary)
        Text(
            "Start dropping pins on your real-world adventures.",
            style = MaterialTheme.typography.bodyLarge,
            color = AtlasTokens.TextSecondary
        )
        AtlasTextField("Display name", displayName, { displayName = it }, placeholder = "Louis Do")
        AtlasTextField("Username", username, { username = it }, placeholder = "louisdo")
        AtlasTextField("Email", email, { email = it }, keyboardType = KeyboardType.Email, placeholder = "you@example.com")
        AtlasTextField("Password", password, { password = it }, isPassword = true, placeholder = "••••••••")

        state.error?.let {
            Text(it, color = AtlasTokens.Danger, style = MaterialTheme.typography.bodyMedium)
        }

        AtlasPrimaryButton(
            label = "Create account",
            onClick = { onSubmit(username, email, password, displayName) },
            isLoading = state.isBusy
        )

        Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            AtlasLinkButton("Already on Atlas? Sign in", onClick = onGoToLogin)
        }
    }
}
