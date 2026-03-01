import SwiftUI
import MWDATCore

@main
struct FiguralApp: App {
    @StateObject private var glassesManager = GlassesManager()
    
    var body: some Scene {
        WindowGroup {
            ContentView(glassesManager: glassesManager)
                .onOpenURL { url in
                    handleIncomingURL(url)
                }
        }
    }
    
    private func handleIncomingURL(_ url: URL) {
        Task {
            await glassesManager.handleCallback(url: url)
        }
    }
}
