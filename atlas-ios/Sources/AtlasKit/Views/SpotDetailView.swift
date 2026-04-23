#if canImport(SwiftUI)
import SwiftUI

public struct SpotDetailView: View {
    @Environment(AtlasSession.self) private var session
    let spot: Spot
    @State private var liked = false
    @State private var likeBusy = false
    @State private var photos: [ContentService.SpotPhoto] = []

    public init(spot: Spot) { self.spot = spot }

    public var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: AtlasSpacing.lg) {
                cover
                VStack(alignment: .leading, spacing: AtlasSpacing.md) {
                    HStack {
                        Text(spot.title).font(AtlasTypography.h1()).foregroundStyle(AtlasColor.textPrimary)
                        Spacer()
                        CategoryBadge(category: spot.category)
                    }

                    if let city = spot.city {
                        Label("\(city)\(spot.country.map { ", \($0)" } ?? "")", systemImage: "mappin.and.ellipse")
                            .font(AtlasTypography.small())
                            .foregroundStyle(AtlasColor.textMuted)
                    }

                    if let desc = spot.description {
                        Text(desc).font(AtlasTypography.body()).foregroundStyle(AtlasColor.textSecondary)
                    }

                    if let vibe = spot.vibe {
                        VibeTag(vibe: vibe)
                    }

                    HStack(spacing: AtlasSpacing.base) {
                        AtlasButton(liked ? "Liked" : "Like", style: liked ? .ghost : .primary, isLoading: likeBusy) {
                            Task { await toggleLike() }
                        }
                        AtlasButton("Add to trip", style: .secondary) { }
                    }

                    if !photos.isEmpty {
                        Text("Photos")
                            .font(AtlasTypography.h3())
                            .foregroundStyle(AtlasColor.textPrimary)
                        ScrollView(.horizontal, showsIndicators: false) {
                            HStack(spacing: AtlasSpacing.sm) {
                                ForEach(photos) { photo in
                                    AsyncImage(url: URL(string: photo.storageUrl)) { phase in
                                        switch phase {
                                        case .success(let image): image.resizable().scaledToFill()
                                        default: Rectangle().fill(AtlasColor.bgTertiary)
                                        }
                                    }
                                    .frame(width: 140, height: 140)
                                    .clipShape(RoundedRectangle(cornerRadius: AtlasRadius.lg, style: .continuous))
                                }
                            }
                        }
                    }
                }
                .padding(.horizontal, AtlasSpacing.xl)
            }
        }
        .background(AtlasColor.bgPrimary)
        .task { await loadPhotos() }
    }

    private var cover: some View {
        ZStack(alignment: .bottomLeading) {
            LinearGradient(colors: [AtlasColor.badge(for: spot.category).background, AtlasColor.bgTertiary], startPoint: .top, endPoint: .bottom)
                .frame(height: 260)
            if let url = spot.coverPhotoUrl, let parsed = URL(string: url) {
                AsyncImage(url: parsed) { phase in
                    if case .success(let image) = phase {
                        image.resizable().scaledToFill()
                    }
                }
                .frame(height: 260)
                .clipped()
            }
            LinearGradient(colors: [.black.opacity(0.5), .clear], startPoint: .bottom, endPoint: .top)
                .frame(height: 140)
        }
    }

    @MainActor
    private func toggleLike() async {
        likeBusy = true
        defer { likeBusy = false }
        do {
            if liked {
                try await session.content.unlikeSpot(id: spot.id)
            } else {
                try await session.content.likeSpot(id: spot.id)
            }
            liked.toggle()
        } catch {
            // silently ignore; surface via a toast in a production app
        }
    }

    @MainActor
    private func loadPhotos() async {
        photos = (try? await session.content.spotPhotos(id: spot.id)) ?? []
    }
}

struct VibeTag: View {
    let vibe: String
    var body: some View {
        Text("“\(vibe)”")
            .font(AtlasTypography.small().italic())
            .foregroundStyle(AtlasColor.accentGold)
            .padding(.horizontal, AtlasSpacing.base)
            .padding(.vertical, AtlasSpacing.xs)
            .background(Color(hex: "#4d2f08"))
            .clipShape(Capsule())
    }
}
#endif
