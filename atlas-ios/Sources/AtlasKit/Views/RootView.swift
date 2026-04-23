#if canImport(SwiftUI)
import SwiftUI

public struct RootView: View {
    @Environment(AtlasSession.self) private var session

    public init() {}

    public var body: some View {
        Group {
            if session.isAuthenticated {
                MainTabView()
            } else {
                AuthLandingView()
            }
        }
        .task {
            await session.bootstrap()
        }
        .preferredColorScheme(.dark)
        .tint(AtlasColor.accentTeal)
    }
}

public struct MainTabView: View {
    public init() {}

    public var body: some View {
        TabView {
            HomeView()
                .tabItem { Label("Home", systemImage: "house.fill") }

            ExploreView()
                .tabItem { Label("Explore", systemImage: "safari.fill") }

            MapHomeView()
                .tabItem { Label("Map", systemImage: "map.fill") }

            ProfileView()
                .tabItem { Label("Profile", systemImage: "person.crop.circle.fill") }
        }
    }
}
#endif
