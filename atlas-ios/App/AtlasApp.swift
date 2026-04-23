// Atlas iOS host app entry point.
//
// Drop this file into an Xcode "iOS App" target that depends on `AtlasKit`
// via Swift Package Manager. Everything else — UI, networking, theme —
// lives in the package.

#if canImport(SwiftUI)
import SwiftUI
import AtlasKit

@main
struct AtlasApp: App {
    @State private var session = AtlasSession.live()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(session)
        }
    }
}
#endif
