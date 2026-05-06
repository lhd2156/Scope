# Phase 7: Frontend Integration — Codex Build Spec

> **Scope**: Wire all backend features from Phases 1–4 into the Vue.js frontend (`scope-frontend/`). Users will be able to use Elasticsearch search, the AI trip planner agent, the RAG chatbot, and see ML-powered insights (sentiment, recommendations, cost predictions) — all through the existing Scope UI.
> **Prerequisites**: Phases 1–4 complete (Elasticsearch, ML, gRPC, RAG + Agent all running).
> **Do NOT modify**: Core API, scope_content, scope_intel, scope-rag, iOS, Android, Metrics, CLI, scope_media, scope_geo, scope-site.

---

## Design Reference Mockups

All new pages and components **must** match the Scope dark-glassmorphism design language shown in the existing mockups (`scope-assets/mockups/01–08`). The following Phase 7-specific wireframes are provided as visual targets:

| Mockup | File | Covers |
|--------|------|--------|
| Scope AI Assistant | `scope-assets/mockups/09_scope_ai_assistant.png` | Part C — RAG chatbot page layout, chat bubbles, source citations, typing indicator |
| AI Trip Planner | `scope-assets/mockups/10_ai_trip_planner.png` | Part B — Suggestion chips, chat input, loading state, itinerary rendering |
| Home: ForYou + Nearby | `scope-assets/mockups/11_home_foryou_nearby.png` | Parts A4 + D2 — NearbySpots and ForYouSection card grids |
| Review Sentiment | `scope-assets/mockups/12_review_sentiment.png` | Part D1 — Sentiment badge pills (positive/mixed/critical) on review cards |
| Explore + Elasticsearch | `scope-assets/mockups/13_explore_elasticsearch.png` | Part A3 — Search bar with Elasticsearch results, highlighted terms, result count |

Use these mockups as the ground truth for layout, spacing, color, and component hierarchy. All glassmorphism panels, teal accents, eyebrow labels, and card patterns must be consistent with the existing Scope UI.

---

## Part A: Elasticsearch-Powered Search (Phase 1 → Frontend)

### Overview
Replace the existing client-side `matchesSearch()` filtering on the Explore page with real Elasticsearch full-text search. Add a "Nearby" search mode that uses geo-radius queries. Add search-as-you-type with debounce.

### A1. Search Service

**File**: `scope-frontend/src/services/searchService.ts` (NEW)

```typescript
import api from '@/services/api';

export interface SearchResult {
  id: string;
  name: string;
  description?: string;
  category?: string;
  tags?: string[];
  location?: { lat: number; lon: number };
  avg_rating?: number;
  review_count?: number;
  _score: number;
  _highlights?: Record<string, string[]>;
  _distance_km?: number;
}

export interface SearchResponse {
  query: string;
  type: string;
  total: number;
  offset: number;
  limit: number;
  results: SearchResult[];
}

export interface GeoSearchResponse {
  center: { lat: number; lon: number };
  radius: string;
  total: number;
  results: SearchResult[];
}

export async function searchContent(
  query: string,
  type: 'spots' | 'reviews' | 'trips' = 'spots',
  limit = 20,
  offset = 0,
): Promise<SearchResponse> {
  const { data } = await api.get<SearchResponse>('/api/content/search', {
    params: { q: query, type, limit, offset },
  });
  return data;
}

export async function searchNearby(
  lat: number,
  lon: number,
  radiusKm = 10,
  limit = 20,
): Promise<GeoSearchResponse> {
  const { data } = await api.get<GeoSearchResponse>('/api/content/search/nearby', {
    params: { lat, lon, radius: `${radiusKm}km`, limit },
  });
  return data;
}
```

### A2. Search Store

**File**: `scope-frontend/src/stores/search.ts` (NEW)

```typescript
import { defineStore } from 'pinia';
import { ref } from 'vue';
import {
  searchContent,
  searchNearby,
  type SearchResponse,
  type GeoSearchResponse,
} from '@/services/searchService';

export const useSearchStore = defineStore('search', () => {
  const results = ref<SearchResponse | null>(null);
  const geoResults = ref<GeoSearchResponse | null>(null);
  const loading = ref(false);
  const error = ref<string | null>(null);
  const lastQuery = ref('');

  async function search(query: string, type: 'spots' | 'reviews' | 'trips' = 'spots', limit = 20, offset = 0) {
    if (!query.trim()) {
      results.value = null;
      return;
    }
    loading.value = true;
    error.value = null;
    lastQuery.value = query;
    try {
      results.value = await searchContent(query, type, limit, offset);
    } catch (e: unknown) {
      error.value = e instanceof Error ? e.message : 'Search failed';
      results.value = null;
    } finally {
      loading.value = false;
    }
  }

  async function nearby(lat: number, lon: number, radiusKm = 10, limit = 20) {
    loading.value = true;
    error.value = null;
    try {
      geoResults.value = await searchNearby(lat, lon, radiusKm, limit);
    } catch (e: unknown) {
      error.value = e instanceof Error ? e.message : 'Nearby search failed';
      geoResults.value = null;
    } finally {
      loading.value = false;
    }
  }

  function clearResults() {
    results.value = null;
    geoResults.value = null;
    error.value = null;
    lastQuery.value = '';
  }

  return { results, geoResults, loading, error, lastQuery, search, nearby, clearResults };
});
```

