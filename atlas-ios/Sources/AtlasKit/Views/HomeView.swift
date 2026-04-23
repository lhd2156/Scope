#if canImport(SwiftUI)
import SwiftUI

public struct HomeView: View {
    @Environment(AtlasSession.self) private var session
    @State private var vm = SpotsViewModel()
    @State private var trending: [Spot] = []

    public init() {}

    public var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: AtlasSpacing.xl) {
                    hero
                    trendingSection
                    feedSection
                }
                .padding(AtlasSpacing.xl)
            }
            .background(AtlasColor.bgPrimary)
            .navigationTitle("Atlas")
            .task { await load() }
            .refreshable { await load() }
        }
    }

    private var hero: some View {
        GlassPanel {
            VStack(alignment: .leading, spacing: AtlasSpacing.md) {
                Text("ADVENTURE PLATFORM")
                    .font(AtlasTypography.eyebrow())
                    .tracking(2)
                    .foregroundStyle(AtlasColor.accentTeal)

                Text(greeting)
                    .font(AtlasTypography.hero())
                    .foregroundStyle(AtlasColor.textPrimary)

                Text("Discover, plan, and share unforgettable journeys.")
                    .font(AtlasTypography.body())
                    .foregroundStyle(AtlasColor.textSecondary)

                NavigationLink {
                    ExploreView()
                } label: {
                    Label("Start exploring", systemImage: "sparkles")
                        .font(AtlasTypography.body().weight(.semibold))
                        .foregroundStyle(Color(hex: "#0b1020"))
                        .padding(.vertical, AtlasSpacing.md)
                        .padding(.horizontal, AtlasSpacing.lg)
                        .background(LinearGradient(colors: [AtlasColor.accentTeal, AtlasColor.accentGold], startPoint: .leading, endPoint: .trailing))
                        .clipShape(Capsule())
                }
            }
        }
    }

    private var trendingSection: some View {
        VStack(alignment: .leading, spacing: AtlasSpacing.md) {
            SectionHeader(title: "Trending this week", eyebrow: "Community")
            if trending.isEmpty {
                EmptyHint(text: "No trending spots yet. Be the first to drop a pin.")
            } else {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: AtlasSpacing.base) {
                        ForEach(trending) { spot in
                            NavigationLink(value: spot) {
                                SpotCard(spot: spot, compact: true)
                                    .frame(width: 260)
                            }
                            .buttonStyle(.plain)
                        }
                    }
                }
            }
        }
        .navigationDestination(for: Spot.self) { SpotDetailView(spot: $0) }
    }

    private var feedSection: some View {
        VStack(alignment: .leading, spacing: AtlasSpacing.md) {
            SectionHeader(title: "Fresh finds", eyebrow: "Explore")
            if vm.isLoading && vm.spots.isEmpty {
                ProgressView().tint(AtlasColor.accentTeal).frame(maxWidth: .infinity)
            } else if let error = vm.error {
                Text(error).foregroundStyle(AtlasColor.danger)
            } else {
                LazyVStack(spacing: AtlasSpacing.base) {
                    ForEach(vm.spots.prefix(10)) { spot in
                        NavigationLink(value: spot) {
                            SpotCard(spot: spot)
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
        }
    }

    private var greeting: String {
        let name = session.currentUser?.displayName.split(separator: " ").first.map(String.init) ?? "Explorer"
        return "Hey \(name),\nwhere to next?"
    }

    private func load() async {
        await vm.load(using: session)
        do {
            self.trending = try await session.content.trendingSpots()
        } catch {
            self.trending = []
        }
    }
}

struct SectionHeader: View {
    let title: String
    let eyebrow: String

    var body: some View {
        VStack(alignment: .leading, spacing: AtlasSpacing.xs) {
            Text(eyebrow.uppercased())
                .font(AtlasTypography.eyebrow())
                .tracking(2)
                .foregroundStyle(AtlasColor.accentGold)
            Text(title)
                .font(AtlasTypography.h2())
                .foregroundStyle(AtlasColor.textPrimary)
        }
    }
}

struct EmptyHint: View {
    let text: String
    var body: some View {
        Text(text)
            .font(AtlasTypography.small())
            .foregroundStyle(AtlasColor.textMuted)
            .padding(AtlasSpacing.base)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(AtlasColor.bgSecondary)
            .clipShape(RoundedRectangle(cornerRadius: AtlasRadius.lg, style: .continuous))
    }
}
#endif
