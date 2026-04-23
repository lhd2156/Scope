#if canImport(SwiftUI)
import SwiftUI

public struct AuthLandingView: View {
    @State private var route: Route = .landing

    public init() {}

    enum Route { case landing, login, register }

    public var body: some View {
        ZStack {
            LinearGradient(colors: [AtlasColor.bgPrimary, AtlasColor.bgSecondary], startPoint: .top, endPoint: .bottom)
                .ignoresSafeArea()

            switch route {
            case .landing:
                landing
            case .login:
                LoginView { route = .landing } onRegister: { route = .register }
            case .register:
                RegisterView { route = .landing } onLogin: { route = .login }
            }
        }
    }

    private var landing: some View {
        VStack(spacing: AtlasSpacing.xl) {
            Spacer()
            Text("ATLAS")
                .font(.system(size: 56, weight: .heavy, design: .rounded))
                .kerning(6)
                .foregroundStyle(LinearGradient(colors: [AtlasColor.accentTeal, AtlasColor.accentGold], startPoint: .leading, endPoint: .trailing))

            Text("Your adventures, mapped.")
                .font(AtlasTypography.h3())
                .foregroundStyle(AtlasColor.textSecondary)
                .multilineTextAlignment(.center)

            Spacer()

            GlassPanel {
                VStack(spacing: AtlasSpacing.md) {
                    AtlasButton("Sign In") { route = .login }
                    AtlasButton("Create account", style: .ghost) { route = .register }
                }
            }
            .padding(.horizontal, AtlasSpacing.xl)
            .padding(.bottom, AtlasSpacing.xl2)
        }
    }
}

public struct LoginView: View {
    @Environment(AtlasSession.self) private var session
    @State private var vm = AuthViewModel()
    let onBack: () -> Void
    let onRegister: () -> Void

    public init(onBack: @escaping () -> Void, onRegister: @escaping () -> Void) {
        self.onBack = onBack
        self.onRegister = onRegister
    }

    public var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: AtlasSpacing.xl) {
                Button(action: onBack) { Label("Back", systemImage: "chevron.left") }
                    .foregroundStyle(AtlasColor.textSecondary)

                Text("Welcome back")
                    .font(AtlasTypography.h1())
                    .foregroundStyle(AtlasColor.textPrimary)
                Text("Sign in to sync your spots, trips, and friends.")
                    .font(AtlasTypography.body())
                    .foregroundStyle(AtlasColor.textSecondary)

                VStack(spacing: AtlasSpacing.base) {
                    AtlasTextField("Email", placeholder: "you@example.com", text: Binding(get: { vm.email }, set: { vm.email = $0 }), keyboard: .email)
                    AtlasTextField("Password", placeholder: "••••••••", text: Binding(get: { vm.password }, set: { vm.password = $0 }), isSecure: true)
                }

                if let error = vm.error {
                    Text(error)
                        .font(AtlasTypography.small())
                        .foregroundStyle(AtlasColor.danger)
                }

                AtlasButton("Sign In", isLoading: vm.isLoading) {
                    Task { await vm.signIn(session: session) }
                }

                HStack {
                    Text("Need an account?").foregroundStyle(AtlasColor.textMuted)
                    Button("Create one", action: onRegister)
                        .foregroundStyle(AtlasColor.accentTeal)
                }
                .font(AtlasTypography.small())
                .frame(maxWidth: .infinity)
            }
            .padding(AtlasSpacing.xl)
        }
    }
}

public struct RegisterView: View {
    @Environment(AtlasSession.self) private var session
    @State private var vm = AuthViewModel()
    let onBack: () -> Void
    let onLogin: () -> Void

    public init(onBack: @escaping () -> Void, onLogin: @escaping () -> Void) {
        self.onBack = onBack
        self.onLogin = onLogin
    }

    public var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: AtlasSpacing.xl) {
                Button(action: onBack) { Label("Back", systemImage: "chevron.left") }
                    .foregroundStyle(AtlasColor.textSecondary)

                Text("Join Atlas")
                    .font(AtlasTypography.h1())
                    .foregroundStyle(AtlasColor.textPrimary)
                Text("Start dropping pins on your real-world adventures.")
                    .font(AtlasTypography.body())
                    .foregroundStyle(AtlasColor.textSecondary)

                VStack(spacing: AtlasSpacing.base) {
                    AtlasTextField("Display name", placeholder: "Louis Do", text: Binding(get: { vm.displayName }, set: { vm.displayName = $0 }))
                    AtlasTextField("Username", placeholder: "louisdo", text: Binding(get: { vm.username }, set: { vm.username = $0 }), keyboard: .username)
                    AtlasTextField("Email", placeholder: "you@example.com", text: Binding(get: { vm.email }, set: { vm.email = $0 }), keyboard: .email)
                    AtlasTextField("Password", placeholder: "••••••••", text: Binding(get: { vm.password }, set: { vm.password = $0 }), isSecure: true)
                }

                if let error = vm.error {
                    Text(error)
                        .font(AtlasTypography.small())
                        .foregroundStyle(AtlasColor.danger)
                }

                AtlasButton("Create account", isLoading: vm.isLoading) {
                    Task { await vm.register(session: session) }
                }

                HStack {
                    Text("Already on Atlas?").foregroundStyle(AtlasColor.textMuted)
                    Button("Sign in", action: onLogin)
                        .foregroundStyle(AtlasColor.accentTeal)
                }
                .font(AtlasTypography.small())
                .frame(maxWidth: .infinity)
            }
            .padding(AtlasSpacing.xl)
        }
    }
}
#endif
