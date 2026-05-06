package com.scope.mobile.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.LocalContentColor
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import com.scope.mobile.data.model.SpotCategory
import com.scope.mobile.ui.theme.ScopeTokens

object ScopeSpacing {
    val Xs = 4.dp
    val Sm = 8.dp
    val Md = 12.dp
    val Base = 16.dp
    val Lg = 20.dp
    val Xl = 24.dp
    val Xl2 = 32.dp
    val Xl3 = 40.dp
}

@Composable
fun ScopePrimaryButton(
    label: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    isLoading: Boolean = false,
    enabled: Boolean = true
) {
    Button(
        onClick = onClick,
        modifier = modifier.fillMaxWidth().height(48.dp),
        enabled = enabled && !isLoading,
        shape = RoundedCornerShape(12.dp),
        colors = ButtonDefaults.buttonColors(
            containerColor = ScopeTokens.AccentTeal,
            contentColor = Color(0xFF0B1020)
        ),
        contentPadding = PaddingValues(horizontal = ScopeSpacing.Lg, vertical = ScopeSpacing.Md)
    ) {
        if (isLoading) {
            CircularProgressIndicator(
                modifier = Modifier.size(18.dp),
                color = LocalContentColor.current,
                strokeWidth = 2.dp
            )
        } else {
            Text(label, style = MaterialTheme.typography.bodyLarge.copy(fontWeight = androidx.compose.ui.text.font.FontWeight.SemiBold))
        }
    }
}

@Composable
fun ScopeGhostButton(label: String, onClick: () -> Unit, modifier: Modifier = Modifier) {
    OutlinedButton(
        onClick = onClick,
        modifier = modifier.fillMaxWidth().height(48.dp),
        shape = RoundedCornerShape(12.dp),
        colors = ButtonDefaults.outlinedButtonColors(contentColor = ScopeTokens.AccentTeal),
        border = androidx.compose.foundation.BorderStroke(1.dp, ScopeTokens.AccentTeal)
    ) {
        Text(label, style = MaterialTheme.typography.bodyLarge.copy(fontWeight = androidx.compose.ui.text.font.FontWeight.SemiBold))
    }
}

@Composable
fun ScopeLinkButton(label: String, onClick: () -> Unit) {
    TextButton(onClick = onClick) {
        Text(label, color = ScopeTokens.AccentTeal)
    }
}

@Composable
fun ScopeTextField(
    label: String,
    value: String,
    onValueChange: (String) -> Unit,
    modifier: Modifier = Modifier,
    isPassword: Boolean = false,
    keyboardType: KeyboardType = KeyboardType.Text,
    placeholder: String = ""
) {
    OutlinedTextField(
        value = value,
        onValueChange = onValueChange,
        label = { Text(label.uppercase(), style = MaterialTheme.typography.labelSmall, color = ScopeTokens.TextMuted) },
        placeholder = { Text(placeholder, color = ScopeTokens.TextMuted) },
        singleLine = true,
        shape = RoundedCornerShape(10.dp),
        modifier = modifier.fillMaxWidth(),
        visualTransformation = if (isPassword) PasswordVisualTransformation() else androidx.compose.ui.text.input.VisualTransformation.None,
        keyboardOptions = KeyboardOptions(keyboardType = if (isPassword) KeyboardType.Password else keyboardType)
    )
}

@Composable
fun CategoryBadge(category: SpotCategory) {
    val palette = ScopeTokens.badge(category)
    Text(
        text = category.label,
        color = palette.foreground,
        style = MaterialTheme.typography.labelSmall,
        modifier = Modifier
            .background(palette.background, shape = CircleShape)
            .padding(horizontal = ScopeSpacing.Md, vertical = ScopeSpacing.Xs)
    )
}

@Composable
fun GlassPanel(
    modifier: Modifier = Modifier,
    content: @Composable () -> Unit
) {
    Column(
        modifier = modifier
            .fillMaxWidth()
            .background(ScopeTokens.GlassBg, shape = RoundedCornerShape(24.dp))
            .border(1.dp, ScopeTokens.GlassBorder, shape = RoundedCornerShape(24.dp))
            .padding(ScopeSpacing.Xl),
        verticalArrangement = Arrangement.spacedBy(ScopeSpacing.Md)
    ) { content() }
}

@Composable
fun SectionHeader(title: String, eyebrow: String, modifier: Modifier = Modifier) {
    Column(modifier = modifier, verticalArrangement = Arrangement.spacedBy(ScopeSpacing.Xs)) {
        Text(
            text = eyebrow.uppercase(),
            style = MaterialTheme.typography.labelSmall,
            color = ScopeTokens.AccentGold
        )
        Text(title, style = MaterialTheme.typography.headlineMedium, color = ScopeTokens.TextPrimary)
    }
}

@Composable
fun HeroGradient(modifier: Modifier = Modifier, content: @Composable () -> Unit) {
    Box(
        modifier = modifier
            .fillMaxWidth()
            .background(
                Brush.linearGradient(listOf(ScopeTokens.AccentTeal, ScopeTokens.AccentGold)),
                shape = RoundedCornerShape(24.dp)
            )
            .padding(ScopeSpacing.Xl),
        contentAlignment = Alignment.CenterStart
    ) { content() }
}

@Composable
fun EmptyHint(text: String) {
    Text(
        text = text,
        color = ScopeTokens.TextMuted,
        style = MaterialTheme.typography.bodyMedium,
        modifier = Modifier
            .fillMaxWidth()
            .background(ScopeTokens.BgSecondary, RoundedCornerShape(12.dp))
            .padding(ScopeSpacing.Base)
    )
}
