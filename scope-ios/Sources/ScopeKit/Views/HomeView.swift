#if canImport(SwiftUI)
import SwiftUI

public struct HomeView: View {
    @Environment(ScopeSession.self) private var session
    @State private var vm = SpotsViewModel()
    @State private var trending: [Spot] = []

    public init() {}

    public var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: ScopeSpacing.xl) {
                    hero
                    trendingSection
                    feedSection
                }
                .padding(ScopeSpacing.xl)
            }
            .background(ScopeColor.bgPrimary)
            .navigationTitle("Scope")
            .task { await load() }
            .refreshable { await load() }
        }
    }

    private var hero: some View {
        GlassPanel {
            VStack(alignment: .leading, spacing: ScopeSpacing.md) {
                Text("ADVENTURE PLATFORM")
                    .font(ScopeTypography.eyebrow())
                    .tracking(2)
                    .foregroundStyle(ScopeColor.accentTeal)

                Text(greeting)
                    .font(ScopeTypography.hero())
                    .foregroundStyle(ScopeColor.textPrimary)

                Text("Discover, plan, and share unforgettable journeys.")
                    .font(ScopeTypography.body())
                    .foregroundStyle(ScopeColor.textSecondary)

                NavigationLink {
                    ExploreView()
                } label: {
                    Label("Start exploring", systemImage: "sparkles")
                        .font(ScopeTypography.body().weight(.semibold))
                        .foregroundStyle(Color(hex: "#0b1020"))
                        .padding(.vertical, ScopeSpacing.md)
                        .padding(.horizontal, ScopeSpacing.lg)
                        .background(LinearGradient(colors: [ScopeColor.accentTeal, ScopeColor.accentGold], startPoint: .leading, endPoint: .trailing))
                        .clipShape(Capsule())
                }
            }
        }
    }

    private var trendingSection: some View {
        VStack(alignment: .leading, spacing: ScopeSpacing.md) {
            SectionHeader(title: "Trending this week", eyebrow: "Community")
            if trending.isEmpty {
                EmptyHint(text: "No trending spots yet. Be the first to drop a pin.")
            } else {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: ScopeSpacing.base) {
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
        VStack(alignment: .leading, spacing: ScopeSpacing.md) {
            SectionHeader(title: "Fresh finds", eyebrow: "Explore")
            if vm.isLoading && vm.spots.isEmpty {
                ProgressView().tint(ScopeColor.accentTeal).frame(maxWidth: .infinity)
            } else if let error = vm.error {
                Text(error).foregroundStyle(ScopeColor.danger)
            } else {
                LazyVStack(spacing: ScopeSpacing.base) {
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
        VStack(alignment: .leading, spacing: ScopeSpacing.xs) {
            Text(eyebrow.uppercased())
                .font(ScopeTypography.eyebrow())
                .tracking(2)
                .foregroundStyle(ScopeColor.accentGold)
            Text(title)
                .font(ScopeTypography.h2())
                .foregroundStyle(ScopeColor.textPrimary)
        }
    }
}

struct EmptyHint: View {
    let text: String
    var body: some View {
        Text(text)
            .font(ScopeTypography.small())
            .foregroundStyle(ScopeColor.textMuted)
            .padding(ScopeSpacing.base)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(ScopeColor.bgSecondary)
            .clipShape(RoundedRectangle(cornerRadius: ScopeRadius.lg, style: .continuous))
    }
}
#endif
