# Phase 4: AI / Agentic Workflows — Codex Build Spec

> **Scope**: Add a RAG service (`scope-rag/`), LangChain/LangGraph agentic trip planner in Intel, and Semantic Kernel in Core API.
> **Prerequisites**: Phases 1–3 complete (Elasticsearch, RabbitMQ, ML pipeline, gRPC all running).
> **Do NOT modify**: Frontend, iOS, Android, CLI, scope_media, scope_geo.

---

## Part A: RAG Service (`scope-rag/`)

### Overview
A new FastAPI microservice that provides Retrieval-Augmented Generation — users ask natural-language questions and get answers grounded in real Scope review/spot data stored in a ChromaDB vector store.

### A1. Directory Structure

```
scope-rag/
├── Dockerfile
├── requirements.txt
├── .env.example
├── app/
│   ├── __init__.py
│   ├── main.py                # FastAPI app entry point
│   ├── config.py              # Settings from environment
│   ├── embeddings.py          # Embedding generation (Ollama / sentence-transformers)
│   ├── vectorstore.py         # ChromaDB client wrapper
│   ├── retriever.py           # Retrieval logic (query → relevant docs)
│   ├── chain.py               # RAG chain (retriever + LLM → answer)
│   ├── ingestion.py           # Kafka consumer to ingest new reviews/spots
│   └── routes.py              # API endpoints
├── tests/
│   ├── __init__.py
│   ├── test_retriever.py
│   ├── test_chain.py
│   └── test_routes.py
└── scripts/
    └── seed_vectors.py        # One-time bulk ingestion of existing data
```

### A2. Dependencies

**File**: `scope-rag/requirements.txt` (NEW)

```
fastapi>=0.115.0
uvicorn[standard]>=0.34.0
langchain>=0.3.0
langchain-ollama>=0.3.0
langchain-community>=0.3.0
langchain-chroma>=0.2.0
chromadb>=0.6.0
sentence-transformers>=4.0.0
pydantic>=2.10.0
pydantic-settings>=2.7.0
httpx>=0.28.0
confluent-kafka>=2.13.2
PyJWT>=2.10.0
python-json-logger>=3.2.0
pytest>=8.3.0
pytest-asyncio>=0.25.0
```

### A3. Configuration

**File**: `scope-rag/app/config.py` (NEW)

```python
"""Configuration from environment variables."""

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Ollama (local LLM — free, no API key needed)
    ollama_base_url: str = "http://ollama:11434"
    ollama_model: str = "llama3.1"
    embedding_model: str = "nomic-embed-text"  # Ollama embedding model

    # ChromaDB
    chroma_persist_dir: str = "/app/data/chroma"
    chroma_collection_name: str = "scope-reviews"

    # Service URLs
    content_service_url: str = "http://content:8000/api/content"
    elasticsearch_url: str = "http://elasticsearch:9200"

    # JWT
    core_jwt_secret: str = ""
    core_jwt_issuer: str = "scope-core"
    core_jwt_audience: str = "scope-frontend"

    # Kafka
    kafka_bootstrap_servers: str = "kafka:9092"
    kafka_enabled: bool = True

    # RAG
    retriever_top_k: int = 10
    max_context_tokens: int = 4000
    temperature: float = 0.3

    class Config:
        env_file = ".env"


settings = Settings()
```

### A4. Embedding Generation

**File**: `scope-rag/app/embeddings.py` (NEW)

```python
"""Embedding generation for vector store ingestion and queries."""

import logging
from typing import Any

from langchain_ollama import OllamaEmbeddings

from app.config import settings

logger = logging.getLogger(__name__)

_embeddings = None


def get_embeddings() -> OllamaEmbeddings:
    """Get singleton Ollama embedding model (free, local)."""
    global _embeddings
    if _embeddings is None:
        _embeddings = OllamaEmbeddings(
            model=settings.embedding_model,
            base_url=settings.ollama_base_url,
        )
    return _embeddings


def embed_text(text: str) -> list[float]:
    """Generate embedding for a single text."""
    return get_embeddings().embed_query(text)


def embed_texts(texts: list[str]) -> list[list[float]]:
    """Generate embeddings for a batch of texts."""
    return get_embeddings().embed_documents(texts)
```

### A5. Vector Store

**File**: `scope-rag/app/vectorstore.py` (NEW)

