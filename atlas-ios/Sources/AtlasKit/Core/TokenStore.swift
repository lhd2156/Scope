import Foundation

/// Persists JWT access + refresh tokens. Defaults to the Keychain on Apple
/// platforms, but supports an in-memory override for previews and tests.
public protocol TokenStoring: Sendable {
    func load() async -> AtlasTokens?
    func save(_ tokens: AtlasTokens) async
    func clear() async
}

public struct AtlasTokens: Codable, Equatable, Sendable {
    public let accessToken: String
    public let refreshToken: String
    public let expiresAt: Date?

    public init(accessToken: String, refreshToken: String, expiresAt: Date? = nil) {
        self.accessToken = accessToken
        self.refreshToken = refreshToken
        self.expiresAt = expiresAt
    }

    public var isExpired: Bool {
        guard let expiresAt else { return false }
        return Date() >= expiresAt.addingTimeInterval(-30)
    }
}

public actor InMemoryTokenStore: TokenStoring {
    private var tokens: AtlasTokens?

    public init(initial: AtlasTokens? = nil) {
        self.tokens = initial
    }

    public func load() async -> AtlasTokens? { tokens }
    public func save(_ tokens: AtlasTokens) async { self.tokens = tokens }
    public func clear() async { self.tokens = nil }
}

#if canImport(Security)
import Security

public actor KeychainTokenStore: TokenStoring {
    private let service: String
    private let account: String

    public init(service: String = "com.atlas.mobile", account: String = "auth.tokens") {
        self.service = service
        self.account = account
    }

    public func load() async -> AtlasTokens? {
        let query: [CFString: Any] = [
            kSecClass: kSecClassGenericPassword,
            kSecAttrService: service,
            kSecAttrAccount: account,
            kSecReturnData: true,
            kSecMatchLimit: kSecMatchLimitOne
        ]
        var item: CFTypeRef?
        let status = SecItemCopyMatching(query as CFDictionary, &item)
        guard status == errSecSuccess, let data = item as? Data else { return nil }
        return try? JSONDecoder().decode(AtlasTokens.self, from: data)
    }

    public func save(_ tokens: AtlasTokens) async {
        guard let data = try? JSONEncoder().encode(tokens) else { return }
        let query: [CFString: Any] = [
            kSecClass: kSecClassGenericPassword,
            kSecAttrService: service,
            kSecAttrAccount: account
        ]
        let attrs: [CFString: Any] = [kSecValueData: data]
        let update = SecItemUpdate(query as CFDictionary, attrs as CFDictionary)
        if update == errSecItemNotFound {
            var insert = query
            insert[kSecValueData] = data
            SecItemAdd(insert as CFDictionary, nil)
        }
    }

    public func clear() async {
        let query: [CFString: Any] = [
            kSecClass: kSecClassGenericPassword,
            kSecAttrService: service,
            kSecAttrAccount: account
        ]
        SecItemDelete(query as CFDictionary)
    }
}
#endif
