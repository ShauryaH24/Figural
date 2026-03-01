import SwiftUI
import MWDATCamera

struct MainView: View {
    @ObservedObject var glassesManager: GlassesManager
    @StateObject private var captureVM = CaptureViewModel()
    @State private var showStreamError = false
    
    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 20) {
                    cameraPreviewSection
                    controlsSection
                    modePicker
                    resultsSection
                }
                .padding()
            }
            .navigationTitle("Figural")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Menu {
                        Button(role: .destructive) {
                            glassesManager.unregister()
                        } label: {
                            Label("Disconnect Glasses", systemImage: "link.badge.minus")
                        }
                    } label: {
                        Image(systemName: "ellipsis.circle")
                    }
                }
            }
        }
        .alert("Stream Error", isPresented: $showStreamError) {
            Button("OK", role: .cancel) {}
        } message: {
            Text(captureVM.streamError?.localizedDescription ?? "Failed to start stream")
        }
        .onChange(of: captureVM.streamError != nil) { hasError in
            showStreamError = hasError
        }
    }
    
    private var cameraPreviewSection: some View {
        ZStack {
            if let previewImage = captureVM.previewImage {
                Image(uiImage: previewImage)
                    .resizable()
                    .aspectRatio(contentMode: .fit)
                    .clipShape(RoundedRectangle(cornerRadius: 16))
                    .overlay(alignment: .bottom) {
                        statusPill
                            .padding(.bottom, 12)
                    }
            } else {
                RoundedRectangle(cornerRadius: 16)
                    .fill(Color(.systemGray6))
                    .aspectRatio(16/9, contentMode: .fit)
                    .overlay {
                        VStack(spacing: 12) {
                            Image(systemName: "camera.viewfinder")
                                .font(.system(size: 48))
                                .foregroundColor(.secondary)
                            
                            Text("Start stream to preview")
                                .font(.subheadline)
                                .foregroundColor(.secondary)
                        }
                    }
            }
            
            streamStateIndicator
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topTrailing)
                .padding(12)
        }
    }
    
    private var statusPill: some View {
        Text(captureVM.statusMessage)
            .font(.caption)
            .fontWeight(.medium)
            .padding(.horizontal, 16)
            .padding(.vertical, 8)
            .background(.ultraThinMaterial)
            .clipShape(Capsule())
    }
    
    private var streamStateIndicator: some View {
        Circle()
            .fill(streamStateColor)
            .frame(width: 12, height: 12)
            .overlay {
                Circle()
                    .stroke(Color.white, lineWidth: 2)
            }
            .shadow(color: streamStateColor.opacity(0.5), radius: 4)
    }
    
    private var streamStateColor: Color {
        switch captureVM.streamState {
        case .streaming:
            return .green
        case .paused:
            return .yellow
        case .stopped, .waitingForDevice:
            return .gray
        @unknown default:
            return .gray
        }
    }
    
    private var controlsSection: some View {
        HStack(spacing: 12) {
            Button(action: {
                Task {
                    captureVM.startStream()
                }
            }) {
                Label("Start", systemImage: "play.fill")
                    .font(.subheadline)
                    .fontWeight(.medium)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 12)
                    .background(captureVM.streamState == .streaming ? Color.gray.opacity(0.3) : Color.blue)
                    .foregroundColor(.white)
                    .clipShape(RoundedRectangle(cornerRadius: 10))
            }
            .disabled(captureVM.streamState == .streaming)
            
            Button(action: {
                Task {
                    captureVM.captureDrawing()
                }
            }) {
                HStack {
                    Text("📸")
                    Text("Capture")
                        .fontWeight(.semibold)
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 12)
                .background(
                    captureVM.streamState == .streaming
                    ? LinearGradient(colors: [.purple, .pink], startPoint: .leading, endPoint: .trailing)
                    : LinearGradient(colors: [.gray.opacity(0.3), .gray.opacity(0.3)], startPoint: .leading, endPoint: .trailing)
                )
                .foregroundColor(.white)
                .clipShape(RoundedRectangle(cornerRadius: 10))
            }
            .disabled(captureVM.streamState != .streaming)
            
            Button(action: {
                Task {
                    captureVM.stopStream()
                }
            }) {
                Label("Stop", systemImage: "stop.fill")
                    .font(.subheadline)
                    .fontWeight(.medium)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 12)
                    .background(captureVM.streamState == .stopped ? Color.gray.opacity(0.3) : Color.red)
                    .foregroundColor(.white)
                    .clipShape(RoundedRectangle(cornerRadius: 10))
            }
            .disabled(captureVM.streamState == .stopped)
        }
    }
    
    private var modePicker: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Generation Mode")
                .font(.subheadline)
                .fontWeight(.medium)
                .foregroundColor(.secondary)
            
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                    ForEach(GenerationMode.allCases) { mode in
                        ModeButton(
                            mode: mode,
                            isSelected: captureVM.selectedMode == mode
                        ) {
                            captureVM.selectedMode = mode
                        }
                    }
                }
            }
        }
    }
    
    private var resultsSection: some View {
        VStack(spacing: 0) {
            Button(action: {
                withAnimation(.easeInOut(duration: 0.2)) {
                    captureVM.isResultsExpanded.toggle()
                }
            }) {
                HStack {
                    Text("Results")
                        .font(.headline)
                        .foregroundColor(.primary)
                    
                    Spacer()
                    
                    if captureVM.capturedPhoto != nil || captureVM.generatedContent != nil {
                        Button(action: {
                            captureVM.clearResults()
                        }) {
                            Text("Clear")
                                .font(.caption)
                                .foregroundColor(.red)
                        }
                    }
                    
                    Image(systemName: captureVM.isResultsExpanded ? "chevron.up" : "chevron.down")
                        .foregroundColor(.secondary)
                        .font(.caption)
                }
                .padding(.vertical, 12)
            }
            
            if captureVM.isResultsExpanded {
                VStack(spacing: 16) {
                    if let capturedPhoto = captureVM.capturedPhoto {
                        VStack(alignment: .leading, spacing: 8) {
                            Text("Captured Drawing")
                                .font(.subheadline)
                                .fontWeight(.medium)
                                .foregroundColor(.secondary)
                            
                            Image(uiImage: capturedPhoto)
                                .resizable()
                                .aspectRatio(contentMode: .fit)
                                .frame(maxHeight: 150)
                                .clipShape(RoundedRectangle(cornerRadius: 8))
                        }
                    }
                    
                    if captureVM.isGenerating {
                        VStack(spacing: 12) {
                            ProgressView()
                                .progressViewStyle(CircularProgressViewStyle())
                            Text("Generating...")
                                .font(.subheadline)
                                .foregroundColor(.secondary)
                        }
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 24)
                    } else if let error = captureVM.generationError {
                        HStack {
                            Image(systemName: "exclamationmark.triangle.fill")
                                .foregroundColor(.orange)
                            Text(error)
                                .font(.caption)
                                .foregroundColor(.secondary)
                        }
                        .padding()
                        .frame(maxWidth: .infinity)
                        .background(Color.orange.opacity(0.1))
                        .clipShape(RoundedRectangle(cornerRadius: 8))
                    } else if let content = captureVM.generatedContent {
                        VStack(alignment: .leading, spacing: 8) {
                            HStack {
                                Text("Generated Output")
                                    .font(.subheadline)
                                    .fontWeight(.medium)
                                    .foregroundColor(.secondary)
                                
                                Spacer()
                                
                                Button(action: {
                                    UIPasteboard.general.string = content
                                }) {
                                    Label("Copy", systemImage: "doc.on.doc")
                                        .font(.caption)
                                        .foregroundColor(.blue)
                                }
                            }
                            
                            ScrollView {
                                Text(content)
                                    .font(.system(.caption, design: .monospaced))
                                    .textSelection(.enabled)
                                    .frame(maxWidth: .infinity, alignment: .leading)
                            }
                            .frame(maxHeight: 300)
                            .padding()
                            .background(Color(.systemGray6))
                            .clipShape(RoundedRectangle(cornerRadius: 8))
                        }
                    } else if captureVM.capturedPhoto == nil {
                        Text("Capture a drawing to see AI-generated results")
                            .font(.subheadline)
                            .foregroundColor(.secondary)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 24)
                    }
                }
            }
        }
        .padding()
        .background(Color(.systemBackground))
        .clipShape(RoundedRectangle(cornerRadius: 12))
        .shadow(color: Color.black.opacity(0.05), radius: 8, y: 2)
    }
}

struct ModeButton: View {
    let mode: GenerationMode
    let isSelected: Bool
    let action: () -> Void
    
    var body: some View {
        Button(action: action) {
            HStack(spacing: 6) {
                Image(systemName: mode.icon)
                    .font(.caption)
                Text(mode.displayName)
                    .font(.caption)
                    .fontWeight(.medium)
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 10)
            .background(
                isSelected
                ? LinearGradient(colors: [.blue, .purple], startPoint: .leading, endPoint: .trailing)
                : LinearGradient(colors: [Color(.systemGray5), Color(.systemGray5)], startPoint: .leading, endPoint: .trailing)
            )
            .foregroundColor(isSelected ? .white : .primary)
            .clipShape(Capsule())
        }
    }
}

#Preview {
    MainView(glassesManager: GlassesManager())
}
