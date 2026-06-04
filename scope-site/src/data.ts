export const navLinks = [
  { to: "/features", label: "Features" },
  { to: "/about", label: "About" },
  { to: "/blog", label: "Blog" },
  { to: "/download", label: "Open App" },
];

export const stats = [
  { value: "10+", label: "Services" },
  { value: "10", label: "Languages" },
  { value: "Web", label: "Platform" },
  { value: "AI", label: "Powered" },
];

export const features = [
  {
    title: "Interactive Map",
    description: "Discover spots on a live map with routes, proximity, and community context.",
    tone: "cyan",
  },
  {
    title: "AI Trip Planner",
    description: "Agentic AI builds itineraries from reviews, weather, distance, and cost signals.",
    tone: "fuchsia",
  },
  {
    title: "Social Discovery",
    description: "Share experiences with friends and discover places through people you trust.",
    tone: "emerald",
  },
  {
    title: "Photo Stories",
    description: "Document adventures with photos, notes, reviews, and location metadata.",
    tone: "amber",
  },
  {
    title: "Smart Search",
    description: "Full-text and geo search keeps discovery fast, specific, and useful.",
    tone: "blue",
  },
  {
    title: "Browser-First",
    description: "Plan, explore, and revisit adventures through one responsive web experience.",
    tone: "violet",
  },
];

export const featureDeepDives = [
  {
    title: "Interactive Map",
    description:
      "Scope starts with place. Map-powered discovery lets travelers scan nearby spots, filter by vibe, and open rich stories from real people.",
    image: "/screenshots/map-view.png",
    badges: ["Mapbox", "Geo search", "Live pins"],
  },
  {
    title: "AI Trip Planner",
    description:
      "LangGraph agents combine Scope content, reviews, weather, distance, and cost prediction into efficient day-by-day routes.",
    image: "/screenshots/trip-planner.png",
    badges: ["LangGraph", "Ollama", "RAG"],
  },
  {
    title: "Social Discovery",
    description:
      "Friends, reviews, likes, and photo stories make discovery feel human, not like another anonymous list of search results.",
    image: "/screenshots/social-feed.png",
    badges: ["SignalR", "Django", "Elasticsearch"],
  },
];

export const posts = [
  {
    slug: "launch-announcement",
    title: "Introducing Scope - Your Map to Real Adventures",
    date: "2026-04-26",
    excerpt: "Scope is a platform where people document, discover, and plan real-world experiences on an interactive map.",
    readTime: "4 min",
    tags: ["announcement", "launch"],
    body:
      "Scope starts with the map. Every saved spot can carry photos, reviews, routes, and context from people who were actually there.",
  },
  {
    slug: "building-scope-architecture",
    title: "Building Scope Architecture",
    date: "2026-04-25",
    excerpt: "A look at the service boundaries behind Core, Content, Intel, and the web app.",
    readTime: "6 min",
    tags: ["engineering", "architecture"],
    body:
      "Scope keeps service responsibilities separate so auth, content, intelligence, and delivery can evolve without turning into one crowded backend.",
  },
  {
    slug: "ai-trip-planning",
    title: "AI Trip Planning With Community Signal",
    date: "2026-04-24",
    excerpt: "How Scope turns reviews, distance, weather, and vibe into a practical route.",
    readTime: "5 min",
    tags: ["ai", "planning"],
    body:
      "The planner uses community context as signal, then shapes the route around time, budget, distance, and the feel of the day.",
  },
];

export function findPostBySlug(slug: string | string[] | undefined) {
  const normalizedSlug = Array.isArray(slug) ? slug[0] : slug;
  return posts.find((post) => post.slug === normalizedSlug) ?? posts[0];
}

export function assetPath(path: string): string {
  const base = import.meta.env.BASE_URL.replace(/\/$/, "");
  return `${base}${path}`;
}