```python
"""ChromaDB vector store management."""

import logging
from typing import Any

from langchain_chroma import Chroma

from app.config import settings
from app.embeddings import get_embeddings

logger = logging.getLogger(__name__)

_vectorstore = None


def get_vectorstore() -> Chroma:
    """Get singleton ChromaDB vector store."""
    global _vectorstore
    if _vectorstore is None:
        _vectorstore = Chroma(
            collection_name=settings.chroma_collection_name,
            embedding_function=get_embeddings(),
            persist_directory=settings.chroma_persist_dir,
        )
        logger.info(
            "ChromaDB initialized: collection=%s, persist_dir=%s",
            settings.chroma_collection_name,
            settings.chroma_persist_dir,
        )
    return _vectorstore


def add_document(doc_id: str, text: str, metadata: dict[str, Any]) -> None:
    """Add a single document to the vector store."""
    store = get_vectorstore()
    store.add_texts(texts=[text], metadatas=[metadata], ids=[doc_id])


def add_documents(docs: list[dict[str, Any]]) -> None:
    """Add multiple documents to the vector store.

    Each doc: {"id": str, "text": str, "metadata": dict}
    """
    store = get_vectorstore()
    store.add_texts(
        texts=[d["text"] for d in docs],
        metadatas=[d["metadata"] for d in docs],
        ids=[d["id"] for d in docs],
    )


def search(query: str, k: int = 10, filter_dict: dict | None = None) -> list[dict]:
    """Search the vector store for similar documents."""
    store = get_vectorstore()
    results = store.similarity_search_with_score(query, k=k, filter=filter_dict)
    return [
        {
            "text": doc.page_content,
            "metadata": doc.metadata,
            "score": float(score),
        }
        for doc, score in results
    ]
```

### A6. RAG Chain

**File**: `scope-rag/app/chain.py` (NEW)

```python
"""RAG chain — retrieval + LLM generation with grounded answers."""

import logging

from langchain_ollama import ChatOllama
from langchain.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
from langchain_core.runnables import RunnablePassthrough

from app.config import settings
from app.vectorstore import search

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are Scope AI, a knowledgeable travel assistant for the Scope adventure platform.
Answer the user's question using ONLY the context provided below. The context consists of real user reviews and spot descriptions from Scope.

Rules:
1. Only cite information present in the context. Do not fabricate or hallucinate.
2. If the context doesn't contain enough information, say so honestly.
3. Be specific — mention spot names, ratings, and details from reviews.
4. Keep answers concise but helpful (2-4 paragraphs max).
5. If asked for recommendations, rank them and explain why.

Context:
{context}
"""


def ask(question: str, filters: dict | None = None, top_k: int | None = None) -> dict:
    """Ask a question and get a grounded answer.

    Args:
        question: Natural language question.
        filters: Optional metadata filters (e.g., {"location": "Tokyo"}).
        top_k: Number of context documents to retrieve.

    Returns: {"answer": str, "sources": list[dict], "model": str}
    """
    k = top_k or settings.retriever_top_k

    # Retrieve relevant documents
    results = search(question, k=k, filter_dict=filters)

    if not results:
        return {
            "answer": "I couldn't find any relevant information in Scope to answer that question. Try being more specific about the location or type of experience you're looking for.",
            "sources": [],
            "model": settings.ollama_model,
        }

    # Build context string
    context_parts = []
    for i, r in enumerate(results, 1):
        meta = r["metadata"]
        spot_name = meta.get("spot_name", "Unknown Spot")
        rating = meta.get("rating", "N/A")
        context_parts.append(f"[{i}] Spot: {spot_name} | Rating: {rating}/5\n{r['text']}")

    context = "\n\n".join(context_parts)

    # Build and invoke chain — using Ollama (free, local LLM)
    llm = ChatOllama(
        model=settings.ollama_model,
        temperature=settings.temperature,
        base_url=settings.ollama_base_url,
    )

    prompt = ChatPromptTemplate.from_messages([
        ("system", SYSTEM_PROMPT),
        ("human", "{question}"),
    ])

    chain = (
        {"context": lambda _: context, "question": RunnablePassthrough()}
        | prompt
        | llm
        | StrOutputParser()
    )

    answer = chain.invoke(question)

    return {
        "answer": answer,
        "sources": [
            {
                "spot_name": r["metadata"].get("spot_name"),
                "spot_id": r["metadata"].get("spot_id"),
                "rating": r["metadata"].get("rating"),
                "relevance_score": r["score"],
            }
            for r in results
        ],
        "model": settings.ollama_model,
        "context_docs_used": len(results),
    }
```

### A7. API Routes

