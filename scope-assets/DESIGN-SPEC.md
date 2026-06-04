# Scope Frontend Design Specification

**READ THIS ENTIRE FILE BEFORE WRITING ANY FRONTEND CSS OR TEMPLATE CODE.**

This document is the authoritative visual design reference for Scope. Every page, component, and interaction must follow these specs exactly. The goal is a **premium, world-class travel platform** that rivals Nike.com, Instagram, TripAdvisor, and Airbnb in visual polish.

---

## Design Philosophy

Scope is NOT a generic SaaS dashboard. It is:
- **Dark-first** — Deep navy (#0f0f1a) with emerald teal accents, NOT flat gray
- **Photo-forward** — Rich travel photography dominates every surface, NOT text-heavy layouts
- **Glassmorphism-heavy** — Frosted panels with backdrop-blur, NOT opaque boxes
- **Alive** — Micro-animations, hover transforms, glow effects, NOT static pages
- **Premium** — Feels like a luxury travel brand, NOT a developer prototype

---

## Mockup Reference

All mockup images are in `scope-assets/mockups/`. Study these carefully:

| File | Page |
|------|------|
| `01_landing_page.png` | Home / Landing Page |
| `02_map_page.png` | Map Workspace |
| `03_spot_detail.png` | Spot Detail |
| `04_profile_page.png` | User Profile |
| `05_explore_page.png` | Explore / Discover |
| `06_trip_planner.png` | Trip Planner |
| `07_login_page.png` | Login |

---

## Global Design Rules

### Typography
```css
font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
```
- Hero headings: `clamp(2.5rem, 5vw, 4rem)`, weight 700, line-height 1.1
- Page titles (h1): `2rem`, weight 700
- Section titles (h2): `1.5rem`, weight 600
- Card titles (h3): `1.125rem`, weight 600
- Body text: `1rem`, weight 400, line-height 1.5
- Captions/eyebrows: `0.75rem`, weight 500, uppercase, letter-spacing 0.14em, color `var(--accent-teal)`

### Color Usage
- **Primary action buttons**: emerald teal `var(--accent-teal)` with subtle glow shadow `var(--shadow-glow-teal)`
- **Secondary accents**: warm gold `var(--accent-gold)` — used for star ratings, achievement badges, premium features
- **Category badges**: colored pills using the `.badge-*` classes from design-tokens.css
- **NEVER** use raw hex values — ALWAYS use CSS custom properties
- **NEVER** use pure white (#fff) as a background in dark mode — use `var(--bg-secondary)` or `var(--bg-elevated)`
- **NEVER** use pure black (#000) for text — use `var(--text-primary)` or `var(--text-secondary)`

### Glassmorphism Formula
Every major panel/card uses this pattern:
```css
.glass-panel {
 background: var(--glass-bg);       /* rgba(26, 26, 46, 0.7) dark / rgba(255,255,255,0.7) light */
 backdrop-filter: var(--glass-blur);   /* blur(12px) */
 -webkit-backdrop-filter: var(--glass-blur);
 border: 1px solid var(--glass-border);  /* rgba(255,255,255,0.08) dark / rgba(0,0,0,0.06) light */
 border-radius: var(--radius-xl);     /* 16px */
 box-shadow: var(--shadow-md);
}
```

### Surface Cards (Non-glass opaque cards)
```css
.surface-card {
 background: var(--bg-secondary);
 border: 1px solid var(--border);
 border-radius: var(--radius-xl);
 box-shadow: var(--shadow-sm);
 transition: transform var(--transition-fast), box-shadow var(--transition-fast), border-color var(--transition-fast);
}

.surface-card:hover {
 transform: translateY(-2px);
 box-shadow: var(--shadow-md);
 border-color: var(--border-hover);
}
```

### Button Styles
```css
/* Primary button — emerald teal with glow */
.button-primary {
 background: var(--accent-teal);
 color: #fff;
 border: none;
 border-radius: var(--radius-full);
 padding: 0.75rem 1.5rem;
 font-weight: var(--font-weight-semibold);
 box-shadow: var(--shadow-glow-teal);
 transition: transform var(--transition-fast), box-shadow var(--transition-fast), background var(--transition-fast);
}

.button-primary:hover {
 background: var(--accent-teal-hover);
 transform: translateY(-1px);
 box-shadow: 0 0 30px rgba(16, 185, 129, 0.4);
}

/* Secondary button — outline */
.button-secondary {
 background: transparent;
 color: var(--text-primary);
 border: 1px solid var(--border);
 border-radius: var(--radius-full);
 padding: 0.75rem 1.5rem;
 font-weight: var(--font-weight-semibold);
 transition: border-color var(--transition-fast), background var(--transition-fast);
}

.button-secondary:hover {
 border-color: var(--accent-teal);
 background: var(--accent-teal-light);
}
```

### Input Fields
```css
input, textarea, select {
 width: 100%;
 background: var(--input-bg);
 border: 1px solid var(--input-border);
 border-radius: var(--radius-lg);
 color: var(--text-primary);
 padding: 0.85rem 1rem;
 font-size: var(--font-size-body);
 transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
}

input:focus, textarea:focus, select:focus {
 border-color: var(--accent-teal);
 box-shadow: 0 0 0 3px var(--accent-teal-light);
 outline: none;
}
```

---

## Per-Page Design Specifications

### 1. Landing / Home Page (`/`)
**Reference mockup:** `01_landing_page.png`

**Layout:**
- Full-width hero section spanning viewport width, NOT constrained to `--page-max-width`
- Hero height: `min(80vh, 600px)`
- Hero background: high-quality travel photo (Unsplash) with dark gradient overlay `linear-gradient(180deg, rgba(15,15,26,0.3) 0%, rgba(15,15,26,0.85) 100%)`
- Glassmorphism content panel centered over hero with heading, subtext, CTA buttons
- Hero heading: "Your Adventures, Mapped." — large, bold, white
- Two CTA buttons: "Start Exploring" (primary teal), "Watch Demo" (secondary outline)
- Below hero: "Trending Destinations" section with 4-column grid of SpotCards
- Below trending: "Activity Feed" section with recent community activity

**Key visual elements:**
- Hero photo must be lazy-loaded with a CSS gradient placeholder
- SpotCards in trending section must show rich travel photos, NOT empty placeholders
- Stagger animation on section entry (fade-up with 100ms delay between cards)
- Use `SectionHeading` with teal eyebrow text

### 2. Map Page (`/map`)
**Reference mockup:** `02_map_page.png`

**Layout:**
- Full-height split: sidebar (320px fixed) + map (remaining width)
- Map fills entire remaining space edge-to-edge, NO padding around it
- Sidebar uses glassmorphism with vertical stack of filter/detail/list panels
- Category filter chips: colored active states matching their category color (food=green, nightlife=purple, culture=blue, adventure=gold)
- Selected spot card: shows photo thumbnail (aspect-ratio 16/9), category badge, title, rating, city, "Open Detail" link
- Route preview card uses gradient background: `radial-gradient(circle at top right, var(--accent-teal-light), transparent 45%)`
- Map markers: custom colored circles with category-specific colors, NOT default Mapbox pins
- Floating map controls (zoom, center, layers) as glassmorphism circular buttons in bottom-right

### 3. Explore Page (`/explore`)
**Reference mockup:** `05_explore_page.png`

**Layout:**
- Search bar: full-width, large, with magnifying glass icon, glassmorphism background
- Filter chip row: horizontal scrollable, pills for each category, active chip gets colored border + colored light background
- Main grid: 3-column CSS grid (NOT 4-column on standard screens) with `gap: var(--space-4)`
- Cards: rich photo (aspect-ratio 4/3), gradient overlay at bottom for text, category badge in top-left, heart/save icon in top-right, title + location + star rating below
- Right sidebar (280px): "Trending This Week" with numbered (#1-#8) list of mini spot items with small thumbnail

**Card hover effect:**
```css
.spot-card:hover .spot-card-image {
 transform: scale(1.05);
}
.spot-card:hover {
 box-shadow: var(--shadow-lg);
 border-color: var(--border-hover);
}
```

### 4. Spot Detail Page (`/spots/:id`)
**Reference mockup:** `03_spot_detail.png`

**Layout:**
- Photo gallery: hero image (full-width, aspect-ratio 21/9) + grid of 4 thumbnails below
- Title section: large spot name, category badge, star rating with gold stars, review count, location
- Action buttons: "Add to Trip +" (primary teal), "Share" (secondary), heart "Save" icon
- Two-column layout below actions: left (65%) description + reviews, right (35%) embedded mini-map + info cards
- Reviews: user avatar, star display, review text, date
- Similar spots carousel at bottom

### 5. Profile Page (`/profile/:id`)
**Reference mockup:** `04_profile_page.png`

**Layout:**
- Centered header: large circular avatar (120px) with teal ring border `3px solid var(--accent-teal)`, name below, username in muted text, location
- Stats row: 4 stat items centered horizontally — each with icon + number + label (Countries, Cities, Trips, Days)
- "Global Footprint" map section: dark Mapbox map showing visited locations as glowing teal dots
- "Recent Adventures" section: 3-column grid of trip cards with cover photos

### 6. Trip Planner Page (`/trips/new`)
**Reference mockup:** `06_trip_planner.png`

**Layout:**
- Split panel: left (40%) form panel with glassmorphism, right (60%) dark Mapbox map
- Form panel contains: trip title input, date range picker, budget dual-handle slider (teal track), destination search with add button, draggable destination list with thumbnails
- Large "Generate AI Itinerary" button at bottom — primary teal with sparkle/wand icon, full-width
- Map shows numbered teal markers connected by dashed emerald route lines
- Bottom right overlay: day-by-day timeline cards

### 7. Login Page (`/login`)
**Reference mockup:** `07_login_page.png`

**Layout:**
- Split-screen: left half is a full-height stunning travel hero photo with dark gradient overlay and Scope branding, right half is the login form
- Right side: dark background, centered glassmorphism card with:
 - "Welcome back" teal eyebrow
 - "Sign in to Scope" heading
 - Email input with mail icon
 - Password input with eye toggle
 - "Remember me" checkbox
 - Full-width "Sign In" button (primary teal with glow)
 - "Or continue with" divider
 - Google OAuth button
 - "New here? Create an account" link in teal

### 8. Register Page (`/register`)
Same split-screen layout as Login. Right-side form has:
- Username, Email, Password, Display Name fields
- "Create Account" primary button
- "Already have an account? Sign in" link

### 9. Social Feed / Home Feed (integrated into `/`)
**Design spec (no image — extrapolate from landing page + explore page aesthetics):**

**Layout:**
- Vertical feed column (max 680px centered) with activity cards
- Each feed card: glassmorphism panel with user avatar (left), activity text, timestamp, attached photo (full-width within card, rounded corners), action row (like/comment/share icons with counts)
- Card spacing: `var(--space-4)` between items
- Activity types: "dropped a pin", "completed a trip", "wrote a review", "added a friend"
- Photo inside card: `aspect-ratio: 16/9`, `border-radius: var(--radius-lg)`, hover zoom `scale(1.02)`

### 10. Friends Page (`/friends`)
**Design spec (no image — extrapolate from profile + explore aesthetics):**

**Layout:**
- Search bar at top: same glassmorphism style as explore page
- Tab row: "All Friends (47)" / "Online (12)" / "Requests (3)" — teal underline on active tab
- 3-column grid of friend cards: surface-card with circular avatar (56px), green/gray online dot, name, username, mutual friends count, location, "View Profile" button (secondary)
- Request cards: same layout + "Accept" (primary teal) and "Decline" (outline) buttons
- Sidebar: "People You May Know" with mini user cards

### 11. Settings Page (`/settings`)
**Design spec (no image — extrapolate from login form + glass panel aesthetics):**

**Layout:**
- Left sidebar nav (240px): vertical list of section links — Account, Profile, Privacy, Notifications, Appearance — active item has teal left border + teal background
- Main content (remaining width): surface-card containing form sections
- Profile section: circular avatar with camera overlay icon for upload, form fields below
- Appearance section: dark/light toggle switch with sun/moon icons, using teal accent for active state
- Travel Preferences: row of toggleable category badges/pills
- All form controls use the standard input styling above
- "Save Changes" primary teal button, "Cancel" secondary button at bottom

---

## Animation Guidelines

### Page Transitions
Already implemented via `route-fade` / `route-fade-reduced`. Keep these.

### Card Entry Animations
```css
@keyframes fadeInUp {
 from {
  opacity: 0;
  transform: translateY(12px);
 }
 to {
  opacity: 1;
  transform: translateY(0);
 }
}

.stagger-in > * {
 animation: fadeInUp 0.4s ease both;
}
.stagger-in > *:nth-child(1) { animation-delay: 0ms; }
.stagger-in > *:nth-child(2) { animation-delay: 80ms; }
.stagger-in > *:nth-child(3) { animation-delay: 160ms; }
.stagger-in > *:nth-child(4) { animation-delay: 240ms; }

@media (prefers-reduced-motion: reduce) {
 .stagger-in > * {
  animation: none;
 }
}
```

### Hover Micro-interactions
- **Cards**: translateY(-2px) + shadow elevation increase
- **Buttons**: translateY(-1px) + glow intensity increase
- **Images in cards**: scale(1.05) with overflow hidden on container
- **Filter chips**: translateY(-1px) + border-color change to category color
- **Navigation links**: color transition to teal + underline slide-in from left

### Button Click Feedback
```css
.button:active {
 transform: translateY(0) scale(0.97);
 transition-duration: 50ms;
}
```

---

## Photo & Image Standards

### Demo / Placeholder Photos
Use high-quality Unsplash photos. Here are suggested URLs for demo data:

**Spots:**
- Food: `https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800`
- Nature: `https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800`
- Nightlife: `https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=800`
- Culture: `https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=800`
- Adventure: `https://images.unsplash.com/photo-1527004013197-933c4bb611b3?w=800`
- Shopping: `https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=800`
- Scenic: `https://images.unsplash.com/photo-1506929562872-bb421503ef21?w=800`
- Other: `https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=800`

**Hero backgrounds:**
- Landing: `https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=1920`
- Login: `https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=1920`

**User avatars:**
- Use `https://i.pravatar.cc/150?img=N` where N is 1-70

### Image Handling
- ALL images use `<LazyImage>` component (already exists)
- Aspect ratios enforced via CSS `aspect-ratio` property
- `object-fit: cover` on all photo containers
- Rounded corners: `border-radius: var(--radius-lg)` for cards, `var(--radius-full)` for avatars

---

## What NOT To Do

1. MISSING DO NOT use plain white or plain gray backgrounds — use the navy/dark design tokens
2. MISSING DO NOT use default browser form controls without styling — use the input spec above
3. MISSING DO NOT use flat cards without hover effects — every interactive card must transform on hover
4. MISSING DO NOT use placeholder text like "Lorem ipsum" — use realistic travel content
5. MISSING DO NOT skip the glassmorphism effect on major panels — it's the signature Scope look
6. MISSING DO NOT use generic blue (#0000ff) or red (#ff0000) — use the design token colors
7. MISSING DO NOT make text-heavy pages — lead with photos and visual hierarchy
8. MISSING DO NOT skip animations — they are mandatory (but respect reduced-motion)
9. MISSING DO NOT add new colors without using CSS custom properties
10. MISSING DO NOT use inline styles — all styling goes in `<style scoped>` blocks
