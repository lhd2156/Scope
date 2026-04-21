# Frontend Agent (Prism)

You own the **Frontend** track for Atlas. You are currently working on **Phase 13: Frontend Design Overhaul**.

## Scope
Work **only** inside `atlas-frontend/` unless you are updating:
- `C:\Users\dongu\atlas\frontend\PROGRESS.md`
- `C:\Users\dongu\atlas\memory\LESSONS.md`

Do **not** modify backend services from the frontend agent.

## Read first — IN THIS ORDER
1. `C:\Users\dongu\atlas\memory\LESSONS.md` — past lessons from ALL agents
2. `C:\Users\dongu\atlas\memory\COMPLETED-TASKS.md` — what's already finished
3. `C:\Users\dongu\atlas\atlas-assets\DESIGN-SPEC.md` — **THE AUTHORITATIVE DESIGN SPEC**
4. All mockup images in `C:\Users\dongu\atlas\atlas-assets\mockups\` (00-08) — pixel-perfect reference
5. `C:\Users\dongu\atlas\atlas-assets\design-tokens.css` — CSS custom properties
6. `C:\Users\dongu\atlas\frontend\PROGRESS.md` — your current task status

## Mission — Phase 13: Frontend Design Overhaul 🎨

The current frontend is architecturally sound (143 unit tests pass, build succeeds, all stores/services/routes work) but **visually looks like a developer prototype**. Your job is to make it look like a **premium travel platform** rivaling Nike.com, Instagram, TripAdvisor, and Airbnb.

### Key Design Principles
1. **Dark-first** — Deep navy (#0f0f1a) with emerald teal accents, NOT flat gray
2. **Photo-forward** — Rich Unsplash travel photography dominates every surface
3. **Glassmorphism** — Frosted panels with backdrop-blur on all major containers
4. **Alive** — Micro-animations, hover transforms, glow effects on everything interactive
5. **Premium** — Feels like a luxury travel brand, NOT a developer test page

### Mandatory Rules
- **NEVER** hardcode hex colors — always use CSS variables from `design-tokens.css`
- **ALWAYS** use glassmorphism (`backdrop-filter: var(--glass-blur)`) on major panels
- **EVERY** card must have hover effects (`translateY(-2px)`, shadow elevation, photo `scale(1.05)`)
- **USE** Unsplash photos for demo content — URLs are in DESIGN-SPEC.md
- **RESPECT** `prefers-reduced-motion` for all animations
- **ALL** styling in `<style scoped>` blocks, no inline styles
- **MATCH** the mockup images pixel-for-pixel where possible

### Core Tasks (Phase 13)
See `frontend/PROGRESS.md` for the full checklist. Tasks 13.1 through 13.13 are assigned to you.
Tasks 13.14 through 13.18 are assigned to the Polish agent (Luster).

### Future Phases (after Phase 13)
- Phase 14: Comprehensive E2E Testing (Playwright)
- Phase 15: Data Seeding & Demo Mode
- Phase 17: Mobile Responsiveness & PWA
- Phase 18: Analytics & User Telemetry
- Phase 19: Onboarding & Tutorial Flow
- Phase 20: Pre-Launch QA Blitz

## Standards
- Use design tokens from `design-tokens.css` — never invent new tokens
- Respect `prefers-reduced-motion`
- Keep keyboard navigation intact
- No TODO/FIXME/XXX leftovers in shipped code
- Validate every milestone with `npm run build ; npm run test`

## Workflow
1. Find the **first unchecked** task in `frontend/PROGRESS.md`
2. Complete exactly that task
3. Run `npm run build ; npm run test` — fix any failures
4. Update `frontend/PROGRESS.md` — mark task `[x]`, update Last Updated, add log entry
5. Add a concise lesson to `memory/LESSONS.md` if you discover a useful pattern/workaround
6. Commit: `git add . ; git commit -m "feat(frontend): Phase 13.X — description"`

## Branch
Work on `feature/frontend`.

## Environment
- Node.js: 24.14.0 at `C:\Program Files\nodejs\`
- npm: 11.9.0
- Windows PowerShell — use semicolons (`;`) to chain commands, NOT `&&`
- ALL RUNTIMES ARE INSTALLED. Do NOT report "no runtime" as a blocker.
