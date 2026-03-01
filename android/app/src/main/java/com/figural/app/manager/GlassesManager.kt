package com.figural.app.manager

import android.content.Context
import android.content.Intent
import android.net.Uri
import com.meta.wearable.dat.core.Device
import com.meta.wearable.dat.core.PermissionStatus
import com.meta.wearable.dat.core.PermissionType
import com.meta.wearable.dat.core.RegistrationState
import com.meta.wearable.dat.core.Wearables
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

class GlassesManager(private val context: Context) {

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main)
    private val wearables = Wearables.getInstance()

    private val _isRegistered = MutableStateFlow(false)
    val isRegistered: StateFlow<Boolean> = _isRegistered.asStateFlow()

    private val _isRegistering = MutableStateFlow(false)
    val isRegistering: StateFlow<Boolean> = _isRegistering.asStateFlow()

    private val _devices = MutableStateFlow<List<Device>>(emptyList())
    val devices: StateFlow<List<Device>> = _devices.asStateFlow()

    private val _cameraPermissionStatus = MutableStateFlow(PermissionStatus.DENIED)
    val cameraPermissionStatus: StateFlow<PermissionStatus> = _cameraPermissionStatus.asStateFlow()

    private val _error = MutableStateFlow<String?>(null)
    val error: StateFlow<String?> = _error.asStateFlow()

    val hasCameraPermission: Boolean
        get() = _cameraPermissionStatus.value == PermissionStatus.GRANTED

    init {
        observeRegistrationState()
        observeDevices()
    }

    private fun observeRegistrationState() {
        scope.launch {
            wearables.registrationStateFlow().collect { state ->
                when (state) {
                    RegistrationState.REGISTERED -> {
                        _isRegistered.value = true
                        _isRegistering.value = false
                        checkCameraPermission()
                    }
                    RegistrationState.UNREGISTERED -> {
                        _isRegistered.value = false
                        _isRegistering.value = false
                    }
                    RegistrationState.REGISTERING -> {
                        _isRegistering.value = true
                    }
                    RegistrationState.UNREGISTERING -> {
                        _isRegistering.value = true
                    }
                }
            }
        }
    }

    private fun observeDevices() {
        scope.launch {
            wearables.devicesFlow().collect { deviceList ->
                _devices.value = deviceList
            }
        }
    }

    fun register() {
        try {
            _isRegistering.value = true
            _error.value = null
            wearables.startRegistration(context)
        } catch (e: Exception) {
            _isRegistering.value = false
            _error.value = e.message ?: "Registration failed"
        }
    }

    fun unregister() {
        try {
            wearables.startUnregistration(context)
        } catch (e: Exception) {
            _error.value = e.message ?: "Unregistration failed"
        }
    }

    suspend fun handleCallback(uri: Uri) {
        try {
            wearables.handleUrl(uri)
        } catch (e: Exception) {
            _error.value = e.message ?: "Failed to handle callback"
        }
    }

    suspend fun checkCameraPermission() {
        try {
            _cameraPermissionStatus.value = wearables.checkPermissionStatus(PermissionType.CAMERA)
        } catch (e: Exception) {
            _cameraPermissionStatus.value = PermissionStatus.DENIED
        }
    }

    suspend fun requestCameraPermission() {
        try {
            _cameraPermissionStatus.value = wearables.requestPermission(context, PermissionType.CAMERA)
        } catch (e: Exception) {
            _cameraPermissionStatus.value = PermissionStatus.DENIED
            _error.value = e.message ?: "Failed to request camera permission"
        }
    }

    fun clearError() {
        _error.value = null
    }
}
