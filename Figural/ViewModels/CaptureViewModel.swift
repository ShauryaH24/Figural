import Foundation
import SwiftUI
import MWDATCore
import MWDATCamera

@MainActor
final class CaptureViewModel: ObservableObject {
    @Published var previewImage: UIImage?
    @Published var capturedPhoto: UIImage?
    @Published var streamState: StreamSessionState = .stopped
    @Published var statusMessage: String = "Ready to connect"
    @Published var generatedContent: String?
    @Published var isGenerating: Bool = false
    @Published var selectedMode: GenerationMode = .uiMockup
    @Published var streamError: Error?
    @Published var generationError: String?
    @Published var isResultsExpanded: Bool = true
    
    private var streamSession: StreamSession?
    private var stateToken: AnyListenerToken?
    private var frameToken: AnyListenerToken?
    private var photoToken: AnyListenerToken?
    
    func startStream() {
        guard streamState != .streaming else { return }
        
        streamError = nil
        generationError = nil
        
        do {
            let config = StreamSessionConfig(
                videoCodec: .raw,
                resolution: .medium,
                frameRate: 15
            )
            
            let session = try StreamSession(
                deviceSelector: AutoDeviceSelector(),
                config: config
            )
            
            self.streamSession = session
            setupListeners(for: session)
            
            try session.start()
            statusMessage = "Starting stream..."
            
        } catch {
            streamError = error
            statusMessage = "Failed to start stream"
            print("Stream start error: \(error)")
        }
    }
    
    private func setupListeners(for session: StreamSession) {
        stateToken = session.statePublisher.listen { [weak self] state in
            Task { @MainActor in
                self?.handleStateChange(state)
            }
        }
        
        frameToken = session.videoFramePublisher.listen { [weak self] frame in
            Task { @MainActor in
                self?.handleVideoFrame(frame)
            }
        }
        
        photoToken = session.photoDataPublisher.listen { [weak self] photoData in
            Task { @MainActor in
                self?.handlePhotoCapture(photoData)
            }
        }
    }
    
    private func handleStateChange(_ state: StreamSessionState) {
        self.streamState = state
        
        switch state {
        case .streaming:
            statusMessage = "Ready — frame your drawing"
        case .paused:
            statusMessage = "Session paused — put your glasses back on"
        case .stopped:
            statusMessage = "Session ended"
            previewImage = nil
        case .waitingForDevice:
            statusMessage = "Looking for glasses..."
        @unknown default:
            statusMessage = "Unknown state"
        }
    }
    
    private func handleVideoFrame(_ frame: VideoFrame) {
        if let cgImage = frame.cgImage {
            self.previewImage = UIImage(cgImage: cgImage)
        }
    }
    
    private func handlePhotoCapture(_ photoData: Data) {
        if let image = UIImage(data: photoData) {
            self.capturedPhoto = image
            Task {
                await generateContent(from: photoData)
            }
        }
    }
    
    func captureDrawing() {
        guard streamState == .streaming else {
            statusMessage = "Stream must be active to capture"
            return
        }
        
        do {
            try streamSession?.capturePhoto(format: .jpeg)
            statusMessage = "Capturing photo..."
        } catch {
            streamError = error
            statusMessage = "Failed to capture photo"
            print("Photo capture error: \(error)")
        }
    }
    
    func stopStream() {
        streamSession?.stop()
        streamSession = nil
        stateToken = nil
        frameToken = nil
        photoToken = nil
        streamState = .stopped
        statusMessage = "Stream stopped"
    }
    
    private func generateContent(from imageData: Data) async {
        guard !Constants.anthropicAPIKey.isEmpty else {
            generationError = "API key not configured. Please add your Anthropic API key to Constants.swift"
            return
        }
        
        isGenerating = true
        generationError = nil
        generatedContent = nil
        statusMessage = "Analyzing drawing..."
        
        do {
            let base64Image = imageData.base64EncodedString()
            let response = try await callAnthropicAPI(base64Image: base64Image, prompt: selectedMode.prompt)
            generatedContent = response
            statusMessage = "Analysis complete"
        } catch {
            generationError = "Generation failed: \(error.localizedDescription)"
            statusMessage = "Generation failed"
            print("AI generation error: \(error)")
        }
        
        isGenerating = false
    }
    
    private func callAnthropicAPI(base64Image: String, prompt: String) async throws -> String {
        guard let url = URL(string: Constants.anthropicAPIURL) else {
            throw APIError.invalidURL
        }
        
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue(Constants.anthropicAPIKey, forHTTPHeaderField: "x-api-key")
        request.setValue(Constants.anthropicVersion, forHTTPHeaderField: "anthropic-version")
        
        let body: [String: Any] = [
            "model": Constants.anthropicModel,
            "max_tokens": Constants.maxTokens,
            "messages": [
                [
                    "role": "user",
                    "content": [
                        [
                            "type": "image",
                            "source": [
                                "type": "base64",
                                "media_type": "image/jpeg",
                                "data": base64Image
                            ]
                        ],
                        [
                            "type": "text",
                            "text": prompt
                        ]
                    ]
                ]
            ]
        ]
        
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        
        let (data, response) = try await URLSession.shared.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIError.invalidResponse
        }
        
        guard httpResponse.statusCode == 200 else {
            if let errorBody = String(data: data, encoding: .utf8) {
                throw APIError.serverError(statusCode: httpResponse.statusCode, message: errorBody)
            }
            throw APIError.serverError(statusCode: httpResponse.statusCode, message: "Unknown error")
        }
        
        guard let json = try JSONSerialization.jsonObject(with: data) as? [String: Any],
              let content = json["content"] as? [[String: Any]],
              let firstContent = content.first,
              let text = firstContent["text"] as? String else {
            throw APIError.parsingError
        }
        
        return text
    }
    
    func clearResults() {
        capturedPhoto = nil
        generatedContent = nil
        generationError = nil
    }
}

enum APIError: LocalizedError {
    case invalidURL
    case invalidResponse
    case serverError(statusCode: Int, message: String)
    case parsingError
    
    var errorDescription: String? {
        switch self {
        case .invalidURL:
            return "Invalid API URL"
        case .invalidResponse:
            return "Invalid response from server"
        case .serverError(let statusCode, let message):
            return "Server error (\(statusCode)): \(message)"
        case .parsingError:
            return "Failed to parse API response"
        }
    }
}
