import SwiftUI

@main
struct MirebookBusinessApp: App {
    @State private var appState = AppState.live()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(appState)
        }
    }
}
