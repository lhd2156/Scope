"""Built-in Scope app knowledge for route and API questions.

The vector store contains user-generated place content. This catalog covers the
product surface itself so Scope AI can answer questions about navigation,
services, endpoints, and local Ollama/RAG wiring even before any vectors are
seeded.
"""

from __future__ import annotations

import re
from functools import lru_cache
from typing import Any

CATALOG_VERSION = "2026-05-02"

_TOKEN_RE = re.compile(r"[a-z0-9_:/.-]+")
_PATH_RE = re.compile(r"/[a-z0-9_:/{}?.=&.-]*", re.IGNORECASE)

_STOP_WORDS = {
    "a",
    "about",
    "all",
    "an",
    "and",
    "any",
    "are",
    "as",
    "at",
    "be",
    "can",
    "do",
    "does",
    "for",
    "from",
    "get",
    "give",
    "have",
    "how",
    "i",
    "in",
    "is",
    "it",
    "me",
    "of",
    "on",
    "or",
    "please",
    "show",
    "such",
    "tell",
    "that",
    "the",
    "there",
    "this",
    "to",
    "what",
    "where",
    "which",
    "with",
}

_APP_INTENT_TERMS = {
    "ai",
    "api",
    "app",
    "architecture",
    "assistant",
    "auth",
    "backend",
    "content",
    "controller",
    "core",
    "django",
    "endpoint",
    "endpoints",
    "flask",
    "frontend",
    "health",
    "intel",
    "intelligence",
    "login",
    "map",
    "navigation",
    "nginx",
    "ollama",
    "page",
    "pages",
    "rag",
    "register",
    "route",
    "routes",
    "screen",
    "screens",
    "service",
    "services",
    "signalr",
    "vue",
}

_APP_SURFACE_TERMS = {
    "budget",
    "draft",
    "drafts",
    "feed",
    "friend",
    "friends",
    "itinerary",
    "itineraries",
    "notification",
    "notifications",
    "planner",
    "profile",
    "search",
    "setting",
    "settings",
    "spot",
    "spots",
    "trip",
    "trips",
}

