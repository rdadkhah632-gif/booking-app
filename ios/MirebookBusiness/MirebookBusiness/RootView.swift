import SwiftUI

struct RootView: View {
    @Environment(AppState.self) private var appState
    @State private var selectedTab: AppTab = .today

    var body: some View {
        Group {
            switch appState.auth.state {
            case .signedIn:
                let tabs = AppTab.tabs(for: appState.mode)

                TabView(selection: $selectedTab) {
                    ForEach(tabs) { tab in
                        NavigationStack {
                            tab.destination
                                .navigationTitle(tab.titleKey)
                        }
                        .tabItem { tab.label }
                        .tag(tab)
                    }
                }
            case .loading:
                ProgressView("auth.restoring")
            case .signedOut, .failed:
                LoginView()
            }
        }
        .task {
            if let context = await appState.auth.restore() {
                appState.apply(context: context)
            }
        }
        .onChange(of: appState.mode) { _, newMode in
            let availableTabs = AppTab.tabs(for: newMode)
            if !availableTabs.contains(selectedTab) {
                selectedTab = .today
            }
        }
    }
}

private extension AppTab {
    var titleKey: LocalizedStringKey {
        switch self {
        case .today:
            "tab.today"
        case .calendar:
            "tab.calendar"
        case .inbox:
            "tab.inbox"
        case .setup:
            "tab.setup"
        case .availability:
            "tab.availability"
        case .account:
            "tab.account"
        }
    }
}
