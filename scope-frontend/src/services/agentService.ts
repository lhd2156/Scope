import api, { isApiClientError } from '@/services/api';
import { DEMO_MODE_ENABLED, localFallbackEnabled } from '@/services/demoMode';
import { isVagueBriefReply } from '@/utils/itineraryBrief';

export interface TripPlanRequest {
  prompt: string;
  user_id?: string;
  start_date?: string;
}

export interface TripPlanOptions {
  signal?: AbortSignal;
}

export interface TripPlanResponse {
  itinerary: string;
  steps: number;
  model: string;
}

interface TripChatResponse {
  response?: string;
  itinerary?: string;
  steps?: number;
  model?: string;
}

const AGENT_BASE = '/api/intel/agent';
const AGENT_LOCAL_FALLBACK_ENABLED = localFallbackEnabled('VITE', 'ENABLE', 'AGENT', 'LOCAL', 'FALLBACK');
const APP_HELP_SURFACE_PATTERN = /\b(app|screen|button|click|tap|ui|interface|route canvas|create spot|notifications?|profile|search bar|image icon|chat bar|planner|map|route points?|start point|end point|add start|add end|upload|attach|preview|build itinerary)\b/i;
const APP_HELP_QUESTION_PATTERN = /\b(how do i|how can i|where do i|where is|where can i|what button|which button|click|tap|open|go to|find in (?:the )?app|locate in (?:the )?app)\b/i;

function readPromptLine(prompt: string, label: string): string {
  const match = prompt.match(new RegExp(`^${label}:\\s*(.+)$`, 'im'));
  return match?.[1]?.trim() ?? '';
}

function readTravelerRequest(prompt: string): string {
  const match = prompt.match(/Traveler request:\s*([\s\S]+)$/i);
  return match?.[1]?.trim() || prompt.trim();
}

function readPromptSection(prompt: string, label: string): string {
  const match = prompt.match(new RegExp(`^${label}:\\s*([\\s\\S]*?)(?=\\n[A-Z][A-Za-z ]+:|$)`, 'im'));
  return match?.[1]?.trim() ?? '';
}

type TravelerRequestTopic =
  | 'appHelp'
  | 'budget'
  | 'tighten'
  | 'timing'
  | 'midpoint'
  | 'startCity'
  | 'weekend'
  | 'food'
  | 'weather'
  | 'safety'
  | 'group'
  | 'image'
  | 'general';

const REQUEST_TOPIC_PATTERNS: Record<TravelerRequestTopic, RegExp> = {
  appHelp: APP_HELP_SURFACE_PATTERN,
  budget: /\b(budget|inside|under|cap|\$|cost|spend|price|cheap|expensive)\b/i,
  tighten: /\b(tighten|remove filler|filler|clean up|simplify|rebalance|trim|too much)\b/i,
  timing: /\b(timing|time|date|schedule|works?|pace|relaxed|rushed|drive day|arrival|depart)\b/i,
  midpoint: /\b(stop|midpoint|middle|halfway|between|on the way|en route|break)\b/i,
  startCity: /\b(start(?:ing)?\s+(?:city|point|place|location)|origin|launch\s+(?:city|point)|where\s+(?:should|do)\s+(?:i|we)\s+start|choose\s+(?:a\s+)?(?:strong\s+)?start)\b/i,
  weekend: /\b(weekend|simple|easy|direction|first draft|starter)\b/i,
  food: /\b(food|lunch|dinner|breakfast|restaurant|coffee|cafe|meal|eat|drink)\b/i,
  weather: /\b(weather|rain|storm|hot|cold|heat|wind|snow|forecast)\b/i,
  safety: /\b(safe|safety|danger|night|late|avoid|sketchy|risk)\b/i,
  group: /\b(group|friends|family|kids|children|solo|couple|travelers|people)\b/i,
  image: /\b(image|photo|picture|attached|attachment|see this|look at this)\b/i,
  general: /[\s\S]/,
};

type ConversationalIntent =
  | 'greeting'
  | 'smallTalk'
  | 'thanks'
  | 'acknowledgement'
  | 'farewell'
  | 'frustration'
  | 'capability'
  | 'identity'
  | 'assistantIdentity'
  | 'context'
  | 'privacy'
  | 'selfLocation'
  | 'realWorldLocation'
  | 'personalBoundary'
  | 'romanticBoundary'
  | 'abuseBoundary'
  | 'crisis'
  | 'highStakesOffTopic'
  | 'offTopic'
  | 'clarify';

function readRecentChat(prompt: string): string {
  const match = prompt.match(/(?:^|\n)Recent chat:\s*([\s\S]*?)(?=\nTraveler request:|$)/i);
  return match?.[1]?.trim() ?? '';
}

function isAppHelpRequest(value: string): boolean {
  return APP_HELP_SURFACE_PATTERN.test(value) && (
    APP_HELP_QUESTION_PATTERN.test(value) ||
    /\b(add start|add end|upload|attach|create spot|build itinerary|route canvas)\b/i.test(value)
  );
}

function classifyTravelerRequest(value: string): TravelerRequestTopic {
  if (isAppHelpRequest(value)) {
    return 'appHelp';
  }

  if (REQUEST_TOPIC_PATTERNS.image.test(value)) {
    return 'image';
  }

  if (REQUEST_TOPIC_PATTERNS.budget.test(value)) {
    return 'budget';
  }

  if (REQUEST_TOPIC_PATTERNS.tighten.test(value)) {
    return 'tighten';
  }

  if (REQUEST_TOPIC_PATTERNS.timing.test(value)) {
    return 'timing';
  }

  if (REQUEST_TOPIC_PATTERNS.midpoint.test(value)) {
    return 'midpoint';
  }

  if (REQUEST_TOPIC_PATTERNS.startCity.test(value)) {
    return 'startCity';
  }

  if (REQUEST_TOPIC_PATTERNS.food.test(value)) {
    return 'food';
  }

  if (REQUEST_TOPIC_PATTERNS.weather.test(value)) {
    return 'weather';
  }

  if (REQUEST_TOPIC_PATTERNS.safety.test(value)) {
    return 'safety';
  }

  if (REQUEST_TOPIC_PATTERNS.group.test(value)) {
    return 'group';
  }

  if (REQUEST_TOPIC_PATTERNS.weekend.test(value)) {
    return 'weekend';
  }

  return 'general';
}

function normalizeConversationText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^\w\s']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function isScopeDomainQuestion(normalized: string): boolean {
  return /\b(scope|app|screen|button|click|tap|ui|interface|route canvas|planner|map|trip|travel|route|road trip|itinerary|spot|spots|place|places|experience|experiences|destination|destinations|city|visit|go to|stay in|drive|flight|hotel|restaurant|food|entertainment|bowling|arcade|theme park|amusement park|movie theater|budget|pace|timing|schedule|start|end|stop|stops|midpoint|halfway|address|street|road|avenue|boulevard|county road|farm to market|fm|photo|photos|image|images|review|reviews|friend|friends|notification|notifications|profile|search|weather|safe|safety|group|weekend|vacation)\b/.test(normalized);
}

function isOffTopicGeneralQuestion(value: string, normalized: string, topic: TravelerRequestTopic): boolean {
  if (topic !== 'general' || isScopeDomainQuestion(normalized)) {
    return false;
  }

  const wordCount = normalized.split(/\s+/).filter(Boolean).length;
  if (wordCount <= 3) {
    return false;
  }

  return (
    /^(what|who|when|why|how|can|could|would|should|do|does|did|is|are|am|will|write|draft|explain|solve|code|make|tell me|teach me|summarize)\b/.test(normalized) ||
    /\?\s*$/.test(value.trim())
  );
}

function readRecentChatRoleLines(recentChat: string, role: 'User' | 'Scope AI'): string[] {
  const prefixPattern = new RegExp(`^${role}:\\s*(.+)$`, 'i');
  return recentChat
    .split('\n')
    .map((line) => line.trim())
    .map((line) => line.match(prefixPattern)?.[1]?.trim() ?? '')
    .filter(Boolean);
}

interface RecentChatLine {
  role: 'User' | 'Scope AI';
  content: string;
}

function readRecentChatLines(recentChat: string): RecentChatLine[] {
  return recentChat
    .split('\n')
    .map((line) => line.trim())
    .map((line): RecentChatLine | null => {
      const match = line.match(/^(User|Scope AI):\s*(.+)$/i);
      if (!match?.[1] || !match[2]?.trim()) {
        return null;
      }

      return {
        role: /^user$/i.test(match[1]) ? 'User' : 'Scope AI',
        content: match[2].trim(),
      };
    })
    .filter((line): line is RecentChatLine => Boolean(line));
}