**File**: `scope-rag/app/routes.py` (NEW)

```python
"""RAG API routes."""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.chain import ask
from app.vectorstore import add_document, search as vs_search, get_vectorstore
from app.config import settings

router = APIRouter(prefix="/api/rag")


class AskRequest(BaseModel):
    question: str = Field(..., min_length=3, max_length=1000)
    filters: dict | None = None
    top_k: int = Field(default=10, ge=1, le=50)


class AskResponse(BaseModel):
    answer: str
    sources: list[dict]
    model: str
    context_docs_used: int


class IngestRequest(BaseModel):
    id: str
    text: str
    metadata: dict


@router.post("/ask", response_model=AskResponse)
async def ask_question(req: AskRequest):
    """Ask a natural-language question about Scope spots and experiences."""
    try:
        result = ask(req.question, filters=req.filters, top_k=req.top_k)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/ingest")
async def ingest_document(req: IngestRequest):
    """Ingest a single document into the vector store."""
    add_document(req.id, req.text, req.metadata)
    return {"status": "ingested", "id": req.id}


@router.get("/search")
async def search_vectors(q: str, k: int = 10):
    """Search the vector store directly (for debugging)."""
    results = vs_search(q, k=k)
    return {"query": q, "results": results}


@router.get("/health")
async def health():
    """Health check."""
    vs = get_vectorstore()
    count = vs._collection.count() if vs else 0
    return {
        "status": "healthy",
        "service": "scope-rag",
        "vector_count": count,
        "model": settings.ollama_model,
        "embedding_model": settings.embedding_model,
    }
```

### A8. FastAPI App

**File**: `scope-rag/app/main.py` (NEW)

```python
"""Scope RAG Service — FastAPI application."""

import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routes import router
from app.config import settings

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(levelname)s %(message)s")

app = FastAPI(title="Scope RAG Service", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)


@app.on_event("startup")
async def startup():
    logging.getLogger(__name__).info("Scope RAG Service starting...")
```

### A9. Dockerfile

**File**: `scope-rag/Dockerfile` (NEW)

```dockerfile
FROM python:3.14-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . /app

RUN addgroup --system --gid 10004 rag && \
    adduser --system --uid 10004 --ingroup rag rag && \
    mkdir -p /app/data/chroma && \
    chown -R rag:rag /app

USER rag
EXPOSE 8100

HEALTHCHECK --interval=15s --timeout=5s --retries=5 --start-period=20s \
    CMD curl -fsS http://localhost:8100/api/rag/health || exit 1

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8100", "--workers", "2"]
```

### A10. Docker Compose

Add to `docker-compose.yml`:

```yaml
  ollama:
    image: ollama/ollama:latest
    container_name: scope-ollama
    restart: unless-stopped
    ports:
      - "${OLLAMA_PORT:-11434}:11434"
    volumes:
      - ollama-data:/root/.ollama
    healthcheck:
      test: ["CMD-SHELL", "curl -fsSL http://localhost:11434/api/tags || exit 1"]
      interval: 15s
      timeout: 5s
      retries: 10
      start_period: 30s
    mem_limit: 4096m
    # To use GPU acceleration (optional, requires nvidia-docker):
    # deploy:
    #   resources:
    #     reservations:
    #       devices:
    #         - driver: nvidia
    #           count: 1
    #           capabilities: [gpu]

  rag:
    build:
      context: ./scope-rag
    restart: unless-stopped
    depends_on:
      ollama:
        condition: service_healthy
      content:
        condition: service_healthy
      elasticsearch:
        condition: service_healthy
      kafka:
        condition: service_healthy
    environment:
      OLLAMA_BASE_URL: http://ollama:11434
      OLLAMA_MODEL: ${OLLAMA_MODEL:-llama3.1}
      EMBEDDING_MODEL: ${EMBEDDING_MODEL:-nomic-embed-text}
      CONTENT_SERVICE_URL: http://content:8000/api/content
      ELASTICSEARCH_URL: ${ELASTICSEARCH_URL:-http://elasticsearch:9200}
      CORE_JWT_SECRET: ${CORE_JWT_SECRET:?CORE_JWT_SECRET is required}
      KAFKA_BOOTSTRAP_SERVERS: ${KAFKA_BOOTSTRAP_SERVERS}
    volumes:
      - rag-data:/app/data
    expose:
      - "8100"
    mem_limit: 512m
    security_opt:
      - no-new-privileges:true
    cap_drop:
      - ALL
```