FRONTEND_ROUTES: list[dict[str, str | bool]] = [
    {
        "path": "/",
        "name": "home",
        "auth": False,
        "description": "Public home screen with featured spots, trip discovery, and entry points into Scope.",
    },
    {
        "path": "/explore",
        "name": "explore",
        "auth": False,
        "description": "Public spot discovery page for browsing by category, city, search, and vibe.",
    },
    {
        "path": "/map",
        "name": "map",
        "auth": False,
        "description": "Public interactive Mapbox map for viewing pins, previews, and route context.",
    },
    {
        "path": "/trips",
        "name": "trips",
        "auth": True,
        "description": "Private trips workspace for saved drafts, shared trips, and published routes.",
    },
    {
        "path": "/trips/new",
        "name": "trip-planner",
        "auth": True,
        "description": "Private AI trip planner where users create a trip, choose destination, dates, budget, pace, vibes, and generate an itinerary.",
    },
    {
        "path": "/trips/:id/edit",
        "name": "trip-edit",
        "auth": True,
        "description": "Private edit screen for an existing trip draft.",
    },
    {
        "path": "/trips/:id",
        "name": "trip-detail",
        "auth": True,
        "description": "Private trip detail workspace with itinerary timing, pinned stops, and collaborators.",
    },
    {
        "path": "/ai/trip-planner",
        "name": "ai-trip-planner-redirect",
        "auth": True,
        "description": "Redirects to /trips/new with the assistant panel open.",
    },
    {
        "path": "/ai/ask",
        "name": "scope-ai",
        "auth": True,
            "description": "Private Scope AI chat page backed by /api/rag/ask with Gemini or Ollama model routing.",
    },
    {
        "path": "/spots/new",
        "name": "spot-create",
        "auth": True,
        "description": "Private spot composer for dropping a new Scope pin with photos and notes.",
    },
    {
        "path": "/spots/:id/edit",
        "name": "spot-edit",
        "auth": True,
        "description": "Private edit screen for an existing spot.",
    },
    {
        "path": "/spots/:id",
        "name": "spot-detail",
        "auth": False,
        "description": "Public spot detail page with photos, reviews, map context, and location details.",
    },
    {
        "path": "/profile/:id",
        "name": "profile",
        "auth": True,
        "description": "Private explorer profile with mapped highlights, public pins, and trip footprint.",
    },
    {
        "path": "/friends",
        "name": "friends",
        "auth": True,
        "description": "Private friend graph for requests, accepted friends, and shared-adventure relationships.",
    },
    {
        "path": "/settings",
        "name": "settings",
        "auth": True,
        "description": "Private account settings for profile, preferences, privacy, and account details.",
    },
    {
        "path": "/login",
        "name": "login",
        "auth": False,
        "description": "Guest-only login page for email/password authentication.",
    },
    {
        "path": "/register",
        "name": "register",
        "auth": False,
        "description": "Guest-only registration page for creating an Scope account.",
    },
    {
        "path": "/onboarding/preferences",
        "name": "onboarding-preferences",
        "auth": True,
        "description": "Private onboarding preferences page for tuning map, feed, and trip suggestions.",
    },
    {
        "path": "/privacy",
        "name": "privacy",
        "auth": False,
        "description": "Public privacy policy page. Alias: /privacy-policy.",
    },
    {
        "path": "/terms",
        "name": "terms",
        "auth": False,
        "description": "Public terms of service page. Alias: /terms-of-service.",
    },
    {
        "path": "/cookies",
        "name": "cookies",
        "auth": False,
        "description": "Public cookie choices page.",
    },
    {
        "path": "/accessibility",
        "name": "accessibility",
        "auth": False,
        "description": "Public accessibility notes page.",
    },
    {
        "path": "/security",
        "name": "security",
        "auth": False,
        "description": "Public security overview page.",
    },
    {
        "path": "/about",
        "name": "about",
        "auth": False,
        "description": "Public about page for the Scope product story.",
    },
    {
        "path": "/help",
        "name": "help",
        "auth": False,
        "description": "Public help page for exploring places, planning trips, and support.",
    },
    {
        "path": "/:pathMatch(.*)*",
        "name": "not-found",
        "auth": False,
        "description": "Fallback 404 route for unknown frontend paths.",
    },
]

