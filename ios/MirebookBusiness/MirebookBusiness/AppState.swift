import Foundation
import Observation

@MainActor
@Observable
final class AppState {
    var mode: AppMode
    var session: AppSessionContext
    let config: AppConfig
    let apiClient: AppAPIClient
    let auth: AuthSessionStore

    init(mode: AppMode, session: AppSessionContext, config: AppConfig, apiClient: AppAPIClient, auth: AuthSessionStore) {
        self.mode = mode
        self.session = session
        self.config = config
        self.apiClient = apiClient
        self.auth = auth
    }

    static func live(config: AppConfig = .current) -> AppState {
        let apiClient = AppAPIClient(baseURL: config.appBaseURL)
        let auth = AuthSessionStore(
            authClient: SupabaseAuthClient(config: config),
            apiClient: apiClient
        )

        return AppState(
            mode: .business,
            session: .fixture,
            config: config,
            apiClient: apiClient,
            auth: auth
        )
    }

    static func preview() -> AppState {
        live()
    }

    var resetPasswordURL: URL {
        businessAuthURL(path: "/forgot-password", queryItems: [
            URLQueryItem(name: "product", value: "business")
        ])
    }

    func apply(context: AppSessionContext) {
        session = context
        mode = context.preferredMode
    }

    func signOut() {
        auth.signOut()
        session = .fixture
        mode = .business
    }

    private func businessAuthURL(path: String, queryItems: [URLQueryItem]) -> URL {
        var components = URLComponents(url: config.appBaseURL.appending(path: path), resolvingAgainstBaseURL: false)
        components?.queryItems = queryItems
        return components?.url ?? config.appBaseURL.appending(path: path)
    }
}

enum AppMode: String, CaseIterable, Identifiable {
    case business
    case staff

    var id: String { rawValue }
}
