<template>
  <AppShell>
    <div class="page-container page-stack ai-planner-page">
      <SectionHeading
        eyebrow="AI trip planner"
        title="Describe your dream trip and let Scope AI build the itinerary"
        description="The local Ollama agent searches spots, reads reviews, checks trip context, and shapes a day-by-day plan from Scope data."
      />

      <section class="glass-panel planner-chat">
        <div ref="chatContainer" class="chat-messages">
          <div v-if="!response && !loading" class="chat-welcome">
            <p class="chat-welcome__eyebrow">Welcome to Scope AI</p>
            <h2>What kind of trip are you planning?</h2>
            <div class="suggestion-chips" aria-label="Trip prompt suggestions">
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

          <article v-if="response" class="chat-response">
            <header class="response-header">
              <span class="ai-badge">Scope AI</span>
              <span class="model-badge">{{ response.model }} - {{ response.steps }} steps</span>
            </header>
            <div class="response-body" v-html="formatMarkdown(response.itinerary)" />
          </article>

          <div v-if="loading" class="chat-loading" role="status" aria-live="polite">
            <span class="loading-pulse" aria-hidden="true" />
            <p>Scope AI is researching spots, reading reviews, and building your itinerary.</p>
          </div>

          <div v-if="error" class="chat-error" role="alert">
            <p class="ai-badge">Error</p>
            <p>{{ error }}</p>
          </div>
        </div>

        <form class="chat-input-form" @submit.prevent="handleSubmit">
          <input
            id="ai-trip-prompt"
            v-model="prompt"
            type="text"
            class="chat-input"
            placeholder="Plan a 3-day trip to Tokyo focused on street food and temples"
            aria-label="Trip planning prompt"
            :disabled="loading"
            autocomplete="off"
          />
          <button type="submit" class="chat-submit" :disabled="loading || !prompt.trim()">
            {{ loading ? 'Planning' : 'Plan Trip' }}
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

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function formatMarkdown(raw: string): string {
  const withBold = escapeHtml(raw).replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  return `<p>${withBold.replace(/\n{2,}/g, '</p><p>').replace(/\n/g, '<br>')}</p>`;
}

async function scrollChatToBottom(): Promise<void> {
  await nextTick();
  chatContainer.value?.scrollTo({ top: chatContainer.value.scrollHeight, behavior: 'smooth' });
}

async function handleSubmit() {
  const trimmedPrompt = prompt.value.trim();
  if (!trimmedPrompt || loading.value) {
    return;
  }

  loading.value = true;
  error.value = null;
  response.value = null;

  try {
    response.value = await planTrip({
      prompt: trimmedPrompt,
      user_id: authStore.currentUser?.id,
    });
  } catch (caughtError: unknown) {
    error.value = caughtError instanceof Error
      ? caughtError.message
      : 'Scope AI could not generate a trip plan right now. Make sure Ollama models are loaded.';
  } finally {
    loading.value = false;
    await scrollChatToBottom();
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
  grid-template-rows: minmax(24rem, 1fr) auto;
  gap: var(--space-5);
  min-height: min(68vh, 44rem);
  padding: clamp(var(--space-5), 4vw, var(--space-8));
  overflow: hidden;
  background:
    radial-gradient(circle at 52% 20%, color-mix(in srgb, var(--accent-teal) 18%, transparent), transparent 34%),
    radial-gradient(circle at 80% 78%, color-mix(in srgb, var(--info) 12%, transparent), transparent 38%),
    linear-gradient(180deg, color-mix(in srgb, var(--glass-bg) 92%, transparent), color-mix(in srgb, var(--bg-secondary) 92%, transparent));
}

.chat-messages {
  display: grid;
  align-content: start;
  gap: var(--space-4);
  max-height: 60vh;
  overflow-y: auto;
}

.chat-welcome {
  display: grid;
  place-items: center;
  align-content: center;
  gap: var(--space-4);
  min-height: 24rem;
  text-align: center;
}

.chat-welcome__eyebrow,
.ai-badge {
  margin: 0;
  color: var(--accent-teal);
  font-size: var(--font-size-caption);
  font-weight: var(--font-weight-semibold);
  text-transform: uppercase;
  letter-spacing: 0;
}

.chat-welcome h2 {
  max-width: 14ch;
  margin: 0;
  color: var(--text-primary);
  font-size: var(--font-size-h2);
  line-height: var(--line-height-tight);
}

.suggestion-chips {
  display: flex;
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

.chat-response,
.chat-error {
  display: grid;
  gap: var(--space-3);
  padding: var(--space-5);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-2xl);
  background: color-mix(in srgb, var(--bg-secondary) 78%, transparent);
  box-shadow: var(--shadow-md);
}

.response-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
}

