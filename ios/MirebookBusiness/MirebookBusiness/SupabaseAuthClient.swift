import Foundation

struct SupabaseAuthClient {
    let config: AppConfig
    private let urlSession: URLSession
    private let decoder: JSONDecoder

    init(config: AppConfig, urlSession: URLSession = .shared) {
        self.config = config
        self.urlSession = urlSession
        decoder = JSONDecoder()
        decoder.keyDecodingStrategy = .convertFromSnakeCase
    }

    func signIn(email: String, password: String) async throws -> AuthToken {
        try await tokenRequest(
            grantType: "password",
            body: ["email": email, "password": password]
        )
    }

    func refreshSession(refreshToken: String) async throws -> AuthToken {
        try await tokenRequest(
            grantType: "refresh_token",
            body: ["refresh_token": refreshToken]
        )
    }

    private func tokenRequest(grantType: String, body: [String: String]) async throws -> AuthToken {
        guard config.isSupabaseConfigured, let supabaseURL = config.supabaseURL else {
            throw AuthClientError.missingConfiguration
        }

        var components = URLComponents(url: supabaseURL.appending(path: "/auth/v1/token"), resolvingAgainstBaseURL: false)
        components?.queryItems = [URLQueryItem(name: "grant_type", value: grantType)]

        guard let url = components?.url else {
            throw AuthClientError.invalidConfiguration
        }

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue(config.supabaseAnonKey, forHTTPHeaderField: "apikey")
        request.setValue("Bearer \(config.supabaseAnonKey)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONEncoder().encode(body)

        let (data, response) = try await urlSession.data(for: request)
        try validate(response: response, data: data)

        let token = try decoder.decode(SupabaseTokenResponse.self, from: data)
        return AuthToken(
            accessToken: token.accessToken,
            refreshToken: token.refreshToken,
            expiresAt: Date().addingTimeInterval(TimeInterval(token.expiresIn))
        )
    }

    private func validate(response: URLResponse, data: Data) throws {
        guard let httpResponse = response as? HTTPURLResponse else {
            throw AuthClientError.invalidResponse
        }

        guard (200..<300).contains(httpResponse.statusCode) else {
            let error = try? decoder.decode(SupabaseAuthError.self, from: data)
            throw AuthClientError.requestFailed(error?.message ?? String(localized: "auth.error.signInFailed"))
        }
    }
}

private struct SupabaseTokenResponse: Decodable {
    let accessToken: String
    let refreshToken: String
    let expiresIn: Int
}

private struct SupabaseAuthError: Decodable {
    let message: String?
}

enum AuthClientError: LocalizedError {
    case missingConfiguration
    case invalidConfiguration
    case invalidResponse
    case unsupportedAccount
    case requestFailed(String)

    var errorDescription: String? {
        switch self {
        case .missingConfiguration:
            String(localized: "auth.error.missingConfiguration")
        case .invalidConfiguration:
            String(localized: "auth.error.invalidConfiguration")
        case .invalidResponse:
            String(localized: "auth.error.invalidResponse")
        case .unsupportedAccount:
            String(localized: "auth.error.unsupportedAccount")
        case .requestFailed(let message):
            message
        }
    }
}
