// swift-tools-version: 5.9
// Atlas iOS — Swift Package
//
// This package is the native iOS client for the Atlas platform. It builds as
// a library target (`AtlasKit`) that contains the networking layer, domain
// models, and SwiftUI views for every screen. Wrap it in a thin Xcode `App`
// target to ship to the App Store, or run `swift test` headlessly for CI.

import PackageDescription

let package = Package(
    name: "AtlasKit",
    defaultLocalization: "en",
    platforms: [
        .iOS(.v17),
        .macOS(.v14)
    ],
    products: [
        .library(
            name: "AtlasKit",
            targets: ["AtlasKit"]
        )
    ],
    dependencies: [],
    targets: [
        .target(
            name: "AtlasKit",
            path: "Sources/AtlasKit",
            swiftSettings: [
                .enableUpcomingFeature("BareSlashRegexLiterals")
            ]
        ),
        .testTarget(
            name: "AtlasKitTests",
            dependencies: ["AtlasKit"],
            path: "Tests/AtlasKitTests"
        )
    ]
)
