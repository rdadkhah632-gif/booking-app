import Foundation
import Observation
import Security

@MainActor
@Observable
final class AuthSessionStore {
    enum State: Equatable {
        case signedOut
        case loading
        case signedIn(AuthSession)
        case failed(String)
    }

    var state: State = .signedOut

    private let authClient: SupabaseAuthClient
    private let apiClient: AppAPIClient
    private let tokenStore: TokenStore

    init(authClient: SupabaseAuthClient, apiClient: AppAPIClient, tokenStore: TokenStore = KeychainTokenStore()) {
        self.authClient = authClient
        self.apiClient = apiClient
        self.tokenStore = tokenStore
    }

    func restore() async -> AppSessionContext? {
        guard let token = tokenStore.load() else {
            state = .signedOut
            return nil
        }

        state = .loading

        do {
            let refreshedToken = try await authClient.refreshSession(refreshToken: token.refreshToken)
            try await apiClient.completeRegistration(accessToken: refreshedToken.accessToken, allowMissingEndpoint: true)
            let context = try await apiClient.loadSessionContext(accessToken: refreshedToken.accessToken)
            guard context.canUseOperationsApp else {
                throw AuthClientError.unsupportedAccount
            }
            tokenStore.save(refreshedToken)
            state = .signedIn(AuthSession(token: refreshedToken, context: context))
            return context
        } catch {
            tokenStore.clear()
            state = .signedOut
            return nil
        }
    }

    func signIn(email: String, password: String) async -> AppSessionContext? {
        let cleanEmail = email.trimmingCharacters(in: .whitespacesAndNewlines)

        guard !cleanEmail.isEmpty, !password.isEmpty else {
            state = .failed(String(localized: "auth.error.required"))
            return nil
        }

        state = .loading

        do {
            let token = try await authClient.signIn(email: cleanEmail, password: password)
            try await apiClient.completeRegistration(accessToken: token.accessToken, allowMissingEndpoint: true)
            let context = try await apiClient.loadSessionContext(accessToken: token.accessToken)
            guard context.canUseOperationsApp else {
                throw AuthClientError.unsupportedAccount
            }
            tokenStore.save(token)
            state = .signedIn(AuthSession(token: token, context: context))
            return context
        } catch {
            state = .failed(error.localizedDescription)
            return nil
        }
    }

    func signUp(input: NativeSignUpInput) async throws -> NativeSignUpResult {
        let result = try await authClient.signUp(input: input)

        guard let token = result.token else {
            return .verificationRequired
        }

        try await apiClient.completeRegistration(accessToken: token.accessToken)
        let context = try await apiClient.loadSessionContext(accessToken: token.accessToken)
        guard context.canUseOperationsApp else {
            throw AuthClientError.unsupportedAccount
        }

        tokenStore.save(token)
        state = .signedIn(AuthSession(token: token, context: context))
        return .signedIn(context)
    }

    func signOut() {
        tokenStore.clear()
        state = .signedOut
    }

    var accessToken: String? {
        if case .signedIn(let session) = state {
            return session.token.accessToken
        }

        return nil
    }
}

enum NativeSignUpResult {
    case signedIn(AppSessionContext)
    case verificationRequired
}

struct AuthSession: Equatable {
    let token: AuthToken
    let context: AppSessionContext
}

struct AuthToken: Codable, Equatable {
    let accessToken: String
    let refreshToken: String
    let expiresAt: Date
}

protocol TokenStore {
    func load() -> AuthToken?
    func save(_ token: AuthToken)
    func clear()
}

struct KeychainTokenStore: TokenStore {
    private let service = "com.mirebook.business.auth"
    private let account = "supabase-session"
    #if DEBUG
    private let debugDefaultsKey = "com.mirebook.business.debug.supabase-session"
    #endif

    func load() -> AuthToken? {
        var query = baseQuery
        query[kSecMatchLimit as String] = kSecMatchLimitOne
        query[kSecReturnData as String] = true

        var result: CFTypeRef?
        let status = SecItemCopyMatching(query as CFDictionary, &result)

        if status == errSecSuccess, let data = result as? Data {
            return try? JSONDecoder().decode(AuthToken.self, from: data)
        }

        #if DEBUG
        guard let data = UserDefaults.standard.data(forKey: debugDefaultsKey) else {
            return nil
        }
        return try? JSONDecoder().decode(AuthToken.self, from: data)
        #else
        return nil
        #endif
    }

    func save(_ token: AuthToken) {
        clear()

        guard let data = try? JSONEncoder().encode(token) else {
            return
        }

        var item = baseQuery
        item[kSecValueData as String] = data
        item[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
        let status = SecItemAdd(item as CFDictionary, nil)

        #if DEBUG
        if status != errSecSuccess {
            UserDefaults.standard.set(data, forKey: debugDefaultsKey)
        }
        #endif
    }

    func clear() {
        SecItemDelete(baseQuery as CFDictionary)
        #if DEBUG
        UserDefaults.standard.removeObject(forKey: debugDefaultsKey)
        #endif
    }

    private var baseQuery: [String: Any] {
        [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account
        ]
    }
}
