#if canImport(SwiftUI)
import SwiftUI
import Observation

/// Top-level session holding the authenticated user, configured services,
/// and the active theme. Inject into the SwiftUI environment from your app's
/// entry point:
///
/// ```swift
/// @main
/// struct ScopeApp: App {
///     @State private var session = ScopeSession.live()
///     var body: some Scene {
///         WindowGroup { RootView().environment(session) }
///     }
/// }
/// ```
@Observable
public final class ScopeSession: @unchecked Sendable {
    public let environment: ScopeEnvironment
    public let core: CoreService
    public let content: ContentService
    public let intel: IntelService
    public let signalR: SignalRClient
    public private(set) var currentUser: ScopeUser?
    public var isAuthenticated: Bool { currentUser != nil }
    public private(set) var lastError: String?

    private let tokens: any TokenStoring

    public init(
        environment: ScopeEnvironment,
        tokens: any TokenStoring,
        core: CoreService,
        content: ContentService,
        intel: IntelService,
        signalR: SignalRClient
    ) {
        self.environment = environment
        self.tokens = tokens
        self.core = core
        self.content = content
        self.intel = intel
        self.signalR = signalR
    }

    public static func live() -> ScopeSession {
        let env = ScopeEnvironment.resolve()
        #if canImport(Security)
        let store: any TokenStoring = KeychainTokenStore()
        #else
        let store: any TokenStoring = InMemoryTokenStore()
        #endif

        let coreClient = APIClient(baseURL: env.coreBaseURL, tokens: store)
        let contentClient = APIClient(baseURL: env.contentBaseURL, tokens: store)
        let intelClient = APIClient(baseURL: env.intelBaseURL, tokens: store)
        let hub = env.coreBaseURL.appendingPathComponent("hubs/notifications")

        return ScopeSession(
            environment: env,
            tokens: store,
            core: CoreService(client: coreClient, tokens: store),
            content: ContentService(client: contentClient),
            intel: IntelService(client: intelClient),
            signalR: SignalRClient(hubURL: hub, tokens: store)
        )
    }

    @MainActor
    public func bootstrap() async {
        do {
            self.currentUser = try await core.me()
            try await signalR.connect()
        } catch APIError.unauthorized {
            await tokens.clear()
            self.currentUser = nil
        } catch {
            self.lastError = error.localizedDescription
        }
    }

    @MainActor
    public func signIn(email: String, password: String) async throws {
        let payload = try await core.login(email: email, password: password)
        self.currentUser = ScopeUser(
            id: payload.id,
            username: payload.username,
            displayName: payload.displayName ?? payload.username,
            email: payload.email
        )
        try? await signalR.connect()
    }

    @MainActor
    public func register(username: String, email: String, password: String, displayName: String) async throws {
        let payload = try await core.register(username: username, email: email, password: password, displayName: displayName)
        self.currentUser = ScopeUser(
            id: payload.id,
            username: payload.username,
            displayName: payload.displayName ?? payload.username,
            email: payload.email
        )
        try? await signalR.connect()
    }

    @MainActor
    public func signOut() async {
        try? await core.logout()
        await signalR.disconnect()
        self.currentUser = nil
    }
}
#endif
