import Foundation

struct AppConfig {
    let appBaseURL: URL
    let supabaseURL: URL?
    let supabaseAnonKey: String

    static let current = AppConfig(bundle: .main)

    init(bundle: Bundle) {
        let appBaseURLString = Self.normalizedConfigValue(
            bundle.object(forInfoDictionaryKey: "MIREBOOK_API_BASE_URL") as? String
        )
        appBaseURL = URL(string: appBaseURLString) ?? URL(string: "http://localhost:3000")!

        let supabaseURLString = Self.normalizedConfigValue(
            bundle.object(forInfoDictionaryKey: "MIREBOOK_SUPABASE_URL") as? String
        )
        supabaseURL = URL(string: supabaseURLString)
        supabaseAnonKey = Self.normalizedConfigValue(
            bundle.object(forInfoDictionaryKey: "MIREBOOK_SUPABASE_ANON_KEY") as? String
        )
    }

    var isSupabaseConfigured: Bool {
        supabaseURL != nil && !supabaseAnonKey.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    private static func normalizedConfigValue(_ rawValue: String?) -> String {
        (rawValue ?? "")
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .replacingOccurrences(of: ":\\/\\/", with: "://")
            .replacingOccurrences(of: ":/$()/", with: "://")
    }
}
