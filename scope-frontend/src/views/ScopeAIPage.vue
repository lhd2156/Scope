<template>
  <AppShell>
    <div class="page-container page-stack ai-page">
      <SectionHeading
        eyebrow="Scope AI"
        title="Ask anything about Scope places, routes, and APIs"
        description="Gemini handles the main chat. Ollama keeps Scope useful locally for memory, embeddings, and fallback answers."
      />

      <section class="ai-stack" aria-label="Scope AI model roles">
        <article v-for="card in aiStackCards" :key="card.label" class="ai-stack-card">
          <span>{{ card.label }}</span>
          <strong>{{ card.value }}</strong>
        </article>
      </section>

      <section class="glass-panel chat-panel">
        <header class="chat-panel__status">
          <span class="ai-badge">{{ healthLabel }}</span>
          <span v-if="healthMeta" class="model-badge">{{ healthMeta }}</span>
        </header>

        <div ref="threadContainer" class="chat-thread">
          <div v-if="!messages.length" class="chat-empty">
            <h2>What would you like to discover?</h2>
            <div class="suggestion-chips" aria-label="Scope AI question suggestions">
              <button
                v-for="suggestion in suggestions"
                :key="suggestion"
                type="button"
                class="suggestion-chip"
                @click="question = suggestion"
              >
                {{ suggestion }}
              </button>
            </div>
          </div>

          <article
            v-for="(msg, index) in messages"
            :key="`${msg.role}-${index}`"
            :class="['chat-bubble', `chat-bubble--${msg.role}`]"
          >
            <span class="bubble-role">{{ msg.role === 'user' ? 'You' : 'Scope AI' }}</span>
            <div class="bubble-text" v-html="formatMarkdown(msg.text)" />
            <div
              v-if="msg.images?.length"
              class="bubble-images"
              :data-test="msg.role === 'user' ? 'scope-ai-user-images' : undefined"
            >
              <figure v-for="image in msg.images" :key="image.id" class="bubble-image">
                <img :src="image.previewUrl" :alt="image.filename" />
                <figcaption>{{ image.filename }}</figcaption>
              </figure>
            </div>
            <div v-if="msg.sources?.length" class="bubble-sources">
              <span class="sources-label">Sources</span>
              <template v-for="(source, sourceIndex) in msg.sources" :key="source.path ?? source.spot_id ?? source.title ?? `source-${sourceIndex}`">
                <RouterLink v-if="sourceLink(source)" :to="sourceLink(source) ?? '/'" class="source-chip">
                  {{ sourceLabel(source) }}
                  <span v-if="sourceRating(source)">({{ sourceRating(source) }})</span>
                </RouterLink>
                <span v-else class="source-chip">
                  {{ sourceLabel(source) }}
                </span>
              </template>
            </div>
          </article>

          <div v-if="loading" class="chat-bubble chat-bubble--assistant" role="status" aria-live="polite">
            <span class="bubble-role">Scope AI</span>
            <p class="chat-status-text">Reading Scope context</p>
          </div>
        </div>

        <div class="chat-composer">
          <div
            v-if="pendingImages.length || imageError"
            class="pending-images"
            data-test="scope-ai-pending-images"
          >
            <figure v-for="image in pendingImages" :key="image.id" class="pending-image">
              <img :src="image.previewUrl" :alt="image.filename" />
              <figcaption>{{ image.filename }}</figcaption>
              <button type="button" aria-label="Remove image" @click="removePendingImage(image.id)">
                <ScopeIcon name="close" />
              </button>
            </figure>
            <p v-if="imageError" class="image-error" role="alert">{{ imageError }}</p>
          </div>

          <form class="chat-input-bar" @submit.prevent="handleAsk">
            <input
              ref="imageInput"
              data-test="scope-ai-image-input"
              type="file"
              class="chat-file-input"
              accept="image/jpeg,image/png,image/webp"
              multiple
              :disabled="loading"
              @change="handleImageSelect"
            />
            <button
              type="button"
              class="chat-image-button"
              aria-label="Attach image"
              title="Attach image"
              :disabled="loading || pendingImages.length >= MAX_PENDING_IMAGES"
              @click="imageInput?.click()"
            >
              <ScopeIcon name="image" />
            </button>
            <input
              id="ai-question-input"
              v-model="question"
              type="text"
              class="chat-input"
              placeholder="What are the best hiking trails near San Francisco?"
              aria-label="Ask Scope AI a question"
              :disabled="loading"
              autocomplete="off"
            />
            <button type="submit" class="chat-send" :disabled="loading || (!question.trim() && !pendingImages.length)">Ask</button>
          </form>
        </div>
      </section>
    </div>
  </AppShell>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue';
