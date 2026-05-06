package com.scope.mobile.ui.theme

import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Shapes
import androidx.compose.material3.Typography
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.scope.mobile.data.model.SpotCategory

/**
 * Scope design tokens mirrored from `scope-assets/design-tokens.css`. Keeps
 * the palette in sync with the web and iOS clients.
 */
object ScopeTokens {
    val BgPrimary = Color(0xFF0F0F1A)
    val BgSecondary = Color(0xFF1A1A2E)
    val BgTertiary = Color(0xFF242442)
    val BgElevated = Color(0xFF2A2A4A)

    val TextPrimary = Color(0xFFF0F0F5)
    val TextSecondary = Color(0xFFA0A0B8)
    val TextMuted = Color(0xFF6B6B80)

    val AccentTeal = Color(0xFF10B981)
    val AccentTealHover = Color(0xFF0D9668)
    val AccentGold = Color(0xFFF59E0B)
    val AccentGoldHover = Color(0xFFD97706)

    val Danger = Color(0xFFEF4444)
    val Success = Color(0xFF22C55E)
    val Warning = Color(0xFFF59E0B)
    val Info = Color(0xFF3B82F6)

    val Border = Color(0xFF2A2A45)
    val BorderHover = Color(0xFF3A3A5C)

    val GlassBg = Color(0xC71A1A2E)
    val GlassBorder = Color(0x14FFFFFF)

    data class BadgePalette(val background: Color, val foreground: Color)

    fun badge(category: SpotCategory): BadgePalette = when (category) {
        SpotCategory.FOOD -> BadgePalette(Color(0xFF10392D), Color(0xFF7DF0BD))
        SpotCategory.NATURE -> BadgePalette(Color(0xFF163D1F), Color(0xFF9EF59E))
        SpotCategory.NIGHTLIFE -> BadgePalette(Color(0xFF251942), Color(0xFFD2BFFF))
        SpotCategory.CULTURE -> BadgePalette(Color(0xFF122C57), Color(0xFF9DC7FF))
        SpotCategory.ADVENTURE -> BadgePalette(Color(0xFF4D2F08), Color(0xFFFFD491))
        SpotCategory.SHOPPING -> BadgePalette(Color(0xFF4B1635), Color(0xFFFFB2D9))
        SpotCategory.SCENIC -> BadgePalette(Color(0xFF093A47), Color(0xFF84E8FF))
        SpotCategory.OTHER -> BadgePalette(Color(0xFF2A2F44), Color(0xFFCED4E6))
    }
}

private val ScopeDarkColors = darkColorScheme(
    primary = ScopeTokens.AccentTeal,
    onPrimary = Color(0xFF0B1020),
    secondary = ScopeTokens.AccentGold,
    onSecondary = Color(0xFF0B1020),
    tertiary = ScopeTokens.AccentGoldHover,
    background = ScopeTokens.BgPrimary,
    onBackground = ScopeTokens.TextPrimary,
    surface = ScopeTokens.BgSecondary,
    onSurface = ScopeTokens.TextPrimary,
    surfaceVariant = ScopeTokens.BgTertiary,
    onSurfaceVariant = ScopeTokens.TextSecondary,
    error = ScopeTokens.Danger,
    onError = Color.White,
    outline = ScopeTokens.Border
)

private val ScopeLightColors = lightColorScheme(
    primary = ScopeTokens.AccentTeal,
    onPrimary = Color.White,
    secondary = ScopeTokens.AccentGold,
    onSecondary = Color.White,
    tertiary = ScopeTokens.AccentGoldHover,
    background = Color(0xFFFAFAFA),
    onBackground = Color(0xFF1A1A2E),
    surface = Color.White,
    onSurface = Color(0xFF1A1A2E),
    surfaceVariant = Color(0xFFF0F0F5),
    onSurfaceVariant = Color(0xFF4A4A6A),
    error = ScopeTokens.Danger,
    onError = Color.White,
    outline = Color(0xFFE2E2EA)
)

private val ScopeTypography = Typography(
    displayLarge = TextStyle(fontSize = 40.sp, fontWeight = FontWeight.Bold, letterSpacing = (-1).sp),
    headlineLarge = TextStyle(fontSize = 32.sp, fontWeight = FontWeight.Bold),
    headlineMedium = TextStyle(fontSize = 24.sp, fontWeight = FontWeight.SemiBold),
    headlineSmall = TextStyle(fontSize = 18.sp, fontWeight = FontWeight.SemiBold),
    bodyLarge = TextStyle(fontSize = 16.sp, fontWeight = FontWeight.Normal),
    bodyMedium = TextStyle(fontSize = 14.sp, fontWeight = FontWeight.Normal),
    labelSmall = TextStyle(fontSize = 12.sp, fontWeight = FontWeight.Medium, letterSpacing = 1.2.sp)
)

private val ScopeShapes = Shapes(
    extraSmall = RoundedCornerShape(4.dp),
    small = RoundedCornerShape(8.dp),
    medium = RoundedCornerShape(12.dp),
    large = RoundedCornerShape(16.dp),
    extraLarge = RoundedCornerShape(24.dp)
)

@Composable
fun ScopeTheme(
    darkTheme: Boolean = true, // Scope ships dark-first; pass `isSystemInDarkTheme()` if you want system-aware theming.
    content: @Composable () -> Unit
) {
    MaterialTheme(
        colorScheme = if (darkTheme) ScopeDarkColors else ScopeLightColors,
        typography = ScopeTypography,
        shapes = ScopeShapes,
        content = content
    )
}