function classifyConversationalIntent(value: string, topic: TravelerRequestTopic): ConversationalIntent | null {
  const normalized = normalizeConversationText(value);
  if (!normalized) {
    return null;
  }

  const wordCount = normalized.split(/\s+/).filter(Boolean).length;

  if (/\b(i want to (?:die|kill myself|hurt myself)|i'?m going to (?:kill myself|hurt myself)|suicide|self harm|end my life|hurt myself)\b/.test(normalized)) {
    return 'crisis';
  }

  if (/\b(fuck you|shut up|you suck|you are useless|you're useless|idiot|moron|dumbass|bitch|asshole)\b/.test(normalized)) {
    return 'abuseBoundary';
  }

  if (
    /\b(send|show|give).*\b(nudes?|naked|porn|explicit pics?)\b/.test(normalized) ||
    /\b(?:are|r)\s+(?:you|u)\s+(?:horny|sexy|hot)\b/.test(normalized) ||
    /\b(?:date|kiss|marry|sleep with|hook up with)\s+(?:me|you)\b/.test(normalized) ||
    /\b(i love you|love you|love u|luv you|be my girlfriend|be my boyfriend)\b/.test(normalized)
  ) {
    return 'romanticBoundary';
  }

  if (
    /\b(?:are|r)\s+(?:you|u)\s+(?:gay|straight|bi|bisexual|lesbian|trans|transgender|queer|asexual|male|female|a man|a woman|a boy|a girl|black|white|asian|latino|hispanic|christian|muslim|jewish|religious|liberal|conservative|democrat|republican|single|married|dating)\b/.test(normalized) ||
    /\b(?:what'?s|what is)\s+your\s+(?:sexuality|sexual orientation|gender|race|ethnicity|religion|politics|political party|age)\b/.test(normalized) ||
    /\b(?:do|did)\s+(?:you|u)\s+(?:have|got|want)\s+(?:a\s+)?(?:girlfriend|boyfriend|partner|wife|husband|kids|children)\b/.test(normalized) ||
    /\b(?:who did you vote for|are you into men|are you into women|you gay|u gay)\b/.test(normalized)
  ) {
    return 'personalBoundary';
  }

  if (/\b(who am i|what'?s my name|what is my name|do you know me|which user am i|what account am i|what profile am i|which profile am i|who is this|who am i logged in as)\b/.test(normalized)) {
    return 'identity';
  }

  if (/\b(who are you|what are you|are you (?:ai|real|a bot)|your name|what should i call you)\b/.test(normalized)) {
    return 'assistantIdentity';
  }

  if (/\b(what do you know|what do you remember|what can you see|what context do you have|what did i tell you|what have i told you|what is my draft|summarize what you know)\b/.test(normalized)) {
    return 'context';
  }

  if (/\b(privacy|private|save my chat|saving this|training|train on|do you store|stored|my data|analytics)\b/.test(normalized)) {
    return 'privacy';
  }

  if (/\b(where am i|what is my location|what'?s my location|current location|my location)\b/.test(normalized)) {
    return 'selfLocation';
  }

  if (topic === 'general' && /\b(where is|where's|where are|where can i find|where do i find|locate|how do i get to|directions to)\b/.test(normalized)) {
    return 'realWorldLocation';
  }

  if (/^(what can you do|what do you do|how can you help|help|help me|commands|options)$/.test(normalized)) {
    return 'capability';
  }

  if (wordCount <= 5 && /^(yo|hey|hi|hello|sup|wsp|wassup|what's up|whats up|what up|good morning|good afternoon|good evening|gm|you there|scope|scope ai)$/.test(normalized)) {
    return 'greeting';
  }

  if (wordCount <= 7 && /^(how are you|how you doing|how's it going|hows it going|wyd|what are you doing|you good|how are things)$/.test(normalized)) {
    return 'smallTalk';
  }

  if (wordCount <= 6 && /^(thanks|thank you|thx|ty|appreciate it|cool thanks|nice thanks|thank u|preciate it)$/.test(normalized)) {
    return 'thanks';
  }

  if (wordCount <= 6 && /^(ok|okay|cool|bet|got it|sounds good|nice|alright|all right|word|facts|true|lol|lmao|haha)$/.test(normalized)) {
    return 'acknowledgement';
  }

  if (wordCount <= 5 && /^(bye|goodbye|see ya|see you|later|gn|good night|im done|i'm done)$/.test(normalized)) {
    return 'farewell';
  }

  if (wordCount <= 18 && /\b(sucks?|bad|wrong|confusing|lost|annoying|hate|wtf|bruh|bro|dumb|stupid|broken|messed up)\b/.test(normalized)) {
    return 'frustration';
  }

  if (/\b(medical advice|diagnose|prescription|legal advice|lawsuit|eviction|arrested|tax advice|invest|investment|stock|crypto|bet on|gambling)\b/.test(normalized) && !isScopeDomainQuestion(normalized)) {
    return 'highStakesOffTopic';
  }

  if (isOffTopicGeneralQuestion(value, normalized, topic)) {
    return 'offTopic';
  }

  if (topic === 'general' && wordCount <= 3) {
    return 'clarify';
  }

  return null;
}

function countRecentTopicMentions(recentChat: string, topic: TravelerRequestTopic): number {
  if (!recentChat || topic === 'general') {
    return 0;
  }

  return readRecentChatRoleLines(recentChat, 'User')
    .filter((line) => REQUEST_TOPIC_PATTERNS[topic].test(line))
    .length;
}

function countRecentExactUserRequests(recentChat: string, travelerRequest: string): number {
  const normalizedRequest = normalizeConversationText(travelerRequest);
  if (!normalizedRequest) {
    return 0;
  }

  return readRecentChatRoleLines(recentChat, 'User')
    .filter((line) => normalizeConversationText(line) === normalizedRequest)
    .length;
}

function countRecentConversationalIntentMentions(recentChat: string, intent: ConversationalIntent | null): number {
  if (!intent) {
    return 0;
  }

  return readRecentChatRoleLines(recentChat, 'User')
    .filter((line) => {
      const topic = classifyTravelerRequest(line);
      return classifyConversationalIntent(line, topic) === intent;
    })
    .length;
}

function countRecentMatchingAssistantAnswers(recentChat: string, answer: string): number {
  const normalizedAnswer = normalizeConversationText(answer);
  if (!normalizedAnswer) {
    return 0;
  }

  return readRecentChatRoleLines(recentChat, 'Scope AI')
    .filter((line) => normalizeConversationText(line) === normalizedAnswer)
    .length;
}

function buildRepeatShiftLine(travelerRequest: string, repeatCount: number): string {
  const requestLabel = travelerRequest.trim()
    ? `"${travelerRequest.trim().replace(/\s+/g, ' ')}"`
    : 'that same message';

  if (/^(yo|hey|hi|hello|sup|wsp|wassup|what'?s up|whats up|gm|scope|scope ai)$/i.test(travelerRequest.trim())) {
    return `Fresh angle ${repeatCount + 1}: I will not echo the same greeting back; tell me the route, app, timing, budget, or stop detail you want to hit next.`;
  }

  if (/^(thanks|thank you|thx|ty|appreciate it|thank u|preciate it)$/i.test(travelerRequest.trim())) {
    return `Fresh angle ${repeatCount + 1}: Still got you; send the next trip detail when you want me to move from thanks into action.`;
  }

  return `Fresh angle ${repeatCount + 1}: I will not repeat the same wording for ${requestLabel}; point me at the route, app, timing, budget, or stop detail and I will take it from there.`;
}

function selectFreshResponse(
  variants: string[],
  recentChat: string,
  repeatCount: number,
  travelerRequest: string,
): string {
  const usableVariants = variants.filter((variant) => variant.trim());
  if (!usableVariants.length) {
    return buildRepeatShiftLine(travelerRequest, repeatCount);
  }

  const recentAssistantAnswers = new Set(
    readRecentChatRoleLines(recentChat, 'Scope AI')
      .map(normalizeConversationText)
      .filter(Boolean),
  );
  const startIndex = repeatCount > 0 ? repeatCount % usableVariants.length : 0;

  if (repeatCount >= usableVariants.length) {
    return `${usableVariants[startIndex]}\n\n${buildRepeatShiftLine(travelerRequest, repeatCount)}`;
  }

  for (let offset = 0; offset < usableVariants.length; offset += 1) {
    const candidate = usableVariants[(startIndex + offset) % usableVariants.length];
    if (!recentAssistantAnswers.has(normalizeConversationText(candidate))) {
      return candidate;
    }
  }

  return `${usableVariants[startIndex]}\n\n${buildRepeatShiftLine(travelerRequest, repeatCount)}`;
}

function ensureFreshFinalAnswer(
  answer: string,
  recentChat: string,
  travelerRequest: string,
  repeatCount: number,
): string {
  const matchingAnswerCount = countRecentMatchingAssistantAnswers(recentChat, answer);
  if (matchingAnswerCount === 0) {
    return answer;
  }

  return `${answer}\n\n${buildRepeatShiftLine(travelerRequest, repeatCount + matchingAnswerCount)}`;
}

function shouldUseLocalFallback(error: unknown): boolean {
  if (!AGENT_LOCAL_FALLBACK_ENABLED) {
    return false;
  }

  if (!isApiClientError(error)) {
    return false;
  }

  return (
    error.isNetworkError ||
    error.status === undefined ||
    error.status === 401 ||
    error.status === 403 ||
    error.status === 404 ||
    error.status >= 500
  );
}

function isItineraryBuildRequest(value: string): boolean {
  return (
    /\b(build|generate|make|create)\b.*\b(itinerary|plan|route|first draft|weekend)\b/i.test(value) ||
    /\b(balanced first draft|first itinerary|starter itinerary)\b/i.test(value)
  );
}

function shouldReturnConciseItinerary(value: string, topic: TravelerRequestTopic): boolean {
  if (!isItineraryBuildRequest(value)) {
    return false;
  }

  if (topic !== 'weekend') {
    return true;
  }

  return /\b(itinerary|plan|route|draft)\b/i.test(value);
}

function parsePromptDurationDays(prompt: string, dates: string): number | null {
  const durationLine = readPromptLine(prompt, 'Trip duration');
  const durationMatch = durationLine.match(/\b(\d+)\s+day/i);

  if (durationMatch?.[1]) {
    const parsed = Number(durationMatch[1]);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }

  const travelerRequest = readTravelerRequest(prompt);
  if (/\bweekend\b/i.test(travelerRequest)) {
    return 2;
  }

  const requestDurationMatch = travelerRequest.match(/\b(\d{1,2})\s*(?:day|days|d)\b/i);
  if (requestDurationMatch?.[1]) {
    const parsed = Number(requestDurationMatch[1]);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }

  const dateMatch = dates.match(/(\d{4}-\d{2}-\d{2})\s+to\s+(\d{4}-\d{2}-\d{2})/i);
  if (!dateMatch?.[1] || !dateMatch[2]) {
    return null;
  }

  const start = new Date(`${dateMatch[1]}T00:00:00`);
  const end = new Date(`${dateMatch[2]}T00:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) {
    return null;
  }

  return Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1;
}

function hasTravelPartyBrief(prompt: string): boolean {
  const travelers = readPromptLine(prompt, 'Travelers');
  const travelParty = readPromptLine(prompt, 'Travel party');
  const travelerRequest = readTravelerRequest(prompt);
  const travelerCount = Number(travelers);

  return (
    (Number.isFinite(travelerCount) && travelerCount > 0) ||
    /\b(solo|alone|couple|pair|partner|group|family|kids?|children|friends?|travelers?|people)\b/i.test(travelParty) ||
    /\b(solo|alone|couple|pair|partner|group|family|kids?|children|friends?|travelers?|people)\b/i.test(travelerRequest)
  );
}

function buildMissingItineraryBriefAnswer(questions: string[]): string {
  return `I can build that. ${questions[0] ?? 'What kind of trip should this feel like?'}`;
}

function inferInterestsFromText(value: string): string {
  const normalized = value.toLowerCase();
  const interests: string[] = [];
  const add = (interest: string, pattern: RegExp) => {
    if (pattern.test(normalized) && !interests.includes(interest)) {
      interests.push(interest);
    }
  };

  add('food', /\b(food|restaurants?|coffee|cafes?|lunch|dinner|breakfast|eat|drink)\b/);
  add('culture', /\b(culture|museums?|art|history|historic)\b/);
  add('nature', /\b(nature|parks?|trails?|hikes?|outdoors?)\b/);
  add('scenic', /\b(scenic|views?|overlooks?|photo)\b/);
  add('adventure', /\b(adventure|active|activities|zipline|rafting|climb)\b/);
  add('nightlife', /\b(nightlife|bars?|clubs?|live music)\b/);
  add('shopping', /\b(shopping|markets?|malls?|boutiques?)\b/);
  add('entertainment', /\b(entertainment|amusement|theme\s*parks?|six\s*flags|bowling|arcades?|movies?|cinema|concert|zoo|aquarium|stadium|arena|escape\s*room|mini\s*golf|laser\s*tag)\b/);

  if (/\b(?:balanced\s+(?:vibes?|interests?|mix)|mix|variety)\b/.test(normalized) && !interests.length) {
    interests.push('food', 'culture', 'scenic');
  }

  return interests.join(', ');
}

function inferPaceFromText(value: string): string {
  if (/\b(relaxed|slow|chill|easy)\b/i.test(value)) {
    return 'relaxed';
  }

  if (/\b(packed|busy|full|fast)\b/i.test(value)) {
    return 'packed';
  }

  if (/\b(balanced|moderate|standard|normal)\b/i.test(value)) {
    return 'balanced';
  }

  return '';
}

function getMissingItineraryBriefQuestions(
  prompt: string,
  start: string,
  end: string,
  dates: string,
  pace: string,
  rawInterests: string,
): string[] {
  const questions: string[] = [];
  const durationDays = parsePromptDurationDays(prompt, dates);

  if (!start) {
    questions.push('What destination(s) are you visiting? Give me the start and finish, or the city/region for a one-place trip.');
  }

  if (!durationDays || durationDays <= 1) {
    questions.push('How many days is the trip?');
  }

  if (!rawInterests.trim()) {
    questions.push('What are your interests: food, nightlife, nature, culture, shopping, entertainment, adventure, or something else?');
  }

  if (!pace.trim()) {
    questions.push('Do you want the pace packed, balanced, or relaxed?');
  }

  if (!hasTravelPartyBrief(prompt)) {
    questions.push('Who are you traveling with: solo, couple, group, or family?');
  }

  return questions;
}

const PENDING_ITINERARY_BRIEF_PATTERN = /\b(how many days|what kind of trip|what are your interests|what pace|who is coming|who are you traveling|what destination)\b/i;
const CANCELED_ITINERARY_BRIEF_PATTERN = /\b(stopped that itinerary build|cancel(?:led|ed)?(?: this| the)? itinerary build|ask me to build again when the route brief is ready)\b/i;
const USER_CANCEL_PATTERN = /^(?:cancel|never mind|nevermind|start over|stop)(?:\s+(?:this|the|that)?\s*(?:itinerary|build|plan|request))?[.!?]*$/i;

function getLatestPendingItineraryBriefLine(recentChat: string): string {
  const lines = readRecentChatLines(recentChat);

  for (let index = lines.length - 1; index >= 0; index -= 1) {
    const line = lines[index];
    if (!line) {
      continue;
    }

    if (line.role === 'Scope AI' && CANCELED_ITINERARY_BRIEF_PATTERN.test(line.content)) {
      return '';
    }

    if (line.role === 'User' && USER_CANCEL_PATTERN.test(line.content)) {
      return '';
    }

    if (line.role === 'Scope AI' && PENDING_ITINERARY_BRIEF_PATTERN.test(line.content)) {
      return line.content;
    }
  }

  return '';
}

function recentChatHasPendingItineraryBrief(recentChat: string): boolean {
  return Boolean(getLatestPendingItineraryBriefLine(recentChat));
}

function promptHasPendingItineraryBrief(prompt: string, recentChat: string): boolean {
  if (CANCELED_ITINERARY_BRIEF_PATTERN.test(recentChat) || USER_CANCEL_PATTERN.test(readRecentChatRoleLines(recentChat, 'User').at(-1) ?? '')) {
    return false;
  }

  return (
    recentChatHasPendingItineraryBrief(recentChat) ||
    /\bScope AI:\s*.*(?:how many days|what kind of trip|what are your interests|what pace|who is coming|who are you traveling|what destination)/is.test(prompt)
  );
}

type PendingBriefQuestionKey = 'destination' | 'duration' | 'interests' | 'pace' | 'travelParty';

interface PendingBriefQuestion {
  key: PendingBriefQuestionKey;
  text: string;
}

function getPendingBriefQuestionKey(value: string): PendingBriefQuestionKey | null {
  if (/\bhow many days\b/i.test(value)) {
    return 'duration';
  }

  if (/\b(what kind of trip|what are your interests|interests:)\b/i.test(value)) {
    return 'interests';
  }

  if (/\b(what pace|do you want the pace|packed, balanced, or relaxed)\b/i.test(value)) {
    return 'pace';
  }

  if (/\b(who is coming|who are you traveling|who are you travelling|solo, couple, group, or family)\b/i.test(value)) {
    return 'travelParty';
  }

  if (/\bwhat destination\b/i.test(value)) {
    return 'destination';
  }

  return null;
}

function normalizePendingBriefQuestion(key: PendingBriefQuestionKey, fallbackText: string): PendingBriefQuestion {
  if (key === 'duration') {
    return { key, text: 'How many days should I plan for?' };
  }

  if (key === 'interests') {
    return { key, text: 'What kind of trip should this feel like: food, culture, nature, adventure, nightlife, shopping, entertainment, or balanced?' };
  }

  if (key === 'pace') {
    return { key, text: 'What pace should I use: relaxed, balanced, or packed?' };
  }

  if (key === 'travelParty') {
    return { key, text: 'Who is coming with you: solo, a couple, a group, or family?' };
  }

  return { key, text: fallbackText || 'What destination should I use for this trip?' };
}

function getPendingItineraryBriefQuestion(prompt: string, recentChat: string): PendingBriefQuestion | null {
  const latestPendingLine = getLatestPendingItineraryBriefLine(recentChat);
  if (latestPendingLine) {
    const key = getPendingBriefQuestionKey(latestPendingLine);
    if (key) {
      return normalizePendingBriefQuestion(key, latestPendingLine);
    }
  }

  if (CANCELED_ITINERARY_BRIEF_PATTERN.test(recentChat) || USER_CANCEL_PATTERN.test(readRecentChatRoleLines(recentChat, 'User').at(-1) ?? '')) {
    return null;
  }

  const promptMatch = prompt.match(/\bScope AI:\s*([^\n]*(?:how many days|what kind of trip|what are your interests|what pace|who is coming|who are you traveling|what destination)[^\n]*)/i);
  const promptQuestion = promptMatch?.[1]?.trim() ?? '';
  const promptQuestionKey = getPendingBriefQuestionKey(promptQuestion);
  return promptQuestionKey ? normalizePendingBriefQuestion(promptQuestionKey, promptQuestion) : null;
}

function doesReplyAnswerPendingBriefQuestion(value: string, question: PendingBriefQuestion): boolean {
  const normalized = normalizeConversationText(value);
  if (!normalized) {
    return false;
  }

  if (question.key === 'duration') {
    return /\b(?:weekend|one day|two days|three days|four days|five days|six days|seven days|\d{1,2}\s*(?:day|days|d))\b/i.test(normalized) ||
      /^(?:1|2|3|4|5|6|7|8|9|10)$/.test(normalized);
  }

  if (question.key === 'interests') {
    return /\b(food|restaurants?|coffee|culture|museums?|art|history|nature|parks?|trails?|adventure|nightlife|bars?|shopping|entertainment|amusement|theme\s*parks?|six\s*flags|bowling|arcades?|movies?|cinema|scenic|views?|balanced|mix|variety)\b/i.test(normalized);
  }

  if (question.key === 'pace') {
    return /\b(relaxed|slow|chill|easy|balanced|moderate|normal|packed|busy|full|fast)\b/i.test(normalized);
  }

  if (question.key === 'travelParty') {
    return /\b(solo|alone|couple|pair|partner|family|kids?|children|group|friends?|travelers?|people|person)\b/i.test(normalized) ||
      /^(?:1|2|3|4|5|6|7|8|9|10)$/.test(normalized);
  }

  return value.trim().length > 2;
}

function buildPendingBriefReminderAnswer(question: PendingBriefQuestion, travelerRequest: string): string {
  const replySummary = /\b(budget|inside|under|cap|\$|cost|spend|price|cheap|expensive)\b/i.test(travelerRequest)
    ? 'Got the budget guardrail.'
    : 'I caught that.';

  return `${replySummary} I still need this before I build the itinerary: ${question.text}`;
}

function getNextMissingBriefQuestionAfterAnswer(
  prompt: string,
  start: string,
  end: string,
  dates: string,
  pace: string,
  rawInterests: string,
  answeredKey: PendingBriefQuestionKey,
): string | null {
  return getMissingItineraryBriefQuestions(prompt, start, end, dates, pace, rawInterests)
    .find((question) => getPendingBriefQuestionKey(question) !== answeredKey) ?? null;
}

function buildSmartDefaultItineraryAnswer(route: string, budget: string, pace: string): string {
  return buildStructuredAnswer(`I will treat that as "surprise me" and move forward with a balanced weekend plan for ${route}.`, [
    {
      title: 'Smart defaults',
      lines: [
        'Length: 2 days, since you were not sure.',
        'Interests: food, culture, and key sights so the plan does not overfit one vibe.',
        `Pace: ${pace || 'balanced'}, with enough breathing room to keep it usable.`,
        `Budget guardrail: ${budget}.`,
      ],
    },
    {
      title: 'Day 1',
      lines: [
        'Morning: start with the strongest landmark or scenic anchor near the route start.',
        'Afternoon: add a local lunch stop, then one culture or history stop that fits the drive direction.',
        'Evening: land near the overnight area with an easy dinner instead of a late detour.',
      ],
    },
    {
      title: 'Day 2',
      lines: [
        'Morning: use the first stop for a must-see or photo-friendly place before crowds build.',
        'Afternoon: keep the drive practical and add one hidden-gem stop close to the route.',
        'Evening: finish near the destination with dinner or a relaxed walkable stop.',
      ],
    },
  ]);
}

function parsePlannerStopNames(stops: string): string[] {
  return stops
    .split('\n')
    .map((stop) => stop.replace(/^\d+\.\s*/, '').replace(/\s+\([^)]*\)\s*$/g, '').trim())
    .filter(Boolean)
    .slice(0, 12);
}

function getTravelersLabel(prompt: string): string {
  const travelParty = readPromptLine(prompt, 'Travel party');
  if (travelParty) {
    return travelParty;
  }

  const travelers = Number(readPromptLine(prompt, 'Travelers'));
  if (Number.isFinite(travelers) && travelers > 0) {
    return travelers === 1 ? 'solo traveler' : `${travelers} travelers`;
  }

  const request = readTravelerRequest(prompt);
  if (/\b(family|kids?|children)\b/i.test(request)) {
    return 'family';
  }
  if (/\b(couple|pair|partner)\b/i.test(request)) {
    return 'couple';
  }
  if (/\b(solo|alone)\b/i.test(request)) {
    return 'solo traveler';
  }
  if (/\b(group|friends?)\b/i.test(request)) {
    return 'group';
  }

  return 'travel party not locked';
}

function getConcisePlanDayCount(prompt: string, dates: string): number {
  const parsed = parsePromptDurationDays(prompt, dates);
  return parsed && parsed > 0 ? Math.min(parsed, 14) : 2;
}

function getPaceStopTarget(pace: string): string {
  if (/packed|busy|fast|full/i.test(pace)) {
    return 'up to 3 meaningful stops per full day, with drive time checked before adding more';
  }

  if (/relaxed|slow|chill|easy/i.test(pace)) {
    return '1 main anchor plus 1 flexible backup per day';
  }

  return '2 main anchors per full day, with one practical break folded in';
}

function buildInterestAnchor(rawInterests: string, dayNumber: number): string {
  const normalized = rawInterests.toLowerCase();
  const anchors: string[] = [];

  if (/\b(entertainment|amusement|theme\s*parks?|six\s*flags|bowling|arcades?|movies?|cinema|concert|zoo|aquarium|stadium|arena|escape\s*room|mini\s*golf|laser\s*tag)\b/.test(normalized)) {
    anchors.push('one verified entertainment anchor such as bowling, an arcade, a theater, or a theme park');
  }

  if (/\b(food|restaurant|coffee|cafe|lunch|dinner|breakfast)\b/.test(normalized)) {
    anchors.push('one food stop that also works as the real break');
  }

  if (/\b(culture|museum|art|history|historic)\b/.test(normalized)) {
    anchors.push('one culture or history stop with enough time to actually enjoy it');
  }

  if (/\b(nature|scenic|view|park|trail|hike|outdoor)\b/.test(normalized)) {
    anchors.push('one scenic or outdoor stop close to the route');
  }

  if (/\b(shopping|market|mall|boutique)\b/.test(normalized)) {
    anchors.push('one shopping district or market stop with easy parking');
  }

  if (/\b(nightlife|bar|club|music)\b/.test(normalized)) {
    anchors.push('one nightlife option only after arrival timing is comfortable');
  }

  if (/\b(adventure|activity|activities)\b/.test(normalized)) {
    anchors.push('one active stop that does not overload the drive day');
  }

  if (!anchors.length) {
    anchors.push('one good-fit stop close to the route');
  }

  return anchors[(dayNumber - 1) % anchors.length];
}

function buildConciseItineraryAnswer(
  prompt: string,
  route: string,
  dates: string,
  budget: string,
  pace: string,
  rawInterests: string,
  stops: string,
): string {
  const dayCount = getConcisePlanDayCount(prompt, dates);
  const visibleDayCount = Math.min(dayCount, 5);
  const stopNames = parsePlannerStopNames(stops);
  const interestPhrase = formatInterestPhrase(rawInterests || 'the selected trip vibes');
  const travelers = getTravelersLabel(prompt);
  const daySections: Array<{ title: string; lines: string[] }> = [];

  for (let dayNumber = 1; dayNumber <= visibleDayCount; dayNumber += 1) {
    const existingStop = stopNames[dayNumber - 1];
    const isFirstDay = dayNumber === 1;
    const isLastVisibleDay = dayNumber === visibleDayCount;
    const travelShape = isFirstDay
      ? 'Start with the cleanest travel leg, then add only one optional stop after timing is known.'
      : isLastVisibleDay
        ? 'Protect the arrival window and keep the final leg easy to finish.'
        : 'Use this as the main experience day, not another overloaded travel day.';

    daySections.push({
      title: `Day ${dayNumber}`,
      lines: [
        existingStop
          ? `Anchor: ${existingStop}.`
          : `Anchor: ${buildInterestAnchor(rawInterests, dayNumber)}.`,
        travelShape,
        'Fold food, restrooms, fuel, or charging into the same area whenever possible.',
      ],
    });
  }

  if (dayCount > visibleDayCount) {
    daySections.push({
      title: 'Later days',
      lines: [
        `Repeat the same pattern for days ${visibleDayCount + 1}-${dayCount}: one main anchor, one practical break, and one flexible backup.`,
      ],
    });
  }

  return buildStructuredAnswer(`I can turn ${route} into a concise ${dayCount}-day plan from the context you gave me.`, [
    {
      title: 'Plan guardrails',
      lines: [
        `Dates: ${dates}.`,
        `Pace: ${pace}; target ${getPaceStopTarget(pace)}.`,
        `Budget: ${budget}; treat this as a cap, not a goal to spend.`,
        `Vibes: ${interestPhrase}.`,
        `Travelers: ${travelers}.`,
      ],
    },
    ...daySections,
    {
      title: 'Verify before commit',
      lines: [
        'Use live route timing before locking optional stops.',
        'Verify hours, tickets, reservations, parking, and weather for exact venues.',
        stopNames.length
          ? 'Use the stops already on the canvas first; replace weak ones instead of stacking more.'
          : 'Search live places before adding exact stop names, so Scope does not fake venues.',
      ],
    },
    {
      title: 'Next action',
      lines: [
        'Build the live itinerary from this shape, then tighten any day that has too much drive time, cost, or backtracking.',
      ],
    },
  ]);
}

function buildStructuredAnswer(
  lead: string,
  sections: Array<{ title: string; lines: string[] }>,
): string {
  const bufferedLead = lead.replace(/^yes\s*(?:[-,:]\s*)?/i, '').trim();

  return [
    `For you: ${bufferedLead}`,
    ...sections.flatMap((section) => [
      `${section.title}:`,
      ...section.lines.map((line) => `- ${line}`),
    ]),
  ].join('\n');
}

function buildConversationalAnswer(
  intent: ConversationalIntent,
  route: string,
  travelerRequest = '',
  recentChat = '',
  repeatCount = 0,
): string {
  const hasRoute = route !== 'your route';

  if (intent === 'greeting') {
    return selectFreshResponse(
      hasRoute
        ? [
            'Hey, I am here. Tell me what you want to check on this route and I will keep it clear.',
            `Still here with ${route}. What do you want me to look at first?`,
            'I am here with the route. Send the piece that feels off and I will answer it directly.',
            'Yep, I am awake on this one. Give me the route, app, timing, or budget piece.',
          ]
        : [
            'Hey, I am here. Send me the trip idea, start and end, or whatever feels off, and I will help shape it.',
            'Still here. Give me a start, finish, vibe, or app question and I will jump in.',
            'I am here. Toss me the route idea or the thing that feels confusing and I will help shape it.',
            'Yep, I have you. Send the trip, map, budget, timing, or app-flow thing you want handled.',
          ],
      recentChat,
      repeatCount,
      travelerRequest,
    );
  }

  if (intent === 'smallTalk') {
    return selectFreshResponse([
      'I am here and ready. We can talk normally, or you can throw me the app, route, budget, stop, image, or timing thing you are trying to figure out.',
      'Doing fine and ready to help. Send the trip detail, app question, or messy route thought and I will sort it with you.',
      'I am good. Give me the route, place, budget, timing, image, or app-flow thing and I will keep it practical.',
      'Still with you. We can keep it casual, or you can hand me the exact trip problem to solve next.',
    ], recentChat, repeatCount, travelerRequest);
  }

  if (intent === 'thanks') {
    return selectFreshResponse(
      hasRoute
        ? [
            'Anytime. I am here when you want to tune the route, check timing, or sanity-check a stop.',
            'When you want the next pass, I can help tighten timing, stops, or budget.',
            'You got it. Send the next route detail and I will keep the answer focused.',
            'No problem. I can keep working the route whenever you want another angle.',
          ]
        : [
            'Anytime. When you are ready, give me a start, end, or trip mood and I will help from there.',
            'Drop the start, finish, or vibe whenever you want the plan shaped.',
            'You got it. Send the next trip detail and I will help turn it into something usable.',
            'No problem. I am here when you want to move from idea to route.',
          ],
      recentChat,
      repeatCount,
      travelerRequest,
    );
  }

  if (intent === 'acknowledgement') {
    return selectFreshResponse([
      'Got you. Send the next thing you want to figure out and I will keep the answer simple.',
      'Bet. Give me the next route, app, stop, or budget detail and I will stay direct.',
      'Understood. Tell me what you want to handle next and I will answer that piece.',
      'Cool, I am tracking. Send the next thing and I will keep it clean.',
    ], recentChat, repeatCount, travelerRequest);
  }

  if (intent === 'farewell') {
    return selectFreshResponse([
      'All good. I will be here when you want to keep working on the trip.',
      'Sounds good. Come back with the next route detail whenever you are ready.',
      'No rush. I will be here when you want to pick this back up.',
      'Got it. The draft can wait until you are ready to keep shaping it.',
    ], recentChat, repeatCount, travelerRequest);
  }

  if (intent === 'frustration') {
    return selectFreshResponse([
      'I hear you. Tell me the exact part that feels wrong: the route, budget, timing, stops, app flow, or the way I answered, and I will focus on that first.',
      'Fair. Point me at the annoying part: the app flow, route, timing, budget, stops, or my last answer, and I will fix that piece first.',
      'Got it. Give me the one thing that feels broken or confusing and I will stop being vague.',
      'I am with you. Name the exact screen, route step, or answer that missed, and I will tighten it from there.',
    ], recentChat, repeatCount, travelerRequest);
  }

  if (intent === 'identity') {
    return selectFreshResponse([
      'I cannot confidently tell who you are from this chat alone. I can see the trip draft context, but I do not have your profile name or account details in this local copilot response.',
      'I do not have enough profile context here to name you. I can use the visible draft and chat, but not private account details.',
      'From this local chat context, I can see the trip draft but not your account identity.',
      'I cannot verify your profile from this fallback response. Give me the name or trip context you want me to use.',
    ], recentChat, repeatCount, travelerRequest);
  }

  if (intent === 'assistantIdentity') {
    return selectFreshResponse([
      'I am Scope AI, the trip and app copilot inside Scope. I can help with the route, budget, timing, stops, images, and how to use this planner screen.',
      'I am Scope AI. Think of me as the planning copilot for routes, stops, budgets, timing, images, and app questions.',
      'I am the Scope trip copilot: route help, place ideas, timing checks, budget sanity checks, and planner-screen guidance.',
      'I am Scope AI inside the app, here to help turn messy trip ideas into usable routes and next steps.',
    ], recentChat, repeatCount, travelerRequest);
  }

  if (intent === 'context') {
    return selectFreshResponse(
      hasRoute
        ? [
            `I can see this route context: ${route}. I can also use the visible draft details like budget, pace, dates, interests, and recent chat.`,
            `I have ${route} plus the visible draft details: dates, budget, pace, interests, stops, and recent chat.`,
            `Right now I am anchored on ${route} and whatever is visible in this planner draft.`,
            `The context I can use is ${route}, the draft settings, committed stops, and the recent chat in this panel.`,
          ]
        : [
            'I can see the visible trip draft details like budget, pace, dates, interests, and recent chat, but I do not have a full route until start and end are added.',
            'I have the visible draft fields and recent chat, but no full route yet because the start and end are not both set.',
            'I can use your draft budget, pace, dates, interests, stops, and recent chat. Add endpoints when you want route-specific help.',
            'My context is this planner draft and chat. I do not have a complete route until both endpoints exist.',
          ],
      recentChat,
      repeatCount,
      travelerRequest,
    );
  }

  if (intent === 'privacy') {
    return selectFreshResponse([
      'I can answer from the visible draft and chat. Optional analytics controls whether Scope AI chats can help improve future trips, and I do not need private details to help with a route.',
      'You do not need to share private details for route help. I work from the visible draft, chat, and whatever trip info you choose to add.',
      'For this response, I am using the draft and chat context. Optional analytics is the switch for whether chats help improve future Scope AI behavior.',
      'Keep private stuff out if you want. Start, end, vibe, budget, and timing are enough for most planning help.',
    ], recentChat, repeatCount, travelerRequest);
  }

  if (intent === 'selfLocation') {
    return selectFreshResponse([
      'I cannot see your current device location from this chat. Add a start point or tell me your city, and I can use that as the route context.',
      'I do not have live device location in this fallback. Give me your city, start point, or map pin and I will use that.',
      'I cannot infer where you are right now from the chat alone. Add a route start or type the area you want me to use.',
      'I need an explicit start point or city before I can anchor the route to your location.',
    ], recentChat, repeatCount, travelerRequest);
  }

  if (intent === 'realWorldLocation') {
    const subject = travelerRequest
      .replace(/\b(where is|where's|where are|where can i find|where do i find|locate|how do i get to|directions to)\b/i, '')
      .replace(/[?.!]+$/g, '')
      .trim();
    return selectFreshResponse(
      subject
        ? [
            `If you mean "${subject}" as a real-world place, I can help connect it to your trip, but this local fallback does not have live place lookup. Add it as a start, end, or stop, or give me a city/region to anchor it.`,
            `For "${subject}", I need a city, region, or route anchor before I can place it usefully in the trip.`,
            `I can work "${subject}" into the plan, but I need you to add it as a route point or give me the area it belongs to.`,
            `If "${subject}" is a place, add a location anchor and I will help decide whether it fits the route.`,
          ]
        : [
            'If you mean a real-world place, give me the place name plus a city or region. If you mean something in the Scope app, name the button or section.',
            'I need one more detail: is this a real-world place or an Scope app control?',
            'Give me the place plus a city or region, or tell me the app screen you mean.',
            'For location questions, I need either a map/place anchor or the specific Scope UI area.',
          ],
      recentChat,
      repeatCount,
      travelerRequest,
    );
  }

  if (intent === 'personalBoundary') {
    return selectFreshResponse([
      'I do not have a sexual orientation, gender, race, religion, politics, or personal relationships. I am Scope AI, and I will keep it professional: trips, spots, routes, budgets, timing, images, and app help.',
      'That does not apply to me because I am an AI copilot, not a person. I can still help directly with Scope planning, places, routes, costs, timing, and app questions.',
      'I do not have a human identity or private life. My role is to stay useful and professional inside Scope: route help, trip decisions, app support, and place planning.',
      'I am Scope AI, so personal identity labels and relationships do not apply to me. Give me a trip, spot, map, budget, timing, or app-flow question and I will answer that cleanly.',
    ], recentChat, repeatCount, travelerRequest);
  }

  if (intent === 'romanticBoundary') {
    return selectFreshResponse([
      'I keep things professional. I cannot be romantic or sexual, but I can help with Scope trips, date-night spots, routes, budgets, timing, and app questions.',
      'I am here as an Scope planning copilot, not for romantic or sexual chat. If you want a real plan, I can help pick places, timing, budget, or the next route step.',
      'I cannot take that in a romantic or explicit direction. I can help keep the conversation useful: trips, spots, route ideas, food stops, photos, and app help.',
      'I will keep the boundary clear and the answer practical. Tell me what you want to plan in Scope and I will help with that.',
    ], recentChat, repeatCount, travelerRequest);
  }

  if (intent === 'abuseBoundary') {
    return selectFreshResponse([
      'I will keep it respectful and useful. Tell me what needs fixing: the route, the app flow, my last answer, budget, timing, stops, or search.',
      'I hear the frustration. Point me at the exact thing that is wrong and I will focus on solving that instead of arguing.',
      'I can help, but I am going to keep the tone steady. Name the broken part: app, route, budget, timing, notifications, search, or the AI answer.',
      'Let us turn that into a fix. What should I correct first: the planner flow, route logic, answer quality, or app behavior?',
    ], recentChat, repeatCount, travelerRequest);
  }

  if (intent === 'crisis') {
    return selectFreshResponse([
      'I am sorry you are dealing with that. If you might hurt yourself or someone else, call emergency services now. In the U.S. or Canada, call or text 988 for immediate crisis support. If you can, move near another person and tell them you need help right now.',
      'This sounds urgent. Please call emergency services if you are in immediate danger. In the U.S. or Canada, 988 is the Suicide and Crisis Lifeline by call or text. Stay with someone you trust if you can.',
      'I want you safe first. If there is any immediate risk, call local emergency services now. In the U.S. or Canada, call or text 988, and reach out to someone nearby who can stay with you.',
      'Please pause Scope and get real-time help. If you are in immediate danger, call emergency services. In the U.S. or Canada, call or text 988 and tell someone close to you what is happening.',
    ], recentChat, repeatCount, travelerRequest);
  }

  if (intent === 'highStakesOffTopic') {
    return selectFreshResponse([
      'That is outside what Scope AI should advise on. For medical, legal, tax, investment, or safety-critical decisions, use a qualified professional or current official source. I can still help with the trip or app context around it.',
      'I should not guess on that kind of high-stakes topic. Use a professional or official current source for the decision itself, and I can help organize the Scope route, notes, budget, or timing around it.',
      'I can keep the Scope side organized, but I am not the right place for medical, legal, financial, or emergency advice. Bring me the trip/app part and I will handle that cleanly.',
      'That needs a more reliable source than this local trip copilot. I can help with places, route timing, app flow, and planning logistics once the high-stakes answer comes from the right source.',
    ], recentChat, repeatCount, travelerRequest);
  }

  if (intent === 'offTopic') {
    return selectFreshResponse([
      'That is outside Scope trip and app help, so I will keep it professional. I am best for routes, spots, budgets, timing, photos, search, notifications, and how to use Scope.',
      'I can answer best when the question connects to Scope, a trip, a place, or the app. For general off-topic questions, use a current trusted source; for planning, give me the route or decision.',
      'That is not really an Scope planning question. I can still help fast if you frame it around a trip, map, spot, budget, timing, image, or app-flow issue.',
      'I am going to stay in my lane here: Scope trips, routes, places, app help, search, notifications, images, and planning decisions. Ask that angle and I will answer directly.',
    ], recentChat, repeatCount, travelerRequest);
  }

  if (intent === 'clarify') {
    return selectFreshResponse([
      'I am with you. Say that a little more specifically and I will answer the exact thing instead of guessing.',
      'Give me a little more to grab onto: route, app, stop, timing, budget, or place.',
      'I need one more word of direction before I guess wrong. What part are we talking about?',
      'Say what you want checked and I will keep the answer tight.',
    ], recentChat, repeatCount, travelerRequest);
  }

  return selectFreshResponse([
    'I can help like a trip copilot: app questions, route choices, timing, budget, stops, images, and next steps. Ask naturally and I will answer the piece you care about.',
    'I can help with the app, route, timing, budget, stops, images, or the next decision. Ask it plainly.',
    'Use me for trip planning or app help: routes, places, budget, timing, safety, groups, and images.',
    'Ask naturally. I will map it to the planner, the route, or the app flow and answer that part.',
  ], recentChat, repeatCount, travelerRequest);
}

function buildRouteSections(route: string): Array<{ title: string; lines: string[] }> {
  if (!route || route === 'your route') {
    return [];
  }

  return [{
    title: 'Your route',
    lines: [route],
  }];
}

function buildMissingRouteLine(route: string): string {
  return route === 'your route'
    ? 'Because I do not have both endpoints yet, add your start and finish when you want this tightened to the actual drive.'
    : 'Use the route above as the anchor and avoid adding stops that pull you away from it.';
}

function formatInterestPhrase(interests: string): string {
  if (!interests || interests === 'the selected trip vibes') {
    return 'good-fit';
  }

  return interests.replace(/,\s*([^,]+)$/, ' or $1');
}

function buildAppHelpAnswer(travelerRequest: string, route: string): string {
  const request = travelerRequest.toLowerCase();

  if (/\b(image|photo|picture|attach|upload)\b/i.test(request)) {
    return buildStructuredAnswer('Use the image button in the chat bar when you want Scope AI to consider a picture with your question.', [
      {
        title: 'How to use it',
        lines: [
          'Tap the image icon beside the chat input.',
          'Pick one or more images.',
          'Type what you want me to check about them, then press Ask.',
        ],
      },
    ]);
  }

  if (/\b(add start|start point|add end|end point|route canvas)\b/i.test(request)) {
    return buildStructuredAnswer('Use the route canvas first when you want the planner to build or change the actual route.', [
      {
        title: 'What to do',
        lines: [
          'Add a start point.',
          'Add an end point.',
          'Then ask me to build, tighten, or check the route.',
        ],
      },
      ...buildRouteSections(route),
    ]);
  }

  return buildStructuredAnswer('I can help with the app flow too, not just the trip plan.', [
    {
      title: 'Ask me about',
      lines: [
        'Where to click next.',
        'How to add route points, images, or stops.',
        'What a planner result means.',
        'Why a button or route state looks a certain way.',
      ],
    },
  ]);
}

function buildBudgetAnswer(route: string, budget: string, pace: string, dates: string, repeatCount = 0): string {
  const hasRoute = route !== 'your route';

  if (repeatCount > 0) {
    const repeatAnswers = [
      buildStructuredAnswer(`You are asking about the same budget again, so I would split ${budget} before choosing more stops.`, [
        {
          title: 'What I would protect first',
          lines: [
            'Fuel, charging, tolls, and parking come before anything optional.',
            `Keep food and rest supplies simple so your ${pace} pace does not turn expensive.`,
            `Leave a real buffer inside ${budget}; do not spend to the top just because it is there.`,
          ],
        },
        {
          title: 'Your stop rule',
          lines: [
            'Add free or low-cost stops first.',
            'If a stop costs real money, make it replace a weaker stop instead of stacking it on top.',
          ],
        },
      ]),
      buildStructuredAnswer('Use the budget as a pass/fail filter for each stop, not as a big number to fill.', [
        {
          title: 'Green lights for you',
          lines: [
            `Stops that solve fuel, food, restrooms, or one short ${pace} break.`,
            'Anything free, public, casual, or already close to the route.',
          ],
        },
        {
          title: 'Pause before adding',
          lines: [
            'Ticketed attractions, long parking windows, and detours that add a meal or overnight risk.',
            `If live drive time is high for ${dates}, protect the buffer first.`,
          ],
        },
      ]),
      buildStructuredAnswer('Your next budget move should remove uncertainty, not add another idea.', [
        {
          title: 'Check this next',
          lines: [
            'Estimate fuel or charging first.',
            'Pick the meal plan before paid stops.',
            'Keep one emergency buffer instead of spending to the top of the range.',
          ],
        },
        {
          title: 'Ask next',
          lines: ['Share the vehicle fuel type or expected MPG and I can turn the cap into a clearer spend range.'],
        },
      ]),
    ];

    return repeatAnswers[Math.min(repeatCount - 1, repeatAnswers.length - 1)];
  }

  return buildStructuredAnswer(
    hasRoute
      ? `I would keep your trip inside ${budget} by treating that range as your guardrail, not your goal.`
      : `With no route picked yet, I would use ${budget} as a guardrail and wait to spend decisions until the endpoints are clear.`,
    [
    ...buildRouteSections(route),
    {
      title: 'What I would do for you',
      lines: [
        `Plan around ${dates} with a ${pace} pace.`,
        'Put fuel, food, rest, parking, and tolls before optional stops.',
        'Use free or casual stops until the route timing feels easy.',
      ],
    },
    {
      title: 'Your next move',
      lines: [
        'Avoid paid attractions or long side quests unless they replace something weaker.',
        buildMissingRouteLine(route),
      ],
    },
  ]);
}

function buildTightenAnswer(route: string, pace: string, stops: string, repeatCount = 0): string {
  const currentStops = stops
    ? stops.split('\n').map((stop) => stop.replace(/^\d+\.\s*/, '').trim()).filter(Boolean)
    : ['No committed stops yet. Keep the first pass lean.'];

  if (repeatCount > 0) {
    return buildStructuredAnswer('I would tighten this by replacing weak ideas, not by adding more.', [
      {
        title: 'Keep only what helps you',
        lines: [
          `One stop that makes the ${pace} pace easier.`,
          'One stop that creates the best memory.',
          'One backup option that can be skipped without breaking the day.',
        ],
      },
      {
        title: 'Remove for now',
        lines: [
          'Anything that repeats the same purpose as another stop.',
          'Anything that adds time without solving food, rest, fuel, or the main trip vibe.',
        ],
      },
    ]);
  }

  return buildStructuredAnswer('I would make this feel cleaner by giving every stop one clear job.', [
    ...buildRouteSections(route),
    {
      title: 'What you already have',
      lines: currentStops,
    },
    {
      title: 'Keep for your version',
      lines: [
        `Stops that shorten the drive, feed/rest the group, or create one standout memory at a ${pace} pace.`,
        'One midpoint stop, then a clean final leg.',
      ],
    },
    {
      title: 'Cut without overthinking it',
      lines: ['Anything that adds backtracking without replacing a weaker stop.'],
    },
  ]);
}

function buildTimingAnswer(route: string, dates: string, pace: string, repeatCount = 0): string {
  const sameDay = /^(\d{4}-\d{2}-\d{2})\s+to\s+\1$/i.test(dates.trim());

  if (repeatCount > 0) {
    const repeatAnswers = [
      buildStructuredAnswer('Since you are asking timing again, I would judge the day by total wheel time.', [
        {
          title: 'Your decision rule',
          lines: [
            `At a ${pace} pace, skip optional stops if live drive time is over about 6 hours.`,
            'One practical midpoint is fine if it cuts fatigue without adding a second detour.',
          ],
        },
        {
          title: 'Check before you commit',
          lines: [
            'Departure window.',
            'Expected arrival window.',
            'Whether food, fuel, and restrooms can happen in the same stop.',
          ],
        },
      ]),
      buildStructuredAnswer('I would make the day have one job for you: arrive cleanly.', [
        {
          title: 'Your schedule shape',
          lines: [
            `For ${dates}, place food and fuel into the same break.`,
            'Keep the first leg longer, then make the final leg predictable.',
          ],
        },
        {
          title: 'Avoid for your comfort',
          lines: ['Late-day scenic stops, backtracking, or anything that makes arrival slide.'],
        },
      ]),
      buildStructuredAnswer('The useful next step for you is a departure plan, not another generic timing check.', [
        {
          title: 'Pick the version you want',
          lines: [
            'Leave early if you want one short stop.',
            'Leave midday only if this is pure travel.',
            'Set a latest-arrival time before adding anything optional.',
          ],
        },
        {
          title: 'Ask me next',
          lines: ['Share your preferred departure or arrival time and I can shape this into a cleaner day plan.'],
        },
      ]),
      buildStructuredAnswer('If you keep rechecking timing, the real risk is comfort, not the route itself.', [
        {
          title: 'Your comfort check',
          lines: [
            'Plan a real break every 2 to 3 hours if the drive is long.',
            'Use the midpoint for restrooms, food, and fuel together.',
          ],
        },
        {
          title: 'Your stop rule',
          lines: ['If a stop does not reduce fatigue or improve safety, skip it for this pass.'],
        },
      ]),
    ];

    return repeatAnswers[Math.min(repeatCount - 1, repeatAnswers.length - 1)];
  }

  return buildStructuredAnswer(
    sameDay
      ? `For ${dates}, I would protect your arrival time first and treat this like a clean travel day.`
      : `Your dates can work if each day has one main plan and one backup option.`,
    [
      ...buildRouteSections(route),
      {
        title: 'What that means for you',
        lines: [
          `Pace: ${pace}`,
          'Check live drive time before adding optional stops.',
        ],
      },
      {
        title: 'Your plan shape',
        lines: [
          'Do not stack optional stops on the longest driving day.',
          'Build around departure time, weather buffers, and one practical midpoint break.',
          sameDay
            ? 'If the drive is more than a few hours, keep it as travel only.'
            : 'If timing feels tight, move the scenic or food stop earlier and keep arrival light.',
        ],
      },
    ],
  );
}

function buildMidpointAnswer(route: string, interests: string, budget: string, repeatCount = 0): string {
  const interestPhrase = formatInterestPhrase(interests);

  if (repeatCount > 0) {
    return buildStructuredAnswer('I would choose your midpoint by what it does for you, not just by the name of the place.', [
      {
        title: 'What the midpoint should solve',
        lines: [
          `Pick a ${interestPhrase} stop only if it also handles food, restrooms, fuel, or a short walk.`,
          'If it only looks interesting, save it for a slower itinerary.',
        ],
      },
      {
        title: 'Keep it easy',
        lines: [`Prioritize free, public, or casual stops so the route stays inside ${budget}.`],
      },
    ]);
  }

  return buildStructuredAnswer('A midpoint is worth adding only if it makes your drive easier.', [
    ...buildRouteSections(route),
    {
      title: 'Best fit for you',
      lines: [`One ${interestPhrase} stop that also covers food, restrooms, fuel, or a short walk.`],
    },
    {
      title: 'Budget guardrail for you',
      lines: [`Stay inside ${budget} with a free viewpoint, casual food stop, public park, or quick town-center break.`],
    },
    {
      title: 'Skip this',
      lines: ['Any detour over about 20 minutes unless it becomes the main stop.'],
    },
  ]);
}

function buildWeekendAnswer(route: string, budget: string, pace: string, interests: string): string {
  const interestPhrase = formatInterestPhrase(interests);
  const hasRoute = route !== 'your route';

  return buildStructuredAnswer(
    hasRoute
      ? `I would keep this as a simple ${pace} weekend direction for you, not a packed itinerary.`
      : `With no endpoints picked yet, I would keep this as a simple ${pace} weekend direction and avoid pretending there is a full route.`,
    [
    ...buildRouteSections(route),
    {
      title: 'Your weekend shape',
      lines: [
        'First stretch: travel, settle in, and use one easy food or rest stop.',
        `Main outing: pick one ${interestPhrase} anchor instead of trying to fill the whole day.`,
        'Backup: keep one nearby flexible stop that you can skip without ruining the plan.',
      ],
    },
    {
      title: 'Keep it comfortable',
      lines: [
        `Keep ${budget} as your cap by choosing free, scenic, public, or casual stops first.`,
        buildMissingRouteLine(route),
      ],
    },
  ]);
}

function buildStartCityAnswer(start: string, end: string, budget: string, pace: string): string {
  if (start) {
    return buildStructuredAnswer(`I would test ${start} as your start by checking whether it keeps the first leg simple and affordable.`, [
      {
        title: 'How I would judge it',
        lines: [
          'Easy highway or airport access.',
          `Food, fuel, and parking that do not burn through ${budget} before the trip starts.`,
          `A first driving leg that still feels ${pace}, not rushed.`,
        ],
      },
      {
        title: 'Your next move',
        lines: [
          end
            ? `Compare ${start} against one nearby city that has an easier first leg toward ${end}.`
            : 'Add the finish city and I can tell you whether this start is actually strong.',
        ],
      },
    ]);
  }

  if (end) {
    return buildStructuredAnswer(`I would pick a start city that makes getting to ${end} easy, not just the biggest city on the map.`, [
      {
        title: 'What makes it strong for you',
        lines: [
          'It should be close to where the travelers already are meeting.',
          'It should have clean highway access toward the destination.',
          `It should keep early food, fuel, and parking predictable inside ${budget}.`,
          `It should set up the first leg at a ${pace} pace.`,
        ],
      },
      {
        title: 'Send me one detail',
        lines: ['Tell me where you are coming from or the region you want to launch from, and I will rank 2-3 start-city options.'],
      },
    ]);
  }

  return buildStructuredAnswer('I can help choose a strong start city, but I need one anchor so I do not make up a route.', [
    {
      title: 'What I would need from you',
      lines: [
        'Your home base, meetup region, or final destination.',
        'Whether you care most about cheapest, fastest, easiest meetup, or most scenic.',
      ],
    },
    {
      title: 'How I will pick it',
      lines: [
        'A strong start city should be easy to reach, easy to leave, and cheap enough that the trip does not start stressed.',
        `For a ${pace} trip, I would avoid starts that create a long first leg before the fun begins.`,
      ],
    },
  ]);
}

function buildFoodAnswer(route: string, budget: string, pace: string): string {
  return buildStructuredAnswer('For food, I would choose one reliable stop that also works as your break.', [
    ...buildRouteSections(route),
    {
      title: 'Best fit for you',
      lines: [
        `Pick food that is easy to park at, quick to order from, and calm enough for a ${pace} pace.`,
        'Use the same stop for restrooms, stretching, and refilling water.',
      ],
    },
    {
      title: 'Budget note',
      lines: [`Keep it casual unless this meal is the one paid highlight inside ${budget}.`],
    },
  ]);
}

function buildWeatherAnswer(route: string, dates: string, pace: string): string {
  return buildStructuredAnswer('I would keep your weather plan flexible until you check the live forecast.', [
    ...buildRouteSections(route),
    {
      title: 'For your dates',
      lines: [
        `Use ${dates} as the planning window, then recheck weather close to departure.`,
        `At a ${pace} pace, keep one indoor or low-exposure backup so the day does not fall apart.`,
      ],
    },
    {
      title: 'Your next move',
      lines: ['Tell me the main city or route segment you care about and I can help you decide what to move indoors.'],
    },
  ]);
}

function buildSafetyAnswer(route: string, pace: string): string {
  return buildStructuredAnswer('I would make this feel safe by planning around daylight, simple stops, and easy exits.', [
    ...buildRouteSections(route),
    {
      title: 'For you',
      lines: [
        'Avoid late arrivals if the route is unfamiliar.',
        `Choose stops that are obvious, well-reviewed, and easy to leave from at a ${pace} pace.`,
        'Keep fuel or charging above the stressful range before remote stretches.',
      ],
    },
    {
      title: 'Your next move',
      lines: ['Share the stop or area you are unsure about and I can help decide whether to keep, move, or skip it.'],
    },
  ]);
}

function buildGroupAnswer(route: string, budget: string, pace: string): string {
  return buildStructuredAnswer('For a group, I would make the plan easy to agree on and easy to change.', [
    ...buildRouteSections(route),
    {
      title: 'What helps your travelers',
      lines: [
        `Use a ${pace} pace with fewer stops and clearer breaks.`,
        'Pick stops with food, restrooms, parking, and enough room for everyone.',
        `Keep shared costs visible so the trip stays inside ${budget}.`,
      ],
    },
    {
      title: 'Your next move',
      lines: ['Choose the one thing the group cares about most: food, views, cost, or arrival time.'],
    },
  ]);
}

function buildImageAnswer(route: string, travelerRequest: string): string {
  return buildStructuredAnswer('I can use images as trip context when the vision-enabled agent is available.', [
    ...buildRouteSections(route),
    {
      title: 'How I would use it for you',
      lines: [
        'If the image shows a place, I would judge whether it fits the route, vibe, timing, and budget.',
        'If the image shows a receipt, menu, map, or sign, I would pull out the useful trip details.',
      ],
    },
    {
      title: 'If I cannot read it yet',
      lines: [`Tell me what matters in the image and I will answer the "${travelerRequest}" part from your notes.`],
    },
  ]);
}

function shouldAnswerNewIntentBeforePendingBrief(
  topic: TravelerRequestTopic,
  conversationalIntent: ConversationalIntent | null,
  travelerRequest: string,
  pendingQuestion: PendingBriefQuestion | null,
): boolean {
  if (!pendingQuestion) {
    return false;
  }

  if (isVagueBriefReply(travelerRequest) || doesReplyAnswerPendingBriefQuestion(travelerRequest, pendingQuestion)) {
    return false;
  }

  if (topic !== 'general') {
    return true;
  }

  return Boolean(
    conversationalIntent
    && conversationalIntent !== 'acknowledgement'
    && conversationalIntent !== 'clarify',
  );
}

function buildGeneralAnswer(
  route: string,
  travelerRequest: string,
  budget: string,
  pace: string,
  interests: string,
  recentChat = '',
  repeatCount = 0,
): string {
  const interestPhrase = formatInterestPhrase(interests);

  if (/\b(suggest|recommend|ideas?|what should)\b/i.test(travelerRequest)) {
    return selectFreshResponse([
      buildStructuredAnswer('I would keep your next step narrow enough that it actually helps you decide.', [
        ...buildRouteSections(route),
        {
          title: 'What I would add for you',
          lines: [`One ${interestPhrase} stop that sits close to the route and fits a ${pace} pace.`],
        },
        {
          title: 'Your guardrail',
          lines: [`Keep ${budget} as the cap, then avoid another stop unless it replaces a weaker one.`],
        },
        {
          title: 'Your next move',
          lines: ['Ask me to check timing, budget, stops, food, safety, weather, or group fit and I will answer that part directly.'],
        },
      ]),
      buildStructuredAnswer('Different angle: choose the constraint first, then I can suggest the right move.', [
        ...buildRouteSections(route),
        {
          title: 'Pick the filter',
          lines: [
            `Cheapest fit inside ${budget}.`,
            `Easiest fit for a ${pace} pace.`,
            `Best ${interestPhrase} memory close to the route.`,
          ],
        },
        {
          title: 'Your next move',
          lines: ['Tell me which filter matters most and I will narrow it instead of throwing random ideas at you.'],
        },
      ]),
      buildStructuredAnswer('I would turn this into one clear decision before adding more options.', [
        {
          title: 'Decision to make',
          lines: [
            'Do you want a stop, a route check, a timing check, or an app-flow answer?',
            `If it is a stop, I would keep it close and compatible with ${interestPhrase}.`,
          ],
        },
      ]),
    ], recentChat, repeatCount, travelerRequest);
  }

  const hasRoute = route !== 'your route';
  const contextHint = hasRoute
    ? `I can connect it back to ${route} if it is about this trip.`
    : `I can connect it back to the draft budget ${budget}, ${pace} pace, or ${interestPhrase} vibe if that is what you mean.`;

  return selectFreshResponse([
    `I am not sure what you want me to do with "${travelerRequest}" yet. ${contextHint} Tell me the exact question or the part of the app that feels unclear.`,
    `I need one sharper direction for "${travelerRequest}". Ask it as an Scope app question, route question, place question, budget check, timing check, or stop decision.`,
    `I can answer that better if you frame "${travelerRequest}" around the trip or the app. What should I check first?`,
    `That could mean a few things. Give me the route, app, timing, budget, or place angle and I will answer without guessing.`,
  ], recentChat, repeatCount, travelerRequest);
}

function buildLocalTripPlanFallback(request: TripPlanRequest): TripPlanResponse {
  const start = readPromptLine(request.prompt, 'Start');
  const end = readPromptLine(request.prompt, 'End');
  const dates = readPromptLine(request.prompt, 'Dates') || request.start_date || 'your selected dates';
  const budget = readPromptLine(request.prompt, 'Budget') || 'the current budget';
  const rawPace = readPromptLine(request.prompt, 'Pace');
  const rawInterests = readPromptLine(request.prompt, 'Interests');
  const stops = readPromptSection(request.prompt, 'Stops');
  const travelerRequest = readTravelerRequest(request.prompt);
  const effectivePace = rawPace || inferPaceFromText(travelerRequest);
  const pace = effectivePace || 'balanced';
  const effectiveInterests = rawInterests || inferInterestsFromText(travelerRequest);
  const interests = effectiveInterests || 'the selected trip vibes';
  const recentChat = readRecentChat(request.prompt);
  const route = start && end ? `${start} to ${end}` : start || end || 'your route';
  const topic = classifyTravelerRequest(travelerRequest);
  const conversationalIntent = classifyConversationalIntent(travelerRequest, topic);
  const repeatCount = Math.max(
    countRecentTopicMentions(recentChat, topic),
    countRecentExactUserRequests(recentChat, travelerRequest),
    countRecentConversationalIntentMentions(recentChat, conversationalIntent),
  );

  let itinerary: string;
  const missingBriefQuestions = topic !== 'appHelp' && isItineraryBuildRequest(travelerRequest)
    ? getMissingItineraryBriefQuestions(request.prompt, start, end, dates, effectivePace, effectiveInterests)
    : [];
  const pendingBriefQuestion = getPendingItineraryBriefQuestion(request.prompt, recentChat);
  const shouldUsePendingBrief = Boolean(pendingBriefQuestion) && !shouldAnswerNewIntentBeforePendingBrief(
    topic,
    conversationalIntent,
    travelerRequest,
    pendingBriefQuestion,
  );

  if (isVagueBriefReply(travelerRequest) && promptHasPendingItineraryBrief(request.prompt, recentChat)) {
    itinerary = buildSmartDefaultItineraryAnswer(route, budget, pace);
  } else if (shouldUsePendingBrief && pendingBriefQuestion && !doesReplyAnswerPendingBriefQuestion(travelerRequest, pendingBriefQuestion)) {
    itinerary = buildPendingBriefReminderAnswer(pendingBriefQuestion, travelerRequest);
  } else if (shouldUsePendingBrief && pendingBriefQuestion) {
    const nextBriefQuestion = getNextMissingBriefQuestionAfterAnswer(
      request.prompt,
      start,
      end,
      dates,
      effectivePace,
      effectiveInterests,
      pendingBriefQuestion.key,
    );
    itinerary = nextBriefQuestion
      ? `Got it. ${nextBriefQuestion}`
      : `Got it. I have enough to keep building ${route}. Ask me to build it again if you want me to refresh the itinerary from the planner.`;
  } else if (missingBriefQuestions.length) {
    itinerary = buildMissingItineraryBriefAnswer(missingBriefQuestions);
  } else if (topic !== 'appHelp' && shouldReturnConciseItinerary(travelerRequest, topic)) {
    itinerary = buildConciseItineraryAnswer(request.prompt, route, dates, budget, pace, effectiveInterests, stops);
  } else if (conversationalIntent) {
    itinerary = buildConversationalAnswer(conversationalIntent, route, travelerRequest, recentChat, repeatCount);
  } else if (topic === 'appHelp') {
    itinerary = buildAppHelpAnswer(travelerRequest, route);
  } else if (topic === 'budget') {
    itinerary = buildBudgetAnswer(route, budget, pace, dates, repeatCount);
  } else if (topic === 'tighten') {
    itinerary = buildTightenAnswer(route, pace, stops, repeatCount);
  } else if (topic === 'timing') {
    itinerary = buildTimingAnswer(route, dates, pace, repeatCount);
  } else if (topic === 'midpoint') {
    itinerary = buildMidpointAnswer(route, interests, budget, repeatCount);
  } else if (topic === 'startCity') {
    itinerary = buildStartCityAnswer(start, end, budget, pace);
  } else if (topic === 'weekend') {
    itinerary = buildWeekendAnswer(route, budget, pace, interests);
  } else if (topic === 'food') {
    itinerary = buildFoodAnswer(route, budget, pace);
  } else if (topic === 'weather') {
    itinerary = buildWeatherAnswer(route, dates, pace);
  } else if (topic === 'safety') {
    itinerary = buildSafetyAnswer(route, pace);
  } else if (topic === 'group') {
    itinerary = buildGroupAnswer(route, budget, pace);
  } else if (topic === 'image') {
    itinerary = buildImageAnswer(route, travelerRequest);
  } else {
    itinerary = buildGeneralAnswer(route, travelerRequest, budget, pace, interests, recentChat, repeatCount);
  }

  itinerary = ensureFreshFinalAnswer(itinerary, recentChat, travelerRequest, repeatCount);

  return {
    itinerary,
    steps: 0,
    model: 'scope-local-copilot',
  };
}

export const __agentServiceCoverage = import.meta.env.MODE === 'test'
  ? {
      buildAppHelpAnswer,
      buildBudgetAnswer,
      buildConciseItineraryAnswer,
      buildConversationalAnswer,
      buildFoodAnswer,
      buildGeneralAnswer,
      buildGroupAnswer,
      buildImageAnswer,
      buildLocalTripPlanFallback,
      buildMidpointAnswer,
      buildMissingItineraryBriefAnswer,
      buildMissingRouteLine,
      buildPendingBriefReminderAnswer,
      buildRepeatShiftLine,
      buildRouteSections,
      buildSafetyAnswer,
      buildSmartDefaultItineraryAnswer,
      buildStartCityAnswer,
      buildStructuredAnswer,
      buildTimingAnswer,
      buildTightenAnswer,
      buildWeekendAnswer,
      buildWeatherAnswer,
      classifyConversationalIntent,
      classifyTravelerRequest,
      countRecentConversationalIntentMentions,
      countRecentExactUserRequests,
      countRecentMatchingAssistantAnswers,
      countRecentTopicMentions,
      doesReplyAnswerPendingBriefQuestion,
      ensureFreshFinalAnswer,
      formatInterestPhrase,
      getConcisePlanDayCount,
      getLatestPendingItineraryBriefLine,
      getMissingItineraryBriefQuestions,
      getNextMissingBriefQuestionAfterAnswer,
      getPaceStopTarget,
      getPendingBriefQuestionKey,
      getPendingItineraryBriefQuestion,
      getTravelersLabel,
      hasTravelPartyBrief,
      inferInterestsFromText,
      inferPaceFromText,
      isAppHelpRequest,
      isItineraryBuildRequest,
      isOffTopicGeneralQuestion,
      isScopeDomainQuestion,
      isVagueBriefReply,
      normalizeConversationText,
      normalizePendingBriefQuestion,
      parsePlannerStopNames,
      parsePromptDurationDays,
      shouldReturnConciseItinerary,
      promptHasPendingItineraryBrief,
      readPromptLine,
      readPromptSection,
      readRecentChat,
      readRecentChatLines,
      readRecentChatRoleLines,
      readTravelerRequest,
      recentChatHasPendingItineraryBrief,
      selectFreshResponse,
      shouldAnswerNewIntentBeforePendingBrief,
      shouldUseLocalFallback,
    }
  : undefined;

export async function planTrip(request: TripPlanRequest, options: TripPlanOptions = {}): Promise<TripPlanResponse> {
  if (DEMO_MODE_ENABLED && !import.meta.env.VITEST) {
    return buildLocalTripPlanFallback(request);
  }

  try {
    const { data } = await api.post<TripChatResponse>(`${AGENT_BASE}/trip-chat`, {
      ...request,
      responseMode: 'json',
    }, {
      timeout: 120_000,
      ...(options.signal ? { signal: options.signal } : {}),
    });
    return {
      itinerary: data.itinerary ?? data.response ?? '',
      steps: data.steps ?? 0,
      model: data.model ?? 'scope-ai',
    };
  } catch (error) {
    if (shouldUseLocalFallback(error)) {
      return buildLocalTripPlanFallback(request);
    }

    throw error;
  }
}
