import SwiftUI

struct OnboardingView: View {
    @ObservedObject var glassesManager: GlassesManager
    @State private var showError = false
    
    var body: some View {
        VStack(spacing: 32) {
            Spacer()
            
            VStack(spacing: 16) {
                Image(systemName: "eyeglasses")
                    .font(.system(size: 80))
                    .foregroundStyle(
                        LinearGradient(
                            colors: [.blue, .purple],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                    )
                
                Text("Figural")
                    .font(.system(size: 42, weight: .bold, design: .rounded))
                    .foregroundStyle(
                        LinearGradient(
                            colors: [.primary, .primary.opacity(0.7)],
                            startPoint: .leading,
                            endPoint: .trailing
                        )
                    )
            }
            
            VStack(spacing: 12) {
                Text("Connect Your Ray-Ban Glasses")
                    .font(.title2)
                    .fontWeight(.semibold)
                
                Text("Capture hand-drawn sketches through your glasses and transform them into code, diagrams, and actionable feedback using AI.")
                    .font(.body)
                    .foregroundColor(.secondary)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 24)
            }
            
            Spacer()
            
            VStack(spacing: 16) {
                FeatureRow(
                    icon: "camera.viewfinder",
                    title: "Capture Drawings",
                    description: "Use your glasses camera to capture sketches"
                )
                
                FeatureRow(
                    icon: "wand.and.stars",
                    title: "AI-Powered Analysis",
                    description: "Transform drawings into code and insights"
                )
                
                FeatureRow(
                    icon: "doc.text",
                    title: "Multiple Outputs",
                    description: "Generate SwiftUI, React, Mermaid, and more"
                )
            }
            .padding(.horizontal, 24)
            
            Spacer()
            
            Button(action: {
                glassesManager.register()
            }) {
                HStack {
                    if glassesManager.isRegistering {
                        ProgressView()
                            .progressViewStyle(CircularProgressViewStyle(tint: .white))
                            .scaleEffect(0.8)
                    } else {
                        Image(systemName: "link.circle.fill")
                    }
                    Text(glassesManager.isRegistering ? "Connecting..." : "Connect Glasses")
                        .fontWeight(.semibold)
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 16)
                .background(
                    LinearGradient(
                        colors: [.blue, .purple],
                        startPoint: .leading,
                        endPoint: .trailing
                    )
                )
                .foregroundColor(.white)
                .clipShape(RoundedRectangle(cornerRadius: 14))
            }
            .disabled(glassesManager.isRegistering)
            .padding(.horizontal, 24)
            
            Text("Make sure Meta AI app is installed")
                .font(.caption)
                .foregroundColor(.secondary)
            
            Spacer()
                .frame(height: 32)
        }
        .alert("Connection Failed", isPresented: $showError) {
            Button("OK", role: .cancel) {}
        } message: {
            Text(glassesManager.registrationError?.localizedDescription ?? "Unable to connect to glasses. Please try again.")
        }
        .onChange(of: glassesManager.registrationError != nil) { hasError in
            showError = hasError
        }
    }
}

struct FeatureRow: View {
    let icon: String
    let title: String
    let description: String
    
    var body: some View {
        HStack(spacing: 16) {
            Image(systemName: icon)
                .font(.title2)
                .foregroundColor(.blue)
                .frame(width: 44, height: 44)
                .background(Color.blue.opacity(0.1))
                .clipShape(RoundedRectangle(cornerRadius: 10))
            
            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(.subheadline)
                    .fontWeight(.semibold)
                
                Text(description)
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
            
            Spacer()
        }
    }
}

#Preview {
    OnboardingView(glassesManager: GlassesManager())
}