### A3. Update Explore Page — Elasticsearch Search

**File**: `scope-frontend/src/views/ExplorePage.vue` (MODIFY)

In the `<script setup>` block:

1. Import the search store:
```typescript
import { useSearchStore } from '@/stores/search';
```

2. Add the search store instance and a debounce timer:
```typescript
const searchStore = useSearchStore();
let searchDebounceTimer: ReturnType<typeof setTimeout> | null = null;
```

3. Add a watcher on `searchQuery` that triggers Elasticsearch search with 300ms debounce:
```typescript
watch(searchQuery, (query) => {
  if (searchDebounceTimer) clearTimeout(searchDebounceTimer);

  if (!query.trim()) {
    searchStore.clearResults();
    return;
  }

  searchDebounceTimer = setTimeout(() => {
    void searchStore.search(query, 'spots', 20, 0);
  }, 300);
});
```

4. Update the `displayedSpots` computed to prefer Elasticsearch results when a search query is active:
```typescript
const displayedSpots = computed(() => {
  // When Elasticsearch results are available, use them
  if (searchQuery.value.trim() && searchStore.results?.results?.length) {
    return searchStore.results.results.map((r) => ({
      id: r.id,
      title: r.name,
      description: r.description ?? '',
      category: (r.category ?? 'other') as SpotCategory,
      rating: r.avg_rating ?? 0,
      city: '', // ES results may not have city — can be enriched later
      country: '',
      likesCount: 0,
      photoUrl: '',
    }));
  }

  // Fallback to client-side filtering
  const sorted = rankTrendingSpots(filteredSpots.value);
  return isScopeQaExploreMode ? sorted.slice(0, EXPLORE_AUDIT_RESULT_LIMIT) : sorted;
});
```

5. Show the search store loading state alongside the existing skeleton:
```typescript
const showResultsSkeleton = computed(() =>
  (isFetchingInitialResults.value && !baseSpots.value.length && !spotsStore.error) ||
  searchStore.loading,
);
```

### A4. Nearby Spots Component

**File**: `scope-frontend/src/components/spots/NearbySpots.vue` (NEW)

```vue
<template>
  <section v-if="nearbySpots.length" class="glass-panel nearby-panel">
    <div class="nearby-header">
      <div>
        <p class="eyebrow">Nearby</p>
        <h2>Spots within {{ radiusKm }}km</h2>
      </div>
      <span class="nearby-pill">{{ nearbySpots.length }} found</span>
    </div>

    <div class="nearby-grid stagger-in">
      <RouterLink
        v-for="(spot, index) in nearbySpots"
        :key="spot.id"
        :to="`/spots/${spot.id}`"
        class="nearby-card glass-panel"
        :style="{ '--scope-stagger-index': index }"
      >
        <div class="nearby-card__copy">
          <strong>{{ spot.name }}</strong>
          <span v-if="spot._distance_km != null" class="nearby-card__distance">
            {{ spot._distance_km.toFixed(1) }}km away
          </span>
          <span v-if="spot.avg_rating" class="nearby-card__rating">★ {{ spot.avg_rating.toFixed(1) }}</span>
        </div>
      </RouterLink>
    </div>
  </section>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { RouterLink } from 'vue-router';
import { useSearchStore } from '@/stores/search';
import type { SearchResult } from '@/services/searchService';

const props = withDefaults(defineProps<{
  lat?: number;
  lon?: number;
  radiusKm?: number;
  limit?: number;
}>(), {
  radiusKm: 10,
  limit: 8,
});

const searchStore = useSearchStore();
const nearbySpots = ref<SearchResult[]>([]);

onMounted(async () => {
  if (props.lat != null && props.lon != null) {
    await searchStore.nearby(props.lat, props.lon, props.radiusKm, props.limit);
    nearbySpots.value = searchStore.geoResults?.results ?? [];
  } else if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        await searchStore.nearby(pos.coords.latitude, pos.coords.longitude, props.radiusKm, props.limit);
        nearbySpots.value = searchStore.geoResults?.results ?? [];
      },
      () => { /* user denied geolocation, silently skip */ },
    );
  }
});
</script>

<style scoped>
.nearby-panel {
  padding: var(--space-6);
  display: grid;
  gap: var(--space-5);
}
.nearby-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.nearby-header h2, .nearby-header p { margin: 0; }
.eyebrow {
  color: var(--accent-teal);
  text-transform: uppercase;
  letter-spacing: 0.14em;
  font-size: var(--font-size-caption);
}
.nearby-pill {
  padding: 0.55rem 0.85rem;
  border-radius: var(--radius-full);
  background: var(--glass-bg);
  border: 1px solid var(--glass-border);
  font-size: var(--font-size-small);
}
.nearby-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(16rem, 1fr));
  gap: var(--space-4);
}
.nearby-card {
  padding: var(--space-4);
  transition: transform var(--transition-fast), box-shadow var(--transition-fast);
}
.nearby-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
}
.nearby-card__copy {
  display: grid;
  gap: var(--space-2);
}
.nearby-card__distance {
  color: var(--accent-teal);
  font-size: var(--font-size-small);
}
.nearby-card__rating {
  color: var(--text-secondary);
  font-size: var(--font-size-small);
}
</style>
```

