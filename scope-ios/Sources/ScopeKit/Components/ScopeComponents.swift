#if canImport(SwiftUI)
import SwiftUI

public struct ScopeButton: View {
    public enum Style { case primary, secondary, ghost }

    private let title: String
    private let style: Style
    private let isLoading: Bool
    private let action: () -> Void

    public init(_ title: String, style: Style = .primary, isLoading: Bool = false, action: @escaping () -> Void) {
        self.title = title
        self.style = style
        self.isLoading = isLoading
        self.action = action
    }

    public var body: some View {
        Button(action: action) {
            ZStack {
                Text(title)
                    .font(ScopeTypography.body().weight(.semibold))
                    .opacity(isLoading ? 0 : 1)
                if isLoading { ProgressView().tint(foreground) }
            }
            .foregroundStyle(foreground)
            .padding(.vertical, ScopeSpacing.md)
            .padding(.horizontal, ScopeSpacing.lg)
            .frame(maxWidth: .infinity)
            .background(background)
            .clipShape(RoundedRectangle(cornerRadius: ScopeRadius.lg, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: ScopeRadius.lg, style: .continuous)
                    .strokeBorder(border, lineWidth: style == .ghost ? 1 : 0)
            )
        }
        .buttonStyle(.plain)
        .disabled(isLoading)
    }

    private var foreground: Color {
        switch style {
        case .primary: return Color(hex: "#0b1020")
        case .secondary: return ScopeColor.textPrimary
        case .ghost: return ScopeColor.accentTeal
        }
    }

    private var background: some View {
        switch style {
        case .primary: return AnyView(LinearGradient(colors: [ScopeColor.accentTeal, ScopeColor.accentTealHover], startPoint: .topLeading, endPoint: .bottomTrailing))
        case .secondary: return AnyView(ScopeColor.bgElevated)
        case .ghost: return AnyView(Color.clear)
        }
    }

    private var border: Color {
        style == .ghost ? ScopeColor.accentTeal : .clear
    }
}

public struct ScopeTextField: View {
    private let title: String
    private let placeholder: String
    @Binding private var text: String
    private let isSecure: Bool
    private let keyboard: Keyboard

    public enum Keyboard { case `default`, email, username, number }

    public init(_ title: String, placeholder: String = "", text: Binding<String>, isSecure: Bool = false, keyboard: Keyboard = .default) {
        self.title = title
        self.placeholder = placeholder
        self._text = text
        self.isSecure = isSecure
        self.keyboard = keyboard
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: ScopeSpacing.sm) {
            Text(title.uppercased())
                .font(ScopeTypography.eyebrow())
                .tracking(1.5)
                .foregroundStyle(ScopeColor.textMuted)

            Group {
                if isSecure {
                    SecureField(placeholder, text: $text)
                } else {
                    TextField(placeholder, text: $text)
                        #if canImport(UIKit)
                        .keyboardType(keyboardType)
                        .textInputAutocapitalization(keyboard == .email || keyboard == .username ? .never : .sentences)
                        .autocorrectionDisabled(keyboard == .email || keyboard == .username)
                        #endif
                }
            }
            .font(ScopeTypography.body())
            .foregroundStyle(ScopeColor.textPrimary)
            .padding(.vertical, ScopeSpacing.md)
            .padding(.horizontal, ScopeSpacing.base)
            .background(ScopeColor.bgSecondary)
            .clipShape(RoundedRectangle(cornerRadius: ScopeRadius.md, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: ScopeRadius.md, style: .continuous)
                    .strokeBorder(ScopeColor.border, lineWidth: 1)
            )
        }
    }

    #if canImport(UIKit)
    private var keyboardType: UIKeyboardType {
        switch keyboard {
        case .email: return .emailAddress
        case .number: return .decimalPad
        case .username, .default: return .default
        }
    }
    #endif
}

public struct CategoryBadge: View {
    public let category: SpotCategory

    public init(category: SpotCategory) { self.category = category }

    public var body: some View {
        let palette = ScopeColor.badge(for: category)
        Text(category.rawValue.capitalized)
            .font(ScopeTypography.caption())
            .padding(.horizontal, ScopeSpacing.md)
            .padding(.vertical, ScopeSpacing.xs)
            .background(palette.background)
            .foregroundStyle(palette.foreground)
            .clipShape(Capsule())
    }
}

public struct GlassPanel<Content: View>: View {
    private let content: () -> Content
    public init(@ViewBuilder _ content: @escaping () -> Content) { self.content = content }

    public var body: some View {
        content()
            .padding(ScopeSpacing.xl)
            .background(ScopeColor.glassBg)
            .clipShape(RoundedRectangle(cornerRadius: ScopeRadius.xl2, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: ScopeRadius.xl2, style: .continuous)
                    .strokeBorder(ScopeColor.glassBorder, lineWidth: 1)
            )
            .shadow(color: .black.opacity(0.25), radius: 24, y: 8)
    }
}

public struct ScopeIcon: View {
    public let systemName: String
    public let tint: Color
    public init(_ systemName: String, tint: Color = ScopeColor.accentTeal) {
        self.systemName = systemName
        self.tint = tint
    }
    public var body: some View {
        Image(systemName: systemName)
            .font(.system(size: 16, weight: .semibold))
            .foregroundStyle(tint)
    }
}
#endif
