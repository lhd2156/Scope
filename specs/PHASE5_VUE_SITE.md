# Phase 5: Vue Marketing Site - Codex Build Spec

> Scope: create `scope-site/`, a public-facing Vue 3 + Vite marketing website with SEO-friendly static pages, blog-style content, and web app launch links.
> Prerequisites: none. The site is independent from the API services.
> Do not modify: Core, Content, Intel, RAG, Metrics, CLI, media, or geo services unless routing integration requires a compose/nginx update.

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Vue 3 |
| Language | TypeScript |
| Build | Vite |
| Routing | Vue Router |
| Styling | CSS plus Tailwind-compatible tokens where useful |
| Container | Docker multi-stage, Nginx static serve |
| Testing | Playwright smoke tests |

## Directory Structure

```text
scope-site/
├── Dockerfile
├── nginx.conf
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
├── tailwind.config.ts
├── .env.example
├── public/
│   └── favicon.svg
├── src/
│   ├── main.ts
│   ├── router.ts
│   ├── App.vue
│   ├── data.ts
│   ├── style.css
│   └── pages/
│       ├── HomePage.vue
│       ├── FeaturesPage.vue
│       ├── AboutPage.vue
│       ├── DownloadPage.vue
│       ├── BlogPage.vue
│       ├── BlogPostPage.vue
│       └── LegalPage.vue
└── tests/
    └── e2e/
        └── site.spec.ts
```

## Pages

### Home

- First viewport clearly communicates Scope as a real-world adventure platform.
- Include the core product actions: explore features, open the web app, and read updates.
- Use real product language, not framework marketing.

### Features

- Cover interactive maps, AI itinerary planning, social discovery, photo stories, smart search, and web-first access.

### About

- Explain the project story and architecture at a high level.

### Download

- Web app launch link is the primary action.
- Do not include native mobile download badges unless native clients are reintroduced.

### Blog

- Use local TypeScript data or plain markdown-derived content.
- Do not add framework-specific content loaders beyond the Vue/Vite stack.

### Privacy and Terms

- Static legal content with readable typography.

## Docker and Routing

- Build static assets with `npm run build`.
- Serve `dist/` from Nginx.
- Support deployment under `/site/` via `VITE_SITE_BASE_PATH=/site/`.
- Root Nginx should proxy `/site/` to the site service using Vite static assets.

## Testing Requirements

- `npm run build`
- `npm run test:e2e`
- Confirm no non-Vue frontend runtime, component-file extension, MDX runtime, or native mobile dependency is introduced.

## What Not To Do

- Do not add component files outside Vue single-file components.
- Do not add framework-specific animation, icon, or content-rendering packages.
- Do not add native mobile launch surfaces.
