# Scope Tech Expansion — Full Blueprint

> **Purpose**: Codex-ready build specs for every new technology addition to Scope.
> Each section is self-contained — hand any single section to Codex and it can build it.

---

## Current Stack Baseline (web-only, 8 services)

Before expanding, here's what Scope already has:

| Language | Service | Framework |
|---|---|---|
| C# | Core API | ASP.NET Core 8, SignalR, Entity Framework Core |
| Python | Content API | Django 5, DRF, Pillow, boto3, Kafka |
| Python | Intel API | Flask 3, SQLAlchemy, scikit-learn, NumPy |
| Go | Metrics Agent | Prometheus client, gorilla/mux |
| Rust | CLI Toolkit | clap, tokio, reqwest, tiberius |
| TypeScript | Frontend | Vue 3, Vite, Pinia, Mapbox GL, Axios |
| C | scope_media | Thumbnails, EXIF, blurhash (native lib) |
| C++ | scope_geo | Haversine, R-tree, pathfinding, WASM via Emscripten |

**Infrastructure**: SQL Server, Kafka, Redis, Nginx, Docker, Kubernetes, Terraform, GitHub Actions, AWS Lightsail, OpenTelemetry, Playwright

---

## 1. Machine Learning (Python — Intel Service Enhancement)

### What to Build
Expand `scope_intel/` with production-grade ML models that go beyond the existing scikit-learn TF-IDF recommendations.

### ML Features

#### A. Spot Recommendation Engine (Collaborative Filtering)
- **What**: "Users who liked X also liked Y" recommendations
- **Stack**: PyTorch (or TensorFlow), pandas, FAISS (Facebook AI Similarity Search)
- **How**: Train a neural collaborative filtering (NCF) model on user-spot interaction data (likes, reviews, visits)
- **Endpoint**: `GET /api/intel/recommendations/spots?user_id={id}&limit=10`
- **Resume line**: *"Trained a neural collaborative filtering model with PyTorch on user-spot interaction embeddings, served via FAISS approximate nearest neighbor search achieving sub-50ms P95 latency"*

#### B. Review Sentiment Analysis
- **What**: Automatically classify reviews as positive/negative/neutral + extract sentiment scores
- **Stack**: Hugging Face Transformers, tokenizers
- **Model**: Fine-tune `distilbert-base-uncased-finetuned-sst-2-english` on Scope review data
- **Endpoint**: `POST /api/intel/sentiment` — accepts review text, returns score
- **Integration**: Content API calls Intel on review creation → stores sentiment score alongside review
- **Resume line**: *"Fine-tuned DistilBERT sentiment classifier on user review corpus using Hugging Face Transformers, achieving 92%+ F1 score with batch inference via Kafka consumer pipeline"*

#### C. Image Classification / Auto-Tagging
- **What**: Auto-tag uploaded photos (beach, mountain, restaurant, nightlife, etc.)
- **Stack**: PyTorch + torchvision, pre-trained ResNet-50 or EfficientNet
- **How**: Transfer learning — freeze base layers, train classifier head on travel/place categories
- **Endpoint**: `POST /api/intel/classify-image` — accepts image bytes, returns top-5 tags with confidence
- **Integration**: Content worker calls Intel after thumbnail generation → stores tags on photo record
- **Resume line**: *"Deployed transfer-learned EfficientNet image classifier for auto-tagging uploaded photos across 20+ travel categories, trained on 10K+ labeled images with PyTorch"*

#### D. Trip Duration & Cost Prediction
- **What**: Predict how long a trip will take and estimated budget based on spots selected
- **Stack**: XGBoost, scikit-learn pipelines
- **Features**: Number of spots, distances between spots, avg review ratings, time of year, category mix
- **Endpoint**: `GET /api/intel/predict-trip?trip_id={id}`