Add `rag-data:` and `ollama-data:` to volumes section.

**IMPORTANT**: After the Ollama container starts, pull the models (one-time):
```bash
docker compose exec ollama ollama pull llama3.1
docker compose exec ollama ollama pull nomic-embed-text
```

Add Nginx route:
```nginx
location /api/rag/ {
    proxy_pass http://rag:8100;
}
```

---

## Part B: LangGraph Agentic Trip Planner (Intel API Enhancement)

### B1. Dependencies

**File**: `scope_intel/requirements.txt` (MODIFY — append)

```
langchain>=0.3.0
langchain-ollama>=0.3.0
langgraph>=0.4.0
```

### B2. Agent Tools

**File**: `scope_intel/app/agents/tools.py` (NEW)

```python
"""LangChain tools the trip planner agent can call."""

import os
import requests
from langchain_core.tools import tool

CONTENT_URL = os.environ.get("CONTENT_SERVICE_URL", "http://content:8000/api/content")
ES_URL = os.environ.get("ELASTICSEARCH_URL", "http://elasticsearch:9200")


@tool
def search_spots(query: str, limit: int = 10) -> list[dict]:
    """Search Scope spots by keyword. Returns spot names, ratings, and descriptions."""
    resp = requests.get(f"{CONTENT_URL}/search", params={"q": query, "type": "spots", "limit": limit}, timeout=10)
    if resp.ok:
        return resp.json().get("results", [])
    return []


@tool
def search_nearby(lat: float, lon: float, radius_km: int = 10) -> list[dict]:
    """Find Scope spots near a geographic coordinate."""
    resp = requests.get(
        f"{CONTENT_URL}/search/nearby",
        params={"lat": lat, "lon": lon, "radius": f"{radius_km}km", "limit": 15},
        timeout=10,
    )
    if resp.ok:
        return resp.json().get("results", [])
    return []


@tool
def get_spot_reviews(spot_id: str, limit: int = 5) -> list[dict]:
    """Get reviews for a specific spot."""
    resp = requests.get(f"{CONTENT_URL}/spots/{spot_id}/reviews/", params={"limit": limit}, timeout=10)
    if resp.ok:
        return resp.json().get("results", [])
    return []


@tool
def get_weather(location: str, date: str) -> dict:
    """Get weather forecast for a location on a specific date. Returns temp, conditions."""
    # Placeholder — integrate with a real weather API (OpenWeatherMap, etc.)
    return {
        "location": location,
        "date": date,
        "temp_high_f": 75,
        "temp_low_f": 60,
        "conditions": "Partly Cloudy",
        "source": "placeholder",
    }


@tool
def calculate_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> dict:
    """Calculate distance in km between two geographic points."""
    import math
    R = 6371
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat / 2) ** 2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2) ** 2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return {"distance_km": round(R * c, 2)}


@tool
def predict_trip_cost(num_spots: int, total_distance_km: float, month: int) -> dict:
    """Predict trip duration and cost based on parameters."""
    from app.ml.inference.predictor import predict_trip
    return predict_trip({
        "num_spots": num_spots,
        "total_distance_km": total_distance_km,
        "month": month,
    })
```

### B3. LangGraph Trip Planner Agent

**File**: `scope_intel/app/agents/trip_planner.py` (NEW)

