#if canImport(SwiftUI)
import SwiftUI

public struct AtlasButton: View {
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
                    .font(AtlasTypography.body().weight(.semibold))
                    .opacity(isLoading ? 0 : 1)
                if isLoading { ProgressView().tint(foreground) }
            }
            .foregroundStyle(foreground)
            .padding(.vertical, AtlasSpacing.md)
            .padding(.horizontal, AtlasSpacing.lg)
            .frame(maxWidth: .infinity)
            .background(background)
            .clipShape(RoundedRectangle(cornerRadius: AtlasRadius.lg, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: AtlasRadius.lg, style: .continuous)
                    .strokeBorder(border, lineWidth: style == .ghost ? 1 : 0)
            )
        }
        .buttonStyle(.plain)
        .disabled(isLoading)
    }

    private var foreground: Color {
        switch style {
        case .primary: return Color(hex: "#0b1020")
        case .secondary: return AtlasColor.textPrimary
        case .ghost: return AtlasColor.accentTeal
        }
    }

    private var background: some View {
        switch style {
        case .primary: return AnyView(LinearGradient(colors: [AtlasColor.accentTeal, AtlasColor.accentTealHover], startPoint: .topLeading, endPoint: .bottomTrailing))
        case .secondary: return AnyView(AtlasColor.bgElevated)
        case .ghost: return AnyView(Color.clear)
        }
    }

    private var border: Color {
        style == .ghost ? AtlasColor.accentTeal : .clear
    }
}

public struct AtlasTextField: View {
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
        VStack(alignment: .leading, spacing: AtlasSpacing.sm) {
            Text(title.uppercased())
                .font(AtlasTypography.eyebrow())
                .tracking(1.5)
                .foregroundStyle(AtlasColor.textMuted)

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
            .font(AtlasTypography.body())
            .foregroundStyle(AtlasColor.textPrimary)
            .padding(.vertical, AtlasSpacing.md)
            .padding(.horizontal, AtlasSpacing.base)
            .background(AtlasColor.bgSecondary)
            .clipShape(RoundedRectangle(cornerRadius: AtlasRadius.md, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: AtlasRadius.md, style: .continuous)
                    .strokeBorder(AtlasColor.border, lineWidth: 1)
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
        let palette = AtlasColor.badge(for: category)
        Text(category.rawValue.capitalized)
            .font(AtlasTypography.caption())
            .padding(.horizontal, AtlasSpacing.md)
            .padding(.vertical, AtlasSpacing.xs)
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
            .padding(AtlasSpacing.xl)
            .background(AtlasColor.glassBg)
            .clipShape(RoundedRectangle(cornerRadius: AtlasRadius.xl2, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: AtlasRadius.xl2, style: .continuous)
                    .strokeBorder(AtlasColor.glassBorder, lineWidth: 1)
            )
            .shadow(color: .black.opacity(0.25), radius: 24, y: 8)
    }
}

public struct AtlasIcon: View {
    public let systemName: String
    public let tint: Color
    public init(_ systemName: String, tint: Color = AtlasColor.accentTeal) {
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
