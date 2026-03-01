import SwiftUI

struct ContentView: View {
    @ObservedObject var glassesManager: GlassesManager
    
    var body: some View {
        Group {
            if !glassesManager.isRegistered {
                OnboardingView(glassesManager: glassesManager)
            } else if !glassesManager.hasCameraPermission {
                PermissionView(glassesManager: glassesManager)
            } else {
                MainView(glassesManager: glassesManager)
            }
        }
        .animation(.easeInOut, value: glassesManager.isRegistered)
        .animation(.easeInOut, value: glassesManager.hasCameraPermission)
    }
}

#Preview {
    ContentView(glassesManager: GlassesManager())
}