Add `<NearbySpots />` to the **HomePage** below the existing sections.

---

## Part B: AI Trip Planner Agent (Phase 4 → Frontend)

### Overview
Wire the existing TripPlannerPage to call the real AI agent endpoint (`POST /api/intel/agent/plan-trip`) via Ollama/LangGraph. Add a chat-style interaction where the user types a natural language trip request and sees the AI-generated itinerary stream in.

### B1. Agent Service

**File**: `scope-frontend/src/services/agentService.ts` (NEW)

```typescript
import api from '@/services/api';

export interface TripPlanRequest {
  prompt: string;
  user_id?: string;
  start_date?: string;
}

export interface TripPlanResponse {
  itinerary: string;
  steps: number;
  model: string;
}

const AGENT_BASE = '/api/intel/agent';

export async function planTrip(request: TripPlanRequest): Promise<TripPlanResponse> {
  const { data } = await api.post<TripPlanResponse>(`${AGENT_BASE}/plan-trip`, request, {
    timeout: 120_000, // AI agent can take up to 2 minutes
  });
  return data;
}
```

### B2. AI Trip Planner View

**File**: `scope-frontend/src/views/AITripPlannerPage.vue` (NEW)

```vue
<template>
  <AppShell>
    <div class="page-container page-stack ai-planner-page">
      <SectionHeading
        eyebrow="AI trip planner"
        title="Describe your dream trip and let Scope AI build the itinerary"
        description="Powered by Ollama — our AI agent searches spots, reads reviews, checks weather, and crafts a day-by-day plan tailored to you."
      />

      <section class="glass-panel planner-chat">
        <div class="chat-messages" ref="chatContainer">
          <div v-if="!response && !loading" class="chat-welcome">
            <h2>What kind of trip are you planning?</h2>
            <p class="section-copy">Try something like:</p>
            <div class="suggestion-chips">
              <button
                v-for="suggestion in suggestions"
                :key="suggestion"
                type="button"
                class="suggestion-chip"
                @click="prompt = suggestion"
              >
                {{ suggestion }}
              </button>
            </div>
          </div>

          <div v-if="response" class="chat-response">
            <div class="response-header">
              <span class="eyebrow">Scope AI</span>
              <span class="model-badge">{{ response.model }} · {{ response.steps }} reasoning steps</span>
            </div>
            <div class="response-body" v-html="formatItinerary(response.itinerary)" />
          </div>

          <div v-if="loading" class="chat-loading">
            <div class="loading-pulse" />
            <p>Scope AI is researching spots, reading reviews, and building your itinerary…</p>
          </div>

          <div v-if="error" class="chat-error" role="alert">
            <p class="eyebrow">Error</p>
            <p>{{ error }}</p>
          </div>
        </div>

        <form class="chat-input-form" @submit.prevent="handleSubmit">
          <input
            id="ai-trip-prompt"
            v-model="prompt"
            type="text"
            class="chat-input"
            placeholder="Plan a 3-day trip to Tokyo focused on street food and temples…"
            :disabled="loading"
            autocomplete="off"
          />
          <button type="submit" class="chat-submit" :disabled="loading || !prompt.trim()">
            {{ loading ? 'Planning…' : 'Plan Trip' }}
          </button>
        </form>
      </section>

      <section v-if="response" class="glass-panel planner-actions">
        <button type="button" class="button button-secondary" @click="resetPlanner">Plan another trip</button>
      </section>
    </div>
  </AppShell>
</template>

<script setup lang="ts">
import { nextTick, ref } from 'vue';
import AppShell from '@/components/common/AppShell.vue';
import SectionHeading from '@/components/common/SectionHeading.vue';
import { planTrip, type TripPlanResponse } from '@/services/agentService';
import { useAuthStore } from '@/stores/auth';

const authStore = useAuthStore();
const prompt = ref('');
const loading = ref(false);
const error = ref<string | null>(null);
const response = ref<TripPlanResponse | null>(null);
const chatContainer = ref<HTMLElement | null>(null);

const suggestions = [
  'Plan a 3-day trip to Tokyo focused on street food and temples',
  'Weekend hiking trip near San Francisco with ocean views',
  'Plan a 5-day cultural trip to Lisbon on a $2000 budget',
  'Romantic 4-day getaway in Patagonia with scenic hikes',
];

function formatItinerary(raw: string): string {
  // Convert markdown-ish output to basic HTML
  return raw
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, '<br>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/^/, '<p>')
    .replace(/$/, '</p>');
}

async function handleSubmit() {
  if (!prompt.value.trim() || loading.value) return;

  loading.value = true;
  error.value = null;
  response.value = null;

  try {
    response.value = await planTrip({
      prompt: prompt.value,
      user_id: authStore.currentUser?.id,
    });
  } catch (e: unknown) {
    error.value = e instanceof Error
      ? e.message
      : 'Scope AI could not generate a trip plan right now. Make sure Ollama models are loaded.';
  } finally {
    loading.value = false;
    await nextTick();
    chatContainer.value?.scrollTo({ top: chatContainer.value.scrollHeight, behavior: 'smooth' });
  }
}

function resetPlanner() {
  prompt.value = '';
  response.value = null;
  error.value = null;
}
</script>

<style scoped>
.ai-planner-page {
  display: grid;
  gap: var(--space-5);
}
.planner-chat {
  display: grid;
  gap: var(--space-5);
  padding: var(--space-6);
  min-height: 60vh;
  grid-template-rows: 1fr auto;
}
.chat-messages {
  overflow-y: auto;
  max-height: 60vh;
  display: grid;
  gap: var(--space-4);
  align-content: start;
}
.chat-welcome {
  display: grid;
  gap: var(--space-4);
  text-align: center;
  padding: var(--space-8) var(--space-4);
}
.chat-welcome h2 {
  margin: 0;
  font-size: var(--font-size-h2);
  background: linear-gradient(135deg, var(--accent-teal), var(--accent-blue, #60a5fa));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}
.chat-welcome .section-copy { margin: 0; color: var(--text-secondary); }
.suggestion-chips {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: var(--space-3);
}
.suggestion-chip {
  padding: 0.75rem 1.25rem;
  border-radius: var(--radius-full);
  border: 1px solid var(--glass-border);
  background: color-mix(in srgb, var(--glass-bg) 90%, transparent);
  color: var(--text-primary);
  font-size: var(--font-size-small);
  cursor: pointer;
  transition: transform var(--transition-fast), border-color var(--transition-fast), box-shadow var(--transition-fast);
}
.suggestion-chip:hover {
  transform: translateY(-2px);
  border-color: var(--accent-teal);
  box-shadow: var(--shadow-glow-teal);
}
.chat-response {
  display: grid;
  gap: var(--space-3);
}
.response-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.model-badge {
  padding: 0.4rem 0.8rem;
  border-radius: var(--radius-full);
  background: color-mix(in srgb, var(--accent-teal) 15%, var(--bg-secondary));
  font-size: var(--font-size-caption);
  color: var(--text-secondary);
}
.response-body {
  line-height: var(--line-height-normal);
  color: var(--text-primary);
}
.response-body :deep(p) { margin: 0 0 var(--space-3) 0; }
.response-body :deep(strong) { color: var(--accent-teal); }
.chat-loading {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-4);
  color: var(--text-secondary);
}
.loading-pulse {
  width: 12px;
  height: 12px;
  border-radius: var(--radius-full);
  background: var(--accent-teal);
  animation: pulse 1.2s ease-in-out infinite;
}
@keyframes pulse {
  0%, 100% { opacity: 0.3; transform: scale(0.8); }
  50% { opacity: 1; transform: scale(1.2); }
}
.chat-error {
  padding: var(--space-4);
  border-radius: var(--radius-xl);
  background: color-mix(in srgb, var(--danger) 10%, var(--bg-secondary));
  border: 1px solid color-mix(in srgb, var(--danger) 30%, transparent);
}
.chat-error p { margin: 0; }
.chat-input-form {
  display: flex;
  gap: var(--space-3);
  align-items: stretch;
}
.chat-input {
  flex: 1;
  padding: 1rem 1.25rem;
  border-radius: var(--radius-2xl);
  border: 1px solid var(--glass-border);
  background: color-mix(in srgb, var(--bg-secondary) 90%, transparent);
  color: var(--text-primary);
  font-size: 1rem;
  transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
}
.chat-input:focus {
  outline: none;
  border-color: var(--accent-teal);
  box-shadow: var(--shadow-glow-teal);
}
.chat-submit {
  padding: 1rem 1.5rem;
  border-radius: var(--radius-2xl);
  border: none;
  background: var(--accent-teal);
  color: var(--bg-primary);
  font-weight: var(--font-weight-semibold);
  cursor: pointer;
  white-space: nowrap;
  transition: background var(--transition-fast), transform var(--transition-fast);
}
.chat-submit:hover:not(:disabled) {
  background: var(--accent-teal-hover);
  transform: translateY(-1px);
}
.chat-submit:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.planner-actions {
  padding: var(--space-4);
  display: flex;
  justify-content: center;
}
.eyebrow {
  color: var(--accent-teal);
  text-transform: uppercase;
  letter-spacing: 0.14em;
  font-size: var(--font-size-caption);
  margin: 0;
}
</style>
```

