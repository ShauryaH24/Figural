package com.figural.app.ui.screens

import android.graphics.Bitmap
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ContentCopy
import androidx.compose.material.icons.filled.KeyboardArrowDown
import androidx.compose.material.icons.filled.KeyboardArrowUp
import androidx.compose.material.icons.filled.MoreVert
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.Stop
import androidx.compose.material.icons.outlined.CameraAlt
import androidx.compose.material.icons.outlined.Warning
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.figural.app.model.GenerationMode
import com.figural.app.ui.theme.*
import com.meta.wearable.dat.camera.StreamSessionState

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MainScreen(
    previewBitmap: Bitmap?,
    capturedPhoto: Bitmap?,
    streamState: StreamSessionState,
    statusMessage: String,
    generatedContent: String?,
    isGenerating: Boolean,
    selectedMode: GenerationMode,
    streamError: String?,
    generationError: String?,
    isResultsExpanded: Boolean,
    onStartStream: () -> Unit,
    onStopStream: () -> Unit,
    onCapture: () -> Unit,
    onSelectMode: (GenerationMode) -> Unit,
    onToggleResults: () -> Unit,
    onClearResults: () -> Unit,
    onClearStreamError: () -> Unit,
    onDisconnect: () -> Unit
) {
    var showMenu by remember { mutableStateOf(false) }
    var showStreamError by remember { mutableStateOf(false) }

    LaunchedEffect(streamError) {
        showStreamError = streamError != null
    }

    if (showStreamError && streamError != null) {
        AlertDialog(
            onDismissRequest = {
                showStreamError = false
                onClearStreamError()
            },
            title = { Text("Stream Error") },
            text = { Text(streamError) },
            confirmButton = {
                TextButton(onClick = {
                    showStreamError = false
                    onClearStreamError()
                }) {
                    Text("OK")
                }
            }
        )
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Figural", fontWeight = FontWeight.Bold) },
                actions = {
                    Box {
                        IconButton(onClick = { showMenu = true }) {
                            Icon(Icons.Default.MoreVert, contentDescription = "Menu")
                        }
                        DropdownMenu(
                            expanded = showMenu,
                            onDismissRequest = { showMenu = false }
                        ) {
                            DropdownMenuItem(
                                text = { Text("Disconnect Glasses", color = Red500) },
                                onClick = {
                                    showMenu = false
                                    onDisconnect()
                                }
                            )
                        }
                    }
                }
            )
        }
    ) { paddingValues ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
                .verticalScroll(rememberScrollState())
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(20.dp)
        ) {
            CameraPreviewSection(
                previewBitmap = previewBitmap,
                streamState = streamState,
                statusMessage = statusMessage
            )

            ControlsSection(
                streamState = streamState,
                onStartStream = onStartStream,
                onStopStream = onStopStream,
                onCapture = onCapture
            )

            ModePickerSection(
                selectedMode = selectedMode,
                isGenerating = isGenerating,
                onSelectMode = onSelectMode
            )

            ResultsSection(
                capturedPhoto = capturedPhoto,
                generatedContent = generatedContent,
                isGenerating = isGenerating,
                generationError = generationError,
                isExpanded = isResultsExpanded,
                onToggleExpanded = onToggleResults,
                onClear = onClearResults
            )
        }
    }
}

@Composable
private fun CameraPreviewSection(
    previewBitmap: Bitmap?,
    streamState: StreamSessionState,
    statusMessage: String
) {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .aspectRatio(16f / 9f)
            .clip(RoundedCornerShape(16.dp))
            .background(MaterialTheme.colorScheme.surfaceVariant)
    ) {
        if (previewBitmap != null) {
            Image(
                bitmap = previewBitmap.asImageBitmap(),
                contentDescription = "Camera preview",
                modifier = Modifier.fillMaxSize(),
                contentScale = ContentScale.Fit
            )
        } else {
            Column(
                modifier = Modifier.fillMaxSize(),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.Center
            ) {
                Icon(
                    imageVector = Icons.Outlined.CameraAlt,
                    contentDescription = null,
                    modifier = Modifier.size(48.dp),
                    tint = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.5f)
                )
                Spacer(modifier = Modifier.height(12.dp))
                Text(
                    text = "Start stream to preview",
                    color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.5f)
                )
            }
        }

        Box(
            modifier = Modifier
                .align(Alignment.TopEnd)
                .padding(12.dp)
                .size(12.dp)
                .clip(CircleShape)
                .background(
                    when (streamState) {
                        StreamSessionState.STREAMING -> Green500
                        StreamSessionState.PAUSED -> Yellow500
                        else -> Color.Gray
                    }
                )
        )

        if (previewBitmap != null) {
            Box(
                modifier = Modifier
                    .align(Alignment.BottomCenter)
                    .padding(12.dp)
                    .clip(RoundedCornerShape(50))
                    .background(Color.Black.copy(alpha = 0.6f))
                    .padding(horizontal = 16.dp, vertical = 8.dp)
            ) {
                Text(
                    text = statusMessage,
                    color = Color.White,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Medium
                )
            }
        }
    }
}

