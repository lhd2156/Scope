#if canImport(SwiftUI)
import SwiftUI

public struct ExploreView: View {
    @Environment(ScopeSession.self) private var session
    @State private var vm = SpotsViewModel()
    @State private var search = ""

    public init() {}

    public var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: ScopeSpacing.lg) {
                    searchField
                    categoryStrip
                    results
                }
                .padding(ScopeSpacing.xl)
            }
            .background(ScopeColor.bgPrimary)
            .navigationTitle("Explore")
            .task { await vm.load(using: session) }
            .navigationDestination(for: Spot.self) { SpotDetailView(spot: $0) }
        }
    }

    private var searchField: some View {
        HStack(spacing: ScopeSpacing.sm) {
            Image(systemName: "magnifyingglass").foregroundStyle(ScopeColor.textMuted)
            TextField("Search spots, cities, vibes", text: $search)
                .textFieldStyle(.plain)
                .onSubmit { Task { await runSearch() } }
                .foregroundStyle(ScopeColor.textPrimary)
        }
        .padding(.horizontal, ScopeSpacing.base)
        .padding(.vertical, ScopeSpacing.md)
        .background(ScopeColor.bgSecondary)
        .clipShape(RoundedRectangle(cornerRadius: ScopeRadius.lg, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: ScopeRadius.lg, style: .continuous)
                .strokeBorder(ScopeColor.border, lineWidth: 1)
        )
    }

    private var categoryStrip: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: ScopeSpacing.sm) {
                CategoryPill(title: "All", isActive: vm.filter == nil) {
                    Task { await vm.toggleFilter(nil, session: session) }
                }
                ForEach(SpotCategory.allCases, id: \.self) { category in
                    CategoryPill(title: category.rawValue.capitalized, isActive: vm.filter == category) {
                        Task { await vm.toggleFilter(category, session: session) }
                    }
                }
            }
        }
    }

    private var results: some View {
        Group {
            if vm.isLoading && vm.spots.isEmpty {
                ProgressView().tint(ScopeColor.accentTeal).frame(maxWidth: .infinity)
            } else if vm.spots.isEmpty {
                EmptyHint(text: "No spots match your filters. Try another category.")
            } else {
                LazyVStack(spacing: ScopeSpacing.base) {
                    ForEach(vm.spots) { spot in
                        NavigationLink(value: spot) {
                            SpotCard(spot: spot)
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
        }
    }

    @MainActor
    private func runSearch() async {
        vm.isLoading = true
        defer { vm.isLoading = false }
        do {
            vm.spots = try await session.content.listSpots(search: search.isEmpty ? nil : search)
        } catch {
            vm.error = error.localizedDescription
        }
    }
}

struct CategoryPill: View {
    let title: String
    let isActive: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(title)
                .font(ScopeTypography.small().weight(.semibold))
                .padding(.horizontal, ScopeSpacing.base)
                .padding(.vertical, ScopeSpacing.sm)
                .background(isActive ? ScopeColor.accentTeal : ScopeColor.bgSecondary)
                .foregroundStyle(isActive ? Color(hex: "#0b1020") : ScopeColor.textPrimary)
                .clipShape(Capsule())
                .overlay(Capsule().strokeBorder(ScopeColor.border, lineWidth: isActive ? 0 : 1))
        }
        .buttonStyle(.plain)
    }
}

public struct SpotCard: View {
    let spot: Spot
    var compact: Bool = false

    public var body: some View {
        VStack(alignment: .leading, spacing: ScopeSpacing.sm) {
            cover
            VStack(alignment: .leading, spacing: ScopeSpacing.xs) {
                HStack {
                    Text(spot.title)
                        .font(ScopeTypography.h3())
                        .foregroundStyle(ScopeColor.textPrimary)
                        .lineLimit(1)
                    Spacer()
                    CategoryBadge(category: spot.category)
                }
                if let description = spot.description, !compact {
                    Text(description)
                        .font(ScopeTypography.small())
                        .foregroundStyle(ScopeColor.textSecondary)
                        .lineLimit(2)
                }
                HStack(spacing: ScopeSpacing.md) {
                    Label(spot.city ?? "Unknown", systemImage: "mappin.and.ellipse")
                    if let likes = spot.likeCount {
                        Label("\(likes)", systemImage: "heart.fill")
                    }
                }
                .font(ScopeTypography.caption())
                .foregroundStyle(ScopeColor.textMuted)
            }
            .padding(ScopeSpacing.base)
        }
        .background(ScopeColor.bgSecondary)
        .clipShape(RoundedRectangle(cornerRadius: ScopeRadius.xl, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: ScopeRadius.xl, style: .continuous)
                .strokeBorder(ScopeColor.border, lineWidth: 1)
        )
    }

    private var cover: some View {
        ZStack {
            LinearGradient(
                colors: [ScopeColor.badge(for: spot.category).background, ScopeColor.bgTertiary],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
            if let url = spot.coverPhotoUrl, let parsed = URL(string: url) {
                AsyncImage(url: parsed) { phase in
                    switch phase {
                    case .success(let image):
                        image.resizable().scaledToFill()
                    default:
                        EmptyView()
                    }
                }
            } else {
                Image(systemName: iconName)
                    .font(.system(size: 32, weight: .medium))
                    .foregroundStyle(ScopeColor.badge(for: spot.category).foreground)
            }
        }
        .frame(height: compact ? 120 : 160)
        .clipped()
    }

    private var iconName: String {
        switch spot.category {
        case .food: return "fork.knife"
        case .nature: return "leaf.fill"
        case .nightlife: return "moon.stars.fill"
        case .culture: return "building.columns.fill"
        case .adventure: return "figure.hiking"
        case .shopping: return "bag.fill"
        case .scenic: return "camera.fill"
        case .other: return "mappin"
        }
    }
}
#endif
