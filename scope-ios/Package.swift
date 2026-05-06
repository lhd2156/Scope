// swift-tools-version: 5.9
// Scope iOS — Swift Package
//
// This package is the native iOS client for the Scope platform. It builds as
// a library target (`ScopeKit`) that contains the networking layer, domain
// models, and SwiftUI views for every screen. Wrap it in a thin Xcode `App`
// target to ship to the App Store, or run `swift test` headlessly for CI.

import PackageDescription

let package = Package(
    name: "ScopeKit",
    defaultLocalization: "en",
    platforms: [
        .iOS(.v17),
        .macOS(.v14)
    ],
    products: [
        .library(
            name: "ScopeKit",
            targets: ["ScopeKit"]
        )
    ],
    dependencies: [],
    targets: [
        .target(
            name: "ScopeKit",
            path: "Sources/ScopeKit",
            swiftSettings: [
                .enableUpcomingFeature("BareSlashRegexLiterals")
            ]
        ),
        .testTarget(
            name: "ScopeKitTests",
            dependencies: ["ScopeKit"],
            path: "Tests/ScopeKitTests"
        )
    ]
)
