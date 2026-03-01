package com.figural.app.viewmodel

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.util.Base64
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.figural.app.Constants
import com.figural.app.model.GenerationMode
import com.meta.wearable.dat.camera.AutoDeviceSelector
import com.meta.wearable.dat.camera.PhotoFormat
import com.meta.wearable.dat.camera.StreamSession
import com.meta.wearable.dat.camera.StreamSessionConfig
import com.meta.wearable.dat.camera.StreamSessionState
import com.meta.wearable.dat.camera.VideoCodec
import com.meta.wearable.dat.camera.VideoResolution
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONArray
import org.json.JSONObject
import java.io.ByteArrayOutputStream
import java.util.concurrent.TimeUnit

class CaptureViewModel : ViewModel() {

    private val client = OkHttpClient.Builder()
        .connectTimeout(60, TimeUnit.SECONDS)
        .readTimeout(120, TimeUnit.SECONDS)
        .writeTimeout(60, TimeUnit.SECONDS)
        .build()

    private var streamSession: StreamSession? = null

    private val _previewBitmap = MutableStateFlow<Bitmap?>(null)
    val previewBitmap: StateFlow<Bitmap?> = _previewBitmap.asStateFlow()

    private val _capturedPhoto = MutableStateFlow<Bitmap?>(null)
    val capturedPhoto: StateFlow<Bitmap?> = _capturedPhoto.asStateFlow()

    private val _streamState = MutableStateFlow(StreamSessionState.STOPPED)
    val streamState: StateFlow<StreamSessionState> = _streamState.asStateFlow()

    private val _statusMessage = MutableStateFlow("Ready to connect")
    val statusMessage: StateFlow<String> = _statusMessage.asStateFlow()

    private val _generatedContent = MutableStateFlow<String?>(null)
    val generatedContent: StateFlow<String?> = _generatedContent.asStateFlow()

    private val _isGenerating = MutableStateFlow(false)
    val isGenerating: StateFlow<Boolean> = _isGenerating.asStateFlow()

    private val _selectedMode = MutableStateFlow(GenerationMode.UI_MOCKUP)
    val selectedMode: StateFlow<GenerationMode> = _selectedMode.asStateFlow()

    private val _streamError = MutableStateFlow<String?>(null)
    val streamError: StateFlow<String?> = _streamError.asStateFlow()

    private val _generationError = MutableStateFlow<String?>(null)
    val generationError: StateFlow<String?> = _generationError.asStateFlow()

    private val _isResultsExpanded = MutableStateFlow(true)
    val isResultsExpanded: StateFlow<Boolean> = _isResultsExpanded.asStateFlow()

    fun setSelectedMode(mode: GenerationMode) {
        _selectedMode.value = mode
    }

    fun toggleResultsExpanded() {
        _isResultsExpanded.value = !_isResultsExpanded.value
    }

    fun startStream() {
        if (_streamState.value == StreamSessionState.STREAMING) return

        _streamError.value = null
        _generationError.value = null

        viewModelScope.launch {
            try {
                val config = StreamSessionConfig(
                    videoCodec = VideoCodec.RAW,
                    resolution = VideoResolution.MEDIUM,
                    frameRate = 15
                )

                val session = StreamSession(
                    deviceSelector = AutoDeviceSelector(),
                    config = config
                )

                streamSession = session
                setupListeners(session)
                session.start()
                _statusMessage.value = "Starting stream..."

            } catch (e: Exception) {
                _streamError.value = e.message ?: "Failed to start stream"
                _statusMessage.value = "Failed to start stream"
            }
        }
    }

    private fun setupListeners(session: StreamSession) {
        viewModelScope.launch {
            session.stateFlow().collect { state ->
                handleStateChange(state)
            }
        }

        viewModelScope.launch {
            session.videoFrameFlow().collect { frame ->
                frame.bitmap?.let { bitmap ->
                    _previewBitmap.value = bitmap
                }
            }
        }

        viewModelScope.launch {
            session.photoDataFlow().collect { photoData ->
                handlePhotoCapture(photoData)
            }
        }
    }

