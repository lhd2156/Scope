# Scope Expansion — Codex Agent Prompts

> Copy-paste each prompt into Codex one at a time, in order.
> Wait for each phase to complete before starting the next.

---

## Phase 1: Elasticsearch + RabbitMQ/Celery

```
Read the spec file at specs/PHASE1_ELASTICSEARCH_RABBITMQ.md and implement everything in it exactly as described.

Summary of what to build:
- Add Elasticsearch 8.18.0 and RabbitMQ 4.1 as Docker services in docker-compose.yml
- Add Elasticsearch client, indexing, and search modules to scope_content/common/
- Add full-text search and geo-radius search API views with URL routing
- Add Celery app configuration in scope_content with async tasks for reindexing, sentiment analysis, and photo classification
- Add a content-celery worker service to docker-compose.yml
- Add a Django management command for bulk reindexing
- Add all required environment variables to .env.example and .env
- Update scope_content/requirements.txt with elasticsearch[async] and celery[rabbitmq]
- Hook indexing calls into existing spot, review, and trip create/update/delete views
- Add unit tests for search views and Celery tasks
- Add volumes es-data and rabbitmq-data to docker-compose.yml

Do NOT modify Core API, Frontend, Metrics, CLI, scope_media, or scope_geo.
Follow the spec exactly — all file paths, code, and configurations are specified.
```

---

## Phase 2: ML Pipeline (PyTorch, CUDA, Hugging Face, FAISS)

```
Read the spec file at specs/PHASE2_ML_PIPELINE.md and implement everything in it exactly as described.

Summary of what to build:
- Add PyTorch, torchvision, transformers, faiss-cpu, xgboost, pandas to scope_intel/requirements.txt
- Create app/ml/ directory structure in scope_intel with device.py, registry.py, models/, training/, and inference/ subdirectories
- Implement CUDA/CPU device detection in device.py
- Implement lazy-loading model registry in registry.py
- Implement sentiment analysis inference using Hugging Face DistilBERT in inference/sentiment.py
- Implement image classification using EfficientNet in inference/tagger.py
- Implement Neural Collaborative Filtering model + FAISS nearest-neighbor in inference/recommender.py
- Implement XGBoost trip duration/cost prediction in inference/predictor.py
- Create Flask blueprint routes: sentiment.py, classify.py, predict.py, ml_health.py
- Register all new blueprints in the Flask app factory
- Create training scripts for sentiment, NCF, image tagger, and trip predictor
- Create Dockerfile.gpu for CUDA-accelerated inference
- Create docker-compose.gpu.yml override file
- Add .gitignore for model artifacts
- Add unit tests in tests/test_sentiment.py

Do NOT modify Core API, Frontend, Metrics, CLI, scope_media, or scope_geo.
Follow the spec exactly.
```

---

## Phase 3: gRPC Inter-Service Communication

```
Read the spec file at specs/PHASE3_GRPC.md and implement everything in it exactly as described.

Summary of what to build:
- Create scope-proto/ directory with buf.yaml, buf.gen.yaml, and proto definitions
- Create 4 proto files: common.proto, spot.proto, intel.proto, user.proto under proto/scope/v1/
- Create generate.sh and generate.ps1 scripts for code generation
- Add grpcio, grpcio-tools, grpcio-reflection, grpcio-health-checking to scope_content/requirements.txt and scope_intel/requirements.txt
- Implement gRPC server in scope_content/common/grpc_server.py with SpotService
- Implement SpotService servicer in scope_content/common/grpc_services.py
- Implement gRPC server in scope_intel/app/grpc_server.py with IntelService
- Implement IntelService servicer in scope_intel/app/grpc_services.py
- Add gRPC health probes in Go at scope-metrics/internal/grpc_probes.go
- Add Grpc.Net.Client and Google.Protobuf NuGet packages to Scope.Core
- Create ContentGrpcClient.cs in Scope.Core.Infrastructure
- Expose gRPC ports (50051, 50052) in docker-compose.yml
- Start gRPC servers on Django/Flask startup

Do NOT modify Frontend, scope_media, or scope_geo.
Follow the spec exactly.
```

