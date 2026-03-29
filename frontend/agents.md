# Atlas â€” AI Agent Instructions

## What is Atlas?
Atlas is a real-world adventure platform where users document, discover, and plan experiences on an interactive map. Users drop pins, upload photos, write stories, and share adventures with friends. An AI engine plans optimized itineraries from community data.

**Elevator Pitch:** "PokÃ©mon Go meets Instagram â€” real places, real photos, real adventures on a map."

## Architecture Overview
Polyglot microservices with 3 backends + 1 frontend:

| Service | Framework | Directory | Responsibility |
|---------|-----------|-----------|---------------|
| Core Platform | C# / ASP.NET Core 8 | `Atlas.Core/` | Auth, real-time (SignalR), users, friends, notifications |
| Content Engine | Python / Django 5 | `atlas_content/` | Spots, trips, photos, reviews, social feed |
| Intelligence API | Python / Flask 3 | `atlas_intel/` | AI itineraries, recommendations, vibe matching |
| Frontend | Vue.js 3 / TypeScript | `atlas-frontend/` | All UI, Mapbox maps, Pinia state, dark/light mode |

**Communication:**
- Frontend â†’ Nginx â†’ Services (REST)
- Service â†” Service (Kafka events)
- Core â†’ Frontend (SignalR WebSocket for real-time)

