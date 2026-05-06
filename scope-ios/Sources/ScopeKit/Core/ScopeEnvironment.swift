import Foundation

/// Runtime configuration for the Scope mobile client.
///
/// Values are resolved in this order:
/// 1. Explicit override passed to the initializer (used by previews/tests).
/// 2. `Info.plist` keys (`SCOPE_*_BASE_URL`, `SCOPE_MAPBOX_TOKEN`) — host app supplies.
/// 3. Process environment variables — useful for `swift test` and CI.
/// 4. Compiled-in defaults pointing at the local `docker compose` bundle.
public struct ScopeEnvironment: Sendable {
    public let coreBaseURL: URL
    public let contentBaseURL: URL
    public let intelBaseURL: URL
    public let mapboxAccessToken: String?
    public let mapStyleURL: URL

    public init(
        coreBaseURL: URL,
        contentBaseURL: URL,
        intelBaseURL: URL,
        mapboxAccessToken: String? = nil,
        mapStyleURL: URL = ScopeEnvironment.defaultMapStyleURL
    ) {
        self.coreBaseURL = coreBaseURL
        self.contentBaseURL = contentBaseURL
        self.intelBaseURL = intelBaseURL
        self.mapboxAccessToken = mapboxAccessToken
        self.mapStyleURL = mapStyleURL
    }

    public static let defaultMapStyleURL = URL(string: "https://demotiles.maplibre.org/style.json")!

    public static func resolve() -> ScopeEnvironment {
        let core = Self.string(forKey: "SCOPE_CORE_BASE_URL") ?? "http://localhost:5080"
        let content = Self.string(forKey: "SCOPE_CONTENT_BASE_URL") ?? "http://localhost:8000"
        let intel = Self.string(forKey: "SCOPE_INTEL_BASE_URL") ?? "http://localhost:5000"
        let token = Self.string(forKey: "SCOPE_MAPBOX_TOKEN")
        let style = Self.string(forKey: "SCOPE_MAP_STYLE_URL").flatMap(URL.init(string:)) ?? defaultMapStyleURL

        return ScopeEnvironment(
            coreBaseURL: URL(string: core)!,
            contentBaseURL: URL(string: content)!,
            intelBaseURL: URL(string: intel)!,
            mapboxAccessToken: token,
            mapStyleURL: style
        )
    }

    private static func string(forKey key: String) -> String? {
        if let plistValue = Bundle.main.object(forInfoDictionaryKey: key) as? String, !plistValue.isEmpty {
            return plistValue
        }
        if let envValue = ProcessInfo.processInfo.environment[key], !envValue.isEmpty {
            return envValue
        }
        return nil
    }
}
