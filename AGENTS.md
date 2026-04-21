# Atlas — Lead Agent Instructions

## What is Atlas?
Atlas is a real-world adventure platform — users drop pins, upload photos, write stories, and share adventures on an interactive map. AI plans optimized itineraries from community data.

**Elevator Pitch:** "Pokémon Go meets Instagram — real places, real photos, real adventures on a map."

## Architecture
Polyglot microservices: 3 backends + 1 frontend + native performance modules + systems tooling.

| Service | Framework | Directory | Responsibility |
|---------|-----------|-----------|----------------|
| Core Platform | C# / ASP.NET Core 8 | `Atlas.Core/` | Auth, SignalR, users, friends, notifications |
| Content Engine | Python / Django 5 | `atlas_content/` | Spots, trips, photos, reviews, feed |
| Intelligence API | Python / Flask 3 | `atlas_intel/` | AI itineraries, recommendations, vibe matching |
| Frontend | Vue.js 3 / TypeScript | `atlas-frontend/` | All UI, Mapbox maps, Pinia state, dark/light |
| Geospatial Engine | C++ / pybind11 | `atlas_geo/` | Native spatial algorithms (haversine, R-tree, A*) |
| Media Pipeline | C / ctypes | `atlas_media/` | Fast thumbnails, EXIF strip, blurhash encoding |
| WASM Module | C++ / Emscripten | `atlas-frontend/wasm/` | Client-side map clustering & distance |
| CLI Toolkit | Rust / clap + tokio | `atlas-cli/` | Health checks, seeding, benchmarking, deploy validation |
| Metrics Agent | Go / prometheus | `atlas-metrics/` | Prometheus exporter, system/app probes, alerts |

## Your Role
You are the orchestrator. You:
1. **Read the master playbook** — `C:\Users\dongu\atlas\HEARTBEAT.md`
2. **Spawn sub-agents** using task templates for the current phase
3. **Monitor progress** via each agent's canonical PROGRESS.md
4. **Handle integration** — merge branches, verify cross-service communication

## Key Files
| File | Purpose |
|------|---------|
| `HEARTBEAT.md` | MASTER orchestration playbook — ALL spawn templates |
| `PROGRESS.md` | Lead-level progress, active phase |
| `memory/LESSONS.md` | Institutional knowledge from ALL agents |
| `memory/COMPLETED-TASKS.md` | Lightweight ledger of finished tasks |
| `atlas-assets/DESIGN-SPEC.md` | Authoritative frontend design specification |
| `atlas-assets/mockups/` (00-08) | Pixel-perfect mockup images for Phase 13 |
| `atlas-assets/design-tokens.css` | CSS custom properties for dark/light mode |
| `atlas_architecture.tex` | Architecture source of truth (~2600 lines) |

## Build Order (Phases 1-26)
```
Phase 1-20: ALL COMPLETE (Foundation → QA Blitz)
Phase 21: Native Geospatial Engine 🗺️ (C++ → Python via pybind11)
Phase 22: Native Image Processing 📸 (C via ctypes)
Phase 23: WebAssembly Client Module 🌐 (C++ → WASM)
Phase 24: CLI Toolkit 🦀 (Rust)
Phase 25: Metrics Agent 📡 (Go)
Phase 26: Cloud Deployment ☁️ (Terraform + K8s)
```

## Critical Rules
1. **Read `HEARTBEAT.md` for spawn templates** — it has everything
2. **Never merge microservices** — each service is independent
3. **Never skip security** — rate limiting, validation, JWT everywhere
4. **Write tests** — xUnit, Pytest, Vitest, Playwright, GoogleTest, cargo test, go test
5. **Commit after EVERY milestone** — conventional commits
6. **Never hardcode secrets** — use `.env`
7. **Service boundaries are sacred**
8. **Windows PowerShell** — use `;` not `&&`
9. **Read COMPLETED-TASKS.md on boot** — know what's already done

## Database
Single SQL Server, logically separated: `core.*`, `content.*`, `intel.*`

## Commit Format
```
<type>(<scope>): <short description>
```
Types: `feat`, `fix`, `docs`, `chore`, `test`, `refactor`, `style`, `ci`
