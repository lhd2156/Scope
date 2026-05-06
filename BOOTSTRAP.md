# Bootstrap

On first start, execute these steps in order:

1. Read `scope_architecture.tex` completely — this is the single source of truth (~2600 lines). It contains every table, endpoint, algorithm, and design decision.
2. Read `scope-assets/design-tokens.css` to understand the design system.
3. Read this `agents.md` file to understand your role.
4. Initialize the Git repository and push to GitHub.
5. Begin with Phase 1 (Foundation) — set up Docker, databases, Kafka, and the monorepo structure.

## First Commands
```bash
git init
git add .
git commit -m "docs: add architecture spec and design assets"
git remote add origin https://github.com/lhd2156/scope.git
git branch -M main
git push -u origin main
```

## What's in the Repo
- `scope_architecture.tex` — Full architecture (~2600 lines)
- `scope-assets/design-tokens.css` — CSS design system
- `scope-assets/icons/scope-icons.svg` — 38 SVG icons
- `scope-assets/mockups/` — UI mockup images
