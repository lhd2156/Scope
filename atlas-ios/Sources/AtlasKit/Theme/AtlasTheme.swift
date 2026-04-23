#if canImport(SwiftUI)
import SwiftUI

/// Atlas design tokens mirrored from `atlas-assets/design-tokens.css`. Keep
/// the palette in sync with the web client so every platform feels like Atlas.
public enum AtlasColor {
    // Palette — dark mode defaults with light-mode fallbacks.
    public static let bgPrimary = adaptive(dark: "#0f0f1a", light: "#fafafa")
    public static let bgSecondary = adaptive(dark: "#1a1a2e", light: "#ffffff")
    public static let bgTertiary = adaptive(dark: "#242442", light: "#f0f0f5")
    public static let bgElevated = adaptive(dark: "#2a2a4a", light: "#ffffff")

    public static let textPrimary = adaptive(dark: "#f0f0f5", light: "#1a1a2e")
    public static let textSecondary = adaptive(dark: "#a0a0b8", light: "#4a4a6a")
    public static let textMuted = adaptive(dark: "#6b6b80", light: "#8a8aa0")

    public static let accentTeal = Color(hex: "#10b981")
    public static let accentTealHover = Color(hex: "#0d9668")
    public static let accentGold = Color(hex: "#f59e0b")
    public static let accentGoldHover = Color(hex: "#d97706")

    public static let danger = Color(hex: "#ef4444")
    public static let success = Color(hex: "#22c55e")
    public static let warning = Color(hex: "#f59e0b")
    public static let info = Color(hex: "#3b82f6")

    public static let border = adaptive(dark: "#2a2a45", light: "#e2e2ea")
    public static let borderHover = adaptive(dark: "#3a3a5c", light: "#d0d0dc")

    public static let glassBg = adaptive(dark: "#1a1a2ec7", light: "#ffffffd1")
    public static let glassBorder = adaptive(dark: "#ffffff14", light: "#0000000f")

    public static func badge(for category: SpotCategory) -> (background: Color, foreground: Color) {
        switch category {
        case .food:      return (Color(hex: "#10392d"), Color(hex: "#7df0bd"))
        case .nature:    return (Color(hex: "#163d1f"), Color(hex: "#9ef59e"))
        case .nightlife: return (Color(hex: "#251942"), Color(hex: "#d2bfff"))
        case .culture:   return (Color(hex: "#122c57"), Color(hex: "#9dc7ff"))
        case .adventure: return (Color(hex: "#4d2f08"), Color(hex: "#ffd491"))
        case .shopping:  return (Color(hex: "#4b1635"), Color(hex: "#ffb2d9"))
        case .scenic:    return (Color(hex: "#093a47"), Color(hex: "#84e8ff"))
        case .other:     return (Color(hex: "#2a2f44"), Color(hex: "#ced4e6"))
        }
    }

    private static func adaptive(dark: String, light: String) -> Color {
        #if canImport(UIKit)
        return Color(UIColor { trait in
            trait.userInterfaceStyle == .light
                ? UIColor(hex: light) ?? .white
                : UIColor(hex: dark) ?? .black
        })
        #else
        return Color(hex: dark)
        #endif
    }
}

public enum AtlasSpacing {
    public static let xs: CGFloat = 4
    public static let sm: CGFloat = 8
    public static let md: CGFloat = 12
    public static let base: CGFloat = 16
    public static let lg: CGFloat = 20
    public static let xl: CGFloat = 24
    public static let xl2: CGFloat = 32
    public static let xl3: CGFloat = 40
    public static let xl4: CGFloat = 48
}

public enum AtlasRadius {
    public static let sm: CGFloat = 4
    public static let md: CGFloat = 8
    public static let lg: CGFloat = 12
    public static let xl: CGFloat = 16
    public static let xl2: CGFloat = 24
    public static let pill: CGFloat = 9999
}

public enum AtlasTypography {
    public static func hero() -> Font { .system(size: 40, weight: .bold, design: .rounded) }
    public static func h1() -> Font { .system(size: 32, weight: .bold) }
    public static func h2() -> Font { .system(size: 24, weight: .semibold) }
    public static func h3() -> Font { .system(size: 18, weight: .semibold) }
    public static func body() -> Font { .system(size: 16) }
    public static func small() -> Font { .system(size: 14) }
    public static func caption() -> Font { .system(size: 12, weight: .medium) }
    public static func eyebrow() -> Font { .system(size: 12, weight: .semibold).width(.expanded) }
}

// MARK: - Color(hex:)

extension Color {
    init(hex: String) {
        var sanitized = hex.trimmingCharacters(in: .whitespaces)
        if sanitized.hasPrefix("#") { sanitized.removeFirst() }
        var rgb: UInt64 = 0
        Scanner(string: sanitized).scanHexInt64(&rgb)

        let r, g, b, a: Double
        switch sanitized.count {
        case 8:
            r = Double((rgb & 0xFF000000) >> 24) / 255
            g = Double((rgb & 0x00FF0000) >> 16) / 255
            b = Double((rgb & 0x0000FF00) >> 8) / 255
            a = Double(rgb & 0x000000FF) / 255
        default:
            r = Double((rgb & 0xFF0000) >> 16) / 255
            g = Double((rgb & 0x00FF00) >> 8) / 255
            b = Double(rgb & 0x0000FF) / 255
            a = 1
        }
        self = Color(red: r, green: g, blue: b, opacity: a)
    }
}

#if canImport(UIKit)
import UIKit
extension UIColor {
    convenience init?(hex: String) {
        var sanitized = hex.trimmingCharacters(in: .whitespaces)
        if sanitized.hasPrefix("#") { sanitized.removeFirst() }
        var rgb: UInt64 = 0
        guard Scanner(string: sanitized).scanHexInt64(&rgb) else { return nil }
        let r = CGFloat((rgb & 0xFF0000) >> 16) / 255
        let g = CGFloat((rgb & 0x00FF00) >> 8) / 255
        let b = CGFloat(rgb & 0x0000FF) / 255
        self.init(red: r, green: g, blue: b, alpha: 1)
    }
}
#endif

#endif