---

## Phase 4: AI / Agentic Workflows (Ollama + LangChain + LangGraph + RAG)

```
Read the spec file at specs/PHASE4_AI_AGENTIC.md and implement everything in it exactly as described.

IMPORTANT: This phase uses Ollama (free, local LLM) — NOT OpenAI. No API keys needed for LLM inference.

Summary of what to build:
- Add Ollama service to docker-compose.yml (ollama/ollama:latest image, port 11434, 4GB memory)
- Create scope-rag/ — a new FastAPI microservice with:
  - config.py with Ollama settings (base_url, model, embedding_model)
  - embeddings.py using langchain_ollama.OllamaEmbeddings with nomic-embed-text model
  - vectorstore.py using ChromaDB for vector storage
  - chain.py implementing RAG chain with langchain_ollama.ChatOllama (llama3.1 model)
  - routes.py with /api/rag/ask, /api/rag/ingest, /api/rag/search, /api/rag/health endpoints
  - main.py FastAPI app entry point
  - Dockerfile and requirements.txt
- Add LangGraph agentic trip planner to scope_intel:
  - Create app/agents/tools.py with 6 LangChain tools (search_spots, search_nearby, get_reviews, weather, distance, predict_cost)
  - Create app/agents/trip_planner.py with LangGraph StateGraph using ChatOllama
  - Create app/routes/agent.py Flask blueprint with /api/intel/agent/plan-trip endpoint
  - Add langchain, langchain-ollama, langgraph to scope_intel/requirements.txt
- Add Semantic Kernel to Core API (.NET):
  - Add Microsoft.SemanticKernel and Microsoft.SemanticKernel.Connectors.Ollama NuGet packages
  - Create ScopeAIService.cs using AddOllamaChatCompletion pointed at http://ollama:11434
  - Register in DI
- Add rag service, ollama service, rag-data volume, and ollama-data volume to docker-compose.yml
- Add /api/rag/ route to nginx.conf
- Add OLLAMA_BASE_URL, OLLAMA_MODEL, EMBEDDING_MODEL to .env.example

After building, run: docker compose exec ollama ollama pull llama3.1 && docker compose exec ollama ollama pull nomic-embed-text

Follow the spec exactly.
```

---

## Phase 5: Vue Marketing Site

```
Read the spec file at specs/PHASE5_VUE_SITE.md and implement everything in it exactly as described.

Summary of what to build:
- Create scope-site/ directory — a Vue 3 + Vite marketing website
- Use Vue Router for /features, /about, /download, /blog, /blog/:slug, /privacy, and /terms
- Create a polished landing page with hero, stats, feature grid, testimonial, and CTA sections
- Use local TypeScript data or plain content for blog-style posts
- Create responsive CSS that matches Scope branding without framework-specific UI libraries
- Create Dockerfile (multi-stage: deps → build → nginx static runtime)
- Add site service to docker-compose.yml
- Add /site/ route to nginx.conf

Make the site visually polished, web-first, and Vue-only.
Follow the spec exactly.
```

---

## Phase 6: Grafana + Rate Limiting + Sentry

