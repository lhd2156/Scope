<template>
  <section
    ref="assistShell"
    class="glass-panel trip-ai-assist"
    data-test="trip-ai-assist"
    aria-labelledby="trip-ai-assist-title"
    :data-chat-state="conversationStarted ? 'active' : 'fresh'"
  >
    <header class="trip-ai-assist__header">
      <div class="trip-ai-assist__header-copy-block">
        <p class="eyebrow">Scope AI</p>
        <h2 id="trip-ai-assist-title">Route copilot</h2>
        <p class="trip-ai-assist__header-copy">Build, tighten, and explain the same route shown in the planner.</p>
      </div>
      <div class="trip-ai-assist__header-actions">
        <div class="trip-ai-assist__chat-menu">
          <button
            type="button"
            class="trip-ai-assist__menu-button"
            data-test="trip-ai-menu-button"
            :aria-expanded="String(chatMenuOpen)"
            aria-haspopup="menu"
            aria-label="Scope AI chat actions"
            :title="statusLabel"
            @click="toggleChatMenu"
            @keydown.escape.stop.prevent="closeChatMenu"
          >
            <ScopeIcon name="settings" label="" />
            <span>Chat</span>
            <ScopeIcon name="chevron-down" label="" />
          </button>
          <div
            v-if="chatMenuOpen"
            class="trip-ai-assist__menu-popover"
            data-test="trip-ai-menu"
            role="menu"
            @keydown.escape.stop.prevent="closeChatMenu"
          >
            <button
              type="button"
              class="trip-ai-assist__menu-item"
              data-test="trip-ai-restart"
              role="menuitem"
              @click="openRestartChatDialog"
            >
              <ScopeIcon name="reset" label="" />
              <span>Restart Chat</span>
            </button>
            <button
              type="button"
              class="trip-ai-assist__menu-item"
              data-test="trip-ai-save-transcript"
              role="menuitem"
              @click="saveTranscript"
            >
              <ScopeIcon name="edit" label="" />
              <span>Download Transcript</span>
            </button>
          </div>
        </div>
      </div>
    </header>

    <div
      v-if="restartDialogOpen"
      class="trip-ai-assist__modal-backdrop"
      data-test="trip-ai-restart-dialog"
      role="presentation"
      @click.self="cancelRestartChat"
      @keydown.escape.stop.prevent="cancelRestartChat"
    >
      <section
        class="trip-ai-assist__modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="trip-ai-restart-title"
      >
        <p class="eyebrow">Restart chat</p>
        <h3 id="trip-ai-restart-title">Clear this Scope AI conversation?</h3>
        <p>This only clears the chat in this planner panel. Your trip draft, route, stops, and saved work stay untouched.</p>
        <div class="trip-ai-assist__modal-actions">
          <button
            type="button"
            class="trip-ai-assist__modal-button trip-ai-assist__modal-button--secondary"
            data-test="trip-ai-restart-cancel"
            @click="cancelRestartChat"
          >
            Keep chat
          </button>
          <button
            type="button"
            class="trip-ai-assist__modal-button trip-ai-assist__modal-button--primary"
            data-test="trip-ai-restart-confirm"
            @click="confirmRestartChat"
          >
            Restart chat
          </button>
        </div>
      </section>
    </div>

    <div
      class="trip-ai-assist__overview"
      data-test="trip-ai-context"
      aria-label="Trip draft summary"
      :data-context-state="conversationStarted && !isContextExpanded ? 'collapsed' : 'expanded'"
      :aria-hidden="String(conversationStarted && !isContextExpanded)"
    >
      <article
        v-for="card in contextCards"
        :key="card.label"
        class="trip-ai-assist__overview-card"
        :class="`trip-ai-assist__overview-card--${card.key}`"
      >
        <span>{{ card.label }}</span>
        <strong>{{ card.value }}</strong>
      </article>
    </div>

    <div
      ref="threadViewport"
      class="trip-ai-assist__body"
      :class="{ 'trip-ai-assist__body--scrollable': hasConversationExchange }"
    >
      <div v-if="conversationStarted" class="trip-ai-assist__thread" data-test="trip-ai-thread" aria-live="polite">
        <template v-for="message in messages" :key="message.id">
          <article v-if="message.role === 'user'" class="trip-ai-assist__message trip-ai-assist__message--user" data-test="trip-ai-user-message">
            <div class="trip-ai-assist__turn-meta">
              <span>You</span>
            </div>
            <p v-if="message.content">{{ message.content }}</p>
            <div v-if="message.attachments?.length" class="trip-ai-assist__attachments trip-ai-assist__attachments--sent" data-test="trip-ai-user-attachments">
              <article
                v-for="attachment in message.attachments"
                :key="attachment.id"
                class="trip-ai-assist__attachment"
              >
                <img v-if="attachment.previewUrl" :src="attachment.previewUrl" :alt="attachment.name" />
                <span v-else class="trip-ai-assist__attachment-fallback">
                  <ScopeIcon name="image" label="Attached image" />
                </span>
                <small>{{ attachment.name }}</small>
              </article>
            </div>
          </article>

          <article
            v-else-if="message.kind === 'places'"
            class="trip-ai-assist__message trip-ai-assist__message--assistant trip-ai-assist__places"
            data-test="trip-ai-place-results"
          >
            <div class="trip-ai-assist__response-meta">
              <strong>Scope AI</strong>
              <span>{{ message.queryLabel }}</span>
            </div>
            <p>{{ message.content }}</p>

            <div v-if="message.results.length" class="trip-ai-assist__place-list">
              <article
                v-for="(result, index) in message.results"
                :key="buildPlaceSearchResultKey(result, index)"
                class="trip-ai-assist__place-card"
                data-test="trip-ai-place-result"
              >
                <span class="trip-ai-assist__place-marker" aria-hidden="true">{{ index + 1 }}</span>
                <div>
                  <strong>{{ result.placeName }}</strong>
                  <small>{{ formatPlaceResultMeta(result) }}</small>
                </div>
                <button
                  type="button"
                  class="trip-ai-assist__place-add"
                  data-test="trip-ai-place-add"
                  :disabled="!isTrustedProviderPlaceResult(result)"
                  :aria-label="getPlaceResultActionAriaLabel(message, result)"
                  @click="handlePlaceSearchResultAction(message, result)"
                >
                  {{ getPlaceResultActionLabel(message) }}
                </button>
              </article>
            </div>
          </article>

          <article v-else class="trip-ai-assist__message trip-ai-assist__message--assistant" :class="{ 'trip-ai-assist__message--error': message.kind === 'error' }" data-test="trip-ai-response" :role="message.kind === 'error' ? 'alert' : undefined">
            <div class="trip-ai-assist__response-meta">
              <strong>Scope AI</strong>
            </div>
            <div v-if="message.kind === 'text'" class="trip-ai-assist__structured-response">
              <section
                v-for="(section, sectionIndex) in structureAssistantContent(message.content)"
                :key="`${message.id}-${section.title}-${sectionIndex}`"
                class="trip-ai-assist__response-section"
              >
                <h3 v-if="section.title">{{ section.title }}</h3>
                <p v-if="section.body">{{ section.body }}</p>
                <ul v-if="section.items.length">
                  <li v-for="(item, itemIndex) in section.items" :key="`${section.title}-${itemIndex}`">{{ item }}</li>
                </ul>
              </section>
            </div>
            <p v-else>{{ message.content }}</p>
            <div
              v-if="message.kind === 'text' && message.chips?.length"
              class="trip-ai-assist__message-chips"
              data-test="trip-ai-message-chips"
              aria-label="Suggested follow-ups"
            >
              <button
                v-for="chip in message.chips"
                :key="`${message.id}-${chip}`"
                type="button"
                class="trip-ai-assist__quick-chip"
                data-test="trip-ai-message-chip"
                @click.prevent.stop="handleSuggestionClick(chip, $event)"
              >
                {{ chip }}
              </button>
            </div>
          </article>
        </template>

        <article v-if="loading" class="trip-ai-assist__message trip-ai-assist__message--assistant trip-ai-assist__message--thinking">
          <div class="trip-ai-assist__turn-meta">
            <span>Scope AI</span>
          </div>
          <p>
            <span>{{ workingMessage }}</span>
            <span class="trip-ai-assist__typing-dots" aria-hidden="true">
              <span />
              <span />
              <span />
            </span>
          </p>
        </article>

        <div class="trip-ai-assist__quickbar" data-test="trip-ai-quickbar" aria-label="Follow-up prompts">
          <button
            v-for="suggestion in suggestions"
            :key="suggestion"
            type="button"
            class="trip-ai-assist__quick-chip"
            data-test="trip-ai-quick-suggestion"
            @click.prevent.stop="handleSuggestionClick(suggestion, $event)"
          >
            {{ suggestion }}
          </button>
        </div>
      </div>

      <div v-else class="trip-ai-assist__draft">
        <article class="trip-ai-assist__message trip-ai-assist__message--assistant trip-ai-assist__starter" data-test="trip-ai-starter">
          <span>Scope AI</span>
          <p>{{ starterMessage }}</p>
        </article>
        <div class="trip-ai-assist__suggestions" aria-label="Trip AI suggestions">
          <button
            v-for="suggestion in suggestions"
            :key="suggestion"
            type="button"
            class="trip-ai-assist__suggestion"
            data-test="trip-ai-suggestion"
            @click.prevent.stop="handleSuggestionClick(suggestion, $event)"
          >
            {{ suggestion }}
          </button>
        </div>
      </div>
    </div>

    <form class="trip-ai-assist__form" data-test="trip-ai-form" @submit.prevent="props.scopeAiStore ? handleScopeAiAsk() : handleAsk()">
      <div v-if="pendingAttachments.length" class="trip-ai-assist__attachments trip-ai-assist__attachments--pending" data-test="trip-ai-pending-attachments">
        <article
          v-for="attachment in pendingAttachments"
          :key="attachment.id"
          class="trip-ai-assist__attachment"
        >
          <img v-if="attachment.previewUrl" :src="attachment.previewUrl" :alt="attachment.name" />
          <span v-else class="trip-ai-assist__attachment-fallback">
            <ScopeIcon name="image" label="Attached image" />
          </span>
          <small>{{ attachment.name }}</small>
          <button type="button" :aria-label="`Remove ${attachment.name}`" @click="removePendingAttachment(attachment.id)">
            <ScopeIcon name="close" label="Remove image" />
          </button>
        </article>
      </div>

      <div class="trip-ai-assist__composer-row">
        <input
          ref="attachmentInput"
          type="file"
          accept="image/*"
          multiple
          class="trip-ai-assist__file-input"
          data-test="trip-ai-file-input"
          @change="handleAttachmentChange"
        />
        <button
          type="button"
          class="trip-ai-assist__attach"
          data-test="trip-ai-attach-button"
          :disabled="loading"
          @click="openAttachmentPicker"
        >
          <ScopeIcon name="image" label="Add image" />
        </button>
        <button
          type="button"
          class="trip-ai-assist__voice"
          :class="{ 'trip-ai-assist__voice--active': voiceListening }"
          data-test="trip-ai-voice-button"
          :aria-label="voiceButtonLabel"
          :aria-pressed="String(voiceListening)"
          :title="voiceButtonLabel"
          :disabled="loading"
          @click="toggleVoiceInput"
        >
          <ScopeIcon name="mic" :label="voiceButtonLabel" />
        </button>
        <input
          ref="promptInput"
          v-model="prompt"
          type="text"
          class="trip-ai-assist__input"
          data-test="trip-ai-input"
          placeholder="Ask Scope AI to find spots, build, tighten, or explain this route"
          autocomplete="off"
        />
        <button type="submit" class="trip-ai-assist__submit" :disabled="!canSubmitPrompt">
          {{ loading ? 'Sending...' : 'Ask AI' }}
        </button>
      </div>
      <p v-if="voiceStatus" class="trip-ai-assist__voice-status" data-test="trip-ai-voice-status" role="status" aria-live="polite">
        {{ voiceStatus }}
      </p>
    </form>
  </section>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue';
import ScopeIcon from '@/components/common/ScopeIcon.vue';
import { planTrip } from '@/services/agentService';
import { trackScopeAiInteraction, type ScopeAiInteractionSource } from '@/services/analyticsService';
import { getNearbyFuelStations } from '@/services/fuelPriceService';
import { searchLocations, searchNearbyPlaces, searchPlaces, type NearbyPlaceResult, type PlaceSearchResult } from '@/services/mapService';
import {
  formatScopeAiResolvedPlaceLabel,
  resolveScopeAiLocationIntent,
  type ScopeAiLocationResolution,
} from '@/services/scopeAiLocationResolver';
import { getOpenWeatherMapSnapshot, type WeatherLookupPoint, type WeatherSnapshot } from '@/services/openWeatherMapService';
import { parseScopeAiResponse } from '@/services/scopeAiResponseParser';
import {
  callScopeAi,
  extractExplicitLocationRecommendationQuery,
  normalizeScopeAiCommandText,
} from '@/services/scopeAiService';
import { sanitizeScopeAiVisibleText } from '@/services/scopeAiSafety';
import {
  auditScopeAiTurn,
  type ScopeAiPreviousAssistantMessage,
  type ScopeAiTurnActionApplyResult,
  type ScopeAiTurnPlannerSnapshot,
} from '@/services/scopeAiTurnAuditor';
import { getTravelNearbySuggestions, type TravelNearbyCategory, type TravelNearbySuggestion } from '@/services/travelNearbyService';
import { preloadScopeWasmRuntime } from '@/services/wasmService';
import type {
  ScopeAiActionBlock,
  ScopeAiActionBlockApplyResult,
  ScopeAiActionResolution,
  ScopeAiMapCommand,
  ScopeAiMapCommandPayload,
  ScopeAiPendingContextItem,
  ScopeAiPendingScopeAiContext,
  ScopeAiPendingScopeAiContextInput,
  ScopeAiPlannerState,
  ScopeAiPreferences,
  ScopeAiSessionEntry,
} from '@/stores/scopeAiPlanner';
import type { FuelStationPrice, SpotCategory, TripPace, TripPlannerInput, TripSpot } from '@/types';
import { getScopeAiResponseStartedAt, waitForScopeAiResponsePace } from '@/utils/scopeAiResponsePace';
import { useAnalyticsConsent } from '@/utils/analyticsConsent';
import { isVagueBriefReply } from '@/utils/itineraryBrief';

type ScopeAiTripCommandPayload =
  | { type: 'save' }
  | { type: 'share' }
  | { type: 'delete' }
  | { type: 'visibility'; isPublic: boolean }
  | { type: 'invite'; recipient: string; role: 'editor' | 'viewer' };

interface ScopeAiCommandResult {
  ok: boolean;
  message: string;
  chips?: string[];
}

interface ScopeAiPlannerStoreBridge {
  plannerState?: Partial<ScopeAiPlannerState> | null;
  stateAsJson: object;
  sessionHistory: ScopeAiSessionEntry[];
  preferences: ScopeAiPreferences;
  pendingScopeAiContext?: ScopeAiPendingScopeAiContext | { value?: ScopeAiPendingScopeAiContext | null } | null;
  applyActionBlockResolved?: (actionBlock: ScopeAiActionBlock) => Promise<unknown> | unknown;
  applyActionBlock?: (actionBlock: ScopeAiActionBlock) => unknown;
  addSessionEntry: (entry: ScopeAiSessionEntry) => void;
  trackAcceptedType: (type: string) => void;
  trackRejectedType: (type: string) => void;
  setPendingScopeAiContext?: (context: ScopeAiPendingScopeAiContextInput) => void;
  clearPendingScopeAiContext?: (reason?: string) => void;
  incrementPendingScopeAiContextTurn?: () => void;
}

interface ScopeSpeechRecognitionAlternative {
  transcript: string;
}

interface ScopeSpeechRecognitionResult {
  readonly isFinal: boolean;
  readonly length: number;
  item(index: number): ScopeSpeechRecognitionAlternative;
  [index: number]: ScopeSpeechRecognitionAlternative;
}

interface ScopeSpeechRecognitionResultList {
  readonly length: number;
  item(index: number): ScopeSpeechRecognitionResult;
  [index: number]: ScopeSpeechRecognitionResult;
}

interface ScopeSpeechRecognitionEvent {
  resultIndex: number;
  results: ScopeSpeechRecognitionResultList;
}

interface ScopeSpeechRecognitionErrorEvent {
  error?: string;
}

interface ScopeSpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: ScopeSpeechRecognitionEvent) => void) | null;
  onerror: ((event: ScopeSpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

interface ScopeSpeechRecognitionConstructor {
  new(): ScopeSpeechRecognitionLike;
}

type ScopeSpeechWindow = Window & typeof globalThis & {
  SpeechRecognition?: ScopeSpeechRecognitionConstructor;
  webkitSpeechRecognition?: ScopeSpeechRecognitionConstructor;
};

const props = withDefaults(
  defineProps<{
    draft: TripPlannerInput;
    locationSearchProximity?: RouteFallbackAnchor;
    tripTitle?: string;
    stops?: TripSpot[];
    scopeAiStore?: ScopeAiPlannerStoreBridge;
    userId?: string;
    executeTripCommand?: (payload: ScopeAiTripCommandPayload) => Promise<ScopeAiCommandResult> | ScopeAiCommandResult;
    executeMapCommand?: (payload: ScopeAiMapCommandPayload) => Promise<ScopeAiCommandResult> | ScopeAiCommandResult;
  }>(),
  {
    locationSearchProximity: undefined,
    tripTitle: '',
    stops: () => [],
    scopeAiStore: undefined,
    userId: undefined,
    executeTripCommand: undefined,
    executeMapCommand: undefined,
  },
);

const prompt = ref('');
const loading = ref(false);
const isContextExpanded = ref(true);
const messages = ref<ChatMessage[]>([]);
const assistShell = ref<HTMLElement | null>(null);
const threadViewport = ref<HTMLElement | null>(null);
const attachmentInput = ref<HTMLInputElement | null>(null);
const promptInput = ref<HTMLInputElement | null>(null);
const pendingAttachments = ref<ChatAttachment[]>([]);
const workingMessage = ref(DEFAULT_WORKING_MESSAGE);
const lastSuccessfulRouteActionSignature = ref('');
const pendingItineraryBrief = ref<PendingItineraryBrief | null>(null);
const lastFollowUpIntent = ref<FollowUpIntentContext | null>(null);
const scopeAiStructuredSuggestions = ref<string[]>([]);
const chatMenuOpen = ref(false);
const restartDialogOpen = ref(false);
const voiceListening = ref(false);
const voiceStatus = ref('');
const voiceBasePrompt = ref('');
const pendingDeleteConfirmation = ref(false);
const { consent } = useAnalyticsConsent();
const activeTurnId = ref<string | null>(null);
let activeAbortController: AbortController | null = null;
let voiceRecognition: ScopeSpeechRecognitionLike | null = null;
const MAX_SUGGESTIONS = 3;
const ENDPOINT_RECOMMENDATION_RESULT_LIMIT = 3;
const ENDPOINT_RECOMMENDATION_SEARCH_LIMIT = 10;
const ENDPOINT_RECOMMENDATION_RADIUS_KM = 64;
const MAX_IMAGE_ATTACHMENTS = 3;
const MAX_SCOPE_AI_IMAGE_ATTACHMENT_BYTES = 1.5 * 1024 * 1024;
const SUPPORTED_SCOPE_AI_IMAGE_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_PENDING_SCOPE_AI_CONTEXT_AGE_MS = 30 * 60 * 1000;
const RECENT_CHAT_CONTEXT_LIMIT = 8;
const SCOPE_ACTION_BLOCK_PATTERN = /\[SCOPE_ACTION\]([\s\S]*?)\[\/SCOPE_ACTION\]/gi;
const CHIPS_BLOCK_PATTERN = /\[CHIPS\]([\s\S]*?)\[\/CHIPS\]/gi;
const APP_UI_LOOKUP_PATTERN = /\b(app|screen|button|click|tap|ui|search bar|profile|notifications?|chat bar|route canvas|image icon|add\s+(?:a\s+|an\s+|the\s+)?start|add\s+(?:a\s+|an\s+|the\s+)?end|choose\s+(?:a\s+|an\s+|the\s+)?start|choose\s+(?:a\s+|an\s+|the\s+)?end|start point|end point)\b/i;
const STREET_ADDRESS_PATTERN = /\b\d{1,6}\s+[\w'.-]+(?:\s+[\w'.-]+){0,6}\s+(?:street|st|road|rd|avenue|ave|boulevard|blvd|drive|dr|lane|ln|court|ct|circle|cir|way|parkway|pkwy|highway|hwy|trail|trl|terrace|ter|plaza|plz|farm(?:\s+to\s+market|-to-market)|fm|county road|cr|route)\b/i;
const DEFAULT_WORKING_MESSAGE = 'Checking the planner context';
const SCOPE_AI_WORKING_MESSAGES = [
  DEFAULT_WORKING_MESSAGE,
  'Reading the route details',
  'Checking map context',
  'Keeping the planner in sync',
  'Looking for the cleanest next step',
  'Matching this to the trip brief',
];

function normalizeNoisyScopeAiPrompt(value: string): string {
  return normalizeScopeAiCommandText(value);
}

type ChatMessage =
  | {
      id: string;
      role: 'user';
      content: string;
      attachments?: ChatAttachment[];
    }
  | {
      id: string;
      role: 'assistant';
      kind: 'text' | 'error';
      content: string;
      model?: string;
      chips?: string[];
      auditStateSignature?: string;
      auditReasons?: string[];
      pendingContext?: ScopeAiPendingScopeAiContext;
    }
  | {
      id: string;
      role: 'assistant';
      kind: 'places';
      content: string;
      queryLabel: string;
      results: ChatPlaceResult[];
      placeAction?: ChatPlaceAction;
      auditStateSignature?: string;
      auditReasons?: string[];
      pendingContext?: ScopeAiPendingScopeAiContext;
    };

type ChatPlaceAction = 'add-stop' | 'set-start' | 'set-end';

type ChatPlaceResult = PlaceSearchResult & {
  reason?: string;
  sourceLabel?: string;
  providerVerified?: boolean;
};

interface RouteSearchAnchor {
  id: string;
  label: string;
  latitude: number;
  longitude: number;
  role: 'start' | 'stop' | 'end' | 'midpoint';
}

interface RouteFallbackAnchor {
  label?: string;
  latitude: number;
  longitude: number;
}

type LocationPickTarget = 'destination' | 'endDestination';

interface PlannerMapLocationSelection {
  target: LocationPickTarget;
  label: string;
  latitude: number;
  longitude: number;
  city?: string;
  country?: string;
}

interface PlaceSearchIntent {
  query: string;
  mode: 'places' | 'locations';
  requiresAnchor: boolean;
}

interface EndpointRecommendationIntent {
  target: LocationPickTarget;
  anchorQuery: string | null;
  preference: 'balanced' | 'scenic' | 'practical';
}

interface ChatAttachment {
  id: string;
  base64Data?: string;
  name: string;
  previewUrl: string;
  size: number;
  type: string;
}

interface StructuredResponseSection {
  title: string;
  body: string;
  items: string[];
}

type RouteActionReason = 'build' | 'tighten' | 'weekend';
type BriefQuestionKey = 'destination' | 'endDestination' | 'duration' | 'interests' | 'pace' | 'travelParty';

type ItineraryBuildStatus = 'success' | 'busy' | 'queued';

interface ItineraryBuildResult {
  status: ItineraryBuildStatus;
  routeLabel: string;
  stopCount: number;
  dayCount?: number;
}

interface ItineraryBuildRequestPayload {
  prompt: string;
  reason: RouteActionReason;
  draftDefaults?: ItineraryBuildDraftDefaults;
  handled: boolean;
  resolve: (result: ItineraryBuildResult) => void;
  reject: (error: unknown) => void;
}

interface BriefQuestion {
  key: BriefQuestionKey;
  text: string;
}

interface ItineraryBuildDraftDefaults {
  startDate?: string;
  endDate?: string;
  durationDays?: number;
  interests?: SpotCategory[];
  pace?: TripPace;
  groupSize?: number;
}

interface PendingItineraryBrief {
  reason: RouteActionReason;
  originalPrompt: string;
  missingKeys: BriefQuestionKey[];
  draftDefaults: ItineraryBuildDraftDefaults;
}

type FollowUpIntentKind =
  | 'appHelp'
  | 'budget'
  | 'build'
  | 'food'
  | 'general'
  | 'group'
  | 'image'
  | 'location'
  | 'places'
  | 'safety'
  | 'startCity'
  | 'tighten'
  | 'timing'
  | 'weather'
  | 'weekend';

interface FollowUpIntentContext {
  kind: FollowUpIntentKind;
  prompt: string;
  responseKind: 'text' | 'error' | 'places';
  routeActionReason?: RouteActionReason;
}

type ScopeRouteActionType = 'add_marker' | 'remove_marker' | 'reorder_stops';
type ScopeRouteActionStopType = 'start' | 'stop' | 'destination';

interface ScopeRouteActionPayload {
  action?: unknown;
  type?: unknown;
  action_type?: unknown;
  place_name?: unknown;
  placeName?: unknown;
  name?: unknown;
  title?: unknown;
  place_id?: unknown;
  placeId?: unknown;
  id?: unknown;
  address?: unknown;
  stop_type?: unknown;
  stopType?: unknown;
  day?: unknown;
  dayNumber?: unknown;
  order?: unknown;
  note?: unknown;
  notes?: unknown;
  latitude?: unknown;
  longitude?: unknown;
  lat?: unknown;
  lng?: unknown;
  coordinates?: unknown;
  stops?: unknown;
  stop_order?: unknown;
}

interface ParsedAssistantResponse {
  content: string;
  chips: string[];
  actions: ScopeRouteActionPayload[];
}

const emit = defineEmits<{
  (event: 'route-stop-add', payload: TripSpot): void;
  (event: 'route-stop-remove', payload: string): void;
  (event: 'route-stops-replace', payload: TripSpot[]): void;
  (event: 'route-endpoint-remove', payload: LocationPickTarget): void;
  (event: 'map-location-select', payload: PlannerMapLocationSelection): void;
  (event: 'itinerary-build-request', payload: ItineraryBuildRequestPayload): void;
}>();

let workingMessageCursor = 0;

function chooseWorkingMessage(promptText = ''): string {
  const normalized = promptText.toLowerCase();
  const pool = [
    ...(/\b(fuel|gas|ev|charge|charging)\b/.test(normalized)
      ? ['Checking fuel context', 'Looking up route energy stops']
      : []),
    ...(/\b(nearby|coffee|food|restaurant|restroom|hotel|stay|scenic|view|entertainment|bowling|arcade|theme park|amusement|stop)\b/.test(normalized)
      ? ['Searching around the route', 'Checking nearby stop options']
      : []),
    ...(/\b(start|end|destination|address|from|to)\b/.test(normalized)
      ? ['Resolving the route endpoints', 'Checking the place match']
      : []),
    ...SCOPE_AI_WORKING_MESSAGES,
  ];

  workingMessageCursor = (workingMessageCursor + 1) % pool.length;
  return pool[workingMessageCursor] ?? DEFAULT_WORKING_MESSAGE;
}

const conversationStarted = computed(() => messages.value.length > 0 || loading.value);
const hasConversationExchange = computed(() => {
  let hasUserMessage = false;
  let hasAssistantMessage = false;

  for (const message of messages.value) {
    if (message.role === 'user') {
      hasUserMessage = true;
      continue;
    }
    if (message.role === 'assistant') {
      hasAssistantMessage = true;
    }
    if (hasUserMessage && hasAssistantMessage) {
      return true;
    }
  }

  return false;
});
const canSubmitPrompt = computed(() => Boolean(prompt.value.trim() || pendingAttachments.value.length));
const voiceInputSupported = computed(() => Boolean(getSpeechRecognitionConstructor()));
const voiceButtonLabel = computed(() => {
  if (voiceListening.value) {
    return 'Stop voice dictation';
  }

  return voiceInputSupported.value ? 'Start voice dictation' : 'Voice dictation unavailable';
});

const routeLabel = computed(() => {
  const start = formatRouteEndpointLabel(props.draft.destination);
  const end = formatRouteEndpointLabel(props.draft.endDestination);
  if (start && end) {
    return `${start} to ${end}`;
  }

  return start || end || '';
});

function getSpeechRecognitionConstructor(): ScopeSpeechRecognitionConstructor | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const speechWindow = window as ScopeSpeechWindow;
  return speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition ?? null;
}

function getSpeechRecognitionResult(
  results: ScopeSpeechRecognitionResultList,
  index: number,
): ScopeSpeechRecognitionResult | undefined {
  return typeof results.item === 'function' ? results.item(index) : results[index];
}

function getSpeechRecognitionAlternative(
  result: ScopeSpeechRecognitionResult,
  index: number,
): ScopeSpeechRecognitionAlternative | undefined {
  return typeof result.item === 'function' ? result.item(index) : result[index];
}

function extractSpeechRecognitionTranscript(event: ScopeSpeechRecognitionEvent): { hasFinal: boolean; text: string } {
  const segments: string[] = [];
  let hasFinal = false;
  const startIndex = Math.max(0, event.resultIndex || 0);

  for (let index = startIndex; index < event.results.length; index += 1) {
    const result = getSpeechRecognitionResult(event.results, index);
    if (!result) {
      continue;
    }

    const alternative = getSpeechRecognitionAlternative(result, 0);
    const transcript = alternative?.transcript?.replace(/\s+/g, ' ').trim();
    if (transcript) {
      segments.push(transcript);
    }
    if (result.isFinal) {
      hasFinal = true;
    }
  }

  return {
    hasFinal,
    text: segments.join(' ').replace(/\s+/g, ' ').trim(),
  };
}

function stopVoiceInput(nextStatus = ''): void {
  const recognition = voiceRecognition;
  voiceRecognition = null;
  voiceListening.value = false;
  voiceStatus.value = nextStatus;

  if (!recognition) {
    return;
  }

  recognition.onresult = null;
  recognition.onerror = null;
  recognition.onend = null;

  try {
    recognition.stop();
  } catch {
    try {
      recognition.abort();
    } catch {
      // Some browsers throw if speech recognition was already stopped.
    }
  }
}

function startVoiceInput(): void {
  if (loading.value) {
    return;
  }

  const SpeechRecognition = getSpeechRecognitionConstructor();
  if (!SpeechRecognition) {
    voiceStatus.value = 'Voice dictation is not supported in this browser. Type your message instead.';
    return;
  }

  stopVoiceInput();

  const recognition = new SpeechRecognition();
  voiceRecognition = recognition;
  voiceBasePrompt.value = prompt.value.trim();
  recognition.continuous = false;
  recognition.interimResults = true;
  recognition.lang = typeof navigator !== 'undefined' && navigator.language ? navigator.language : 'en-US';
  voiceListening.value = true;
  voiceStatus.value = 'Listening... Speak your Scope AI command.';

  recognition.onresult = (event) => {
    const transcript = extractSpeechRecognitionTranscript(event);
    if (!transcript.text) {
      return;
    }

    prompt.value = [voiceBasePrompt.value, transcript.text]
      .filter(Boolean)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (transcript.hasFinal) {
      stopVoiceInput('Voice captured. Review or send it.');
    } else {
      voiceStatus.value = 'Listening...';
    }
  };

  recognition.onerror = (event) => {
    const blocked = event.error === 'not-allowed' || event.error === 'service-not-allowed';
    stopVoiceInput(blocked
      ? 'Microphone permission was blocked. Type your message instead.'
      : 'Voice dictation stopped. Type your message if it did not capture clearly.');
  };

  recognition.onend = () => {
    if (voiceRecognition !== recognition) {
      return;
    }

    voiceRecognition = null;
    voiceListening.value = false;
    if (voiceStatus.value.startsWith('Listening')) {
      voiceStatus.value = prompt.value.trim() && prompt.value.trim() !== voiceBasePrompt.value
        ? 'Voice captured. Review or send it.'
        : 'Voice dictation stopped.';
    }
  };

  try {
    recognition.start();
  } catch {
    stopVoiceInput('Voice dictation could not start. Type your message instead.');
  }
}

function toggleVoiceInput(): void {
  if (voiceListening.value) {
    stopVoiceInput('Voice dictation stopped.');
    void nextTick(() => promptInput.value?.focus());
    return;
  }

  startVoiceInput();
  void nextTick(() => promptInput.value?.focus());
}

const starterMessage = computed(() => {
  const route = routeLabel.value;
  const start = formatRouteEndpointLabel(props.draft.destination);

  if (route) {
    return `I already have ${route}. Hand off the brief when you want the live itinerary, or ask me to tighten the route before I build it.`;
  }

  if (start) {
    return `I have the opening point at ${start}. Give me the finish line or ask for stops nearby and I will shape the route before I build it.`;
  }

  return 'Start with the brief or route idea. I turn the planner inputs into the live itinerary, explain tradeoffs, and keep the preview in sync.';
});

const budgetLabel = computed(() => {
  const budgetFloor = formatCurrency(props.draft.budgetFloor);
  const budgetCeiling = formatCurrency(props.draft.budget);
  return [budgetFloor, budgetCeiling].filter(Boolean).join(' - ') || 'Set budget';
});

const paceLabel = computed(() => props.draft.pace.replace(/^\w/, (letter) => letter.toUpperCase()));

const contextCards = computed(() => [
  {
    key: 'route',
    label: 'Route',
    value: routeLabel.value || 'Choose endpoints',
  },
  {
    key: 'budget',
    label: 'Budget',
    value: budgetLabel.value,
  },
  {
    key: 'pace',
    label: 'Pace',
    value: paceLabel.value,
  },
]);

const routeSearchAnchors = computed<RouteSearchAnchor[]>(() => {
  const anchors: RouteSearchAnchor[] = [];
  const startLabel = formatRouteEndpointLabel(props.draft.destination);
  const endLabel = formatRouteEndpointLabel(props.draft.endDestination);

  if (hasCoordinatePair(props.draft.destinationLatitude, props.draft.destinationLongitude)) {
    anchors.push({
      id: 'start',
      label: startLabel || 'route start',
      latitude: Number(props.draft.destinationLatitude),
      longitude: Number(props.draft.destinationLongitude),
      role: 'start',
    });
  }

  props.stops.forEach((stop, index) => {
    if (!hasCoordinatePair(stop.latitude, stop.longitude)) {
      return;
    }

    anchors.push({
      id: `stop-${index + 1}`,
      label: stop.title || `stop ${index + 1}`,
      latitude: stop.latitude,
      longitude: stop.longitude,
      role: 'stop',
    });
  });

  if (hasCoordinatePair(props.draft.endDestinationLatitude, props.draft.endDestinationLongitude)) {
    anchors.push({
      id: 'end',
      label: endLabel || 'route end',
      latitude: Number(props.draft.endDestinationLatitude),
      longitude: Number(props.draft.endDestinationLongitude),
      role: 'end',
    });
  }

  if (!anchors.length && hasCoordinatePair(props.locationSearchProximity?.latitude, props.locationSearchProximity?.longitude)) {
    anchors.push({
      id: 'planner-context',
      label: props.locationSearchProximity?.label || 'your trip context',
      latitude: Number(props.locationSearchProximity?.latitude),
      longitude: Number(props.locationSearchProximity?.longitude),
      role: 'midpoint',
    });
  }

  return anchors;
});

const statusLabel = computed(() => {
  if (loading.value) {
    return 'Working';
  }

  const lastAssistantMessage = [...messages.value].reverse().find((message) => message.role === 'assistant');
  if (lastAssistantMessage?.kind === 'places' && lastAssistantMessage.results.length) {
    return 'Places found';
  }

  if (messages.value.length) {
    return 'Ready';
  }

  return routeLabel.value || 'Ready for handoff';
});

function formatCurrency(value: number | undefined): string {
  if (!Number.isFinite(value)) {
    return '';
  }

  return `$${Math.round(Number(value)).toLocaleString('en-US')}`;
}