@Composable
private fun ControlsSection(
    streamState: StreamSessionState,
    onStartStream: () -> Unit,
    onStopStream: () -> Unit,
    onCapture: () -> Unit
) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        Button(
            onClick = onStartStream,
            enabled = streamState != StreamSessionState.STREAMING,
            modifier = Modifier.weight(1f),
            colors = ButtonDefaults.buttonColors(
                containerColor = if (streamState == StreamSessionState.STREAMING) 
                    Color.Gray.copy(alpha = 0.3f) else Blue500
            ),
            shape = RoundedCornerShape(10.dp)
        ) {
            Icon(Icons.Default.PlayArrow, contentDescription = null, modifier = Modifier.size(18.dp))
            Spacer(modifier = Modifier.width(4.dp))
            Text("Start")
        }

        Button(
            onClick = onCapture,
            enabled = streamState == StreamSessionState.STREAMING,
            modifier = Modifier.weight(1.2f),
            colors = ButtonDefaults.buttonColors(
                containerColor = Color.Transparent
            ),
            contentPadding = PaddingValues(),
            shape = RoundedCornerShape(10.dp)
        ) {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(
                        if (streamState == StreamSessionState.STREAMING)
                            Brush.horizontalGradient(listOf(Purple500, Pink500))
                        else
                            Brush.horizontalGradient(listOf(Color.Gray.copy(alpha = 0.3f), Color.Gray.copy(alpha = 0.3f)))
                    )
                    .padding(vertical = 12.dp),
                contentAlignment = Alignment.Center
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text("📸", fontSize = 16.sp)
                    Spacer(modifier = Modifier.width(6.dp))
                    Text("Capture", fontWeight = FontWeight.SemiBold, color = Color.White)
                }
            }
        }

        Button(
            onClick = onStopStream,
            enabled = streamState != StreamSessionState.STOPPED,
            modifier = Modifier.weight(1f),
            colors = ButtonDefaults.buttonColors(
                containerColor = if (streamState == StreamSessionState.STOPPED)
                    Color.Gray.copy(alpha = 0.3f) else Red500
            ),
            shape = RoundedCornerShape(10.dp)
        ) {
            Icon(Icons.Default.Stop, contentDescription = null, modifier = Modifier.size(18.dp))
            Spacer(modifier = Modifier.width(4.dp))
            Text("Stop")
        }
    }
}