import { RouterLink } from 'vue-router';
import ScopeIcon from '@/components/common/ScopeIcon.vue';
import AppShell from '@/components/common/AppShell.vue';
import SectionHeading from '@/components/common/SectionHeading.vue';
import { askScopeAI, getRagHealth, type RagConversationTurn, type RagImageAttachment, type RagSource } from '@/services/ragService';
import { getScopeAiResponseStartedAt, waitForScopeAiResponsePace } from '@/utils/scopeAiResponsePace';

const MAX_PENDING_IMAGES = 3;
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const SUPPORTED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const IMAGE_ONLY_PROMPT = 'Describe this image for Scope travel planning.';

interface ChatImagePreview {
  id: string;
  filename: string;
  mime_type: RagImageAttachment['mime_type'];
  previewUrl: string;
}

interface PendingImageAttachment extends ChatImagePreview {
  data: string;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  text: string;
  sources?: RagSource[];
  images?: ChatImagePreview[];
}

const question = ref('');
const loading = ref(false);
const messages = ref<ChatMessage[]>([]);
const threadContainer = ref<HTMLElement | null>(null);
const imageInput = ref<HTMLInputElement | null>(null);
const pendingImages = ref<PendingImageAttachment[]>([]);
const imageError = ref('');
const imagePreviewUrls = new Set<string>();
const health = ref<{
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
} | null>(null);

const suggestions = [
  'What frontend routes does Scope have?',
  'Which service owns trip planning endpoints?',
  'What does Ollama do for Scope?',
];

const healthLabel = computed(() => (health.value?.status === 'healthy' ? 'RAG online' : 'RAG assistant'));
const healthMeta = computed(() => {
  if (!health.value) {
    return '';
  }

  const documentCount = health.value.vector_count + (health.value.app_catalog_count ?? 0);
  return `${health.value.model} - ${documentCount.toLocaleString()} docs`;
});

const aiStackCards = computed(() => {
  const chatProvider = health.value?.chat_provider ?? (health.value?.model?.toLowerCase().includes('gemini') ? 'gemini' : 'ollama');
  const chatModel = health.value?.chat_model ?? health.value?.model ?? 'Gemini ready';
  const embeddingModel = health.value?.embedding_model ?? 'nomic-embed-text';
  const fallbackModel = health.value?.local_fallback_model ?? 'llama3.2:3b';

  return [
    {
      label: 'Main chat',
      value: `${formatProviderLabel(chatProvider)} - ${chatModel}`,
    },
    {
      label: 'Image input',
      value: health.value?.vision_enabled ? `Gemini - ${health.value.vision_model ?? chatModel}` : 'Gemini vision ready',
    },
    {
      label: 'Local memory',
      value: `Ollama - ${embeddingModel}`,
    },
    {
      label: 'Offline fallback',
      value: `Ollama - ${fallbackModel}`,
    },
  ];
});

function formatProviderLabel(provider: string): string {
  return provider.toLowerCase() === 'gemini' ? 'Gemini' : 'Ollama';
}

function buildImageId(file: File): string {
  return `${file.name}-${file.size}-${file.lastModified}-${Math.random().toString(36).slice(2)}`;
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(new Error('Scope AI could not read that image.'));
    reader.readAsDataURL(file);
  });
}

function dataUrlToBase64(dataUrl: string): string {
  const marker = ';base64,';
  const markerIndex = dataUrl.indexOf(marker);
  return markerIndex >= 0 ? dataUrl.slice(markerIndex + marker.length) : dataUrl;
}

function resetFileInput(): void {
  if (imageInput.value) {
    imageInput.value.value = '';
  }
}

async function handleImageSelect(event: Event): Promise<void> {
  const files = Array.from((event.target as HTMLInputElement).files ?? []);
  imageError.value = '';

  for (const file of files) {
    if (pendingImages.value.length >= MAX_PENDING_IMAGES) {
      imageError.value = 'Scope AI can inspect up to 3 images at once.';
      break;
    }

    if (!SUPPORTED_IMAGE_TYPES.has(file.type)) {
      imageError.value = 'Only JPEG, PNG, and WebP images are supported.';
      continue;
    }

    if (file.size > MAX_IMAGE_BYTES) {
      imageError.value = 'Images must be 4 MB or smaller.';
      continue;
    }

    const previewUrl = URL.createObjectURL(file);
    imagePreviewUrls.add(previewUrl);
    pendingImages.value.push({
      id: buildImageId(file),
      filename: file.name || 'Scope image',
      mime_type: file.type as RagImageAttachment['mime_type'],
      previewUrl,
      data: dataUrlToBase64(await readFileAsDataUrl(file)),
    });
  }

  resetFileInput();
}