### B3. Route Registration

**File**: `scope-frontend/src/router/index.ts` (MODIFY)

Add the lazy import at the top with the other imports:
```typescript
const AITripPlannerPage = lazyView(() => import('@/views/AITripPlannerPage.vue'));
const ScopeAIPage = lazyView(() => import('@/views/ScopeAIPage.vue'));
```

Add these routes to the `routes` array (after the `trip-planner` route):
```typescript
  {
    path: '/ai/trip-planner',
    name: 'ai-trip-planner',
    component: AITripPlannerPage,
    meta: privateRouteMeta(
      'AI trip planner | Scope',
      'Describe your dream trip in plain language and let Scope AI build a day-by-day itinerary using real spot data and reviews.',
    ),
  },
  {
    path: '/ai/ask',
    name: 'scope-ai',
    component: ScopeAIPage,
    meta: privateRouteMeta(
      'Scope AI assistant | Scope',
      'Ask Scope AI anything about travel spots, reviews, and recommendations powered by RAG and local LLMs.',
    ),
  },
```

---

## Part C: RAG Chatbot (Phase 4 → Frontend)

### Overview
Create a dedicated Scope AI assistant page where users ask natural-language questions like "What are the best ramen spots in Tokyo?" and get answers grounded in real Scope review data via the RAG pipeline.

