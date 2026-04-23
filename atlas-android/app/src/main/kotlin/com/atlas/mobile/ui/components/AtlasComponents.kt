package com.atlas.mobile.ui.components

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
import com.atlas.mobile.data.model.SpotCategory
import com.atlas.mobile.ui.theme.AtlasTokens

object AtlasSpacing {
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
fun AtlasPrimaryButton(
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
            containerColor = AtlasTokens.AccentTeal,
            contentColor = Color(0xFF0B1020)
        ),
        contentPadding = PaddingValues(horizontal = AtlasSpacing.Lg, vertical = AtlasSpacing.Md)
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
fun AtlasGhostButton(label: String, onClick: () -> Unit, modifier: Modifier = Modifier) {
    OutlinedButton(
        onClick = onClick,
        modifier = modifier.fillMaxWidth().height(48.dp),
        shape = RoundedCornerShape(12.dp),
        colors = ButtonDefaults.outlinedButtonColors(contentColor = AtlasTokens.AccentTeal),
        border = androidx.compose.foundation.BorderStroke(1.dp, AtlasTokens.AccentTeal)
    ) {
        Text(label, style = MaterialTheme.typography.bodyLarge.copy(fontWeight = androidx.compose.ui.text.font.FontWeight.SemiBold))
    }
}

@Composable
fun AtlasLinkButton(label: String, onClick: () -> Unit) {
    TextButton(onClick = onClick) {
        Text(label, color = AtlasTokens.AccentTeal)
    }
}

@Composable
fun AtlasTextField(
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
        label = { Text(label.uppercase(), style = MaterialTheme.typography.labelSmall, color = AtlasTokens.TextMuted) },
        placeholder = { Text(placeholder, color = AtlasTokens.TextMuted) },
        singleLine = true,
        shape = RoundedCornerShape(10.dp),
        modifier = modifier.fillMaxWidth(),
        visualTransformation = if (isPassword) PasswordVisualTransformation() else androidx.compose.ui.text.input.VisualTransformation.None,
        keyboardOptions = KeyboardOptions(keyboardType = if (isPassword) KeyboardType.Password else keyboardType)
    )
}

@Composable
fun CategoryBadge(category: SpotCategory) {
    val palette = AtlasTokens.badge(category)
    Text(
        text = category.label,
        color = palette.foreground,
        style = MaterialTheme.typography.labelSmall,
        modifier = Modifier
            .background(palette.background, shape = CircleShape)
            .padding(horizontal = AtlasSpacing.Md, vertical = AtlasSpacing.Xs)
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
            .background(AtlasTokens.GlassBg, shape = RoundedCornerShape(24.dp))
            .border(1.dp, AtlasTokens.GlassBorder, shape = RoundedCornerShape(24.dp))
            .padding(AtlasSpacing.Xl),
        verticalArrangement = Arrangement.spacedBy(AtlasSpacing.Md)
    ) { content() }
}

@Composable
fun SectionHeader(title: String, eyebrow: String, modifier: Modifier = Modifier) {
    Column(modifier = modifier, verticalArrangement = Arrangement.spacedBy(AtlasSpacing.Xs)) {
        Text(
            text = eyebrow.uppercase(),
            style = MaterialTheme.typography.labelSmall,
            color = AtlasTokens.AccentGold
        )
        Text(title, style = MaterialTheme.typography.headlineMedium, color = AtlasTokens.TextPrimary)
    }
}

@Composable
fun HeroGradient(modifier: Modifier = Modifier, content: @Composable () -> Unit) {
    Box(
        modifier = modifier
            .fillMaxWidth()
            .background(
                Brush.linearGradient(listOf(AtlasTokens.AccentTeal, AtlasTokens.AccentGold)),
                shape = RoundedCornerShape(24.dp)
            )
            .padding(AtlasSpacing.Xl),
        contentAlignment = Alignment.CenterStart
    ) { content() }
}

@Composable
fun EmptyHint(text: String) {
    Text(
        text = text,
        color = AtlasTokens.TextMuted,
        style = MaterialTheme.typography.bodyMedium,
        modifier = Modifier
            .fillMaxWidth()
            .background(AtlasTokens.BgSecondary, RoundedCornerShape(12.dp))
            .padding(AtlasSpacing.Base)
    )
}