API_ENDPOINTS: list[dict[str, str]] = [
    {"method": "POST", "path": "/api/core/auth/register", "service": "core", "description": "Register a new user."},
    {"method": "POST", "path": "/api/core/auth/login", "service": "core", "description": "Login with email/password."},
    {"method": "POST", "path": "/api/core/auth/refresh", "service": "core", "description": "Refresh a JWT session."},
    {"method": "POST", "path": "/api/core/auth/logout", "service": "core", "description": "Invalidate a refresh token."},
    {"method": "GET", "path": "/api/core/auth/me", "service": "core", "description": "Get the current user profile."},
    {
        "method": "POST",
        "path": "/api/core/auth/password-reset/request",
        "service": "core",
        "description": "Request a password reset.",
    },
    {
        "method": "POST",
        "path": "/api/core/auth/password-reset/complete",
        "service": "core",
        "description": "Complete a password reset.",
    },
    {
        "method": "POST",
        "path": "/api/core/auth/email/verify/send",
        "service": "core",
        "description": "Send an email verification token.",
    },
    {
        "method": "POST",
        "path": "/api/core/auth/email/verify",
        "service": "core",
        "description": "Verify an email token.",
    },
    {"method": "POST", "path": "/api/core/auth/mfa/enroll", "service": "core", "description": "Start MFA enrollment."},
    {
        "method": "POST",
        "path": "/api/core/auth/mfa/enroll/confirm",
        "service": "core",
        "description": "Confirm MFA enrollment.",
    },
    {"method": "POST", "path": "/api/core/auth/mfa/disable", "service": "core", "description": "Disable MFA."},
    {"method": "GET", "path": "/api/core/users/{id}", "service": "core", "description": "Get a user profile."},
    {"method": "GET", "path": "/api/core/users/search", "service": "core", "description": "Search users."},
    {"method": "POST", "path": "/api/core/friends/request/{userId}", "service": "core", "description": "Send a friend request."},
    {"method": "PUT", "path": "/api/core/friends/{id}/accept", "service": "core", "description": "Accept a friend request."},
    {"method": "PUT", "path": "/api/core/friends/{id}/reject", "service": "core", "description": "Reject a friend request."},
    {"method": "DELETE", "path": "/api/core/friends/{id}", "service": "core", "description": "Remove a friend."},
    {"method": "GET", "path": "/api/core/friends", "service": "core", "description": "List friends."},
    {"method": "GET", "path": "/api/core/friends/pending", "service": "core", "description": "List pending friend requests."},
    {"method": "GET", "path": "/api/core/notifications", "service": "core", "description": "List notifications."},
    {
        "method": "GET",
        "path": "/api/core/notifications/unread-count",
        "service": "core",
        "description": "Get unread notification count.",
    },
    {
        "method": "PUT",
        "path": "/api/core/notifications/{id}/read",
        "service": "core",
        "description": "Mark a notification as read.",
    },
    {"method": "PUT", "path": "/api/core/notifications/read-all", "service": "core", "description": "Mark all notifications read."},
    {"method": "POST", "path": "/api/core/live/start/{tripId}", "service": "core", "description": "Start a live location session."},
    {"method": "PUT", "path": "/api/core/live/ping", "service": "core", "description": "Update live location."},
    {"method": "GET", "path": "/api/core/live/trip/{tripId}", "service": "core", "description": "List active trip locations."},
    {"method": "GET", "path": "/api/core/health", "service": "core", "description": "Core health check."},
    {
        "method": "WS",
        "path": "/api/core/hubs/trips",
        "service": "core",
        "description": "SignalR trip collaboration hub.",
    },
    {
        "method": "WS",
        "path": "/api/core/hubs/location",
        "service": "core",
        "description": "SignalR live location hub.",
    },
    {
        "method": "WS",
        "path": "/api/core/hubs/notifications",
        "service": "core",
        "description": "SignalR notifications hub.",
    },
    {"method": "GET", "path": "/api/content/health", "service": "content", "description": "Content health check."},
    {"method": "GET", "path": "/api/content/search", "service": "content", "description": "Full-text content search."},
    {"method": "GET", "path": "/api/content/search/nearby", "service": "content", "description": "Geospatial search."},
    {"method": "GET,POST", "path": "/api/content/spots/", "service": "content", "description": "List or create spots."},
    {"method": "GET", "path": "/api/content/spots/nearby", "service": "content", "description": "Find nearby spots."},
    {"method": "GET", "path": "/api/content/spots/explore", "service": "content", "description": "Explore spots by filters."},
    {"method": "GET", "path": "/api/content/spots/user/{userId}", "service": "content", "description": "List spots by user."},
    {"method": "GET,PUT,DELETE", "path": "/api/content/spots/{id}", "service": "content", "description": "Read, update, or delete a spot."},
    {"method": "POST,DELETE", "path": "/api/content/spots/{id}/like", "service": "content", "description": "Like or unlike a spot."},
    {"method": "GET", "path": "/api/content/spots/{id}/photos", "service": "content", "description": "List photos for a spot."},
    {"method": "GET,POST", "path": "/api/content/trips/", "service": "content", "description": "List or create trips."},
    {"method": "GET", "path": "/api/content/trips/public", "service": "content", "description": "Browse public trips."},
    {"method": "GET,PUT,DELETE", "path": "/api/content/trips/{id}", "service": "content", "description": "Read, update, or delete a trip."},
    {"method": "POST", "path": "/api/content/trips/{id}/spots", "service": "content", "description": "Add a spot to a trip."},
    {"method": "PUT", "path": "/api/content/trips/{id}/spots/reorder", "service": "content", "description": "Reorder trip spots."},
    {"method": "DELETE", "path": "/api/content/trips/{id}/spots/{spotId}", "service": "content", "description": "Remove a trip spot."},
    {"method": "GET,POST", "path": "/api/content/trips/{id}/members", "service": "content", "description": "List or invite trip members."},
    {"method": "DELETE", "path": "/api/content/trips/{id}/members/{userId}", "service": "content", "description": "Remove a trip member."},
    {"method": "POST", "path": "/api/content/photos/upload", "service": "content", "description": "Upload a spot photo."},
    {"method": "GET", "path": "/api/content/photos/presigned-url", "service": "content", "description": "Get a presigned photo upload URL."},
    {"method": "GET,PUT,DELETE", "path": "/api/content/photos/{id}", "service": "content", "description": "Read, update, or delete a photo."},
    {"method": "GET,POST", "path": "/api/content/reviews/spot/{spotId}", "service": "content", "description": "List or create reviews for a spot."},
    {"method": "PUT,DELETE", "path": "/api/content/reviews/{id}", "service": "content", "description": "Update or delete a review."},
    {"method": "GET", "path": "/api/content/feed/", "service": "content", "description": "Social feed."},
    {"method": "GET", "path": "/api/content/feed/trending", "service": "content", "description": "Trending spots."},
    {"method": "POST", "path": "/api/content/interactions/", "service": "content", "description": "Record a user interaction."},
    {
        "method": "POST",
        "path": "/api/intel/itinerary/generate",
        "service": "intel",
        "description": "Generate an AI-optimized itinerary.",
    },
    {"method": "GET", "path": "/api/intel/itinerary/{id}", "service": "intel", "description": "Get a cached itinerary."},
    {"method": "POST", "path": "/api/intel/recommend/spots", "service": "intel", "description": "Get personalized spot recommendations."},
    {"method": "POST", "path": "/api/intel/recommend/similar/{spotId}", "service": "intel", "description": "Find spots similar to a spot."},
    {"method": "POST", "path": "/api/intel/recommend/feedback", "service": "intel", "description": "Record recommendation feedback."},
    {"method": "POST", "path": "/api/intel/recommend/ncf", "service": "intel", "description": "Neural collaborative filtering recommendations."},
    {"method": "POST", "path": "/api/intel/vibe-match", "service": "intel", "description": "Match spots by vibe description."},
    {"method": "POST", "path": "/api/intel/route/optimize", "service": "intel", "description": "Optimize route order between spots."},
    {"method": "GET", "path": "/api/intel/weather", "service": "intel", "description": "Get weather for trip planning."},
    {"method": "GET", "path": "/api/intel/geocode", "service": "intel", "description": "Geocode an address or place query."},
    {"method": "GET", "path": "/api/intel/reverse-geocode", "service": "intel", "description": "Reverse geocode coordinates."},
    {"method": "POST", "path": "/api/intel/agent/plan-trip", "service": "intel", "description": "Ask the Ollama trip-planning agent."},
    {"method": "POST", "path": "/api/intel/classify-image", "service": "intel", "description": "Classify an uploaded image."},
    {"method": "POST", "path": "/api/intel/predict-trip", "service": "intel", "description": "Run trip prediction inference."},
    {"method": "POST", "path": "/api/intel/sentiment", "service": "intel", "description": "Analyze review sentiment."},
    {"method": "GET", "path": "/api/intel/ml/info", "service": "intel", "description": "Inspect ML runtime and model status."},
    {"method": "GET", "path": "/api/intel/health", "service": "intel", "description": "Intel health check."},
    {"method": "POST", "path": "/api/rag/ask", "service": "rag", "description": "Ask Scope AI a grounded app or content question with hosted/local model fallback."},
    {"method": "POST", "path": "/api/rag/ingest", "service": "rag", "description": "Ingest a document into the RAG vector store."},
    {"method": "GET", "path": "/api/rag/search", "service": "rag", "description": "Debug search across app knowledge and vectors."},
    {"method": "GET", "path": "/api/rag/app-knowledge", "service": "rag", "description": "List built-in app knowledge documents."},
    {"method": "GET", "path": "/api/rag/health", "service": "rag", "description": "RAG health check."},
]

