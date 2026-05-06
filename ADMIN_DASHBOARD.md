# Scope Admin Dashboard - Codex Build Spec

## Overview

Build `scope-admin/`, a Vue 3 + TypeScript internal admin dashboard for Scope. This is a separate frontend service and does not touch the existing user-facing Vue frontend. It consumes the existing Core, Content, and Intel APIs via REST.

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Vue 3 + TypeScript |
| Build | Vite |
| Routing | Vue Router |
| State | Pinia |
| HTTP | Axios |
| Styling | Tailwind CSS plus local admin styles |
| Auth | JWT, same tokens as Core API |
| Testing | Vitest + Vue Test Utils + Playwright |
| Linting | ESLint + vue-tsc |
| Container | Docker multi-stage, Nginx serve |

## Directory Structure

```text
scope-admin/
├── Dockerfile
├── nginx.conf
├── package.json
├── tsconfig.json
├── vite.config.ts
├── tailwind.config.ts
├── index.html
├── public/
│   └── favicon.svg
├── src/
│   ├── main.ts
│   ├── App.vue
│   ├── router.ts
│   ├── api/
│   │   ├── client.ts
│   │   ├── core.ts
│   │   ├── content.ts
│   │   └── intel.ts
│   ├── stores/
│   │   ├── authStore.ts
│   │   └── dashboardStore.ts
│   ├── components/
│   │   └── AdminShell.vue
│   ├── pages/
│   │   ├── LoginPage.vue
│   │   ├── DashboardPage.vue
│   │   ├── UsersPage.vue
│   │   ├── UserDetailPage.vue
│   │   ├── SpotsPage.vue
│   │   ├── ReviewsPage.vue
│   │   ├── PhotosPage.vue
│   │   └── SimplePage.vue
│   ├── types/
│   └── utils/
├── tests/
│   ├── unit/
│   └── e2e/
└── .env.example
```

## Pages

### LoginPage

- Email and password form
- POST `/api/core/auth/login`, store JWT in Pinia plus `localStorage`
- Redirect to `/admin/dashboard` on success
- Show an error state on failure
- Admin-only gate: after login, GET `/api/core/users/me` and check role

### DashboardPage

- Stat cards for total users, spots, trips, reviews, and active sessions
- Recent activity feed
- Quiet operational layout suited for repeated admin work

### UsersPage

- Search by username or email
- Server-side pagination
- Row actions for view, ban/unban, and delete where supported by the API

### UserDetailPage

- User profile summary
- Activity, spots, trips, and friends sections
- Admin actions where supported by the API

### SpotsPage

- Spot list with moderation flags
- Search by name
- Filter by flagged state

### ReviewsPage

- Flagged reviews first
- Inline approve, reject, and delete actions where supported by the API

### PhotosPage

- Moderation grid with uploaded photo thumbnails
- Pending, approved, and rejected filters

### Placeholder Admin Pages

- Trips, analytics, and settings can use `SimplePage.vue` until deeper APIs are ready.

## API Integration

Use the existing Scope APIs. Do not create new backend routes unless a real backend gap is confirmed.

Core API:

- `POST /api/core/auth/login`
- `GET /api/core/users/me`
- `GET /api/core/users`
- `GET /api/core/users/{id}`
- `PATCH /api/core/users/{id}/status`
- `DELETE /api/core/users/{id}`

Content API:

- `GET /api/content/spots/`
- `GET /api/content/trips/`
- `GET /api/content/reviews/`
- `GET /api/content/photos/`

Intel API:

- `GET /api/intel/health`

## Auth Flow

1. Admin logs in through Core API and receives a JWT.
2. Pinia `authStore` stores the JWT and mirrors it to `localStorage`.
3. Axios attaches `Authorization: Bearer <token>` to API requests.
4. A 401 response clears auth state and redirects to `/admin/login`.
5. Vue Router guards protect all admin routes except login.

## Styling Requirements

- Dark mode by default
- Desktop-first admin layout with responsive fallbacks
- Sidebar navigation with compact icon labels
- Tables and dense lists should remain readable at 1024px+
- Match Scope brand colors without adding a separate design system

## Docker Setup

The dashboard builds to static assets and is served by Nginx.

```dockerfile
FROM node:24-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
ARG VITE_API_BASE_URL=/
RUN npm run build

FROM nginx:1.27-alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 8081
```

## Docker Compose Integration

Add an `admin` service that builds `./scope-admin`, exposes port `8081` internally, and routes through the root Nginx `/admin/` location.

## Testing Requirements

- Unit tests: auth store login/logout/error behavior and API auth handling
- E2E tests: login flow, invalid login, dashboard navigation, users search, spot/review/photo moderation surfaces
- Minimum validation:
  - `npm run build`
  - `npm run test`
  - `npm run test:e2e`

## What Not To Do

- Do not add component files outside Vue single-file components.
- Do not add native mobile clients.
- Do not create new backend APIs for admin-only convenience.
- Do not use a separate database.