function removePendingImage(imageId: string): void {
  const image = pendingImages.value.find((item) => item.id === imageId);
  pendingImages.value = pendingImages.value.filter((item) => item.id !== imageId);
  if (image) {
    URL.revokeObjectURL(image.previewUrl);
    imagePreviewUrls.delete(image.previewUrl);
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function formatMarkdown(text: string): string {
  const withBold = escapeHtml(text).replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  return `<p>${withBold.replace(/\n{2,}/g, '</p><p>').replace(/\n/g, '<br>')}</p>`;
}

function sourceLabel(source: RagSource): string {
  if (source.method && source.path) {
    return `${source.method} ${source.path}`;
  }

  return source.title ?? source.spot_name ?? source.path ?? 'Scope source';
}

function sourceLink(source: RagSource): string | null {
  if (source.spot_id) {
    return `/spots/${source.spot_id}`;
  }

  if (source.source_type === 'frontend_route' && source.path && !source.path.includes(':')) {
    return source.path;
  }

  return null;
}

function sourceRating(source: RagSource): string {
  return typeof source.rating === 'number' ? source.rating.toFixed(1) : '';
}

function buildConversationContext(history: ChatMessage[] = messages.value): RagConversationTurn[] {
  return history
    .slice(-8)
    .map((message) => ({
      role: message.role,
      text: message.text.replace(/\s+/g, ' ').trim().slice(0, 1000),
    }))
    .filter((message) => message.text);
}

async function scrollThreadToBottom(): Promise<void> {
  await nextTick();
  const viewport = threadContainer.value;
  if (!viewport) {
    return;
  }

  if (typeof viewport.scrollTo === 'function') {
    viewport.scrollTo({ top: viewport.scrollHeight, behavior: 'smooth' });
    return;
  }

  viewport.scrollTop = viewport.scrollHeight;
}

async function handleAsk() {
  const trimmedQuestion = question.value.trim();
  if ((!trimmedQuestion && !pendingImages.value.length) || loading.value) {
    return;
  }

  const outboundImages = pendingImages.value.map<RagImageAttachment>((image) => ({
    filename: image.filename,
    mime_type: image.mime_type,
    data: image.data,
  }));
  const visibleImages = pendingImages.value.map<ChatImagePreview>((image) => ({
    id: image.id,
    filename: image.filename,
    mime_type: image.mime_type,
    previewUrl: image.previewUrl,
  }));
  const effectiveQuestion = trimmedQuestion || IMAGE_ONLY_PROMPT;
  const priorConversation = buildConversationContext();
  messages.value.push({ role: 'user', text: effectiveQuestion, images: visibleImages });
  question.value = '';
  pendingImages.value = [];
  imageError.value = '';
  loading.value = true;
  const responseStartedAt = getScopeAiResponseStartedAt();

  await scrollThreadToBottom();

  let assistantMessage: ChatMessage;
  try {
    const result = await askScopeAI({
      question: effectiveQuestion,
      conversation: priorConversation,
      ...(outboundImages.length ? { images: outboundImages } : {}),
    });
    assistantMessage = {
      role: 'assistant',
      text: result.answer,
      sources: result.sources,
    };
  } catch (caughtError: unknown) {
    assistantMessage = {
      role: 'assistant',
      text: caughtError instanceof Error ? caughtError.message : 'Scope AI could not process that question right now.',
    };
  } finally {
    await waitForScopeAiResponsePace(responseStartedAt);
    messages.value.push(assistantMessage);
    loading.value = false;
    await scrollThreadToBottom();
  }
}

onMounted(async () => {
  try {
    health.value = await getRagHealth();
  } catch {
    health.value = null;
  }
});

onBeforeUnmount(() => {
  imagePreviewUrls.forEach((url) => URL.revokeObjectURL(url));
  imagePreviewUrls.clear();
});
</script>

<style scoped>
.ai-page {
  display: grid;
  gap: var(--space-5);
}

.ai-stack {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: var(--space-3);
}

.ai-stack-card {
  display: grid;
  align-content: center;
  gap: var(--space-2);
  min-height: 5rem;
  padding: var(--space-4);
  border: 1px solid color-mix(in srgb, var(--accent-teal) 18%, var(--glass-border));
  border-radius: var(--radius-xl);
  background:
    linear-gradient(135deg, color-mix(in srgb, var(--glass-bg) 90%, transparent), color-mix(in srgb, var(--bg-secondary) 86%, transparent)),
    linear-gradient(90deg, color-mix(in srgb, var(--accent-teal) 8%, transparent), transparent 70%);
}

.ai-stack-card span,
.ai-stack-card strong {
  overflow-wrap: anywhere;
}

.ai-stack-card span {
  color: var(--text-secondary);
  font-size: var(--font-size-caption);
  font-weight: var(--font-weight-semibold);
  text-transform: uppercase;
  letter-spacing: var(--letter-spacing-eyebrow);
}

.ai-stack-card strong {
  color: var(--text-primary);
  font-size: var(--font-size-small);
  line-height: var(--line-height-normal);
}

.chat-panel {
  display: grid;
  grid-template-rows: auto minmax(24rem, 1fr) auto;
  gap: var(--space-4);
  min-height: min(70vh, 46rem);
  padding: clamp(var(--space-5), 4vw, var(--space-8));
  overflow: hidden;
  background:
    radial-gradient(circle at 75% 22%, color-mix(in srgb, var(--accent-teal) 18%, transparent), transparent 36%),
    linear-gradient(180deg, color-mix(in srgb, var(--glass-bg) 92%, transparent), color-mix(in srgb, var(--bg-secondary) 92%, transparent));
}

.chat-panel__status,
.bubble-sources,
.chat-input-bar,
.suggestion-chips {
  display: flex;
}

.chat-panel__status {
  justify-content: space-between;
  gap: var(--space-3);
}

.ai-badge,
.bubble-role,
.sources-label {
  color: var(--accent-teal);
  font-size: var(--font-size-caption);
  font-weight: var(--font-weight-semibold);
  text-transform: uppercase;
  letter-spacing: 0;
}

.model-badge {
  padding: 0.4rem 0.75rem;
  border: 1px solid color-mix(in srgb, var(--accent-teal) 24%, transparent);
  border-radius: var(--radius-full);
  background: color-mix(in srgb, var(--accent-teal) 12%, var(--bg-secondary));
  color: var(--text-secondary);
  font-size: var(--font-size-caption);
}

.chat-thread {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  max-height: 58vh;
  overflow-y: auto;
  padding: var(--space-2);
}

.chat-empty {
  display: grid;
  place-items: center;
  align-content: center;
  gap: var(--space-4);
  min-height: 22rem;
  text-align: center;
}

.chat-empty h2 {
  margin: 0;
  font-size: var(--font-size-h2);
  line-height: var(--line-height-tight);
}

.suggestion-chips {
  flex-wrap: wrap;
  justify-content: center;
  gap: var(--space-3);
  max-width: 44rem;
}

.suggestion-chip {
  min-height: 2.25rem;
  padding: 0.55rem 1rem;
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-full);
  background: color-mix(in srgb, var(--glass-bg) 92%, transparent);
  color: var(--text-primary);
  cursor: pointer;
  transition:
    transform var(--transition-fast),
    border-color var(--transition-fast),
    box-shadow var(--transition-fast);
}

.suggestion-chip:hover,
.suggestion-chip:focus-visible {
  outline: none;
  transform: translateY(-2px);
  border-color: color-mix(in srgb, var(--accent-teal) 48%, var(--glass-border));
  box-shadow: var(--shadow-glow-teal);
}

.chat-bubble {
  display: grid;
  gap: var(--space-2);
  max-width: min(80%, 42rem);
  padding: var(--space-4);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-2xl);
  animation: bubble-in 240ms ease-out both;
}

