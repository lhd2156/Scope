// Scope iOS host app entry point.
//
// Drop this file into an Xcode "iOS App" target that depends on `ScopeKit`
// via Swift Package Manager. Everything else — UI, networking, theme —
// lives in the package.

#if canImport(SwiftUI)
import SwiftUI
import ScopeKit

@main
struct ScopeApp: App {
    @State private var session = ScopeSession.live()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(session)
        }
    }
}
#endif
