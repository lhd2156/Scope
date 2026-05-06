# Scope iOS (`scope-ios/`)

Native iOS client for the Scope adventure platform — Swift 5.9 + SwiftUI +
Observation, targeting iOS 17.

It talks to the same three backends as the web frontend:

| Backend | Base URL | Service actor |
|---|---|---|
| Scope Core (C# / ASP.NET Core) | `SCOPE_CORE_BASE_URL` | `CoreService` |
| Scope Content (Django) | `SCOPE_CONTENT_BASE_URL` | `ContentService` |
| Scope Intel (Flask) | `SCOPE_INTEL_BASE_URL` | `IntelService` |

## Structure

```
scope-ios/
├── Package.swift                  # SwiftPM manifest — builds on macOS/iOS/CI
├── App/ScopeApp.swift             # @main entry point for an Xcode iOS target
├── Sources/ScopeKit/
│   ├── Core/                      # APIClient, APIError, TokenStore, environment
│   ├── Models/                    # Domain types (User, Spot, Trip, Itinerary…)
│   ├── Services/                  # Core / Content / Intel / SignalR clients
│   ├── State/                     # ScopeSession + Observation view-models
│   ├── Theme/                     # Design tokens mirrored from scope-assets
│   ├── Components/                # ScopeButton, ScopeTextField, CategoryBadge…
│   └── Views/                     # Auth, Home, Explore, Map, Spot, Profile
└── Tests/ScopeKitTests/           # XCTest — APIClient, models, tokens
```

## Design principles

- **Actor-based networking.** `APIClient` is an `actor` so token refresh and
  request building are race-free across concurrent screens.
- **Envelope-aware decoding.** Core returns `ApiResponse<T>` (`{ data, meta }`)
  and the Django/Flask services return `{ data: ... }`. `APIClient` tries the
  envelope first, then falls back to raw JSON — the same dual-format strategy
  the web client uses (`serviceUtils.unwrapApiData`).
- **Keychain by default.** `KeychainTokenStore` writes JWTs to the iOS
  Keychain; tests use `InMemoryTokenStore`.
- **Dependency-free.** No SwiftPM dependencies so CI builds in seconds. Slot
  in Mapbox iOS SDK or MapLibre Native by swapping `MapHomeView`'s body.
- **Design tokens as Swift.** `ScopeColor` / `ScopeTypography` mirror
  `scope-assets/design-tokens.css` so the palette stays unified with the web
  client. Dark mode is the default; adaptive colors flip for light mode.

## Building

### With SwiftPM (CI, headless)

```bash
cd scope-ios
swift build
swift test
```

### In Xcode (running on simulator/device)

The Xcode project is generated from `project.yml` via
[XcodeGen](https://github.com/yonaskolb/XcodeGen) so it doesn't rot in git:

```bash
brew install xcodegen            # one-time
cd scope-ios
xcodegen generate
open Scope.xcodeproj
```

This creates `Scope.xcodeproj` (git-ignored) wired up with:

- `App/ScopeApp.swift` as the `@main` entry point
- `App/Info.plist` (ATS local-networking exception, location/camera/photo usage
  descriptions, and the `SCOPE_*` runtime config keys)
- A local SwiftPM dependency on `ScopeKit` (this folder)

Pick the `Scope` scheme, pick an iOS 17 simulator, hit ⌘R. The defaults in
`Info.plist` expect Core on `:5080`, Content on `:8000`, and Intel on `:5000`;
override by editing the plist or layering an `.xcconfig`.

## Environment

| Variable | Purpose | Default |
|---|---|---|
| `SCOPE_CORE_BASE_URL` | Core (auth / friends / notifications / live) | `http://localhost:5080` |
| `SCOPE_CONTENT_BASE_URL` | Content (spots / trips / feed / photos) | `http://localhost:8000` |
| `SCOPE_INTEL_BASE_URL` | Intel (itineraries / vibe / recommendations) | `http://localhost:5000` |
| `SCOPE_MAPBOX_TOKEN` | Optional — unlocks Mapbox style URL | _unset_ |
| `SCOPE_MAP_STYLE_URL` | Override map tiles style URL | MapLibre demo tiles |

## Swapping in Mapbox or MapLibre

`MapHomeView` uses Apple MapKit by default so the package builds with zero
external dependencies. To switch:

- **MapLibre Native iOS** — add `MapLibre/mapbox-gl-native-ios` via SwiftPM,
  then replace the `Map(position:…)` block with a `UIViewRepresentable`
  wrapping `MLNMapView`. Style URL comes from `session.environment.mapStyleURL`.
- **Mapbox iOS SDK** — add `mapbox-maps-ios` via SwiftPM with your
  `.netrc` credentials, then follow the same substitution; use
  `session.environment.mapboxAccessToken` for the access token.

## Testing

```bash
swift test
```

Tests cover:
- `APIClient` envelope/raw decoding, 401, 5xx error mapping
- `AuthPayload` camel + snake case decoding (matches Core & Django behaviors)
- `InMemoryTokenStore` persistence and expiry rules
- `ScopeEnvironment` env var resolution

## Commit conventions

Matches root `AGENTS.md`:

```
feat(ios): add SpotDetailView with photo carousel
fix(ios): handle empty envelope in APIClient
```
