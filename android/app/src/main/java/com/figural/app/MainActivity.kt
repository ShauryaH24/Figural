package com.figural.app

import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.animation.Crossfade
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.lifecycle.viewmodel.compose.viewModel
import com.figural.app.manager.GlassesManager
import com.figural.app.ui.screens.MainScreen
import com.figural.app.ui.screens.OnboardingScreen
import com.figural.app.ui.screens.PermissionScreen
import com.figural.app.ui.theme.FiguralTheme
import com.figural.app.viewmodel.CaptureViewModel
import com.meta.wearable.dat.core.PermissionStatus
import kotlinx.coroutines.launch

class MainActivity : ComponentActivity() {

    private lateinit var glassesManager: GlassesManager

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        glassesManager = GlassesManager(this)

        handleIntent(intent)

        setContent {
            FiguralTheme {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = MaterialTheme.colorScheme.background
                ) {
                    FiguralApp(glassesManager = glassesManager)
                }
            }
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        handleIntent(intent)
    }

    private fun handleIntent(intent: Intent?) {
        intent?.data?.let { uri ->
            kotlinx.coroutines.MainScope().launch {
                glassesManager.handleCallback(uri)
            }
        }
    }
}

@Composable
fun FiguralApp(glassesManager: GlassesManager) {
    val isRegistered by glassesManager.isRegistered.collectAsState()
    val isRegistering by glassesManager.isRegistering.collectAsState()
    val cameraPermissionStatus by glassesManager.cameraPermissionStatus.collectAsState()
    val error by glassesManager.error.collectAsState()

    val captureViewModel: CaptureViewModel = viewModel()
    val coroutineScope = rememberCoroutineScope()

    val previewBitmap by captureViewModel.previewBitmap.collectAsState()
    val capturedPhoto by captureViewModel.capturedPhoto.collectAsState()
    val streamState by captureViewModel.streamState.collectAsState()
    val statusMessage by captureViewModel.statusMessage.collectAsState()
    val generatedContent by captureViewModel.generatedContent.collectAsState()
    val isGenerating by captureViewModel.isGenerating.collectAsState()
    val selectedMode by captureViewModel.selectedMode.collectAsState()
    val streamError by captureViewModel.streamError.collectAsState()
    val generationError by captureViewModel.generationError.collectAsState()
    val isResultsExpanded by captureViewModel.isResultsExpanded.collectAsState()

    Crossfade(
        targetState = when {
            !isRegistered -> AppState.ONBOARDING
            cameraPermissionStatus != PermissionStatus.GRANTED -> AppState.PERMISSION
            else -> AppState.MAIN
        },
        label = "screen_transition"
    ) { state ->
        when (state) {
            AppState.ONBOARDING -> {
                OnboardingScreen(
                    isRegistering = isRegistering,
                    error = error,
                    onRegister = { glassesManager.register() },
                    onDismissError = { glassesManager.clearError() }
                )
            }

            AppState.PERMISSION -> {
                PermissionScreen(
                    onRequestPermission = {
                        coroutineScope.launch {
                            glassesManager.requestCameraPermission()
                        }
                    }
                )
            }

            AppState.MAIN -> {
                MainScreen(
                    previewBitmap = previewBitmap,
                    capturedPhoto = capturedPhoto,
                    streamState = streamState,
                    statusMessage = statusMessage,
                    generatedContent = generatedContent,
                    isGenerating = isGenerating,
                    selectedMode = selectedMode,
                    streamError = streamError,
                    generationError = generationError,
                    isResultsExpanded = isResultsExpanded,
                    onStartStream = { captureViewModel.startStream() },
                    onStopStream = { captureViewModel.stopStream() },
                    onCapture = { captureViewModel.captureDrawing() },
                    onSelectMode = { captureViewModel.setSelectedMode(it) },
                    onToggleResults = { captureViewModel.toggleResultsExpanded() },
                    onClearResults = { captureViewModel.clearResults() },
                    onClearStreamError = { captureViewModel.clearStreamError() },
                    onDisconnect = { glassesManager.unregister() }
                )
            }
        }
    }
}

private enum class AppState {
    ONBOARDING,
    PERMISSION,
    MAIN
}
