import Foundation
import SwiftUI
import MWDATCore

@MainActor
final class GlassesManager: ObservableObject {
    @Published var isRegistered: Bool = false
    @Published var devices: [Device] = []
    @Published var cameraPermissionStatus: PermissionStatus = .denied
    @Published var registrationError: Error?
    @Published var isRegistering: Bool = false
    
    private let wearables = Wearables.shared
    
    init() {
        Task {
            await configure()
            await observeRegistrationState()
            await observeDevices()
        }
    }
    
    private func configure() async {
        do {
            try Wearables.configure()
        } catch {
            print("Failed to configure Wearables: \(error)")
        }
    }
    
    private func observeRegistrationState() async {
        for await state in wearables.registrationStateStream() {
            switch state {
            case .registered:
                self.isRegistered = true
                self.isRegistering = false
                await checkCameraPermission()
            case .unregistered:
                self.isRegistered = false
                self.isRegistering = false
            case .registering:
                self.isRegistering = true
            case .unregistering:
                self.isRegistering = true
            @unknown default:
                break
            }
        }
    }
    
    private func observeDevices() async {
        for await deviceList in wearables.devicesStream() {
            self.devices = deviceList
        }
    }
    
    func register() {
        do {
            isRegistering = true
            registrationError = nil
            try wearables.startRegistration()
        } catch {
            isRegistering = false
            registrationError = error
            print("Registration failed: \(error)")
        }
    }
    
    func unregister() {
        do {
            try wearables.startUnregistration()
        } catch {
            print("Unregistration failed: \(error)")
        }
    }
    
    func handleCallback(url: URL) async {
        do {
            _ = try await wearables.handleUrl(url)
        } catch {
            print("Failed to handle callback URL: \(error)")
            registrationError = error
        }
    }
    
    func checkCameraPermission() async {
        do {
            cameraPermissionStatus = try await wearables.checkPermissionStatus(.camera)
        } catch {
            print("Failed to check camera permission: \(error)")
            cameraPermissionStatus = .denied
        }
    }
    
    func requestCameraPermission() async {
        do {
            cameraPermissionStatus = try await wearables.requestPermission(.camera)
        } catch {
            print("Failed to request camera permission: \(error)")
            cameraPermissionStatus = .denied
        }
    }
    
    var hasCameraPermission: Bool {
        cameraPermissionStatus == .granted
    }
}