SERVICE_DOCS: list[dict[str, str]] = [
    {
        "id": "architecture:overview",
        "title": "Scope service architecture",
        "text": (
            "Scope is a polyglot microservice app. Core Platform is ASP.NET Core 8 and owns auth, users, "
            "friends, notifications, SignalR hubs, and live sessions. Content Engine is Django 5 and owns "
            "spots, trips, photos, reviews, feed, search, and interactions. Intelligence API is Flask 3 and "
            "owns itinerary generation, recommendations, vibe matching, route optimization, weather, geocoding, "
            "ML inference, and the trip-planning agent. RAG is FastAPI and owns Scope AI app/content question answering."
        ),
        "source_type": "architecture",
    },
    {
        "id": "architecture:proxy-prefixes",
        "title": "Nginx API proxy prefixes",
        "text": (
            "Nginx routes /api/core to the Core service, /api/content to the Content service, /api/intel to the "
            "Intelligence service, and /api/rag/ to the RAG service. Frontend traffic is served by the Vue app."
        ),
        "source_type": "architecture",
    },
    {
        "id": "assistant:capabilities",
        "title": "Scope AI capabilities",
        "text": (
            "Scope AI can answer grounded questions about app pages, frontend routes, API endpoints, service ownership, "
            "spots, reviews, recommendations, trip planning, and route optimization. Gemini handles the main chat when "
            "a key is configured. Ollama still has a clear app use case: local embeddings for private RAG memory and an "
            "offline fallback model for self-hosted or no-key setups. Scope AI should say when the available context is "
            "not enough instead of inventing details."
        ),
        "source_type": "assistant",
    },
]


