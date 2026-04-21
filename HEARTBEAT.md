# Heartbeat

## Quick Overview
- **Phases 1-20**: ALL COMPLETE (Foundation → Backends → Frontend → Design → E2E → Demo → Mobile/PWA → Analytics → Onboarding → QA Blitz)
- **Phase 21**: Native Geospatial Engine 🗺️ (C++ + pybind11) — QUEUED
- **Phase 22**: Native Image Processing 📸 (C + ctypes) — QUEUED
- **Phase 23**: WebAssembly Client Module 🌐 (C++ → WASM) — QUEUED
- **Phase 24**: CLI Toolkit 🦀 (Rust) — QUEUED
- **Phase 25**: Metrics Agent 📡 (Go) — QUEUED
- **Phase 26**: Cloud Deployment ☁️ (Terraform + K8s) — QUEUED

## Boot Sequence (MANDATORY)
Before doing ANYTHING:
1. Read `C:\Users\dongu\atlas\memory\LESSONS.md` — institutional knowledge
2. Read `C:\Users\dongu\atlas\memory\COMPLETED-TASKS.md` — lightweight ledger of finished tasks
3. Read each agent's canonical PROGRESS.md at paths below

## Path Rules
- Workspace: `C:\Users\dongu\atlas`
- Agent progress: `C:\Users\dongu\atlas\{foundation,core,content,intel,frontend,polish}\PROGRESS.md`
- Lead progress: `C:\Users\dongu\atlas\PROGRESS.md`
- Do NOT look in `.worktrees/` or any worktree directory

## Runtime (ALL installed — NEVER accept "no runtime")
- .NET 8.0.419: `C:\Program Files\dotnet\dotnet.exe`
- Python 3.14.3: `C:\Users\dongu\AppData\Local\Python\bin\python.exe`
- Node 24.14.0: `C:\Program Files\nodejs\node.exe` / npm 11.9.0

## Windows PowerShell
Use `;` to chain commands. NEVER `&&`. Example: `git add . ; git commit -m "msg"`

## File Editing
Always re-read files before editing. Never rely on cached/stale content.

---

## Step 1: Check Agent Progress
Read PROGRESS.md for each agent at canonical paths. Check `## Status:` line.

## Step 2: Spawn Agents
For each agent whose status ≠ `COMPLETE`, spawn via `run_subagent` using Phase templates below.

**Spawn Order:**
- Foundation → FIRST (already COMPLETE)
- Core, Content, Intel → parallel after Foundation (already COMPLETE)
- Frontend → parallel with backends
- Polish → after Frontend completes 13.1-13.13

## Step 3: Update Lead Progress
Re-read then update `C:\Users\dongu\atlas\PROGRESS.md`: phase, agents running, timestamp, issues.
**Keep log ≤ 10 entries** — delete oldest when exceeded.

## Step 4: Log Lessons
Append patterns/failures to `C:\Users\dongu\atlas\memory\LESSONS.md` under `## Orchestration`.

## Step 5: Telegram Report (MANDATORY)
Send to `8744371466` every heartbeat with `buttons: []`.

**`@BenDaDonBot` is YOUR bot username — NEVER use it as target. ALWAYS use `8744371466`.**

```
🔄 Heartbeat [TIME]
━━━━━━━━━━━━━━━━━
Foundation: COMPLETE
Core: COMPLETE | Content: COMPLETE | Intel: COMPLETE
Frontend: [STATUS] - [task]
Polish: [STATUS] - [task]
━━━━━━━━━━━━━━━━━
Actions: [what you spawned]
Next heartbeat ~5 min
```

## Critical Rules
1. **SPAWN agents** — do NOT just read and report
2. **Status ≠ COMPLETE → spawn it**
3. Sub-agents read their own `agents.md` — don't paste full instructions
4. Update timestamps to detect stalls
5. Re-read before editing — no stale content
6. Include runtime paths in every spawn
7. Frontend proceeds parallel with backends
8. Every spawn mentions LESSONS.md + COMPLETED-TASKS.md
9. Log ≤ 10 entries in PROGRESS.md

---

## Phase Progression

### Phases 1-20: ALL COMPLETE
Foundation, backends, frontend, integration, security, tests, docs, performance, UX, infra, final recheck, design overhaul, E2E testing, demo mode, mobile/PWA, analytics, onboarding, QA blitz.

