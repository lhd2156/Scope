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
              @click="restartChat"
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
              <span>Save Transcript</span>
            </button>
          </div>
        </div>
      </div>
    </header>

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

    <div ref="threadViewport" class="trip-ai-assist__body">
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
                  @click="addPlaceSearchResult(result)"
                >
                  Add
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
          </article>
        </template>

        <article v-if="loading" class="trip-ai-assist__message trip-ai-assist__message--assistant trip-ai-assist__message--thinking">
          <div class="trip-ai-assist__turn-meta">
            <span>Scope AI</span>
          </div>
          <p>{{ workingMessage }}</p>
        </article>

        <div class="trip-ai-assist__quickbar" data-test="trip-ai-quickbar" aria-label="Follow-up prompts">
          <button
            v-for="suggestion in suggestions"
            :key="suggestion"
            type="button"
            class="trip-ai-assist__quick-chip"
            data-test="trip-ai-quick-suggestion"
            :disabled="loading"
            @click.prevent.stop="handleSuggestionClick(suggestion)"
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
        <p class="trip-ai-assist__learning-note" data-test="trip-ai-learning-note">{{ learningNote }}</p>
        <div class="trip-ai-assist__suggestions" aria-label="Trip AI suggestions">
          <button
            v-for="suggestion in suggestions"
            :key="suggestion"
            type="button"
            class="trip-ai-assist__suggestion"
            data-test="trip-ai-suggestion"
            :disabled="loading"
            @click.prevent.stop="handleSuggestionClick(suggestion)"
          >
            {{ suggestion }}
          </button>
        </div>
      </div>
    </div>

    <form class="trip-ai-assist__form" data-test="trip-ai-form" @submit.prevent="handleAsk()">
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
        <input
          ref="promptInput"
          v-model="prompt"
          type="text"
          class="trip-ai-assist__input"
          data-test="trip-ai-input"
          placeholder="Ask Scope AI to build, tighten, or explain this route"
          :disabled="loading"
          autocomplete="off"
        />
        <button type="submit" class="trip-ai-assist__submit" :disabled="loading || !canSubmitPrompt">
          {{ loading ? 'Working' : 'Ask AI' }}
        </button>
      </div>
    </form>
  </section>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue';
import ScopeIcon from '@/components/common/ScopeIcon.vue';
import { planTrip } from '@/services/agentService';
import { trackScopeAiInteraction, type ScopeAiInteractionSource } from '@/services/analyticsService';
import { searchLocations, searchPlaces, type PlaceSearchResult } from '@/services/mapService';
import type { SpotCategory, TripPace, TripPlannerInput, TripSpot } from '@/types';
import { getScopeAiResponseStartedAt, waitForScopeAiResponsePace } from '@/utils/scopeAiResponsePace';
import { useAnalyticsConsent } from '@/utils/analyticsConsent';

