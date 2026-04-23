#if canImport(SwiftUI) && canImport(MapKit)
import SwiftUI
import MapKit

/// Map entry point. Uses MapKit as a dependency-free default so the package
/// builds without Mapbox credentials; swap in MapLibre Native (or Mapbox iOS
/// SDK when you have a token) by wrapping their `UIViewRepresentable` here.
public struct MapHomeView: View {
    @Environment(AtlasSession.self) private var session
    @State private var vm = SpotsViewModel()
    @State private var camera: MapCameraPosition = .region(.default)
    @State private var selected: Spot?

    public init() {}

    public var body: some View {
        NavigationStack {
            ZStack(alignment: .top) {
                Map(position: $camera, selection: $selected) {
                    ForEach(vm.spots) { spot in
                        Marker(spot.title, systemImage: markerIcon(for: spot.category),
                               coordinate: CLLocationCoordinate2D(latitude: spot.latitude, longitude: spot.longitude))
                            .tint(Color(AtlasColor.badge(for: spot.category).foreground))
                            .tag(spot)
                    }
                }
                .mapStyle(.standard(elevation: .realistic))
                .ignoresSafeArea(edges: .bottom)

                categoryBar
                    .padding(.top, AtlasSpacing.md)
                    .padding(.horizontal, AtlasSpacing.base)
            }
            .sheet(item: $selected) { spot in
                NavigationStack { SpotDetailView(spot: spot) }
                    .presentationDetents([.fraction(0.55), .large])
                    .presentationDragIndicator(.visible)
            }
            .navigationTitle("Map")
            .navigationBarTitleDisplayMode(.inline)
            .task { await vm.load(using: session) }
        }
    }

    private var categoryBar: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: AtlasSpacing.sm) {
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
        .padding(AtlasSpacing.sm)
        .background(AtlasColor.glassBg)
        .clipShape(Capsule())
        .overlay(Capsule().strokeBorder(AtlasColor.glassBorder, lineWidth: 1))
    }

    private func markerIcon(for category: SpotCategory) -> String {
        switch category {
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

extension MKCoordinateRegion {
    static let `default` = MKCoordinateRegion(
        center: CLLocationCoordinate2D(latitude: 37.7749, longitude: -122.4194),
        span: MKCoordinateSpan(latitudeDelta: 0.3, longitudeDelta: 0.3)
    )
}
#endif
