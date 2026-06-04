import { SCOPE_AI_SYSTEM_PROMPT } from '@/services/scopeAiSystemPrompt';

describe('Scope AI system prompt contract', () => {
  it('keeps the planner action protocol and safety instructions in the shipped prompt', () => {
    expect(SCOPE_AI_SYSTEM_PROMPT).toContain('You are SCOPE AI');
    expect(SCOPE_AI_SYSTEM_PROMPT).toContain('ACTION BLOCKS');
    expect(SCOPE_AI_SYSTEM_PROMPT).toContain('"actions"');
    expect(SCOPE_AI_SYSTEM_PROMPT).toContain('SEARCH_NEARBY_FUEL');
    expect(SCOPE_AI_SYSTEM_PROMPT).toContain('SEARCH_NEARBY_PLACES');
    expect(SCOPE_AI_SYSTEM_PROMPT).toContain('Never output only JSON');
    expect(SCOPE_AI_SYSTEM_PROMPT).toContain('CHIPS: ["chip one", "chip two", "chip three"]');
  });
});
