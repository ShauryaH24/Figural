import SwiftUI

struct PermissionView: View {
    @ObservedObject var glassesManager: GlassesManager
    
    var body: some View {
        VStack(spacing: 32) {
            Spacer()
            
            VStack(spacing: 16) {
                Image(systemName: "camera.badge.ellipsis")
                    .font(.system(size: 70))
                    .foregroundStyle(
                        LinearGradient(
                            colors: [.orange, .red],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                    )
                
                Text("Camera Access Required")
                    .font(.title)
                    .fontWeight(.bold)
            }
            
            VStack(spacing: 12) {
                Text("To capture your drawings through your Ray-Ban glasses, Figural needs access to the glasses camera.")
                    .font(.body)
                    .foregroundColor(.secondary)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 32)
                
                VStack(alignment: .leading, spacing: 8) {
                    PermissionBullet(text: "View live camera preview")
                    PermissionBullet(text: "Capture photos of your drawings")
                    PermissionBullet(text: "Stream video for real-time framing")
                }
                .padding(.horizontal, 48)
                .padding(.top, 8)
            }
            
            Spacer()
            
            VStack(spacing: 12) {
                Button(action: {
                    Task {
                        await glassesManager.requestCameraPermission()
                    }
                }) {
                    HStack {
                        Image(systemName: "camera.fill")
                        Text("Grant Camera Access")
                            .fontWeight(.semibold)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 16)
                    .background(
                        LinearGradient(
                            colors: [.orange, .red],
                            startPoint: .leading,
                            endPoint: .trailing
                        )
                    )
                    .foregroundColor(.white)
                    .clipShape(RoundedRectangle(cornerRadius: 14))
                }
                .padding(.horizontal, 24)
                
                Text("You can change this later in Meta AI settings")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
            
            Spacer()
                .frame(height: 48)
        }
    }
}

struct PermissionBullet: View {
    let text: String
    
    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: "checkmark.circle.fill")
                .foregroundColor(.green)
                .font(.body)
            
            Text(text)
                .font(.subheadline)
                .foregroundColor(.primary)
            
            Spacer()
        }
    }
}

#Preview {
    PermissionView(glassesManager: GlassesManager())
}