### C1. RAG Service

**File**: `scope-frontend/src/services/ragService.ts` (NEW)

```typescript
import api from '@/services/api';

export interface RagAskRequest {
  question: string;
  filters?: Record<string, string>;
  top_k?: number;
}

export interface RagSource {
  spot_name?: string;
  spot_id?: string;
  rating?: number;
  relevance_score: number;
}

export interface RagAskResponse {
  answer: string;
  sources: RagSource[];
  model: string;
  context_docs_used: number;
}

export interface RagSearchResult {
  text: string;
  metadata: Record<string, unknown>;
  score: number;
}

const RAG_BASE = '/api/rag';

export async function askScopeAI(request: RagAskRequest): Promise<RagAskResponse> {
  const { data } = await api.post<RagAskResponse>(`${RAG_BASE}/ask`, request, {
    timeout: 60_000,
  });
  return data;
}

export async function searchVectors(query: string, k = 10): Promise<{ query: string; results: RagSearchResult[] }> {
  const { data } = await api.get<{ query: string; results: RagSearchResult[] }>(`${RAG_BASE}/search`, {
    params: { q: query, k },
  });
  return data;
}

export async function getRagHealth(): Promise<{
  status: string;
  vector_count: number;
  model: string;
  embedding_model: string;
}> {
  const { data } = await api.get(`${RAG_BASE}/health`);
  return data;
}
```

### C2. Scope AI Assistant Page

**File**: `scope-frontend/src/views/ScopeAIPage.vue` (NEW)