.chat-bubble--user {
  align-self: flex-end;
  background: color-mix(in srgb, var(--accent-teal) 18%, var(--bg-secondary));
  border-color: color-mix(in srgb, var(--accent-teal) 34%, transparent);
}

.chat-bubble--assistant {
  align-self: flex-start;
  background: color-mix(in srgb, var(--glass-bg) 92%, transparent);
}

.bubble-text {
  color: var(--text-primary);
  line-height: var(--line-height-normal);
}

.bubble-text :deep(p) {
  margin: 0 0 var(--space-2);
}

.bubble-text :deep(p:last-child) {
  margin-bottom: 0;
}

.bubble-text :deep(strong) {
  color: var(--accent-teal);
}

.bubble-sources {
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-2);
  padding-top: var(--space-2);
  border-top: 1px solid var(--glass-border);
}

.source-chip {
  padding: 0.35rem 0.7rem;
  border: 1px solid color-mix(in srgb, var(--accent-teal) 26%, transparent);
  border-radius: var(--radius-full);
  background: color-mix(in srgb, var(--accent-teal) 12%, var(--bg-secondary));
  color: var(--text-primary);
  font-size: var(--font-size-caption);
  text-decoration: none;
}

.source-chip:hover,
.source-chip:focus-visible {
  outline: none;
  background: color-mix(in srgb, var(--accent-teal) 22%, var(--bg-secondary));
}

