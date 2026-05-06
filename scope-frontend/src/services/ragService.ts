import api from '@/services/api';

export interface RagAskRequest {
  question: string;
  filters?: Record<string, string>;
  top_k?: number;
  conversation?: RagConversationTurn[];
  images?: RagImageAttachment[];
}

export interface RagConversationTurn {
  role: 'user' | 'assistant';
  text: string;
}

export interface RagSource {
  source?: string;
  source_type?: string;
  title?: string;
  path?: string;
  method?: string;
  service?: string;
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

export interface RagImageAttachment {
  filename?: string;
  mime_type: 'image/jpeg' | 'image/png' | 'image/webp';
  data: string;
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
  app_catalog_count?: number;
  model: string;
  chat_provider?: string;
  chat_model?: string;
  local_provider?: string;
  local_fallback_model?: string;
  embedding_model: string;
  embedding_provider?: string;
  vision_enabled?: boolean;
  vision_model?: string;
}> {
  const { data } = await api.get(`${RAG_BASE}/health`);
  return data;
}
