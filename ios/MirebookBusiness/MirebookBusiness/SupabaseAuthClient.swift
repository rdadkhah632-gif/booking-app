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

    func signUp(input: NativeSignUpInput) async throws -> NativeSignUpResponse {
        guard config.isSupabaseConfigured, let supabaseURL = config.supabaseURL else {
            throw AuthClientError.missingConfiguration
        }

        var components = URLComponents(url: supabaseURL.appending(path: "/auth/v1/signup"), resolvingAgainstBaseURL: false)
        components?.queryItems = [
            URLQueryItem(name: "redirect_to", value: config.appBaseURL.appending(path: "/login").absoluteString)
        ]

        guard let url = components?.url else {
            throw AuthClientError.invalidConfiguration
        }

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue(config.supabaseAnonKey, forHTTPHeaderField: "apikey")
        request.setValue("Bearer \(config.supabaseAnonKey)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONEncoder().encode(input.supabasePayload)

        let (data, response) = try await urlSession.data(for: request)
        try validate(response: response, data: data)

        let signUp = try decoder.decode(SupabaseSignUpResponse.self, from: data)
        return NativeSignUpResponse(token: signUp.authToken)
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

private struct SupabaseSignUpResponse: Decodable {
    let accessToken: String?
    let refreshToken: String?
    let expiresIn: Int?
    let session: SupabaseTokenResponse?

    var authToken: AuthToken? {
        if let session {
            return AuthToken(
                accessToken: session.accessToken,
                refreshToken: session.refreshToken,
                expiresAt: Date().addingTimeInterval(TimeInterval(session.expiresIn))
            )
        }

        guard let accessToken, let refreshToken else {
            return nil
        }

        return AuthToken(
            accessToken: accessToken,
            refreshToken: refreshToken,
            expiresAt: Date().addingTimeInterval(TimeInterval(expiresIn ?? 3600))
        )
    }
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

struct NativeSignUpInput {
    enum Role: String {
        case business
        case staff
    }

    struct PendingBusiness {
        let name: String
        let phone: String
        let category: String
        let city: String
        let country: String
        let timezone: String
        let currency: String
        let ownerTakesBookings: Bool
    }

    let role: Role
    let email: String
    let password: String
    let fullName: String
    let phone: String
    let preferredLanguage: String
    let pendingBusiness: PendingBusiness?

    var supabasePayload: SupabaseSignUpPayload {
        SupabaseSignUpPayload(
            email: email,
            password: password,
            data: SupabaseSignUpMetadata(
                role: role == .staff ? "customer" : role.rawValue,
                accountMode: role.rawValue,
                fullName: fullName.isEmpty ? nil : fullName,
                phone: phone.isEmpty ? nil : phone,
                preferredLanguage: preferredLanguage == "sq" ? "sq" : "en",
                pendingBusiness: pendingBusiness.map {
                    SupabasePendingBusiness(
                        name: $0.name,
                        phone: $0.phone,
                        category: $0.category,
                        city: $0.city,
                        country: $0.country,
                        timezone: $0.timezone,
                        currency: $0.currency,
                        ownerTakesBookings: $0.ownerTakesBookings
                    )
                }
            )
        )
    }
}

struct NativeSignUpResponse {
    let token: AuthToken?
}

struct SupabaseSignUpPayload: Encodable {
    let email: String
    let password: String
    let data: SupabaseSignUpMetadata
}

struct SupabaseSignUpMetadata: Encodable {
    let role: String
    let accountMode: String
    let fullName: String?
    let phone: String?
    let preferredLanguage: String
    let pendingRegistration = true
    let pendingBusiness: SupabasePendingBusiness?

    enum CodingKeys: String, CodingKey {
        case role
        case accountMode = "account_mode"
        case fullName = "full_name"
        case phone
        case preferredLanguage = "preferred_language"
        case pendingRegistration = "pending_registration"
        case pendingBusiness = "pending_business"
    }
}

struct SupabasePendingBusiness: Encodable {
    let name: String
    let phone: String
    let category: String
    let city: String
    let country: String
    let timezone: String
    let currency: String
    let ownerTakesBookings: Bool
}