def _normalize_query(text: str) -> str:
    replacements = {
        "annyquestions": "any questions",
        "anyquestions": "any questions",
        "routesand": "routes and",
        "routesn": "routes and",
    }
    normalized = text.lower()
    for source, target in replacements.items():
        normalized = normalized.replace(source, target)
    return normalized


def _tokenize(text: str) -> set[str]:
    tokens: set[str] = set()
    for token in _TOKEN_RE.findall(_normalize_query(text)):
        token = token.strip(".")
        if not token or token in _STOP_WORDS:
            continue
        tokens.add(token)
        if len(token) > 4 and token.endswith("s"):
            tokens.add(token[:-1])
    return tokens


def _looks_like_app_question(query: str) -> bool:
    normalized = _normalize_query(query)
    tokens = _tokenize(normalized)
    if tokens & _APP_INTENT_TERMS:
        return True
    if tokens & _APP_SURFACE_TERMS and re.search(r"\b(where|how|create|open|find|go|navigate)\b", normalized):
        return True
    return bool(_PATH_RE.search(normalized))


def _route_index_text() -> str:
    lines = ["Frontend routes:"]
    for route in FRONTEND_ROUTES:
        auth = "private/auth required" if route["auth"] else "public or guest"
        lines.append(f"- {route['path']} ({route['name']}, {auth}): {route['description']}")
    return "\n".join(lines)


def _api_index_text() -> str:
    grouped: dict[str, list[str]] = {}
    for endpoint in API_ENDPOINTS:
        service = endpoint["service"]
        grouped.setdefault(service, []).append(f"{endpoint['method']} {endpoint['path']} - {endpoint['description']}")

    lines = ["API endpoint index:"]
    for service in ["core", "content", "intel", "rag"]:
        lines.append(f"{service}:")
        lines.extend(f"- {entry}" for entry in grouped.get(service, []))
    return "\n".join(lines)


