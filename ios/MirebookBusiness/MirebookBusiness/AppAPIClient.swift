import Foundation

struct AppAPIClient {
    let baseURL: URL
    private let urlSession: URLSession = .shared
    private let decoder: JSONDecoder = {
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .custom { decoder in
            let container = try decoder.singleValueContainer()
            let value = try container.decode(String.self)

            if let date = DateFormatters.iso8601WithFractionalSeconds.date(from: value) {
                return date
            }

            if let date = DateFormatters.iso8601.date(from: value) {
                return date
            }

            throw DecodingError.dataCorruptedError(
                in: container,
                debugDescription: "Invalid ISO8601 date: \(value)"
            )
        }
        return decoder
    }()

    enum Endpoint: String, CaseIterable {
        case sessionContext = "/api/app/session-context"
        case calendar = "/api/app/calendar"
        case inbox = "/api/app/inbox"
        case ownerToday = "/api/app/today"
        case appointmentActions = "/api/app/appointments/actions"
        case staffAvailability = "/api/app/staff-availability"
    }

    func url(for endpoint: Endpoint) -> URL {
        baseURL.appending(path: endpoint.rawValue)
    }

    func loadSessionContext(accessToken: String) async throws -> AppSessionContext {
        try await get(.sessionContext, accessToken: accessToken)
    }

    func loadCalendar(accessToken: String, mode: AppMode, from: Date, to: Date) async throws -> [Appointment] {
        var components = URLComponents(url: url(for: .calendar), resolvingAgainstBaseURL: false)
        components?.queryItems = [
            URLQueryItem(name: "scope", value: mode == .business ? "business" : "staff"),
            URLQueryItem(name: "from", value: ISO8601DateFormatter().string(from: from)),
            URLQueryItem(name: "to", value: ISO8601DateFormatter().string(from: to))
        ]

        guard let url = components?.url else {
            throw AppAPIClientError.invalidURL
        }

        let response: CalendarResponse = try await get(url: url, accessToken: accessToken)
        return response.appointments
    }

    func loadInbox(accessToken: String, mode: AppMode) async throws -> [InboxItem] {
        var components = URLComponents(url: url(for: .inbox), resolvingAgainstBaseURL: false)
        components?.queryItems = [
            URLQueryItem(name: "scope", value: mode == .business ? "business" : "staff")
        ]

        guard let url = components?.url else {
            throw AppAPIClientError.invalidURL
        }

        let response: InboxResponse = try await get(url: url, accessToken: accessToken)
        return response.needsAction + response.updates
    }

    private func get<Response: Decodable>(_ endpoint: Endpoint, accessToken: String) async throws -> Response {
        try await get(url: url(for: endpoint), accessToken: accessToken)
    }

    private func get<Response: Decodable>(url: URL, accessToken: String) async throws -> Response {
        var request = URLRequest(url: url)
        request.setValue("Bearer \(accessToken)", forHTTPHeaderField: "Authorization")

        let (data, response) = try await urlSession.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse else {
            throw AppAPIClientError.invalidResponse
        }

        guard (200..<300).contains(httpResponse.statusCode) else {
            let error = try? decoder.decode(AppAPIErrorResponse.self, from: data)
            throw AppAPIClientError.requestFailed(error?.error ?? String(localized: "api.error.requestFailed"))
        }

        return try decoder.decode(Response.self, from: data)
    }
}

enum AppAPIClientError: LocalizedError {
    case liveAuthNotConnected
    case invalidURL
    case invalidResponse
    case requestFailed(String)

    var errorDescription: String? {
        switch self {
        case .liveAuthNotConnected:
            String(localized: "api.error.authNotConnected")
        case .invalidURL:
            String(localized: "api.error.invalidURL")
        case .invalidResponse:
            String(localized: "api.error.invalidResponse")
        case .requestFailed(let message):
            message
        }
    }
}

private struct AppAPIErrorResponse: Decodable {
    let error: String?
}

private struct CalendarResponse: Decodable {
    let appointments: [Appointment]
}

private struct InboxResponse: Decodable {
    let needsAction: [InboxItem]
    let updates: [InboxItem]
}

private enum DateFormatters {
    static let iso8601WithFractionalSeconds: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter
    }()

    static let iso8601 = ISO8601DateFormatter()
}
