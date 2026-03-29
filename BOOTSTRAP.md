# Bootstrap

On first start, execute these steps in order:

1. Read `atlas_architecture.tex` completely — this is the single source of truth (~2600 lines). It contains every table, endpoint, algorithm, and design decision.
2. Read `atlas-assets/design-tokens.css` to understand the design system.
3. Read this `agents.md` file to understand your role.
4. Initialize the Git repository and push to GitHub.
5. Begin with Phase 1 (Foundation) — set up Docker, databases, Kafka, and the monorepo structure.

## First Commands
```bash
git init
git add .
git commit -m "docs: add architecture spec and design assets"
git remote add origin https://github.com/lhd2156/atlas.git
git branch -M main
git push -u origin main
```

## What's in the Repo
- `atlas_architecture.tex` — Full architecture (~2600 lines)
- `atlas-assets/design-tokens.css` — CSS design system
- `atlas-assets/icons/atlas-icons.svg` — 38 SVG icons
- `atlas-assets/mockups/` — UI mockup images
