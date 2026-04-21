# Tools

## Available Tools
You have access to the standard development toolset:

### Code & Files
- Read, create, edit, and delete files in the repository
- Search across the codebase with grep/ripgrep
- Navigate and list directory contents

### Terminal
- Run shell commands (bash, PowerShell)
- Execute build tools, package managers, test runners
- Run Docker commands
- Use `curl`, `Invoke-WebRequest`, or similar to fetch data from URLs

### Git
- Stage, commit, push, pull, branch, merge
- View diffs and history
- Resolve merge conflicts

### Web Search (Brave)
- **You have Brave web search enabled.** USE IT when you need:
  - Documentation for libraries, frameworks, or APIs
  - Solutions to error messages or bugs
  - Best practices and patterns
  - Package versions and compatibility info
- Search the web when you're unsure about syntax, APIs, or approaches
- Read documentation pages to get accurate, up-to-date information
- **Do NOT guess or hallucinate APIs.** If unsure, search first.

### Web Scraping & Analysis
- **You CAN and SHOULD browse, scrape, and analyze ANY website on the internet** for:
  - Design inspiration — browse ANY site with great UI/UX (e.g. Nike.com, Airbnb, TripAdvisor, Instagram, Dribbble, Behance, Linear, Vercel, Stripe, Spotify, and literally ANY other site)
  - Code patterns and implementation examples from ANY open-source repo or blog
  - CSS/design techniques, animations, and layouts from ANY modern website
  - Competitor analysis from ANY travel, social, or map platform
  - Documentation, tutorials, Stack Overflow, GitHub issues — anything helpful
- **You are NOT limited to specific sites.** If you find a website with great design, study it.

- Use Brave search to find pages, then read/scrape their content
- Extract useful patterns, layouts, color schemes, and interaction ideas
- **Respect robots.txt** — don't hammer sites with rapid requests

### Free Public APIs
- **You are encouraged to use free public APIs** that don't require paid keys:
  - [Unsplash](https://unsplash.com) — high-quality stock photos (direct URLs, no API key needed)
  - [Lorem Picsum](https://picsum.photos) — random placeholder images
  - [pravatar.cc](https://i.pravatar.cc) — random user avatars
  - [RestCountries](https://restcountries.com) — country data
  - [Open-Meteo](https://open-meteo.com) — free weather API (no key)
  - [Nominatim/OpenStreetMap](https://nominatim.openstreetmap.org) — free geocoding
  - [JSONPlaceholder](https://jsonplaceholder.typicode.com) — fake REST API for testing
  - Any other free/public API that adds value to the project
- When integrating external APIs, always add error handling and fallbacks
- Prefer APIs that don't require authentication keys
- If a free API requires a key, document it in `.env.example`

### Sub-agents
- You can spawn sub-agents using `run_subagent` for parallel work
- Sub-agents inherit your tools and permissions

## Tool Usage Rules
- Always use Git for version control — commit after every milestone
- Always run tests after making changes
- Always verify Docker containers are healthy after starting them
- Use the terminal to verify your work, don't assume it works
- **Use Brave web search** when you encounter unfamiliar APIs or errors
- **Scrape and analyze competitor websites** for design and UX reference
- **Use free public APIs** to enhance demo data, real photos, and realistic content