### ML Infrastructure
```
scope_intel/
├── app/
│   ├── ml/
│   │   ├── __init__.py
│   │   ├── models/               # Trained model artifacts (.pt, .joblib)
│   │   ├── training/
│   │   │   ├── train_ncf.py      # Training script for collaborative filtering
│   │   │   ├── train_sentiment.py
│   │   │   ├── train_tagger.py
│   │   │   └── train_trip.py
│   │   ├── inference/
│   │   │   ├── recommender.py    # NCF inference
│   │   │   ├── sentiment.py      # Sentiment inference
│   │   │   ├── tagger.py         # Image tagger inference
│   │   │   └── predictor.py      # Trip prediction
│   │   └── pipeline.py           # Kafka consumer for async ML jobs
│   ├── routes/
│   │   ├── recommendations.py    # Updated with NCF
│   │   ├── sentiment.py          # New
│   │   ├── classify.py           # New
│   │   └── predict.py            # New
```

### Requirements additions
```
torch>=2.6.0
torchvision>=0.21.0
transformers>=4.50.0
faiss-cpu>=1.11.0
xgboost>=3.0.0
pandas>=2.2.0
Pillow>=12.0.0
```

---

## 2. CUDA (GPU-Accelerated ML Inference)

### What CUDA Adds
CUDA enables GPU-accelerated inference for PyTorch/TensorFlow models. This is the difference between "I used ML" and "I deployed GPU-optimized ML at scale."

### How It Fits
- The Intel API container gets a **GPU-enabled variant** for production
- Training scripts run with CUDA locally or on a cloud GPU instance
- Inference uses `torch.cuda` when available, falls back to CPU gracefully

### Implementation

#### Dockerfile.gpu (new file in `scope_intel/`)
```dockerfile
FROM nvidia/cuda:12.9.0-runtime-ubuntu24.04 AS base
# Install Python, pip, and CUDA-aware PyTorch
RUN apt-get update && apt-get install -y python3.14 python3-pip
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
RUN pip install torch torchvision --index-url https://download.pytorch.org/whl/cu129

COPY . /app
WORKDIR /app
CMD ["gunicorn", "--bind", "0.0.0.0:5000", "wsgi:app"]
```

#### docker-compose.gpu.yml (override file)
```yaml
services:
  intel:
    build:
      context: ./scope_intel
      dockerfile: Dockerfile.gpu
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: 1
              capabilities: [gpu]
```

#### Code changes in inference
```python
import torch

device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
model = model.to(device)

# In inference:
with torch.no_grad():
    inputs = inputs.to(device)
    outputs = model(inputs)
```

### Resume line
*"Deployed CUDA-accelerated PyTorch inference pipeline on NVIDIA GPU containers, achieving 8x throughput improvement over CPU for real-time image classification and NLP sentiment analysis"*

### Note
You don't need a local GPU to develop. All CUDA code runs with `cpu` fallback. The GPU Docker image is only used in production/staging with actual NVIDIA hardware.

---

## 3. gRPC (Inter-Service Communication)

### What to Build
Replace the heaviest REST calls between Core ↔ Content ↔ Intel with gRPC for type-safe, binary-serialized, low-latency inter-service communication.

### Where gRPC Fits

| Caller | Callee | Current | gRPC Replacement |
|---|---|---|---|
| Core → Content | Fetch spot data for notifications | REST `GET /spots/{id}` | `SpotService.GetSpot()` |
| Content → Intel | Request sentiment analysis | REST `POST /sentiment` | `IntelService.AnalyzeSentiment()` |
| Content → Intel | Request image tags | REST `POST /classify-image` | `IntelService.ClassifyImage()` |
| Intel → Content | Fetch spots for recommendations | REST `GET /spots/` | `SpotService.ListSpots()` |

### New directory: `scope-proto/`
```
scope-proto/
├── README.md
├── buf.yaml                    # Buf configuration
├── buf.gen.yaml                # Code generation config
├── proto/
│   └── scope/
│       └── v1/
│           ├── spot.proto      # SpotService definition
│           ├── intel.proto     # IntelService definition
│           ├── user.proto      # UserService definition
│           └── common.proto    # Shared message types
```