### Phase 13: Frontend Design Overhaul 🎨 (CURRENT — HIGHEST PRIORITY)

**ALL Phase 13 agents MUST read (in order):**
1. `C:\Users\dongu\atlas\atlas-assets\DESIGN-SPEC.md` — authoritative visual spec
2. ALL mockup images in `C:\Users\dongu\atlas\atlas-assets\mockups\` (00-08) — pixel-perfect reference
3. `C:\Users\dongu\atlas\atlas-assets\design-tokens.css` — CSS custom properties

**Frontend** (tasks 13.1-13.13):
```
label: "frontend"
task: "Frontend agent (Prism). Workspace: C:\Users\dongu\atlas. Windows PowerShell (use ; not &&). Node 24.14.0/npm 11.9.0. Read memory\LESSONS.md + memory\COMPLETED-TASKS.md. PHASE 13 DESIGN OVERHAUL — MANDATORY: Read atlas-assets\DESIGN-SPEC.md front to back. Study ALL mockup images in atlas-assets\mockups\ (00-08) as pixel-perfect reference. Read design-tokens.css. Read frontend\PROGRESS.md, find FIRST unchecked Phase 13 task, execute. Rules: (1) No hardcoded hex — CSS vars only. (2) Glassmorphism on all panels. (3) Every card: hover translateY+shadow+photo zoom. (4) Unsplash photos per DESIGN-SPEC. (5) prefers-reduced-motion. (6) Scoped styles only. After: mark [x] in frontend\PROGRESS.md, log entry, git add . ; git commit -m 'feat(frontend): 13.X — desc'. Log lessons to memory\LESSONS.md. Branch: feature/frontend."
```

**Polish** (tasks 13.14-13.18, AFTER Frontend finishes 13.1-13.13):
```
label: "polish"
task: "Polish agent (Luster). Workspace: C:\Users\dongu\atlas. Windows PowerShell (use ; not &&). Node 24.14.0/npm 11.9.0. Read memory\LESSONS.md + memory\COMPLETED-TASKS.md. PHASE 13 POLISH: Read atlas-assets\DESIGN-SPEC.md. Study ALL mockups in atlas-assets\mockups\ (00-08). Read polish\PROGRESS.md, find FIRST unchecked task. Tasks: 13.14 Micro-Animations, 13.15 Typography, 13.16 Dark Mode Audit, 13.17 Demo Photos, 13.18 Final QA. Use design tokens. prefers-reduced-motion. Validate: npm run build ; npm run test. After: mark [x], log entry, git add . ; git commit -m 'polish(frontend): 13.X — desc'. Branch: feature/frontend."
```

### Phase 14: E2E Testing 🧪
```
label: "frontend"
task: "Frontend agent (Prism). Workspace: C:\Users\dongu\atlas. PowerShell (;). Node 24.14.0/npm 11.9.0. Read memory\LESSONS.md + memory\COMPLETED-TASKS.md. PHASE 14 E2E: Playwright + 3 browsers (Chromium/Firefox/WebKit). Mock /api/* for deterministic data. Tests: auth, map, spot CRUD, trip, social, nav+guards, theme toggle. HTML report. Read frontend\PROGRESS.md, first unchecked Phase 14 task, execute, mark [x], commit. Branch: feature/frontend."
```

### Phase 15: Demo Mode 🌱
```
label: "frontend"
task: "Frontend agent (Prism). Workspace: C:\Users\dongu\atlas. PowerShell (;). Node 24.14.0/npm 11.9.0. Read memory\LESSONS.md + memory\COMPLETED-TASKS.md. Study mockups for visual ref. PHASE 15 DEMO: Create src/mock/ with JSON fixtures — 5 users (pravatar.cc), 20 spots (Unsplash from DESIGN-SPEC, real coords), 3 trips, 15 feed items, 10 notifications. VITE_DEMO_MODE=true toggle. Demo login: demo@atlas.travel / Atlas2024!. Update README. Read frontend\PROGRESS.md, execute, mark [x], commit. Branch: feature/frontend."
```

### Phase 16: Monitoring 📊

**Core:**
```
label: "core"
task: "Core agent. Workspace: C:\Users\dongu\atlas. PowerShell (;). .NET 8.0.419. Read memory\LESSONS.md + memory\COMPLETED-TASKS.md. PHASE 16: OpenTelemetry SDK + custom metrics. Correlation ID propagation. Structured error logging. Mark [x] in core\PROGRESS.md, commit. Branch: feature/core-platform."
```

**Content:**
```
label: "content"
task: "Content agent. Workspace: C:\Users\dongu\atlas. PowerShell (;). Python 3.14.3. Read memory\LESSONS.md + memory\COMPLETED-TASKS.md. PHASE 16: django-prometheus + custom gauges. Correlation ID propagation. Structured error logging. Mark [x] in content\PROGRESS.md, commit. Branch: feature/content-engine."
```

**Intel:**
```
label: "intel"
task: "Intel agent. Workspace: C:\Users\dongu\atlas. PowerShell (;). Python 3.14.3. Read memory\LESSONS.md + memory\COMPLETED-TASKS.md. PHASE 16: prometheus-flask-instrumentator + ML metrics. Correlation ID propagation. Structured error logging. Mark [x] in intel\PROGRESS.md, commit. Branch: feature/intel-api."
```

### Phase 17: Mobile & PWA 📱
```
label: "frontend"
task: "Frontend agent (Prism). Workspace: C:\Users\dongu\atlas. PowerShell (;). Node 24.14.0/npm 11.9.0. Read memory\LESSONS.md + memory\COMPLETED-TASKS.md. Study mockups. PHASE 17 MOBILE: Responsive breakpoints (<640/640-1024/>1024). Mobile hamburger nav, map bottom-sheet, single-col explore, stacked profile, step-wizard trip. PWA manifest+SW+iOS safe-area. Read frontend\PROGRESS.md, execute, mark [x], commit. Branch: feature/frontend."
```

### Phase 18: Analytics 📈
```
label: "frontend"
task: "Frontend agent (Prism). Workspace: C:\Users\dongu\atlas. PowerShell (;). Node 24.14.0/npm 11.9.0. Read memory\LESSONS.md + memory\COMPLETED-TASKS.md. PHASE 18 ANALYTICS: analyticsService.ts abstraction. Page views (router afterEach), user actions, engagement. Cookie consent banner. Opt-out in Settings. Read frontend\PROGRESS.md, execute, mark [x], commit. Branch: feature/frontend."
```

### Phase 19: Onboarding 🎓
```
label: "frontend"
task: "Frontend agent (Prism). Workspace: C:\Users\dongu\atlas. PowerShell (;). Node 24.14.0/npm 11.9.0. Read memory\LESSONS.md + memory\COMPLETED-TASKS.md. Study DESIGN-SPEC+mockups for styling. PHASE 19 ONBOARDING: OnboardingOverlay.vue spotlight tutorial (Welcome/Drop Pin/Explore/Plan Trip/Connect). Progress dots, skip, localStorage persist, Replay in Settings. Read frontend\PROGRESS.md, execute, mark [x], commit. Branch: feature/frontend."
```

### Phase 20: QA Blitz 🏁

**Frontend:**
```
label: "frontend"
task: "Frontend agent (Prism). Workspace: C:\Users\dongu\atlas. PowerShell (;). Node 24.14.0/npm 11.9.0. Read memory\LESSONS.md + memory\COMPLETED-TASKS.md. PHASE 20 QA: Lighthouse every page (Perf>90, A11y>95, BP>95, SEO>90). Form edge cases. Keyboard nav. Cross-browser. npm run build ; npm run test — fix ALL. QA-REPORT.md. Fix Critical/High. Read frontend\PROGRESS.md, execute, mark [x], commit. Branch: feature/frontend."
```

**Core:**
```
label: "core"
task: "Core agent. Workspace: C:\Users\dongu\atlas. PowerShell (;). .NET 8.0.419. Read memory\LESSONS.md + memory\COMPLETED-TASKS.md. PHASE 20 QA: dotnet build ; dotnet test — fix ALL. Verify CORS. Code hygiene. Mark [x] in core\PROGRESS.md, commit. Branch: feature/core-platform."
```

**Content:**
```
label: "content"
task: "Content agent. Workspace: C:\Users\dongu\atlas. PowerShell (;). Python 3.14.3. Read memory\LESSONS.md + memory\COMPLETED-TASKS.md. PHASE 20 QA: Photo upload edge cases. pytest — fix ALL. Code hygiene. Mark [x] in content\PROGRESS.md, commit. Branch: feature/content-engine."
```

**Intel:**
```
label: "intel"
task: "Intel agent. Workspace: C:\Users\dongu\atlas. PowerShell (;). Python 3.14.3. Read memory\LESSONS.md + memory\COMPLETED-TASKS.md. PHASE 20 QA: AI itinerary edge cases. pytest — fix ALL. Code hygiene. Mark [x] in intel\PROGRESS.md, commit. Branch: feature/intel-api."
```

### Phase 21: Native Geospatial Engine 🗺️ (C++ → Python via pybind11)

**Intel** (tasks 21.1-21.7):
```
label: "intel"
task: "Intel agent (Oracle). Workspace: C:\Users\dongu\atlas. PowerShell (;). Python 3.14.3. Read memory\LESSONS.md + memory\COMPLETED-TASKS.md. PHASE 21 NATIVE GEO: Build a C++ geospatial computation library in atlas_geo/ with pybind11 bindings. FIRST: Install C++ toolchain if missing (winget install Microsoft.VisualStudio.2022.BuildTools --force --override '--add Microsoft.VisualStudio.Workload.VCTools'). Then install CMake (winget install Kitware.CMake). Tasks: 21.1 Scaffold atlas_geo/ with CMakeLists.txt + pybind11 fetch. 21.2 Haversine distance (src/haversine.cpp + GoogleTest). 21.3 R-tree spatial index (src/rtree.cpp — nearest-neighbor spot queries). 21.4 A*/Dijkstra pathfinding (src/pathfinding.cpp — route optimization). 21.5 Convex hull + viewport clustering (src/hull.cpp, src/cluster.cpp). 21.6 pybind11 module (python/atlas_geo_bindings.cpp) + pytest integration tests. 21.7 Wire into Intel route_optimizer.py + recommendation_engine.py — replace Python math with native calls. Validate: cmake --build build ; ctest --test-dir build ; python -m pytest atlas_geo/tests/. Read intel\PROGRESS.md, find FIRST unchecked Phase 21 task, execute, mark [x], commit. Branch: feature/native-geo."
```

### Phase 22: Native Image Processing Pipeline 📸 (C via ctypes)

**Content** (tasks 22.1-22.6):
```
label: "content"
task: "Content agent (Cartographer). Workspace: C:\Users\dongu\atlas. PowerShell (;). Python 3.14.3. Read memory\LESSONS.md + memory\COMPLETED-TASKS.md. PHASE 22 NATIVE MEDIA: Build a pure C image processing library in atlas_media/. FIRST: Ensure C compiler is available (cl.exe from VS Build Tools or gcc from MinGW — check with 'where cl' or 'where gcc'). Tasks: 22.1 Scaffold atlas_media/ with Makefile + include/atlas_media.h. 22.2 Image format detection from magic bytes (src/detect.c). 22.3 EXIF metadata stripping (src/exif.c). 22.4 Thumbnail generation with bilinear interpolation (src/thumbnail.c). 22.5 Blurhash encoding for progressive placeholders (src/blurhash.c). 22.6 Python ctypes integration tests + wire into Content photos/services.py upload pipeline. Validate: make test ; python -m pytest atlas_media/tests/. Read content\PROGRESS.md, find FIRST unchecked Phase 22 task, execute, mark [x], commit. Branch: feature/native-media."
```

### Phase 23: WebAssembly Client Module 🌐 (C++ → WASM)

**Frontend** (tasks 23.1-23.5):
```
label: "frontend"
task: "Frontend agent (Prism). Workspace: C:\Users\dongu\atlas. PowerShell (;). Node 24.14.0/npm 11.9.0. Read memory\LESSONS.md + memory\COMPLETED-TASKS.md. PHASE 23 WASM: Compile C++ spatial algorithms to WebAssembly via Emscripten for client-side map computations. FIRST: Install Emscripten SDK (git clone https://github.com/emscripten-core/emsdk.git atlas-frontend/emsdk ; cd atlas-frontend/emsdk ; .\emsdk.ps1 install latest ; .\emsdk.ps1 activate latest). Tasks: 23.1 Scaffold atlas-frontend/wasm/ with CMakeLists.txt for Emscripten build. 23.2 Port viewport clustering algorithm to wasm/src/atlas_wasm.cpp. 23.3 Add client-side haversine + convex hull for map UI labels. 23.4 Create src/services/wasmService.ts — async WASM loader + typed wrappers. 23.5 Wire into MapView.vue for marker clustering + distance labels. Validate: emcmake cmake . ; emmake make in wasm/ ; npm run build ; npm run test. Read frontend\PROGRESS.md, find FIRST unchecked Phase 23 task, execute, mark [x], commit. Branch: feature/wasm."
```

### Phase 24: CLI Toolkit 🦀 (Rust)

**Core** (tasks 24.1-24.6):
```
label: "core"
task: "Core agent (Sentinel). Workspace: C:\Users\dongu\atlas. PowerShell (;). Read memory\LESSONS.md + memory\COMPLETED-TASKS.md. PHASE 24 RUST CLI: Build a Rust-based CLI tool in atlas-cli/ for cross-service operations. FIRST: Install Rust (Invoke-WebRequest -Uri https://win.rustup.rs -OutFile rustup-init.exe ; .\rustup-init.exe -y). Tasks: 24.1 Scaffold atlas-cli/ with Cargo.toml (clap, reqwest, tokio, serde, colored). 24.2 atlas health — parallel async health checks across all 3 backend services with colored output. 24.3 atlas seed — parse and execute SQL seed files from seeds/. 24.4 atlas deploy validate — pre-deployment checklist (env vars, Docker, ports, certs). 24.5 atlas benchmark — HTTP load testing with configurable concurrency against API endpoints. 24.6 atlas env check — validate .env against .env.example and report missing/extra vars. Validate: cargo build ; cargo test. Read core\PROGRESS.md, find FIRST unchecked Phase 24 task, execute, mark [x], commit. Branch: feature/rust-cli."
```

### Phase 25: Metrics Agent 📡 (Go)

**Intel** (tasks 25.1-25.5):
```
label: "intel"
task: "Intel agent (Oracle). Workspace: C:\Users\dongu\atlas. PowerShell (;). Read memory\LESSONS.md + memory\COMPLETED-TASKS.md. PHASE 25 GO METRICS: Build a lightweight Go metrics daemon in atlas-metrics/ that exports Prometheus metrics. FIRST: Install Go (winget install GoLang.Go). Tasks: 25.1 Scaffold atlas-metrics/ with go.mod (prometheus/client_golang, gorilla/mux). 25.2 System metrics collector — CPU, memory, disk usage via gopsutil. 25.3 Application probes — HTTP health checks against all 3 backend services with latency tracking. 25.4 Prometheus /metrics endpoint + custom app gauges/counters. 25.5 Alert rule config (YAML) + webhook dispatcher for threshold violations. Validate: go test ./... . Add Dockerfile + docker-compose.yml service entry. Read intel\PROGRESS.md, find FIRST unchecked Phase 25 task, execute, mark [x], commit. Branch: feature/go-metrics."
```

### Phase 26: Cloud Deployment & Infrastructure ☁️ (Terraform + K8s)

**Foundation** (tasks 26.1-26.6):
```
label: "foundation"
task: "Foundation agent (Architect). Workspace: C:\Users\dongu\atlas. PowerShell (;). Read memory\LESSONS.md + memory\COMPLETED-TASKS.md. PHASE 26 CLOUD DEPLOY: Complete infrastructure deployment using Terraform + Kubernetes. FIRST: Install Terraform (winget install Hashicorp.Terraform). Tasks: 26.1 terraform init + terraform validate on existing terraform/ configs — fix any issues. 26.2 Add AWS provider config + S3 backend state + DynamoDB lock table. 26.3 Add Prometheus + Grafana K8s manifests (k8s/08-monitoring.yaml) + scrape configs for atlas-metrics. 26.4 Update GitHub Actions deploy workflow with OIDC auth + terraform plan/apply steps. 26.5 Wire atlas-metrics + atlas-cli into docker-compose.yml and k8s manifests. 26.6 Production smoke test script (scripts/smoke-test.ps1) — validates all services + metrics endpoint. Validate: terraform validate ; terraform plan (dry-run). Read foundation\PROGRESS.md, find FIRST unchecked Phase 26 task, execute, mark [x], commit. Branch: feature/cloud-deploy."
```

### Post-Phase 26: Release
After ALL agents complete Phases 21-26:
- Final `docker-compose up` smoke test with all 7 services
- Run atlas-cli health check
- Aggregate QA reports from all agents
- Fix remaining Critical/High
- Merge feature branches → `main`
- Tag `v2.0.0-rc1`
- Create GitHub Release draft
