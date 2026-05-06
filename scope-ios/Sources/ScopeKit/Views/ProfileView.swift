#if canImport(SwiftUI)
import SwiftUI

public struct ProfileView: View {
    @Environment(ScopeSession.self) private var session
    @State private var mySpots: [Spot] = []

    public init() {}

    public var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: ScopeSpacing.xl) {
                    header
                    statsGrid
                    mySpotsSection
                    ScopeButton("Sign out", style: .ghost) {
                        Task { await session.signOut() }
                    }
                }
                .padding(ScopeSpacing.xl)
            }
            .background(ScopeColor.bgPrimary)
            .navigationTitle("Profile")
            .task { await loadSpots() }
        }
    }

    private var header: some View {
        GlassPanel {
            VStack(spacing: ScopeSpacing.md) {
                ZStack {
                    Circle()
                        .fill(LinearGradient(colors: [ScopeColor.accentTeal, ScopeColor.accentGold], startPoint: .topLeading, endPoint: .bottomTrailing))
                        .frame(width: 96, height: 96)
                    Text(initials)
                        .font(.system(size: 32, weight: .bold))
                        .foregroundStyle(Color(hex: "#0b1020"))
                }
                Text(session.currentUser?.displayName ?? "Explorer")
                    .font(ScopeTypography.h2())
                    .foregroundStyle(ScopeColor.textPrimary)
                if let username = session.currentUser?.username {
                    Text("@\(username)")
                        .font(ScopeTypography.small())
                        .foregroundStyle(ScopeColor.textMuted)
                }
                if let bio = session.currentUser?.bio {
                    Text(bio)
                        .font(ScopeTypography.body())
                        .foregroundStyle(ScopeColor.textSecondary)
                        .multilineTextAlignment(.center)
                }
            }
        }
    }

    private var statsGrid: some View {
        HStack(spacing: ScopeSpacing.md) {
            StatTile(value: "\(mySpots.count)", label: "Spots")
            StatTile(value: "0", label: "Trips")
            StatTile(value: "0", label: "Friends")
        }
    }

    private var mySpotsSection: some View {
        VStack(alignment: .leading, spacing: ScopeSpacing.md) {
            SectionHeader(title: "Your spots", eyebrow: "Adventures")
            if mySpots.isEmpty {
                EmptyHint(text: "You haven't dropped any pins yet.")
            } else {
                ForEach(mySpots) { spot in
                    SpotCard(spot: spot)
                }
            }
        }
    }

    private var initials: String {
        let name = session.currentUser?.displayName ?? "Scope"
        let parts = name.split(separator: " ")
        let chars = parts.prefix(2).compactMap { $0.first }.map(String.init).joined()
        return chars.uppercased()
    }

    @MainActor
    private func loadSpots() async {
        guard let id = session.currentUser?.id else { return }
        mySpots = (try? await session.content.userSpots(userId: id)) ?? []
    }
}

struct StatTile: View {
    let value: String
    let label: String
    var body: some View {
        VStack(spacing: ScopeSpacing.xs) {
            Text(value).font(ScopeTypography.h1()).foregroundStyle(ScopeColor.accentTeal)
            Text(label).font(ScopeTypography.caption()).foregroundStyle(ScopeColor.textMuted)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, ScopeSpacing.base)
        .background(ScopeColor.bgSecondary)
        .clipShape(RoundedRectangle(cornerRadius: ScopeRadius.xl, style: .continuous))
    }
}
#endif