#### spot.proto
```protobuf
syntax = "proto3";
package scope.v1;

service SpotService {
  rpc GetSpot(GetSpotRequest) returns (Spot);
  rpc ListSpots(ListSpotsRequest) returns (ListSpotsResponse);
  rpc SearchSpots(SearchSpotsRequest) returns (ListSpotsResponse);
}

message Spot {
  string id = 1;
  string name = 2;
  string description = 3;
  double latitude = 4;
  double longitude = 5;
  string creator_id = 6;
  repeated string tags = 7;
  float avg_rating = 8;
  int32 review_count = 9;
}

message GetSpotRequest { string id = 1; }
message ListSpotsRequest { int32 page = 1; int32 page_size = 2; }
message ListSpotsResponse { repeated Spot spots = 1; int32 total = 2; }
message SearchSpotsRequest { string query = 1; int32 limit = 2; }
```

### Language-specific gRPC integration

| Service | gRPC Library | Role |
|---|---|---|
| **Content (Python/Django)** | `grpcio` + `grpcio-tools` | Server (SpotService) + Client (IntelService) |
| **Intel (Python/Flask)** | `grpcio` + `grpcio-tools` | Server (IntelService) + Client (SpotService) |
| **Core (C#/.NET)** | `Grpc.AspNetCore` | Client (SpotService, IntelService) |
| **Metrics (Go)** | `google.golang.org/grpc` | Client (health probes via gRPC reflection) |

### Docker Compose
Each gRPC-enabled service exposes a second port (50051) for gRPC alongside existing HTTP.

---

## 4. Elasticsearch (Full-Text Search)

### What to Build
Full-text search across spots, reviews, and trips. Replace basic SQL `LIKE` queries with proper search infrastructure.

### Architecture
```
[Content API] --index on write--> [Elasticsearch]
[Frontend]    --search query-->   [Content API] --query--> [Elasticsearch]
```

### docker-compose addition
```yaml
  elasticsearch:
    image: docker.elastic.co/elasticsearch/elasticsearch:8.18.0
    container_name: scope-elasticsearch
    restart: unless-stopped
    environment:
      - discovery.type=single-node
      - xpack.security.enabled=false
      - ES_JAVA_OPTS=-Xms256m -Xmx256m
    ports:
      - "9200:9200"
    volumes:
      - es-data:/usr/share/elasticsearch/data
    healthcheck:
      test: ["CMD-SHELL", "curl -fsSL http://localhost:9200/_cluster/health || exit 1"]
      interval: 15s
      timeout: 5s
      retries: 10
      start_period: 30s
    mem_limit: 512m
```

### Indexes

#### `scope-spots` index
```json
{
  "mappings": {
    "properties": {
      "id": { "type": "keyword" },
      "name": { "type": "text", "analyzer": "standard" },
      "description": { "type": "text", "analyzer": "standard" },
      "location": { "type": "geo_point" },
      "tags": { "type": "keyword" },
      "avg_rating": { "type": "float" },
      "review_count": { "type": "integer" },
      "created_at": { "type": "date" }
    }
  }
}
```

#### `scope-reviews` index
```json
{
  "mappings": {
    "properties": {
      "id": { "type": "keyword" },
      "spot_id": { "type": "keyword" },
      "user_id": { "type": "keyword" },
      "text": { "type": "text", "analyzer": "standard" },
      "rating": { "type": "integer" },
      "sentiment_score": { "type": "float" },
      "created_at": { "type": "date" }
    }
  }
}
```

### Content API integration
- **Library**: `elasticsearch[async]>=8.18.0`
- **On spot/review create/update**: Index document to Elasticsearch
- **On delete**: Remove from index
- **Search endpoint**: `GET /api/content/search?q=beach+sunset&type=spots&limit=20`
- **Geo search**: `GET /api/content/search/nearby?lat=40.7&lon=-74.0&radius=10km`

### Resume line
*"Integrated Elasticsearch 8 full-text search with geo-point indexing across 3 document types, supporting fuzzy matching, faceted filtering, and sub-100ms geo-radius queries"*

---

## 5. RabbitMQ (Task Queue for Async Jobs)

### Why RabbitMQ When You Have Kafka?
Different tools for different jobs:
- **Kafka** = event streaming, log-based, high-throughput, consumer groups (what Scope uses for domain events)
- **RabbitMQ** = traditional task queue, acknowledgments, retries, dead-letter exchanges (better for one-off async jobs)

### What RabbitMQ Handles
| Queue | Producer | Consumer | Job |
|---|---|---|---|
| `ml.sentiment` | Content API | Intel worker | Analyze review sentiment |
| `ml.classify` | Content worker | Intel worker | Auto-tag uploaded photo |
| `ml.recommend` | Scheduled cron | Intel worker | Rebuild user recommendation cache |
| `email.welcome` | Core API | Email worker | Send welcome email |
| `email.digest` | Scheduled cron | Email worker | Send weekly digest |
| `export.user-data` | Admin dashboard | Export worker | GDPR data export |

### docker-compose addition
```yaml
  rabbitmq:
    image: rabbitmq:4.1-management-alpine
    container_name: scope-rabbitmq
    restart: unless-stopped
    environment:
      RABBITMQ_DEFAULT_USER: ${RABBITMQ_USER:-scope}
      RABBITMQ_DEFAULT_PASS: ${RABBITMQ_PASS:-scope_dev}
    ports:
      - "5672:5672"
      - "15672:15672"   # Management UI
    healthcheck:
      test: ["CMD", "rabbitmq-diagnostics", "check_running"]
      interval: 15s
      timeout: 5s
      retries: 10
      start_period: 30s
    mem_limit: 384m
```

### Python integration (both Content + Intel)
- **Library**: `celery[rabbitmq]>=5.5.0` + `kombu>=5.5.0`
- Celery workers run alongside each service's main process
- Dead-letter exchange for failed tasks → DLQ for manual inspection

### Resume line
*"Architected dual message broker system with Kafka for event streaming and RabbitMQ/Celery for async task orchestration across ML inference, email delivery, and data export pipelines"*

---

## 6. Vue Marketing/Landing Site

### What to Build
`scope-site/` - a public-facing marketing website with SEO-friendly static pages, blog-style content, and web app launch links.

### Stack
| Layer | Technology |
|---|---|
| Framework | Vue 3 |
| Language | TypeScript |
| Build | Vite |
| Routing | Vue Router |
| Styling | Tailwind-compatible CSS tokens plus local site styles |
| Analytics | Plausible or another static-site friendly analytics provider |
| Deployment | Static assets served by Nginx |

### Pages
```
/                    → Hero + feature showcase + CTA
/features            → Detailed feature breakdown
/about               → Team, mission, story
/blog                → Blog-style update index
/blog/:slug          → Individual update page
/download            → Web app launch link
/privacy             → Privacy policy
/terms               → Terms of service
```

### Directory structure
```
scope-site/
├── Dockerfile
├── nginx.conf
├── index.html
├── package.json
├── tailwind.config.ts
├── tsconfig.json
├── public/
│   ├── og-image.png
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
```

### Docker
```dockerfile
FROM node:24-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:1.27-alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 3000
```

### Resume line
*"Built a Vue 3 marketing site with Vite, route-level content pages, and Nginx static delivery, deployed alongside Scope microservices through Docker Compose"*

---

## 7. AI / Agentic Workflows (The Crown Jewel)

This is what makes Scope stand out from every other CRUD app. Here's every AI technology worth integrating:

### A. LangChain + LangGraph (Agentic Trip Planner)

**What**: An AI agent that plans trips by reasoning over spots, reviews, distances, weather, and user preferences — not just a single LLM call, but a multi-step agent with tool use.

**Stack**: LangChain, LangGraph, OpenAI GPT-4o / Claude / Gemini, LangSmith (observability)

**Agent tools the AI can call**:
1. `search_spots(query, location, radius)` → Elasticsearch
2. `get_reviews(spot_id)` → Content API
3. `get_weather(location, date)` → External weather API
4. `calculate_distance(point_a, point_b)` → scope_geo
5. `get_user_preferences(user_id)` → Core API
6. `check_spot_hours(spot_id, date)` → Content API

**Flow (LangGraph state machine)**:
```
START → Understand Request → Search Spots → Score & Filter →
  → Check Logistics (distance, hours, weather) →
  → Build Itinerary → Optimize Route → Present to User
```

**Endpoint**: `POST /api/intel/agent/plan-trip`
```json
{
  "prompt": "Plan a 3-day trip to San Francisco, I love hiking and seafood",
  "user_id": "abc123",
  "start_date": "2026-06-15"
}
```

**Returns**: Structured itinerary with spots, times, routes, and reasoning.

### B. RAG (Retrieval-Augmented Generation)

**What**: Let users ask natural-language questions about spots and get answers grounded in real review data.

**Stack**: LangChain, ChromaDB or Pinecone (vector store), OpenAI Embeddings

**How**:
1. On review creation → generate embedding → store in vector DB
2. User asks: *"What's the best pizza near Times Square?"*
3. RAG pipeline: embed query → similarity search → retrieve top-K reviews → feed to LLM → generate grounded answer

**New service**: `scope-rag/` (Python, FastAPI)
```
scope-rag/
├── Dockerfile
├── requirements.txt          # langchain, chromadb, openai, fastapi
├── app/
│   ├── main.py
│   ├── embeddings.py         # Embedding generation
│   ├── vectorstore.py        # ChromaDB / Pinecone client
│   ├── retriever.py          # Retrieval logic
│   ├── chain.py              # RAG chain
│   └── routes.py             # FastAPI endpoints
```

**Endpoint**: `POST /api/rag/ask`
```json
{
  "question": "What's the best sunset spot in Santorini?",
  "filters": { "location": "Santorini, Greece", "radius_km": 20 }
}
```

### C. CrewAI (Multi-Agent System)

**What**: Multiple specialized AI agents collaborating to produce a comprehensive travel report.

**Agents**:
1. **Research Agent** — searches spots, reads reviews, gathers data
2. **Weather Agent** — checks weather forecasts for the trip dates
3. **Budget Agent** — estimates costs based on spot categories and local pricing
4. **Itinerary Agent** — assembles the final day-by-day plan
5. **Safety Agent** — checks travel advisories and safety info

**Stack**: CrewAI, LangChain tools, OpenAI

### D. LlamaIndex (Structured Data Querying)

**What**: Let users query structured Scope data using natural language.

**Example**: *"Show me all spots in Tokyo with 4+ star ratings that are good for photography"*

**LlamaIndex** converts this to structured queries against your SQL Server + Elasticsearch, no custom query builder needed.

### E. Semantic Kernel (C# — Core API Integration)

**What**: Microsoft's AI orchestration SDK. Since Core API is already C#/.NET, Semantic Kernel is a native fit.

**Use cases in Core**:
- Smart notification summarization ("You have 5 new reviews — here's a summary")
- Friend recommendation based on travel history overlap
- Natural language profile search for admin

**Stack**: `Microsoft.SemanticKernel` NuGet package

### F. Complete AI/ML Tech Summary

| Technology | Category | Where | Purpose |
|---|---|---|---|
| **PyTorch** | ML Framework | Intel | Model training + inference |
| **CUDA** | GPU Acceleration | Intel (GPU container) | Fast inference |
| **Hugging Face Transformers** | NLP | Intel | Sentiment analysis, text classification |
| **FAISS** | Vector Search | Intel | Nearest-neighbor for recommendations |
| **scikit-learn** | ML (existing) | Intel | XGBoost, pipelines, feature engineering |
| **LangChain** | Agentic AI | Intel / RAG | Agent orchestration, chains, tools |
| **LangGraph** | Agent Workflows | Intel | Stateful multi-step agent flows |
| **LangSmith** | Observability | Intel | Trace and debug agent runs |
| **CrewAI** | Multi-Agent | Intel | Collaborative agent teams |
| **LlamaIndex** | Data Querying | Intel | Natural language → structured queries |
| **ChromaDB** | Vector Store | RAG service | Embedding storage + similarity search |
| **OpenAI API** | LLM Provider | Intel / RAG | GPT-4o for generation |
| **Semantic Kernel** | AI Orchestration | Core (.NET) | C# native AI capabilities |
| **RAG** | Architecture Pattern | RAG service | Grounded Q&A over reviews |

---

## 8. Updated Architecture After Expansion

### Services (12 total)

| # | Service | Stack | New? |
|---|---|---|---|
| 1 | Core API | ASP.NET Core 8 / C# + Semantic Kernel | Enhanced |
| 2 | Content API | Django 5 / Python + Elasticsearch + Celery | Enhanced |
| 3 | Intel API | Flask 3 / Python + PyTorch + CUDA + LangChain | Enhanced |
| 4 | RAG Service | FastAPI / Python + ChromaDB + LangChain | **NEW** |
| 5 | Metrics Agent | Go + Prometheus | Existing |
| 6 | CLI Toolkit | Rust | Existing |
| 7 | Frontend | Vue 3 / TypeScript | Existing |
| 8 | Admin Dashboard | Vue 3 / TypeScript | **NEW** |
| 9 | Marketing Site | Vue 3 / TypeScript | **NEW** |
| 10 | scope_media | C (native library) | Existing |
| 11 | scope_geo | C++ (native + WASM + Python bindings) | Existing |
| 12 | Proto Definitions | Protobuf (gRPC) | **NEW** |

### Languages (9)
C, C++, C#, Python, Go, Rust, TypeScript, SQL, Protobuf

### Infrastructure (after expansion)
| Component | Technology |
|---|---|
| Database | SQL Server 2022 |
| Search | **Elasticsearch 8** |
| Event Streaming | Kafka + Zookeeper |
| Task Queue | **RabbitMQ + Celery** |
| Vector Store | **ChromaDB** |
| Cache / Backplane | Redis 7.2 |
| Reverse Proxy | Nginx 1.27 |
| Containers | Docker + Docker Compose |
| Orchestration | Kubernetes |
| IaC | Terraform |
| CI/CD | GitHub Actions |
| GPU | **NVIDIA CUDA 12.9** |
| gRPC | **Buf + protoc** |
| Observability | OpenTelemetry + Prometheus + **LangSmith** |
| AI/LLM | **OpenAI GPT-4o / Claude / Gemini** |

---

## 9. Suggested Build Order

Build these in phases so each phase is independently deployable and testable:

### Phase 1: Search & Messaging (Foundation)
1. Elasticsearch integration in Content API
2. RabbitMQ + Celery workers in Content + Intel

### Phase 2: ML Pipeline
3. PyTorch models in Intel (sentiment, image tagging, recommendations)
4. CUDA Docker variant for Intel

### Phase 3: gRPC
5. Proto definitions in `scope-proto/`
6. gRPC servers in Content + Intel
7. gRPC clients in Core + Metrics

### Phase 4: AI/Agentic
8. RAG service (`scope-rag/`) with ChromaDB + LangChain
9. LangGraph agentic trip planner in Intel
10. Semantic Kernel in Core API

### Phase 5: New Frontends
11. Vue admin dashboard (`scope-admin/`)
12. Vue marketing site (`scope-site/`)
13. CrewAI multi-agent system

### Phase 6: Polish
14. LangSmith observability for all AI chains
15. End-to-end Playwright tests for new surfaces
16. Update Kubernetes manifests + Terraform for all new services

---

## 10. Resume Impact Summary

After full expansion, Scope becomes:

> **A polyglot microservice platform spanning 9 languages and 12 services - featuring GPU-accelerated ML inference, agentic AI trip planning with LangChain/LangGraph, RAG-powered natural language search over review embeddings, gRPC inter-service communication, Elasticsearch full-text + geo search, dual message brokers (Kafka + RabbitMQ), and Vue-based web/admin surfaces - all orchestrated via Docker, Kubernetes, Terraform, and GitHub Actions CI/CD.**

That's a project that makes hiring managers stop scrolling.