function parsePlannerDate(value: string | undefined): Date | null {
  if (!value) {
    return null;
  }

  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function getDateRangeDurationDays(startDate: string | undefined, endDate: string | undefined): number | null {
  const start = parsePlannerDate(startDate);
  const end = parsePlannerDate(endDate);

  if (!start || !end || end < start) {
    return null;
  }

  const days = Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1;
  return days > 0 ? days : null;
}

function normalizeDurationDays(value: number | undefined): number | null {
  if (!Number.isFinite(value)) {
    return null;
  }

  const rounded = Math.round(Number(value));
  return rounded >= 1 && rounded <= 30 ? rounded : null;
}

function getBuildDefaultsDurationDays(defaults: ItineraryBuildDraftDefaults): number | null {
  return normalizeDurationDays(defaults.durationDays)
    ?? getDateRangeDurationDays(defaults.startDate, defaults.endDate);
}

function getTripDurationDays(): number | null {
  return getDateRangeDurationDays(props.draft.startDate, props.draft.endDate);
}

function formatTravelPartyLabel(groupSize: number | undefined): string {
  const size = Number(groupSize);

  if (!Number.isFinite(size) || size < 1) {
    return '';
  }

  if (size === 1) {
    return 'solo traveler';
  }

  if (size === 2) {
    return '2 travelers, likely a couple or pair';
  }

  return `${size} travelers, group or family`;
}

function getBriefQuestion(key: BriefQuestionKey): BriefQuestion {
  const questions: Record<BriefQuestionKey, string> = {
    destination: 'What start location should I use for this trip?',
    endDestination: 'What final destination should I use for this itinerary?',
    duration: 'How many days should I plan for?',
    interests: 'What kind of trip should this feel like: food, culture, nature, adventure, nightlife, shopping, entertainment, or balanced?',
    pace: 'What pace should I use: relaxed, balanced, or packed?',
    travelParty: 'Who is coming with you: solo, a couple, a group, or family?',
  };

  return {
    key,
    text: questions[key],
  };
}

function getBriefQuestions(keys: BriefQuestionKey[]): BriefQuestion[] {
  return keys.map(getBriefQuestion);
}

function getMissingItineraryBriefQuestions(
  draftDefaults: ItineraryBuildDraftDefaults = {},
  options: { requireEndDestination?: boolean } = {},
): BriefQuestion[] {
  const draft = props.draft;
  const hasStart = Boolean(draft.destination.trim());
  const hasEnd = Boolean(draft.endDestination?.trim());
  const durationDays = getTripDurationDays();
  const hasDefaultDuration = Boolean((draftDefaults.startDate && draftDefaults.endDate) || normalizeDurationDays(draftDefaults.durationDays));
  const hasDefaultInterests = Boolean(draftDefaults.interests?.length);
  const hasDefaultPace = Boolean(draftDefaults.pace);
  const hasDefaultTravelParty = Number.isFinite(draftDefaults.groupSize) && Number(draftDefaults.groupSize) > 0;
  const questions: BriefQuestion[] = [];

  if (!hasStart) {
    questions.push(getBriefQuestion('destination'));
  }

  if (options.requireEndDestination && !hasEnd) {
    questions.push(getBriefQuestion('endDestination'));
  }

  if ((!durationDays || durationDays <= 1) && !hasDefaultDuration) {
    questions.push(getBriefQuestion('duration'));
  }

  if (!draft.interests.length && !hasDefaultInterests) {
    questions.push(getBriefQuestion('interests'));
  }

  if (!draft.pace && !hasDefaultPace) {
    questions.push(getBriefQuestion('pace'));
  }

  if ((!Number.isFinite(draft.groupSize) || draft.groupSize < 1) && !hasDefaultTravelParty) {
    questions.push(getBriefQuestion('travelParty'));
  }

  return questions;
}

function buildMissingItineraryBriefMessage(reason: RouteActionReason, questions: BriefQuestion[], answeredOne = false): ChatMessage {
  const nextQuestion = questions[0]?.text ?? getBriefQuestion('interests').text;
  const opener = answeredOne
    ? 'Got it.'
    : reason === 'tighten'
      ? 'I can tighten that.'
      : 'I can build that.';

  return {
    id: createMessageId('assistant'),
    role: 'assistant',
    kind: 'text',
    model: 'scope-action',
    content: `${opener} ${nextQuestion}`,
  };
}

function summarizeOffQuestionBriefReply(value: string): string {
  if (/\b(budget|inside|under|cap|\$|cost|spend|price|cheap|expensive)\b/i.test(value)) {
    return 'Got the budget guardrail.';
  }

  if (/\b(time|timing|schedule|depart|arrival|arrive|morning|night|late|early)\b/i.test(value)) {
    return 'Got the timing note.';
  }

  if (/\b(stop|food|coffee|gas|place|restaurant|nearby)\b/i.test(value)) {
    return 'Got that route note.';
  }

  return 'I caught that.';
}

function buildPendingBriefReminderMessage(reason: RouteActionReason, question: BriefQuestion, userReply: string): ChatMessage {
  const actionLabel = reason === 'tighten' ? 'tighten the itinerary' : 'build the itinerary';
  return {
    id: createMessageId('assistant'),
    role: 'assistant',
    kind: 'text',
    model: 'scope-action',
    content: `${summarizeOffQuestionBriefReply(userReply)} I still need this before I ${actionLabel}: ${question.text}`,
  };
}

function buildPendingBriefSuggestions(pendingBrief: PendingItineraryBrief): string[] {
  const currentKey = pendingBrief.missingKeys[0];

  if (currentKey === 'duration') {
    return ['1 day', '2 days', 'Surprise me'];
  }

  if (currentKey === 'interests') {
    return ['Balanced', 'Food and culture', 'Nature and scenic'];
  }

  if (currentKey === 'pace') {
    return ['Relaxed pace', 'Balanced pace', 'Packed pace'];
  }

  if (currentKey === 'travelParty') {
    return ['Solo', 'Couple', 'Group of 4'];
  }

  if (currentKey === 'destination') {
    return ['Help me choose a start point', 'I will add the start in the route builder', 'Cancel this build'];
  }

  if (currentKey === 'endDestination') {
    return ['Help me choose an end point', 'I will add the end in the route builder', 'Cancel this build'];
  }

  return ['Surprise me', 'Balanced', 'Cancel this build'];
}

function formatDateInput(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function getWeekendDateDefaults(): ItineraryBuildDraftDefaults {
  const start = parsePlannerDate(props.draft.startDate) ?? new Date();
  const end = new Date(start);
  end.setDate(start.getDate() + 1);

  return {
    startDate: formatDateInput(start),
    endDate: formatDateInput(end),
    durationDays: 2,
  };
}

function getDefaultForBriefQuestion(key: BriefQuestionKey): ItineraryBuildDraftDefaults {
  if (key === 'duration') {
    return getWeekendDateDefaults();
  }

  if (key === 'interests') {
    return { interests: ['food', 'culture', 'scenic'] };
  }

  if (key === 'pace') {
    return { pace: 'moderate' };
  }

  if (key === 'travelParty') {
    return { groupSize: 2 };
  }

  return {};
}

function mergeItineraryBuildDefaults(
  current: ItineraryBuildDraftDefaults,
  next: ItineraryBuildDraftDefaults,
): ItineraryBuildDraftDefaults {
  return {
    ...current,
    ...next,
    durationDays: normalizeDurationDays(next.durationDays) ?? normalizeDurationDays(current.durationDays) ?? undefined,
    interests: next.interests ? [...next.interests] : current.interests ? [...current.interests] : undefined,
  };
}

function buildSmartDefaultsForKeys(keys: BriefQuestionKey[]): ItineraryBuildDraftDefaults {
  return keys.reduce<ItineraryBuildDraftDefaults>(
    (defaults, key) => mergeItineraryBuildDefaults(defaults, getDefaultForBriefQuestion(key)),
    {},
  );
}

function parseDurationReply(value: string): ItineraryBuildDraftDefaults | null {
  if (/\bweekend\b/i.test(value)) {
    return getWeekendDateDefaults();
  }

  const explicitMatch = value.match(/\b(\d{1,2})\s*(?:day|days|d)\b/i);
  const bareNumberMatch = value.trim().match(/^(\d{1,2})$/);
  const parsed = Number(explicitMatch?.[1] ?? bareNumberMatch?.[1]);
  if (!Number.isFinite(parsed) || parsed < 1 || parsed > 30) {
    return null;
  }

  const start = parsePlannerDate(props.draft.startDate) ?? new Date();
  const end = new Date(start);
  end.setDate(start.getDate() + Math.max(0, parsed - 1));

  return {
    startDate: formatDateInput(start),
    endDate: formatDateInput(end),
    durationDays: parsed,
  };
}

function parseExplicitDurationPrompt(value: string): ItineraryBuildDraftDefaults | null {
  const normalized = value.trim();
  const explicitMatch = normalized.match(/\b(\d{1,2})\s*-?\s*(?:day|days|d)\b/i);
  const wordDuration = /\b(?:one|single|same)\s*-?\s*day\b/i.test(normalized) ? 1 : null;
  const parsed = Number(explicitMatch?.[1] ?? wordDuration);
  if (!Number.isFinite(parsed) || parsed < 1 || parsed > 30) {
    return null;
  }

  const start = parsePlannerDate(props.draft.startDate) ?? new Date();
  const end = new Date(start);
  end.setDate(start.getDate() + Math.max(0, parsed - 1));

  return {
    startDate: formatDateInput(start),
    endDate: formatDateInput(end),
    durationDays: parsed,
  };
}

function parseInterestReply(value: string): ItineraryBuildDraftDefaults | null {
  const normalized = value.toLowerCase();
  const matched = inferInterestsFromText(normalized);

  if (/\bbalanced|mix|variety|everything\b/.test(normalized)) {
    return { interests: ['food', 'culture', 'scenic'] };
  }

  return matched.length ? { interests: matched } : null;
}

function inferInterestsFromText(value: string): SpotCategory[] {
  const normalized = value.toLowerCase();
  const matched = new Set<SpotCategory>();

  if (/\bfood|restaurant|coffee|cafe|taco|brewery|drink\b/.test(normalized)) {
    matched.add('food');
  }

  if (/\bnature|park|trail|hike|outdoor|lake|beach\b/.test(normalized)) {
    matched.add('nature');
  }

  if (/\bnightlife|bar|club|music|live music\b/.test(normalized)) {
    matched.add('nightlife');
  }

  if (/\bculture|museum|art|history|historic|gallery|landmark\b/.test(normalized)) {
    matched.add('culture');
  }

  if (/\badventure|active|climb|kayak|bike|explore\b/.test(normalized)) {
    matched.add('adventure');
  }

  if (/\bshopping|shop|market|boutique\b/.test(normalized)) {
    matched.add('shopping');
  }

  if (/\bentertainment|amusement|theme park|six flags|bowling|arcade|movie|cinema|concert|zoo|aquarium|stadium|arena|escape room|mini golf|laser tag\b/.test(normalized)) {
    matched.add('entertainment');
  }

  if (/\bscenic|view|sight|sights|key sights|lookout|photo\b/.test(normalized)) {
    matched.add('scenic');
  }

  return [...matched];
}

function parseExplicitInterestDefaultsFromPrompt(value: string): ItineraryBuildDraftDefaults | null {
  const matched = inferInterestsFromText(value);
  return matched.length ? { interests: matched } : null;
}

function parsePaceReply(value: string): ItineraryBuildDraftDefaults | null {
  if (/\brelaxed|slow|chill|easy\b/i.test(value)) {
    return { pace: 'relaxed' };
  }

  if (/\bpacked|busy|full|fast|max\b/i.test(value)) {
    return { pace: 'packed' };
  }

  if (/\bmoderate|balanced|normal|medium\b/i.test(value)) {
    return { pace: 'moderate' };
  }

  return null;
}

function getPaceLabel(value: TripPace): string {
  if (value === 'packed') {
    return 'Packed';
  }

  if (value === 'relaxed') {
    return 'Relaxed';
  }

  return 'Balanced';
}

function parseTravelPartyReply(value: string): ItineraryBuildDraftDefaults | null {
  const normalized = value.toLowerCase();
  const explicitMatch = normalized.match(/\b(\d{1,2})\s*(?:people|person|travelers?|friends?|adults?|kids?)\b/);
  const groupOfMatch = normalized.match(/\b(?:group|family|party|crew)\s+of\s+(\d{1,2})\b/);
  const parsed = Number(explicitMatch?.[1] ?? groupOfMatch?.[1]);
  if (Number.isFinite(parsed) && parsed >= 1 && parsed <= 20) {
    return { groupSize: parsed };
  }

  if (/\bsolo|alone|just me\b/.test(normalized)) {
    return { groupSize: 1 };
  }

  if (/\bcouple|pair|partner|date|two of us\b/.test(normalized)) {
    return { groupSize: 2 };
  }

  if (/\bfamily|group|friends\b/.test(normalized)) {
    return { groupSize: 4 };
  }

  return null;
}

function parseBriefReplyForKey(value: string, key: BriefQuestionKey): ItineraryBuildDraftDefaults | null {
  if (key === 'duration') {
    return parseDurationReply(value);
  }

  if (key === 'interests') {
    return parseInterestReply(value);
  }

  if (key === 'pace') {
    return parsePaceReply(value);
  }

  if (key === 'travelParty') {
    return parseTravelPartyReply(value);
  }

  return null;
}

function hasItineraryBuildDefaults(defaults: ItineraryBuildDraftDefaults): boolean {
  return Boolean(
    defaults.startDate ||
    defaults.endDate ||
    normalizeDurationDays(defaults.durationDays) !== null ||
    defaults.interests?.length ||
    defaults.pace ||
    (Number.isFinite(defaults.groupSize) && Number(defaults.groupSize) > 0),
  );
}

function extractItineraryBuildDefaultsFromPrompt(value: string): ItineraryBuildDraftDefaults {
  const defaults = [
    parseExplicitDurationPrompt(value),
    parseExplicitInterestDefaultsFromPrompt(value),
    parsePaceReply(value),
    parseTravelPartyReply(value),
  ]
    .filter((candidate): candidate is ItineraryBuildDraftDefaults => Boolean(candidate));

  return defaults.reduce<ItineraryBuildDraftDefaults>(
    (mergedDefaults, nextDefaults) => mergeItineraryBuildDefaults(mergedDefaults, nextDefaults),
    {},
  );
}

function buildAssumptionSummary(defaults: ItineraryBuildDraftDefaults): string[] {
  const summary: string[] = [];
  if (defaults.startDate && defaults.endDate) {
    const days = getBuildDefaultsDurationDays(defaults);
    summary.push(days ? `${days} days` : `${defaults.startDate} to ${defaults.endDate}`);
  } else if (normalizeDurationDays(defaults.durationDays)) {
    const days = normalizeDurationDays(defaults.durationDays) as number;
    summary.push(`${days} day${days === 1 ? '' : 's'}`);
  }

  if (defaults.interests?.length) {
    summary.push(`${formatList(defaults.interests.map(getInterestLabel).filter(Boolean))} interests`);
  }

  if (defaults.pace) {
    summary.push(`${getPaceLabel(defaults.pace)} pace`);
  }

  if (defaults.groupSize) {
    summary.push(formatTravelPartyLabel(defaults.groupSize));
  }

  return summary;
}

function buildRoutePromptWithDefaults(originalPrompt: string, defaults: ItineraryBuildDraftDefaults): string {
  const assumptions = buildAssumptionSummary(defaults);
  return assumptions.length
    ? `${originalPrompt}\nSmart defaults from follow-up: ${assumptions.join('; ')}.`
    : originalPrompt;
}

function getEffectiveInterestPreferences(): SpotCategory[] {
  return mergeInterestPreferences(props.draft.interests, readUserMemory()?.recentStableInterests);
}

function getRouteBuildSuggestion(route: string): string {
  const missingKeys = getMissingItineraryBriefQuestions().map((question) => question.key);
  const descriptors: string[] = [];
  const durationDays = getTripDurationDays();

  if (missingKeys.includes('duration') && durationDays === 1) {
    descriptors.push('1-day');
  }

  if (missingKeys.includes('interests')) {
    descriptors.push('balanced');
  }

  return descriptors.length
    ? `Build a ${descriptors.join(' ')} itinerary from ${route}`
    : `Build the itinerary from ${route}`;
}

function getPlannerStateLabel(): string {
  const start = formatRouteEndpointLabel(props.draft.destination);
  const end = formatRouteEndpointLabel(props.draft.endDestination);

  if (start && end) {
    return props.stops.length
      ? 'Route ready with stops selected.'
      : 'Route ready with start and end selected.';
  }

  if (start) {
    return 'Start selected; final destination needed next.';
  }

  if (end) {
    return 'Final destination selected; start can be added when ready.';
  }

  return 'Blank route; start or final destination can be added first.';
}

function isRouteBuildSynced(): boolean {
  return Boolean(routeLabel.value && lastSuccessfulRouteActionSignature.value === buildRouteActionSignature('build'));
}

function getBestNextMoveSuggestion(context: FollowUpIntentContext | null): string {
  const start = formatRouteEndpointLabel(props.draft.destination);
  const end = formatRouteEndpointLabel(props.draft.endDestination);
  const route = start && end ? routeLabel.value : '';
  const budget = budgetLabel.value === 'Set budget' ? 'the budget' : budgetLabel.value;
  const searchLabel = getRouteSearchLabel();
  const routeBuildSuggestion = route ? getRouteBuildSuggestion(route) : '';
  const lastAssistantMessage = [...messages.value].reverse().find((message) => message.role === 'assistant');

  if (lastAssistantMessage?.kind === 'error') {
    return routeBuildSuggestion || primarySuggestion.value;
  }

  if (context?.kind === 'budget') {
    return props.stops.length
      ? 'Check timing before adding paid stops'
      : `Find free or low-cost stops ${searchLabel}`;
  }

  if (context?.kind === 'timing') {
    return routeBuildSuggestion || `Pick a departure window for ${getDateLabel(props.draft.startDate, props.draft.endDate) || 'the selected dates'}`;
  }

  if (context?.kind === 'places' || context?.kind === 'food') {
    return props.stops.length
      ? 'Check whether this stop fits timing'
      : `Find food ${searchLabel}`;
  }

  if (context?.kind === 'location') {
    return start ? 'Use this as the final destination' : 'Use this as the start point';
  }

  if (context?.kind === 'appHelp') {
    return route ? 'Show me how to build this itinerary' : 'Show me how to add a start place';
  }

  if (context?.kind === 'tighten') {
    return routeBuildSuggestion || 'Explain the cleanest next step for this route';
  }

  if (context?.kind === 'weather') {
    return 'Find indoor backup stops';
  }

  if (context?.kind === 'safety') {
    return 'Check daylight arrival timing';
  }

  if (context?.kind === 'group') {
    return `Keep the group inside ${budget}`;
  }

  if (context?.kind === 'image') {
    return 'Use this image to pick a stop';
  }

  if (context?.kind === 'startCity') {
    return end ? 'Check first-leg timing' : 'Help me choose the end point too';
  }

  if (context?.kind === 'weekend' || context?.kind === 'build') {
    return isRouteBuildSynced()
      ? 'Tighten the built itinerary'
      : routeBuildSuggestion || primarySuggestion.value;
  }

  if (route) {
    if (isRouteBuildSynced()) {
      return props.stops.length ? 'Tighten the built itinerary' : 'Explain why this itinerary is shaped this way';
    }

    if (props.stops.length > 1) {
      return `Tighten ${props.stops.length} stops before building`;
    }

    return routeBuildSuggestion;
  }

  if (start) {
    return `Help me choose an end point from ${start}`;
  }

  if (end) {
    return `Help me choose a start point for ${end}`;
  }

  return 'Show me how to add a start place';
}

function buildBlankRouteSuggestionPool(interestList: string): string[] {
  return [
    interestList ? `Suggest starter regions for a ${interestList} trip` : 'Help me choose a strong start city',
    'Show me how to add a start place',
    'What should I do next on this planner?',
    interestList ? `Compare easy departure cities for ${interestList}` : 'Compare easy departure cities',
    'Pick a start on the map',
    'Build a balanced first draft',
    'Suggest a simple weekend direction',
  ];
}

function buildSuggestionPool(): string[] {
  const start = formatRouteEndpointLabel(props.draft.destination);
  const end = formatRouteEndpointLabel(props.draft.endDestination);
  const interestPreferences = getEffectiveInterestPreferences();
  const primaryInterest = getInterestLabel(interestPreferences[0]) || 'local';
  const interestList = formatList(interestPreferences.map(getInterestLabel).filter(Boolean));
  const dateLabel = getDateLabel(props.draft.startDate, props.draft.endDate);
  const stopCount = props.stops.length;
  const budget = budgetLabel.value === 'Set budget' ? '' : budgetLabel.value;
  const pace = paceLabel.value.toLowerCase();
  const pool: string[] = [];

  if (start && end) {
    pool.push(`Find a ${primaryInterest} stop between ${start} and ${end}`);
    pool.push(`Check whether ${start} to ${end} works at a ${pace} pace`);
  } else if (start) {
    pool.push(`Help me choose an end point from ${start}`);
    pool.push(`Find ${primaryInterest} stops near ${start}`);
    pool.push(`Shape a route that starts from ${start}`);
  } else if (end) {
    pool.push(`Help me choose a start point for ${end}`);
    pool.push(`Find ${primaryInterest} stops near ${end}`);
    pool.push(`Shape a route that ends at ${end}`);
  } else {
    pool.push(...buildBlankRouteSuggestionPool(interestList));
  }

  if (stopCount) {
    pool.push(`Rebalance these ${stopCount} stop${stopCount === 1 ? '' : 's'} for a ${pace} pace`);
    pool.push(`Tell me what this route is missing after stop ${stopCount}`);
  }

  if (budget) {
    pool.push(`Keep this plan inside ${budget}`);
  }

  if (interestList) {
    pool.push(`Build the day around ${interestList}`);
  }

  if (dateLabel) {
    pool.push(`Check the timing for ${dateLabel}`);
  }

  if (start || end) {
    pool.push(start ? `Find a coffee or scenic stop near ${start}` : `Find a coffee or scenic stop near ${end}`);
  }
  if (routeLabel.value) {
    pool.push(getRouteBuildSuggestion(routeLabel.value));
  }
  if (routeLabel.value) {
    pool.push('Explain the cleanest next step for this route');
  }

  return [...new Set(pool)];
}

function buildPlannerStateRankedSuggestionPool(): string[] {
  const start = formatRouteEndpointLabel(props.draft.destination);
  const end = formatRouteEndpointLabel(props.draft.endDestination);
  const route = start && end ? routeLabel.value : '';
  const interestPreferences = getEffectiveInterestPreferences();
  const primaryInterest = getInterestLabel(interestPreferences[0]) || 'local';
  const interestList = formatList(interestPreferences.map(getInterestLabel).filter(Boolean));
  const dateLabel = getDateLabel(props.draft.startDate, props.draft.endDate);
  const budget = budgetLabel.value === 'Set budget' ? '' : budgetLabel.value;
  const pace = paceLabel.value.toLowerCase();
  const stopCount = props.stops.length;
  const pool: string[] = [];

  if (route) {
    pool.push(getRouteBuildSuggestion(route));
    if (interestList) {
      pool.push(`Build the day around ${interestList}`);
    }
    if (dateLabel) {
      pool.push(`Check the timing for ${dateLabel}`);
    }
    pool.push(`Check whether ${start} to ${end} works at a ${pace} pace`);
    if (stopCount) {
      pool.push(`Rebalance these ${stopCount} stop${stopCount === 1 ? '' : 's'} for a ${pace} pace`);
      pool.push(`Tell me what this route is missing after stop ${stopCount}`);
    }
    if (budget) {
      pool.push(`Keep this plan inside ${budget}`);
    }
    pool.push(`Find a ${primaryInterest} stop between ${start} and ${end}`);
    pool.push(`Find a coffee or scenic stop near ${start}`);
    pool.push('Explain the cleanest next step for this route');
    return pool;
  }

  if (start) {
    pool.push(`Help me choose an end point from ${start}`);
    if (interestList) {
      pool.push(`Find ${primaryInterest} stops near ${start}`);
    }
    if (dateLabel) {
      pool.push(`Check the timing for ${dateLabel}`);
    }
    if (budget) {
      pool.push(`Keep this plan inside ${budget}`);
    }
    pool.push(`Shape a route that starts from ${start}`);
    pool.push(`Find a coffee or scenic stop near ${start}`);
    return pool;
  }

  if (end) {
    pool.push(`Help me choose a start point for ${end}`);
    if (interestList) {
      pool.push(`Find ${primaryInterest} stops near ${end}`);
    }
    if (dateLabel) {
      pool.push(`Check the timing for ${dateLabel}`);
    }
    if (budget) {
      pool.push(`Keep this plan inside ${budget}`);
    }
    pool.push(`Shape a route that ends at ${end}`);
    return pool;
  }

  pool.push(...buildBlankRouteSuggestionPool(interestList));
  if (budget) {
    pool.push(`Keep this plan inside ${budget}`);
  }
  if (dateLabel) {
    pool.push(`Check the timing for ${dateLabel}`);
  }

  return pool;
}

function normalizeSuggestionKey(suggestion: string): string {
  return suggestion
    .replace(/\s+/g, ' ')
    .replace(/[?!.\s]+$/g, '')
    .trim()
    .toLowerCase();
}

function mergeUniqueSuggestions(...groups: string[][]): string[] {
  const suggestions: string[] = [];
  const seen = new Set<string>();

  groups.flat().forEach((suggestion) => {
    const normalized = suggestion.replace(/\s+/g, ' ').trim();
    const key = normalizeSuggestionKey(normalized);
    if (!normalized || seen.has(key)) {
      return;
    }

    seen.add(key);
    suggestions.push(normalized);
  });

  return suggestions;
}

function buildPendingBriefContinuationSuggestions(pendingBrief: PendingItineraryBrief | null): string[] {
  return pendingBrief ? buildPendingBriefSuggestions(pendingBrief) : [];
}

function buildTopSuggestions(...groups: string[][]): string[] {
  return mergeUniqueSuggestions(
    ...groups,
    buildPlannerStateRankedSuggestionPool(),
    buildSuggestionPool(),
    [primarySuggestion.value],
  ).slice(0, MAX_SUGGESTIONS);
}

function getRouteSearchLabel(): string {
  return routeLabel.value ? 'along this route' : 'near the trip';
}

function buildIntentFollowUpPool(context: FollowUpIntentContext | null): string[] {
  if (!context) {
    return [];
  }

  const budget = budgetLabel.value === 'Set budget' ? 'the budget' : budgetLabel.value;
  const dateLabel = getDateLabel(props.draft.startDate, props.draft.endDate) || 'the selected dates';
  const start = formatRouteEndpointLabel(props.draft.destination);
  const end = formatRouteEndpointLabel(props.draft.endDestination);
  const route = start && end ? routeLabel.value : '';
  const searchLabel = getRouteSearchLabel();

  if (context.kind === 'budget') {
    return [
      `Split ${budget} across fuel, food, and stops`,
      `Find free or low-cost stops ${searchLabel}`,
      'Check timing before adding paid stops',
    ];
  }

  if (context.kind === 'timing') {
    return [
      `Pick a departure window for ${dateLabel}`,
      'Find one practical midpoint stop',
      'Check budget against the timing plan',
    ];
  }

  if (context.kind === 'places' || context.kind === 'food') {
    return [
      `Find coffee ${searchLabel}`,
      `Find food ${searchLabel}`,
      'Check whether this stop fits timing',
    ];
  }

  if (context.kind === 'location') {
    return [
      'Use this as the start point',
      'Use this as the final destination',
      'Find stops near this place',
    ];
  }

  if (context.kind === 'appHelp') {
    return [
      'Show me how to add a start place',
      'Where do I attach an image?',
      'Explain this planner screen',
    ];
  }

  if (context.kind === 'tighten') {
    return [
      'Remove weak stops from this route',
      'Check timing after tightening',
      route ? `Build the itinerary from ${route}` : 'Build the itinerary',
    ];
  }

  if (context.kind === 'weather') {
    return [
      `Check weather risk for ${dateLabel}`,
      'Find indoor backup stops',
      'Adjust timing around weather',
    ];
  }

  if (context.kind === 'safety') {
    return [
      'Check daylight arrival timing',
      'Find safer practical stops',
      'Avoid late-night detours',
    ];
  }

  if (context.kind === 'group') {
    return [
      'Make this easier for a group',
      'Find group-friendly food stops',
      `Keep the group inside ${budget}`,
    ];
  }

  if (context.kind === 'image') {
    return [
      'Review another trip image',
      'Use this image to pick a stop',
      'Tell me what detail to look for',
    ];
  }

  if (context.kind === 'startCity') {
    return [
      'Compare another start city',
      route ? 'Check the end point against this start' : 'Help me choose the end point too',
      'Check first-leg timing',
      `Keep the start inside ${budget}`,
    ];
  }

  if (context.kind === 'weekend' || context.kind === 'build') {
    return [
      route ? `Build the itinerary from ${route}` : 'Build the itinerary',
      'Check timing before building',
      `Keep this plan inside ${budget}`,
    ];
  }

  return [];
}

const primarySuggestion = computed(() => {
  const start = formatRouteEndpointLabel(props.draft.destination);
  const end = formatRouteEndpointLabel(props.draft.endDestination);

  if (start && end) {
    return getRouteBuildSuggestion(routeLabel.value);
  }

  if (start) {
    return `Help me choose an end point from ${start}`;
  }

  if (end) {
    return `Help me choose a start point for ${end}`;
  }

  return 'Help me choose start and end points';
});

const suggestions = computed(() => {
  if (props.scopeAiStore && scopeAiStructuredSuggestions.value.length) {
    return scopeAiStructuredSuggestions.value.slice(0, MAX_SUGGESTIONS);
  }

  const pendingBrief = pendingItineraryBrief.value;
  if (pendingBrief && (!lastFollowUpIntent.value || lastFollowUpIntent.value.kind === 'build' || lastFollowUpIntent.value.kind === 'weekend')) {
    return buildPendingBriefContinuationSuggestions(pendingBrief).slice(0, MAX_SUGGESTIONS);
  }

  const intentSuggestions = buildIntentFollowUpPool(lastFollowUpIntent.value);
  if (intentSuggestions.length) {
    const pendingSuggestions = buildPendingBriefContinuationSuggestions(pendingBrief);
    if (pendingSuggestions.length) {
      return buildTopSuggestions(
        intentSuggestions.slice(0, 2),
        pendingSuggestions.slice(0, 1),
        [getBestNextMoveSuggestion(lastFollowUpIntent.value)],
        intentSuggestions.slice(2),
      );
    }

    return buildTopSuggestions(
      [getBestNextMoveSuggestion(lastFollowUpIntent.value)],
      intentSuggestions,
    );
  }

  if (pendingBrief) {
    return buildPendingBriefContinuationSuggestions(pendingBrief).slice(0, MAX_SUGGESTIONS);
  }

  const leadSuggestion = getBestNextMoveSuggestion(lastFollowUpIntent.value);
  return buildTopSuggestions([leadSuggestion]);
});

function structureAssistantContent(content: string): StructuredResponseSection[] {
  const lines = content
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  if (!lines.length) {
    return [{ title: '', body: '', items: [] }];
  }

  const sections: StructuredResponseSection[] = [];
  let currentSection: StructuredResponseSection | null = null;

  const addSection = (title: string, body = ''): StructuredResponseSection => {
    const section = { title, body, items: [] };
    sections.push(section);
    currentSection = section;
    return section;
  };

  const getSection = (title = ''): StructuredResponseSection => currentSection ?? addSection(title);

  lines.forEach((line) => {
    const bulletMatch = line.match(/^[-*]\s+(.+)$/);
    if (bulletMatch?.[1]) {
      getSection().items.push(bulletMatch[1]);
      return;
    }

    const numberedMatch = line.match(/^\d+\.\s+(.+)$/);
    if (numberedMatch?.[1]) {
      getSection().items.push(numberedMatch[1]);
      return;
    }

    const headingWithBody = line.match(/^([A-Z][A-Za-z0-9 /&'-]{1,32}):\s+(.+)$/);
    if (headingWithBody?.[1] && headingWithBody[2]) {
      addSection(headingWithBody[1], headingWithBody[2]);
      return;
    }

    const headingOnly = line.match(/^([A-Z][A-Za-z0-9 /&'-]{1,32}):$/);
    if (headingOnly?.[1]) {
      addSection(headingOnly[1]);
      return;
    }

    const section = getSection(sections.length ? 'Details' : '');
    if (section.body) {
      section.items.push(line);
    } else {
      section.body = line;
    }
  });

  return sections;
}

function formatRouteEndpointLabel(value: string | undefined): string {
  const parts = (value ?? '').split(',').map((part) => part.trim()).filter(Boolean);
  if (!parts.length) {
    return '';
  }

  const [primary = '', locality = ''] = parts;
  return locality ? `${primary}, ${locality}` : primary;
}

function getInterestLabel(value: SpotCategory | undefined): string {
  const labels: Partial<Record<SpotCategory, string>> = {
    adventure: 'adventure',
    culture: 'culture',
    food: 'food',
    nature: 'nature',
    nightlife: 'nightlife',
    entertainment: 'entertainment',
    scenic: 'scenic',
    shopping: 'shopping',
    other: 'local finds',
  };

  return value ? labels[value] ?? '' : '';
}

function formatList(values: string[]): string {
  if (values.length <= 1) {
    return values[0] ?? '';
  }

  if (values.length === 2) {
    return `${values[0]} and ${values[1]}`;
  }

  return `${values.slice(0, -1).join(', ')}, and ${values[values.length - 1]}`;
}

function getDateLabel(startDate: string, endDate: string): string {
  if (!startDate || !endDate) {
    return '';
  }

  return startDate === endDate ? startDate : `${startDate} to ${endDate}`;
}

function resolveSupportedScopeAiImageMimeType(file: File): string | null {
  const mimeType = file.type.trim().toLowerCase();
  if (SUPPORTED_SCOPE_AI_IMAGE_MIME_TYPES.has(mimeType)) {
    return mimeType;
  }

  if (/\.jpe?g$/i.test(file.name)) {
    return 'image/jpeg';
  }
  if (/\.png$/i.test(file.name)) {
    return 'image/png';
  }
  if (/\.webp$/i.test(file.name)) {
    return 'image/webp';
  }

  return null;
}

function isImageFile(file: File): boolean {
  return Boolean(resolveSupportedScopeAiImageMimeType(file)) && file.size <= MAX_SCOPE_AI_IMAGE_ATTACHMENT_BYTES;
}

function createAttachmentPreviewUrl(file: File): string {
  if (typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') {
    return '';
  }

  return URL.createObjectURL(file);
}

function revokeAttachmentPreview(attachment: ChatAttachment): void {
  if (!attachment.previewUrl || typeof URL === 'undefined' || typeof URL.revokeObjectURL !== 'function') {
    return;
  }

  URL.revokeObjectURL(attachment.previewUrl);
}

function readImageFileAsBase64(file: File): Promise<string | undefined> {
  if (typeof FileReader === 'undefined') {
    return Promise.resolve(undefined);
  }

  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      resolve(result.includes(',') ? result.split(',').pop() || undefined : result || undefined);
    };
    reader.onerror = () => resolve(undefined);
    reader.readAsDataURL(file);
  });
}

async function buildChatAttachment(file: File): Promise<ChatAttachment> {
  const mimeType = resolveSupportedScopeAiImageMimeType(file) ?? file.type;
  return {
    id: createMessageId('image'),
    base64Data: await readImageFileAsBase64(file),
    name: file.name || 'Attached image',
    previewUrl: createAttachmentPreviewUrl(file),
    size: file.size,
    type: mimeType || 'image',
  };
}

function openAttachmentPicker(): void {
  if (loading.value) {
    return;
  }

  attachmentInput.value?.click();
}

async function handleAttachmentChange(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement;
  const remainingSlots = Math.max(0, MAX_IMAGE_ATTACHMENTS - pendingAttachments.value.length);
  const imageFiles = Array.from(input.files ?? [])
    .filter(isImageFile)
    .slice(0, remainingSlots);

  if (imageFiles.length) {
    const attachments = await Promise.all(imageFiles.map(buildChatAttachment));
    pendingAttachments.value = [
      ...pendingAttachments.value,
      ...attachments,
    ];
  }

  input.value = '';
}

function removePendingAttachment(attachmentId: string): void {
  const attachment = pendingAttachments.value.find((item) => item.id === attachmentId);
  if (attachment) {
    revokeAttachmentPreview(attachment);
  }

  pendingAttachments.value = pendingAttachments.value.filter((item) => item.id !== attachmentId);
}

function getDefaultAttachmentPrompt(attachments: ChatAttachment[]): string {
  return attachments.length === 1 ? 'Review this image for my trip.' : 'Review these images for my trip.';
}

function buildPromptWithAttachmentContext(userPrompt: string, attachments: ChatAttachment[]): string {
  if (!attachments.length) {
    return userPrompt;
  }

  const imageSummary = attachments
    .map((attachment, index) => `${index + 1}. ${attachment.name}`)
    .join('\n');

  return [
    userPrompt,
    `Attached images:\n${imageSummary}`,
    'Use the image context if the vision-enabled Scope agent is available. If image analysis is unavailable, say what extra detail you need from the traveler.',
  ].join('\n\n');
}

function buildScopeAiImagePayload(attachments: ChatAttachment[]) {
  return attachments
    .filter((attachment) => (
      attachment.base64Data &&
      SUPPORTED_SCOPE_AI_IMAGE_MIME_TYPES.has(attachment.type) &&
      attachment.size <= MAX_SCOPE_AI_IMAGE_ATTACHMENT_BYTES
    ))
    .slice(0, MAX_IMAGE_ATTACHMENTS)
    .map((attachment) => ({
      filename: attachment.name,
      mime_type: attachment.type,
      data: attachment.base64Data as string,
    }));
}

function buildDraftContextLines(): string[] {
  const draft = props.draft;
  const title = props.tripTitle.trim();
  const startDestination = draft.destination.trim();
  const endDestination = draft.endDestination?.trim() ?? '';
  const budgetFloor = formatCurrency(draft.budgetFloor);
  const budgetCeiling = formatCurrency(draft.budget);
  const budget = [budgetFloor, budgetCeiling].filter(Boolean).join(' - ');
  const durationDays = getTripDurationDays();
  const travelParty = formatTravelPartyLabel(draft.groupSize);
  const stops = props.stops.map((stop, index) => {
    const meta = [
      'type: stop',
      stop.category ? `category: ${stop.category}` : '',
      stop.city ? `city: ${stop.city}` : '',
      stop.dayNumber ? `day: ${stop.dayNumber}` : '',
    ].filter(Boolean).join(', ');
    return `${index + 1}. ${stop.title}${meta ? ` (${meta})` : ''}`;
  });

  return [
    title ? `Title: ${title}` : '',
    startDestination ? `Start: ${startDestination}` : '',
    endDestination ? `End: ${endDestination}` : '',
    `Dates: ${draft.startDate} to ${draft.endDate}`,
    durationDays ? `Trip duration: ${durationDays} day${durationDays === 1 ? '' : 's'}` : '',
    budget ? `Budget: ${budget}` : '',
    `Pace: ${draft.pace}`,
    `Travelers: ${draft.groupSize}`,
    travelParty ? `Travel party: ${travelParty}` : '',
    `Planner state: ${getPlannerStateLabel()}`,
    draft.interests.length ? `Interests: ${draft.interests.join(', ')}` : '',
    `Existing stops on canvas: ${stops.length ? `${stops.length} stop${stops.length === 1 ? '' : 's'}` : 'none'}`,
    stops.length ? `Stops:\n${stops.join('\n')}` : '',
  ].filter(Boolean);
}

function normalizeChatContextLine(value: string): string {
  const normalized = value.replace(/\s+/g, ' ').trim();
  return normalized.length > 360 ? `${normalized.slice(0, 357)}...` : normalized;
}

type ScopeAiDetailPreference = 'concise' | 'balanced' | 'detailed';

interface ScopeAiUserMemory {
  detailPreference: ScopeAiDetailPreference;
  recentStableInterests?: SpotCategory[];
  updatedAt: number;
}

const VALID_SPOT_CATEGORIES = new Set<SpotCategory>([
  'adventure',
  'culture',
  'food',
  'nature',
  'nightlife',
  'entertainment',
  'scenic',
  'shopping',
  'other',
]);

function getUserMemoryStorageKey(userId: string | undefined): string {
  return `scope.ai.memory.v1:${userId?.trim() || 'anonymous'}`;
}

function safeJsonParse<T>(value: string): T | null {
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function isSpotCategory(value: unknown): value is SpotCategory {
  return typeof value === 'string' && VALID_SPOT_CATEGORIES.has(value as SpotCategory);
}

function mergeInterestPreferences(...groups: Array<SpotCategory[] | undefined>): SpotCategory[] {
  const merged: SpotCategory[] = [];
  const seen = new Set<SpotCategory>();

  groups.flatMap((group) => group ?? []).forEach((interest) => {
    if (!isSpotCategory(interest) || seen.has(interest)) {
      return;
    }

    seen.add(interest);
    merged.push(interest);
  });

  return merged.slice(0, 6);
}

function readUserMemory(): ScopeAiUserMemory | null {
  if (typeof window === 'undefined' || !window.localStorage) {
    return null;
  }

  if (consent.value !== 'granted') {
    return null;
  }

  const raw = window.localStorage.getItem(getUserMemoryStorageKey(props.userId));
  const parsed = raw ? safeJsonParse<ScopeAiUserMemory>(raw) : null;
  if (!parsed || typeof parsed !== 'object') {
    return null;
  }

  const detail = parsed.detailPreference;
  const detailPreference: ScopeAiDetailPreference =
    detail === 'concise' || detail === 'detailed' || detail === 'balanced' ? detail : 'balanced';

  const interests = Array.isArray(parsed.recentStableInterests)
    ? parsed.recentStableInterests.filter(isSpotCategory)
    : undefined;

  return {
    detailPreference,
    recentStableInterests: interests?.length ? interests.slice(0, 6) : undefined,
    updatedAt: Number.isFinite(parsed.updatedAt) ? Number(parsed.updatedAt) : Date.now(),
  };
}

function inferDetailPreferenceFromPrompt(value: string): ScopeAiDetailPreference | null {
  if (/\b(keep it short|short version|tl\s*;?\s*dr|tldr|brief|quick answer|just the basics|be concise)\b/i.test(value)) {
    return 'concise';
  }
  if (/\b(more detail|detailed|deep dive|go deep|explain thoroughly|step by step|be thorough)\b/i.test(value)) {
    return 'detailed';
  }
  if (/\b(balance(?:d)?|medium detail|normal detail)\b/i.test(value)) {
    return 'balanced';
  }
  return null;
}

function writeUserMemory(update: Partial<ScopeAiUserMemory>): void {
  if (typeof window === 'undefined' || !window.localStorage) {
    return;
  }

  if (consent.value !== 'granted') {
    return;
  }

  const key = getUserMemoryStorageKey(props.userId);
  const current = readUserMemory() ?? { detailPreference: 'balanced' as const, updatedAt: Date.now() };
  const next: ScopeAiUserMemory = {
    detailPreference: update.detailPreference ?? current.detailPreference,
    recentStableInterests: mergeInterestPreferences(update.recentStableInterests, current.recentStableInterests),
    updatedAt: Date.now(),
  };

  try {
    window.localStorage.setItem(key, JSON.stringify(next));
  } catch {
    // Ignore quota / storage errors.
  }
}

function buildRecentChatContext(currentUserPrompt: string): string[] {
  const normalizedCurrentPrompt = normalizeChatContextLine(currentUserPrompt).toLowerCase();
  const priorMessages = [...messages.value];
  const lastMessage = priorMessages.at(-1);

  if (lastMessage?.role === 'user') {
    const lastResolvedContent = normalizeChatContextLine(resolveMessageContentForTraining(lastMessage)).toLowerCase();
    const lastUserContent = normalizeChatContextLine(lastMessage.content).toLowerCase();

    if (
      lastResolvedContent === normalizedCurrentPrompt
      || normalizedCurrentPrompt.startsWith(lastUserContent)
    ) {
      priorMessages.pop();
    }
  }

  return priorMessages
    .slice(-RECENT_CHAT_CONTEXT_LIMIT)
    .map((message) => {
      const content = normalizeChatContextLine(resolveMessageContentForTraining(message));
      if (!content) {
        return '';
      }

      return `${message.role === 'user' ? 'User' : 'Scope AI'}: ${content}`;
    })
    .filter(Boolean);
}

function buildAssistantPrompt(userPrompt: string): string {
  const context = buildDraftContextLines();
  const recentChat = buildRecentChatContext(userPrompt);
  const memory = readUserMemory();
  return [
    'Help refine this Scope trip draft.',
    'Use the system rules plus the structured planner context below. Do not ask for anything already present in Planner context or Recent chat.',
    'Planning quality contract: extract route, dates, duration, interests, pace, budget, travelers, existing stops, and hard constraints before answering. Ask one concise follow-up only when an essential field is missing.',
    'When enough context exists, give a concise plan with day-by-day anchors, timing/budget guardrails, and the next concrete action. Do not invent exact venues, hours, ticket prices, or drive times; use provider/tool results for exact claims and label anything else as an estimate to verify.',
    memory
      ? `User memory:\n- Detail preference: ${memory.detailPreference}\n${memory.recentStableInterests?.length ? `- Stable interests: ${memory.recentStableInterests.join(', ')}` : ''}`.trim()
      : '',
    context.length ? `Planner context:\n${context.join('\n')}` : 'Planner context: blank.',
    recentChat.length ? `Recent chat:\n${recentChat.join('\n')}` : '',
    `Traveler request: ${userPrompt}`,
  ].filter(Boolean).join('\n\n');
}

function hasCoordinatePair(latitude: number | undefined, longitude: number | undefined): boolean {
  return Number.isFinite(latitude) && Number.isFinite(longitude);
}

function cleanupEndpointAnchorQuery(value: string | undefined): string | null {
  const cleaned = String(value ?? '')
    .replace(/^(?:from|near|around|after|starting\s+from)\s+/i, '')
    .replace(/\b(?:please|pls)\b/gi, ' ')
    .replace(/[?!.\s]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  return cleaned.length >= 2 ? cleaned : null;
}

function isCurrentEndpointAnchorReference(value: string | null): boolean {
  const normalized = normalizeActionLookupValue(value ?? '');
  return /^(?:here|there|this|that|me|my location|current|current start|start|the start|my start|route start|origin|nearby)$/.test(normalized);
}

function inferEndpointPreference(value: string): EndpointRecommendationIntent['preference'] {
  if (/\b(scenic|view|overlook|photo|nature|park|landmark)\b/i.test(value)) {
    return 'scenic';
  }

  if (/\b(practical|easy|safe|hotel|stay|fuel|gas|food|restroom|essentials|nearby)\b/i.test(value)) {
    return 'practical';
  }

  return 'balanced';
}

function extractEndpointRecommendationIntent(value: string): EndpointRecommendationIntent | null {
  const normalizedPrompt = value.replace(/[?!.\s]+$/g, '').trim();
  if (!normalizedPrompt) {
    return null;
  }

  if (/\b(how|where is the|what button|which button|click|tap|disabled|route canvas|add\s+(?:a\s+|an\s+|the\s+)?end)\b/i.test(normalizedPrompt)) {
    return null;
  }

  const endTargetPattern = String.raw`(?:end\s*point|endpoint|end\s+place|end\s+city|destination|final\s+destination|finish(?:ing)?\s+(?:place|point|city)?)`;
  const explicitAnchorPatterns = [
    new RegExp(String.raw`\b(?:help\s+me\s+)?(?:choose|pick|suggest|recommend|find)\s+(?:a\s+|an\s+|the\s+)?(?:good\s+|best\s+|strong\s+|practical\s+|scenic\s+)?${endTargetPattern}\s+(?:from|near|around|after|starting\s+from)\s+(.+)$`, 'i'),
    new RegExp(String.raw`\bwhere\s+should\s+(?:i|we)\s+(?:end|finish|go|head)\s+(?:from|near|around|after|starting\s+from)\s+(.+)$`, 'i'),
    new RegExp(String.raw`\b(?:suggest|recommend|find)\s+(?:some\s+)?(?:places?|ideas?)\s+to\s+(?:end|finish)\s+(?:from|near|around|after|starting\s+from)\s+(.+)$`, 'i'),
  ];

  for (const pattern of explicitAnchorPatterns) {
    const anchorQuery = cleanupEndpointAnchorQuery(normalizedPrompt.match(pattern)?.[1]);
    if (anchorQuery) {
      return {
        target: 'endDestination',
        anchorQuery: isCurrentEndpointAnchorReference(anchorQuery) ? null : anchorQuery,
        preference: inferEndpointPreference(normalizedPrompt),
      };
    }
  }

  if (
    /\bshow\s+more\s+endpoint\s+ideas\b/i.test(normalizedPrompt) ||
    /\bfind\s+(?:practical|scenic)\s+endpoints?\b/i.test(normalizedPrompt) ||
    new RegExp(String.raw`\b(?:help\s+me\s+)?(?:choose|pick|suggest|recommend|find)\s+(?:a\s+|an\s+|the\s+)?(?:good\s+|best\s+|strong\s+|practical\s+|scenic\s+)?${endTargetPattern}\b`, 'i').test(normalizedPrompt) ||
    /\bwhere\s+should\s+(?:i|we)\s+(?:end|finish|go|head)\b/i.test(normalizedPrompt) ||
    /\b(?:what'?s|what\s+is)\s+(?:a\s+)?(?:good|best|fun|cool|nice)\s+(?:place|destination|city|spot)\s+to\s+(?:go|head|visit)(?:\s+to)?\b/i.test(normalizedPrompt) ||
    /\bwhere\s+should\s+(?:i|we)\s+go\b/i.test(normalizedPrompt) ||
    /\b(?:suggest|recommend|find|pick|choose)\s+(?:a\s+)?(?:good|best|fun|cool|nice)?\s*(?:place|destination|city)\s+to\s+(?:go|head|visit)(?:\s+to)?\b/i.test(normalizedPrompt)
  ) {
    return {
      target: 'endDestination',
      anchorQuery: null,
      preference: inferEndpointPreference(normalizedPrompt),
    };
  }

  return null;
}

function getCurrentStartAnchor(): RouteSearchAnchor | null {
  if (hasCoordinatePair(props.draft.destinationLatitude, props.draft.destinationLongitude)) {
    return {
      id: 'start',
      label: formatRouteEndpointLabel(props.draft.destination) || 'route start',
      latitude: Number(props.draft.destinationLatitude),
      longitude: Number(props.draft.destinationLongitude),
      role: 'start',
    };
  }

  return null;
}

function getPlannerLocationProximity(): RouteFallbackAnchor | null {
  if (hasCoordinatePair(props.locationSearchProximity?.latitude, props.locationSearchProximity?.longitude)) {
    return {
      label: props.locationSearchProximity?.label,
      latitude: Number(props.locationSearchProximity?.latitude),
      longitude: Number(props.locationSearchProximity?.longitude),
    };
  }

  return null;
}

function formatEndpointResolutionCandidates(resolution: ScopeAiLocationResolution): string {
  return formatScopeAiDashList(
    resolution.candidates
      .slice(0, 3)
      .map(formatScopeAiResolvedPlaceLabel)
      .filter(Boolean),
  );
}

function buildEndpointResolutionFailureMessage(intent: EndpointRecommendationIntent, resolution: ScopeAiLocationResolution): ChatMessage {
  const targetText = intent.target === 'endDestination' ? 'end point' : 'start point';
  const candidates = formatEndpointResolutionCandidates(resolution);
  const content = resolution.status === 'ambiguous'
    ? candidates
      ? `I found a few possible matches for "${resolution.query}" before I suggest a ${targetText}.\n${candidates}\nNext: Reply with a state/city, a number, or pick the exact start on the map.`
      : `I found more than one possible match for "${resolution.query}". Reply with a state/city, a number, or pick the exact start on the map before I suggest a ${targetText}.`
    : `I could not resolve "${resolution.query}" confidently, so I did not change the planner. Add a city/state or pick the start on the map and I will suggest ${targetText} ideas.`;

  return {
    id: createMessageId('assistant'),
    role: 'assistant',
    kind: 'text',
    model: 'scope-endpoint-choice',
    content,
    chips: ['Add a start place', 'Find scenic endpoints', 'Find practical endpoints'],
    pendingContext: {
      kind: 'location-resolution',
      sourcePrompt: resolution.query,
      targetField: 'start',
      rawValue: resolution.query,
      candidates: scopeAiLocationCandidateItems(
        resolution.candidates.map(formatScopeAiResolvedPlaceLabel),
      ),
      lastAnswer: content,
      createdAt: Date.now(),
      turnCount: 0,
    },
  };
}

async function resolveEndpointRecommendationAnchor(intent: EndpointRecommendationIntent): Promise<
  | { status: 'resolved'; anchor: RouteSearchAnchor; startSelection?: PlannerMapLocationSelection }
  | { status: 'message'; message: ChatMessage }
> {
  const currentStart = getCurrentStartAnchor();
  if (!intent.anchorQuery && currentStart) {
    return { status: 'resolved', anchor: currentStart };
  }

  const query = intent.anchorQuery ?? props.draft.destination.trim();
  if (!query) {
    return {
      status: 'message',
      message: {
        id: createMessageId('assistant'),
        role: 'assistant',
        kind: 'text',
        model: 'scope-endpoint-choice',
        content: 'Set a real start point first, then I can suggest endpoint ideas from that exact place.',
        chips: ['Add a start place', 'Pick start on map', 'Find scenic endpoints'],
      },
    };
  }

  if (currentStart) {
    if (isCurrentEndpointAnchorReference(query)) {
      return { status: 'resolved', anchor: currentStart };
    }

    const normalizedQuery = normalizeActionLookupValue(query);
    const normalizedStart = normalizeActionLookupValue(props.draft.destination);
    if (normalizedQuery && normalizedStart && (normalizedStart.includes(normalizedQuery) || normalizedQuery.includes(normalizedStart))) {
      return { status: 'resolved', anchor: currentStart };
    }
  }

  const proximity = getPlannerLocationProximity();
  const resolution = await resolveScopeAiLocationIntent(query, {
    limit: 3,
    ...(proximity ? { proximity } : {}),
  });

  if (resolution.status !== 'resolved' || !resolution.result) {
    return {
      status: 'message',
      message: buildEndpointResolutionFailureMessage(intent, resolution),
    };
  }

  const resolvedLabel = formatScopeAiResolvedPlaceLabel(resolution.result);
  const anchor: RouteSearchAnchor = {
    id: 'resolved-start',
    label: formatRouteEndpointLabel(resolvedLabel) || resolvedLabel,
    latitude: resolution.result.latitude,
    longitude: resolution.result.longitude,
    role: 'start',
  };
  const currentStartLabel = props.draft.destination.trim();
  const shouldSyncStart =
    !currentStart ||
    !currentStartLabel ||
    normalizeActionLookupValue(currentStartLabel) !== normalizeActionLookupValue(resolvedLabel);

  return {
    status: 'resolved',
    anchor,
    ...(shouldSyncStart ? {
      startSelection: {
        target: 'destination',
        label: resolvedLabel,
        latitude: resolution.result.latitude,
        longitude: resolution.result.longitude,
        city: resolution.result.city,
        country: resolution.result.country,
      },
    } : {}),
  };
}

function getEndpointTravelCategory(preference: EndpointRecommendationIntent['preference']): TravelNearbyCategory {
  if (preference === 'scenic') {
    return 'scenic';
  }

  if (preference === 'practical') {
    return 'stay';
  }

  return 'recommended';
}

function getEndpointNearbyCategories(preference: EndpointRecommendationIntent['preference']): readonly string[] {
  if (preference === 'scenic') {
    return ['tourist_attraction', 'park', 'museum'];
  }

  if (preference === 'practical') {
    return ['hotel', 'restaurant', 'gas_station', 'shopping', 'park'];
  }

  return ['tourist_attraction', 'park', 'museum', 'hotel', 'restaurant', 'shopping'];
}

function mapTravelNearbySuggestionToChatPlaceResult(suggestion: TravelNearbySuggestion): ChatPlaceResult {
  const providerVerified = suggestion.source === 'google';
  return {
    id: suggestion.placeId || suggestion.id,
    placeName: suggestion.title,
    formattedAddress: suggestion.address || suggestion.subtitle,
    address: suggestion.address,
    city: suggestion.anchorLabel,
    latitude: suggestion.latitude,
    longitude: suggestion.longitude,
    category: suggestion.category,
    distanceKm: suggestion.distanceKm,
    photoUrl: suggestion.photoUrl,
    source: suggestion.source === 'scope' ? 'mock' : 'mapbox',
    sourceLabel: suggestion.sourceLabel || (suggestion.source === 'scope' ? 'Scope community' : 'Google Places'),
    reason: suggestion.reason || suggestion.subtitle,
    providerVerified,
  };
}

function mapNearbyPlaceToChatPlaceResult(place: NearbyPlaceResult): ChatPlaceResult {
  const providerVerified = place.source !== 'mock';
  return {
    ...place,
    sourceLabel: place.source === 'mock' ? 'Unverified map result' : 'Map search',
    reason: place.categoryLabel ? `${place.categoryLabel} near the start` : undefined,
    providerVerified,
  };
}

function isTrustedProviderLabel(value: unknown): boolean {
  const normalized = String(value ?? '').toLowerCase();
  if (!normalized) {
    return false;
  }

  return !/\b(mock|fallback|demo|scope community|scope demo)\b/.test(normalized);
}

function isTrustedProviderPlaceResult(result: Pick<ChatPlaceResult, 'latitude' | 'longitude' | 'source' | 'sourceLabel' | 'providerVerified'>): boolean {
  if (!hasCoordinatePair(result.latitude, result.longitude)) {
    return false;
  }

  if (result.providerVerified === false) {
    return false;
  }

  if (result.providerVerified === true) {
    return true;
  }

  return result.source === 'mapbox' && isTrustedProviderLabel(result.sourceLabel || result.source);
}

function isTrustedPendingContextItem(item: ScopeAiPendingContextItem): boolean {
  if (!hasCoordinatePair(item.latitude, item.longitude)) {
    return false;
  }

  if (item.meta?.providerVerified === false) {
    return false;
  }

  if (item.meta?.providerVerified === true) {
    return true;
  }

  return (
    (item.source === undefined || isTrustedProviderLabel(item.source))
    && (item.meta?.source === undefined || isTrustedProviderLabel(item.meta.source))
  );
}

function getEndpointCandidateKey(candidate: ChatPlaceResult): string {
  return [
    candidate.id ?? '',
    candidate.placeName.toLowerCase(),
    Number(candidate.latitude).toFixed(5),
    Number(candidate.longitude).toFixed(5),
  ].join('|');
}

function getEndpointCandidateScore(candidate: ChatPlaceResult): number {
  const categoryText = [candidate.category, candidate.reason, candidate.placeName].filter(Boolean).join(' ').toLowerCase();
  const categoryScore = /\b(park|scenic|tourist|museum|hotel|restaurant|landmark|shopping|gas)\b/.test(categoryText) ? 0 : 1;
  return categoryScore * 1000 + (candidate.distanceKm ?? 999);
}

function mergeEndpointCandidates(...groups: ChatPlaceResult[][]): ChatPlaceResult[] {
  const candidates = new Map<string, ChatPlaceResult>();

  groups.flat()
    .filter((candidate) => isTrustedProviderPlaceResult(candidate))
    .forEach((candidate) => {
      const key = getEndpointCandidateKey(candidate);
      const existing = candidates.get(key);
      if (!existing || getEndpointCandidateScore(candidate) < getEndpointCandidateScore(existing)) {
        candidates.set(key, candidate);
      }
    });

  return [...candidates.values()].slice(0, ENDPOINT_RECOMMENDATION_RESULT_LIMIT);
}

async function findEndpointCandidates(
  intent: EndpointRecommendationIntent,
  anchor: RouteSearchAnchor,
  userPrompt: string,
): Promise<ChatPlaceResult[]> {
  const travelNearby = await getTravelNearbySuggestions({
    anchors: [{
      id: anchor.id,
      placeLabel: anchor.label,
      latitude: anchor.latitude,
      longitude: anchor.longitude,
      routeRole: anchor.role,
    }],
    routePoints: routeSearchAnchors.value.map((routePoint) => ({
      id: routePoint.id,
      title: routePoint.label,
      latitude: routePoint.latitude,
      longitude: routePoint.longitude,
      routeRole: routePoint.role,
    })),
    category: getEndpointTravelCategory(intent.preference),
    radiusKm: ENDPOINT_RECOMMENDATION_RADIUS_KM,
    limit: ENDPOINT_RECOMMENDATION_SEARCH_LIMIT,
    interests: props.draft.interests,
    pace: props.draft.pace,
    budgetFloor: props.draft.budgetFloor,
    budgetCeiling: props.draft.budget,
    startDate: props.draft.startDate,
    endDate: props.draft.endDate,
    latestIntent: userPrompt,
  }).then((response) => response.suggestions.map(mapTravelNearbySuggestionToChatPlaceResult)).catch(() => []);

  const nearbyPlaces = await searchNearbyPlaces({
    center: {
      latitude: anchor.latitude,
      longitude: anchor.longitude,
    },
    categories: getEndpointNearbyCategories(intent.preference),
    limit: ENDPOINT_RECOMMENDATION_SEARCH_LIMIT,
  }).then((response) => response.data.map(mapNearbyPlaceToChatPlaceResult)).catch(() => []);

  return mergeEndpointCandidates(travelNearby, nearbyPlaces);
}

function buildEndpointCandidatesContent(
  candidates: ChatPlaceResult[],
  anchor: RouteSearchAnchor,
): string {
  const hasFallback = candidates.some((candidate) => candidate.source === 'mock' || /fallback/i.test(candidate.sourceLabel ?? ''));
  const sourceNote = hasFallback
    ? ' Some results are fallback or Scope community data, so treat them as ideas to inspect before building.'
    : ' I am not setting one automatically; pick the endpoint that matches the trip.';

  return `I found ${candidates.length} endpoint idea${candidates.length === 1 ? '' : 's'} from ${anchor.label}.${sourceNote}`;
}

async function buildEndpointRecommendationMessage(
  intent: EndpointRecommendationIntent,
  userPrompt: string,
): Promise<ChatMessage> {
  const anchorResult = await resolveEndpointRecommendationAnchor(intent);
  if (anchorResult.status === 'message') {
    return anchorResult.message;
  }

  if (anchorResult.startSelection) {
    emit('map-location-select', anchorResult.startSelection);
  }

  const candidates = await findEndpointCandidates(intent, anchorResult.anchor, userPrompt);
  if (!candidates.length) {
    return {
      id: createMessageId('assistant'),
      role: 'assistant',
      kind: 'text',
      model: 'scope-endpoint-choice',
      content: `I could not find confident endpoint ideas from ${anchorResult.anchor.label} yet. Try adding a nearby city, widening the route idea, or asking for scenic or practical endpoints.`,
      chips: ['Find scenic endpoints', 'Find practical endpoints', 'Add an end place'],
    };
  }

  return {
    id: createMessageId('assistant'),
    role: 'assistant',
    kind: 'places',
    queryLabel: `Endpoint ideas from ${anchorResult.anchor.label}`,
    content: buildEndpointCandidatesContent(candidates, anchorResult.anchor),
    results: candidates,
    placeAction: intent.target === 'endDestination' ? 'set-end' : 'set-start',
    pendingContext: {
      kind: 'endpoint-candidates',
      sourcePrompt: userPrompt,
      targetField: intent.target === 'endDestination' ? 'end' : 'start',
      rawValue: anchorResult.anchor.label,
      results: candidates.map(scopeAiPlaceResultToPendingItem),
      lastAnswer: buildEndpointCandidatesContent(candidates, anchorResult.anchor),
      createdAt: Date.now(),
      turnCount: 0,
    },
  };
}

function extractWeatherQuery(value: string): string | null {
  const normalizedPrompt = value.replace(/[?!.\s]+$/g, '').trim();
  const match = normalizedPrompt.match(/\b(?:weather|forecast|rain|storm|hot|cold|wind|snow)\b(?:\s+(?:in|for|at|near|around))?\s+(.+)$/i);
  const rawQuery = match?.[1]
    ?.replace(/\[[^\]]+\]/g, ' ')
    ?.replace(/\b(?:today|tomorrow|this weekend|for the trip|on the route|for this route)\b/gi, ' ')
    .replace(/\s+(?:please|pls|thanks|for real|if that makes sense|no guessing|do not guess|don't guess)$/i, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!rawQuery || /\b(route|trip|start|end|destination|there|here)\b/i.test(rawQuery)) {
    return null;
  }

  return rawQuery.length >= 2 ? rawQuery : null;
}

function getWeatherPointFromRoute(value: string): WeatherLookupPoint | null {
  const normalized = value.toLowerCase();
  const anchors = routeSearchAnchors.value;
  const targetAnchor = /\b(end|destination|finish|arrival)\b/.test(normalized)
    ? anchors.find((anchor) => anchor.role === 'end')
    : /\b(midpoint|middle|halfway|on the way|route)\b/.test(normalized)
      ? buildRouteMidpointAnchor(anchors)
      : anchors.find((anchor) => anchor.role === 'start') ?? anchors[0];

  if (targetAnchor && hasCoordinatePair(targetAnchor.latitude, targetAnchor.longitude)) {
    return {
      label: targetAnchor.label,
      latitude: targetAnchor.latitude,
      longitude: targetAnchor.longitude,
      searchLabels: [targetAnchor.label],
    };
  }

  const fallbackLabel = formatRouteEndpointLabel(props.draft.destination) || formatRouteEndpointLabel(props.draft.endDestination);
  return fallbackLabel ? { label: fallbackLabel, searchLabels: [fallbackLabel] } : null;
}

async function resolveWeatherPoint(userPrompt: string): Promise<
  | { status: 'resolved'; point: WeatherLookupPoint }
  | { status: 'message'; message: ChatMessage }
> {
  const query = extractWeatherQuery(userPrompt);
  if (!query) {
    const routePoint = getWeatherPointFromRoute(userPrompt);
    if (routePoint) {
      return { status: 'resolved', point: routePoint };
    }

    return {
      status: 'message',
      message: buildLocalTextMessage('Add a start, end, city, or address first and I can check weather from the existing planner weather lookup.'),
    };
  }

  const resolution = await resolveScopeAiLocationIntent(query, {
    limit: 3,
    scope: 'global',
  });

  if (resolution.status !== 'resolved' || !resolution.result) {
    const candidates = formatEndpointResolutionCandidates(resolution);
    const content = candidates
      ? `I found a few possible weather locations for "${query}".\n${candidates}\nNext: Reply with a state/city, a number, or pick one on the map.`
      : `I could not resolve "${query}" confidently enough to check weather. Add a city/state or use a mapped route point.`;
    return {
      status: 'message',
      message: {
        ...buildLocalTextMessage(content),
        pendingContext: {
          kind: 'weather-location',
          sourcePrompt: userPrompt,
          targetField: 'weather',
          rawValue: query,
          candidates: scopeAiLocationCandidateItems(
            resolution.candidates.map(formatScopeAiResolvedPlaceLabel),
          ),
          lastAnswer: content,
          createdAt: Date.now(),
          turnCount: 0,
        },
      },
    };
  }

  const label = formatScopeAiResolvedPlaceLabel(resolution.result);
  return {
    status: 'resolved',
    point: {
      label,
      latitude: resolution.result.latitude,
      longitude: resolution.result.longitude,
      searchLabels: [label, query],
    },
  };
}

function formatWeatherSnapshot(snapshot: WeatherSnapshot): string {
  const temperature = Number.isFinite(snapshot.temperatureF)
    ? `${Math.round(snapshot.temperatureF)}F`
    : 'temperature unavailable';
  const wind = Number.isFinite(snapshot.windMph)
    ? `${Math.round(snapshot.windMph)} mph wind`
    : 'wind unavailable';
  const airQuality = snapshot.airQuality
    ? `, AQI ${Math.round(snapshot.airQuality.index)} ${snapshot.airQuality.label}`
    : '';
  const provider = snapshot.providerLabel || snapshot.provider || 'Scope weather';

  return `${snapshot.label}: ${temperature}, ${snapshot.condition}, ${wind}${airQuality}. Weather source: ${provider}.`;
}

async function buildScopeAiWeatherMessage(userPrompt: string): Promise<ChatMessage | null> {
  if (!/\b(weather|forecast|rain|storm|hot|cold|wind|snow)\b/i.test(userPrompt)) {
    return null;
  }

  const resolvedPoint = await resolveWeatherPoint(userPrompt);
  if (resolvedPoint.status === 'message') {
    return resolvedPoint.message;
  }

  try {
    const snapshot = await getOpenWeatherMapSnapshot(resolvedPoint.point);
    return {
      ...buildLocalTextMessage(formatWeatherSnapshot(snapshot)),
      model: 'scope-weather-provider',
    };
  } catch {
    return buildLocalTextMessage(`Weather is unavailable for ${resolvedPoint.point.label} right now after checking the configured frontend weather providers. I did not guess conditions.`);
  }
}

function extractLocationLookupQuery(value: string): string | null {
  const normalizedPrompt = value.replace(/[?!.\s]+$/g, '').trim();
  if (!normalizedPrompt) {
    return null;
  }

  if (APP_UI_LOOKUP_PATTERN.test(normalizedPrompt)) {
    return null;
  }

  if (/\b(where am i|what is my location|what's my location|current location|my location)\b/i.test(normalizedPrompt)) {
    return null;
  }

  if (STREET_ADDRESS_PATTERN.test(normalizedPrompt)) {
    return normalizedPrompt;
  }

  const explicitLookup = normalizedPrompt.match(/^(?:where is|where's|where are|locate|what(?:'s| is) the address(?: for| of)?|address(?: for| of)|directions to|how do i get to)\s+(.+)$/i);
  if (!explicitLookup?.[1]) {
    return null;
  }

  const query = explicitLookup[1]
    .replace(/^(?:the|a|an)\s+/i, '')
    .replace(/[?!.]+$/g, '')
    .trim();

  if (!query || /\b(stop\s+\d+|route start|route end|start point|end point|midpoint|my route|this route)\b/i.test(query)) {
    return null;
  }

  return query.length >= 2 ? query : null;
}

function extractPlaceSearchIntent(value: string): PlaceSearchIntent | null {
  const normalizedPrompt = value.replace(/[?!.\s]+$/g, '').trim();
  const looksLikePlannerHelp =
    APP_UI_LOOKUP_PATTERN.test(normalizedPrompt)
    && /\b(how|where|why|what|which|click|tap|open|disabled|locked|route canvas|attach|upload|image icon|add\s+(?:a\s+|an\s+|the\s+)?(?:start|end)|choose\s+(?:a\s+|an\s+|the\s+)?(?:start|end))\b/i.test(normalizedPrompt);
  if (looksLikePlannerHelp) {
    return null;
  }

  const hasPlaceSearchTrigger = /\b(find|search|look for|add|show|need|get|want|wanna|go to|take me to)\b/i.test(normalizedPrompt);
  const hasNearbyTrigger = /\b(nearby|near me|closeby|close by|closest|near|around|along|on the way|en route)\b/i.test(normalizedPrompt);
  const isRoutePlanningRequest = /\b(between|midpoint|middle|halfway|along|on the way|en route|route)\b/i.test(normalizedPrompt)
    && /\b(local\s+)?stops?\b/i.test(normalizedPrompt);

  const locationLookupQuery = extractLocationLookupQuery(normalizedPrompt);
  if (locationLookupQuery) {
    return {
      query: locationLookupQuery,
      mode: 'locations',
      requiresAnchor: false,
    };
  }

  if (!hasPlaceSearchTrigger && !hasNearbyTrigger) {
    return null;
  }

  if (isRoutePlanningRequest) {
    return {
      query: inferRouteStopSearchQuery(normalizedPrompt),
      mode: 'places',
      requiresAnchor: true,
    };
  }

  const explicitRequest = normalizedPrompt.match(/\b(?:find|search for|look for|add|show(?: me)?|need|get|want(?: to)?|wanna(?: go to)?|go to|take me to)\s+(?:a|an|the|some|any)?\s*(.+)$/i);
  let query = explicitRequest?.[1] ?? normalizedPrompt;

  query = query
    .replace(/\b(?:nearby|near me|closeby|close by|closest)\b/gi, ' ')
    .replace(/\s+\b(?:near|around|along|by|on the way to|on the way|en route to|en route)\b.+$/i, '')
    .replace(/\b(?:hey|scope|ai|please|pls|can you|could you|i|we|me|us|to|go|find|search|look|for|add|get|want|wanna|show|need|a|an|the|some|any)\b/gi, ' ')
    .replace(/[^\w\s'&.-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (query.length < 2) {
    return null;
  }

  const genericWords = new Set(['place', 'places', 'spot', 'spots', 'stop', 'stops', 'thing', 'things', 'somewhere']);
  const queryTokens = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!queryTokens.length || queryTokens.every((token) => genericWords.has(token))) {
    if (/\b(spots?|places?|stops?)\b/i.test(normalizedPrompt)) {
      return {
        query: inferRouteStopSearchQuery(normalizedPrompt),
        mode: 'places',
        requiresAnchor: true,
      };
    }

    return null;
  }

  return {
    query,
    mode: 'places',
    requiresAnchor: true,
  };
}

function inferRouteStopSearchQuery(value: string): string {
  const lowerValue = value.toLowerCase();

  if (/\b(coffee|cafe|espresso|latte)\b/.test(lowerValue)) {
    return 'coffee';
  }

  if (/\b(food|lunch|dinner|breakfast|restaurant|eat)\b/.test(lowerValue)) {
    return 'restaurant';
  }

  if (/\b(gas|fuel|charge|charging|ev)\b/.test(lowerValue)) {
    return 'fuel';
  }

  if (/\b(view|scenic|overlook|photo)\b/.test(lowerValue)) {
    return 'scenic overlook';
  }

  if (/\b(entertainment|amusement|theme\s*park|six\s*flags|bowling|arcade|movie|cinema|concert|zoo|aquarium|stadium|arena|escape\s*room|mini\s*golf|laser\s*tag)\b/.test(lowerValue)) {
    return 'entertainment';
  }

  if (/\b(park|trail|walk|nature)\b/.test(lowerValue)) {
    return 'park';
  }

  if (/\b(museum|culture|historic|gallery)\b/.test(lowerValue)) {
    return 'museum';
  }

  const primaryInterest = props.draft.interests[0];
  const interestQueries: Partial<Record<SpotCategory, string>> = {
    adventure: 'trail',
    culture: 'museum',
    food: 'restaurant',
    nature: 'park',
    nightlife: 'bar',
    entertainment: 'entertainment',
    scenic: 'scenic overlook',
    shopping: 'market',
    other: 'coffee',
  };

  return primaryInterest ? interestQueries[primaryInterest] ?? 'coffee' : 'coffee';
}

function resolveRouteActionReason(value: string): RouteActionReason | null {
  if (/\b(build|generate|make|create)\b/i.test(value) && /\b(weekend|simple|easy)\b/i.test(value) && /\b(route|plan|itinerary)\b/i.test(value)) {
    return 'weekend';
  }

  if (/\b(build|generate|make|create)\b.*\b(first draft|balanced draft|balanced first draft|draft route|itinerary|plan|route)\b/i.test(value)) {
    return 'build';
  }

  if (/\b(balanced first draft|build a first draft|build a balanced draft)\b/i.test(value)) {
    return 'build';
  }

  if (/\b(build|generate|make|create)\b.*\b(itinerary|plan|route)\b/i.test(value)) {
    return 'build';
  }

  if (/\b(tighten|remove filler|filler|clean up|simplify|rebalance)\b/i.test(value)) {
    return 'tighten';
  }

  return null;
}

function classifyFollowUpIntent(
  value: string,
  routeActionReason: RouteActionReason | null,
  placeSearchIntent: PlaceSearchIntent | null,
): FollowUpIntentKind {
  if (routeActionReason === 'tighten') {
    return 'tighten';
  }

  if (routeActionReason === 'weekend') {
    return 'weekend';
  }

  if (routeActionReason === 'build') {
    return 'build';
  }

  if (placeSearchIntent) {
    return placeSearchIntent.mode === 'locations' ? 'location' : 'places';
  }

  if (
    APP_UI_LOOKUP_PATTERN.test(value)
    && /\b(how|where|what button|which button|click|tap|open|add\s+(?:a\s+|an\s+|the\s+)?start|add\s+(?:a\s+|an\s+|the\s+)?end|route canvas|attach|upload|image icon)\b/i.test(value)
  ) {
    return 'appHelp';
  }

  if (/\b(image|photo|picture|attached|attachment|see this|look at this|upload|attach)\b/i.test(value)) {
    return 'image';
  }

  if (/\b(budget|inside|under|cap|\$|cost|spend|price|cheap|expensive)\b/i.test(value)) {
    return 'budget';
  }

  if (/\b(timing|time|date|schedule|works?|pace|relaxed|rushed|drive day|arrival|arrive|depart|departure)\b/i.test(value)) {
    return 'timing';
  }

  if (/\b(tighten|remove filler|filler|clean up|simplify|rebalance|trim|too much)\b/i.test(value)) {
    return 'tighten';
  }

  if (/\b(start(?:ing)?\s+(?:city|point|place|location)|origin|where\s+(?:should|do)\s+(?:i|we)\s+start|choose\s+(?:a\s+)?(?:strong\s+)?start)\b/i.test(value)) {
    return 'startCity';
  }

  if (/\b(weather|rain|storm|hot|cold|heat|wind|snow|forecast)\b/i.test(value)) {
    return 'weather';
  }

  if (/\b(safe|safety|danger|night|late|avoid|risk)\b/i.test(value)) {
    return 'safety';
  }

  if (/\b(group|friends|family|kids|children|solo|couple|travelers|people)\b/i.test(value)) {
    return 'group';
  }

  if (/\b(food|lunch|dinner|breakfast|restaurant|coffee|cafe|meal|eat|drink)\b/i.test(value)) {
    return 'food';
  }

  if (/\b(weekend|simple|easy|direction|first draft|starter)\b/i.test(value)) {
    return 'weekend';
  }

  return 'general';
}

function doesPromptAnswerPendingBrief(value: string, pendingBrief: PendingItineraryBrief): boolean {
  const currentKey = pendingBrief.missingKeys[0];
  if (!currentKey) {
    return true;
  }

  if (isVagueBriefReply(value)) {
    return true;
  }

  return Boolean(parseBriefReplyForKey(value, currentKey));
}

function shouldHandlePromptAsNewIntentWhileBriefPending(
  value: string,
  routeActionReason: RouteActionReason | null,
  placeSearchIntent: PlaceSearchIntent | null,
): boolean {
  const pendingBrief = pendingItineraryBrief.value;
  if (!pendingBrief) {
    return false;
  }

  if (isItineraryBuildCancelRequest(value)) {
    return false;
  }

  if (doesPromptAnswerPendingBrief(value, pendingBrief)) {
    return false;
  }

  const intent = classifyFollowUpIntent(value, routeActionReason, placeSearchIntent);
  return intent !== 'general' && intent !== 'build' && intent !== 'weekend';
}

function isItineraryBuildCancelRequest(value: string): boolean {
  const normalized = value.trim();
  if (!normalized) {
    return false;
  }

  return (
    /^(?:cancel|never mind|nevermind|start over|stop)(?:\s+(?:this|the|that)?\s*(?:itinerary|build|plan|request))?[.!?]*$/i.test(normalized)
    || /\b(?:cancel|never mind|nevermind|start over|stop)\s+(?:this|the|that)?\s*(?:itinerary\s+)?(?:build|plan|request)\b/i.test(normalized)
  );
}

function buildLeanStops(stops: TripSpot[]): TripSpot[] {
  const seenStops = new Set<string>();

  return stops.filter((stop) => {
    const key = [
      stop.title.trim().toLowerCase(),
      stop.city?.trim().toLowerCase() ?? '',
      Number.isFinite(stop.latitude) ? stop.latitude.toFixed(3) : '',
      Number.isFinite(stop.longitude) ? stop.longitude.toFixed(3) : '',
    ].join('|');

    if (!stop.title.trim() || seenStops.has(key)) {
      return false;
    }

    seenStops.add(key);
    return true;
  });
}

function getRouteActionWorkingMessage(reason: RouteActionReason): string {
  if (reason === 'tighten') {
    return props.stops.length
      ? 'Checking the committed stops before I clean the route'
      : 'Building a lean route from the actual itinerary planner';
  }

  if (reason === 'weekend') {
    return 'Building a simple weekend route from the planner';
  }

  return 'Building the itinerary from the planner';
}

function getAsyncErrorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : 'Scope could not finish that planner action right now.';
}

function requestItineraryBuild(
  userPrompt: string,
  reason: RouteActionReason,
  draftDefaults?: ItineraryBuildDraftDefaults,
): Promise<ItineraryBuildResult> {
  return new Promise((resolve, reject) => {
    const payload: ItineraryBuildRequestPayload = {
      prompt: userPrompt,
      reason,
      ...(draftDefaults ? { draftDefaults } : {}),
      handled: false,
      resolve,
      reject,
    };

    emit('itinerary-build-request', payload);

    void nextTick(() => {
      if (!payload.handled) {
        resolve({
          status: 'queued',
          routeLabel: routeLabel.value || 'this route',
          stopCount: props.stops.length,
          dayCount: draftDefaults ? getBuildDefaultsDurationDays(draftDefaults) ?? undefined : getTripDurationDays() ?? undefined,
        });
      }
    });
  });
}

function buildItineraryBuildDefaultsSignature(defaults: ItineraryBuildDraftDefaults = {}): string {
  if (!hasItineraryBuildDefaults(defaults)) {
    return '';
  }

  return JSON.stringify({
    startDate: defaults.startDate ?? '',
    endDate: defaults.endDate ?? '',
    durationDays: getBuildDefaultsDurationDays(defaults) ?? null,
    interests: [...(defaults.interests ?? [])].sort(),
    pace: defaults.pace ?? '',
    groupSize: defaults.groupSize ?? null,
  });
}

function buildRouteActionSignature(reason: RouteActionReason, draftDefaults: ItineraryBuildDraftDefaults = {}): string {
  const stopSignature = props.stops
    .map((stop) => [
      stop.spotId,
      stop.title.trim().toLowerCase(),
      stop.dayNumber ?? '',
      stop.timeSlot ?? '',
      Number.isFinite(stop.latitude) ? Number(stop.latitude).toFixed(5) : '',
      Number.isFinite(stop.longitude) ? Number(stop.longitude).toFixed(5) : '',
    ].join(':'))
    .join('|');

  return [
    reason,
    props.tripTitle.trim().toLowerCase(),
    props.draft.destination.trim().toLowerCase(),
    props.draft.endDestination?.trim().toLowerCase() ?? '',
    props.draft.startDate,
    props.draft.endDate,
    props.draft.budgetFloor ?? 0,
    props.draft.budget,
    props.draft.pace,
    props.draft.groupSize,
    [...props.draft.interests].sort().join(','),
    stopSignature,
    buildItineraryBuildDefaultsSignature(draftDefaults),
  ].join('::');
}

function buildAlreadySyncedRouteActionMessage(reason: RouteActionReason, route: string): ChatMessage {
  const content = reason === 'tighten'
    ? `${route} is already tightened from the current planner state. Change a stop, time, budget, or endpoint and I can tighten it again; otherwise I can explain why this route is shaped this way.`
    : `${route} is already built and synced from the current planner state. Change a route point, stop, budget, or pace and I can rebuild it; otherwise I can tighten it or explain the route.`;

  return {
    id: createMessageId('assistant'),
    role: 'assistant',
    kind: 'text',
    model: 'scope-action',
    content,
  };
}

async function buildRouteActionMessage(
  reason: RouteActionReason,
  userPrompt: string,
  options: { allowSmartDefaults?: boolean; draftDefaults?: ItineraryBuildDraftDefaults } = {},
): Promise<ChatMessage> {
  const route = routeLabel.value || 'this route';
  const hasDestination = Boolean(props.draft.destination.trim());
  const shouldBuildItinerary = reason !== 'tighten' || props.stops.length === 0;
  const shouldRequireEndDestination = /\b(final destination|end point|end city|endpoint|current route|route from|from .+ to|after i add the final destination)\b/i.test(userPrompt);
  const promptDraftDefaults = mergeItineraryBuildDefaults(
    extractItineraryBuildDefaultsFromPrompt(userPrompt),
    options.draftDefaults ?? {},
  );
  const isDirectBuildCommand = reason === 'build' &&
    /^\s*(?:build|generate|make|create)\s+(?:the\s+)?(?:itinerary|route|plan)(?:\s+(?:from\s+here|now|please))?[.!?]*\s*$/i.test(userPrompt);
  const allowSmartDefaults = Boolean(
    options.allowSmartDefaults ||
    isDirectBuildCommand ||
    /\b(?:use|with)\s+(?:smart\s+|balanced\s+)?defaults\b|\bsmart defaults\b|\bbalanced defaults\b|\bsurprise me\b|\byou (?:choose|pick|decide)\b/i.test(userPrompt),
  );
  const allMissingBriefQuestions = shouldBuildItinerary
    ? getMissingItineraryBriefQuestions(promptDraftDefaults, { requireEndDestination: shouldRequireEndDestination })
    : [];
  const smartDefaultKeys = allowSmartDefaults
    ? allMissingBriefQuestions
      .map((question) => question.key)
      .filter((key) => key !== 'destination' && key !== 'endDestination')
    : [];
  const effectiveDraftDefaults = smartDefaultKeys.length
    ? mergeItineraryBuildDefaults(promptDraftDefaults, buildSmartDefaultsForKeys(smartDefaultKeys))
    : promptDraftDefaults;
  const missingBriefQuestions = allowSmartDefaults
    ? allMissingBriefQuestions.filter((question) => question.key === 'destination' || question.key === 'endDestination')
    : allMissingBriefQuestions;
  const routeActionSignature = buildRouteActionSignature(reason, effectiveDraftDefaults);

  if (!hasDestination) {
    pendingItineraryBrief.value = {
      reason,
      originalPrompt: userPrompt,
      missingKeys: ['destination'],
      draftDefaults: effectiveDraftDefaults,
    };
    return {
      id: createMessageId('assistant'),
      role: 'assistant',
      kind: 'text',
      model: 'scope-action',
      content: 'I can build that. What destination should I use for this trip?',
    };
  }

  if (reason === 'tighten' && props.stops.length === 0) {
    pendingItineraryBrief.value = null;
    return {
      id: createMessageId('assistant'),
      role: 'assistant',
      kind: 'text',
      model: 'scope-action',
      content: `I will tighten against the route state I already have: ${route}. I will not ask for endpoints that are already filled. Add a midpoint stop or build the itinerary when you want live timing.`,
    };
  }

  if (missingBriefQuestions.length) {
    pendingItineraryBrief.value = {
      reason,
      originalPrompt: userPrompt,
      missingKeys: missingBriefQuestions.map((question) => question.key),
      draftDefaults: effectiveDraftDefaults,
    };
    return buildMissingItineraryBriefMessage(reason, missingBriefQuestions);
  }

  if (lastSuccessfulRouteActionSignature.value === routeActionSignature) {
    return buildAlreadySyncedRouteActionMessage(reason, route);
  }

  workingMessage.value = getRouteActionWorkingMessage(reason);

  if (reason === 'tighten' && props.stops.length > 0) {
    const leanStops = buildLeanStops(props.stops);
    const removedCount = props.stops.length - leanStops.length;
    emit('route-stops-replace', leanStops);

    await nextTick();
    lastSuccessfulRouteActionSignature.value = routeActionSignature;

    return {
      id: createMessageId('assistant'),
      role: 'assistant',
      kind: 'text',
      model: 'scope-action',
      content: removedCount > 0
        ? `Done. I tightened ${route} by removing ${removedCount} duplicate or empty stop${removedCount === 1 ? '' : 's'} and kept ${leanStops.length} committed stop${leanStops.length === 1 ? '' : 's'} in the route. Ask me to build it next and I will refresh the live preview.`
        : `Done. ${route} is already lean: ${leanStops.length} committed stop${leanStops.length === 1 ? '' : 's'} and no duplicate filler to remove. Ask me to build it when you want fresh timing in the live preview.`,
    };
  }

  try {
    pendingItineraryBrief.value = null;
    const result = await requestItineraryBuild(
      userPrompt,
      reason,
      hasItineraryBuildDefaults(effectiveDraftDefaults) ? effectiveDraftDefaults : undefined,
    );

    if (result.status === 'busy') {
      return {
        id: createMessageId('assistant'),
        role: 'assistant',
        kind: 'text',
        model: 'scope-action',
        content: 'Scope AI is already building this route. I will wait for that run instead of starting a competing one.',
      };
    }

    if (result.status === 'queued') {
      return {
        id: createMessageId('assistant'),
        role: 'assistant',
        kind: 'text',
        model: 'scope-action',
        content: `I handed ${route} to Scope AI. The live preview will update here when the itinerary build finishes.`,
      };
    }

    const dayCount = result.dayCount ?? getBuildDefaultsDurationDays(effectiveDraftDefaults) ?? getTripDurationDays();
    const itineraryLabel = dayCount
      ? `${dayCount}-day itinerary`
      : 'itinerary';
    const stopLabel = result.stopCount === 1 ? '1 stop' : `${result.stopCount} stops`;
    const lead = reason === 'tighten'
      ? `Done. I rebuilt ${result.routeLabel || route} as a lean ${itineraryLabel} with ${stopLabel}.`
      : `Done. I built ${result.routeLabel || route} into a ${itineraryLabel} with ${stopLabel}.`;

    await nextTick();
    lastSuccessfulRouteActionSignature.value = routeActionSignature;

    return {
      id: createMessageId('assistant'),
      role: 'assistant',
      kind: 'text',
      model: 'scope-action',
      content: `${lead}\nThe route builder, map preview, and copilot are synced now.`,
    };
  } catch (caughtError: unknown) {
    return {
      id: createMessageId('assistant'),
      role: 'assistant',
      kind: 'error',
      model: 'scope-action',
      content: `I could not rebuild the itinerary yet. ${getAsyncErrorMessage(caughtError)}`,
    };
  }
}

function resolvePlaceSearchAnchor(userPrompt: string): RouteSearchAnchor | null {
  const anchors = routeSearchAnchors.value;
  if (!anchors.length) {
    return null;
  }

  const lowerPrompt = userPrompt.toLowerCase();
  const explicitStopMatch = lowerPrompt.match(/\bstop\s+(\d+)\b/);
  if (explicitStopMatch) {
    const stopIndex = Number(explicitStopMatch[1]) - 1;
    const stopAnchors = anchors.filter((anchor) => anchor.role === 'stop');
    return stopAnchors[stopIndex] ?? null;
  }

  if (/\b(start|origin|beginning|from)\b/.test(lowerPrompt)) {
    return anchors.find((anchor) => anchor.role === 'start') ?? anchors[0] ?? null;
  }

  if (/\b(end|finish|final|destination)\b/.test(lowerPrompt)) {
    return anchors.find((anchor) => anchor.role === 'end') ?? anchors[anchors.length - 1] ?? null;
  }

  if (/\b(midpoint|middle|halfway|between|along|on the way|en route|route)\b/.test(lowerPrompt)) {
    return buildRouteMidpointAnchor(anchors);
  }

  return anchors.find((anchor) => anchor.role === 'start') ?? anchors[0] ?? null;
}

function buildRouteMidpointAnchor(anchors: RouteSearchAnchor[]): RouteSearchAnchor {
  const start = anchors.find((anchor) => anchor.role === 'start') ?? anchors[0];
  const end = anchors.find((anchor) => anchor.role === 'end') ?? anchors[anchors.length - 1];

  if (!start || !end || start.id === end.id) {
    return anchors[Math.floor(anchors.length / 2)] ?? start;
  }

  return {
    id: 'route-midpoint',
    label: 'route midpoint',
    latitude: (start.latitude + end.latitude) / 2,
    longitude: (start.longitude + end.longitude) / 2,
    role: 'midpoint',
  };
}

function createMessageId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function isAbortError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) {
    return false;
  }

  const candidate = error as { code?: unknown; name?: unknown; message?: unknown };
  const code = typeof candidate.code === 'string' ? candidate.code : '';
  const name = typeof candidate.name === 'string' ? candidate.name : '';
  const message = typeof candidate.message === 'string' ? candidate.message : '';

  return (
    code === 'ERR_CANCELED' ||
    name === 'CanceledError' ||
    /\bcancel(?:led|ed)\b/i.test(message)
  );
}

function buildLocalTextMessage(content: string): ChatMessage {
  return {
    id: createMessageId('assistant'),
    role: 'assistant',
    kind: 'text',
    model: 'scope-local-common',
    content,
  };
}

function normalizeHiddenBlockContent(value: string): string {
  return value
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
}

function parseScopeActionBlocks(rawContent: string): { content: string; actions: ScopeRouteActionPayload[] } {
  const actions: ScopeRouteActionPayload[] = [];
  SCOPE_ACTION_BLOCK_PATTERN.lastIndex = 0;
  const content = rawContent.replace(SCOPE_ACTION_BLOCK_PATTERN, (_match, rawBlock: string) => {
    const normalizedBlock = normalizeHiddenBlockContent(rawBlock);
    if (!normalizedBlock) {
      return '';
    }

    try {
      const parsed = JSON.parse(normalizedBlock) as unknown;
      if (Array.isArray(parsed)) {
        parsed.forEach((item) => {
          if (isRecord(item)) {
            actions.push(item);
          }
        });
      } else if (isRecord(parsed)) {
        actions.push(parsed);
      }
    } catch {
      // Keep hidden action parsing best-effort so a malformed tool block never leaks into chat.
    }

    return '';
  });

  return { content, actions };
}

function parseChipLabels(rawBlock: string): string[] {
  const normalizedBlock = normalizeHiddenBlockContent(rawBlock);
  if (!normalizedBlock) {
    return [];
  }

  if (normalizedBlock.startsWith('[')) {
    try {
      const parsed = JSON.parse(normalizedBlock) as unknown;
      if (Array.isArray(parsed)) {
        return parsed
          .map((item) => sanitizeChipLabel(String(item ?? '')))
          .filter(Boolean);
      }
    } catch {
      // Fall through to comma/newline parsing.
    }
  }

  return normalizedBlock
    .split(/,|\n/)
    .map(sanitizeChipLabel)
    .filter(Boolean);
}

function parseChipBlocks(rawContent: string): { content: string; chips: string[] } {
  const chipGroups: string[][] = [];
  CHIPS_BLOCK_PATTERN.lastIndex = 0;
  const content = rawContent.replace(CHIPS_BLOCK_PATTERN, (_match, rawBlock: string) => {
    chipGroups.push(parseChipLabels(rawBlock));
    return '';
  });

  return {
    content,
    chips: mergeUniqueSuggestions(...chipGroups).slice(0, MAX_SUGGESTIONS),
  };
}

function parseAssistantResponseBlocks(rawContent: string): ParsedAssistantResponse {
  const actionResult = parseScopeActionBlocks(rawContent);
  const chipResult = parseChipBlocks(actionResult.content);
  const content = chipResult.content
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return {
    content: content || 'Done.',
    chips: chipResult.chips,
    actions: actionResult.actions,
  };
}

function sanitizeChipLabel(value: string): string {
  return value
    .replace(/^\s*(?:[-*]|\d+[.)])\s*/, '')
    .replace(/^["'`]+|["'`]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 72);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readStringField(source: ScopeRouteActionPayload, ...keys: Array<keyof ScopeRouteActionPayload>): string {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
    if (typeof value === 'number' && Number.isFinite(value)) {
      return String(value);
    }
  }

  return '';
}

function readPositiveInteger(value: unknown): number | null {
  const parsed = typeof value === 'number' ? value : Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : null;
}

function normalizeScopeActionType(action: ScopeRouteActionPayload): ScopeRouteActionType | null {
  const value = readStringField(action, 'action', 'type', 'action_type')
    .toLowerCase()
    .replace(/[\s-]+/g, '_');

  if (value === 'add_marker' || value === 'add_stop' || value === 'add_place') {
    return 'add_marker';
  }

  if (value === 'remove_marker' || value === 'remove_stop' || value === 'delete_marker') {
    return 'remove_marker';
  }

  if (value === 'reorder_stops' || value === 'reorder_markers' || value === 'reorder_route') {
    return 'reorder_stops';
  }

  return null;
}

function normalizeScopeActionStopType(action: ScopeRouteActionPayload): ScopeRouteActionStopType {
  const value = readStringField(action, 'stop_type', 'stopType')
    .toLowerCase()
    .replace(/[\s-]+/g, '_');

  if (value === 'start' || value === 'origin') {
    return 'start';
  }

  if (value === 'destination' || value === 'end' || value === 'final' || value === 'finish') {
    return 'destination';
  }

  return 'stop';
}

function getScopeActionPlaceLabel(action: ScopeRouteActionPayload): string {
  return readStringField(action, 'place_name', 'placeName', 'name', 'title')
    || readStringField(action, 'address');
}

function getScopeActionAddress(action: ScopeRouteActionPayload): string {
  return readStringField(action, 'address') || getScopeActionPlaceLabel(action);
}

function getScopeActionNote(action: ScopeRouteActionPayload): string {
  return readStringField(action, 'note', 'notes');
}

function getActionSearchProximity(): RouteFallbackAnchor | undefined {
  const anchor = routeSearchAnchors.value[0] ?? props.locationSearchProximity;
  if (!anchor || !hasCoordinatePair(anchor.latitude, anchor.longitude)) {
    return undefined;
  }

  return {
    ...(anchor.label ? { label: anchor.label } : {}),
    latitude: anchor.latitude,
    longitude: anchor.longitude,
  };
}

async function resolveScopeActionPlace(action: ScopeRouteActionPayload): Promise<PlaceSearchResult | null> {
  const label = getScopeActionPlaceLabel(action);
  const address = getScopeActionAddress(action);

  const query = address || label;
  if (!query) {
    return null;
  }

  const proximity = getActionSearchProximity();
  const result = await searchLocations(query, {
    limit: 1,
    ...(proximity ? {
      proximity: {
        latitude: proximity.latitude,
        longitude: proximity.longitude,
      },
    } : {}),
  });

  const resolved = result.data[0] ?? null;
  if (!resolved || !isTrustedProviderPlaceResult(resolved)) {
    return null;
  }

  return resolved;
}

function buildScopeActionSpotId(action: ScopeRouteActionPayload, place: PlaceSearchResult): string {
  const explicitId = readStringField(action, 'place_id', 'placeId', 'id') || place.id || '';
  const slugSource = explicitId || `${place.placeName}-${place.latitude}-${place.longitude}`;
  const slug = slugSource
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);

  return `scope-ai-${slug || Date.now().toString(36)}`;
}

function insertStopAtOrder(stops: TripSpot[], stop: TripSpot, order: number | null): TripSpot[] | null {
  if (!order || order > stops.length) {
    return null;
  }

  const nextStops = stops.map((entry) => ({ ...entry }));
  nextStops.splice(Math.max(0, order - 1), 0, stop);
  return nextStops;
}

async function applyAddMarkerAction(action: ScopeRouteActionPayload): Promise<void> {
  const place = await resolveScopeActionPlace(action);
  if (!place || !hasCoordinatePair(place.latitude, place.longitude)) {
    return;
  }

  const stopType = normalizeScopeActionStopType(action);
  const label = place.placeName || place.formattedAddress || getScopeActionPlaceLabel(action) || 'Scope AI stop';
  const address = place.formattedAddress || getScopeActionAddress(action) || place.address || '';

  if (stopType === 'start' || stopType === 'destination') {
    emit('map-location-select', {
      target: stopType === 'start' ? 'destination' : 'endDestination',
      label,
      latitude: place.latitude,
      longitude: place.longitude,
      city: place.city,
      country: place.country,
    });
    return;
  }

  const dayNumber = readPositiveInteger(action.dayNumber ?? action.day) ?? undefined;
  const stop: TripSpot = {
    spotId: buildScopeActionSpotId(action, place),
    title: label,
    latitude: place.latitude,
    longitude: place.longitude,
    category: inferSpotCategory(place),
    ...(place.city ? { city: place.city } : {}),
    ...(dayNumber ? { dayNumber } : {}),
    notes: getScopeActionNote(action) || address || 'Added by Scope AI.',
  };
  const orderedStops = insertStopAtOrder(props.stops, stop, readPositiveInteger(action.order));
  if (orderedStops) {
    emit('route-stops-replace', orderedStops);
    return;
  }

  emit('route-stop-add', stop);
}

function normalizeActionLookupValue(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function findStopForAction(action: ScopeRouteActionPayload): TripSpot | undefined {
  const targetId = normalizeActionLookupValue(readStringField(action, 'place_id', 'placeId', 'id'));
  const targetLabel = normalizeActionLookupValue(getScopeActionPlaceLabel(action) || getScopeActionAddress(action));
  if (!targetId && !targetLabel) {
    return undefined;
  }

  return props.stops.find((stop) => {
    const stopId = normalizeActionLookupValue(stop.spotId);
    const stopLabel = normalizeActionLookupValue(stop.title);
    return Boolean(
      (targetId && stopId === targetId)
      || (targetLabel && stopLabel && stopLabel === targetLabel)
      || (targetLabel && stopLabel && stopLabel.includes(targetLabel))
      || (targetLabel && stopLabel && targetLabel.includes(stopLabel)),
    );
  });
}

function applyRemoveMarkerAction(action: ScopeRouteActionPayload): void {
  const stop = findStopForAction(action);
  if (stop) {
    emit('route-stop-remove', stop.spotId);
    return;
  }

  const target = normalizeActionLookupValue(getScopeActionPlaceLabel(action) || getScopeActionAddress(action));
  const start = normalizeActionLookupValue(props.draft.destination);
  const end = normalizeActionLookupValue(props.draft.endDestination ?? '');
  if (target && start && (target === start || start.includes(target) || target.includes(start))) {
    emit('route-endpoint-remove', 'destination');
    return;
  }

  if (target && end && (target === end || end.includes(target) || target.includes(end))) {
    emit('route-endpoint-remove', 'endDestination');
  }
}

function readStopOrderEntries(action: ScopeRouteActionPayload): unknown[] {
  if (Array.isArray(action.stop_order)) {
    return action.stop_order;
  }

  if (Array.isArray(action.stops)) {
    return action.stops;
  }

  return [];
}

function normalizeStopOrderEntry(entry: unknown): ScopeRouteActionPayload {
  if (isRecord(entry)) {
    return entry;
  }

  return {
    place_name: String(entry ?? ''),
  };
}

function applyReorderStopsAction(action: ScopeRouteActionPayload): void {
  const entries = readStopOrderEntries(action).map(normalizeStopOrderEntry);
  if (!entries.length) {
    return;
  }

  const remainingStops = props.stops.map((stop) => ({ ...stop }));
  const orderedStops: TripSpot[] = [];
  const dayNumber = readPositiveInteger(action.dayNumber ?? action.day);

  entries.forEach((entry) => {
    const matchIndex = remainingStops.findIndex((stop) => {
      const targetId = normalizeActionLookupValue(readStringField(entry, 'place_id', 'placeId', 'id'));
      const targetLabel = normalizeActionLookupValue(getScopeActionPlaceLabel(entry) || getScopeActionAddress(entry));
      const stopId = normalizeActionLookupValue(stop.spotId);
      const stopLabel = normalizeActionLookupValue(stop.title);
      return Boolean(
        (targetId && stopId === targetId)
        || (targetLabel && stopLabel === targetLabel)
        || (targetLabel && stopLabel.includes(targetLabel))
        || (targetLabel && targetLabel.includes(stopLabel)),
      );
    });

    if (matchIndex < 0) {
      return;
    }

    const [matchedStop] = remainingStops.splice(matchIndex, 1);
    if (matchedStop) {
      orderedStops.push({
        ...matchedStop,
        ...(dayNumber ? { dayNumber } : {}),
      });
    }
  });

  if (orderedStops.length) {
    emit('route-stops-replace', [...orderedStops, ...remainingStops]);
  }
}

async function applyScopeRouteAction(action: ScopeRouteActionPayload): Promise<void> {
  const actionType = normalizeScopeActionType(action);
  if (actionType === 'add_marker') {
    await applyAddMarkerAction(action);
    return;
  }

  if (actionType === 'remove_marker') {
    applyRemoveMarkerAction(action);
    return;
  }

  if (actionType === 'reorder_stops') {
    applyReorderStopsAction(action);
  }
}

async function prepareAssistantMessageForRender(message: ChatMessage): Promise<ChatMessage> {
  if (message.role !== 'assistant' || message.kind !== 'text') {
    return message;
  }

  const parsed = parseAssistantResponseBlocks(message.content);
  for (const action of parsed.actions) {
    await applyScopeRouteAction(action);
  }

  return {
    ...message,
    content: parsed.content,
    ...(parsed.chips.length ? { chips: parsed.chips } : {}),
  };
}

function getScopeAiAuditPlannerSnapshot(): ScopeAiTurnPlannerSnapshot {
  const storeState = props.scopeAiStore?.plannerState;
  const start = (typeof storeState?.start === 'string' ? storeState.start : props.draft.destination) || null;
  const end = (typeof storeState?.end === 'string' ? storeState.end : props.draft.endDestination) || null;
  const stops = Array.isArray(storeState?.stops) ? storeState.stops : props.stops;
  const budgetMin = Number.isFinite(Number(storeState?.budget_min)) ? Number(storeState.budget_min) : props.draft.budgetFloor;
  const budgetMax = Number.isFinite(Number(storeState?.budget_max)) ? Number(storeState.budget_max) : props.draft.budget;
  const startDate = (typeof storeState?.start_date === 'string' ? storeState.start_date : props.draft.startDate) || null;
  const endDate = (typeof storeState?.end_date === 'string' ? storeState.end_date : props.draft.endDate) || null;
  const pace = (typeof storeState?.pace === 'string' ? storeState.pace : props.draft.pace) || null;
  const snapshot = {
    start,
    end,
    stopCount: stops.length,
    budgetMin,
    budgetMax,
    startDate,
    endDate,
    pace,
    routeLabel: routeLabel.value || null,
  };

  return {
    ...snapshot,
    stateSignature: JSON.stringify(snapshot),
  };
}

function getPreviousAssistantMessagesForAudit(): ScopeAiPreviousAssistantMessage[] {
  return messages.value
    .filter((message) => message.role === 'assistant')
    .map((message) => ({
      kind: message.kind,
      content: resolveMessageContentForTraining(message),
      stateSignature: message.auditStateSignature,
    }));
}

function getPreviousUserPromptForAudit(): string | null {
  const userMessages = messages.value.filter((message) => message.role === 'user');
  return userMessages.length >= 2 ? userMessages[userMessages.length - 2]?.content ?? null : null;
}

async function auditAssistantMessageForRender(
  message: ChatMessage,
  options: {
    userPrompt: string;
    actionApplyResult?: ScopeAiActionBlockApplyResult | null;
  },
): Promise<ChatMessage> {
  const preparedMessage = await prepareAssistantMessageForRender(message);
  if (preparedMessage.role !== 'assistant') {
    return preparedMessage;
  }

  const planner = getScopeAiAuditPlannerSnapshot();
  const audit = auditScopeAiTurn(preparedMessage, {
    userPrompt: options.userPrompt,
    previousUserPrompt: getPreviousUserPromptForAudit(),
    planner,
    actionApplyResult: options.actionApplyResult as ScopeAiTurnActionApplyResult | null | undefined,
    previousAssistantMessages: getPreviousAssistantMessagesForAudit(),
  });

  return {
    ...audit.message,
    auditStateSignature: planner.stateSignature,
    ...(audit.reasons.length ? { auditReasons: audit.reasons } : {}),
  } as ChatMessage;
}

function getContextualNextMoveText(): string {
  const start = formatRouteEndpointLabel(props.draft.destination);
  const end = formatRouteEndpointLabel(props.draft.endDestination);
  const route = routeLabel.value;
  const dateLabel = getDateLabel(props.draft.startDate, props.draft.endDate);
  const budget = budgetLabel.value === 'Set budget' ? 'your budget' : budgetLabel.value;

  if (!start && end) {
    return `Your final destination is set to ${end}. Add a start place when you are ready, or ask me to suggest one that fits the trip.`;
  }

  if (!start) {
    return 'Your next move is to add a start place or final destination. Use the route canvas controls or type either endpoint in the brief, then I can help shape the rest.';
  }

  if (!end) {
    return `Your next move is to add the final destination from ${start}. Once the end is set, I can check timing, suggest stops, or build the itinerary.`;
  }

  if (!props.stops.length) {
    return `Your route is ready from ${route}. Best next move: build the itinerary, or ask me to find one practical stop before I build it. I will use ${dateLabel || 'your selected dates'}, ${budget}, and your ${paceLabel.value.toLowerCase()} pace.`;
  }

  return `Your route is set with ${props.stops.length} stop${props.stops.length === 1 ? '' : 's'}. Best next move: check timing, tighten weak stops, or build the itinerary from ${route}.`;
}

function isStartCityRecommendationPrompt(value: string): boolean {
  const normalized = value.replace(/[?!.\s]+$/g, '').trim();
  if (!normalized || STREET_ADDRESS_PATTERN.test(normalized)) {
    return false;
  }

  if (/\b(how|what button|which button|click|tap|disabled|route canvas)\b/i.test(normalized)) {
    return false;
  }

  const startTarget = String.raw`(?:start(?:ing)?\s*(?:point|place|city|cities|region|regions)?|departure\s*(?:city|cities|point|place|region|regions)|origin\s*(?:city|cities|point|place|region|regions))`;
  return (
    new RegExp(String.raw`\b(?:help\s+me\s+)?(?:choose|pick|suggest|recommend|compare|find)\s+(?:a\s+|an\s+|the\s+|some\s+)?(?:good\s+|best\s+|strong\s+|practical\s+|easy\s+)?${startTarget}\b`, 'i').test(normalized) ||
    /\bwhere\s+should\s+(?:i|we)\s+(?:start|begin|leave|depart)\b/i.test(normalized) ||
    /\b(?:suggest|recommend|find|compare)\s+(?:some\s+)?(?:start(?:ing)?|departure|origin)\s+(?:cities|regions|places|ideas)\b/i.test(normalized)
  );
}

function isMissingCurrentLocationTravelPrompt(value: string): boolean {
  return (
    /\b(?:near me|around me|near here|where i am|my location|current location)\b/i.test(value) &&
    /\b(?:what should|what can|things? to do|nearby|find|show|recommend|suggest|food|restaurants?|coffee|nightlife|bars?|weather|forecast)\b/i.test(value)
  );
}

function buildCommonScopeAiAnswer(userPrompt: string): ChatMessage | null {
  const value = userPrompt.trim();
  if (!value) {
    return null;
  }

  if (extractExplicitLocationRecommendationQuery(value)) {
    return null;
  }

  if (/^(?:hi|hello|hey|yo|sup|what'?s up|are you there)[.!?\s]*$/i.test(value)) {
    return buildLocalTextMessage('I am here. Tell me what you want to check, or use the suggested prompts and I will keep the planner moving from the current route state.');
  }

  if (/^(?:thanks|thank you|ty|ok|okay|cool|got it|bet)[.!?\s]*$/i.test(value)) {
    return buildLocalTextMessage('Got it. I will keep using the current planner state for the next suggestion.');
  }

  if (isStartCityRecommendationPrompt(value)) {
    return buildLocalTextMessage('I can help choose a strong start city, but I need one real anchor so I do not geocode trip vibes as an address. Tell me a state, region, current location, or final destination and I will suggest start candidates before anything gets set.');
  }

  if (isMissingCurrentLocationTravelPrompt(value)) {
    return buildLocalTextMessage('I need a real location before I can rank options near you. Share current location, add a start place, or name a city and I will use live/provider-backed context when it is available.');
  }

  if (/\b(who are you|what are you|what can you do|how can you help)\b/i.test(value)) {
    return buildLocalTextMessage('I am Scope AI, the trip, spots, and app copilot inside this planner. I can answer quick UI questions, find spots, add useful spot candidates to your route, check timing and budget, review images, and build or tighten the itinerary when the route is ready.');
  }

  if (/\b(spot|spots|pins?)\b/i.test(value) && /\b(help|how|what|use|work|choose|pick)\b/i.test(value)) {
    return buildLocalTextMessage('I can help with spots directly here: ask me for a kind of spot, a nearby spot, or a stop along the route. When I show place results, use Add spot and I will put that candidate into your route list.');
  }

  if (/\b(next|what now|what should i do|what do i do|best move|next move|where do i start)\b/i.test(value)) {
    return buildLocalTextMessage(getContextualNextMoveText());
  }

  if (/\b(end.*disabled|why.*end|can'?t.*end|cannot.*end|add\s+(?:an?\s+|the\s+)?end|choose\s+(?:an?\s+|the\s+)?end|pick\s+(?:an?\s+|the\s+)?end)\b/i.test(value) && !formatRouteEndpointLabel(props.draft.destination)) {
    return buildLocalTextMessage('You can set the final destination before the start. Use the End control on the route canvas or type the final destination in the brief, then add the start whenever you are ready.');
  }

  if (/\b(route canvas|this screen|planner screen|how.*use|how.*add\s+(?:a\s+|the\s+)?start|add\s+(?:a\s+|the\s+)?start|start button)\b/i.test(value)) {
    return buildLocalTextMessage(`${getContextualNextMoveText()} The route canvas supports setting either endpoint first; once both are present, Scope AI can build from the same route you see on the map.`);
  }

  const isDirectFuelSettingPrompt =
    /\b\d{1,3}(?:\.\d+)?\s*mpg\b/i.test(value) ||
    /\bmpg\s*(?:is|at|to|=)?\s*\d{1,3}(?:\.\d+)?\b/i.test(value) ||
    /\b(?:gas|fuel)\s+(?:price|cost)\s*(?:is|at|to|=|costs?)?\s*\$?\d+(?:\.\d{1,2})?\b/i.test(value);
  if (!isDirectFuelSettingPrompt && /\b(set fuel|fuel cost|mpg|gas price|drive score)\b/i.test(value)) {
    return buildLocalTextMessage('Set fuel opens the fuel inputs in the planner. Add MPG and gas price, then Scope estimates route fuel cost. Drive score updates once the route has enough points to estimate distance and timing.');
  }

  if (/\b(attach|upload|image|photo|picture|image icon)\b/i.test(value) && /\b(where|how|what)\b/i.test(value)) {
    return buildLocalTextMessage('Use the image button beside the chat input to attach trip photos or screenshots. I can use them as context for stop choices, route feedback, or planner troubleshooting.');
  }

  return null;
}

async function scrollAssistIntoView(): Promise<void> {
  await nextTick();

  if (!(assistShell.value instanceof HTMLElement) || typeof assistShell.value.scrollIntoView !== 'function') {
    return;
  }

  const prefersReducedMotion = typeof window !== 'undefined'
    ? (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false)
    : true;

  assistShell.value.scrollIntoView({
    block: 'start',
    behavior: prefersReducedMotion ? 'auto' : 'smooth',
  });
}

async function focusComposer(): Promise<void> {
  await scrollAssistIntoView();
  await nextTick();
  promptInput.value?.focus();
}

async function handoffPlannerBrief(options: { prompt?: string } = {}): Promise<boolean> {
  await focusComposer();

  if (loading.value) {
    return true;
  }

  prompt.value = options.prompt?.trim() || primarySuggestion.value;
  if (props.scopeAiStore) {
    clearScopeAiPendingContext(props.scopeAiStore, 'planner-handoff');
    await handleScopeAiAsk('route-action');
  } else {
    await handleAsk('route-action');
  }
  return true;
}

async function scrollThreadToBottom(): Promise<void> {
  await nextTick();
  const viewport = threadViewport.value;
  if (!viewport) {
    return;
  }

  viewport.scrollTop = viewport.scrollHeight;
}

function appendMessage(message: ChatMessage): void {
  messages.value = [...messages.value, message];
  void scrollThreadToBottom();
}

function toggleChatMenu(): void {
  chatMenuOpen.value = !chatMenuOpen.value;
}

function closeChatMenu(): void {
  chatMenuOpen.value = false;
}

function openRestartChatDialog(): void {
  closeChatMenu();
  restartDialogOpen.value = true;
}

function cancelRestartChat(): void {
  restartDialogOpen.value = false;
}

function revokeConversationAttachmentPreviews(): void {
  pendingAttachments.value.forEach(revokeAttachmentPreview);
  messages.value.forEach((message) => {
    if (message.role === 'user') {
      message.attachments?.forEach(revokeAttachmentPreview);
    }
  });
}

function confirmRestartChat(): void {
  restartDialogOpen.value = false;
  revokeConversationAttachmentPreviews();
  messages.value = [];
  pendingAttachments.value = [];
  pendingItineraryBrief.value = null;
  lastFollowUpIntent.value = null;
  clearScopeAiPendingContext(props.scopeAiStore, 'chat-restarted');
  prompt.value = '';
  workingMessage.value = DEFAULT_WORKING_MESSAGE;
  lastSuccessfulRouteActionSignature.value = '';
  isContextExpanded.value = true;
  scopeAiStructuredSuggestions.value = [];
}

function formatTranscriptFileTimestamp(date = new Date()): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
  ].join('-') + ` ${pad(date.getHours())}-${pad(date.getMinutes())}`;
}

function buildTranscriptFileName(): string {
  const timestamp = formatTranscriptFileTimestamp();
  const title = (props.tripTitle || routeLabel.value || 'Route Copilot')
    .replace(/[<>:"/\\|?*]+/g, ' ')
    .split('')
    .map((character) => (character.charCodeAt(0) < 32 ? ' ' : character))
    .join('')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 58);

  return `Scope AI Transcript - ${title || 'Route Copilot'} - ${timestamp}.txt`;
}

function formatTranscriptMessage(message: ChatMessage): string {
  if (message.role === 'user') {
    const attachments = message.attachments?.map((attachment) => attachment.name).filter(Boolean);
    return [
      `You: ${message.content || '[Image sent]'}`,
      attachments?.length ? `Attachments: ${attachments.join(', ')}` : '',
    ].filter(Boolean).join('\n');
  }

  if (message.kind === 'places') {
    const results = message.results.map((result, index) => {
      const meta = formatPlaceResultMeta(result);
      return `${index + 1}. ${result.placeName}${meta ? ` - ${meta}` : ''}`;
    });

    return [
      `Scope AI: ${message.content}`,
      message.queryLabel ? `Search: ${message.queryLabel}` : '',
      results.length ? `Places:\n${results.join('\n')}` : '',
    ].filter(Boolean).join('\n');
  }

  return `Scope AI: ${message.content}`;
}

function buildTranscriptText(): string {
  const lines = [
    'Scope AI Route Copilot Transcript',
    `Trip: ${props.tripTitle.trim() || 'Untitled trip'}`,
    `Route: ${routeLabel.value || 'No route selected'}`,
    `Exported: ${new Date().toLocaleString()}`,
    '',
    'Conversation',
    '------------',
  ];

  if (!messages.value.length) {
    lines.push('No conversation yet.');
  } else {
    messages.value.forEach((message, index) => {
      if (index > 0) {
        lines.push('');
      }
      lines.push(formatTranscriptMessage(message));
    });
  }

  return `${lines.join('\n')}\n`;
}

function downloadTranscript(text: string): void {
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = buildTranscriptFileName();
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

async function saveTranscript(): Promise<void> {
  const transcript = buildTranscriptText();
  closeChatMenu();

  try {
    downloadTranscript(transcript);
  } catch {
    await navigator.clipboard?.writeText(transcript);
  }
}

function resolveMessageContentForTraining(message: ChatMessage): string {
  if (message.role === 'user') {
    const attachmentNames = message.attachments?.map((attachment) => attachment.name).filter(Boolean).join(', ');
    return [message.content, attachmentNames ? `Attached images: ${attachmentNames}` : ''].filter(Boolean).join(' ');
  }

  if (message.kind === 'places') {
    const placeNames = message.results.map((result) => result.placeName).filter(Boolean).join(', ');
    return [message.content, placeNames ? `Places: ${placeNames}` : ''].filter(Boolean).join(' ');
  }

  return message.content;
}

function trackAiTurn(
  interactionId: string,
  userPrompt: string,
  assistantMessage: ChatMessage,
  source: ScopeAiInteractionSource,
  routeActionReason?: RouteActionReason,
): void {
  if (consent.value !== 'granted') {
    return;
  }

  if (assistantMessage.role !== 'assistant') {
    return;
  }

  trackScopeAiInteraction({
    interactionId,
    source,
    prompt: userPrompt,
    assistantResponse: resolveMessageContentForTraining(assistantMessage),
    responseKind: assistantMessage.kind,
    responseModel: assistantMessage.kind === 'text' || assistantMessage.kind === 'error' ? assistantMessage.model : 'scope-place-search',
    routeActionReason,
    placeResultCount: assistantMessage.kind === 'places' ? assistantMessage.results.length : undefined,
    conversationTurnCount: messages.value.filter((message) => message.role === 'user').length,
    hasStart: Boolean(props.draft.destination.trim()),
    hasEnd: Boolean(props.draft.endDestination?.trim()),
    stopCount: props.stops.length,
    interestCount: props.draft.interests.length,
    groupSize: props.draft.groupSize,
    pace: props.draft.pace,
    budgetFloor: props.draft.budgetFloor,
    budget: props.draft.budget,
    routeName: 'trip-planner',
  });
}

async function buildPlaceSearchMessage(intent: PlaceSearchIntent, userPrompt: string): Promise<ChatMessage> {
  const anchor = resolvePlaceSearchAnchor(userPrompt);
  const queryLabel = intent.query
    ? `${intent.query}${anchor?.label ? ` near ${anchor.label}` : ''}`
    : 'Live place search';

  if (intent.requiresAnchor && !anchor) {
    return {
      id: createMessageId('assistant'),
      role: 'assistant',
      kind: 'places',
      queryLabel,
      results: [],
      content: 'Add a start, stop, or end point first so Scope knows where to search.',
    };
  }

  const searchOptions = {
    limit: 6,
    ...(anchor ? {
      proximity: {
        latitude: anchor.latitude,
        longitude: anchor.longitude,
      },
    } : {}),
  };
  const results = intent.mode === 'locations'
    ? await searchLocations(intent.query, searchOptions)
    : await searchPlaces(intent.query, searchOptions);
  const matchLabel = intent.mode === 'locations' ? 'location match' : 'live match';
  const locationSuffix = anchor?.label ? ` near ${anchor.label}` : '';

  return {
    id: createMessageId('assistant'),
    role: 'assistant',
    kind: 'places',
    queryLabel,
    results: results.data,
    content: results.data.length
      ? `Found ${results.data.length} ${matchLabel}${results.data.length === 1 ? '' : 'es'} for "${intent.query}"${locationSuffix}.`
      : `I could not find ${matchLabel}es for "${intent.query}"${locationSuffix}. Try a more specific ${intent.mode === 'locations' ? 'name, city, or address' : 'name or category'}.`,
    ...(results.data.length ? {
      pendingContext: {
        kind: 'place-candidates',
        sourcePrompt: userPrompt,
        targetField: 'stop',
        rawValue: intent.query,
        results: results.data.map(scopeAiPlaceResultToPendingItem),
        lastAnswer: `Found ${results.data.length} ${matchLabel}${results.data.length === 1 ? '' : 'es'} for "${intent.query}"${locationSuffix}.`,
        createdAt: Date.now(),
        turnCount: 0,
      },
    } : {}),
  };
}

function buildPlaceSearchResultKey(result: PlaceSearchResult, index: number): string {
  return result.id ?? `${result.placeName}-${result.latitude}-${result.longitude}-${index}`;
}

function formatPlaceResultMeta(result: ChatPlaceResult): string {
  const details = [
    result.reason,
    result.distanceKm === undefined ? '' : `${formatMilesFromKm(result.distanceKm)} away`,
    result.formattedAddress,
    result.category,
    result.sourceLabel,
  ].filter(Boolean);

  return details.join(' - ');
}

function formatMilesFromKm(distanceKm: number): string {
  const miles = distanceKm * 0.621371;
  if (miles < 10) {
    return `${miles.toFixed(1)} mi`;
  }

  return `${Math.round(miles).toLocaleString('en-US')} mi`;
}

function getPlaceResultActionLabel(message: Extract<ChatMessage, { kind: 'places' }>): string {
  if (message.placeAction === 'set-end') {
    return 'Use as final destination';
  }

  if (message.placeAction === 'set-start') {
    return 'Use as start';
  }

  return 'Add spot';
}

function getPlaceResultActionAriaLabel(message: Extract<ChatMessage, { kind: 'places' }>, result: ChatPlaceResult): string {
  if (message.placeAction === 'set-end') {
    return `Use ${result.placeName} as the final destination`;
  }

  if (message.placeAction === 'set-start') {
    return `Use ${result.placeName} as the start point`;
  }

  return `Add ${result.placeName} as a trip spot`;
}

function emitPlaceResultAsEndpoint(result: ChatPlaceResult, target: LocationPickTarget): void {
  if (!isTrustedProviderPlaceResult(result)) {
    return;
  }

  emit('map-location-select', {
    target,
    label: result.formattedAddress || result.placeName,
    latitude: result.latitude,
    longitude: result.longitude,
    city: result.city,
    country: result.country,
  });
}

function handlePlaceSearchResultAction(message: Extract<ChatMessage, { kind: 'places' }>, result: ChatPlaceResult): void {
  if (!isTrustedProviderPlaceResult(result)) {
    appendMessage(buildLocalTextMessage('I can only apply provider-backed place results. Pick a verified result or refine the search.'));
    return;
  }

  if (message.placeAction === 'set-end') {
    emitPlaceResultAsEndpoint(result, 'endDestination');
    clearScopeAiPendingContext(props.scopeAiStore, 'place-result-selected');
    return;
  }

  if (message.placeAction === 'set-start') {
    emitPlaceResultAsEndpoint(result, 'destination');
    clearScopeAiPendingContext(props.scopeAiStore, 'place-result-selected');
    return;
  }

  addPlaceSearchResult(result);
  clearScopeAiPendingContext(props.scopeAiStore, 'place-result-selected');
}

function addPlaceSearchResult(result: ChatPlaceResult): void {
  if (!isTrustedProviderPlaceResult(result)) {
    return;
  }

  emit('route-stop-add', {
    spotId: buildPlaceSearchSpotId(result),
    title: result.placeName,
    latitude: result.latitude,
    longitude: result.longitude,
    category: inferSpotCategory(result),
    city: result.city,
    notes: result.formattedAddress,
  });
}

function buildPlaceSearchSpotId(result: PlaceSearchResult): string {
  const identifier = result.id || `${result.placeName}-${result.latitude}-${result.longitude}`;
  return `place-${identifier.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80) || Date.now().toString(36)}`;
}

function inferSpotCategory(result: PlaceSearchResult): SpotCategory {
  const value = [result.category, result.placeName, result.formattedAddress].filter(Boolean).join(' ').toLowerCase();

  if (/\b(entertainment|amusement\s*park|theme\s*park|six\s*flags|bowling|bowling\s*alley|arcade|movie\s*theater|movie\s*theatre|cinema|concert|music\s*venue|stadium|arena|zoo|aquarium|escape\s*room|laser\s*tag|mini\s*golf|carnival|fair)\b/.test(value)) {
    return 'entertainment';
  }

  if (/\b(bar|pub|club|lounge|nightlife)\b/.test(value)) {
    return 'nightlife';
  }

  if (/\b(restaurant|food|coffee|cafe|bakery|diner|eat|drink)\b/.test(value)) {
    return 'food';
  }

  if (/\b(shop|store|mall|market|retail)\b/.test(value)) {
    return 'shopping';
  }

  if (/\b(museum|gallery|theater|theatre|landmark|library|culture)\b/.test(value)) {
    return 'culture';
  }

  if (/\b(park|trail|garden|lake|beach|forest|nature)\b/.test(value)) {
    return 'nature';
  }

  if (/\b(viewpoint|scenic|overlook)\b/.test(value)) {
    return 'scenic';
  }

  if (/\b(camp|climb|ski|adventure|outdoor)\b/.test(value)) {
    return 'adventure';
  }

  return 'other';
}

async function handleSuggestionClick(suggestion: string, event?: Event): Promise<void> {
  const clickedElement = event?.currentTarget;
  if (clickedElement instanceof HTMLElement) {
    clickedElement.blur();
  }
  prompt.value = suggestion;
  if (props.scopeAiStore) {
    await handleScopeAiAsk('suggestion');
    return;
  }

  await handleAsk('suggestion');
}

async function buildPendingBriefFollowUpMessage(userReply: string): Promise<ChatMessage | null> {
  const pendingBrief = pendingItineraryBrief.value;
  if (!pendingBrief) {
    return null;
  }

  if (isItineraryBuildCancelRequest(userReply)) {
    pendingItineraryBrief.value = null;
    return {
      id: createMessageId('assistant'),
      role: 'assistant',
      kind: 'text',
      model: 'scope-action',
      content: 'No problem. I stopped that itinerary build. Ask me to build again when the route brief is ready.',
    };
  }

  const missingKeys = pendingBrief.missingKeys;
  const currentKey = missingKeys[0];
  if (!currentKey) {
    pendingItineraryBrief.value = null;
    return buildRouteActionMessage(pendingBrief.reason, pendingBrief.originalPrompt, {
      allowSmartDefaults: true,
      draftDefaults: pendingBrief.draftDefaults,
    });
  }

  if (currentKey === 'destination' || currentKey === 'endDestination') {
    pendingItineraryBrief.value = null;
    return {
      id: createMessageId('assistant'),
      role: 'assistant',
      kind: 'text',
      model: 'scope-action',
      content: 'Add both route endpoints to the route builder first, then I can build the itinerary from the planner without losing the map context.',
    };
  }

  if (isVagueBriefReply(userReply)) {
    const draftDefaults = mergeItineraryBuildDefaults(
      pendingBrief.draftDefaults,
      buildSmartDefaultsForKeys(missingKeys),
    );
    const promptWithDefaults = buildRoutePromptWithDefaults(pendingBrief.originalPrompt, draftDefaults);
    pendingItineraryBrief.value = null;
    return buildRouteActionMessage(pendingBrief.reason, promptWithDefaults, {
      allowSmartDefaults: true,
      draftDefaults,
    });
  }

  let nextDefaults = pendingBrief.draftDefaults;
  const answeredKeys = new Set<BriefQuestionKey>();

  for (const key of missingKeys) {
    const parsed = parseBriefReplyForKey(userReply, key);
    if (parsed) {
      nextDefaults = mergeItineraryBuildDefaults(nextDefaults, parsed);
      answeredKeys.add(key);
    }
  }

  if (!answeredKeys.size) {
    return buildPendingBriefReminderMessage(pendingBrief.reason, getBriefQuestion(currentKey), userReply);
  }

  const remainingKeys = missingKeys.filter((key) => !answeredKeys.has(key));
  if (remainingKeys.length) {
    pendingItineraryBrief.value = {
      ...pendingBrief,
      missingKeys: remainingKeys,
      draftDefaults: nextDefaults,
    };
    return buildMissingItineraryBriefMessage(pendingBrief.reason, getBriefQuestions(remainingKeys), true);
  }

  const promptWithDefaults = buildRoutePromptWithDefaults(pendingBrief.originalPrompt, nextDefaults);
  pendingItineraryBrief.value = null;
  return buildRouteActionMessage(pendingBrief.reason, promptWithDefaults, {
    allowSmartDefaults: true,
    draftDefaults: nextDefaults,
  });
}

function normalizeScopeAiStructuredChips(chips: string[]): string[] {
  const route = routeLabel.value || 'this route';
  const contextualFallbacks = [
    primarySuggestion.value,
    `Check timing for ${route}`,
    'Suggest the next best stop',
    'Tighten this route',
  ];
  const nextChips = mergeUniqueSuggestions(
    chips,
    buildSuggestionPool(),
    contextualFallbacks,
  ).slice(0, MAX_SUGGESTIONS);

  for (const fallback of contextualFallbacks) {
    if (nextChips.length >= MAX_SUGGESTIONS) {
      break;
    }
    if (!nextChips.includes(fallback)) {
      nextChips.push(fallback);
    }
  }

  return nextChips.slice(0, MAX_SUGGESTIONS);
}

function trackScopeAiStructuredPreferences(actionBlock: { actions?: unknown[] } | null): void {
  const scopeAiStore = props.scopeAiStore;
  if (!scopeAiStore || !Array.isArray(actionBlock?.actions)) {
    return;
  }

  for (const action of actionBlock.actions) {
    if (!action || typeof action !== 'object') {
      continue;
    }

    const candidate = action as {
      type?: unknown;
      stop?: { type?: unknown };
      stop_id?: unknown;
    };

    if (candidate.type === 'ADD_STOP' && typeof candidate.stop?.type === 'string') {
      scopeAiStore.trackAcceptedType(candidate.stop.type);
      continue;
    }

    if (candidate.type === 'REMOVE_STOP' && typeof candidate.stop_id === 'string') {
      const removedStop = scopeAiStore.plannerState?.stops?.find?.((stop: { id?: string }) => stop.id === candidate.stop_id);
      scopeAiStore.trackRejectedType(typeof removedStop?.type === 'string' ? removedStop.type : 'stop');
    }
  }
}

type ScopeAiSearchCoordinate = {
  latitude: number;
  longitude: number;
  label: string;
};

function getScopeAiSearchCoordinate(scopeAiStore: ScopeAiPlannerStoreBridge): ScopeAiSearchCoordinate | null {
  const state = scopeAiStore?.plannerState;
  if (!state) {
    return null;
  }

  if (hasCoordinatePair(state.startLatitude, state.startLongitude)) {
    return {
      latitude: Number(state.startLatitude),
      longitude: Number(state.startLongitude),
      label: state.start || 'the start',
    };
  }

  if (hasCoordinatePair(state.endLatitude, state.endLongitude)) {
    return {
      latitude: Number(state.endLatitude),
      longitude: Number(state.endLongitude),
      label: state.end || 'the end',
    };
  }

  const stop = Array.isArray(state.stops)
    ? state.stops.find((candidate: { latitude?: number; longitude?: number }) =>
        hasCoordinatePair(candidate.latitude, candidate.longitude),
      )
    : null;
  if (stop) {
    return {
      latitude: Number(stop.latitude),
      longitude: Number(stop.longitude),
      label: stop.name || 'the first stop',
    };
  }

  return null;
}

function normalizeScopeAiFuelType(value: unknown): 'all' | 'regular' | 'midgrade' | 'premium' | 'diesel' {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (normalized === 'regular' || normalized === 'midgrade' || normalized === 'premium' || normalized === 'diesel') {
    return normalized;
  }

  return 'all';
}

function formatScopeAiFuelStation(station: FuelStationPrice, index: number): string {
  const price = Number.isFinite(Number(station.pricePerUnit))
    ? `$${Number(station.pricePerUnit).toFixed(2)}/gal`
    : 'price unavailable';
  const distance = Number.isFinite(Number(station.distanceKm))
    ? `${Number(station.distanceKm).toFixed(1)} km away`
    : 'nearby';
  const address = station.address ? ` on ${station.address}` : '';
  return `${index + 1}. ${station.name} - ${price}, ${distance}${address}`;
}

function formatScopeAiNearbyPlace(place: NearbyPlaceResult, index: number): string {
  const category = place.categoryLabel || place.category || 'place';
  const distance = Number.isFinite(Number(place.distanceKm))
    ? `${Number(place.distanceKm).toFixed(1)} km away`
    : 'nearby';
  const address = place.formattedAddress ? ` - ${place.formattedAddress}` : '';
  return `${index + 1}. ${place.placeName} (${category}), ${distance}${address}`;
}

function mapScopeAiNearbyCategory(category: unknown): string[] | undefined {
  const normalized = String(category ?? '').trim().toLowerCase();
  const categoryMap: Record<string, string[]> = {
    food: ['restaurant', 'food_and_drink'],
    coffee: ['coffee', 'cafe'],
    outdoors: ['park'],
    views: ['tourist_attraction', 'park'],
    scenic: ['tourist_attraction', 'park'],
    culture: ['museum', 'tourist_attraction'],
    shopping: ['shopping'],
    entertainment: ['amusement_park', 'bowling_alley', 'movie_theater', 'tourist_attraction'],
    nightlife: ['bar'],
    restrooms: ['restaurant', 'cafe', 'hotel'],
    fuel: ['gas_station'],
  };

  return categoryMap[normalized];
}

async function buildScopeAiFuelSearchMessage(scopeAiStore: ScopeAiPlannerStoreBridge, action: { sort_by?: unknown; radius_km?: unknown; limit?: unknown; fuel_type?: unknown }): Promise<ChatMessage | null> {
  const coordinate = getScopeAiSearchCoordinate(scopeAiStore);
  if (!coordinate) {
    return {
      id: createMessageId('assistant'),
      role: 'assistant',
      kind: 'text',
      content: 'Set a start, end, or stop first and I can look up nearby fuel from there.',
    };
  }

  const sortBy = action.sort_by === 'best_price' ? 'best_price' : 'closest';
  const radiusKm = Number.isFinite(Number(action.radius_km)) ? Math.max(1, Math.min(Number(action.radius_km), 50)) : 10;
  const limit = Number.isFinite(Number(action.limit)) ? Math.max(1, Math.min(Math.round(Number(action.limit)), 8)) : 5;
  const fuelType = normalizeScopeAiFuelType(action.fuel_type ?? scopeAiStore.plannerState?.fuel_type);
  const lookup = await getNearbyFuelStations({
    latitude: coordinate.latitude,
    longitude: coordinate.longitude,
    radiusKm,
    fuelType,
    limit,
    sortBy,
  });
  const stations = lookup.stations.slice(0, limit);
  const content = stations.length
    ? `Fuel near ${coordinate.label}:\n${stations.map(formatScopeAiFuelStation).join('\n')}\nFuel source: configured fuel lookup.\nWant me to set gas price to the cheapest one?`
    : `I could not find live fuel prices near ${coordinate.label} within ${radiusKm} km.`;

  return {
    id: createMessageId('assistant'),
    role: 'assistant',
    kind: 'text',
    content,
    pendingContext: {
      kind: 'fuel-results',
      sourcePrompt: `fuel near ${coordinate.label}`,
      targetField: 'fuel',
      rawValue: fuelType,
      results: stations.map((station, index) => scopeAiFuelStationToPendingItem(station, index, lookup.source)),
      lastAnswer: content,
      createdAt: Date.now(),
      turnCount: 0,
    },
  };
}

async function buildScopeAiNearbyPlacesMessage(scopeAiStore: ScopeAiPlannerStoreBridge, action: { category?: unknown; limit?: unknown; radius_km?: unknown }): Promise<ChatMessage | null> {
  const coordinate = getScopeAiSearchCoordinate(scopeAiStore);
  if (!coordinate) {
    return {
      id: createMessageId('assistant'),
      role: 'assistant',
      kind: 'text',
      content: 'Set a start, end, or stop first and I can search nearby places from there.',
    };
  }

  const limit = Number.isFinite(Number(action.limit)) ? Math.max(1, Math.min(Math.round(Number(action.limit)), 10)) : 6;
  const radiusKm = Number.isFinite(Number(action.radius_km)) ? Math.max(1, Math.min(Number(action.radius_km), 80)) : null;
  const categories = mapScopeAiNearbyCategory(action.category);
  const { data } = await searchNearbyPlaces({
    center: {
      latitude: coordinate.latitude,
      longitude: coordinate.longitude,
    },
    categories,
    limit,
  });
  const radiusFiltered = radiusKm
    ? data.filter((place) => !Number.isFinite(Number(place.distanceKm)) || Number(place.distanceKm) <= radiusKm)
    : data;
  const places = radiusFiltered.slice(0, limit);
  const categoryLabel = action.category ? ` ${String(action.category).trim()}` : '';
  const radiusLabel = radiusKm ? ` within ${formatMilesFromKm(radiusKm)}` : '';
  const content = places.length
    ? `Nearby${categoryLabel} picks near ${coordinate.label}${radiusLabel}:\n${places.map(formatScopeAiNearbyPlace).join('\n')}\nWant me to add any of these as a stop?`
    : `I could not find nearby${categoryLabel} places around ${coordinate.label}${radiusLabel} yet.`;

  return {
    id: createMessageId('assistant'),
    role: 'assistant',
    kind: 'text',
    content,
    pendingContext: {
      kind: 'nearby-results',
      sourcePrompt: `nearby${categoryLabel} near ${coordinate.label}`,
      targetField: 'stop',
      rawValue: String(action.category ?? 'nearby places'),
      results: places.map(scopeAiNearbyPlaceToPendingItem),
      lastAnswer: content,
      createdAt: Date.now(),
      turnCount: 0,
    },
  };
}

async function buildScopeAiActionFollowUpMessages(actionBlock: { actions?: unknown[] } | null): Promise<ChatMessage[]> {
  const scopeAiStore = props.scopeAiStore;
  if (!scopeAiStore || !Array.isArray(actionBlock?.actions)) {
    return [];
  }

  const messagesToAppend: ChatMessage[] = [];
  for (const action of actionBlock.actions) {
    if (!action || typeof action !== 'object') {
      continue;
    }

    const candidate = action as { type?: unknown; [key: string]: unknown };
    try {
      if (candidate.type === 'SEARCH_NEARBY_FUEL') {
        const message = await buildScopeAiFuelSearchMessage(scopeAiStore, candidate);
        if (message) {
          messagesToAppend.push(message);
        }
      } else if (candidate.type === 'SEARCH_NEARBY_PLACES') {
        const message = await buildScopeAiNearbyPlacesMessage(scopeAiStore, candidate);
        if (message) {
          messagesToAppend.push(message);
        }
      }
    } catch {
      messagesToAppend.push({
        id: createMessageId('assistant'),
        role: 'assistant',
        kind: 'text',
        content: 'That lookup did not finish cleanly. The route edits still applied.',
      });
    }
  }

  return messagesToAppend;
}

function normalizeScopeAiMapCommand(value: unknown): ScopeAiMapCommand | null {
  const normalized = String(value ?? '').trim().toLowerCase().replace(/[-\s]+/g, '_');
  const allowed = new Set<ScopeAiMapCommand>([
    'zoom_in',
    'zoom_out',
    'zoom_to_place',
    'reset_map',
    'fit_route',
    'locate_user',
    'map_style_light',
    'map_style_dark',
  ]);
  return allowed.has(normalized as ScopeAiMapCommand) ? normalized as ScopeAiMapCommand : null;
}

function normalizeTripInviteRole(value: unknown): 'editor' | 'viewer' {
  return String(value ?? '').toLowerCase() === 'viewer' ? 'viewer' : 'editor';
}

function isDeleteCancelPrompt(value: string): boolean {
  return /^(?:cancel|nevermind|never mind|no|stop|keep it|do not delete|don't delete)(?:\s+(?:delete|deletion|that|it|the draft|this draft))?[.!?]*$/i.test(value.trim());
}

function isDeleteConfirmPrompt(value: string): boolean {
  return /^(?:confirm\s+delete|yes\s+delete|delete\s+it)[.!?]*$/i.test(value.trim());
}

function isDeleteRequestPrompt(value: string): boolean {
  return /\b(?:delete|remove)\s+(?:this\s+|the\s+|my\s+)?(?:trip|draft|route)\b|\bdelete it\b/i.test(value);
}

async function runTripCommand(payload: ScopeAiTripCommandPayload): Promise<ScopeAiCommandResult> {
  if (!props.executeTripCommand) {
    const fallbackMessages: Record<ScopeAiTripCommandPayload['type'], string> = {
      save: 'Saving this trip draft.',
      share: 'Opening sharing for this trip draft.',
      delete: 'Deleting this trip draft.',
      visibility: payload.type === 'visibility' && payload.isPublic ? 'Making this trip public.' : 'Making this trip private.',
      invite: payload.type === 'invite' ? `Inviting ${payload.recipient}.` : 'Inviting that member.',
    };
    return {
      ok: true,
      message: fallbackMessages[payload.type],
    };
  }

  return await props.executeTripCommand(payload);
}

async function runMapCommand(payload: ScopeAiMapCommandPayload): Promise<ScopeAiCommandResult> {
  const command = payload.command;
  if (!props.executeMapCommand) {
    const fallbackMessages: Record<ScopeAiMapCommand, string> = {
      zoom_in: 'Zooming the planner map in.',
      zoom_out: 'Zooming the planner map out.',
      zoom_to_place: payload.query ? `Zooming the planner map to ${payload.query}.` : 'Zooming the planner map to that place.',
      reset_map: 'Resetting the planner map view.',
      fit_route: 'Fitting the planner map to the route.',
      locate_user: 'Centering the planner map on your location if the browser allows it.',
      map_style_light: 'Switching only the planner map to bright mode.',
      map_style_dark: 'Switching only the planner map to dark mode.',
    };
    return {
      ok: true,
      message: fallbackMessages[command],
    };
  }

  return await props.executeMapCommand(payload);
}

async function executeScopeAiUiActions(actionBlock: ScopeAiActionBlock | null): Promise<ScopeAiCommandResult | null> {
  if (!actionBlock?.actions.length) {
    return null;
  }

  const messages: string[] = [];
  let chips: string[] | undefined;

  for (const action of actionBlock.actions) {
    const candidate = action as { type?: unknown; [key: string]: unknown };
    const actionType = String(candidate.type ?? '');
    if (![
      'SAVE_TRIP_DRAFT',
      'REQUEST_DELETE_TRIP_DRAFT',
      'DELETE_TRIP_DRAFT',
      'OPEN_SHARE_MODAL',
      'INVITE_TRIP_MEMBER',
      'SET_TRIP_VISIBILITY',
      'SET_MAP_COMMAND',
    ].includes(actionType)) {
      if (pendingDeleteConfirmation.value) {
        pendingDeleteConfirmation.value = false;
      }
      continue;
    }

    if (actionType !== 'REQUEST_DELETE_TRIP_DRAFT' && actionType !== 'DELETE_TRIP_DRAFT') {
      pendingDeleteConfirmation.value = false;
    }

    if (actionType === 'REQUEST_DELETE_TRIP_DRAFT') {
      pendingDeleteConfirmation.value = true;
      messages.push('I can delete this trip draft, but I need one confirmation first. Reply "confirm delete" to delete it.');
      chips = ['Confirm delete', 'Cancel delete', 'Save this draft'];
      continue;
    }

    if (actionType === 'DELETE_TRIP_DRAFT') {
      if (!pendingDeleteConfirmation.value) {
        pendingDeleteConfirmation.value = true;
        messages.push('I need one confirmation before deleting this trip draft. Reply "confirm delete" to delete it.');
        chips = ['Confirm delete', 'Cancel delete', 'Save this draft'];
        continue;
      }

      pendingDeleteConfirmation.value = false;
      const result = await runTripCommand({ type: 'delete' });
      messages.push(result.message);
      chips = result.chips ?? ['Start a new route', 'Open trips', 'Build a route'];
      continue;
    }

    if (actionType === 'SAVE_TRIP_DRAFT') {
      const result = await runTripCommand({ type: 'save' });
      messages.push(result.message);
      chips = result.chips ?? ['Share this trip', 'Make it public', 'Build the itinerary'];
      continue;
    }

    if (actionType === 'OPEN_SHARE_MODAL') {
      const result = await runTripCommand({ type: 'share' });
      messages.push(result.message);
      chips = result.chips ?? ['Invite a member', 'Make private', 'Check route status'];
      continue;
    }

    if (actionType === 'INVITE_TRIP_MEMBER') {
      const recipient = sanitizeScopeAiVisibleText(String(candidate.recipient ?? '')).trim();
      if (!recipient) {
        messages.push('Tell me the registered Scope username, name, or account email to invite.');
        chips = ['Open sharing', 'Invite @maya', 'Share this trip'];
        continue;
      }

      const result = await runTripCommand({
        type: 'invite',
        recipient,
        role: normalizeTripInviteRole(candidate.role),
      });
      messages.push(result.message);
      chips = result.chips ?? ['Open sharing', 'Make private', 'Check route status'];
      continue;
    }

    if (actionType === 'SET_TRIP_VISIBILITY') {
      const isPublic = Boolean(candidate.is_public ?? candidate.isPublic);
      const result = await runTripCommand({ type: 'visibility', isPublic });
      messages.push(result.message);
      chips = result.chips ?? (isPublic ? ['Share this trip', 'Invite a member', 'Build the itinerary'] : ['Open sharing', 'Make public', 'Check route status']);
      continue;
    }

    if (actionType === 'SET_MAP_COMMAND') {
      const command = normalizeScopeAiMapCommand(candidate.command);
      if (!command) {
        messages.push('I could not match that map command to a planner map control.');
        chips = ['Reset map', 'Fit route', 'Locate me'];
        continue;
      }

      const query = sanitizeScopeAiVisibleText(String(candidate.query ?? '')).trim();
      const result = await runMapCommand(query ? { command, query } : { command });
      messages.push(result.message);
      chips = result.chips ?? ['Reset map', 'Fit route', 'Find verified stops'];
    }
  }

  if (!messages.length) {
    return null;
  }

  return {
    ok: true,
    message: messages.join('\n'),
    chips,
  };
}

function isScopeAiActionBlockApplyResult(value: unknown): value is ScopeAiActionBlockApplyResult {
  return Boolean(
    value &&
    typeof value === 'object' &&
    'applied' in value &&
    Array.isArray((value as ScopeAiActionBlockApplyResult).resolutions),
  );
}

function hasLocationMutationAction(actionBlock: ScopeAiActionBlock): boolean {
  return actionBlock.actions.some((action) => (
    (action.type === 'SET_FIELD' && ['start', 'destination', 'end', 'endDestination'].includes(action.field))
    || action.type === 'ADD_STOP'
  ));
}

function buildUnverifiedLocationApplyResult(actionBlock: ScopeAiActionBlock): ScopeAiActionBlockApplyResult {
  return {
    applied: false,
    resolutions: actionBlock.actions
      .filter((action) => (
        (action.type === 'SET_FIELD' && ['start', 'destination', 'end', 'endDestination'].includes(action.field))
        || action.type === 'ADD_STOP'
      ))
      .map((action): ScopeAiActionResolution => {
        if (action.type === 'ADD_STOP') {
          return {
            type: 'stop',
            field: 'stop',
            rawValue: [action.stop.address, action.stop.name].filter(Boolean).join(' ') || 'stop',
            status: 'not_found',
            candidates: [],
          };
        }

        return {
          type: 'endpoint',
          field: action.field === 'start' || action.field === 'destination' ? 'start' : 'end',
          rawValue: String(action.value ?? ''),
          status: 'not_found',
          candidates: [],
        };
      }),
  };
}

async function applyScopeAiStoreActionBlock(scopeAiStore: ScopeAiPlannerStoreBridge, actionBlock: ScopeAiActionBlock): Promise<ScopeAiActionBlockApplyResult> {
  if (typeof scopeAiStore.applyActionBlockResolved === 'function') {
    const result = await scopeAiStore.applyActionBlockResolved(actionBlock);
    if (isScopeAiActionBlockApplyResult(result)) {
      return result;
    }
  }

  if (hasLocationMutationAction(actionBlock)) {
    return buildUnverifiedLocationApplyResult(actionBlock);
  }

  const applied = typeof scopeAiStore.applyActionBlock === 'function'
    ? Boolean(scopeAiStore.applyActionBlock(actionBlock))
    : false;
  return {
    applied,
    resolutions: [],
  };
}

function getScopeAiPendingContext(scopeAiStore: ScopeAiPlannerStoreBridge): ScopeAiPendingScopeAiContext | null {
  const candidate = scopeAiStore?.pendingScopeAiContext;
  const context = candidate && typeof candidate === 'object' && 'value' in candidate
    ? (candidate as { value?: ScopeAiPendingScopeAiContext | null }).value ?? null
    : candidate ?? null;
  if (!context) {
    return null;
  }

  const createdAt = Number(context.createdAt);
  if (Number.isFinite(createdAt) && Date.now() - createdAt > MAX_PENDING_SCOPE_AI_CONTEXT_AGE_MS) {
    clearScopeAiPendingContext(scopeAiStore, 'pending-context-expired');
    return null;
  }

  return context;
}

function setScopeAiPendingContext(scopeAiStore: ScopeAiPlannerStoreBridge, context: Omit<ScopeAiPendingScopeAiContext, 'createdAt' | 'turnCount'> & Partial<Pick<ScopeAiPendingScopeAiContext, 'createdAt' | 'turnCount'>>): void {
  scopeAiStore?.setPendingScopeAiContext?.(context);
}

function clearScopeAiPendingContext(scopeAiStore: ScopeAiPlannerStoreBridge, reason: string): void {
  scopeAiStore?.clearPendingScopeAiContext?.(reason);
}

function incrementScopeAiPendingContext(scopeAiStore: ScopeAiPlannerStoreBridge): void {
  scopeAiStore?.incrementPendingScopeAiContextTurn?.();
}

function formatScopeAiDashList(values: string[]): string {
  return values
    .map((value) => value.trim())
    .filter(Boolean)
    .slice(0, 5)
    .map((value) => `- ${value}`)
    .join('\n');
}

function scopeAiLocationCandidateItems(labels: string[]): ScopeAiPendingContextItem[] {
  return labels
    .map((label) => label.trim())
    .filter(Boolean)
    .slice(0, 5)
    .map((label) => ({
      label,
      value: label,
    }));
}

function scopeAiPlaceResultToPendingItem(result: ChatPlaceResult): ScopeAiPendingContextItem {
  const value = result.formattedAddress || result.address || result.placeName;
  return {
    id: result.id,
    label: result.placeName,
    value,
    source: result.sourceLabel || result.source,
    latitude: result.latitude,
    longitude: result.longitude,
    meta: {
      address: result.formattedAddress || result.address,
      category: result.category,
      city: result.city,
      country: result.country,
      distanceKm: result.distanceKm,
      reason: result.reason,
      source: result.source,
      providerVerified: isTrustedProviderPlaceResult(result),
    },
  };
}

function scopeAiFuelStationToPendingItem(station: FuelStationPrice, index: number, lookupSource = 'configured fuel lookup'): ScopeAiPendingContextItem {
  const providerVerified = isTrustedProviderLabel(lookupSource) && (station.source === undefined || isTrustedProviderLabel(station.source));
  return {
    id: station.id,
    label: formatScopeAiFuelStation(station, index),
    value: station.name,
    source: station.source || lookupSource || 'configured fuel lookup',
    latitude: station.latitude,
    longitude: station.longitude,
    meta: {
      address: station.address,
      distanceKm: station.distanceKm,
      fuelType: station.fuelType,
      pricePerUnit: station.pricePerUnit,
      currency: station.currency,
      isOpen: station.isOpen,
      providerVerified,
    },
  };
}

function scopeAiNearbyPlaceToPendingItem(place: NearbyPlaceResult, index: number): ScopeAiPendingContextItem {
  return {
    id: place.id,
    label: formatScopeAiNearbyPlace(place, index),
    value: place.formattedAddress || place.address || place.placeName,
    source: place.source,
    latitude: place.latitude,
    longitude: place.longitude,
    meta: {
      address: place.formattedAddress || place.address,
      category: place.category || place.categoryId,
      categoryLabel: place.categoryLabel,
      city: place.city,
      country: place.country,
      distanceKm: place.distanceKm,
      placeName: place.placeName,
      source: place.source,
      providerVerified: isTrustedProviderPlaceResult(place),
    },
  };
}

function formatLocationCandidateList(resolution: ScopeAiActionResolution): string {
  return formatScopeAiDashList(resolution.candidates.slice(0, 3));
}

function getLocationResolutionTargetLabel(resolution: ScopeAiActionResolution): string {
  if (resolution.field === 'start') {
    return 'start place';
  }

  if (resolution.field === 'end') {
    return 'final destination';
  }

  return 'stop';
}

type ScopeAiPlannerAction = ScopeAiActionBlock['actions'][number];

function getPlannerActionFieldLabel(field: string): string {
  const labels: Record<string, string> = {
    title: 'trip title',
    budget_min: 'minimum budget',
    budget_max: 'maximum budget',
    start_date: 'start date',
    date: 'start date',
    end_date: 'end date',
    party_size: 'travelers',
    pace: 'pace',
    theme: 'vibes',
    fuel_type: 'fuel type',
    mpg: 'MPG',
    gas_price: 'gas price',
  };

  return labels[field] ?? field.replace(/_/g, ' ');
}

function getResolutionForAction(action: ScopeAiPlannerAction, result: ScopeAiActionBlockApplyResult | null): ScopeAiActionResolution | undefined {
  if (!result?.resolutions.length) {
    return undefined;
  }

  if (action.type === 'SET_FIELD' && (action.field === 'start' || action.field === 'destination')) {
    return result.resolutions.find((resolution) => resolution.type === 'endpoint' && resolution.field === 'start');
  }

  if (action.type === 'SET_FIELD' && ['end', 'endDestination', 'destination'].includes(action.field)) {
    return result.resolutions.find((resolution) => resolution.type === 'endpoint' && resolution.field === 'end');
  }

  if (action.type === 'ADD_STOP') {
    return result.resolutions.find((resolution) => resolution.type === 'stop' && normalizeActionLookupValue(resolution.rawValue) === normalizeActionLookupValue([
      action.stop.address,
      action.stop.name,
    ].filter(Boolean).join(' ')));
  }

  return undefined;
}

function getAppliedPlannerActionLabels(actionBlock: ScopeAiActionBlock | null, result: ScopeAiActionBlockApplyResult | null): string[] {
  if (!actionBlock?.actions.length) {
    return [];
  }

  const labels: string[] = [];
  const seenLabels = new Set<string>();
  const addLabel = (label: string) => {
    if (!seenLabels.has(label)) {
      labels.push(label);
      seenLabels.add(label);
    }
  };

  for (const action of actionBlock.actions) {
    const resolution = getResolutionForAction(action, result);
    if (resolution && resolution.status !== 'resolved') {
      continue;
    }

    if (action.type === 'SET_FIELD') {
      const normalizedField = action.field === 'destination'
        ? 'start'
        : action.field === 'endDestination'
          ? 'end'
          : action.field;
      if (normalizedField === 'start') {
        addLabel('start place');
      } else if (normalizedField === 'end') {
        addLabel('final destination');
      } else {
        addLabel(getPlannerActionFieldLabel(normalizedField));
      }
      continue;
    }

    if (action.type === 'ADD_STOP') {
      addLabel('verified stop');
      continue;
    }

    if (action.type === 'SEARCH_NEARBY_FUEL') {
      addLabel('nearby fuel lookup');
      continue;
    }

    if (action.type === 'SEARCH_NEARBY_PLACES') {
      addLabel('nearby places lookup');
    }
  }

  return labels;
}

function formatAppliedPlannerActionPrefix(actionBlock: ScopeAiActionBlock | null, result: ScopeAiActionBlockApplyResult | null): string {
  const labels = getAppliedPlannerActionLabels(actionBlock, result);
  if (!labels.length) {
    return '';
  }

  return `Applied ${labels.join(', ')}. `;
}

function buildLocationResolutionConfirmation(
  fallbackText: string,
  result: ScopeAiActionBlockApplyResult | null,
  actionBlock: ScopeAiActionBlock | null = null,
): string {
  const resolutions = result?.resolutions ?? [];
  if (!resolutions.length) {
    return fallbackText;
  }

  const appliedPrefix = formatAppliedPlannerActionPrefix(actionBlock, result);
  const ambiguous = resolutions.find((resolution) => resolution.status === 'ambiguous');
  if (ambiguous) {
    const candidates = formatLocationCandidateList(ambiguous);
    const target = getLocationResolutionTargetLabel(ambiguous);
    return candidates
      ? `${appliedPrefix}I found a few possible matches for the ${target} "${ambiguous.rawValue}".\n${candidates}\nNext: Reply with a state/city, a number, or pick one on the map.`
      : `${appliedPrefix}I found more than one possible match for the ${target} "${ambiguous.rawValue}". Reply with a state/city, a number, or pick one on the map.`;
  }

  const notFound = resolutions.find((resolution) => resolution.status === 'not_found');
  if (notFound) {
    const target = getLocationResolutionTargetLabel(notFound);
    return `${appliedPrefix}I could not find a confident match for the ${target} "${notFound.rawValue}". Add the city or state, or use the map picker so I do not set the wrong place.`;
  }

  const resolved = resolutions.filter((resolution) => resolution.status === 'resolved' && resolution.resolvedLabel);
  if (resolved.length >= 2) {
    const start = resolved.find((resolution) => resolution.field === 'start')?.resolvedLabel;
    const end = resolved.find((resolution) => resolution.field === 'end')?.resolvedLabel;
    if (start && end) {
      return `Set the route endpoints to ${start} and ${end}.`;
    }
  }

  const onlyResolved = resolved[0];
  if (onlyResolved?.resolvedLabel) {
    if (onlyResolved.field === 'stop') {
      return `Added the stop as ${onlyResolved.resolvedLabel}.`;
    }

    const target = getLocationResolutionTargetLabel(onlyResolved);
    return `Set the ${target} to ${onlyResolved.resolvedLabel}.`;
  }

  return fallbackText;
}

interface PendingScopeAiFollowUpResolution {
  assistantMessage: ChatMessage;
  followUpMessages?: ChatMessage[];
  actionApplyResult?: ScopeAiActionBlockApplyResult | null;
  appliedActionBlock?: ScopeAiActionBlock | null;
  intentKind?: FollowUpIntentKind;
}

const SCOPE_AI_STATE_ALIASES: Record<string, string> = {
  alabama: 'Alabama',
  alaska: 'Alaska',
  arizona: 'Arizona',
  arkansas: 'Arkansas',
  california: 'California',
  colorado: 'Colorado',
  connecticut: 'Connecticut',
  delaware: 'Delaware',
  florida: 'Florida',
  georgia: 'Georgia',
  hawaii: 'Hawaii',
  idaho: 'Idaho',
  illinois: 'Illinois',
  indiana: 'Indiana',
  iowa: 'Iowa',
  kansas: 'Kansas',
  kentucky: 'Kentucky',
  louisiana: 'Louisiana',
  maine: 'Maine',
  maryland: 'Maryland',
  massachusetts: 'Massachusetts',
  michigan: 'Michigan',
  minnesota: 'Minnesota',
  mississippi: 'Mississippi',
  missouri: 'Missouri',
  montana: 'Montana',
  nebraska: 'Nebraska',
  nevada: 'Nevada',
  'new hampshire': 'New Hampshire',
  'new jersey': 'New Jersey',
  'new mexico': 'New Mexico',
  'new york': 'New York',
  'north carolina': 'North Carolina',
  'north dakota': 'North Dakota',
  ohio: 'Ohio',
  oklahoma: 'Oklahoma',
  oregon: 'Oregon',
  pennsylvania: 'Pennsylvania',
  'rhode island': 'Rhode Island',
  'south carolina': 'South Carolina',
  'south dakota': 'South Dakota',
  tennessee: 'Tennessee',
  texas: 'Texas',
  utah: 'Utah',
  vermont: 'Vermont',
  virginia: 'Virginia',
  washington: 'Washington',
  'west virginia': 'West Virginia',
  wisconsin: 'Wisconsin',
  wyoming: 'Wyoming',
  al: 'Alabama',
  ak: 'Alaska',
  az: 'Arizona',
  ar: 'Arkansas',
  ca: 'California',
  co: 'Colorado',
  ct: 'Connecticut',
  de: 'Delaware',
  fl: 'Florida',
  ga: 'Georgia',
  hi: 'Hawaii',
  id: 'Idaho',
  il: 'Illinois',
  in: 'Indiana',
  ia: 'Iowa',
  ks: 'Kansas',
  ky: 'Kentucky',
  la: 'Louisiana',
  me: 'Maine',
  md: 'Maryland',
  ma: 'Massachusetts',
  mi: 'Michigan',
  mn: 'Minnesota',
  ms: 'Mississippi',
  mo: 'Missouri',
  mt: 'Montana',
  ne: 'Nebraska',
  nv: 'Nevada',
  nh: 'New Hampshire',
  nj: 'New Jersey',
  nm: 'New Mexico',
  ny: 'New York',
  nc: 'North Carolina',
  nd: 'North Dakota',
  oh: 'Ohio',
  ok: 'Oklahoma',
  or: 'Oregon',
  pa: 'Pennsylvania',
  ri: 'Rhode Island',
  sc: 'South Carolina',
  sd: 'South Dakota',
  tn: 'Tennessee',
  tx: 'Texas',
  ut: 'Utah',
  vt: 'Vermont',
  va: 'Virginia',
  wa: 'Washington',
  wv: 'West Virginia',
  wi: 'Wisconsin',
  wy: 'Wyoming',
};

function getPendingContextItems(context: ScopeAiPendingScopeAiContext): ScopeAiPendingContextItem[] {
  return [...(context.candidates ?? []), ...(context.results ?? [])].filter((item) => item.label?.trim());
}

function extractOrdinalSelection(value: string): number | null {
  const normalized = value.trim().toLowerCase();
  const ordinalPatterns: Array<[RegExp, number]> = [
    [/\b(?:first|1st|number\s+1|#?1)\b/, 0],
    [/\b(?:second|2nd|number\s+2|#?2)\b/, 1],
    [/\b(?:third|3rd|number\s+3|#?3)\b/, 2],
    [/\b(?:fourth|4th|number\s+4|#?4)\b/, 3],
    [/\b(?:fifth|5th|number\s+5|#?5)\b/, 4],
  ];
  const match = ordinalPatterns.find(([pattern]) => pattern.test(normalized));
  return match ? match[1] : null;
}

function extractStateQualifier(value: string): string | null {
  const normalized = value.toLowerCase().replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!normalized) {
    return null;
  }

  const aliases = Object.keys(SCOPE_AI_STATE_ALIASES).sort((left, right) => right.length - left.length);
  const match = aliases.find((alias) => new RegExp(`\\b${alias.replace(/\s+/g, '\\s+')}\\b`, 'i').test(normalized));
  return match ? SCOPE_AI_STATE_ALIASES[match] : null;
}

function cleanupFollowUpQualifier(value: string): string | null {
  const state = extractStateQualifier(value);
  if (state) {
    return state;
  }

  const match = value.match(/\b(?:in|near|around|by|at|close to|within)\s+(.+)$/i);
  const raw = match?.[1] ?? value;
  const cleaned = raw
    .replace(/\b(?:is|are|there|one|ones|any|the|that|this|exact|match|matches|place|location|city|state|pick|choose|use|please|pls)\b/gi, ' ')
    .replace(/\b(?:first|second|third|fourth|fifth|1st|2nd|3rd|4th|5th|#?\d+)\b/gi, ' ')
    .replace(/[?!.,]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!cleaned || cleaned.length < 2 || cleaned.split(/\s+/).length > 5) {
    return null;
  }

  return cleaned;
}

function cleanupReplacementLocationQuery(value: string): string | null {
  let cleaned = value
    .trim()
    .replace(/^["'`]+|["'`]+$/g, '')
    .replace(/[.!?]+$/g, '')
    .replace(/\s+/g, ' ');

  cleaned = cleaned
    .replace(/^(?:no\s+like|not\s+like|nah\s+like|no|nah|nope|wait|oops|sorry|actually|really|instead|correction|wrong|wrong one|change it|make it|make that|it is|it's|it should be|should be|use|try)\b[\s,:-]*/i, '')
    .replace(/^(?:to|at|in|from|is|as|set|with|be)\s+/i, '')
    .replace(/\s+(?:please|pls|thanks|for real|if that makes sense|no guessing|do not guess|don't guess)$/i, '')
    .trim();

  if (!cleaned || !STREET_ADDRESS_PATTERN.test(cleaned)) {
    return null;
  }

  return cleaned;
}

function isLikelyStaleRawLocationContext(value: string | undefined): boolean {
  const normalized = (value ?? '').toLowerCase().replace(/\s+/g, ' ').trim();
  if (!normalized || STREET_ADDRESS_PATTERN.test(normalized)) {
    return false;
  }

  return /\b(?:trip|vibe|vibes|nightlife|culture|food|scenic|adventure|nature|shopping|entertainment|bowling|arcade|theme\s*park|family|luxury|budget|pace|travelers?|weather|fuel|gas|route|itinerary|build|find|search|show|help|pick|choose|suggest|recommend)\b/.test(normalized);
}

function extractLocationDisambiguationQualifier(value: string): string | null {
  const state = extractStateQualifier(value);
  if (state) {
    return state;
  }

  if (!/\b(?:in|near|around|by|at|close to|within)\b/i.test(value)) {
    return null;
  }

  const qualifier = cleanupFollowUpQualifier(value);
  if (!qualifier || /\b(?:more|show|details?|why|compare|source|vibe|trip|route|build|find|search|weather|fuel|gas|budget|pace|travelers?)\b/i.test(qualifier)) {
    return null;
  }

  return qualifier;
}

function buildPendingLocationFollowUpQuery(
  promptValue: string,
  context: ScopeAiPendingScopeAiContext,
  selected: ScopeAiPendingContextItem | null = selectPendingContextItem(promptValue, context),
): string | null {
  if (selected) {
    return selected.value || selected.label || null;
  }

  const replacementQuery = cleanupReplacementLocationQuery(promptValue);
  if (replacementQuery) {
    return replacementQuery;
  }

  const qualifier = extractLocationDisambiguationQualifier(promptValue);
  if (!qualifier || isLikelyStaleRawLocationContext(context.rawValue)) {
    return null;
  }

  return [context.rawValue, qualifier].filter(Boolean).join(' ').trim() || null;
}

function selectPendingContextItem(value: string, context: ScopeAiPendingScopeAiContext): ScopeAiPendingContextItem | null {
  const items = getPendingContextItems(context);
  if (!items.length) {
    return null;
  }

  const ordinal = extractOrdinalSelection(value);
  if (ordinal !== null) {
    return items[ordinal] ?? null;
  }

  const qualifier = cleanupFollowUpQualifier(value);
  const normalizedPrompt = normalizeActionLookupValue(qualifier ?? value);
  if (!normalizedPrompt) {
    return null;
  }

  const matches = items.filter((item) => {
    const haystack = normalizeActionLookupValue([
      item.label,
      item.value,
      item.source,
      item.meta?.address,
      item.meta?.city,
      item.meta?.category,
      item.meta?.categoryLabel,
      item.meta?.placeName,
      item.meta?.reason,
    ].filter(Boolean).join(' '));
    return haystack.includes(normalizedPrompt);
  });

  return matches.length === 1 ? matches[0] : null;
}

function extractRadiusKmFromFollowUp(value: string): number | null {
  const match = value.match(/\b(?:within|under|inside|radius)\s+(\d+(?:\.\d+)?)\s*(mi|mile|miles|km|kilometer|kilometers)?\b/i);
  if (!match?.[1]) {
    return null;
  }

  const amount = Number(match[1]);
  if (!Number.isFinite(amount) || amount <= 0) {
    return null;
  }

  const unit = (match[2] ?? 'mi').toLowerCase();
  const km = unit.startsWith('km') || unit.startsWith('kilometer') ? amount : amount * 1.609344;
  return Math.max(1, Math.min(km, 80));
}

function inferNearbyCategoryFromFollowUp(value: string, fallback?: string): string {
  const normalized = value.toLowerCase();
  if (/\b(coffee|cafe|espresso|latte)\b/.test(normalized)) {
    return 'coffee';
  }
  if (/\b(gas|fuel|station|diesel|charge|charging)\b/.test(normalized)) {
    return 'fuel';
  }
  if (/\b(food|restaurant|lunch|dinner|breakfast|eat)\b/.test(normalized)) {
    return 'food';
  }
  if (/\b(park|trail|outdoor|nature)\b/.test(normalized)) {
    return 'outdoors';
  }
  if (/\b(view|scenic|overlook|photo)\b/.test(normalized)) {
    return 'scenic';
  }
  if (/\b(museum|culture|historic|gallery)\b/.test(normalized)) {
    return 'culture';
  }
  if (/\b(shop|shopping|market)\b/.test(normalized)) {
    return 'shopping';
  }
  if (/\b(entertainment|amusement|theme\s*park|six\s*flags|bowling|arcade|movie|cinema|concert|zoo|aquarium|stadium|arena|escape\s*room|mini\s*golf|laser\s*tag)\b/.test(normalized)) {
    return 'entertainment';
  }

  return fallback?.trim() || 'nearby places';
}

function buildPendingLocationAction(context: ScopeAiPendingScopeAiContext, query: string): ScopeAiActionBlock | null {
  const targetField = String(context.targetField ?? '').toLowerCase();
  if (targetField === 'stop') {
    return {
      actions: [{
        type: 'ADD_STOP',
        stop: {
          name: query,
          address: query,
        },
      }],
    };
  }

  if (targetField === 'end' || targetField === 'enddestination' || targetField === 'destination') {
    return {
      actions: [{
        type: 'SET_FIELD',
        field: 'end',
        value: query,
      }],
    };
  }

  return {
    actions: [{
      type: 'SET_FIELD',
      field: 'start',
      value: query,
    }],
  };
}

function getFirstUnresolvedLocationResolution(result: ScopeAiActionBlockApplyResult | null | undefined): ScopeAiActionResolution | null {
  return result?.resolutions.find((resolution) => resolution.status !== 'resolved') ?? null;
}

function updatePendingContextFromLocationResult(
  scopeAiStore: ScopeAiPlannerStoreBridge,
  sourcePrompt: string,
  result: ScopeAiActionBlockApplyResult | null,
  content: string,
  contextKind: ScopeAiPendingScopeAiContext['kind'] = 'location-resolution',
): boolean {
  const unresolved = getFirstUnresolvedLocationResolution(result);
  if (!unresolved) {
    if (result?.resolutions.some((resolution) => resolution.status === 'resolved')) {
      clearScopeAiPendingContext(scopeAiStore, 'location-resolved');
    }
    return false;
  }

  setScopeAiPendingContext(scopeAiStore, {
    kind: contextKind,
    sourcePrompt,
    targetField: unresolved.field,
    rawValue: unresolved.rawValue,
    candidates: scopeAiLocationCandidateItems(unresolved.candidates),
    lastAnswer: content,
  });
  return true;
}

function updatePendingContextFromAssistantMessage(
  scopeAiStore: ScopeAiPlannerStoreBridge,
  sourcePrompt: string,
  message: ChatMessage,
  options: {
    actionApplyResult?: ScopeAiActionBlockApplyResult | null;
    actionBlock?: ScopeAiActionBlock | null;
  } = {},
): void {
  const locationPending = updatePendingContextFromLocationResult(
    scopeAiStore,
    sourcePrompt,
    options.actionApplyResult ?? null,
    resolveMessageContentForTraining(message),
  );
  if (locationPending) {
    return;
  }

  const existingContext = getScopeAiPendingContext(scopeAiStore);
  if (
    existingContext &&
    (existingContext.kind === 'location-resolution' || existingContext.kind === 'weather-location') &&
    message.role === 'assistant' &&
    message.pendingContext &&
    message.pendingContext.kind !== existingContext.kind
  ) {
    return;
  }

  if (message.role === 'assistant' && message.pendingContext) {
    setScopeAiPendingContext(scopeAiStore, {
      ...message.pendingContext,
      sourcePrompt: message.pendingContext.sourcePrompt || sourcePrompt,
      lastAnswer: message.pendingContext.lastAnswer || resolveMessageContentForTraining(message),
    });
    return;
  }

  if (options.actionBlock?.actions.some((action) => action.type !== 'SEARCH_NEARBY_FUEL' && action.type !== 'SEARCH_NEARBY_PLACES')) {
    clearScopeAiPendingContext(scopeAiStore, 'planner-action-applied');
    return;
  }

  if (existingContext && message.role === 'assistant' && message.kind === 'text' && !options.actionBlock) {
    const content = resolveMessageContentForTraining(message);
    if (/^(?:I am still|Cheapest provider-backed|Closest provider-backed|I narrowed those provider-backed options)/i.test(content)) {
      setScopeAiPendingContext(scopeAiStore, {
        ...existingContext,
        lastAnswer: content,
        turnCount: existingContext.turnCount,
      });
      return;
    }
  }

  if (message.role === 'assistant' && message.kind === 'places' && message.results.length) {
    setScopeAiPendingContext(scopeAiStore, {
      kind: message.placeAction ? 'endpoint-candidates' : 'place-candidates',
      sourcePrompt,
      targetField: message.placeAction === 'set-start' ? 'start' : message.placeAction === 'set-end' ? 'end' : 'stop',
      rawValue: message.queryLabel,
      results: message.results.map(scopeAiPlaceResultToPendingItem),
      lastAnswer: resolveMessageContentForTraining(message),
    });
    return;
  }

  if (message.role === 'assistant' && message.kind === 'text' && !options.actionBlock) {
    const content = resolveMessageContentForTraining(message);
    if (content && !/^(?:Set|Added|Applied|Fuel near|Nearby\b|I handed\b|No new change from that repeat prompt\b)/i.test(content)) {
      setScopeAiPendingContext(scopeAiStore, {
        kind: 'explanation',
        sourcePrompt,
        lastAnswer: content,
      });
    }
  }
}

function isExplicitEndpointRouteCommand(value: string): boolean {
  const normalized = value.trim();
  if (!normalized) {
    return false;
  }

  return (
    /\bfrom\s+.{2,}\s+to\s+.{2,}$/i.test(normalized) ||
    /\b(?:start|starting|origin)\b(?:\s+(?:at|from|is|as|to|=|:))?\s+(?!over\b).{2,}$/i.test(normalized) ||
    /\b(?:destination|final destination|end|finish)\b(?:\s+(?:at|in|to|is|as|=|:))?\s+.{2,}$/i.test(normalized) ||
    /\buse\s+.{2,}\s+as\s+(?:the\s+)?(?:start|starting point|end|destination|final destination)\b/i.test(normalized)
  );
}

function isPendingFollowUpForContext(value: string, context: ScopeAiPendingScopeAiContext | null): boolean {
  const normalized = value.trim().toLowerCase();
  if (!context) {
    return false;
  }

  if (context.kind === 'fuel-results') {
    return /\b(?:set\s+(?:gas\s*)?price|use\s+(?:that|this)\s+price|cheapest|closest|diesel|premium|regular|midgrade|show more|more|within|radius)\b/i.test(normalized);
  }

  if (context.kind === 'nearby-results') {
    return /\b(?:show more|more|within|radius|near|closest|coffee|food|restaurant|fuel|gas|park|scenic|museum|shopping|entertainment|bowling|arcade|theme\s*park|movie|cinema)\b/i.test(normalized)
      || extractOrdinalSelection(normalized) !== null;
  }

  if (context.kind === 'endpoint-candidates' || context.kind === 'place-candidates') {
    if (/\bendpoint ideas?\b/i.test(normalized) || /\b(?:find|search).*\bendpoint/i.test(normalized)) {
      return false;
    }

    if (/\b(?:route\s+status|check\s+status|weather\s+for|forecast\s+for|start(?:ing)?\s+(?:at|from|place|point|city)|end\s+(?:at|in|place|point|city)|destination|final destination|budget|travelers?|pace|date|vibe|vibes|theme|interests?|focus|fuel|gas|build|generate|tighten|find|search|nearby)\b/i.test(normalized)) {
      return false;
    }

    return Boolean(selectPendingContextItem(value, context))
      || filterPendingItemsByFollowUp(value, context).length > 0
      || /\b(?:closest|scenic|practical|museum|park|coffee|food|cheap|cheapest|second|first|third)\b/i.test(normalized);
  }

  if (context.kind === 'location-resolution' || context.kind === 'weather-location') {
    if (isExplicitEndpointRouteCommand(normalized)) {
      return false;
    }

    if (/\b(?:route\s+status|check\s+status|weather\s+for|forecast\s+for|start(?:ing)?\s+(?:at|from|place|point|city)|end\s+(?:at|in|place|point|city)|destination|final destination|budget|travelers?|pace|date|vibe|vibes|theme|interests?|focus|fuel|gas|build|generate|tighten|find|search|nearby)\b/i.test(normalized)) {
      return false;
    }

    return Boolean(selectPendingContextItem(value, context))
      || Boolean(cleanupReplacementLocationQuery(normalized))
      || Boolean(extractLocationDisambiguationQualifier(normalized));
  }

  if (context.kind === 'planner-setting') {
    return /\b(?:under\s+\d+|below\s+\d+|cap(?: it)? at\s+\d+|make it\s+\d+|for\s+\d+\s+(?:people|travelers|guests?))\b/i.test(normalized);
  }

  if (context.kind === 'explanation') {
    if (/\b(?:endpoint ideas?|weather\s+for|forecast\s+for|start(?:ing)?\s+(?:at|from|place|point|city)|end\s+(?:at|in|place|point|city)|destination|final destination|budget|travelers?|pace|date|fuel|gas|build|generate|tighten|find|search|nearby|places?)\b/i.test(normalized)) {
      return false;
    }

    return /\b(?:why|go deeper|deeper|more detail|details|compare|source|what changed|show more)\b/i.test(normalized);
  }

  return false;
}

function isExplicitNewScopeAiCommand(value: string, context: ScopeAiPendingScopeAiContext | null = null): boolean {
  const normalized = value.trim();
  if (!normalized) {
    return false;
  }

  if (isExplicitEndpointRouteCommand(normalized)) {
    return true;
  }

  if (isPendingFollowUpForContext(normalized, context)) {
    return false;
  }

  return (
    /^(?:start over|reset|clear|new route|restart)\b/i.test(normalized) ||
    /\b(?:route\s+status|check\s+status|status\s+of\s+(?:the\s+)?route|start(?:ing)?\s+(?:at|from|place|point|city)|end\s+(?:at|in|place|point|city)|destination|final destination|endpoint ideas?|change|replace|set|use .+ as (?:the )?(?:start|end)|build|generate|tighten|weather\s+for|forecast\s+for|find|search|nearby|fuel|gas|budget|travelers?|pace|date|vibe|vibes|theme|interests?|focus|under\s+\d+|below\s+\d+|for\s+\d+\s+(?:people|travelers|guests?))\b/i.test(normalized)
  );
}

async function applyPendingLocationFollowUp(
  promptValue: string,
  context: ScopeAiPendingScopeAiContext,
  scopeAiStore: ScopeAiPlannerStoreBridge,
): Promise<PendingScopeAiFollowUpResolution | null> {
  const selected = selectPendingContextItem(promptValue, context);
  const query = buildPendingLocationFollowUpQuery(promptValue, context, selected);
  if (!query) {
    return null;
  }

  const actionBlock = buildPendingLocationAction(context, query);
  if (!actionBlock) {
    return null;
  }

  const actionApplyResult = await applyScopeAiStoreActionBlock(scopeAiStore, actionBlock);
  const content = buildLocationResolutionConfirmation(
    `I checked "${query}" against the map provider, but I still need a more exact place before changing the planner.`,
    actionApplyResult,
    actionBlock,
  );
  const assistantMessage = buildLocalTextMessage(content);
  updatePendingContextFromLocationResult(scopeAiStore, promptValue, actionApplyResult, content, 'location-resolution');
  return {
    assistantMessage,
    actionApplyResult,
    appliedActionBlock: actionBlock,
    intentKind: 'location',
  };
}

async function resolvePendingWeatherFollowUp(
  promptValue: string,
  context: ScopeAiPendingScopeAiContext,
  scopeAiStore: ScopeAiPlannerStoreBridge,
): Promise<PendingScopeAiFollowUpResolution | null> {
  const selected = selectPendingContextItem(promptValue, context);
  const query = buildPendingLocationFollowUpQuery(promptValue, context, selected);
  if (!query) {
    return null;
  }

  const message = await buildScopeAiWeatherMessage(`weather for ${query}`);
  if (!message) {
    return null;
  }

  if (message.role === 'assistant' && message.pendingContext) {
    setScopeAiPendingContext(scopeAiStore, message.pendingContext);
  } else {
    clearScopeAiPendingContext(scopeAiStore, 'weather-follow-up-resolved');
  }

  return {
    assistantMessage: message,
    intentKind: 'weather',
  };
}

function emitPendingCandidateAsEndpoint(item: ScopeAiPendingContextItem, targetField: string | undefined): boolean {
  if (!isTrustedPendingContextItem(item)) {
    return false;
  }

  emit('map-location-select', {
    target: targetField === 'start' ? 'destination' : 'endDestination',
    label: item.value || item.label,
    latitude: Number(item.latitude),
    longitude: Number(item.longitude),
    city: typeof item.meta?.city === 'string' ? item.meta.city : undefined,
    country: typeof item.meta?.country === 'string' ? item.meta.country : undefined,
  });
  return true;
}

function emitPendingCandidateAsStop(item: ScopeAiPendingContextItem): boolean {
  if (!isTrustedPendingContextItem(item)) {
    return false;
  }

  emit('route-stop-add', {
    spotId: buildPlaceSearchSpotId({
      id: item.id,
      placeName: item.label,
      formattedAddress: item.value,
      latitude: Number(item.latitude),
      longitude: Number(item.longitude),
      source: 'mapbox',
      category: typeof item.meta?.category === 'string' ? item.meta.category : undefined,
    }),
    title: typeof item.meta?.placeName === 'string' ? item.meta.placeName : item.label.replace(/^\d+\.\s*/, '').split(' - ')[0] || item.label,
    latitude: Number(item.latitude),
    longitude: Number(item.longitude),
    category: inferSpotCategory({
      placeName: item.label,
      formattedAddress: item.value,
      latitude: Number(item.latitude),
      longitude: Number(item.longitude),
      source: 'mapbox',
      category: typeof item.meta?.category === 'string' ? item.meta.category : undefined,
    }),
    city: typeof item.meta?.city === 'string' ? item.meta.city : undefined,
    notes: item.value,
  });
  return true;
}

function filterPendingItemsByFollowUp(value: string, context: ScopeAiPendingScopeAiContext): ScopeAiPendingContextItem[] {
  const qualifier = cleanupFollowUpQualifier(value);
  const normalized = normalizeActionLookupValue(qualifier ?? value);
  if (!normalized) {
    return [];
  }

  return getPendingContextItems(context).filter((item) => {
    const haystack = normalizeActionLookupValue([
      item.label,
      item.value,
      item.source,
      item.meta?.address,
      item.meta?.category,
      item.meta?.categoryLabel,
      item.meta?.reason,
    ].filter(Boolean).join(' '));
    return haystack.includes(normalized);
  });
}

async function resolvePendingCandidateFollowUp(
  promptValue: string,
  context: ScopeAiPendingScopeAiContext,
  scopeAiStore: ScopeAiPlannerStoreBridge,
): Promise<PendingScopeAiFollowUpResolution | null> {
  const selected = selectPendingContextItem(promptValue, context);
  if (selected) {
    if (context.kind === 'endpoint-candidates') {
      if (!emitPendingCandidateAsEndpoint(selected, context.targetField)) {
        return {
          assistantMessage: buildLocalTextMessage('I can only set that endpoint after a provider-backed candidate includes coordinates. Pick one on the map or choose another result.'),
          intentKind: 'location',
        };
      }

      clearScopeAiPendingContext(scopeAiStore, 'endpoint-candidate-selected');
      const target = context.targetField === 'start' ? 'start place' : 'final destination';
      return {
        assistantMessage: buildLocalTextMessage(`Set the ${target} to ${selected.value || selected.label}.`),
        intentKind: 'location',
      };
    }

    if (!emitPendingCandidateAsStop(selected)) {
      return {
        assistantMessage: buildLocalTextMessage('I can only add that stop after the provider result includes coordinates. Pick one on the map or choose another result.'),
        intentKind: 'places',
      };
    }

    clearScopeAiPendingContext(scopeAiStore, 'place-candidate-selected');
    return {
      assistantMessage: buildLocalTextMessage(`Added ${selected.value || selected.label} as a stop candidate.`),
      intentKind: 'places',
    };
  }

  const narrowed = filterPendingItemsByFollowUp(promptValue, context);
  if (narrowed.length) {
    const content = `I narrowed those provider-backed options to:\n${formatScopeAiDashList(narrowed.map((item) => item.value || item.label))}\nNext: Reply with a number, a name, or pick one on the map.`;
    setScopeAiPendingContext(scopeAiStore, {
      ...context,
      results: narrowed,
      candidates: undefined,
      lastAnswer: content,
      turnCount: 0,
    });
    return {
      assistantMessage: buildLocalTextMessage(content),
      intentKind: context.kind === 'endpoint-candidates' ? 'location' : 'places',
    };
  }

  return null;
}

function getFuelPriceFromPendingItem(item: ScopeAiPendingContextItem): number | null {
  const price = Number(item.meta?.pricePerUnit);
  return Number.isFinite(price) && price > 0 ? price : null;
}

function getDistanceFromPendingItem(item: ScopeAiPendingContextItem): number | null {
  const distance = Number(item.meta?.distanceKm);
  return Number.isFinite(distance) && distance >= 0 ? distance : null;
}

function isTrustedFuelPendingItem(item: ScopeAiPendingContextItem): boolean {
  if (item.meta?.providerVerified === false) {
    return false;
  }

  if (item.meta?.providerVerified === true) {
    return true;
  }

  return (
    (item.source === undefined || isTrustedProviderLabel(item.source))
    && (item.meta?.source === undefined || isTrustedProviderLabel(item.meta.source))
  );
}

async function resolvePendingFuelFollowUp(
  promptValue: string,
  context: ScopeAiPendingScopeAiContext,
  scopeAiStore: ScopeAiPlannerStoreBridge,
): Promise<PendingScopeAiFollowUpResolution | null> {
  const normalized = promptValue.toLowerCase();
  const radiusKm = extractRadiusKmFromFollowUp(promptValue);

  if (/\b(diesel|regular|midgrade|premium|show more|more|closest|within|radius)\b/i.test(normalized)) {
    const fuelType = /\bdiesel\b/i.test(normalized)
      ? 'diesel'
      : /\bpremium\b/i.test(normalized)
        ? 'premium'
        : /\bmidgrade\b/i.test(normalized)
          ? 'midgrade'
          : /\bregular\b/i.test(normalized)
            ? 'regular'
            : context.rawValue;
    const message = await buildScopeAiFuelSearchMessage(scopeAiStore, {
      sort_by: /\bcheap|cheapest|price\b/i.test(normalized) ? 'best_price' : 'closest',
      radius_km: radiusKm ?? undefined,
      limit: /\bmore|show more\b/i.test(normalized) ? 8 : 5,
      fuel_type: fuelType,
    });
    if (message) {
      return {
        assistantMessage: message,
        intentKind: 'places',
      };
    }
  }

  const results = getPendingContextItems(context);
  if (!results.length) {
    return null;
  }

  const cheapest = results
    .filter((item) => getFuelPriceFromPendingItem(item) !== null)
    .sort((left, right) => Number(getFuelPriceFromPendingItem(left)) - Number(getFuelPriceFromPendingItem(right)))[0] ?? null;
  const closest = results
    .filter((item) => getDistanceFromPendingItem(item) !== null)
    .sort((left, right) => Number(getDistanceFromPendingItem(left)) - Number(getDistanceFromPendingItem(right)))[0] ?? null;
  const selected = /\bclosest\b/i.test(normalized) ? closest : cheapest;
  if (!selected) {
    return null;
  }

  const price = getFuelPriceFromPendingItem(selected);
  if (price && /\b(set|use|apply)\b.*\b(?:gas\s*)?price\b/i.test(normalized)) {
    if (!isTrustedFuelPendingItem(selected)) {
      const content = 'I found that fuel price in an unverified result, so I did not set your gas price from it. Ask me to rerun live fuel lookup once the provider is available.';
      setScopeAiPendingContext(scopeAiStore, {
        ...context,
        lastAnswer: content,
        turnCount: 0,
      });
      return {
        assistantMessage: buildLocalTextMessage(content),
        intentKind: 'places',
      };
    }

    const actionBlock: ScopeAiActionBlock = {
      actions: [{
        type: 'SET_FIELD',
        field: 'gas_price',
        value: price,
      }],
    };
    const actionApplyResult = await applyScopeAiStoreActionBlock(scopeAiStore, actionBlock);
    clearScopeAiPendingContext(scopeAiStore, 'fuel-price-applied');
    return {
      assistantMessage: buildLocalTextMessage(`Set the gas price to $${price.toFixed(2)}/gal from the provider-backed fuel result.`),
      actionApplyResult,
      appliedActionBlock: actionBlock,
      intentKind: 'budget',
    };
  }

  const content = `${/\bclosest\b/i.test(normalized) ? 'Closest' : 'Cheapest'} provider-backed fuel result:\n- ${selected.label}\n${price ? `Reply "set gas price" to use $${price.toFixed(2)}/gal.` : 'Price was unavailable, so I will not set a gas price from it.'}`;
  setScopeAiPendingContext(scopeAiStore, {
    ...context,
    lastAnswer: content,
    turnCount: 0,
  });
  return {
    assistantMessage: buildLocalTextMessage(content),
    intentKind: 'places',
  };
}

async function resolvePendingNearbyFollowUp(
  promptValue: string,
  context: ScopeAiPendingScopeAiContext,
  scopeAiStore: ScopeAiPlannerStoreBridge,
): Promise<PendingScopeAiFollowUpResolution | null> {
  const selected = selectPendingContextItem(promptValue, context);
  if (selected) {
    if (!emitPendingCandidateAsStop(selected)) {
      return {
        assistantMessage: buildLocalTextMessage('That nearby result does not have provider coordinates attached, so I did not add it. Pick another result on the map.'),
        intentKind: 'places',
      };
    }

    clearScopeAiPendingContext(scopeAiStore, 'nearby-candidate-selected');
    return {
      assistantMessage: buildLocalTextMessage(`Added ${selected.value || selected.label} as a stop candidate.`),
      intentKind: 'places',
    };
  }

  if (/\b(show more|more|within|radius|near|closest|coffee|food|restaurant|fuel|gas|park|scenic|museum|shopping|entertainment|bowling|arcade|theme\s*park|movie|cinema)\b/i.test(promptValue)) {
    const message = await buildScopeAiNearbyPlacesMessage(scopeAiStore, {
      category: inferNearbyCategoryFromFollowUp(promptValue, context.rawValue),
      radius_km: extractRadiusKmFromFollowUp(promptValue) ?? undefined,
      limit: /\b(show more|more)\b/i.test(promptValue) ? 10 : 6,
    });
    if (message) {
      return {
        assistantMessage: message,
        intentKind: 'places',
      };
    }
  }

  return null;
}

async function resolvePendingPlannerSettingFollowUp(
  promptValue: string,
  context: ScopeAiPendingScopeAiContext,
  scopeAiStore: ScopeAiPlannerStoreBridge,
): Promise<PendingScopeAiFollowUpResolution | null> {
  const normalizedTarget = String(context.targetField ?? '').toLowerCase();
  const numberMatch = promptValue.match(/\b(?:under|below|cap(?: it)? at|max(?:imum)?|make it|for)?\s*\$?(\d{1,6})(?:\s*(?:people|travelers|guests?))?\b/i);
  if (!numberMatch?.[1]) {
    return null;
  }

  const value = Number(numberMatch[1]);
  if (!Number.isFinite(value) || value <= 0) {
    return null;
  }

  const field = /travel|party|people|guest|group/.test(normalizedTarget)
    ? 'party_size'
    : /budget|max|cost|price|under|cap/.test(normalizedTarget)
      ? 'budget_max'
      : normalizedTarget;
  if (!field) {
    return null;
  }

  const actionBlock: ScopeAiActionBlock = {
    actions: [{
      type: 'SET_FIELD',
      field,
      value: Math.round(value),
    }],
  };
  const actionApplyResult = await applyScopeAiStoreActionBlock(scopeAiStore, actionBlock);
  clearScopeAiPendingContext(scopeAiStore, 'planner-setting-applied');
  return {
    assistantMessage: buildLocalTextMessage(`Set ${getPlannerActionFieldLabel(field)} to ${Math.round(value).toLocaleString('en-US')}.`),
    appliedActionBlock: actionBlock,
    actionApplyResult,
    intentKind: /budget/.test(field) ? 'budget' : 'group',
  };
}

function resolvePendingExplanationFollowUp(promptValue: string, context: ScopeAiPendingScopeAiContext): PendingScopeAiFollowUpResolution | null {
  if (!/\b(why|go deeper|deeper|more detail|details|compare|source|what changed|show more)\b/i.test(promptValue)) {
    return null;
  }

  const previous = (context.lastAnswer || '').replace(/\s+/g, ' ').trim();
  const content = [
    'Here is the deeper version from the same planner context:',
    previous ? `- Previous answer: ${previous.length > 220 ? `${previous.slice(0, 217)}...` : previous}` : '',
    '- I only treat locations, weather, fuel, ETA, and place results as factual when they come from the provider path or the planner state.',
    '- For the next action, tell me the exact field to change or ask for a provider lookup and I will verify before mutating the route.',
  ].filter(Boolean).join('\n');

  return {
    assistantMessage: {
      ...buildLocalTextMessage(content),
      pendingContext: {
        ...context,
        lastAnswer: content,
        turnCount: 0,
      },
    },
    intentKind: 'general',
  };
}

function buildPendingContextReminder(context: ScopeAiPendingScopeAiContext): ChatMessage {
  const items = getPendingContextItems(context);
  const target = context.targetField || context.kind.replace(/-/g, ' ');
  const content = items.length
    ? `I am still narrowing ${target} from "${context.rawValue || context.sourcePrompt}".\n${formatScopeAiDashList(items.map((item) => item.value || item.label))}\nNext: Reply with a number, a city/state, a constraint like "closest", or pick one on the map.`
    : `I am still waiting on a clearer follow-up for ${target} from "${context.rawValue || context.sourcePrompt}". Reply with a city/state, a number, or a specific constraint.`;

  return buildLocalTextMessage(content);
}

function buildPendingContextReminderResolution(
  context: ScopeAiPendingScopeAiContext,
  intentKind: FollowUpIntentKind,
  scopeAiStore: ScopeAiPlannerStoreBridge,
): PendingScopeAiFollowUpResolution {
  const nextTurnCount = context.turnCount + 1;
  if (nextTurnCount >= 3) {
    clearScopeAiPendingContext(scopeAiStore, 'pending-context-unrelated-turn-limit');
    return {
      assistantMessage: buildLocalTextMessage('I cleared that earlier follow-up because it was getting stale. Tell me the next route change or lookup you want and I will verify it fresh.'),
      intentKind,
    };
  }

  const nextContext = {
    ...context,
    turnCount: nextTurnCount,
  };
  const assistantMessage = buildPendingContextReminder(nextContext);
  setScopeAiPendingContext(scopeAiStore, {
    ...nextContext,
    lastAnswer: resolveMessageContentForTraining(assistantMessage),
  });
  return {
    assistantMessage,
    intentKind,
  };
}

async function resolvePendingScopeAiFollowUp(
  promptValue: string,
  context: ScopeAiPendingScopeAiContext,
  scopeAiStore: ScopeAiPlannerStoreBridge,
): Promise<PendingScopeAiFollowUpResolution | null> {
  if (isExplicitNewScopeAiCommand(promptValue, context)) {
    clearScopeAiPendingContext(scopeAiStore, 'explicit-new-command');
    return null;
  }

  if (context.kind === 'location-resolution') {
    return applyPendingLocationFollowUp(promptValue, context, scopeAiStore)
      ?? buildPendingContextReminderResolution(context, 'location', scopeAiStore);
  }

  if (context.kind === 'weather-location') {
    return await resolvePendingWeatherFollowUp(promptValue, context, scopeAiStore)
      ?? buildPendingContextReminderResolution(context, 'weather', scopeAiStore);
  }

  if (context.kind === 'endpoint-candidates' || context.kind === 'place-candidates') {
    return await resolvePendingCandidateFollowUp(promptValue, context, scopeAiStore)
      ?? buildPendingContextReminderResolution(context, context.kind === 'endpoint-candidates' ? 'location' : 'places', scopeAiStore);
  }

  if (context.kind === 'fuel-results') {
    return await resolvePendingFuelFollowUp(promptValue, context, scopeAiStore)
      ?? buildPendingContextReminderResolution(context, 'places', scopeAiStore);
  }

  if (context.kind === 'nearby-results') {
    return await resolvePendingNearbyFollowUp(promptValue, context, scopeAiStore)
      ?? buildPendingContextReminderResolution(context, 'places', scopeAiStore);
  }

  if (context.kind === 'planner-setting') {
    return await resolvePendingPlannerSettingFollowUp(promptValue, context, scopeAiStore)
      ?? buildPendingContextReminderResolution(context, 'general', scopeAiStore);
  }

  if (context.kind === 'explanation') {
    return resolvePendingExplanationFollowUp(promptValue, context);
  }

  return null;
}

async function handleScopeAiAsk(userSource: ScopeAiInteractionSource = 'typed'): Promise<void> {
  const scopeAiStore = props.scopeAiStore;
  if (!scopeAiStore) {
    await handleAsk(userSource);
    return;
  }

  if (loading.value) {
    return;
  }

  if (voiceListening.value) {
    stopVoiceInput();
  }
  voiceStatus.value = '';

  const trimmedPrompt = prompt.value.trim();
  const submittedAttachments = pendingAttachments.value;
  const submittedPrompt = trimmedPrompt || (submittedAttachments.length ? getDefaultAttachmentPrompt(submittedAttachments) : '');
  const assistantPrompt = buildPromptWithAttachmentContext(submittedPrompt, submittedAttachments);
  const outboundImages = buildScopeAiImagePayload(submittedAttachments);

  if (!submittedPrompt && !submittedAttachments.length) {
    return;
  }

  isContextExpanded.value = true;
  const interactionId = createMessageId('turn');
  activeTurnId.value = interactionId;
  appendMessage({
    id: `${interactionId}-user`,
    role: 'user',
    content: sanitizeScopeAiVisibleText(submittedPrompt),
    attachments: submittedAttachments,
  });
  scopeAiStore.addSessionEntry({ role: 'user', content: submittedPrompt, actionBlock: null });
  workingMessage.value = chooseWorkingMessage(submittedPrompt);
  loading.value = true;
  const responseStartedAt = getScopeAiResponseStartedAt();
  prompt.value = '';
  pendingAttachments.value = [];
  await scrollThreadToBottom();

  let assistantMessage: ChatMessage;
  let followUpMessages: ChatMessage[] = [];
  let actionApplyResult: ScopeAiActionBlockApplyResult | null = null;
  let appliedActionBlock: ScopeAiActionBlock | null = null;

  try {
    const normalizedSubmittedPrompt = normalizeNoisyScopeAiPrompt(submittedPrompt);
    if (pendingDeleteConfirmation.value && isDeleteCancelPrompt(normalizedSubmittedPrompt)) {
      pendingDeleteConfirmation.value = false;
      assistantMessage = buildLocalTextMessage('Canceled delete. I left this trip draft alone.');
      scopeAiStructuredSuggestions.value = normalizeScopeAiStructuredChips([
        'Save this draft',
        'Share this trip',
        'Check route status',
      ]);
    } else {
      if (
        pendingDeleteConfirmation.value &&
        !isDeleteConfirmPrompt(normalizedSubmittedPrompt) &&
        !isDeleteRequestPrompt(normalizedSubmittedPrompt)
      ) {
        pendingDeleteConfirmation.value = false;
      }

    let resolvedPendingIntentKind: FollowUpIntentKind | null = null;
    const pendingContext = getScopeAiPendingContext(scopeAiStore);
    const startsNewIntent = pendingContext ? isExplicitNewScopeAiCommand(normalizedSubmittedPrompt, pendingContext) : false;
    if (startsNewIntent) {
      clearScopeAiPendingContext(scopeAiStore, 'explicit-new-command');
    }
    const isPendingFollowUp = pendingContext && !startsNewIntent
      ? isPendingFollowUpForContext(normalizedSubmittedPrompt, pendingContext)
      : false;
    if (pendingContext && !startsNewIntent && !isPendingFollowUp) {
      clearScopeAiPendingContext(scopeAiStore, 'pending-context-new-turn');
    }
    const pendingFollowUp = pendingContext && !startsNewIntent && isPendingFollowUp
      ? await resolvePendingScopeAiFollowUp(normalizedSubmittedPrompt, pendingContext, scopeAiStore)
      : null;
    if (!pendingFollowUp && pendingContext && !startsNewIntent && isPendingFollowUp) {
      incrementScopeAiPendingContext(scopeAiStore);
    }
    const endpointRecommendationIntent = extractEndpointRecommendationIntent(normalizedSubmittedPrompt);
    const routeActionReason = endpointRecommendationIntent ? null : resolveRouteActionReason(normalizedSubmittedPrompt);
    const weatherMessage = pendingFollowUp || endpointRecommendationIntent || routeActionReason ? null : await buildScopeAiWeatherMessage(normalizedSubmittedPrompt);
    const commonAnswer = pendingFollowUp || endpointRecommendationIntent || routeActionReason || weatherMessage
      ? null
      : buildCommonScopeAiAnswer(normalizedSubmittedPrompt);
    const pendingRouteActionReason = pendingItineraryBrief.value?.reason;
    const pendingBriefMessage = pendingFollowUp || endpointRecommendationIntent || routeActionReason || weatherMessage || commonAnswer
      ? null
      : await buildPendingBriefFollowUpMessage(submittedPrompt);
    if (pendingFollowUp) {
      assistantMessage = pendingFollowUp.assistantMessage;
      followUpMessages = pendingFollowUp.followUpMessages ?? [];
      actionApplyResult = pendingFollowUp.actionApplyResult ?? null;
      appliedActionBlock = pendingFollowUp.appliedActionBlock ?? null;
      resolvedPendingIntentKind = pendingFollowUp.intentKind ?? 'general';
      scopeAiStructuredSuggestions.value = normalizeScopeAiStructuredChips([
        'Check route status',
        'Find fuel nearby',
        'Build the itinerary',
      ]);
    } else if (endpointRecommendationIntent) {
      assistantMessage = await buildEndpointRecommendationMessage(endpointRecommendationIntent, normalizedSubmittedPrompt);
      scopeAiStructuredSuggestions.value = [
        'Show more endpoint ideas',
        'Find scenic endpoints',
        'Find practical endpoints',
      ];
    } else if (routeActionReason) {
      assistantMessage = await buildRouteActionMessage(routeActionReason, normalizedSubmittedPrompt);
      scopeAiStructuredSuggestions.value = normalizeScopeAiStructuredChips([
        'Check route status',
        'Find practical endpoints',
        'Find fuel nearby',
      ]);
    } else if (weatherMessage) {
      assistantMessage = weatherMessage;
      scopeAiStructuredSuggestions.value = normalizeScopeAiStructuredChips([
        'Find indoor backup stops',
        'Check route status',
        'Build the itinerary',
      ]);
    } else if (commonAnswer) {
      assistantMessage = commonAnswer;
      const commonSuggestions = isMissingCurrentLocationTravelPrompt(submittedPrompt)
        ? ['Use current location', 'Add a start place', 'Search near a city']
        : ['Tell me a state', 'Use current location', 'Add a final destination'];
      scopeAiStructuredSuggestions.value = normalizeScopeAiStructuredChips(commonSuggestions);
    } else if (pendingBriefMessage) {
      assistantMessage = pendingBriefMessage;
      scopeAiStructuredSuggestions.value = normalizeScopeAiStructuredChips([
        pendingRouteActionReason === 'tighten' ? 'Tighten this route' : 'Build the itinerary',
        'Use smart defaults',
        'Cancel this build',
      ]);
    } else {
      const result = await callScopeAi({
        message: assistantPrompt,
        plannerState: scopeAiStore.stateAsJson,
        sessionHistory: scopeAiStore.sessionHistory,
        preferences: scopeAiStore.preferences,
        images: outboundImages.length ? outboundImages : undefined,
      });
      const parsed = parseScopeAiResponse(result.responseText);
      const uiActionResult = parsed.actionBlock ? await executeScopeAiUiActions(parsed.actionBlock) : null;

      if (parsed.actionBlock) {
        appliedActionBlock = parsed.actionBlock;
        trackScopeAiStructuredPreferences(parsed.actionBlock);
        actionApplyResult = await applyScopeAiStoreActionBlock(scopeAiStore, parsed.actionBlock);
        followUpMessages = await buildScopeAiActionFollowUpMessages(parsed.actionBlock);
      }

      const confirmationText = buildLocationResolutionConfirmation(
        uiActionResult?.message || parsed.confirmationText || result.responseText.trim() || 'I updated the planner route.',
        actionApplyResult,
        parsed.actionBlock,
      );
      scopeAiStructuredSuggestions.value = normalizeScopeAiStructuredChips(uiActionResult?.chips ?? parsed.chips);
      assistantMessage = {
        id: createMessageId('assistant'),
        role: 'assistant',
        kind: 'text',
        content: confirmationText,
        model: result.model,
      };
    }
    lastFollowUpIntent.value = {
      kind: resolvedPendingIntentKind ?? (endpointRecommendationIntent ? 'location' : routeActionReason ?? pendingRouteActionReason ?? (weatherMessage ? 'weather' : 'general')),
      prompt: submittedPrompt,
      responseKind: assistantMessage.kind,
      ...(routeActionReason ? { routeActionReason } : {}),
    };
    }
  } catch (caughtError: unknown) {
    assistantMessage = {
      id: createMessageId('assistant'),
      role: 'assistant',
      kind: 'error',
      content: caughtError instanceof Error
        ? caughtError.message
        : 'Scope AI could not help with this trip right now.',
    };
  } finally {
    await waitForScopeAiResponsePace(responseStartedAt);
    loading.value = false;
    workingMessage.value = DEFAULT_WORKING_MESSAGE;
    activeTurnId.value = null;
  }

  assistantMessage = await auditAssistantMessageForRender(assistantMessage, {
    userPrompt: submittedPrompt,
    actionApplyResult,
  });
  updatePendingContextFromAssistantMessage(scopeAiStore, submittedPrompt, assistantMessage, {
    actionApplyResult,
    actionBlock: appliedActionBlock,
  });
  scopeAiStore.addSessionEntry({
    role: 'assistant',
    content: resolveMessageContentForTraining(assistantMessage),
    actionBlock: appliedActionBlock,
  });
  trackAiTurn(interactionId, assistantPrompt, assistantMessage, userSource);
  appendMessage(assistantMessage);
  for (const message of followUpMessages) {
    const auditedMessage = await auditAssistantMessageForRender(message, {
      userPrompt: submittedPrompt,
      actionApplyResult: null,
    });
    updatePendingContextFromAssistantMessage(scopeAiStore, submittedPrompt, auditedMessage, {
      actionApplyResult: null,
      actionBlock: null,
    });
    appendMessage(auditedMessage);
    scopeAiStore.addSessionEntry({
      role: 'assistant',
      content: resolveMessageContentForTraining(auditedMessage),
      actionBlock: null,
    });
  }
}

async function handleAsk(userSource: ScopeAiInteractionSource = 'typed'): Promise<void> {
  if (voiceListening.value) {
    stopVoiceInput();
  }
  voiceStatus.value = '';

  const trimmedPrompt = prompt.value.trim();
  const submittedAttachments = pendingAttachments.value;
  const submittedPrompt = trimmedPrompt || (submittedAttachments.length ? getDefaultAttachmentPrompt(submittedAttachments) : '');
  const assistantPrompt = buildPromptWithAttachmentContext(submittedPrompt, submittedAttachments);

  if (!submittedPrompt && !submittedAttachments.length) {
    return;
  }

  isContextExpanded.value = true;
  const interactionId = createMessageId('turn');
  const inferredDetailPreference = inferDetailPreferenceFromPrompt(submittedPrompt);
  if (inferredDetailPreference) {
    writeUserMemory({ detailPreference: inferredDetailPreference });
  }
  const interestsForMemory = mergeInterestPreferences(props.draft.interests, inferInterestsFromText(submittedPrompt));
  if (interestsForMemory.length) {
    writeUserMemory({ recentStableInterests: interestsForMemory });
  }
  if (loading.value && activeAbortController) {
    activeAbortController.abort();
  }
  activeAbortController = typeof AbortController !== 'undefined' ? new AbortController() : null;
  activeTurnId.value = interactionId;
  appendMessage({
    id: `${interactionId}-user`,
    role: 'user',
    content: sanitizeScopeAiVisibleText(submittedPrompt),
    attachments: submittedAttachments,
  });
  workingMessage.value = chooseWorkingMessage(submittedPrompt);
  loading.value = true;
  const responseStartedAt = getScopeAiResponseStartedAt();
  prompt.value = '';
  pendingAttachments.value = [];
  await scrollThreadToBottom();

  let assistantMessage: ChatMessage;
  let trackingSource: ScopeAiInteractionSource = userSource;
  let routeActionReasonForAnalytics: RouteActionReason | undefined;
  let followUpMessages: ChatMessage[] = [];
  let actionApplyResult: ScopeAiActionBlockApplyResult | null = null;

  try {
    const normalizedSubmittedPrompt = normalizeNoisyScopeAiPrompt(submittedPrompt);
    const endpointRecommendationIntent = extractEndpointRecommendationIntent(normalizedSubmittedPrompt);
    const routeActionReason = resolveRouteActionReason(normalizedSubmittedPrompt);
    const weatherMessage = endpointRecommendationIntent || routeActionReason ? null : await buildScopeAiWeatherMessage(normalizedSubmittedPrompt);
    const commonAnswer = endpointRecommendationIntent || routeActionReason || weatherMessage ? null : buildCommonScopeAiAnswer(normalizedSubmittedPrompt);
    const placeSearchIntent = endpointRecommendationIntent || commonAnswer ? null : extractPlaceSearchIntent(normalizedSubmittedPrompt);
    const followUpIntentKind: FollowUpIntentKind = endpointRecommendationIntent
      ? 'location'
      : classifyFollowUpIntent(submittedPrompt, routeActionReason, placeSearchIntent);
    const shouldBypassPendingBrief = shouldHandlePromptAsNewIntentWhileBriefPending(
      normalizedSubmittedPrompt,
      routeActionReason,
      placeSearchIntent,
    );
    const pendingRouteActionReason = pendingItineraryBrief.value?.reason;
    const pendingBriefMessage = shouldBypassPendingBrief
      ? null
      : await buildPendingBriefFollowUpMessage(submittedPrompt);
    if (activeTurnId.value !== interactionId) {
      return;
    }
    if (pendingBriefMessage) {
      trackingSource = 'route-action';
      routeActionReasonForAnalytics = pendingRouteActionReason ?? routeActionReason ?? 'build';
      assistantMessage = pendingBriefMessage;
    } else if (endpointRecommendationIntent) {
      trackingSource = 'place-search';
      assistantMessage = await buildEndpointRecommendationMessage(endpointRecommendationIntent, normalizedSubmittedPrompt);
    } else if (routeActionReason) {
      trackingSource = 'route-action';
      routeActionReasonForAnalytics = routeActionReason;
      assistantMessage = await buildRouteActionMessage(routeActionReason, normalizedSubmittedPrompt);
    } else if (weatherMessage) {
      assistantMessage = weatherMessage;
    } else if (commonAnswer) {
      assistantMessage = commonAnswer;
    } else if (placeSearchIntent) {
      trackingSource = 'place-search';
      assistantMessage = await buildPlaceSearchMessage(placeSearchIntent, normalizedSubmittedPrompt);
    } else {
      const result = await planTrip({
        prompt: buildAssistantPrompt(assistantPrompt),
        user_id: props.userId,
        start_date: props.draft.startDate,
      }, activeAbortController ? { signal: activeAbortController.signal } : undefined);
      if (activeTurnId.value !== interactionId) {
        return;
      }
      assistantMessage = {
        id: createMessageId('assistant'),
        role: 'assistant',
        kind: 'text',
        content: result.itinerary,
        model: result.model,
      };
    }
    lastFollowUpIntent.value = {
      kind: followUpIntentKind,
      prompt: submittedPrompt,
      responseKind: assistantMessage.kind,
      ...(routeActionReason ? { routeActionReason } : {}),
    };
  } catch (caughtError: unknown) {
    if (activeTurnId.value !== interactionId || isAbortError(caughtError)) {
      return;
    }
    assistantMessage = {
      id: createMessageId('assistant'),
      role: 'assistant',
      kind: 'error',
      content: caughtError instanceof Error
        ? caughtError.message
        : 'Scope AI could not help with this trip right now.',
    };
  } finally {
    if (activeTurnId.value === interactionId) {
      await waitForScopeAiResponsePace(responseStartedAt);
      loading.value = false;
      workingMessage.value = DEFAULT_WORKING_MESSAGE;
      activeTurnId.value = null;
      activeAbortController = null;
    }
  }

  if (activeTurnId.value !== null) {
    return;
  }
  assistantMessage = await auditAssistantMessageForRender(assistantMessage, {
    userPrompt: submittedPrompt,
    actionApplyResult,
  });
  trackAiTurn(interactionId, assistantPrompt, assistantMessage, trackingSource, routeActionReasonForAnalytics);
  appendMessage(assistantMessage);
  for (const message of followUpMessages) {
    const auditedMessage = await auditAssistantMessageForRender(message, {
      userPrompt: submittedPrompt,
      actionApplyResult: null,
    });
    appendMessage(auditedMessage);
    props.scopeAiStore?.addSessionEntry?.({
      role: 'assistant',
      content: resolveMessageContentForTraining(auditedMessage),
      actionBlock: null,
    });
  }
}

defineExpose({
  handoffPlannerBrief,
  focusComposer,
  ...(import.meta.env.MODE === 'test'
    ? {
        __coverage: {
          formatCurrency,
          parsePlannerDate,
          getDateRangeDurationDays,
          normalizeDurationDays,
          getBuildDefaultsDurationDays,
          formatTravelPartyLabel,
          getSpeechRecognitionConstructor,
          getBriefQuestion,
          getBriefQuestions,
          getMissingItineraryBriefQuestions,
          buildMissingItineraryBriefMessage,
          summarizeOffQuestionBriefReply,
          buildPendingBriefReminderMessage,
          buildPendingBriefSuggestions,
          formatDateInput,
          getWeekendDateDefaults,
          getDefaultForBriefQuestion,
          mergeItineraryBuildDefaults,
          buildSmartDefaultsForKeys,
          isVagueBriefReply,
          parseDurationReply,
          parseExplicitDurationPrompt,
          parseInterestReply,
          inferInterestsFromText,
          parseExplicitInterestDefaultsFromPrompt,
          parsePaceReply,
          getPaceLabel,
          parseTravelPartyReply,
          parseBriefReplyForKey,
          hasItineraryBuildDefaults,
          extractItineraryBuildDefaultsFromPrompt,
          buildAssumptionSummary,
          buildRoutePromptWithDefaults,
          getEffectiveInterestPreferences,
          startVoiceInput,
          toggleVoiceInput,
          getRouteBuildSuggestion,
          getPlannerStateLabel,
          getBestNextMoveSuggestion,
          buildBlankRouteSuggestionPool,
          buildSuggestionPool,
          buildPlannerStateRankedSuggestionPool,
          normalizeSuggestionKey,
          mergeUniqueSuggestions,
          buildPendingBriefContinuationSuggestions,
          buildTopSuggestions,
          getRouteSearchLabel,
          buildIntentFollowUpPool,
          structureAssistantContent,
          formatRouteEndpointLabel,
          getInterestLabel,
          formatList,
          getDateLabel,
          getUserMemoryStorageKey,
          safeJsonParse,
          isSpotCategory,
          openAttachmentPicker,
          mergeInterestPreferences,
          readUserMemory,
          inferDetailPreferenceFromPrompt,
          writeUserMemory,
          buildRecentChatContext,
          buildAssistantPrompt,
          getWeatherPointFromRoute,
          resolveWeatherPoint,
          formatWeatherSnapshot,
          buildScopeAiWeatherMessage,
          extractLocationLookupQuery,
          extractPlaceSearchIntent,
          inferRouteStopSearchQuery,
          resolveRouteActionReason,
          classifyFollowUpIntent,
          buildRouteActionMessage,
          resolvePlaceSearchAnchor,
          buildRouteMidpointAnchor,
          parseScopeActionBlocks,
          parseChipLabels,
          resolveScopeActionPlace,
          applyRemoveMarkerAction,
          readStopOrderEntries,
          applyReorderStopsAction,
          buildCommonScopeAiAnswer,
          buildPendingBriefFollowUpMessage,
          handlePlaceSearchResultAction,
          getScopeAiSearchCoordinate,
          buildScopeAiActionFollowUpMessages,
          executeScopeAiUiActions,
          buildUnverifiedLocationApplyResult,
          applyScopeAiStoreActionBlock,
          getScopeAiPendingContext,
          incrementScopeAiPendingContext,
          hasCoordinatePair,
          cleanupEndpointAnchorQuery,
          isCurrentEndpointAnchorReference,
          inferEndpointPreference,
          extractEndpointRecommendationIntent,
          getCurrentStartAnchor,
          getPlannerLocationProximity,
          formatEndpointResolutionCandidates,
          buildEndpointResolutionFailureMessage,
          getEndpointTravelCategory,
          getEndpointNearbyCategories,
          mapTravelNearbySuggestionToChatPlaceResult,
          mapNearbyPlaceToChatPlaceResult,
          isTrustedProviderLabel,
          isTrustedProviderPlaceResult,
          isTrustedPendingContextItem,
          getEndpointCandidateKey,
          getEndpointCandidateScore,
          mergeEndpointCandidates,
          buildEndpointCandidatesContent,
          scopeAiPlaceResultToPendingItem,
          scopeAiFuelStationToPendingItem,
          scopeAiNearbyPlaceToPendingItem,
          formatLocationCandidateList,
          getLocationResolutionTargetLabel,
          getPlannerActionFieldLabel,
          getResolutionForAction,
          getAppliedPlannerActionLabels,
          formatAppliedPlannerActionPrefix,
          buildLocationResolutionConfirmation,
          getPendingContextItems,
          extractOrdinalSelection,
          extractStateQualifier,
          cleanupFollowUpQualifier,
          cleanupReplacementLocationQuery,
          isLikelyStaleRawLocationContext,
          extractLocationDisambiguationQualifier,
          buildPendingLocationFollowUpQuery,
          selectPendingContextItem,
          extractRadiusKmFromFollowUp,
          inferNearbyCategoryFromFollowUp,
          buildPendingLocationAction,
          getFirstUnresolvedLocationResolution,
          applyPendingLocationFollowUp,
          resolvePendingWeatherFollowUp,
          resolvePendingCandidateFollowUp,
          resolvePendingFuelFollowUp,
          resolvePendingNearbyFollowUp,
          resolvePendingPlannerSettingFollowUp,
          resolvePendingScopeAiFollowUp,
          updatePendingContextFromLocationResult,
          updatePendingContextFromAssistantMessage,
          isExplicitNewScopeAiCommand,
          filterPendingItemsByFollowUp,
          getFuelPriceFromPendingItem,
          getDistanceFromPendingItem,
          isTrustedFuelPendingItem,
          resolvePendingExplanationFollowUp,
          buildPendingContextReminder,
          buildPendingContextReminderResolution,
          handleScopeAiAsk,
          handleAsk,
          normalizeNoisyScopeAiPrompt,
          chooseWorkingMessage,
          getSpeechRecognitionResult,
          getSpeechRecognitionAlternative,
          extractSpeechRecognitionTranscript,
          stopVoiceInput,
          getTripDurationDays,
          isRouteBuildSynced,
          isImageFile,
          createAttachmentPreviewUrl,
          revokeAttachmentPreview,
          readImageFileAsBase64,
          buildChatAttachment,
          handleAttachmentChange,
          removePendingAttachment,
          getDefaultAttachmentPrompt,
          buildPromptWithAttachmentContext,
          buildScopeAiImagePayload,
          buildDraftContextLines,
          normalizeChatContextLine,
          resolveEndpointRecommendationAnchor,
          findEndpointCandidates,
          buildEndpointRecommendationMessage,
          extractWeatherQuery,
          doesPromptAnswerPendingBrief,
          shouldHandlePromptAsNewIntentWhileBriefPending,
          isItineraryBuildCancelRequest,
          buildLeanStops,
          getRouteActionWorkingMessage,
          getAsyncErrorMessage,
          requestItineraryBuild,
          buildItineraryBuildDefaultsSignature,
          buildRouteActionSignature,
          buildAlreadySyncedRouteActionMessage,
          createMessageId,
          isAbortError,
          buildLocalTextMessage,
          normalizeHiddenBlockContent,
          parseChipBlocks,
          parseAssistantResponseBlocks,
          sanitizeChipLabel,
          hasConversationExchange,
          isRecord,
          messages,
          readStringField,
          readPositiveInteger,
          normalizeScopeActionType,
          normalizeScopeActionStopType,
          getScopeActionPlaceLabel,
          getScopeActionAddress,
          getScopeActionNote,
          getActionSearchProximity,
          buildScopeActionSpotId,
          insertStopAtOrder,
          applyAddMarkerAction,
          normalizeActionLookupValue,
          findStopForAction,
          normalizeStopOrderEntry,
          applyScopeRouteAction,
          prepareAssistantMessageForRender,
          getScopeAiAuditPlannerSnapshot,
          getPreviousAssistantMessagesForAudit,
          getPreviousUserPromptForAudit,
          auditAssistantMessageForRender,
          starterMessage,
          getContextualNextMoveText,
          voiceStatus,
          isStartCityRecommendationPrompt,
          scrollAssistIntoView,
          focusComposer,
          handoffPlannerBrief,
          scrollThreadToBottom,
          appendMessage,
          toggleChatMenu,
          closeChatMenu,
          openRestartChatDialog,
          cancelRestartChat,
          revokeConversationAttachmentPreviews,
          confirmRestartChat,
          formatTranscriptFileTimestamp,
          buildTranscriptFileName,
          formatTranscriptMessage,
          buildTranscriptText,
          downloadTranscript,
          saveTranscript,
          resolveMessageContentForTraining,
          trackAiTurn,
          buildPlaceSearchMessage,
          buildPlaceSearchResultKey,
          formatPlaceResultMeta,
          formatMilesFromKm,
          getPlaceResultActionLabel,
          getPlaceResultActionAriaLabel,
          emitPlaceResultAsEndpoint,
          addPlaceSearchResult,
          buildPlaceSearchSpotId,
          inferSpotCategory,
          handleSuggestionClick,
          normalizeScopeAiStructuredChips,
          trackScopeAiStructuredPreferences,
          normalizeScopeAiFuelType,
          formatScopeAiFuelStation,
          formatScopeAiNearbyPlace,
          mapScopeAiNearbyCategory,
          buildScopeAiFuelSearchMessage,
          buildScopeAiNearbyPlacesMessage,
          normalizeScopeAiMapCommand,
          normalizeTripInviteRole,
          isDeleteCancelPrompt,
          isDeleteConfirmPrompt,
          isDeleteRequestPrompt,
          runTripCommand,
          runMapCommand,
          isScopeAiActionBlockApplyResult,
          hasLocationMutationAction,
          setScopeAiPendingContext,
          clearScopeAiPendingContext,
          formatScopeAiDashList,
          scopeAiLocationCandidateItems,
          isExplicitEndpointRouteCommand,
          isPendingFollowUpForContext,
          emitPendingCandidateAsEndpoint,
          emitPendingCandidateAsStop,
        },
      }
    : {}),
});

onMounted(() => {
  window.setTimeout(() => {
    void preloadScopeWasmRuntime();
  }, 0);
});

onBeforeUnmount(() => {
  activeAbortController?.abort();
  voiceRecognition?.abort();
  voiceRecognition = null;
  revokeConversationAttachmentPreviews();
});
</script>

<style scoped>
.trip-ai-assist {
  --trip-ai-assist-active-height: clamp(38rem, 76vh, 58rem);
  --trip-ai-assist-shell-gap: clamp(0.62rem, 0.7vw, var(--space-3));
  --trip-ai-scrollbar-track: color-mix(in srgb, var(--bg-primary) 76%, transparent);
  --trip-ai-scrollbar-thumb: color-mix(in srgb, var(--text-secondary) 34%, var(--accent-teal));
  --trip-ai-scrollbar-thumb-hover: color-mix(in srgb, var(--accent-teal) 54%, var(--text-secondary));
  position: relative;
  overflow: hidden;
  display: grid;
  grid-template-rows: auto auto minmax(0, 1fr) auto;
  min-height: var(--trip-ai-assist-active-height);
  height: var(--trip-ai-assist-active-height);
  max-height: var(--trip-ai-assist-active-height);
  align-content: stretch;
  justify-items: stretch;
  gap: var(--trip-ai-assist-shell-gap);
  padding: clamp(0.85rem, 1vw, var(--space-4));
  border-color: color-mix(in srgb, var(--accent-teal) 16%, var(--glass-border));
  background: var(--bg-secondary);
}

.trip-ai-assist[data-chat-state='active'] {
  min-height: var(--trip-ai-assist-active-height);
  height: var(--trip-ai-assist-active-height);
  max-height: var(--trip-ai-assist-active-height);
  overflow: hidden;
}

.trip-ai-assist[data-chat-state='fresh'] {
  min-height: var(--trip-ai-assist-fresh-height, auto);
  height: var(--trip-ai-assist-fresh-height, auto);
  max-height: var(--trip-ai-assist-fresh-height, none);
}

.trip-ai-assist:active,
.trip-ai-assist:focus-within {
  transform: none;
}

.trip-ai-assist::before {
  display: none;
}

.trip-ai-assist > * {
  position: relative;
  z-index: 1;
}

.trip-ai-assist__header,
.trip-ai-assist__header-actions,
.trip-ai-assist__response-meta,
.trip-ai-assist__suggestions,
.trip-ai-assist__form {
  display: flex;
  gap: var(--space-3);
}

.trip-ai-assist__header {
  position: relative;
  z-index: 20;
  align-items: flex-start;
  justify-content: space-between;
  padding-bottom: clamp(0.55rem, 0.7vw, var(--space-2));
  border-bottom: 1px solid color-mix(in srgb, var(--glass-border) 68%, transparent);
}

.trip-ai-assist__header-actions {
  align-items: center;
  justify-content: flex-end;
  flex-wrap: wrap;
}

.trip-ai-assist__header-copy-block {
  display: grid;
  gap: 0.25rem;
}

.trip-ai-assist .eyebrow {
  font-size: clamp(0.7rem, 0.22vw + 0.66rem, 0.84rem);
  letter-spacing: 0.16em;
  font-weight: var(--font-weight-bold);
}

.trip-ai-assist h2,
.trip-ai-assist p {
  margin: 0;
}

.trip-ai-assist h2 {
  font-size: clamp(1.08rem, 0.35vw + 1rem, var(--font-size-h3));
  line-height: var(--line-height-tight);
}

.trip-ai-assist__header-copy {
  max-width: 24rem;
  color: var(--text-secondary);
  font-size: var(--font-size-small);
  line-height: var(--line-height-normal);
}

.trip-ai-assist__chat-menu {
  position: relative;
  z-index: 25;
  justify-self: end;
}

.trip-ai-assist__menu-button,
.trip-ai-assist__menu-item {
  border: 1px solid color-mix(in srgb, var(--accent-teal) 20%, var(--glass-border));
  color: var(--text-secondary);
  cursor: pointer;
  font: inherit;
  font-size: var(--font-size-caption);
  font-weight: var(--font-weight-semibold);
  transition:
    background var(--transition-fast),
    border-color var(--transition-fast),
    color var(--transition-fast),
    transform var(--transition-fast),
    box-shadow var(--transition-fast);
}

.trip-ai-assist__menu-button {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  min-height: 2.35rem;
  padding: 0.45rem 0.75rem;
  border-radius: var(--radius-full);
  background: color-mix(in srgb, var(--bg-primary) 88%, var(--accent-teal));
}

.trip-ai-assist__menu-button:hover,
.trip-ai-assist__menu-button:focus-visible,
.trip-ai-assist__menu-button[aria-expanded='true'] {
  outline: none;
  transform: translateY(var(--motion-button-lift));
  border-color: color-mix(in srgb, var(--accent-teal) 70%, var(--glass-border));
  background: color-mix(in srgb, var(--accent-teal) 18%, var(--bg-primary));
  color: var(--text-primary);
  box-shadow: 0 0.65rem 1.45rem color-mix(in srgb, var(--accent-teal) 14%, transparent);
}

.trip-ai-assist__menu-popover {
  position: absolute;
  top: calc(100% + 0.55rem);
  right: 0;
  z-index: 60;
  display: grid;
  gap: 0.6rem;
  width: min(20rem, calc(100vw - 3rem));
  min-width: 17rem;
  padding: 0.75rem;
  border: 1px solid color-mix(in srgb, var(--accent-teal) 24%, var(--glass-border));
  border-radius: var(--radius-xl);
  background: color-mix(in srgb, var(--bg-secondary) 94%, var(--bg-primary));
  box-shadow: 0 1.1rem 2.4rem color-mix(in srgb, var(--bg-primary) 62%, transparent);
}

.trip-ai-assist__menu-item {
  display: flex;
  align-items: center;
  gap: 0.8rem;
  width: 100%;
  min-height: 3.35rem;
  padding: 0.9rem 1rem;
  border-radius: var(--radius-md);
  background: transparent;
  text-align: left;
}

.trip-ai-assist__menu-item:hover,
.trip-ai-assist__menu-item:focus-visible {
  outline: none;
  transform: translateX(0.08rem);
  border-color: color-mix(in srgb, var(--accent-teal) 56%, var(--glass-border));
  background: color-mix(in srgb, var(--accent-teal) 14%, var(--bg-primary));
  color: var(--text-primary);
}

.trip-ai-assist__modal-backdrop {
  position: absolute;
  inset: 0;
  z-index: 80;
  display: grid;
  place-items: center;
  padding: var(--space-4);
  border-radius: inherit;
  background: color-mix(in srgb, var(--bg-primary) 64%, transparent);
  backdrop-filter: blur(10px);
}

.trip-ai-assist__modal {
  display: grid;
  gap: var(--space-3);
  width: min(100%, 30rem);
  padding: var(--space-5);
  border: 1px solid color-mix(in srgb, var(--accent-teal) 30%, var(--glass-border));
  border-radius: var(--radius-xl);
  background: color-mix(in srgb, var(--bg-secondary) 94%, var(--bg-primary));
  box-shadow: 0 1.25rem 3rem color-mix(in srgb, var(--bg-primary) 68%, transparent);
}

.trip-ai-assist__modal h3 {
  margin: 0;
  color: var(--text-primary);
  font-size: var(--font-size-h4);
}

.trip-ai-assist__modal p:not(.eyebrow) {
  color: var(--text-secondary);
  line-height: var(--line-height-normal);
}

.trip-ai-assist__modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-3);
  flex-wrap: wrap;
  margin-top: var(--space-2);
}

.trip-ai-assist__modal-button {
  min-height: 2.75rem;
  padding: 0.7rem 1rem;
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-full);
  font: inherit;
  font-weight: var(--font-weight-semibold);
  cursor: pointer;
  transition:
    background var(--transition-fast),
    border-color var(--transition-fast),
    color var(--transition-fast),
    transform var(--transition-fast);
}

.trip-ai-assist__modal-button:hover,
.trip-ai-assist__modal-button:focus-visible {
  outline: none;
  transform: translateY(var(--motion-button-lift));
}

.trip-ai-assist__modal-button--secondary {
  background: color-mix(in srgb, var(--bg-primary) 86%, var(--glass-bg));
  color: var(--text-secondary);
}

.trip-ai-assist__modal-button--secondary:hover,
.trip-ai-assist__modal-button--secondary:focus-visible {
  border-color: color-mix(in srgb, var(--accent-teal) 36%, var(--glass-border));
  color: var(--text-primary);
}

.trip-ai-assist__modal-button--primary {
  border-color: color-mix(in srgb, var(--accent-teal) 60%, var(--glass-border));
  background: color-mix(in srgb, var(--accent-teal) 72%, var(--bg-secondary));
  color: var(--bg-primary);
}

.trip-ai-assist__context-toggle {
  padding: 0.45rem 0.75rem;
  border: 1px solid color-mix(in srgb, var(--accent-teal) 22%, var(--glass-border));
  border-radius: var(--radius-full);
  background: color-mix(in srgb, var(--accent-teal) 10%, var(--bg-primary));
  color: var(--text-secondary);
  cursor: pointer;
  font: inherit;
  font-size: var(--font-size-caption);
  font-weight: var(--font-weight-semibold);
  transition:
    background var(--transition-fast),
    border-color var(--transition-fast),
    color var(--transition-fast),
    transform var(--transition-fast);
}

.trip-ai-assist__context-toggle:hover,
.trip-ai-assist__context-toggle:focus-visible {
  outline: none;
  transform: translateY(var(--motion-button-lift));
  border-color: var(--accent-teal);
  background: var(--accent-teal);
  color: var(--text-inverse);
}

.trip-ai-assist__overview {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 12rem), 1fr));
  gap: clamp(0.42rem, 0.55vw, var(--space-2));
  max-height: 18rem;
  overflow: hidden;
  opacity: 1;
  transition:
    max-height 260ms ease,
    opacity 220ms ease,
    visibility 260ms ease;
}

.trip-ai-assist__overview[data-context-state='collapsed'] {
  max-height: 0;
  opacity: 0;
  pointer-events: none;
  visibility: hidden;
}

.trip-ai-assist__overview-card {
  display: grid;
  align-content: center;
  justify-items: center;
  gap: var(--space-1);
  min-height: 4rem;
  padding: clamp(0.58rem, 0.7vw, var(--space-2));
  border: 1px solid color-mix(in srgb, var(--accent-teal) 12%, var(--glass-border));
  border-radius: var(--radius-xl);
  background: var(--bg-primary);
  box-shadow: inset 0 1px 0 color-mix(in srgb, white 6%, transparent);
  text-align: center;
}

.trip-ai-assist__overview-card span {
  color: var(--text-muted);
  font-size: 0.68rem;
  font-weight: var(--font-weight-semibold);
  letter-spacing: var(--letter-spacing-eyebrow);
  line-height: var(--line-height-tight);
  text-transform: uppercase;
}

.trip-ai-assist__overview-card strong {
  color: var(--text-primary);
  font-size: clamp(0.86rem, 0.42vw + 0.78rem, 1rem);
  font-weight: var(--font-weight-bold);
  line-height: var(--line-height-tight);
  width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
}

.trip-ai-assist__overview-card--route strong {
  display: -webkit-box;
  max-width: 100%;
  overflow-wrap: anywhere;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.trip-ai-assist__body {
  display: grid;
  width: 100%;
  min-height: 0;
  max-height: 100%;
  padding-right: 0.25rem;
  align-content: start;
  align-items: start;
  justify-items: stretch;
  overflow-x: hidden;
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-width: thin;
  scrollbar-color: var(--trip-ai-scrollbar-thumb) var(--trip-ai-scrollbar-track);
  scrollbar-gutter: stable;
}

.trip-ai-assist__body--scrollable {
  overflow-y: auto;
}

.trip-ai-assist[data-chat-state='active'] .trip-ai-assist__body {
  min-height: 0;
  overflow-y: auto;
}

.trip-ai-assist[data-chat-state='fresh'] .trip-ai-assist__body {
  overscroll-behavior: auto;
  scroll-padding-bottom: var(--space-3);
}

.trip-ai-assist[data-chat-state='fresh'] .trip-ai-assist__overview {
  grid-template-columns: repeat(3, minmax(0, 1fr));
  max-height: 4.2rem;
}

.trip-ai-assist[data-chat-state='fresh'] .trip-ai-assist__overview-card {
  min-height: 3.1rem;
  padding: 0.48rem;
}

.trip-ai-assist[data-chat-state='fresh'] .trip-ai-assist__overview-card span {
  font-size: 0.6rem;
}

.trip-ai-assist[data-chat-state='fresh'] .trip-ai-assist__overview-card strong {
  font-size: clamp(0.72rem, 0.34vw + 0.66rem, 0.88rem);
}

.trip-ai-assist__body::-webkit-scrollbar {
  width: 0.68rem;
}

.trip-ai-assist__body::-webkit-scrollbar-track {
  margin: 0.35rem 0;
  border-radius: var(--radius-full);
  background: var(--trip-ai-scrollbar-track);
}

.trip-ai-assist__body::-webkit-scrollbar-thumb {
  min-height: 3rem;
  border: 0.22rem solid transparent;
  border-radius: var(--radius-full);
  background: var(--trip-ai-scrollbar-thumb);
  background-clip: padding-box;
}

.trip-ai-assist__body::-webkit-scrollbar-thumb:hover {
  background: var(--trip-ai-scrollbar-thumb-hover);
  background-clip: padding-box;
}

.trip-ai-assist__draft {
  width: 100%;
  min-height: 0;
  display: grid;
  align-content: start;
  justify-items: stretch;
  gap: clamp(0.52rem, 0.58vw, var(--space-2));
}

.trip-ai-assist__message.trip-ai-assist__starter {
  justify-self: start;
  width: fit-content;
  max-width: min(100%, 48rem);
  box-shadow: 0 0.9rem 2.2rem color-mix(in srgb, black 12%, transparent);
}

.trip-ai-assist__suggestions {
  display: grid;
  width: 100%;
  grid-template-columns: 1fr;
}

.trip-ai-assist__suggestion,
.trip-ai-assist__submit {
  border: 0;
  cursor: pointer;
  font: inherit;
  font-weight: var(--font-weight-semibold);
}

.trip-ai-assist__suggestion {
  display: flex;
  align-items: flex-start;
  min-height: 2.85rem;
  padding: 0.62rem 0.74rem;
  border: 1px solid color-mix(in srgb, var(--accent-teal) 14%, var(--glass-border));
  border-radius: var(--radius-xl);
  background: var(--bg-primary);
  color: var(--text-primary);
  font-size: clamp(0.88rem, 0.38vw + 0.82rem, 0.98rem);
  line-height: var(--line-height-normal);
  text-align: left;
}

.trip-ai-assist__suggestion:hover,
.trip-ai-assist__suggestion:focus-visible {
  outline: none;
  border-color: color-mix(in srgb, var(--accent-teal) 48%, var(--glass-border));
  box-shadow: var(--shadow-glow-teal);
}

.trip-ai-assist__suggestion:disabled {
  cursor: wait;
  opacity: 0.62;
}

.trip-ai-assist__thread {
  display: grid;
  align-content: start;
  align-items: start;
  gap: clamp(0.75rem, 0.9vw, var(--space-3));
  width: 100%;
  min-height: 0;
}

.trip-ai-assist__message {
  display: grid;
  gap: var(--space-2);
  width: fit-content;
  max-width: min(86%, 54rem);
  padding: 0.8rem 0.9rem;
  border: 1px solid color-mix(in srgb, var(--accent-teal) 14%, var(--glass-border));
  border-radius: var(--radius-xl);
  background: color-mix(in srgb, var(--bg-primary) 82%, transparent);
  box-shadow: none;
  transform: none;
  -webkit-tap-highlight-color: transparent;
}

.trip-ai-assist__message:active,
.trip-ai-assist__message:focus,
.trip-ai-assist__message:focus-within {
  transform: none;
  outline: none;
}

.trip-ai-assist__message > span,
.trip-ai-assist__message strong,
.trip-ai-assist__turn-meta span {
  color: var(--accent-teal);
  font-size: var(--font-size-caption);
  font-weight: var(--font-weight-bold);
  letter-spacing: var(--letter-spacing-eyebrow);
  text-transform: uppercase;
}

.trip-ai-assist__turn-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
}

.trip-ai-assist__message p {
  margin: 0;
  color: var(--text-secondary);
  line-height: var(--line-height-normal);
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.trip-ai-assist__message--thinking p {
  display: inline-flex;
  align-items: baseline;
  gap: 0.42rem;
}

.trip-ai-assist__typing-dots {
  display: inline-grid;
  grid-template-columns: repeat(3, 0.32rem);
  gap: 0.22rem;
  align-items: center;
}

.trip-ai-assist__typing-dots span {
  inline-size: 0.32rem;
  block-size: 0.32rem;
  border-radius: var(--radius-full);
  background: currentColor;
  opacity: 0.36;
  animation: trip-ai-dot-pulse 1s ease-in-out infinite;
}

.trip-ai-assist__typing-dots span:nth-child(2) {
  animation-delay: 140ms;
}

.trip-ai-assist__typing-dots span:nth-child(3) {
  animation-delay: 280ms;
}

.trip-ai-assist__structured-response {
  display: grid;
  gap: 0.7rem;
}

.trip-ai-assist__response-section {
  display: grid;
  gap: 0.35rem;
  padding: 0 0 0.8rem;
  border-bottom: 1px solid color-mix(in srgb, var(--glass-border) 54%, transparent);
}

.trip-ai-assist__response-section:last-child {
  padding-bottom: 0;
  border-bottom: 0;
}

.trip-ai-assist__response-section h3 {
  margin: 0;
  color: var(--text-primary);
  font-size: var(--font-size-small);
  font-weight: var(--font-weight-bold);
  letter-spacing: 0;
  line-height: var(--line-height-tight);
}

.trip-ai-assist__response-section p,
.trip-ai-assist__response-section li {
  color: var(--text-secondary);
  line-height: var(--line-height-normal);
}

.trip-ai-assist__response-section p {
  white-space: normal;
}

.trip-ai-assist__response-section ul {
  display: grid;
  gap: 0.28rem;
  margin: 0;
  padding-left: 1.05rem;
}

.trip-ai-assist__response-section li::marker {
  color: var(--accent-teal);
}

.trip-ai-assist__message--user {
  justify-self: end;
  max-width: min(74%, 42rem);
  border-color: color-mix(in srgb, var(--accent-teal) 30%, var(--glass-border));
  border-top-right-radius: var(--radius-md);
  background: color-mix(in srgb, var(--accent-teal) 12%, var(--bg-primary));
}

.trip-ai-assist__message--user p,
.trip-ai-assist__message--user span {
  color: var(--text-primary);
}

.trip-ai-assist__message--user .trip-ai-assist__turn-meta {
  justify-content: flex-end;
}

.trip-ai-assist[data-chat-state='active'] .trip-ai-assist__message {
  max-width: min(96%, 64rem);
}

.trip-ai-assist[data-chat-state='active'] .trip-ai-assist__message--user {
  max-width: min(88%, 54rem);
}

.trip-ai-assist__message--assistant {
  justify-self: start;
  border-top-left-radius: var(--radius-md);
  background: color-mix(in srgb, var(--bg-primary) 76%, transparent);
}

.trip-ai-assist[data-chat-state='active'] .trip-ai-assist__message--assistant {
  width: min(100%, 64rem);
  max-width: min(96%, 64rem);
}

.trip-ai-assist__message--assistant:not(.trip-ai-assist__message--thinking) {
  border-left-color: color-mix(in srgb, var(--accent-teal) 44%, var(--glass-border));
}

.trip-ai-assist__message--error {
  border-color: color-mix(in srgb, var(--danger) 36%, var(--glass-border));
  background: color-mix(in srgb, var(--danger) 10%, var(--bg-secondary));
}

.trip-ai-assist__quickbar {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  width: 100%;
  max-width: 100%;
  padding-top: var(--space-1);
}

.trip-ai-assist__message-chips {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  margin-top: var(--space-3);
}

.trip-ai-assist__quick-chip {
  max-width: 22rem;
  padding: 0.55rem 0.75rem;
  border: 1px solid color-mix(in srgb, var(--accent-teal) 18%, var(--glass-border));
  border-radius: var(--radius-full);
  background: color-mix(in srgb, var(--bg-primary) 86%, var(--accent-teal));
  color: var(--text-secondary);
  cursor: pointer;
  font: inherit;
  font-size: var(--font-size-caption);
  font-weight: var(--font-weight-semibold);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  transition:
    background var(--transition-fast),
    border-color var(--transition-fast),
    color var(--transition-fast),
    transform var(--transition-fast);
}

.trip-ai-assist[data-chat-state='active'] .trip-ai-assist__quick-chip {
  max-width: min(100%, 32rem);
}

.trip-ai-assist__quick-chip:hover:not(:disabled),
.trip-ai-assist__quick-chip:focus-visible:not(:disabled) {
  outline: none;
  transform: translateY(var(--motion-button-lift));
  border-color: var(--accent-teal);
  background: var(--accent-teal);
  color: var(--text-inverse);
}

.trip-ai-assist__quick-chip:disabled {
  cursor: wait;
  opacity: 0.6;
}

.trip-ai-assist__response {
  display: grid;
  gap: var(--space-3);
  padding: var(--space-4);
  border: 1px solid color-mix(in srgb, var(--accent-teal) 18%, var(--glass-border));
  border-radius: var(--radius-xl);
  background: var(--bg-primary);
}

.trip-ai-assist__response--error {
  border-color: color-mix(in srgb, var(--danger) 36%, var(--glass-border));
  background: color-mix(in srgb, var(--danger) 10%, var(--bg-secondary));
}

.trip-ai-assist__response p {
  color: var(--text-secondary);
  line-height: var(--line-height-normal);
  white-space: pre-wrap;
}

.trip-ai-assist__places {
  align-content: start;
  width: min(100%, 58rem);
  max-width: min(92%, 58rem);
}

.trip-ai-assist__place-list {
  display: grid;
  gap: var(--space-2);
}

.trip-ai-assist__place-card {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) minmax(7.25rem, auto);
  align-items: center;
  gap: var(--space-3);
  padding: 0.78rem;
  border: 1px solid color-mix(in srgb, var(--accent-teal) 20%, var(--glass-border));
  border-radius: var(--radius-lg);
  background: color-mix(in srgb, var(--bg-primary) 74%, var(--bg-tertiary));
  box-shadow: inset 0 1px 0 color-mix(in srgb, white 7%, transparent);
}

.trip-ai-assist__place-card strong {
  display: block;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.trip-ai-assist__place-card small {
  display: block;
  margin-top: 0.15rem;
  color: var(--text-muted);
  font-size: var(--font-size-caption);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.trip-ai-assist__place-marker {
  display: inline-grid;
  width: 2rem;
  height: 2rem;
  place-items: center;
  border-radius: var(--radius-full);
  background: var(--accent-teal);
  color: var(--text-inverse);
  font-size: var(--font-size-caption);
  font-weight: var(--font-weight-bold);
}

.trip-ai-assist__place-add {
  min-width: 4.25rem;
  max-width: 10.5rem;
  padding: 0.6rem 0.8rem;
  border: 1px solid color-mix(in srgb, var(--accent-teal) 30%, var(--glass-border));
  border-radius: var(--radius-full);
  background: color-mix(in srgb, var(--accent-teal) 18%, var(--bg-secondary));
  color: var(--text-primary);
  cursor: pointer;
  font: inherit;
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-bold);
  line-height: var(--line-height-tight);
  white-space: normal;
}

.trip-ai-assist__place-add:hover,
.trip-ai-assist__place-add:focus-visible {
  outline: none;
  background: var(--accent-teal);
  color: var(--text-inverse);
  box-shadow: var(--shadow-glow-teal);
}

.trip-ai-assist__response-meta {
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
}

.trip-ai-assist__response-meta strong,
.trip-ai-assist__response strong {
  color: var(--accent-teal);
}

.trip-ai-assist__response-meta span {
  color: var(--text-muted);
  font-size: var(--font-size-caption);
}

.trip-ai-assist__form {
  display: grid;
  gap: 0.5rem;
  padding: 0.48rem;
  border: 1px solid color-mix(in srgb, var(--glass-border) 86%, transparent);
  border-radius: var(--radius-2xl);
  background: var(--bg-primary);
}

.trip-ai-assist__composer-row {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  min-width: 0;
}

.trip-ai-assist__file-input {
  display: none;
}

.trip-ai-assist__input {
  flex: 1;
  min-width: 0;
  padding: 0.72rem 0.82rem;
  border: 0;
  border-radius: var(--radius-xl);
  background: transparent;
  color: var(--text-primary);
  font: inherit;
}

.trip-ai-assist__input:focus {
  outline: none;
  border-color: var(--accent-teal);
  box-shadow: var(--shadow-glow-teal);
}

.trip-ai-assist__attach,
.trip-ai-assist__voice,
.trip-ai-assist__submit {
  border: 0;
  cursor: pointer;
  font: inherit;
  font-weight: var(--font-weight-bold);
}

.trip-ai-assist__attach,
.trip-ai-assist__voice {
  width: 2.45rem;
  height: 2.45rem;
  flex: 0 0 auto;
  display: inline-grid;
  place-items: center;
  border-radius: var(--radius-xl);
  background: color-mix(in srgb, var(--accent-teal) 12%, var(--bg-secondary));
  color: var(--text-primary);
}

.trip-ai-assist__voice--active {
  background: var(--accent-teal);
  color: var(--text-inverse);
  box-shadow: var(--shadow-glow-teal);
}

.trip-ai-assist__submit {
  min-width: 5.35rem;
  padding: 0.72rem 0.92rem;
  border-radius: var(--radius-xl);
  background: var(--accent-teal);
  color: var(--text-inverse);
}

.trip-ai-assist__attach:hover:not(:disabled),
.trip-ai-assist__attach:focus-visible:not(:disabled),
.trip-ai-assist__voice:hover:not(:disabled),
.trip-ai-assist__voice:focus-visible:not(:disabled),
.trip-ai-assist__submit:hover:not(:disabled),
.trip-ai-assist__submit:focus-visible:not(:disabled) {
  outline: none;
  background: var(--accent-teal);
  color: var(--text-inverse);
  box-shadow: var(--shadow-glow-teal);
}

.trip-ai-assist__attach:disabled,
.trip-ai-assist__voice:disabled,
.trip-ai-assist__submit:disabled {
  cursor: not-allowed;
  opacity: 0.58;
}

.trip-ai-assist__voice-status {
  margin: -0.1rem 0.75rem 0.12rem;
  color: var(--text-secondary);
  font-size: var(--font-size-caption);
  line-height: var(--line-height-normal);
}

.trip-ai-assist__attachments {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}

.trip-ai-assist__attachment {
  position: relative;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: var(--space-2);
  max-width: min(100%, 18rem);
  min-height: 3.75rem;
  padding: 0.38rem 0.5rem;
  border: 1px solid color-mix(in srgb, var(--accent-teal) 18%, var(--glass-border));
  border-radius: var(--radius-lg);
  background: color-mix(in srgb, var(--bg-secondary) 76%, transparent);
}

.trip-ai-assist__attachment img,
.trip-ai-assist__attachment-fallback {
  width: 3rem;
  height: 3rem;
  border-radius: var(--radius-md);
  background: color-mix(in srgb, var(--accent-teal) 12%, var(--bg-primary));
}

.trip-ai-assist__attachment img {
  object-fit: cover;
}

.trip-ai-assist__attachment-fallback {
  display: inline-grid;
  place-items: center;
  color: var(--accent-teal);
}

.trip-ai-assist__attachment small {
  min-width: 0;
  color: var(--text-secondary);
  font-size: var(--font-size-caption);
  font-weight: var(--font-weight-semibold);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.trip-ai-assist__attachment button {
  width: 1.85rem;
  height: 1.85rem;
  display: inline-grid;
  place-items: center;
  border: 0;
  border-radius: var(--radius-full);
  background: color-mix(in srgb, var(--bg-primary) 78%, transparent);
  color: var(--text-muted);
  cursor: pointer;
}

.trip-ai-assist__attachment button:hover,
.trip-ai-assist__attachment button:focus-visible {
  outline: none;
  background: color-mix(in srgb, var(--danger) 16%, var(--bg-primary));
  color: var(--danger);
}

@media (max-width: 720px) {
  .trip-ai-assist {
    --trip-ai-assist-active-height: min(82vh, 46rem);
    --trip-ai-assist-body-max-height: clamp(12rem, 48vh, 29rem);
  }

  .trip-ai-assist__header,
  .trip-ai-assist__form {
    align-items: stretch;
    flex-direction: column;
  }

  .trip-ai-assist__header-actions {
    justify-content: stretch;
  }

  .trip-ai-assist__chat-menu,
  .trip-ai-assist__menu-button {
    width: 100%;
  }

  .trip-ai-assist__menu-button {
    justify-content: center;
  }

  .trip-ai-assist__menu-popover {
    right: auto;
    left: 0;
    width: min(100%, 19rem);
    min-width: 0;
  }

  .trip-ai-assist__context-toggle {
    width: 100%;
  }

  .trip-ai-assist__overview,
  .trip-ai-assist__suggestions {
    grid-template-columns: 1fr;
  }

  .trip-ai-assist__message,
  .trip-ai-assist__message--user {
    max-width: 92%;
  }

  .trip-ai-assist__message.trip-ai-assist__starter {
    max-width: 92%;
  }

  .trip-ai-assist__composer-row {
    align-items: stretch;
  }

  .trip-ai-assist__input {
    min-height: 2.9rem;
  }

  .trip-ai-assist__draft {
    align-content: start;
  }
}

@keyframes trip-ai-thread-in {
  from {
    opacity: 0;
    transform: translateY(0.45rem);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes trip-ai-dot-pulse {
  0%,
  80%,
  100% {
    opacity: 0.32;
    transform: translateY(0);
  }

  40% {
    opacity: 1;
    transform: translateY(-0.18rem);
  }
}

@media (prefers-reduced-motion: reduce) {
  .trip-ai-assist__overview,
  .trip-ai-assist__thread,
  .trip-ai-assist__context-toggle,
  .trip-ai-assist__quick-chip,
  .trip-ai-assist__typing-dots span {
    transition-duration: 1ms;
    animation: none;
  }
}
</style>