@Composable
private fun ModePickerSection(
    selectedMode: GenerationMode,
    isGenerating: Boolean,
    onSelectMode: (GenerationMode) -> Unit
) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text(
            text = "Generation Mode",
            fontSize = 14.sp,
            fontWeight = FontWeight.Medium,
            color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.6f)
        )

        Row(
            modifier = Modifier
                .fillMaxWidth()
                .horizontalScroll(rememberScrollState()),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            GenerationMode.entries.forEach { mode ->
                val isSelected = mode == selectedMode

                Surface(
                    modifier = Modifier
                        .clip(RoundedCornerShape(50))
                        .clickable(enabled = !isGenerating) { onSelectMode(mode) },
                    color = if (isSelected) Color.Transparent else MaterialTheme.colorScheme.surfaceVariant
                ) {
                    Box(
                        modifier = if (isSelected) {
                            Modifier.background(Brush.horizontalGradient(listOf(Blue500, Purple500)))
                        } else {
                            Modifier
                        }
                    ) {
                        Row(
                            modifier = Modifier.padding(horizontal = 14.dp, vertical = 10.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Icon(
                                imageVector = mode.icon,
                                contentDescription = null,
                                modifier = Modifier.size(16.dp),
                                tint = if (isSelected) Color.White else MaterialTheme.colorScheme.onSurface
                            )
                            Spacer(modifier = Modifier.width(6.dp))
                            Text(
                                text = mode.displayName,
                                fontSize = 12.sp,
                                fontWeight = FontWeight.Medium,
                                color = if (isSelected) Color.White else MaterialTheme.colorScheme.onSurface
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun ResultsSection(
    capturedPhoto: Bitmap?,
    generatedContent: String?,
    isGenerating: Boolean,
    generationError: String?,
    isExpanded: Boolean,
    onToggleExpanded: () -> Unit,
    onClear: () -> Unit
) {
    val clipboardManager = LocalClipboardManager.current

    Surface(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(12.dp),
        shadowElevation = 2.dp
    ) {
        Column {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .clickable { onToggleExpanded() }
                    .padding(16.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = "Results",
                    fontSize = 18.sp,
                    fontWeight = FontWeight.SemiBold
                )

                Row(verticalAlignment = Alignment.CenterVertically) {
                    if (capturedPhoto != null || generatedContent != null) {
                        TextButton(onClick = onClear) {
                            Text("Clear", color = Red500, fontSize = 12.sp)
                        }
                    }

                    Icon(
                        imageVector = if (isExpanded) Icons.Default.KeyboardArrowUp 
                            else Icons.Default.KeyboardArrowDown,
                        contentDescription = null,
                        tint = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.5f)
                    )
                }
            }

            if (isExpanded) {
                Column(
                    modifier = Modifier.padding(start = 16.dp, end = 16.dp, bottom = 16.dp),
                    verticalArrangement = Arrangement.spacedBy(16.dp)
                ) {
                    capturedPhoto?.let { photo ->
                        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                            Text(
                                text = "Captured Drawing",
                                fontSize = 14.sp,
                                fontWeight = FontWeight.Medium,
                                color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f)
                            )
                            Image(
                                bitmap = photo.asImageBitmap(),
                                contentDescription = "Captured photo",
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .heightIn(max = 150.dp)
                                    .clip(RoundedCornerShape(8.dp)),
                                contentScale = ContentScale.Fit
                            )
                        }
                    }

                    when {
                        isGenerating -> {
                            Column(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(vertical = 24.dp),
                                horizontalAlignment = Alignment.CenterHorizontally
                            ) {
                                CircularProgressIndicator()
                                Spacer(modifier = Modifier.height(12.dp))
                                Text(
                                    text = "Generating...",
                                    color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f)
                                )
                            }
                        }

                        generationError != null -> {
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clip(RoundedCornerShape(8.dp))
                                    .background(Orange500.copy(alpha = 0.1f))
                                    .padding(12.dp),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Icon(
                                    imageVector = Icons.Outlined.Warning,
                                    contentDescription = null,
                                    tint = Orange500
                                )
                                Spacer(modifier = Modifier.width(12.dp))
                                Text(
                                    text = generationError,
                                    fontSize = 12.sp,
                                    color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.7f)
                                )
                            }
                        }

                        generatedContent != null -> {
                            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.SpaceBetween,
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Text(
                                        text = "Generated Output",
                                        fontSize = 14.sp,
                                        fontWeight = FontWeight.Medium,
                                        color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f)
                                    )
                                    TextButton(
                                        onClick = {
                                            clipboardManager.setText(AnnotatedString(generatedContent))
                                        }
                                    ) {
                                        Icon(
                                            Icons.Default.ContentCopy,
                                            contentDescription = null,
                                            modifier = Modifier.size(14.dp)
                                        )
                                        Spacer(modifier = Modifier.width(4.dp))
                                        Text("Copy", fontSize = 12.sp)
                                    }
                                }

                                Box(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .heightIn(max = 300.dp)
                                        .clip(RoundedCornerShape(8.dp))
                                        .background(Color(0xFF1F2937))
                                        .verticalScroll(rememberScrollState())
                                        .padding(12.dp)
                                ) {
                                    Text(
                                        text = generatedContent,
                                        fontSize = 12.sp,
                                        fontFamily = FontFamily.Monospace,
                                        color = Color(0xFFF3F4F6)
                                    )
                                }
                            }
                        }

                        capturedPhoto == null -> {
                            Text(
                                text = "Capture a drawing to see AI-generated results",
                                fontSize = 14.sp,
                                color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.5f),
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(vertical = 24.dp),
                                textAlign = androidx.compose.ui.text.style.TextAlign.Center
                            )
                        }
                    }
                }
            }
        }
    }
}