.bubble-images,
.pending-images {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-2);
}

.bubble-image,
.pending-image {
  position: relative;
  display: grid;
  gap: 0.35rem;
  width: 7rem;
  margin: 0;
}

.bubble-image img,
.pending-image img {
  width: 100%;
  aspect-ratio: 4 / 3;
  border: 1px solid color-mix(in srgb, var(--accent-teal) 24%, var(--glass-border));
  border-radius: var(--radius-lg);
  object-fit: cover;
}

.bubble-image figcaption,
.pending-image figcaption {
  overflow: hidden;
  color: var(--text-secondary);
  font-size: var(--font-size-caption);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.pending-image button {
  position: absolute;
  top: 0.35rem;
  right: 0.35rem;
  display: grid;
  place-items: center;
  width: 1.65rem;
  height: 1.65rem;
  border: 1px solid color-mix(in srgb, var(--accent-teal) 32%, var(--glass-border));
  border-radius: var(--radius-full);
  background: color-mix(in srgb, var(--bg-primary) 88%, transparent);
  color: var(--text-primary);
  cursor: pointer;
}

.pending-image button:hover,
.pending-image button:focus-visible {
  outline: none;
  border-color: var(--accent-teal);
  box-shadow: var(--shadow-glow-teal);
}

.image-error {
  margin: 0;
  color: var(--danger);
  font-size: var(--font-size-caption);
}

.chat-status-text {
  margin: 0;
  color: var(--text-secondary);
  font-size: var(--font-size-small);
}

.chat-composer {
  display: grid;
  gap: var(--space-3);
}

.chat-input-bar {
  gap: var(--space-3);
}

.chat-file-input {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
  clip-path: inset(50%);
}

.chat-image-button {
  display: grid;
  place-items: center;
  width: 3.25rem;
  height: 3.25rem;
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-full);
  background: color-mix(in srgb, var(--bg-secondary) 88%, transparent);
  color: var(--text-primary);
  cursor: pointer;
  transition:
    transform var(--transition-fast),
    border-color var(--transition-fast),
    box-shadow var(--transition-fast);
}

.chat-image-button:hover:not(:disabled),
.chat-image-button:focus-visible:not(:disabled) {
  outline: none;
  transform: translateY(-1px);
  border-color: var(--accent-teal);
  box-shadow: var(--shadow-glow-teal);
}

.chat-image-button:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

.chat-input {
  flex: 1;
  min-width: 0;
  padding: 0.95rem 1.2rem;
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-full);
  background: color-mix(in srgb, var(--bg-secondary) 88%, transparent);
  color: var(--text-primary);
  font: inherit;
}

.chat-input:focus {
  outline: none;
  border-color: var(--accent-teal);
  box-shadow: var(--shadow-glow-teal);
}

.chat-send {
  min-width: 6.5rem;
  padding: 0.95rem 1.35rem;
  border: 0;
  border-radius: var(--radius-full);
  background: var(--accent-teal);
  color: var(--text-inverse);
  cursor: pointer;
  font-weight: var(--font-weight-semibold);
}

.chat-send:hover:not(:disabled),
.chat-send:focus-visible:not(:disabled) {
  outline: none;
  background: var(--accent-teal-hover);
  box-shadow: var(--shadow-glow-teal);
}

.chat-send:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

@keyframes bubble-in {
  from {
    opacity: 0;
    transform: translateY(0.5rem);
  }

  to {
    opacity: 1;
    transform: none;
  }
}

@media (max-width: 700px) {
  .ai-stack {
    grid-template-columns: 1fr;
  }

  .chat-panel__status {
    align-items: flex-start;
    flex-direction: column;
  }

  .chat-bubble {
    max-width: 94%;
  }

  .chat-input-bar {
    flex-direction: column;
  }

  .chat-image-button,
  .chat-send {
    width: 100%;
  }
}

@media (prefers-reduced-motion: reduce) {
  .chat-bubble {
    animation: none;
  }

  .suggestion-chip {
    transition: none;
  }

  .suggestion-chip:hover,
  .suggestion-chip:focus-visible {
    transform: none;
  }
}
</style>