const props = withDefaults(
  defineProps<{
    draft: TripPlannerInput;
    locationSearchProximity?: RouteFallbackAnchor;
    tripTitle?: string;
    stops?: TripSpot[];
    userId?: string;
  }>(),
  {
    locationSearchProximity: undefined,
    tripTitle: '',
    stops: () => [],
    userId: undefined,
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
const suggestionSeed = ref(Math.random());
const workingMessage = ref('Thinking through this route');
const lastSuccessfulRouteActionSignature = ref('');
const pendingItineraryBrief = ref<PendingItineraryBrief | null>(null);
const chatMenuOpen = ref(false);
const { consent } = useAnalyticsConsent();
const MAX_SUGGESTIONS = 3;
const MAX_IMAGE_ATTACHMENTS = 4;
const RECENT_CHAT_CONTEXT_LIMIT = 8;
const APP_UI_LOOKUP_PATTERN = /\b(app|screen|button|click|tap|ui|search bar|profile|notifications?|chat bar|route canvas|image icon|add start|add end|start point|end point)\b/i;
const STREET_ADDRESS_PATTERN = /\b\d{1,6}\s+[\w'.-]+(?:\s+[\w'.-]+){0,6}\s+(?:street|st|road|rd|avenue|ave|boulevard|blvd|drive|dr|lane|ln|court|ct|circle|cir|way|parkway|pkwy|highway|hwy|trail|trl|terrace|ter|plaza|plz|farm(?:\s+to\s+market|-to-market)|fm|county road|cr|route)\b/i;

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
    }
  | {
      id: string;
      role: 'assistant';
      kind: 'places';
      content: string;
      queryLabel: string;
      results: PlaceSearchResult[];
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

interface PlaceSearchIntent {
  query: string;
  mode: 'places' | 'locations';
  requiresAnchor: boolean;
}

interface ChatAttachment {
  id: string;
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
type BriefQuestionKey = 'destination' | 'duration' | 'interests' | 'pace' | 'travelParty';

type ItineraryBuildStatus = 'success' | 'busy' | 'queued';

interface ItineraryBuildResult {
  status: ItineraryBuildStatus;
  routeLabel: string;
  stopCount: number;
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

const emit = defineEmits<{
  (event: 'route-stop-add', payload: TripSpot): void;
  (event: 'route-stops-replace', payload: TripSpot[]): void;
  (event: 'itinerary-build-request', payload: ItineraryBuildRequestPayload): void;
}>();

const conversationStarted = computed(() => messages.value.length > 0 || loading.value);
const canSubmitPrompt = computed(() => Boolean(prompt.value.trim() || pendingAttachments.value.length));

const routeLabel = computed(() => {
  const start = formatRouteEndpointLabel(props.draft.destination);
  const end = formatRouteEndpointLabel(props.draft.endDestination);
  if (start && end) {
    return `${start} to ${end}`;
  }

  return start || end || '';
});

const suggestionContextKey = computed(() => [
  props.tripTitle.trim(),
  props.draft.destination.trim(),
  props.draft.endDestination?.trim() ?? '',
  props.draft.startDate,
  props.draft.endDate,
  props.draft.budgetFloor ?? '',
  props.draft.budget ?? '',
  props.draft.pace,
  props.draft.groupSize,
  props.draft.interests.join(','),
  props.stops.map((stop) => stop.title).join(','),
].join('|'));

watch(suggestionContextKey, () => {
  suggestionSeed.value = Math.random();
});

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

const learningNote = computed(() => {
  if (consent.value === 'granted') {
    return 'AI learning is on: opted-in chats and planner outcomes can help train future Scope AI trips.';
  }

  if (consent.value === 'denied') {
    return 'AI learning is off because optional analytics are disabled.';
  }

  return 'Optional analytics controls whether Scope AI chats can be used for future learning.';
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

function getTripDurationDays(): number | null {
  const start = parsePlannerDate(props.draft.startDate);
  const end = parsePlannerDate(props.draft.endDate);

  if (!start || !end || end < start) {
    return null;
  }

  const days = Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1;
  return days > 0 ? days : null;
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
    destination: 'What destination should I use for this trip?',
    duration: 'How many days should I plan for?',
    interests: 'What kind of trip should this feel like: food, culture, nature, adventure, nightlife, shopping, or balanced?',
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

function getMissingItineraryBriefQuestions(): BriefQuestion[] {
  const draft = props.draft;
  const hasStart = Boolean(draft.destination.trim());
  const durationDays = getTripDurationDays();
  const questions: BriefQuestion[] = [];

  if (!hasStart) {
    questions.push(getBriefQuestion('destination'));
  }

  if (!durationDays || durationDays <= 1) {
    questions.push(getBriefQuestion('duration'));
  }

  if (!draft.interests.length) {
    questions.push(getBriefQuestion('interests'));
  }

  if (!draft.pace) {
    questions.push(getBriefQuestion('pace'));
  }

  if (!Number.isFinite(draft.groupSize) || draft.groupSize < 1) {
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

function formatDateInput(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function getWeekendDateDefaults(): Pick<ItineraryBuildDraftDefaults, 'startDate' | 'endDate'> {
  const start = parsePlannerDate(props.draft.startDate) ?? new Date();
  const end = new Date(start);
  end.setDate(start.getDate() + 1);

  return {
    startDate: formatDateInput(start),
    endDate: formatDateInput(end),
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
    interests: next.interests ? [...next.interests] : current.interests ? [...current.interests] : undefined,
  };
}

function buildSmartDefaultsForKeys(keys: BriefQuestionKey[]): ItineraryBuildDraftDefaults {
  return keys.reduce<ItineraryBuildDraftDefaults>(
    (defaults, key) => mergeItineraryBuildDefaults(defaults, getDefaultForBriefQuestion(key)),
    {},
  );
}

function isVagueBriefReply(value: string): boolean {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[’]/g, "'")
    .replace(/[^\w'\s]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const hasSpecificBriefSignal = /\b(?:\d{1,2}\s*(?:day|days|d)|weekend|food|restaurants?|coffee|cafes?|culture|museums?|art|history|nature|parks?|trails?|hikes?|adventure|nightlife|bars?|shopping|scenic|views?|relaxed|chill|balanced|moderate|packed|busy|solo|alone|couple|partner|family|kids?|children|group|friends?)\b/i.test(normalized);
  if (hasSpecificBriefSignal) {
    return false;
  }

  return /\b(?:idk|idc|dunno|whatever|anything|anywhere|any|sure|yeah|yes|yep|ok|okay|fine|alright|meh)\b/i.test(normalized)
    || /\b(?:i\s*(?:dont|don't|do\s*not)\s*know|(?:dont|don't|do\s*not)\s*know|i\s*(?:dont|don't|do\s*not)\s*care|(?:dont|don't|do\s*not)\s*care|not\s*sure|unsure|no\s*(?:idea|clue|preference|prefs?)|not\s*picky|doesn'?t\s*matter|does\s*not\s*matter|surprise\s*(?:me|us)|you\s*(?:choose|pick|decide|plan)|u\s*(?:choose|pick|decide|plan)|you\s*got\s*it|go\s*for\s*it|sounds\s*good|works\s*for\s*me|do\s*your\s*thing|make\s*it\s*good|best\s*option|whatever\s*you\s*(?:think|want|recommend)|anything\s*works|any\s*works|any\s*is\s*fine|i'?m\s*open|im\s*open|open\s*to\s*anything|dealer'?s?\s*choice|up\s*to\s*you|your\s*call|i\s*guess|i\s*trust\s*you|trust\s*you|you\s*know\s*best|help\s*me|just\s*help|u\s*wanna\s*help|you\s*wanna\s*help|pick\s*for\s*me|choose\s*for\s*me|plan\s*it|build\s*it|send\s*it)\b/i.test(normalized);
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
  };
}

function parseInterestReply(value: string): ItineraryBuildDraftDefaults | null {
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

  if (/\bscenic|view|sight|sights|key sights|lookout|photo\b/.test(normalized)) {
    matched.add('scenic');
  }

  if (/\bbalanced|mix|variety|everything\b/.test(normalized)) {
    return { interests: ['food', 'culture', 'scenic'] };
  }

  return matched.size ? { interests: [...matched] } : null;
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
  const bareNumberMatch = normalized.trim().match(/^(\d{1,2})$/);
  const parsed = Number(explicitMatch?.[1] ?? bareNumberMatch?.[1]);
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

function buildAssumptionSummary(defaults: ItineraryBuildDraftDefaults): string[] {
  const summary: string[] = [];
  if (defaults.startDate && defaults.endDate) {
    const days = parsePlannerDate(defaults.startDate) && parsePlannerDate(defaults.endDate)
      ? Math.round(((parsePlannerDate(defaults.endDate) as Date).getTime() - (parsePlannerDate(defaults.startDate) as Date).getTime()) / 86_400_000) + 1
      : null;
    summary.push(days ? `${days} days` : `${defaults.startDate} to ${defaults.endDate}`);
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

function buildSuggestionPool(): string[] {
  const start = formatRouteEndpointLabel(props.draft.destination);
  const end = formatRouteEndpointLabel(props.draft.endDestination);
  const primaryInterest = getInterestLabel(props.draft.interests[0]) || 'local';
  const interestList = formatList(props.draft.interests.map(getInterestLabel).filter(Boolean));
  const dateLabel = getDateLabel(props.draft.startDate, props.draft.endDate);
  const stopCount = props.stops.length;
  const budget = budgetLabel.value === 'Set budget' ? '' : budgetLabel.value;
  const pace = paceLabel.value.toLowerCase();
  const pool: string[] = [];

  if (start && end) {
    pool.push(`Find a ${primaryInterest} stop between ${start} and ${end}`);
    pool.push(`Check whether ${start} to ${end} works at a ${pace} pace`);
  } else if (start) {
    pool.push(`Find ${primaryInterest} stops near ${start}`);
    pool.push(`Shape a route that starts from ${start}`);
  } else {
    pool.push(interestList ? `Pick a start city for a ${interestList} trip` : 'Help me choose a strong start city');
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

  pool.push(start ? `Find a coffee or scenic stop near ${start}` : 'Build a balanced first draft');
  pool.push(routeLabel.value ? 'Explain the cleanest next step for this route' : 'Suggest a simple weekend direction');

  return [...new Set(pool)];
}

const primarySuggestion = computed(() => {
  const route = routeLabel.value;
  const start = formatRouteEndpointLabel(props.draft.destination);

  if (route) {
    return `Build the itinerary from ${route}`;
  }

  if (start) {
    return `Build the itinerary starting from ${start}`;
  }

  return 'Help me build the first itinerary';
});

const suggestions = computed(() => {
  const leadSuggestion = primarySuggestion.value;
  const remainingSuggestions = pickTailoredSuggestions(
    buildSuggestionPool().filter((suggestion) => suggestion !== leadSuggestion),
    suggestionSeed.value,
  ).slice(0, Math.max(0, MAX_SUGGESTIONS - 1));

  return [leadSuggestion, ...remainingSuggestions];
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

function pickTailoredSuggestions(pool: string[], seed: number): string[] {
  return pool
    .map((value, index) => ({ value, score: getSeededScore(`${value}-${index}`, seed) }))
    .sort((left, right) => left.score - right.score)
    .slice(0, MAX_SUGGESTIONS)
    .map((item) => item.value);
}

function getSeededScore(value: string, seed: number): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash << 5) - hash) + value.charCodeAt(index);
    hash |= 0;
  }

  const score = Math.sin(hash + (seed * 10_000)) * 10_000;
  return score - Math.floor(score);
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

function isImageFile(file: File): boolean {
  return file.type.startsWith('image/') || /\.(avif|bmp|gif|heic|jpe?g|png|webp)$/i.test(file.name);
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

function buildChatAttachment(file: File): ChatAttachment {
  return {
    id: createMessageId('image'),
    name: file.name || 'Attached image',
    previewUrl: createAttachmentPreviewUrl(file),
    size: file.size,
    type: file.type || 'image',
  };
}

function openAttachmentPicker(): void {
  if (loading.value) {
    return;
  }

  attachmentInput.value?.click();
}

function handleAttachmentChange(event: Event): void {
  const input = event.target as HTMLInputElement;
  const remainingSlots = Math.max(0, MAX_IMAGE_ATTACHMENTS - pendingAttachments.value.length);
  const imageFiles = Array.from(input.files ?? [])
    .filter(isImageFile)
    .slice(0, remainingSlots);

  if (imageFiles.length) {
    pendingAttachments.value = [
      ...pendingAttachments.value,
      ...imageFiles.map(buildChatAttachment),
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
  const stops = props.stops.map((stop, index) => `${index + 1}. ${stop.title}${stop.city ? ` (${stop.city})` : ''}`);

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
    draft.interests.length ? `Interests: ${draft.interests.join(', ')}` : '',
    stops.length ? `Stops:\n${stops.join('\n')}` : '',
  ].filter(Boolean);
}

function normalizeChatContextLine(value: string): string {
  const normalized = value.replace(/\s+/g, ' ').trim();
  return normalized.length > 360 ? `${normalized.slice(0, 357)}...` : normalized;
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
  return [
    'Help refine this Scope trip draft.',
    'Talk directly to the traveler as "you" and "your", like a focused support-style trip copilot.',
    'You are the Scope route and app copilot, not a generic GPT chat box. Use the visible planner, map, route, budget, stops, images, and recent chat as your working context.',
    'Answer like you are talking to this traveler, not writing an internal report. Make the answer feel clearly meant for them.',
    'If the traveler is just greeting you, thanking you, venting, or checking if you are there, answer naturally in one or two sentences. Do not force sections, bullets, or trip categories into small talk.',
    'If the traveler asks who they are, their name, or their account, do not pretend to know. Say you only have the visible Scope draft/chat context unless profile details are provided.',
    'If the traveler asks who you are, say you are Scope AI, the trip and app copilot inside Scope.',
    'If the traveler asks where something is, separate Scope app UI questions from real-world place questions. For app UI, explain the control or section. For real-world places, use the live place data when it exists and otherwise be honest about what location detail is missing.',
    'Treat vague follow-ups as responses to the last Scope AI question unless the traveler clearly starts a new topic. If they say "idk", "not sure", "whatever", or "surprise me" after an itinerary question, choose smart defaults and keep moving.',
    'If the traveler asks something ambiguous or off-topic with no useful recent-chat thread, ask one short clarifying question instead of dumping budget, timing, or stop categories.',
    'If the traveler sounds confused or frustrated, acknowledge that first, then ask one focused question or give one clear next step.',
    'Answer the traveler request directly. Do not restate the whole brief unless it changes the decision. Keep it concise, specific, and actionable.',
    'Before building any itinerary, make sure you have destination(s), trip length in days, interests, travel pace, and who is traveling. Treat those as answered when they are present in Current draft, Recent chat, or smart defaults from a vague follow-up. If any are missing, ask only the single most essential missing question in one short conversational message.',
    'When you do build an itinerary, organize it by day with clear Morning, Afternoon, and Evening slots. Suggest specific real places, factor in travel time between stops, personalize the picks to the stated interests, and label must-sees separately from hidden gems.',
    'Sound like a knowledgeable local friend: conversational, practical, and personal. Avoid generic travel-bot filler.',
    'Do not expose internal implementation labels, model names, or debug wording to the traveler.',
    'If the same route action was just completed and the planner has not changed, say it is already synced and give one useful next move instead of repeating the same Done message.',
    'For real planning questions, format the response as short traveler-facing sections such as For you, What I would do, Keep in mind, and Your next move. Use bullets only when they help scanning.',
    'Never use generic report labels like Verdict unless the traveler asks for a verdict. Never say "this draft route"; say "your route" or ask for the missing endpoint.',
    'Do not hand off to the itinerary builder unless the traveler explicitly asks to build, create, generate, or make an itinerary.',
    'Use the current draft to infer taste and constraints. If the next move is uncertain, ask one natural follow-up question.',
    'Use the recent chat to avoid repeating yourself. Never send the exact same assistant message that already appears in Recent chat. Even a repeated "yo", "thanks", or "ok" needs fresh natural wording.',
    'If the traveler asks a similar question again, answer from a new angle: tradeoff, risk, checklist, next decision, or one clarifying question.',
    context.length ? `Current draft:\n${context.join('\n')}` : 'Current draft: blank.',
    recentChat.length ? `Recent chat:\n${recentChat.join('\n')}` : '',
    `Traveler request: ${userPrompt}`,
  ].filter(Boolean).join('\n\n');
}

function hasCoordinatePair(latitude: number | undefined, longitude: number | undefined): boolean {
  return Number.isFinite(latitude) && Number.isFinite(longitude);
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
    nightlife: 'restaurant',
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
        });
      }
    });
  });
}

function buildRouteActionSignature(reason: RouteActionReason): string {
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
  const missingBriefQuestions = shouldBuildItinerary && !options.allowSmartDefaults ? getMissingItineraryBriefQuestions() : [];
  const routeActionSignature = buildRouteActionSignature(reason);

  if (!hasDestination) {
    pendingItineraryBrief.value = {
      reason,
      originalPrompt: userPrompt,
      missingKeys: ['destination'],
      draftDefaults: {},
    };
    return {
      id: createMessageId('assistant'),
      role: 'assistant',
      kind: 'text',
      model: 'scope-action',
      content: 'I can build that. What destination should I use for this trip?',
    };
  }

  if (missingBriefQuestions.length) {
    pendingItineraryBrief.value = {
      reason,
      originalPrompt: userPrompt,
      missingKeys: missingBriefQuestions.map((question) => question.key),
      draftDefaults: {},
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
    lastSuccessfulRouteActionSignature.value = buildRouteActionSignature(reason);

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
    const result = await requestItineraryBuild(userPrompt, reason, options.draftDefaults);

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

    const stopLabel = result.stopCount === 1 ? '1 stop' : `${result.stopCount} stops`;
    const lead = reason === 'tighten'
      ? `Done. I rebuilt ${result.routeLabel || route} as a lean itinerary with ${stopLabel}.`
      : `Done. I built ${result.routeLabel || route} into an itinerary with ${stopLabel}.`;

    await nextTick();
    lastSuccessfulRouteActionSignature.value = buildRouteActionSignature(reason);

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

async function handoffPlannerBrief(options: { prompt?: string } = {}): Promise<void> {
  await focusComposer();

  if (loading.value) {
    return;
  }

  prompt.value = options.prompt?.trim() || primarySuggestion.value;
  await handleAsk('route-action');
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

function revokeConversationAttachmentPreviews(): void {
  pendingAttachments.value.forEach(revokeAttachmentPreview);
  messages.value.forEach((message) => {
    if (message.role === 'user') {
      message.attachments?.forEach(revokeAttachmentPreview);
    }
  });
}

function restartChat(): void {
  closeChatMenu();
  const confirmed = typeof window === 'undefined'
    || window.confirm('Restart this Scope AI chat? This clears the conversation in this panel.');
  if (!confirmed) {
    return;
  }

  revokeConversationAttachmentPreviews();
  messages.value = [];
  pendingAttachments.value = [];
  pendingItineraryBrief.value = null;
  prompt.value = '';
  workingMessage.value = 'Thinking through this route';
  lastSuccessfulRouteActionSignature.value = '';
  isContextExpanded.value = true;
  suggestionSeed.value = Math.random();
}

function buildTranscriptFileName(): string {
  const date = new Date().toISOString().slice(0, 10);
  const routeSlug = (props.tripTitle || routeLabel.value || 'route-copilot')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 52);

  return `scope-${routeSlug || 'route-copilot'}-transcript-${date}.txt`;
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
  };
}

function buildPlaceSearchResultKey(result: PlaceSearchResult, index: number): string {
  return result.id ?? `${result.placeName}-${result.latitude}-${result.longitude}-${index}`;
}

function formatPlaceResultMeta(result: PlaceSearchResult): string {
  const details = [
    result.distanceKm === undefined ? '' : `${formatMilesFromKm(result.distanceKm)} away`,
    result.formattedAddress,
    result.category,
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

function addPlaceSearchResult(result: PlaceSearchResult): void {
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

async function handleSuggestionClick(suggestion: string): Promise<void> {
  prompt.value = suggestion;
  await handleAsk('suggestion');
}

async function buildPendingBriefFollowUpMessage(userReply: string): Promise<ChatMessage | null> {
  const pendingBrief = pendingItineraryBrief.value;
  if (!pendingBrief) {
    return null;
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

  if (currentKey === 'destination') {
    pendingItineraryBrief.value = null;
    return {
      id: createMessageId('assistant'),
      role: 'assistant',
      kind: 'text',
      model: 'scope-action',
      content: 'Add that destination to the route builder first, then I can build the itinerary from the planner without losing the map context.',
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
    nextDefaults = mergeItineraryBuildDefaults(nextDefaults, getDefaultForBriefQuestion(currentKey));
    answeredKeys.add(currentKey);
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

async function handleAsk(userSource: ScopeAiInteractionSource = 'typed'): Promise<void> {
  const trimmedPrompt = prompt.value.trim();
  const submittedAttachments = pendingAttachments.value;
  const submittedPrompt = trimmedPrompt || (submittedAttachments.length ? getDefaultAttachmentPrompt(submittedAttachments) : '');
  const assistantPrompt = buildPromptWithAttachmentContext(submittedPrompt, submittedAttachments);

  if ((!submittedPrompt && !submittedAttachments.length) || loading.value) {
    return;
  }

  isContextExpanded.value = true;
  const interactionId = createMessageId('turn');
  appendMessage({
    id: `${interactionId}-user`,
    role: 'user',
    content: submittedPrompt,
    attachments: submittedAttachments,
  });
  loading.value = true;
  const responseStartedAt = getScopeAiResponseStartedAt();
  prompt.value = '';
  pendingAttachments.value = [];
  await scrollThreadToBottom();

  let assistantMessage: ChatMessage;
  let trackingSource: ScopeAiInteractionSource = userSource;
  let routeActionReasonForAnalytics: RouteActionReason | undefined;

  try {
    const routeActionReason = resolveRouteActionReason(submittedPrompt);
    const placeSearchIntent = extractPlaceSearchIntent(submittedPrompt);
    const pendingRouteActionReason = pendingItineraryBrief.value?.reason;
    const pendingBriefMessage = await buildPendingBriefFollowUpMessage(submittedPrompt);
    if (pendingBriefMessage) {
      trackingSource = 'route-action';
      routeActionReasonForAnalytics = pendingRouteActionReason ?? routeActionReason ?? 'build';
      assistantMessage = pendingBriefMessage;
    } else if (routeActionReason) {
      trackingSource = 'route-action';
      routeActionReasonForAnalytics = routeActionReason;
      assistantMessage = await buildRouteActionMessage(routeActionReason, submittedPrompt);
    } else if (placeSearchIntent) {
      trackingSource = 'place-search';
      assistantMessage = await buildPlaceSearchMessage(placeSearchIntent, submittedPrompt);
    } else {
      const result = await planTrip({
        prompt: buildAssistantPrompt(assistantPrompt),
        user_id: props.userId,
        start_date: props.draft.startDate,
      });
      assistantMessage = {
        id: createMessageId('assistant'),
        role: 'assistant',
        kind: 'text',
        content: result.itinerary,
        model: result.model,
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
    workingMessage.value = 'Thinking through this route';
  }

  trackAiTurn(interactionId, assistantPrompt, assistantMessage, trackingSource, routeActionReasonForAnalytics);
  appendMessage(assistantMessage);
}

defineExpose<{
  handoffPlannerBrief: (options?: { prompt?: string }) => Promise<void>;
  focusComposer: () => Promise<void>;
}>({
  handoffPlannerBrief,
  focusComposer,
});

onBeforeUnmount(() => {
  revokeConversationAttachmentPreviews();
});
</script>

<style scoped>
.trip-ai-assist {
  --trip-ai-assist-active-height: clamp(42rem, 78vh, 64rem);
  --trip-ai-scrollbar-track: color-mix(in srgb, var(--bg-primary) 76%, transparent);
  --trip-ai-scrollbar-thumb: color-mix(in srgb, var(--text-secondary) 34%, var(--accent-teal));
  --trip-ai-scrollbar-thumb-hover: color-mix(in srgb, var(--accent-teal) 54%, var(--text-secondary));
  position: relative;
  overflow: hidden;
  display: grid;
  grid-template-rows: auto auto minmax(0, 1fr) auto;
  min-height: var(--trip-ai-assist-active-height);
  align-content: stretch;
  justify-items: stretch;
  gap: var(--space-4);
  padding: clamp(var(--space-4), 2.4vw, var(--space-5));
  border-color: color-mix(in srgb, var(--accent-teal) 16%, var(--glass-border));
  background: var(--bg-secondary);
}

.trip-ai-assist[data-chat-state='active'] {
  min-height: var(--trip-ai-assist-active-height);
  height: auto;
  max-height: none;
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
  padding-bottom: var(--space-3);
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

.trip-ai-assist h2,
.trip-ai-assist p {
  margin: 0;
}

.trip-ai-assist h2 {
  font-size: var(--font-size-h3);
  line-height: var(--line-height-tight);
}

.trip-ai-assist__header-copy {
  max-width: 24rem;
  color: var(--text-secondary);
  font-size: var(--font-size-body-sm);
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
  gap: var(--space-3);
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
  align-content: start;
  gap: var(--space-1);
  min-height: 4.85rem;
  padding: var(--space-3);
  border: 1px solid color-mix(in srgb, var(--accent-teal) 12%, var(--glass-border));
  border-radius: var(--radius-xl);
  background: var(--bg-primary);
  box-shadow: inset 0 1px 0 color-mix(in srgb, white 6%, transparent);
}

.trip-ai-assist__overview-card span {
  color: var(--text-muted);
  font-size: var(--font-size-caption);
  font-weight: var(--font-weight-semibold);
  letter-spacing: var(--letter-spacing-eyebrow);
  line-height: var(--line-height-tight);
  text-transform: uppercase;
}

.trip-ai-assist__overview-card strong {
  color: var(--text-primary);
  font-size: clamp(1.02rem, 1.2vw, 1.18rem);
  font-weight: var(--font-weight-bold);
  line-height: var(--line-height-tight);
  overflow: hidden;
  text-overflow: ellipsis;
}

.trip-ai-assist__overview-card--route strong {
  display: -webkit-box;
  max-width: 58rem;
  overflow-wrap: anywhere;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
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
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-width: thin;
  scrollbar-color: var(--trip-ai-scrollbar-thumb) var(--trip-ai-scrollbar-track);
  scrollbar-gutter: stable;
}

.trip-ai-assist[data-chat-state='fresh'] .trip-ai-assist__body {
  overscroll-behavior: auto;
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
  gap: var(--space-3);
}

.trip-ai-assist__message.trip-ai-assist__starter {
  justify-self: start;
  width: fit-content;
  max-width: min(100%, 48rem);
  box-shadow: 0 0.9rem 2.2rem color-mix(in srgb, black 12%, transparent);
}

.trip-ai-assist__learning-note {
  width: fit-content;
  max-width: min(100%, 48rem);
  padding: 0.48rem 0.72rem;
  border: 1px solid color-mix(in srgb, var(--accent-teal) 14%, var(--glass-border));
  border-radius: var(--radius-xl);
  background: color-mix(in srgb, var(--bg-primary) 78%, var(--accent-teal));
  color: var(--text-muted);
  font-size: var(--font-size-caption);
  line-height: var(--line-height-normal);
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
  min-height: 3.7rem;
  padding: 0.95rem 1rem;
  border: 1px solid color-mix(in srgb, var(--accent-teal) 14%, var(--glass-border));
  border-radius: var(--radius-xl);
  background: var(--bg-primary);
  color: var(--text-primary);
  font-size: clamp(0.98rem, 1.2vw, 1.08rem);
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
  gap: var(--space-4);
  width: 100%;
  min-height: 0;
}

.trip-ai-assist__message {
  display: grid;
  gap: var(--space-2);
  width: fit-content;
  max-width: min(86%, 54rem);
  padding: 1rem 1.1rem;
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
  grid-template-columns: auto minmax(0, 1fr) auto;
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
  padding: 0.6rem 0.8rem;
  border: 1px solid color-mix(in srgb, var(--accent-teal) 30%, var(--glass-border));
  border-radius: var(--radius-full);
  background: color-mix(in srgb, var(--accent-teal) 18%, var(--bg-secondary));
  color: var(--text-primary);
  cursor: pointer;
  font: inherit;
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-bold);
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
  gap: var(--space-2);
  padding: 0.62rem;
  border: 1px solid color-mix(in srgb, var(--glass-border) 86%, transparent);
  border-radius: var(--radius-2xl);
  background: var(--bg-primary);
}

.trip-ai-assist__composer-row {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  min-width: 0;
}

.trip-ai-assist__file-input {
  display: none;
}

.trip-ai-assist__input {
  flex: 1;
  min-width: 0;
  padding: 0.9rem 1rem;
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
.trip-ai-assist__submit {
  border: 0;
  cursor: pointer;
  font: inherit;
  font-weight: var(--font-weight-bold);
}

.trip-ai-assist__attach {
  width: 2.9rem;
  height: 2.9rem;
  flex: 0 0 auto;
  display: inline-grid;
  place-items: center;
  border-radius: var(--radius-xl);
  background: color-mix(in srgb, var(--accent-teal) 12%, var(--bg-secondary));
  color: var(--text-primary);
}

.trip-ai-assist__submit {
  min-width: 6.15rem;
  padding: 0.9rem 1.2rem;
  border-radius: var(--radius-xl);
  background: var(--accent-teal);
  color: var(--text-inverse);
}

.trip-ai-assist__attach:hover:not(:disabled),
.trip-ai-assist__attach:focus-visible:not(:disabled),
.trip-ai-assist__submit:hover:not(:disabled),
.trip-ai-assist__submit:focus-visible:not(:disabled) {
  outline: none;
  background: var(--accent-teal);
  color: var(--text-inverse);
  box-shadow: var(--shadow-glow-teal);
}

.trip-ai-assist__attach:disabled,
.trip-ai-assist__submit:disabled {
  cursor: not-allowed;
  opacity: 0.58;
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

  .trip-ai-assist__message.trip-ai-assist__starter,
  .trip-ai-assist__learning-note {
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

@media (prefers-reduced-motion: reduce) {
  .trip-ai-assist__overview,
  .trip-ai-assist__thread,
  .trip-ai-assist__context-toggle,
  .trip-ai-assist__quick-chip {
    transition-duration: 1ms;
    animation: none;
  }
}
</style>
