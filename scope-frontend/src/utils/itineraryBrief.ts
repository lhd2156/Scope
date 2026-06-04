const SPECIFIC_BRIEF_SIGNAL_PATTERN = /\b(?:\d{1,2}\s*(?:day|days|d)|weekend|food|restaurants?|coffee|cafes?|culture|museums?|art|history|nature|parks?|trails?|hikes?|adventure|nightlife|bars?|shopping|entertainment|amusement|theme\s*parks?|six\s*flags|bowling|arcades?|movies?|cinema|scenic|views?|relaxed|chill|balanced|moderate|packed|busy|solo|alone|couple|partner|family|kids?|children|group|friends?)\b/i;
const VAGUE_BRIEF_TOKEN_PATTERN = /\b(?:idk|idc|dunno|whatever|anything|anywhere|any|sure|yeah|yes|yep|ok|okay|fine|alright|meh)\b/i;
const VAGUE_BRIEF_PHRASE_PATTERN = /\b(?:i\s*(?:dont|don't|do\s*not)\s*know|(?:dont|don't|do\s*not)\s*know|i\s*(?:dont|don't|do\s*not)\s*care|(?:dont|don't|do\s*not)\s*care|not\s*sure|unsure|no\s*(?:idea|clue|preference|prefs?)|not\s*picky|doesn'?t\s*matter|does\s*not\s*matter|surprise\s*(?:me|us)|you\s*(?:choose|pick|decide|plan)|u\s*(?:choose|pick|decide|plan)|you\s*got\s*it|go\s*for\s*it|sounds\s*good|works\s*for\s*me|do\s*your\s*thing|make\s*it\s*good|best\s*option|whatever\s*you\s*(?:think|want|recommend)|anything\s*works|any\s*works|any\s*is\s*fine|i'?m\s*open|im\s*open|open\s*to\s*anything|dealer'?s?\s*choice|up\s*to\s*you|your\s*call|i\s*guess|i\s*trust\s*you|trust\s*you|you\s*know\s*best|help\s*me|just\s*help|u\s*wanna\s*help|you\s*wanna\s*help|pick\s*for\s*me|choose\s*for\s*me|plan\s*it|build\s*it|send\s*it)\b/i;

function normalizeBriefReply(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[\u2019\u00e2\u20ac\u2122]/g, "'")
    .replace(/[^\w'\s]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function isVagueBriefReply(value: string): boolean {
  const normalized = normalizeBriefReply(value);
  if (SPECIFIC_BRIEF_SIGNAL_PATTERN.test(normalized)) {
    return false;
  }

  return VAGUE_BRIEF_TOKEN_PATTERN.test(normalized) || VAGUE_BRIEF_PHRASE_PATTERN.test(normalized);
}