```vue
<template>
  <AppShell>
    <div class="page-container page-stack ai-page">
      <SectionHeading
        eyebrow="Scope AI"
        title="Ask anything about places, reviews, and experiences"
        description="Scope AI answers your questions using real reviews and spot data. Powered by Ollama — 100% local, no cloud APIs."
      />

      <section class="glass-panel chat-panel">
        <div class="chat-thread" ref="threadContainer">
          <div v-for="(msg, i) in messages" :key="i" :class="['chat-bubble', `chat-bubble--${msg.role}`]">
            <span class="bubble-role">{{ msg.role === 'user' ? 'You' : 'Scope AI' }}</span>
            <div class="bubble-text" v-html="formatMessage(msg.text)" />
            <div v-if="msg.sources?.length" class="bubble-sources">
              <span class="eyebrow">Sources</span>
              <RouterLink
                v-for="source in msg.sources"
                :key="source.spot_id"
                :to="source.spot_id ? `/spots/${source.spot_id}` : '#'"
                class="source-chip"
              >
                {{ source.spot_name ?? 'Unknown Spot' }}
                <span v-if="source.rating">★ {{ source.rating }}</span>
              </RouterLink>
            </div>
          </div>

          <div v-if="loading" class="chat-bubble chat-bubble--assistant">
            <span class="bubble-role">Scope AI</span>
            <div class="typing-indicator">
              <span /><span /><span />
            </div>
          </div>
        </div>

        <form class="chat-input-bar" @submit.prevent="handleAsk">
          <input
            id="ai-question-input"
            v-model="question"
            type="text"
            class="chat-input"
            placeholder="What are the best hiking trails near San Francisco?"
            :disabled="loading"
            autocomplete="off"
          />
          <button type="submit" class="chat-send" :disabled="loading || !question.trim()">Ask</button>
        </form>
      </section>
    </div>
  </AppShell>
</template>

<script setup lang="ts">
import { nextTick, ref } from 'vue';
import { RouterLink } from 'vue-router';
import AppShell from '@/components/common/AppShell.vue';
import SectionHeading from '@/components/common/SectionHeading.vue';
import { askScopeAI, type RagSource } from '@/services/ragService';

interface ChatMessage {
  role: 'user' | 'assistant';
  text: string;
  sources?: RagSource[];
}

const question = ref('');
const loading = ref(false);
const messages = ref<ChatMessage[]>([]);
const threadContainer = ref<HTMLElement | null>(null);

function formatMessage(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, '<br>')
    .replace(/^/, '<p>')
    .replace(/$/, '</p>');
}

async function handleAsk() {
  const q = question.value.trim();
  if (!q || loading.value) return;

  messages.value.push({ role: 'user', text: q });
  question.value = '';
  loading.value = true;

  await nextTick();
  threadContainer.value?.scrollTo({ top: threadContainer.value.scrollHeight, behavior: 'smooth' });

  try {
    const result = await askScopeAI({ question: q });
    messages.value.push({
      role: 'assistant',
      text: result.answer,
      sources: result.sources,
    });
  } catch (e: unknown) {
    messages.value.push({
      role: 'assistant',
      text: e instanceof Error ? e.message : 'Sorry, Scope AI could not process that question right now.',
    });
  } finally {
    loading.value = false;
    await nextTick();
    threadContainer.value?.scrollTo({ top: threadContainer.value.scrollHeight, behavior: 'smooth' });
  }
}
</script>

<style scoped>
.ai-page { display: grid; gap: var(--space-5); }
.chat-panel {
  display: grid;
  grid-template-rows: 1fr auto;
  gap: var(--space-4);
  padding: var(--space-5);
  min-height: 65vh;
}
.chat-thread {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  overflow-y: auto;
  max-height: 58vh;
  padding: var(--space-2);
}
.chat-bubble {
  display: grid;
  gap: var(--space-2);
  padding: var(--space-4);
  border-radius: var(--radius-2xl);
  max-width: 80%;
  animation: fadeSlideUp 0.3s ease-out;
}
.chat-bubble--user {
  justify-self: end;
  background: color-mix(in srgb, var(--accent-teal) 18%, var(--bg-secondary));
  border: 1px solid color-mix(in srgb, var(--accent-teal) 30%, transparent);
}
.chat-bubble--assistant {
  justify-self: start;
  background: var(--glass-bg);
  border: 1px solid var(--glass-border);
}
.bubble-role {
  font-size: var(--font-size-caption);
  font-weight: var(--font-weight-semibold);
  color: var(--accent-teal);
  text-transform: uppercase;
  letter-spacing: 0.1em;
}
.bubble-text { line-height: var(--line-height-normal); }
.bubble-text :deep(p) { margin: 0 0 var(--space-2) 0; }
.bubble-text :deep(strong) { color: var(--accent-teal); }
.bubble-sources {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  align-items: center;
  padding-top: var(--space-2);
  border-top: 1px solid var(--glass-border);
}
.source-chip {
  padding: 0.35rem 0.7rem;
  border-radius: var(--radius-full);
  background: color-mix(in srgb, var(--accent-teal) 12%, var(--bg-secondary));
  border: 1px solid color-mix(in srgb, var(--accent-teal) 25%, transparent);
  font-size: var(--font-size-caption);
  color: var(--text-primary);
  transition: background var(--transition-fast);
}
.source-chip:hover {
  background: color-mix(in srgb, var(--accent-teal) 22%, var(--bg-secondary));
}
.typing-indicator {
  display: flex;
  gap: 4px;
  padding: var(--space-2) 0;
}
.typing-indicator span {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--accent-teal);
  animation: typingBounce 1.4s ease-in-out infinite;
}
.typing-indicator span:nth-child(2) { animation-delay: 0.2s; }
.typing-indicator span:nth-child(3) { animation-delay: 0.4s; }
@keyframes typingBounce {
  0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
  30% { transform: translateY(-6px); opacity: 1; }
}
@keyframes fadeSlideUp {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}
.chat-input-bar {
  display: flex;
  gap: var(--space-3);
}
.chat-input {
  flex: 1;
  padding: 0.9rem 1.2rem;
  border-radius: var(--radius-2xl);
  border: 1px solid var(--glass-border);
  background: color-mix(in srgb, var(--bg-secondary) 90%, transparent);
  color: var(--text-primary);
  font-size: 1rem;
  transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
}
.chat-input:focus {
  outline: none;
  border-color: var(--accent-teal);
  box-shadow: var(--shadow-glow-teal);
}
.chat-send {
  padding: 0.9rem 1.5rem;
  border-radius: var(--radius-2xl);
  border: none;
  background: var(--accent-teal);
  color: var(--bg-primary);
  font-weight: var(--font-weight-semibold);
  cursor: pointer;
  transition: background var(--transition-fast), transform var(--transition-fast);
}
.chat-send:hover:not(:disabled) {
  background: var(--accent-teal-hover);
  transform: translateY(-1px);
}
.chat-send:disabled { opacity: 0.5; cursor: not-allowed; }
.eyebrow {
  color: var(--accent-teal);
  text-transform: uppercase;
  letter-spacing: 0.14em;
  font-size: var(--font-size-caption);
  margin: 0;
}
</style>
```

