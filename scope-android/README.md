# Scope Android (`scope-android/`)

Native Android client for the Scope adventure platform — Kotlin + Jetpack
Compose + Hilt + Retrofit, minSdk 26, targetSdk 35.

It talks to the same three backends as the web frontend:

| Backend | Base URL key | Client |
|---|---|---|
| Scope Core (C# / ASP.NET Core) | `SCOPE_CORE_BASE_URL` | `CoreApi` |
| Scope Content (Django) | `SCOPE_CONTENT_BASE_URL` | `ContentApi` |
| Scope Intel (Flask) | `SCOPE_INTEL_BASE_URL` | `IntelApi` |

## Stack

- Kotlin 2.0 + coroutines + Flow
- Jetpack Compose (BOM `2024.09.02`) + Material 3
- Navigation Compose
- Hilt for DI (via KSP)
- Retrofit + OkHttp + Moshi (KotlinJsonAdapterFactory + `@JsonClass` codegen)
- EncryptedSharedPreferences (AndroidX Security) for JWT token storage
- MapLibre Native Android for the map (free, open-source; Mapbox-style URLs
  slot in with an access token)
- Coil for async image loading
- MockWebServer / MockK / Turbine for tests

## Structure

```
scope-android/
├── settings.gradle.kts
├── build.gradle.kts
├── gradle/libs.versions.toml            # Single version source of truth
├── app/
│   ├── build.gradle.kts
│   ├── proguard-rules.pro
│   └── src/
│       ├── main/
│       │   ├── AndroidManifest.xml
│       │   ├── kotlin/com/scope/mobile/
│       │   │   ├── ScopeApplication.kt        # @HiltAndroidApp
│       │   │   ├── MainActivity.kt            # @AndroidEntryPoint
│       │   │   ├── data/
│       │   │   │   ├── model/                 # Domain models + @JsonClass
│       │   │   │   ├── network/               # TokenStore, Interceptor,
│       │   │   │   │                           # Envelope converter, errors
│       │   │   │   ├── remote/                # CoreApi / ContentApi / IntelApi
│       │   │   │   ├── realtime/              # SignalR-over-OkHttp client
│       │   │   │   └── repository/            # Repositories wrapping APIs
│       │   │   ├── di/                        # Hilt modules
│       │   │   └── ui/
│       │   │       ├── theme/                 # ScopeTheme + ScopeTokens
│       │   │       ├── components/            # Button / TextField / Badge…
│       │   │       ├── session/               # SessionViewModel
│       │   │       ├── spots/                 # SpotsViewModel
│       │   │       ├── spotdetail/            # SpotDetailScreen + VM
│       │   │       ├── auth/                  # AuthLandingScreen
│       │   │       ├── home/                  # HomeScreen
│       │   │       ├── explore/               # ExploreScreen
│       │   │       ├── map/                   # MapScreen (MapLibre)
│       │   │       └── profile/               # ProfileScreen
│       │   └── res/                           # strings, themes, colors
│       └── test/kotlin/...                    # MockWebServer + JUnit
```

## Design principles

- **Envelope-aware Retrofit.** `EnvelopeConverterFactory` transparently
  unwraps both `{ data, meta }` envelopes (C# Core) and `{ data }` payloads
  (Django / Flask). Falls back to raw JSON when neither applies.
- **Encrypted tokens at rest.** `EncryptedTokenStore` writes JWTs to
  `EncryptedSharedPreferences` backed by a Keystore-bound `MasterKey`.
- **Auto-refresh on 401.** `ScopeAuthenticator` (OkHttp `Authenticator`
  contract) catches 401s, refreshes the token once, and retries the failed
  request transparently — never re-entrant.
- **Design tokens as Kotlin.** `ScopeTokens` mirrors
  `scope-assets/design-tokens.css`, so palette drift between web / iOS /
  Android is impossible: every platform reads from the same table.
- **Dark by default.** Scope ships dark-first; `ScopeTheme` provides a light
  scheme for later opt-in.

## Building

### First-time setup

The Gradle wrapper `.jar` isn't checked in (to keep the repo binary-free).
Generate it once before your first build:

```powershell
cd scope-android
gradle wrapper --gradle-version=8.9
```

This produces `gradle/wrapper/gradle-wrapper.jar`, `gradlew`, and
`gradlew.bat`. You can safely commit those if your team prefers to pin them.

### Command line (CI-friendly)

```powershell
cd scope-android
.\gradlew.bat assembleDebug testDebugUnitTest
```

### Android Studio

1. Open `scope-android/` directly (Android Studio Giraffe+ with AGP 8.5).
2. Let Gradle sync (~1–2 min first time).
3. Pick a device or emulator → **Run**.

### Configuring base URLs

Override in any of these layers, highest precedence first:

1. `-P<key>=<value>` Gradle property: `.\gradlew.bat assembleDebug -PSCOPE_CORE_BASE_URL=https://core.staging.scope.app/`
2. `local.properties` (gitignored): `SCOPE_CORE_BASE_URL=https://core.staging.scope.app/`
3. Environment variables: `set SCOPE_CORE_BASE_URL=https://...`
4. Defaults (Android emulator loopback): `http://10.0.2.2:5080/`

Values are emitted to `BuildConfig` so Retrofit picks them up at app start.

## Environment

| Variable | Purpose | Default |
|---|---|---|
| `SCOPE_CORE_BASE_URL` | Core (auth / friends / notifications / live) | `http://10.0.2.2:5080/` |
| `SCOPE_CONTENT_BASE_URL` | Content (spots / trips / feed / photos) | `http://10.0.2.2:8000/` |
| `SCOPE_INTEL_BASE_URL` | Intel (itineraries / vibe / recommendations) | `http://10.0.2.2:5000/` |
| `SCOPE_MAP_STYLE_URL` | Vector tile style for the MapLibre map | MapLibre demo tiles |

To point MapLibre at a Mapbox style, set the URL to
`https://api.mapbox.com/styles/v1/mapbox/dark-v11?access_token=<token>`.

## Testing

```powershell
.\gradlew.bat testDebugUnitTest
```

Unit tests cover:
- `EnvelopeConverterFactory` — envelope unwrap, raw fallback, list payloads
- `InMemoryTokenStore` — save / clear / hasSession transitions
- `toScopeError()` — HTTP 401/404/500/IOException/unknown mapping

## Commit conventions

Matches root `AGENTS.md`:

```
feat(android): wire SpotDetailScreen to ContentApi
fix(android): refresh tokens once on 401
```
