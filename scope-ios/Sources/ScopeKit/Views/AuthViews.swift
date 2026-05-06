#if canImport(SwiftUI)
import SwiftUI

public struct AuthLandingView: View {
    @State private var route: Route = .landing

    public init() {}

    enum Route { case landing, login, register }

    public var body: some View {
        ZStack {
            LinearGradient(colors: [ScopeColor.bgPrimary, ScopeColor.bgSecondary], startPoint: .top, endPoint: .bottom)
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
        VStack(spacing: ScopeSpacing.xl) {
            Spacer()
            Text("SCOPE")
                .font(.system(size: 56, weight: .heavy, design: .rounded))
                .kerning(6)
                .foregroundStyle(LinearGradient(colors: [ScopeColor.accentTeal, ScopeColor.accentGold], startPoint: .leading, endPoint: .trailing))

            Text("Your adventures, mapped.")
                .font(ScopeTypography.h3())
                .foregroundStyle(ScopeColor.textSecondary)
                .multilineTextAlignment(.center)

            Spacer()

            GlassPanel {
                VStack(spacing: ScopeSpacing.md) {
                    ScopeButton("Sign In") { route = .login }
                    ScopeButton("Create account", style: .ghost) { route = .register }
                }
            }
            .padding(.horizontal, ScopeSpacing.xl)
            .padding(.bottom, ScopeSpacing.xl2)
        }
    }
}

public struct LoginView: View {
    @Environment(ScopeSession.self) private var session
    @State private var vm = AuthViewModel()
    let onBack: () -> Void
    let onRegister: () -> Void

    public init(onBack: @escaping () -> Void, onRegister: @escaping () -> Void) {
        self.onBack = onBack
        self.onRegister = onRegister
    }

    public var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: ScopeSpacing.xl) {
                Button(action: onBack) { Label("Back", systemImage: "chevron.left") }
                    .foregroundStyle(ScopeColor.textSecondary)

                Text("Welcome back")
                    .font(ScopeTypography.h1())
                    .foregroundStyle(ScopeColor.textPrimary)
                Text("Sign in to sync your spots, trips, and friends.")
                    .font(ScopeTypography.body())
                    .foregroundStyle(ScopeColor.textSecondary)

                VStack(spacing: ScopeSpacing.base) {
                    ScopeTextField("Email", placeholder: "you@example.com", text: Binding(get: { vm.email }, set: { vm.email = $0 }), keyboard: .email)
                    ScopeTextField("Password", placeholder: "••••••••", text: Binding(get: { vm.password }, set: { vm.password = $0 }), isSecure: true)
                }

                if let error = vm.error {
                    Text(error)
                        .font(ScopeTypography.small())
                        .foregroundStyle(ScopeColor.danger)
                }

                ScopeButton("Sign In", isLoading: vm.isLoading) {
                    Task { await vm.signIn(session: session) }
                }

                HStack {
                    Text("Need an account?").foregroundStyle(ScopeColor.textMuted)
                    Button("Create one", action: onRegister)
                        .foregroundStyle(ScopeColor.accentTeal)
                }
                .font(ScopeTypography.small())
                .frame(maxWidth: .infinity)
            }
            .padding(ScopeSpacing.xl)
        }
    }
}

public struct RegisterView: View {
    @Environment(ScopeSession.self) private var session
    @State private var vm = AuthViewModel()
    let onBack: () -> Void
    let onLogin: () -> Void

    public init(onBack: @escaping () -> Void, onLogin: @escaping () -> Void) {
        self.onBack = onBack
        self.onLogin = onLogin
    }

    public var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: ScopeSpacing.xl) {
                Button(action: onBack) { Label("Back", systemImage: "chevron.left") }
                    .foregroundStyle(ScopeColor.textSecondary)

                Text("Join Scope")
                    .font(ScopeTypography.h1())
                    .foregroundStyle(ScopeColor.textPrimary)
                Text("Start dropping pins on your real-world adventures.")
                    .font(ScopeTypography.body())
                    .foregroundStyle(ScopeColor.textSecondary)

                VStack(spacing: ScopeSpacing.base) {
                    ScopeTextField("Display name", placeholder: "Louis Do", text: Binding(get: { vm.displayName }, set: { vm.displayName = $0 }))
                    ScopeTextField("Username", placeholder: "louisdo", text: Binding(get: { vm.username }, set: { vm.username = $0 }), keyboard: .username)
                    ScopeTextField("Email", placeholder: "you@example.com", text: Binding(get: { vm.email }, set: { vm.email = $0 }), keyboard: .email)
                    ScopeTextField("Password", placeholder: "••••••••", text: Binding(get: { vm.password }, set: { vm.password = $0 }), isSecure: true)
                }

                if let error = vm.error {
                    Text(error)
                        .font(ScopeTypography.small())
                        .foregroundStyle(ScopeColor.danger)
                }

                ScopeButton("Create account", isLoading: vm.isLoading) {
                    Task { await vm.register(session: session) }
                }

                HStack {
                    Text("Already on Scope?").foregroundStyle(ScopeColor.textMuted)
                    Button("Sign in", action: onLogin)
                        .foregroundStyle(ScopeColor.accentTeal)
                }
                .font(ScopeTypography.small())
                .frame(maxWidth: .infinity)
            }
            .padding(ScopeSpacing.xl)
        }
    }
}
#endif