```python
"""LangGraph agentic trip planner — multi-step reasoning over Scope data."""

import logging
import os
from typing import Annotated, TypedDict

from langchain_ollama import ChatOllama
from langchain_core.messages import HumanMessage, SystemMessage
from langgraph.graph import StateGraph, START, END
from langgraph.graph.message import add_messages
from langgraph.prebuilt import ToolNode

from app.agents.tools import (
    search_spots,
    search_nearby,
    get_spot_reviews,
    get_weather,
    calculate_distance,
    predict_trip_cost,
)

logger = logging.getLogger(__name__)

TOOLS = [search_spots, search_nearby, get_spot_reviews, get_weather, calculate_distance, predict_trip_cost]

SYSTEM_MESSAGE = """You are Scope Trip Planner, an AI agent that creates detailed travel itineraries.

You have access to tools that let you:
- Search for spots by keyword or location
- Read real user reviews for spots
- Check weather forecasts
- Calculate distances between spots
- Predict trip cost and duration

Process:
1. Understand what the user wants (destination, interests, duration, budget)
2. Search for relevant spots using multiple queries based on their interests
3. Read reviews to evaluate spot quality
4. Check weather for the travel dates
5. Calculate distances to plan an efficient route
6. Predict cost and duration
7. Build a day-by-day itinerary with reasoning

Always provide specific spot names, ratings, and why you recommend them based on reviews.
Output a structured JSON itinerary at the end."""


class AgentState(TypedDict):
    messages: Annotated[list, add_messages]


def create_trip_planner():
    """Create and return the LangGraph trip planner agent."""
    llm = ChatOllama(
        model=os.environ.get("OLLAMA_MODEL", "llama3.1"),
        temperature=0.3,
        base_url=os.environ.get("OLLAMA_BASE_URL", "http://ollama:11434"),
    ).bind_tools(TOOLS)

    tool_node = ToolNode(TOOLS)

    def agent_node(state: AgentState) -> AgentState:
        response = llm.invoke(state["messages"])
        return {"messages": [response]}

    def should_continue(state: AgentState) -> str:
        last_message = state["messages"][-1]
        if hasattr(last_message, "tool_calls") and last_message.tool_calls:
            return "tools"
        return "end"

    # Build graph
    graph = StateGraph(AgentState)
    graph.add_node("agent", agent_node)
    graph.add_node("tools", tool_node)

    graph.add_edge(START, "agent")
    graph.add_conditional_edges("agent", should_continue, {"tools": "tools", "end": END})
    graph.add_edge("tools", "agent")

    return graph.compile()


def plan_trip(prompt: str, user_id: str | None = None, start_date: str | None = None) -> dict:
    """Plan a trip using the agentic workflow.

    Args:
        prompt: User's trip request (e.g., "Plan a 3-day trip to San Francisco, I love hiking")
        user_id: Optional user ID for personalization
        start_date: Optional start date

    Returns: {"itinerary": str, "steps": int, "model": str}
    """
    agent = create_trip_planner()

    # Build initial message
    context_parts = [prompt]
    if start_date:
        context_parts.append(f"Travel dates starting: {start_date}")
    if user_id:
        context_parts.append(f"User ID for personalization: {user_id}")

    full_prompt = "\n".join(context_parts)

    initial_state = {
        "messages": [
            SystemMessage(content=SYSTEM_MESSAGE),
            HumanMessage(content=full_prompt),
        ]
    }

    # Run agent (with max iterations to prevent infinite loops)
    config = {"recursion_limit": 25}
    result = agent.invoke(initial_state, config=config)

    # Extract final answer
    final_message = result["messages"][-1]

    return {
        "itinerary": final_message.content,
        "steps": len(result["messages"]),
        "model": os.environ.get("OLLAMA_MODEL", "llama3.1"),
    }
```

### B4. Agent Route

**File**: `scope_intel/app/routes/agent.py` (NEW)

```python
"""Agentic trip planner API routes."""

from flask import Blueprint, jsonify, request

from app.agents.trip_planner import plan_trip

bp = Blueprint("agent", __name__, url_prefix="/api/intel/agent")


@bp.route("/plan-trip", methods=["POST"])
def plan():
    """Plan a trip using the AI agent.

    Body: {"prompt": "Plan a 3-day trip...", "user_id": "abc", "start_date": "2026-06-15"}
    """
    data = request.get_json(silent=True) or {}

    if "prompt" not in data:
        return jsonify({"error": "prompt is required"}), 400

    result = plan_trip(
        prompt=data["prompt"],
        user_id=data.get("user_id"),
        start_date=data.get("start_date"),
    )

    return jsonify(result)
```

Register in Flask app:
```python
from app.routes.agent import bp as agent_bp
app.register_blueprint(agent_bp)
```

---

## Part C: Semantic Kernel (Core API — .NET)

### C1. NuGet Package

Add to `Scope.Core.API.csproj`:

```xml
<PackageReference Include="Microsoft.SemanticKernel" Version="1.47.0" />
<PackageReference Include="Microsoft.SemanticKernel.Connectors.Ollama" Version="1.47.0-preview" />
```

### C2. Semantic Kernel Service

**File**: `Scope.Core/Scope.Core.Infrastructure/AI/ScopeAIService.cs` (NEW)