    private fun handleStateChange(state: StreamSessionState) {
        _streamState.value = state

        _statusMessage.value = when (state) {
            StreamSessionState.STREAMING -> "Ready — frame your drawing"
            StreamSessionState.PAUSED -> "Session paused — put your glasses back on"
            StreamSessionState.STOPPED -> {
                _previewBitmap.value = null
                "Session ended"
            }
            StreamSessionState.WAITING_FOR_DEVICE -> "Looking for glasses..."
        }
    }

    private fun handlePhotoCapture(photoData: ByteArray) {
        val bitmap = BitmapFactory.decodeByteArray(photoData, 0, photoData.size)
        if (bitmap != null) {
            _capturedPhoto.value = bitmap
            viewModelScope.launch {
                generateContent(photoData)
            }
        }
    }

    fun captureDrawing() {
        if (_streamState.value != StreamSessionState.STREAMING) {
            _statusMessage.value = "Stream must be active to capture"
            return
        }

        try {
            streamSession?.capturePhoto(PhotoFormat.JPEG)
            _statusMessage.value = "Capturing photo..."
        } catch (e: Exception) {
            _streamError.value = e.message ?: "Failed to capture photo"
            _statusMessage.value = "Failed to capture photo"
        }
    }

    fun stopStream() {
        streamSession?.stop()
        streamSession = null
        _streamState.value = StreamSessionState.STOPPED
        _statusMessage.value = "Stream stopped"
    }

    private suspend fun generateContent(imageData: ByteArray) {
        if (Constants.ANTHROPIC_API_KEY.isEmpty()) {
            _generationError.value = "API key not configured. Please add your Anthropic API key to Constants.kt"
            return
        }

        _isGenerating.value = true
        _generationError.value = null
        _generatedContent.value = null
        _statusMessage.value = "Analyzing drawing..."

        try {
            val base64Image = Base64.encodeToString(imageData, Base64.NO_WRAP)
            val response = callAnthropicApi(base64Image, _selectedMode.value.prompt)
            _generatedContent.value = response
            _statusMessage.value = "Analysis complete"
        } catch (e: Exception) {
            _generationError.value = "Generation failed: ${e.message}"
            _statusMessage.value = "Generation failed"
        } finally {
            _isGenerating.value = false
        }
    }

    private suspend fun callAnthropicApi(base64Image: String, prompt: String): String {
        return withContext(Dispatchers.IO) {
            val imageContent = JSONObject().apply {
                put("type", "image")
                put("source", JSONObject().apply {
                    put("type", "base64")
                    put("media_type", "image/jpeg")
                    put("data", base64Image)
                })
            }

            val textContent = JSONObject().apply {
                put("type", "text")
                put("text", prompt)
            }

            val messageContent = JSONArray().apply {
                put(imageContent)
                put(textContent)
            }

            val message = JSONObject().apply {
                put("role", "user")
                put("content", messageContent)
            }

            val body = JSONObject().apply {
                put("model", Constants.ANTHROPIC_MODEL)
                put("max_tokens", Constants.MAX_TOKENS)
                put("messages", JSONArray().apply { put(message) })
            }

            val request = Request.Builder()
                .url(Constants.ANTHROPIC_API_URL)
                .addHeader("Content-Type", "application/json")
                .addHeader("x-api-key", Constants.ANTHROPIC_API_KEY)
                .addHeader("anthropic-version", Constants.ANTHROPIC_VERSION)
                .post(body.toString().toRequestBody("application/json".toMediaType()))
                .build()

            val response = client.newCall(request).execute()

            if (!response.isSuccessful) {
                val errorBody = response.body?.string() ?: "Unknown error"
                throw Exception("API error (${response.code}): $errorBody")
            }

            val responseBody = response.body?.string()
                ?: throw Exception("Empty response from API")

            val json = JSONObject(responseBody)
            val content = json.getJSONArray("content")
            val firstContent = content.getJSONObject(0)
            firstContent.getString("text")
        }
    }

    fun clearResults() {
        _capturedPhoto.value = null
        _generatedContent.value = null
        _generationError.value = null
    }

    fun clearStreamError() {
        _streamError.value = null
    }

    override fun onCleared() {
        super.onCleared()
        streamSession?.stop()
        streamSession = null
    }
}