@lru_cache(maxsize=1)
def get_app_knowledge_documents() -> tuple[dict[str, Any], ...]:
    docs: list[dict[str, Any]] = []

    docs.append(
        {
            "id": "frontend:routes:index",
            "text": _route_index_text(),
            "metadata": {
                "source": "app_catalog",
                "source_type": "frontend_routes_index",
                "title": "Frontend route index",
                "path": "/",
                "catalog_version": CATALOG_VERSION,
            },
        }
    )

    for route in FRONTEND_ROUTES:
        auth = "requires authentication" if route["auth"] else "is public or guest-accessible"
        docs.append(
            {
                "id": f"frontend:route:{route['name']}",
                "text": f"Frontend route {route['path']} is named {route['name']} and {auth}. {route['description']}",
                "metadata": {
                    "source": "app_catalog",
                    "source_type": "frontend_route",
                    "title": f"Frontend route {route['path']}",
                    "path": route["path"],
                    "route_name": route["name"],
                    "requires_auth": bool(route["auth"]),
                    "catalog_version": CATALOG_VERSION,
                },
            }
        )

    docs.append(
        {
            "id": "api:endpoints:index",
            "text": _api_index_text(),
            "metadata": {
                "source": "app_catalog",
                "source_type": "api_endpoints_index",
                "title": "API endpoint index",
                "catalog_version": CATALOG_VERSION,
            },
        }
    )

    for endpoint in API_ENDPOINTS:
        docs.append(
            {
                "id": f"api:{endpoint['method']}:{endpoint['path']}",
                "text": (
                    f"API endpoint {endpoint['method']} {endpoint['path']} belongs to the "
                    f"{endpoint['service']} service. {endpoint['description']}"
                ),
                "metadata": {
                    "source": "app_catalog",
                    "source_type": "api_endpoint",
                    "title": f"{endpoint['method']} {endpoint['path']}",
                    "method": endpoint["method"],
                    "path": endpoint["path"],
                    "service": endpoint["service"],
                    "catalog_version": CATALOG_VERSION,
                },
            }
        )

    for doc in SERVICE_DOCS:
        docs.append(
            {
                "id": doc["id"],
                "text": doc["text"],
                "metadata": {
                    "source": "app_catalog",
                    "source_type": doc["source_type"],
                    "title": doc["title"],
                    "catalog_version": CATALOG_VERSION,
                },
            }
        )

    return tuple(docs)


def get_app_knowledge_count() -> int:
    """Return the number of built-in app knowledge documents."""
    return len(get_app_knowledge_documents())


def _score_document(query: str, query_tokens: set[str], doc: dict[str, Any]) -> int:
    metadata = doc["metadata"]
    text = doc["text"]
    searchable = " ".join(
        [
            text,
            str(metadata.get("title", "")),
            str(metadata.get("path", "")),
            str(metadata.get("route_name", "")),
            str(metadata.get("service", "")),
            str(metadata.get("method", "")),
            str(metadata.get("source_type", "")),
        ]
    )
    doc_tokens = _tokenize(searchable)
    overlap = query_tokens & doc_tokens
    score = len(overlap)

    path = str(metadata.get("path", ""))
    if path and path in query:
        score += 16

    title = str(metadata.get("title", "")).lower()
    if title and title in query:
        score += 8

    source_type = str(metadata.get("source_type", ""))
    if "route" in query_tokens and source_type.startswith("frontend"):
        score += 5
    if "api" in query_tokens and source_type.startswith("api"):
        score += 5
    if "endpoint" in query_tokens and source_type.startswith("api"):
        score += 5
    if "ollama" in query_tokens and source_type in {"assistant", "architecture"}:
        score += 5
    if "service" in query_tokens and source_type == "architecture":
        score += 4

    return score


def search_app_knowledge(query: str, k: int = 8) -> list[dict[str, Any]]:
    """Search built-in app knowledge with lightweight lexical scoring."""
    normalized_query = _normalize_query(query)
    if not _looks_like_app_question(normalized_query):
        return []

    query_tokens = _tokenize(normalized_query)
    scored: list[tuple[int, dict[str, Any]]] = []
    for doc in get_app_knowledge_documents():
        score = _score_document(normalized_query, query_tokens, doc)
        if score <= 0:
            continue
        scored.append((score, doc))

    scored.sort(key=lambda item: (-item[0], item[1]["id"]))
    results: list[dict[str, Any]] = []
    for score, doc in scored[:k]:
        results.append(
            {
                "text": doc["text"],
                "metadata": dict(doc["metadata"]),
                "score": round(1.0 / (1.0 + score), 6),
            }
        )
    return results