.model-badge {
  padding: 0.4rem 0.75rem;
  border: 1px solid color-mix(in srgb, var(--accent-teal) 24%, transparent);
  border-radius: var(--radius-full);
  background: color-mix(in srgb, var(--accent-teal) 12%, var(--bg-secondary));
  color: var(--text-secondary);
  font-size: var(--font-size-caption);
}

.response-body {
  color: var(--text-primary);
  line-height: var(--line-height-normal);
}

.response-body :deep(p) {
  margin: 0 0 var(--space-3);
}

.response-body :deep(p:last-child) {
  margin-bottom: 0;
}

.response-body :deep(strong) {
  color: var(--accent-teal);
}

.chat-loading {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  width: fit-content;
  max-width: 100%;
  padding: var(--space-4);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-2xl);
  background: color-mix(in srgb, var(--glass-bg) 92%, transparent);
  color: var(--text-secondary);
}

.chat-loading p {
  margin: 0;
}

.loading-pulse {
  width: 0.8rem;
  height: 0.8rem;
  border-radius: var(--radius-full);
  background: var(--accent-teal);
  animation: planner-pulse 1.2s ease-in-out infinite;
}

.chat-error {
  border-color: color-mix(in srgb, var(--danger) 32%, transparent);
  background: color-mix(in srgb, var(--danger) 10%, var(--bg-secondary));
}

.chat-error p {
  margin: 0;
}

.chat-input-form {
  display: flex;
  align-items: stretch;
  gap: var(--space-3);
  width: min(100%, 46rem);
  margin: 0 auto;
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

.chat-submit {
  min-width: 8rem;
  padding: 0.95rem 1.4rem;
  border: 0;
  border-radius: var(--radius-full);
  background: var(--accent-teal);
  color: var(--text-inverse);
  cursor: pointer;
  font-weight: var(--font-weight-semibold);
  transition:
    transform var(--transition-fast),
    background var(--transition-fast),
    box-shadow var(--transition-fast);
}

.chat-submit:hover:not(:disabled),
.chat-submit:focus-visible:not(:disabled) {
  outline: none;
  transform: translateY(-1px);
  background: var(--accent-teal-hover);
  box-shadow: var(--shadow-glow-teal);
}

.chat-submit:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

.planner-actions {
  display: flex;
  justify-content: center;
  padding: var(--space-4);
}

@keyframes planner-pulse {
  0%,
  100% {
    opacity: 0.35;
    transform: scale(0.82);
  }

  50% {
    opacity: 1;
    transform: scale(1.14);
  }
}

@media (max-width: 700px) {
  .planner-chat {
    grid-template-rows: minmax(22rem, 1fr) auto;
  }

  .chat-input-form {
    flex-direction: column;
  }

  .chat-submit {
    width: 100%;
  }

  .response-header {
    align-items: flex-start;
    flex-direction: column;
  }
}

@media (prefers-reduced-motion: reduce) {
  .loading-pulse {
    animation: none;
  }

  .suggestion-chip,
  .chat-submit {
    transition: none;
  }

  .suggestion-chip:hover,
  .suggestion-chip:focus-visible,
  .chat-submit:hover:not(:disabled),
  .chat-submit:focus-visible:not(:disabled) {
    transform: none;
  }
}
</style>
