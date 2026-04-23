#if canImport(SwiftUI)
import SwiftUI

public struct ProfileView: View {
    @Environment(AtlasSession.self) private var session
    @State private var mySpots: [Spot] = []

    public init() {}

    public var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: AtlasSpacing.xl) {
                    header
                    statsGrid
                    mySpotsSection
                    AtlasButton("Sign out", style: .ghost) {
                        Task { await session.signOut() }
                    }
                }
                .padding(AtlasSpacing.xl)
            }
            .background(AtlasColor.bgPrimary)
            .navigationTitle("Profile")
            .task { await loadSpots() }
        }
    }

    private var header: some View {
        GlassPanel {
            VStack(spacing: AtlasSpacing.md) {
                ZStack {
                    Circle()
                        .fill(LinearGradient(colors: [AtlasColor.accentTeal, AtlasColor.accentGold], startPoint: .topLeading, endPoint: .bottomTrailing))
                        .frame(width: 96, height: 96)
                    Text(initials)
                        .font(.system(size: 32, weight: .bold))
                        .foregroundStyle(Color(hex: "#0b1020"))
                }
                Text(session.currentUser?.displayName ?? "Explorer")
                    .font(AtlasTypography.h2())
                    .foregroundStyle(AtlasColor.textPrimary)
                if let username = session.currentUser?.username {
                    Text("@\(username)")
                        .font(AtlasTypography.small())
                        .foregroundStyle(AtlasColor.textMuted)
                }
                if let bio = session.currentUser?.bio {
                    Text(bio)
                        .font(AtlasTypography.body())
                        .foregroundStyle(AtlasColor.textSecondary)
                        .multilineTextAlignment(.center)
                }
            }
        }
    }

    private var statsGrid: some View {
        HStack(spacing: AtlasSpacing.md) {
            StatTile(value: "\(mySpots.count)", label: "Spots")
            StatTile(value: "0", label: "Trips")
            StatTile(value: "0", label: "Friends")
        }
    }

    private var mySpotsSection: some View {
        VStack(alignment: .leading, spacing: AtlasSpacing.md) {
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
        let name = session.currentUser?.displayName ?? "Atlas"
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
        VStack(spacing: AtlasSpacing.xs) {
            Text(value).font(AtlasTypography.h1()).foregroundStyle(AtlasColor.accentTeal)
            Text(label).font(AtlasTypography.caption()).foregroundStyle(AtlasColor.textMuted)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, AtlasSpacing.base)
        .background(AtlasColor.bgSecondary)
        .clipShape(RoundedRectangle(cornerRadius: AtlasRadius.xl, style: .continuous))
    }
}
#endif
