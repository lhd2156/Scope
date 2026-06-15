export type TravelerRequestTopic =
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

export function readPromptLine(prompt: string, label: string): string {
  const match = prompt.match(new RegExp(`^${label}:\\s*(.+)$`, 'im'));
  return match?.[1]?.trim() ?? '';
}

export function readTravelerRequest(prompt: string): string {
  const match = prompt.match(/Traveler request:\s*([\s\S]+)$/i);
  return match?.[1]?.trim() || prompt.trim();
}

export function readPromptSection(prompt: string, label: string): string {
  const match = prompt.match(new RegExp(`^${label}:\\s*([\\s\\S]*?)(?=\\n[A-Z][A-Za-z ]+:|$)`, 'im'));
  return match?.[1]?.trim() ?? '';
}

export function readRecentChat(prompt: string): string {
  const match = prompt.match(/(?:^|\n)Recent chat:\s*([\s\S]*?)(?=\nTraveler request:|$)/i);
  return match?.[1]?.trim() ?? '';
}

export function isItineraryBuildRequest(value: string): boolean {
  return (
    /\b(build|generate|make|create)\b.*\b(itinerary|plan|route|first draft|weekend)\b/i.test(value) ||
    /\b(balanced first draft|first itinerary|starter itinerary)\b/i.test(value)
  );
}

export function shouldReturnConciseItinerary(value: string, topic: TravelerRequestTopic): boolean {
  if (!isItineraryBuildRequest(value)) {
    return false;
  }

  if (topic !== 'weekend') {
    return true;
  }

  return /\b(itinerary|plan|route|draft)\b/i.test(value);
}

export function parsePromptDurationDays(prompt: string, dates: string): number | null {
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

export function hasTravelPartyBrief(prompt: string): boolean {
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

export function buildMissingItineraryBriefAnswer(questions: string[]): string {
  return `I can build that. ${questions[0] ?? 'What kind of trip should this feel like?'}`;
}

export function inferInterestsFromText(value: string): string {
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

export function inferPaceFromText(value: string): string {
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

export function getMissingItineraryBriefQuestions(
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