```csharp
using Microsoft.SemanticKernel;
using Microsoft.SemanticKernel.ChatCompletion;

namespace Scope.Core.Infrastructure.AI;

public class ScopeAIService
{
    private readonly Kernel _kernel;
    private readonly IChatCompletionService _chat;

    public ScopeAIService(string ollamaBaseUrl = "http://ollama:11434", string model = "llama3.1")
    {
        var builder = Kernel.CreateBuilder();
#pragma warning disable SKEXP0070
        builder.AddOllamaChatCompletion(model, new Uri(ollamaBaseUrl));
#pragma warning restore SKEXP0070
        _kernel = builder.Build();
        _chat = _kernel.GetRequiredService<IChatCompletionService>();
    }

    /// <summary>
    /// Summarize a batch of notifications for a user.
    /// </summary>
    public async Task<string> SummarizeNotifications(IEnumerable<string> notifications)
    {
        var history = new ChatHistory();
        history.AddSystemMessage("You are a concise notification summarizer for a travel app. Summarize the following notifications into 1-2 sentences.");
        history.AddUserMessage(string.Join("\n", notifications));

        var result = await _chat.GetChatMessageContentAsync(history);
        return result.Content ?? "No summary available.";
    }

    /// <summary>
    /// Generate friend recommendations based on travel overlap.
    /// </summary>
    public async Task<string> SuggestFriends(string userProfile, IEnumerable<string> candidateProfiles)
    {
        var history = new ChatHistory();
        history.AddSystemMessage("You are a friend recommendation engine for a travel app. Based on travel history overlap, suggest which candidates would be good friends for the user. Be specific about shared interests.");
        history.AddUserMessage($"User profile:\n{userProfile}\n\nCandidates:\n{string.Join("\n---\n", candidateProfiles)}");

        var result = await _chat.GetChatMessageContentAsync(history);
        return result.Content ?? "No suggestions available.";
    }
}
```

### C3. Register in DI

In `Program.cs` or `Startup.cs`:

```csharp
var ollamaUrl = builder.Configuration["OLLAMA_BASE_URL"] ?? "http://ollama:11434";
builder.Services.AddSingleton(new ScopeAIService(ollamaUrl));
```

### C4. Environment variable

Add `OLLAMA_BASE_URL` to the `core` service environment in `docker-compose.yml`:
```yaml
      OLLAMA_BASE_URL: ${OLLAMA_BASE_URL:-http://ollama:11434}
```

Add `ollama` as a dependency of the `core` service.

---

## Part D: Environment Variables

**File**: `.env.example` (MODIFY — append)

```env
# ── AI / LLM (Ollama — free, local) ───────────────
OLLAMA_BASE_URL=http://ollama:11434
OLLAMA_MODEL=llama3.1
OLLAMA_PORT=11434
EMBEDDING_MODEL=nomic-embed-text
```

---

## Validation Checklist

```powershell
# 1. Start Ollama and pull models (one-time)
docker compose up --build -d ollama
docker compose exec ollama ollama pull llama3.1
docker compose exec ollama ollama pull nomic-embed-text

# 2. Build RAG service
docker compose up --build -d rag

# 3. Verify Ollama is running
curl http://localhost:11434/api/tags

# 4. Verify RAG health
curl http://localhost/api/rag/health

# 5. Test RAG ask (no API key needed — Ollama is local!)
curl -X POST http://localhost/api/rag/ask \
  -H "Content-Type: application/json" \
  -d '{"question": "What are the best sunset spots?"}'

# 6. Test trip planner agent
curl -X POST http://localhost/api/intel/agent/plan-trip \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Plan a 2-day trip to San Francisco for hiking and seafood"}'

# 7. Rebuild Core with Semantic Kernel
cd Scope.Core; dotnet build Scope.Core.sln

# 8. Run tests
cd scope-rag; python -m pytest tests/ -v
```

---

## Files Created / Modified Summary

| Action | File |
|---|---|
| NEW | `scope-rag/` (entire new service — 12 files) |
| NEW | `scope_intel/app/agents/__init__.py` |
| NEW | `scope_intel/app/agents/tools.py` |
| NEW | `scope_intel/app/agents/trip_planner.py` |
| NEW | `scope_intel/app/routes/agent.py` |
| NEW | `Scope.Core/Scope.Core.Infrastructure/AI/ScopeAIService.cs` |
| MODIFY | `scope_intel/requirements.txt` (add langchain, langgraph) |
| MODIFY | `scope_intel/app/__init__.py` (register agent blueprint) |
| MODIFY | `Scope.Core/Scope.Core.API/Scope.Core.API.csproj` (add SemanticKernel) |
| MODIFY | `docker-compose.yml` (add rag service) |
| MODIFY | `nginx/nginx.conf` (add /api/rag/ route) |
| MODIFY | `.env.example` (add OPENAI vars) |
