import { parseScopeAiResponse } from '@/services/scopeAiResponseParser';

describe('parseScopeAiResponse', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('extracts an action block from an action fence', () => {
    const parsed = parseScopeAiResponse([
      '```action',
      '{"actions":[{"type":"SET_FIELD","field":"start","value":"Dallas"}]}',
      '```',
      'Set start to Dallas.',
      'CHIPS: ["Add food","Set end","Build route"]',
    ].join('\n'));

    expect(parsed.actionBlock).toEqual({
      actions: [{ type: 'SET_FIELD', field: 'start', value: 'Dallas' }],
    });
  });

  it('extracts chips from the CHIPS line', () => {
    const parsed = parseScopeAiResponse('Done.\nCHIPS: ["Add lunch","Check timing","Undo"]');

    expect(parsed.chips).toEqual(['Add lunch', 'Check timing', 'Undo']);
  });

  it('returns clean confirmation text', () => {
    const parsed = parseScopeAiResponse([
      '```action',
      '{"actions":[{"type":"SET_FIELD","field":"end","value":"Austin"}]}',
      '```',
      '',
      'Set end to Austin.',
      'Next, add one midpoint stop.',
      'CHIPS: ["Add midpoint","Set budget","Undo"]',
    ].join('\n'));

    expect(parsed.confirmationText).toBe('Set end to Austin.\nNext, add one midpoint stop.');
  });

  it('handles responses with no action block', () => {
    const parsed = parseScopeAiResponse('Tell me where you are headed.\nCHIPS: ["Set start","Set end","Build my day"]');

    expect(parsed.actionBlock).toBeNull();
    expect(parsed.confirmationText).toBe('Tell me where you are headed.');
  });

  it('handles responses with no chips', () => {
    const parsed = parseScopeAiResponse('Set start to Dallas.');

    expect(parsed.chips).toEqual([]);
    expect(parsed.confirmationText).toBe('Set start to Dallas.');
  });

  it('handles malformed action JSON without throwing', () => {
    expect(() => parseScopeAiResponse([
      '```action',
      '{"actions":[',
      '```',
      'Still confirming.',
      'CHIPS: ["A","B","C"]',
    ].join('\n'))).not.toThrow();

    const parsed = parseScopeAiResponse([
      '```action',
      '{"actions":[',
      '```',
      'Still confirming.',
      'CHIPS: ["A","B","C"]',
    ].join('\n'));

    expect(parsed.actionBlock).toBeNull();
    expect(parsed.confirmationText).toBe('Still confirming.');
    expect(console.error).toHaveBeenCalled();
  });

  it('handles malformed chips JSON without throwing', () => {
    const parsed = parseScopeAiResponse('Set start to Dallas.\nCHIPS: ["A",]');

    expect(parsed.chips).toEqual([]);
    expect(parsed.confirmationText).toBe('Set start to Dallas.');
    expect(console.error).toHaveBeenCalled();
  });
});