---

## Part D: ML-Powered Features (Phase 2 → Frontend)

### Overview
Surface ML insights in the existing UI: sentiment badges on reviews, "For You" personalized recommendations on the home page, and cost predictions in the trip planner.

### D1. Sentiment Badges on Reviews

**File**: `scope-frontend/src/components/spots/ReviewSentiment.vue` (NEW)

```vue
<template>
  <span v-if="label" class="sentiment-badge" :class="`sentiment-${sentiment}`" :title="`Sentiment: ${score}`">
    {{ emoji }} {{ label }}
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{ score: number | null | undefined }>();

const sentiment = computed(() => {
  if (props.score == null) return null;
  if (props.score >= 0.6) return 'positive';
  if (props.score <= -0.3) return 'negative';
  return 'neutral';
});

const label = computed(() => {
  if (!sentiment.value) return '';
  const labels = { positive: 'Positive', neutral: 'Mixed', negative: 'Critical' };
  return labels[sentiment.value];
});

const emoji = computed(() => {
  if (!sentiment.value) return '';
  const emojis = { positive: '😊', neutral: '😐', negative: '😟' };
  return emojis[sentiment.value];
});
</script>

<style scoped>
.sentiment-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.3rem 0.7rem;
  border-radius: var(--radius-full);
  font-size: var(--font-size-caption);
  font-weight: var(--font-weight-medium);
}
.sentiment-positive {
  background: color-mix(in srgb, #22c55e 15%, var(--bg-secondary));
  color: #4ade80;
}
.sentiment-neutral {
  background: color-mix(in srgb, #eab308 15%, var(--bg-secondary));
  color: #facc15;
}
.sentiment-negative {
  background: color-mix(in srgb, #ef4444 15%, var(--bg-secondary));
  color: #f87171;
}
</style>
```

Use `<ReviewSentiment :score="review.sentiment_score" />` inside the existing review display components wherever reviews are rendered (`SpotDetail.vue`).

### D2. Personalized "For You" Section on Home Page

**File**: `scope-frontend/src/components/common/ForYouSection.vue` (NEW)

