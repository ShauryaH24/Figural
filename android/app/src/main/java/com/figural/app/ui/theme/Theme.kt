package com.figural.app.ui.theme

import android.app.Activity
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.SideEffect
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.platform.LocalView
import androidx.core.view.WindowCompat

val Purple500 = Color(0xFF8B5CF6)
val Purple700 = Color(0xFF7C3AED)
val Blue500 = Color(0xFF3B82F6)
val Blue700 = Color(0xFF2563EB)
val Pink500 = Color(0xFFEC4899)
val Green500 = Color(0xFF22C55E)
val Yellow500 = Color(0xFFEAB308)
val Red500 = Color(0xFFEF4444)
val Orange500 = Color(0xFFF97316)

private val LightColorScheme = lightColorScheme(
    primary = Blue500,
    secondary = Purple500,
    tertiary = Pink500,
    background = Color(0xFFF9FAFB),
    surface = Color.White,
    onPrimary = Color.White,
    onSecondary = Color.White,
    onTertiary = Color.White,
    onBackground = Color(0xFF1F2937),
    onSurface = Color(0xFF1F2937),
    error = Red500,
    onError = Color.White
)

private val DarkColorScheme = darkColorScheme(
    primary = Blue500,
    secondary = Purple500,
    tertiary = Pink500,
    background = Color(0xFF111827),
    surface = Color(0xFF1F2937),
    onPrimary = Color.White,
    onSecondary = Color.White,
    onTertiary = Color.White,
    onBackground = Color(0xFFF9FAFB),
    onSurface = Color(0xFFF9FAFB),
    error = Red500,
    onError = Color.White
)

@Composable
fun FiguralTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    content: @Composable () -> Unit
) {
    val colorScheme = if (darkTheme) DarkColorScheme else LightColorScheme

    val view = LocalView.current
    if (!view.isInEditMode) {
        SideEffect {
            val window = (view.context as Activity).window
            window.statusBarColor = colorScheme.background.toArgb()
            WindowCompat.getInsetsController(window, view).isAppearanceLightStatusBars = !darkTheme
        }
    }

    MaterialTheme(
        colorScheme = colorScheme,
        content = content
    )
}