## Critical Rules for Agents
1. **Read `atlas_architecture.tex` FIRST** â€” it is the single source of truth (~2600 lines)
2. **Never merge microservices** â€” each service is independent with its own Dockerfile
3. **Never skip security** â€” rate limiting, input validation, JWT auth on every endpoint
4. **Write tests for everything** â€” xUnit (C#), Pytest (Python), Vitest (Vue)
5. **Follow the build order** â€” Foundation â†’ Core â†’ Content â†’ Intel â†’ Frontend â†’ Integration
6. **Commit after EVERY milestone** â€” see commit strategy in the architecture doc
7. **Never hardcode secrets** â€” use environment variables from `.env`
8. **Use the exact tech stack** â€” no substitutions without explicit approval
9. **Reason through edge cases independently** â€” the user will provide minimal guidance
10. **Service boundaries are sacred** â€” services NEVER access another service's database tables

## Database
Single SQL Server instance with logical schema separation:
- `core.*` â€” Users, Friendships, Notifications, LiveSessions
- `content.*` â€” Spots, Photos, Trips, TripSpots, TripMembers, Reviews, Likes
- `intel.*` â€” ItineraryCache, UserPreferences, SpotFeatures

## Key Files
- `atlas_architecture.tex` â€” Full architecture spec (THE source of truth)
- `atlas-assets/design-tokens.css` â€” CSS custom properties for dark/light mode
- `atlas-assets/icons/atlas-icons.svg` â€” 38 SVG icons
- `.env.example` â€” All environment variables (agent creates from template)

## Design System
- **Dark mode default**, light mode toggle via `ThemeToggle.vue`
- **Colors:** Emerald Teal `#10b981` (primary), Warm Gold `#f59e0b` (accent)
- **Font:** Inter from Google Fonts
- **All colors via CSS variables** â€” never hardcode hex values in components

## Commit Format
```
<type>(<scope>): <short description>
```
Types: `feat`, `fix`, `docs`, `chore`, `test`, `refactor`, `style`, `ci`

**Commit after EVERY milestone. Never batch features into one commit.**


---

# Agent 4: Frontend â€” Task Instructions

## Your Role
You are the **Frontend Agent** (codename: **Prism**). You build the Vue.js 3 + TypeScript single-page application with Mapbox maps, Pinia state management, dark/light mode, and SignalR real-time features.

## Your Directory Scope
You own: `atlas-frontend/` (and ALL subdirectories)

**Do NOT create or modify** anything outside `atlas-frontend/`.

## Reference
Read `atlas_architecture.tex` â€” Sections 8, 9, 20, and Appendix A + B.
Read `atlas-assets/design-tokens.css` for the complete color/spacing/typography system.
Read `atlas-assets/icons/atlas-icons.svg` for available icon IDs.

## Prerequisites
Agents 1, 2, 3 (all backends) should be complete. You need working API endpoints to connect to.

## Tasks (in order)

### 1. Scaffold Project
```bash
npm create vite@latest ./ -- --template vue-ts
npm install vue-router pinia axios mapbox-gl @microsoft/signalr @vueuse/core
npm install -D vitest @playwright/test eslint eslint-plugin-vue @types/mapbox-gl
```

### 2. Design System
- Copy `atlas-assets/design-tokens.css` into `src/assets/`
- Add Inter font from Google Fonts to `index.html`
- Dark mode is DEFAULT
- Implement `ThemeToggle.vue`:
  - Toggles `data-theme` attribute on `<html>`
  - Persists choice in `localStorage`
  - Uses sun/moon icons from `atlas-icons.svg`

### 3. Common Components
Build reusable components in `src/components/common/`:
- `Navbar.vue` â€” logo, nav links (Home, Explore, Map, Trips), search, notifications bell with badge, user avatar dropdown, ThemeToggle
- `Sidebar.vue` â€” collapsible left sidebar for filters
- `Button.vue` â€” primary (teal), secondary (outline), danger variants
- `Modal.vue` â€” overlay modal with close button
- `Toast.vue` â€” success/error/info notifications
- `LoadingSpinner.vue` â€” centered spinner with teal color
- `Avatar.vue` â€” circular image with fallback initials
- `SearchBar.vue` â€” with debounced input

### 4. Auth Pages
- `LoginPage.vue` â€” email/password form, "Login with Google" (Cognito OAuth), link to register
- `RegisterPage.vue` â€” username, email, password, display name, submit

### 5. Map Components
- `MapView.vue` â€” full-screen Mapbox GL map, switches style based on theme
- `SpotMarker.vue` â€” custom marker with category icon and color
- `RouteLayer.vue` â€” draw route lines between trip spots
- `LocationTracker.vue` â€” user's live GPS position
- `MapControls.vue` â€” zoom in/out, center on user, filter toggles

### 6. Spot Components
- `SpotCard.vue` â€” photo, title, category badge, rating stars, city
- `SpotDetail.vue` â€” full spot info, photo gallery, reviews, mini-map
- `SpotForm.vue` â€” create/edit spot with map pin picker, photo upload, category dropdown
- `PhotoGallery.vue` â€” masonry grid of photos with lightbox
- `ReviewList.vue` â€” list of reviews with avatar, rating, comment
- `ReviewForm.vue` â€” star rating picker + comment textarea

### 7. Trip Components
- `TripCard.vue` â€” cover photo, title, dates, member count
- `TripDetail.vue` â€” timeline view of trip with spots per day
- `TripPlanner.vue` â€” create trip wizard with AI itinerary button
- `TripTimeline.vue` â€” vertical timeline with day headers and spot cards
- `MemberList.vue` â€” trip members with role badges
- `ItineraryView.vue` â€” AI-generated itinerary with map route and cost breakdown

### 8. Social Components
- `FeedItem.vue` â€” activity card (user dropped pin, completed trip, etc.)
- `UserCard.vue` â€” avatar, name, stats, add friend button
- `FriendList.vue` â€” list with online status
- `NotificationDropdown.vue` â€” notification list with mark as read

### 9. Profile Components
- `ProfileHeader.vue` â€” avatar, name, bio, stats (spots/trips/friends), edit button
- `ProfileMap.vue` â€” map showing all user's pins
- `ProfileStats.vue` â€” stat counters with icons
- `SettingsForm.vue` â€” update name, bio, avatar, privacy, preferences

### 10. Page Views
Build all views in `src/views/` using the components above:

| Page | Route | Layout |
|------|-------|--------|
| HomePage | `/` | Hero + featured spots + CTA |
| ExplorePage | `/explore` | Search + filter chips + 4-column spot grid |
| MapPage | `/map` | Full-screen map + sidebar |
| TripPlannerPage | `/trips/new` | Wizard form |
| TripDetailPage | `/trips/:id` | Timeline + map |
| SpotDetailPage | `/spots/:id` | Photos + info + reviews + map |
| ProfilePage | `/profile/:id` | Header + map + adventures grid |
| FriendsPage | `/friends` | Friend list + requests + search |
| SettingsPage | `/settings` | Settings form |
| LoginPage | `/login` | Centered form |
| RegisterPage | `/register` | Centered form |
| NotFoundPage | `/:pathMatch(.*)*` | 404 message |

### 11. Pinia Stores
- `auth.ts` â€” JWT tokens, current user, login/logout/refresh actions
- `user.ts` â€” user profile CRUD
- `spots.ts` â€” spot CRUD, nearby, liked, pagination
- `trips.ts` â€” trip CRUD, members, active trip
- `map.ts` â€” center, zoom, visible markers, active filters
- `notifications.ts` â€” list, unread count, SignalR connection
- `feed.ts` â€” feed items, trending, pagination

### 12. Router & Guards
- Define all routes in `router/index.ts`
- Auth guard: redirect to `/login` if no valid token
- Guest guard: redirect to `/map` if already logged in

### 13. API Services
- `api.ts` â€” Axios instance with base URL, JWT interceptor, error handling
- `authService.ts` â€” login, register, refresh, logout
- `spotService.ts` â€” all spot CRUD + nearby + explore
- `tripService.ts` â€” all trip CRUD + members + spots
- `feedService.ts` â€” feed + trending
- `intelService.ts` â€” itinerary, recommendations, vibe match
- `mapService.ts` â€” geocode, reverse geocode
- `signalrService.ts` â€” connect to all 3 hubs
- `s3Service.ts` â€” presigned upload

### 14. SignalR Integration
```typescript
const connection = new signalR.HubConnectionBuilder()
  .withUrl('/api/core/hubs/notifications', {
    accessTokenFactory: () => authStore.token
  })
  .withAutomaticReconnect()
  .build();
```

### 15. Dockerfile
From Section 17.4. Multi-stage: node build â†’ nginx static serve.

## Color Rules
- NEVER hardcode hex colors â€” always use `var(--token-name)`
- Category badges use the classes from `design-tokens.css`
- Primary action: `var(--accent-teal)`
- Secondary accent: `var(--accent-gold)`

## Commits
```
feat(frontend): scaffold Vite + Vue 3 + TypeScript
feat(frontend): add design tokens and dark/light theme
feat(frontend): build Navbar and common components
feat(frontend): build login and registration pages
feat(frontend): build MapView with Mapbox GL
feat(frontend): build SpotCard and SpotDetail
feat(frontend): build SpotForm with photo upload
feat(frontend): build TripPlanner and ItineraryView
feat(frontend): build social feed and notifications
feat(frontend): build profile page with adventure map
feat(frontend): build explore page with filters
feat(frontend): add Pinia stores for all modules
feat(frontend): add Vue Router with auth guards
feat(frontend): add SignalR client integration
feat(frontend): add Axios API services
style(frontend): polish responsive layout
chore(frontend): add Dockerfile
```

## Branch
Work on: `feature/frontend`

## Success Criteria
- All 12 pages render correctly in dark and light mode
- Map displays with custom markers and route layers
- Auth flow works: register â†’ login â†’ protected pages
- Spots: create â†’ view â†’ edit â†’ delete â†’ like
- Trips: create â†’ add spots â†’ generate AI itinerary â†’ view timeline
- Real-time: notifications arrive via SignalR
- Responsive: works on 1024px+ screens (desktop web app, NOT mobile)
- Docker build produces clean nginx container