```vue
<template>
  <section v-if="spots.length" class="glass-panel for-you-panel">
    <div class="for-you-header">
      <div>
        <p class="eyebrow">For You</p>
        <h2>Personalized picks based on your interests</h2>
      </div>
    </div>

    <div class="for-you-grid stagger-in">
      <RouterLink
        v-for="(spot, index) in spots"
        :key="spot.id"
        :to="`/spots/${spot.id}`"
        class="for-you-card glass-panel"
        :style="{ '--scope-stagger-index': index }"
      >
        <div class="for-you-card__copy">
          <span class="badge" :class="`badge-${spot.category}`">{{ spot.category }}</span>
          <strong>{{ spot.title }}</strong>
          <span class="for-you-card__rating">★ {{ spot.rating.toFixed(1) }}</span>
          <span class="for-you-card__location">{{ [spot.city, spot.country].filter(Boolean).join(', ') }}</span>
        </div>
      </RouterLink>
    </div>
  </section>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { RouterLink } from 'vue-router';
import { recommendSpots } from '@/services/intelService';
import { useAuthStore } from '@/stores/auth';
import type { SpotSummary } from '@/types';

const authStore = useAuthStore();
const spots = ref<SpotSummary[]>([]);

onMounted(async () => {
  if (!authStore.isAuthenticated) return;
  try {
    const interests = authStore.currentUser?.interests ?? [];
    const result = await recommendSpots({
      interests: interests.length ? interests : undefined,
      limit: 6,
    });
    spots.value = result.data;
  } catch {
    // Silently fail — personalized section is best-effort
  }
});
</script>

<style scoped>
.for-you-panel {
  padding: var(--space-6);
  display: grid;
  gap: var(--space-5);
}
.for-you-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.for-you-header h2, .for-you-header p { margin: 0; }
.eyebrow {
  color: var(--accent-teal);
  text-transform: uppercase;
  letter-spacing: 0.14em;
  font-size: var(--font-size-caption);
}
.for-you-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(16rem, 1fr));
  gap: var(--space-4);
}
.for-you-card {
  padding: var(--space-4);
  transition: transform var(--transition-fast), box-shadow var(--transition-fast);
}
.for-you-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
}
.for-you-card__copy {
  display: grid;
  gap: var(--space-2);
}
.for-you-card__rating { color: var(--accent-teal); font-size: var(--font-size-small); }
.for-you-card__location { color: var(--text-secondary); font-size: var(--font-size-small); }
</style>
```

Add `<ForYouSection />` to `HomePage.vue` after the hero/trending sections.

---

## Part E: Navigation Updates

### E1. Add AI Links to Navbar

Find the existing navigation component (likely in `scope-frontend/src/components/common/AppShell.vue` or a `Navbar.vue`) and add two new nav items:

```html
<RouterLink to="/ai/ask" class="nav-link">Scope AI</RouterLink>
<RouterLink to="/ai/trip-planner" class="nav-link">AI Planner</RouterLink>
```

These should appear after the existing "Trips" or "Explore" nav links.

---

## Part F: Type Updates

### F1. Extend SpotSummary Type

**File**: `scope-frontend/src/types/index.ts` (MODIFY)

Add `sentiment_score` to the review-related types if not already present:
```typescript
// In the Review interface or wherever reviews are typed:
sentiment_score?: number | null;
```

---

## Summary of New Files

| File | Type | Description |
|------|------|-------------|
| `src/services/searchService.ts` | Service | Elasticsearch search + geo API client |
| `src/services/agentService.ts` | Service | AI trip planner agent API client |
| `src/services/ragService.ts` | Service | RAG chatbot API client |
| `src/stores/search.ts` | Store | Pinia store for search state |
| `src/views/AITripPlannerPage.vue` | View | AI trip planner chat page |
| `src/views/ScopeAIPage.vue` | View | RAG chatbot assistant page |
| `src/components/spots/NearbySpots.vue` | Component | Geo-radius nearby spots |
| `src/components/spots/ReviewSentiment.vue` | Component | Sentiment badge for reviews |
| `src/components/common/ForYouSection.vue` | Component | ML-powered personalized recommendations |

## Summary of Modified Files

| File | What Changes |
|------|-------------|
| `src/router/index.ts` | Add `/ai/trip-planner` and `/ai/ask` routes |
| `src/views/ExplorePage.vue` | Wire search to Elasticsearch with debounce |
| `src/views/HomePage.vue` | Add `<ForYouSection />` and `<NearbySpots />` |
| `src/components/common/AppShell.vue` (or Navbar) | Add "Scope AI" and "AI Planner" nav links |
| `src/types/index.ts` | Add `sentiment_score` to review types |