```
Read the spec file at specs/PHASE6_GRAFANA_RATELIMIT_SENTRY.md and implement everything in it exactly as described.

Summary of what to build:

GRAFANA:
- Add Prometheus and Grafana Docker services to docker-compose.yml
- Create monitoring/prometheus.yml with scrape configs for all services
- Create monitoring/grafana/provisioning/datasources/prometheus.yml
- Create monitoring/grafana/provisioning/dashboards/default.yml
- Create monitoring/grafana/dashboards/scope-overview.json with panels for service health, HTTP request rate, latency p95, error rate, and memory usage
- Add prometheus-data and grafana-data volumes

RATE LIMITING:
- Add rate limit zones to nginx.conf (api_global: 60r/m, auth: 10r/m, search: 30r/m)
- Add ASP.NET rate limiting to Core API Program.cs with FixedWindowLimiter
- Create Redis-based sliding window rate limiter middleware at scope_content/common/middleware/ratelimit.py
- Add django-ratelimit to scope_content/requirements.txt
- Add Flask-Limiter to scope_intel/requirements.txt with stricter limits on ML endpoints
- Add rate limit tests at scope_content/common/tests/test_ratelimit.py

SENTRY:
- Add sentry-sdk[django] to scope_content/requirements.txt and init in settings.py
- Add sentry-sdk[flask] to scope_intel/requirements.txt and init in app factory
- Add sentry-sdk[fastapi] to scope-rag/requirements.txt and init in main.py
- Add Sentry.AspNetCore NuGet to Core API and configure in Program.cs
- Add @sentry/vue to scope-frontend/package.json and init in main.ts
- Add sentry-go to scope-metrics/go.mod and init in main.go
- Add SENTRY_DSN environment variable to all services in docker-compose.yml
- Use this DSN for Content: https://f2daef86766b84afca9aa99ea93e66c5@o4511288349425664.ingest.us.sentry.io/4511288358141952
- Create additional Sentry projects for other services as needed

Add environment variables for Grafana, Prometheus, and Sentry to .env.example.
Follow the spec exactly.
```

---

## Phase 7: Frontend Integration (Phases 1–4 → Vue.js)

```
Read the spec file at specs/PHASE7_FRONTEND_INTEGRATION.md and implement everything in it exactly as described.

IMPORTANT: This phase wires all backend features from Phases 1–4 into the Vue.js frontend (scope-frontend/).
Prerequisites: Phases 1–4 must be complete (Elasticsearch, ML, gRPC, RAG + Agent all running).

Summary of what to build:
- Create src/services/searchService.ts — Elasticsearch full-text and geo-radius search API client
- Create src/services/agentService.ts — AI trip planner agent API client (POST /api/intel/agent/plan-trip)
- Create src/services/ragService.ts — RAG chatbot API client (POST /api/rag/ask, GET /api/rag/search, GET /api/rag/health)
- Create src/stores/search.ts — Pinia store for search state with debounced Elasticsearch queries
- Create src/views/AITripPlannerPage.vue — Chat-style AI trip planner page with suggestion chips, loading state, and markdown rendering
- Create src/views/ScopeAIPage.vue — RAG chatbot assistant page with multi-turn conversation thread and source citations
- Create src/components/spots/NearbySpots.vue — Geo-radius nearby spots component using geolocation API
- Create src/components/spots/ReviewSentiment.vue — Sentiment badge component (positive/neutral/negative) for reviews
- Create src/components/common/ForYouSection.vue — ML-powered personalized "For You" recommendation section
- Modify src/router/index.ts — Add /ai/trip-planner and /ai/ask routes with lazy loading
- Modify src/views/ExplorePage.vue — Wire search to Elasticsearch with 300ms debounce, fallback to client-side filtering
- Modify src/views/HomePage.vue — Add <ForYouSection /> and <NearbySpots /> sections
- Modify navigation (AppShell.vue or Navbar) — Add "Scope AI" and "AI Planner" nav links
- Modify src/types/index.ts — Add sentiment_score to review types

DESIGN REFERENCE: Use the wireframe mockups at scope-assets/mockups/09–13 as visual targets. All layouts, colors, glassmorphism panels, and teal accents must match the existing Scope UI shown in mockups 01–08.

Do NOT modify Core API, scope_content, scope_intel, scope-rag, Metrics, CLI, scope_media, or scope_geo.
Follow the spec exactly — all file paths, code, and configurations are specified.
```

---

## Admin Dashboard (can run in parallel with any phase)

```
Read the spec file at ADMIN_DASHBOARD.md and implement everything in it exactly as described.

This is a standalone Vue 3 + TypeScript admin dashboard at scope-admin/.
Initialize with Vue 3 + Vite, Vue Router, and Pinia.
Follow the spec for all pages, components, routing, Docker, and Nginx configuration.
```

---

## Post-Build: Pull Ollama Models

After Phase 4 is complete, run this one-time setup:

```
docker compose up -d ollama
docker compose exec ollama ollama pull llama3.1
docker compose exec ollama ollama pull nomic-embed-text
```
