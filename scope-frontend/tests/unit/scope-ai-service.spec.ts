import { parseScopeAiResponse } from '@/services/scopeAiResponseParser';
import { __scopeAiServiceCoverage, callScopeAi } from '@/services/scopeAiService';

const apiPostMock = vi.hoisted(() => vi.fn());

vi.mock('@/services/api', () => ({
  default: {
    post: apiPostMock,
  },
}));

describe('scope AI service local planner responses', () => {
  const baseInput = {
    plannerState: {
      start: null,
      end: null,
      stops: [],
      pace: 'relaxed',
      theme: [],
    },
    sessionHistory: [],
    preferences: {},
  };

  beforeEach(() => {
    apiPostMock.mockReset();
    apiPostMock.mockRejectedValue(new Error('offline'));
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  async function ask(message: string, plannerState: Record<string, unknown> = {}) {
    const response = await callScopeAi({
      ...baseInput,
      plannerState: {
        ...baseInput.plannerState,
        ...plannerState,
      },
      message,
    });
    return parseScopeAiResponse(response.responseText);
  }

  it.each([
    ['min 400 max 600'],
    ['minimum budget 400 maximum budget 600'],
    ['between 400 and 600'],
    ['400 to 600'],
    ['400 to 600 budget'],
    ['max 600 min 400'],
    ['400 min 600 max'],
  ])('extracts explicit budget ranges from "%s"', async (message) => {
    const parsed = await ask(message);

    expect(parsed.actionBlock?.actions).toEqual([
      { type: 'SET_FIELD', field: 'budget_min', value: 400 },
      { type: 'SET_FIELD', field: 'budget_max', value: 600 },
    ]);
    expect(parsed.confirmationText).toBe('Set the trip budget to $400 - $600.');
  });

  it.each([
    ['max 400'],
    ['under 400'],
    ['cap at 400'],
    ['set max budget to 400'],
    ['budget ceiling 400'],
  ])('keeps max-only budget commands as max budget updates for "%s"', async (message) => {
    const parsed = await ask(message);

    expect(parsed.actionBlock?.actions).toEqual([
      { type: 'SET_FIELD', field: 'budget_max', value: 400 },
    ]);
    expect(parsed.confirmationText).toBe('Set the max trip budget to $400.');
  });

  it('keeps max-only budget updates independent when the current minimum is higher', async () => {
    const parsed = await ask('set max budget to $400', {
      budget_min: 500,
      budget_max: 1500,
    });

    expect(parsed.actionBlock?.actions).toEqual([
      { type: 'SET_FIELD', field: 'budget_min', value: 400 },
      { type: 'SET_FIELD', field: 'budget_max', value: 400 },
    ]);
    expect(parsed.confirmationText).toBe('Set the max trip budget to $400. Matched the minimum so the range stays valid.');
    expect(parsed.confirmationText).not.toContain('$500 - $400');
  });

  it('treats an exact single budget as both the minimum and maximum', async () => {
    const parsed = await ask('budget at 5', {
      budget_min: 500,
      budget_max: 1500,
    });

    expect(parsed.actionBlock?.actions).toEqual([
      { type: 'SET_FIELD', field: 'budget_min', value: 5 },
      { type: 'SET_FIELD', field: 'budget_max', value: 5 },
    ]);
    expect(parsed.confirmationText).toBe('Set the trip budget to $5.');
  });

  it('rejects negative budget commands without mutating the planner', async () => {
    const parsed = await ask('budget at -5', {
      budget_min: 500,
      budget_max: 1500,
    });

    expect(parsed.actionBlock).toBeNull();
    expect(parsed.confirmationText).toBe('Budget needs a positive number, so I left the current budget unchanged.');
  });

  it('does not let the single-budget fallback override explicit min/max commands', async () => {
    const parsed = await ask('set budget min 400 max 600 please');

    expect(parsed.actionBlock?.actions).toEqual([
      { type: 'SET_FIELD', field: 'budget_min', value: 400 },
      { type: 'SET_FIELD', field: 'budget_max', value: 600 },
    ]);
    expect(parsed.confirmationText).not.toContain('max trip budget to $400');
  });

  it('applies only verified high-confidence actions from mixed intent prompts', async () => {
    const parsed = await ask('start 100 Example Road and start date 5/17 and find cheapest diesel within 10 mi');

    expect(parsed.actionBlock?.actions).toEqual([
      { type: 'SET_FIELD', field: 'start', value: '100 Example Road' },
      { type: 'SET_FIELD', field: 'start_date', value: '2026-05-17' },
      { type: 'SET_FIELD', field: 'fuel_type', value: 'diesel' },
      { type: 'SEARCH_NEARBY_FUEL', sort_by: 'best_price', radius_km: 16, limit: 5 },
    ]);
    expect(parsed.confirmationText).toContain('multiple planner updates');
    expect(parsed.confirmationText).toContain('I left any unclear extra wording unchanged');
  });

  it('sanitizes unsafe text before sending non-deterministic prompts to the backend', async () => {
    const severe = String.fromCharCode(110, 105, 103, 103, 101, 114);
    apiPostMock.mockResolvedValueOnce({
      data: {
        response: 'Safe route answer.',
        model: 'mock-rag',
      },
    });

    await callScopeAi({
      ...baseInput,
      message: `Any fun ideas ${severe}`,
      sessionHistory: [{ role: 'user', content: `prior ${severe}` }],
    });

    const payload = apiPostMock.mock.calls[0]?.[1] as { message: string; session_history: Array<{ content: string }> };
    expect(payload.message).toBe('Any fun ideas');
    expect(payload.message).not.toContain(severe);
    expect(payload.session_history[0]?.content).toContain('[redacted]');
    expect(payload.session_history[0]?.content).not.toContain(severe);
  });

  it.each([
    'asdkj qweqwe ???',
    'asdkj qweqwe route???',
    'skibidi sigma route???',
  ])('refuses unclear prompt "%s" instead of guessing from route state or calling backend', async (message) => {
    const parsed = await ask(message, {
      start: 'Dallas',
      end: 'Austin',
    });

    expect(apiPostMock).not.toHaveBeenCalled();
    expect(parsed.actionBlock).toBeNull();
    expect(parsed.confirmationText).toContain('cannot confidently answer that without guessing');
    expect(parsed.confirmationText).not.toContain('Dallas');
    expect(parsed.confirmationText).not.toContain('Austin');
  });

  it('still sends clear route questions to the backend instead of refusing them', async () => {
    apiPostMock.mockResolvedValueOnce({
      data: {
        response: 'Here is a clear route confidence summary.',
        model: 'scope-ai-test',
      },
    });

    const parsed = await ask('Give me a confidence summary for this route', {
      start: 'Dallas',
      end: 'Austin',
    });

    expect(apiPostMock).toHaveBeenCalledTimes(1);
    expect(parsed.actionBlock).toBeNull();
    expect(parsed.confirmationText).toBe('Here is a clear route confidence summary.');
  });

  it('sends explicit location recommendation questions to the backend before local planner fallbacks', async () => {
    apiPostMock.mockResolvedValueOnce({
      data: {
        response: 'Dallas has strong live options around Bishop Arts, Deep Ellum, and the Arts District.',
        model: 'scope-ai-test',
      },
    });

    const parsed = await ask('What should I do around Dallas this weekend?');

    expect(apiPostMock).toHaveBeenCalledTimes(1);
    expect(parsed.actionBlock).toBeNull();
    expect(parsed.confirmationText).toContain('Dallas has strong live options');
    expect(parsed.confirmationText).not.toContain('add a start place');
  });

  it('keeps backend answers for explicit location recommendations without requiring action fences', async () => {
    apiPostMock.mockResolvedValueOnce({
      data: {
        response: 'For Dallas this weekend, anchor the day around Bishop Arts, the Arts District, and Deep Ellum.',
        model: 'scope-ai-test',
      },
    });

    const parsed = await ask('Things to do in Dallas this weekend');

    expect(apiPostMock).toHaveBeenCalledTimes(1);
    expect(parsed.actionBlock).toBeNull();
    expect(parsed.confirmationText).toContain('Bishop Arts');
    expect(parsed.confirmationText).not.toContain('I cannot verify current hours');
  });

  it('sends no-preposition city recommendation prompts to the backend', async () => {
    apiPostMock.mockResolvedValueOnce({
      data: {
        response: 'Dallas can work as a compact food and culture weekend if you cluster the route.',
        model: 'scope-ai-test',
      },
    });

    const parsed = await ask('things to do Dallas this weekend');

    expect(apiPostMock).toHaveBeenCalledTimes(1);
    expect(parsed.confirmationText).toContain('Dallas can work');
    expect(parsed.confirmationText).not.toContain('cannot confidently answer');
  });

  it('keeps Scope AI command parsing, local fallbacks, and backend payload guards bounded across edge prompts', async () => {
    const coverage = __scopeAiServiceCoverage!;
    const plannerState = {
      start: 'Dallas',
      end: 'Austin',
      start_date: '2026-05-20',
      end_date: '2026-05-22',
      budget_min: 500,
      budget_max: 1500,
      stops: [{ id: 'stop-1', name: 'Waco Arcade', type: 'entertainment' }],
      pace: 'moderate',
      theme: ['food'],
    };

    expect(coverage.normalizeNoisyScopeAiPrompt('budgte??? zom out mpa!!')).toContain('budget');
    expect(coverage.normalizeNoisyScopeAiPrompt('')).toBe('');
    expect(coverage.collapseRepeatedLetters('soooo cooool!!!')).toBe('so col!!!');
    expect(coverage.extractDateTokens('leave May 17 and return 18 June 2026')).toEqual(expect.any(Array));
    expect(coverage.parseDateToken('May 17', 2026)).toMatchObject({ iso: '2026-05-17' });
    expect(coverage.parseDateToken('17 May 26', 2026)).toMatchObject({ iso: '2026-05-17' });
    expect(coverage.parseDateToken('', 2026)).toBeNull();
    expect(coverage.buildDateClarification(plannerState, { iso: '2026-05-01', explicitYear: false })).toMatchObject({
      responseText: expect.stringContaining('before the current start date'),
    });
    expect(coverage.buildDateClarification(plannerState, { iso: '2026-05-25', explicitYear: false })).toBeNull();

    expect(coverage.extractBudgetRange('budget 900 to 700')).toEqual([700, 900]);
    expect(coverage.extractBudgetRange('budget min nope max 700')).toBeNull();
    expect(coverage.extractSingleBudget('set budget to 650')).toBe(650);
    expect(coverage.extractSingleBudget('budget party route')).toBeNull();
    expect(coverage.buildSingleBudgetActions(400, plannerState)).toEqual([
      { type: 'SET_FIELD', field: 'budget_min', value: 400 },
      { type: 'SET_FIELD', field: 'budget_max', value: 400 },
    ]);
    expect(coverage.extractPartySize('for 7 people')).toBe(7);
    expect(coverage.extractPartySize('for many people')).toBeNull();
    expect(coverage.extractRadiusKm('within 15 miles')).toBeGreaterThan(20);
    expect(coverage.extractRadiusKm('nearby')).toBeNull();

    expect(coverage.extractMapCommand('zoom out the map')).toMatchObject({ command: 'zoom_out' });
    expect(coverage.extractMapCommand('make the map dark')).toMatchObject({ command: 'map_style_dark' });
    expect(coverage.extractMapCommand('focus map on Waco')).toMatchObject({ command: 'zoom_to_place', query: 'Waco' });
    expect(coverage.extractMapCommand('open route list')).toMatchObject({ command: 'fit_route' });
    expect(coverage.extractMapCommand('show receipts later')).toBeNull();
    expect(coverage.parseScopeAiPlannerCommand('invite maya@example.com as viewer')).toMatchObject({
      intent: 'invite_member',
      invite: { recipient: 'maya@example.com', role: 'viewer' },
    });
    expect(coverage.parseScopeAiPlannerCommand('make trip private')).toMatchObject({ intent: 'visibility', visibility: false });
    expect(coverage.parseScopeAiPlannerCommand('rename trip Hill Country Loop')).toMatchObject({ intent: 'rename_trip', title: 'Hill Country Loop' });
    expect(coverage.parseScopeAiPlannerCommand('remove destination')).toMatchObject({ intent: 'clear_endpoint', clearEndpoint: 'end' });
    expect(coverage.parseScopeAiPlannerCommand('find coffee nearby within 4 km')).toMatchObject({ intent: 'nearby_places' });

    const mixedMessage = 'set budget 700 and zoom out map and find cheapest diesel within 10 miles';
    const mixed = coverage.buildMixedIntentResponse(
      mixedMessage,
      coverage.normalizeNoisyScopeAiPrompt(mixedMessage).toLowerCase(),
      plannerState,
    );
    expect(mixed.responseText).toContain('```action');
    expect(coverage.extractActionsFromLocalResponse(mixed)).toEqual(expect.any(Array));
    expect(coverage.buildLocalScopeAiResponse({
      ...baseInput,
      message: 'check route status',
      plannerState,
    }).responseText).toContain('Dallas');
    expect(coverage.buildLocalScopeAiResponse({
      ...baseInput,
      message: 'asdkj qweqwe ???',
      plannerState,
    }).responseText).toContain('cannot confidently answer');
    expect(coverage.shouldUseLocalResponse('set budget 700', 'Here is a generic backend answer.', plannerState)).toBe(true);
    expect(coverage.shouldUseLocalResponse('what should I do in Dallas', 'Here is a generic backend answer.', plannerState)).toBe(false);
    expect(coverage.extractExplicitLocationRecommendationQuery('destination is Austin')).toBeNull();

    const destinationSetter = await callScopeAi({
      ...baseInput,
      message: 'destination is Austin',
      plannerState,
    });
    expect(parseScopeAiResponse(destinationSetter.responseText).actionBlock?.actions).toEqual([
      { type: 'SET_FIELD', field: 'end', value: 'Austin, TX' },
    ]);
    expect(apiPostMock).not.toHaveBeenCalled();

    const suffixedDateSetter = await callScopeAi({
      ...baseInput,
      message: 'end date maybe May 18 2027 no guessing',
      plannerState: {
        ...plannerState,
        start_date: '2027-05-17',
        end_date: '2027-05-18',
      },
    });
    expect(parseScopeAiResponse(suffixedDateSetter.responseText).actionBlock?.actions).toEqual([
      { type: 'SET_FIELD', field: 'end_date', value: '2027-05-18' },
    ]);
    expect(apiPostMock).not.toHaveBeenCalled();

    apiPostMock.mockResolvedValueOnce({
      data: {
        response: 'Backend image route answer.',
        model: undefined,
        actions: [{ type: 'SET_FIELD', field: 'pace', value: 'packed' }],
        chips: ['Build it'],
        place_cards: [{ title: 'Cafe', subtitle: 'Waco', reason: 'On route', source_label: 'Scope' }],
      },
    });
    const backend = await callScopeAi({
      ...baseInput,
      message: 'Inspect attached image for this route',
      images: [
        { filename: 'one.jpg', mime_type: 'image/jpeg', data: 'abc' },
        { filename: 'two.png', mime_type: 'image/png', data: 'def' },
        { filename: 'three.webp', mime_type: 'image/webp', data: 'ghi' },
        { filename: 'four.gif', mime_type: 'image/gif', data: 'skip' },
      ],
      plannerState,
    });
    expect(backend.model).toBe('scope-ai');
    expect(backend.responseText).toContain('Backend image route answer.');
    expect(backend.responseText).toContain('```action');
    expect(apiPostMock.mock.calls.at(-1)?.[1].images).toHaveLength(3);

    apiPostMock.mockResolvedValueOnce({ data: { response: '  Backend route answer  ', model: 'live-model' } });
    await expect(callScopeAi({
      ...baseInput,
      message: 'Tell me whether this route is worth it',
      plannerState,
    })).resolves.toMatchObject({ responseText: 'Backend route answer', model: 'live-model' });
  });

  it.each([
    ['what to do Dallas this weekend', 'recommended'],
    ['fun things Dallas', 'recommended'],
    ['Dallas fun things to do', 'recommended'],
    ['things to do in Dallas for kids', 'recommended'],
    ['restaurants in Dallas with family', 'food'],
    ['good restaurants Dallas', 'food'],
    ['best brunch Dallas', 'food'],
    ['where should we eat Dallas', 'food'],
    ['shopping in Dallas', 'shopping'],
    ['shopping Dallas', 'shopping'],
    ['Dallas shopping', 'shopping'],
    ['scenic views Dallas', 'scenic'],
    ['Dallas scenic views', 'scenic'],
    ['outdoor activities Dallas', 'outdoors'],
    ['parks Dallas', 'outdoors'],
    ['entertainment Dallas', 'entertainment'],
    ['bowling Dallas', 'entertainment'],
    ['live music Dallas', 'nightlife'],
  ])('extracts loose city activity and category prompts from "%s"', (message, expectedCategory) => {
    expect(__scopeAiServiceCoverage?.extractExplicitLocationRecommendationQuery(message)).toBe('Dallas');
    expect(__scopeAiServiceCoverage?.extractNearbyCategory(message.toLowerCase())).toBe(
      expectedCategory === 'recommended' ? null : expectedCategory,
    );
  });

  it('uses a location-aware local fallback when the backend is unavailable', async () => {
    const parsed = await ask('What should I do around Dallas this weekend?');

    expect(apiPostMock).toHaveBeenCalledTimes(1);
    expect(parsed.actionBlock).toBeNull();
    expect(parsed.confirmationText).toContain('For Dallas');
    expect(parsed.confirmationText).toContain('Bishop Arts');
    expect(parsed.confirmationText).not.toContain('Add a start, a final destination');
    expect(parsed.chips).toContain('Use Dallas as start');
  });

  it('asks for a real location for near-me prompts when backend/current location is unavailable', async () => {
    const parsed = await ask('what should I do near me');

    expect(apiPostMock).not.toHaveBeenCalled();
    expect(parsed.actionBlock).toBeNull();
    expect(parsed.confirmationText).toContain('I need a real location');
    expect(parsed.chips).toContain('Use current location');
  });

  it('uses category-specific Dallas fallback copy when the backend is unavailable', async () => {
    const parsed = await ask('nightlife in Dallas');

    expect(apiPostMock).toHaveBeenCalledTimes(1);
    expect(parsed.confirmationText).toContain('For Dallas nightlife');
    expect(parsed.confirmationText).toContain('Deep Ellum');
    expect(parsed.confirmationText).not.toContain('strong weekend shape');
    expect(parsed.chips).toContain('Find nightlife near Dallas');
  });

  it('treats category-first city requests as explicit location recommendations', async () => {
    apiPostMock.mockResolvedValueOnce({
      data: {
        response: 'For Dallas nightlife, start with Deep Ellum, then compare Bishop Arts and the Design District.',
        model: 'scope-ai-test',
      },
    });

    const parsed = await ask('nightlife in Dallas');

    expect(apiPostMock).toHaveBeenCalledTimes(1);
    expect(parsed.confirmationText).toContain('Deep Ellum');
    expect(parsed.confirmationText).not.toContain('cannot confidently answer');
  });

  it('filters image payloads at the service boundary before calling the backend', async () => {
    apiPostMock.mockResolvedValueOnce({
      data: {
        response: 'I can review the usable attached images.',
        model: 'gemini-test',
      },
    });

    await callScopeAi({
      ...baseInput,
      message: 'Review these attached images for my trip.',
      images: [
        { filename: 'animation.gif', mime_type: 'image/gif', data: 'R0lGODlh' },
        { filename: 'lookout.png', mime_type: 'image/png', data: 'data:image/png;base64,YXRsYXM=' },
        { filename: 'huge.png', mime_type: 'image/png', data: 'A'.repeat(2_200_000) },
        { filename: 'map.webp', mime_type: 'image/webp', data: 'bWFw' },
        { filename: 'receipt.jpg', mime_type: 'image/jpeg', data: 'cmVjZWlwdA==' },
        { filename: 'extra.png', mime_type: 'image/png', data: 'ZXh0cmE=' },
      ],
    });

    const payload = apiPostMock.mock.calls[0]?.[1] as { images: Array<{ filename: string; mime_type: string; data: string }> };
    expect(payload.images).toEqual([
      { filename: 'lookout.png', mime_type: 'image/png', data: 'YXRsYXM=' },
      { filename: 'map.webp', mime_type: 'image/webp', data: 'bWFw' },
      { filename: 'receipt.jpg', mime_type: 'image/jpeg', data: 'cmVjZWlwdA==' },
    ]);
  });

  it('wraps backend actions and chips in the local parser contract', async () => {
    apiPostMock.mockResolvedValueOnce({
      data: {
        response: 'Budget guardrail updated.',
        model: 'scope-ai-test',
        actions: [{ type: 'SET_FIELD', field: 'budget_max', value: 700 }],
        chips: ['Check route status', 'Build the itinerary'],
      },
    });

    const parsed = await ask('Give me a confidence summary for this route', {
      start: 'Dallas',
      end: 'Austin',
    });

    expect(apiPostMock).toHaveBeenCalledTimes(1);
    expect(parsed.confirmationText).toBe('Budget guardrail updated.');
    expect(parsed.actionBlock?.actions).toEqual([
      { type: 'SET_FIELD', field: 'budget_max', value: 700 },
    ]);
    expect(parsed.chips).toEqual(['Check route status', 'Build the itinerary']);
  });

  it('renders backend place cards when the model answer does not name them', async () => {
    apiPostMock.mockResolvedValueOnce({
      data: {
        response: 'Here are the strongest nearby options to verify.',
        model: 'scope-ai-test',
        place_cards: [{
          title: 'Panther City Tacos',
          reason: 'Close to the route anchor and provider-backed.',
          sourceLabel: 'Google Places',
        }],
      },
    });

    const parsed = await ask('Give me a confidence summary for this route', {
      start: 'Fort Worth',
      end: 'Austin',
    });

    expect(parsed.confirmationText).toContain('Live nearby picks:');
    expect(parsed.confirmationText).toContain('1. Panther City Tacos - Close to the route anchor and provider-backed.');
  });

  it('sends image-only trip review prompts to the backend with inline image data', async () => {
    apiPostMock.mockResolvedValueOnce({
      data: {
        response: 'The attached photo looks useful for a scenic stop.',
        model: 'gemini-test',
      },
    });

    const response = await callScopeAi({
      ...baseInput,
      message: 'Review this image for my trip.',
      images: [{
        filename: 'lookout.png',
        mime_type: 'image/png',
        data: 'YXRsYXM=',
      }],
    });

    const payload = apiPostMock.mock.calls[0]?.[1] as { images: Array<{ filename: string; mime_type: string; data: string }> };
    expect(response.responseText).toBe('The attached photo looks useful for a scenic stop.');
    expect(payload.images).toEqual([{
      filename: 'lookout.png',
      mime_type: 'image/png',
      data: 'YXRsYXM=',
    }]);
  });

  it.each([
    ['2 travelers', 2],
    ['set travelers to 3', 3],
    ['party of 4', 4],
    ['party ov 4', 4],
    ['for two of us', 2],
    ['solo trip', 1],
  ])('updates the trip travel party from "%s"', async (message, count) => {
    const parsed = await ask(message);

    expect(parsed.actionBlock?.actions).toEqual([
      { type: 'SET_FIELD', field: 'party_size', value: count },
    ]);
    expect(parsed.confirmationText).toBe(`Set the travel party to ${count === 1 ? '1 traveler' : `${count} travelers`}.`);
  });

  it.each([
    ['END DATE MAYBE 5/18?', 'end_date', '2026-05-18', 'Set the trip end date to 2026-05-18.'],
    ['end date May 18', 'end_date', '2026-05-18', 'Set the trip end date to 2026-05-18.'],
    ['start date 5/17', 'start_date', '2026-05-17', 'Set the trip start date to 2026-05-17.'],
    ['end date 5/18/2027', 'end_date', '2027-05-18', 'Set the trip end date to 2027-05-18.'],
  ])('parses date command "%s"', async (message, field, value, confirmation) => {
    const parsed = await ask(message, {
      start_date: '2026-05-17',
      date: '2026-05-17',
    });

    expect(parsed.actionBlock?.actions).toEqual([
      { type: 'SET_FIELD', field, value },
    ]);
    expect(parsed.confirmationText).toBe(confirmation);
  });

  it('parses a trip date range without falling through to route endpoint parsing', async () => {
    const parsed = await ask('trip from 5/17 to 5/18');

    expect(parsed.actionBlock?.actions).toEqual([
      { type: 'SET_FIELD', field: 'start_date', value: '2026-05-17' },
      { type: 'SET_FIELD', field: 'end_date', value: '2026-05-18' },
    ]);
    expect(parsed.confirmationText).toBe('Set the trip dates to 2026-05-17 - 2026-05-18.');
  });

  it('lets deterministic date parsing override stale backend text without an action fence', async () => {
    apiPostMock.mockResolvedValueOnce({
      data: {
        response: 'Set the travel party to 2 travelers.',
        model: 'scope-ai-stale',
      },
    });

    const parsed = await ask('END DATE MAYBE 5/18?', {
      start_date: '2026-05-17',
      date: '2026-05-17',
    });

    expect(parsed.actionBlock?.actions).toEqual([
      { type: 'SET_FIELD', field: 'end_date', value: '2026-05-18' },
    ]);
    expect(parsed.confirmationText).toBe('Set the trip end date to 2026-05-18.');
  });

  it('does not call the backend before deterministic planner commands', async () => {
    const parsed = await ask('set max budget to $400', {
      budget_min: 500,
      budget_max: 1500,
    });

    expect(apiPostMock).not.toHaveBeenCalled();
    expect(parsed.actionBlock?.actions).toEqual([
      { type: 'SET_FIELD', field: 'budget_min', value: 400 },
      { type: 'SET_FIELD', field: 'budget_max', value: 400 },
    ]);
    expect(parsed.confirmationText).toBe('Set the max trip budget to $400. Matched the minimum so the range stays valid.');
  });

  it('replaces stale missing-route backend fallbacks when route state is already known', async () => {
    apiPostMock.mockResolvedValueOnce({
      data: {
        response: 'Tell me a start, end, and budget and I can plan this.',
        model: 'scope-ai-stale',
      },
    });

    const parsed = await ask('Any ideas for this one?', {
      start: 'Dallas',
      end: 'Austin',
      budget_max: 400,
    });

    expect(apiPostMock).toHaveBeenCalledTimes(1);
    expect(parsed.actionBlock).toBeNull();
    expect(parsed.confirmationText).toContain('I have the route from Dallas to Austin');
    expect(parsed.confirmationText).not.toContain('Tell me a start');
  });

  it('normalizes start endpoint commands without keeping command filler in the place text', async () => {
    const parsed = await ask('start set at 100 example road');

    expect(parsed.actionBlock?.actions).toEqual([
      { type: 'SET_FIELD', field: 'start', value: '100 example road' },
    ]);
    expect(parsed.confirmationText).toBe('Set the start place to 100 example road.');
  });

  it.each([
    ['can you sstart at 100 Example Road', '100 Example Road'],
    ['can you start at 100 Example Road', '100 Example Road'],
    ['could you set the start address to 100 Example Road', '100 Example Road'],
    ['please starrt at 100 Example Road', '100 Example Road'],
    ['statr at 100 Example Road', '100 Example Road'],
    ['can you set the start adress to 100 Example Road', '100 Example Road'],
    ['can you set the sstarting loction to 100 Example Road', '100 Example Road'],
  ])('treats request-style start prompt "%s" as a start endpoint action', async (message, value) => {
    const parsed = await ask(message);

    expect(apiPostMock).not.toHaveBeenCalled();
    expect(parsed.actionBlock?.actions).toEqual([
      { type: 'SET_FIELD', field: 'start', value },
    ]);
    expect(parsed.confirmationText).toBe(`Set the start place to ${value}.`);
  });

  it.each([
    ['can you set destinaton to Austin', 'Austin, TX'],
    ['set final destnation to Austin', 'Austin, TX'],
    ['destinationn is Austin', 'Austin, TX'],
  ])('treats typo-heavy destination prompt "%s" as an end endpoint action', async (message, value) => {
    const parsed = await ask(message);

    expect(apiPostMock).not.toHaveBeenCalled();
    expect(parsed.actionBlock?.actions).toEqual([
      { type: 'SET_FIELD', field: 'end', value },
    ]);
    expect(parsed.confirmationText).toBe(`Set the end place to ${value}.`);
  });

  it.each([
    ['strt actully 200 Sample Ave', { type: 'SET_FIELD', field: 'start', value: '200 Sample Ave' }, 'Set the start place to 200 Sample Ave.'],
    ['maxx budgte 400', { type: 'SET_FIELD', field: 'budget_max', value: 400 }, 'Set the max trip budget to $400.'],
    ['wether fr Dallas', null, 'I can check weather'],
    ['find cheep diesel gas', { type: 'SET_FIELD', field: 'fuel_type', value: 'diesel' }, 'Checking nearby fuel options'],
  ])('normalizes noisy planner prompt "%s"', async (message, firstAction, confirmation) => {
    const parsed = await ask(message, {
      start: 'Dallas',
      end: 'Austin',
    });

    if (firstAction) {
      expect(parsed.actionBlock?.actions[0]).toEqual(firstAction);
    } else {
      expect(parsed.actionBlock).toBeNull();
    }
    expect(parsed.confirmationText).toContain(confirmation);
  });

  it.each([
    ['START!!! 100 EXAMPLE ROAD', { type: 'SET_FIELD', field: 'start', value: '100 EXAMPLE ROAD' }],
    ['strt   actully,,, 200 Sample Ave', { type: 'SET_FIELD', field: 'start', value: '200 Sample Ave' }],
    ['DESTNATION IS ACTULLY Austin!!!', { type: 'SET_FIELD', field: 'end', value: 'Austin, TX' }],
    ['budgte ceiling $700!!!', { type: 'SET_FIELD', field: 'budget_max', value: 700 }],
    ['party ov 4!!!', { type: 'SET_FIELD', field: 'party_size', value: 4 }],
    ['make it CHILL!!! pace', { type: 'SET_FIELD', field: 'pace', value: 'relaxed' }],
    ['find cheep diesel within 10 mi', { type: 'SET_FIELD', field: 'fuel_type', value: 'diesel' }],
    ['wether fr Dallas???', null],
  ])('handles perturbed prompt "%s"', async (message, firstAction) => {
    const parsed = await ask(message, {
      start: 'Dallas',
      end: 'Austin',
    });

    if (firstAction) {
      expect(parsed.actionBlock?.actions[0]).toEqual(firstAction);
    } else {
      expect(parsed.actionBlock).toBeNull();
      expect(parsed.confirmationText).toContain('existing weather lookup');
    }
  });

  it('treats plain start and end commands as deterministic local mutations', async () => {
    const start = await ask('START 100 EXAMPLE ROAD');
    expect(apiPostMock).not.toHaveBeenCalled();
    expect(start.actionBlock?.actions).toEqual([
      { type: 'SET_FIELD', field: 'start', value: '100 EXAMPLE ROAD' },
    ]);

    const end = await ask('end Dallas');
    expect(apiPostMock).not.toHaveBeenCalled();
    expect(end.actionBlock?.actions).toEqual([
      { type: 'SET_FIELD', field: 'end', value: 'Dallas, TX' },
    ]);
  });

  it('applies route brief prompts with endpoints, budget, and travelers together', async () => {
    const parsed = await ask('plan a trip from Dallas to Austin under 500 with 2 travelers');

    expect(apiPostMock).not.toHaveBeenCalled();
    expect(parsed.actionBlock?.actions).toEqual([
      { type: 'SET_FIELD', field: 'start', value: 'Dallas, TX' },
      { type: 'SET_FIELD', field: 'end', value: 'Austin, TX' },
      { type: 'SET_FIELD', field: 'budget_max', value: 500 },
      { type: 'SET_FIELD', field: 'party_size', value: 2 },
    ]);
    expect(parsed.confirmationText).toBe('Set route endpoints to Dallas, TX and Austin, TX, max budget to $500, travel party to 2 travelers.');
  });

  it.each([
    ['START ACTUALLY 200 SAMPLE AVE', '200 SAMPLE AVE'],
    ['start is actually 200 Sample Ave', '200 Sample Ave'],
    ['no, start should be 200 Sample Ave', '200 Sample Ave'],
    ['change start from 100 Example Road to 200 Sample Ave', '200 Sample Ave'],
    ['replace start with 200 Sample Ave', '200 Sample Ave'],
    ['use 200 Sample Ave as the start', '200 Sample Ave'],
    ['start not 100 Example Road, 200 Sample Ave', '200 Sample Ave'],
  ])('cleans correction filler from start command "%s"', async (message, value) => {
    const parsed = await ask(message, {
      start: '100 Example Road, Example City, Texas 11111, United States',
    });

    expect(parsed.actionBlock?.actions).toEqual([
      { type: 'SET_FIELD', field: 'start', value },
    ]);
    expect(parsed.confirmationText).toBe(`Set the start place to ${value}.`);
  });

  it.each([
    ['END ACTUALLY 200 SAMPLE AVE', '200 SAMPLE AVE'],
    ['destination is actually Austin', 'Austin, TX'],
    ['change final destination from Dallas to Austin', 'Austin, TX'],
    ['replace destination with Austin', 'Austin, TX'],
    ['use Austin as the final destination', 'Austin, TX'],
  ])('cleans correction filler from end command "%s"', async (message, value) => {
    const parsed = await ask(message, {
      end: 'Dallas',
    });

    expect(parsed.actionBlock?.actions).toEqual([
      { type: 'SET_FIELD', field: 'end', value },
    ]);
    expect(parsed.confirmationText).toBe(`Set the end place to ${value}.`);
  });

  it.each([
    'Help me choose an end point from E1500 Road, Hollis',
    'Help me choose an endpoint from Fort Worth',
    'Pick a destination from E1500 Road, Hollis',
    'Where should I end from E1500 Road, Hollis',
  ])('keeps endpoint recommendation "%s" out of raw start/end setters', async (message) => {
    const parsed = await ask(message);

    expect(parsed.actionBlock).toBeNull();
    expect(parsed.confirmationText).toContain('suggest endpoint ideas');
    expect(parsed.confirmationText).not.toContain('Set the start place');
  });

  it('keeps start-city vibe recommendations out of raw start address setters', async () => {
    const parsed = await ask('Pick a start city for a nightlife, culture, food, and scenic trip');

    expect(apiPostMock).not.toHaveBeenCalled();
    expect(parsed.actionBlock).toBeNull();
    expect(parsed.confirmationText).toContain('need one real anchor');
    expect(parsed.confirmationText).not.toContain('Set the start place');
    expect(parsed.confirmationText).not.toContain('possible matches');
  });

  it.each([
    ['7621 devver drive', '7621 devver drive'],
    ['no like 7621 deaver drive', '7621 deaver drive'],
  ])('treats bare street-address prompt "%s" as a fresh start candidate when start is blank', async (message, value) => {
    const parsed = await ask(message);

    expect(apiPostMock).not.toHaveBeenCalled();
    expect(parsed.actionBlock?.actions).toEqual([
      { type: 'SET_FIELD', field: 'start', value },
    ]);
    expect(parsed.confirmationText).toBe(`Set the start place to ${value}.`);
  });

  it('still sets both route endpoints for explicit from-to route commands', async () => {
    const parsed = await ask('from Fort Worth to Austin');

    expect(parsed.actionBlock?.actions).toEqual([
      { type: 'SET_FIELD', field: 'start', value: 'Fort Worth, TX' },
      { type: 'SET_FIELD', field: 'end', value: 'Austin, TX' },
    ]);
  });

  it('still sets a start for explicit start-from commands', async () => {
    const parsed = await ask('start from Fort Worth');

    expect(parsed.actionBlock?.actions).toEqual([
      { type: 'SET_FIELD', field: 'start', value: 'Fort Worth, TX' },
    ]);
  });

  it('still sets an end for explicit end commands', async () => {
    const parsed = await ask('set end to Austin');

    expect(parsed.actionBlock?.actions).toEqual([
      { type: 'SET_FIELD', field: 'end', value: 'Austin, TX' },
    ]);
  });

  it('uses existing start state for practical endpoint requests instead of asking for start again', async () => {
    const parsed = await ask('Find practical endpoints', {
      start: 'E1500 Road, Hollis',
      end: null,
      stops: [],
    });

    expect(parsed.actionBlock).toBeNull();
    expect(parsed.confirmationText).toContain('suggest endpoint ideas from the current start place');
    expect(parsed.confirmationText).not.toContain('Tell me a start');
  });

  it('treats natural destination wording as an endpoint recommendation instead of a route-status fallback', async () => {
    const parsed = await ask('whats a good place to go to', {
      start: '7621 Deaver Drive, North Richland Hills',
      end: null,
      stops: [],
    });

    expect(parsed.actionBlock).toBeNull();
    expect(parsed.confirmationText).toContain('suggest endpoint ideas from the current start place');
    expect(parsed.confirmationText).not.toContain('cannot confidently answer');
    expect(parsed.confirmationText).not.toContain('I already have the start');
  });

  it('keeps built-in verified-stop chips actionable', async () => {
    const parsed = await ask('Find verified stops', {
      start: '7621 Deaver Drive, North Richland Hills',
      end: null,
      stops: [],
    });

    expect(parsed.actionBlock?.actions).toEqual([
      { type: 'SEARCH_NEARBY_PLACES', radius_km: 10, limit: 6 },
    ]);
    expect(parsed.confirmationText).toContain('provider-backed stop options');
    expect(parsed.confirmationText).not.toContain('cannot confidently answer');
  });

  it('clears endpoints from direct remove commands instead of refusing', async () => {
    const parsed = await ask('remove the start', {
      start: '7621 Deaver Drive, North Richland Hills',
      end: null,
      stops: [],
    });

    expect(parsed.actionBlock?.actions).toEqual([
      { type: 'CLEAR_FIELD', field: 'start' },
    ]);
    expect(parsed.confirmationText).toBe('Removed the start place from the planner.');
    expect(parsed.confirmationText).not.toContain('cannot confidently answer');
  });

  it('clears the start from conversational nevermind wording', async () => {
    const parsed = await ask('nevermind can you remove that start', {
      start: '7621 Beach Blvd, Buena Park, California',
      end: null,
      stops: [],
    });

    expect(parsed.actionBlock?.actions).toEqual([
      { type: 'CLEAR_FIELD', field: 'start' },
    ]);
    expect(parsed.confirmationText).toBe('Removed the start place from the planner.');
    expect(parsed.confirmationText).not.toContain('I already have the start');
  });

  it.each([
    ['save this', { type: 'SAVE_TRIP_DRAFT' }, 'Saving this trip draft.'],
    ['svae this', { type: 'SAVE_TRIP_DRAFT' }, 'Saving this trip draft.'],
    ['yo can you save it for me', { type: 'SAVE_TRIP_DRAFT' }, 'Saving this trip draft.'],
    ['share this trip', { type: 'OPEN_SHARE_MODAL' }, 'Opening sharing for this trip draft.'],
    ['shrae this trip', { type: 'OPEN_SHARE_MODAL' }, 'Opening sharing for this trip draft.'],
    ['hey open the invite panel', { type: 'OPEN_SHARE_MODAL' }, 'Opening sharing for this trip draft.'],
    ['share panel', { type: 'OPEN_SHARE_MODAL' }, 'Opening sharing for this trip draft.'],
    ['make public', { type: 'SET_TRIP_VISIBILITY', is_public: true }, 'Making this trip public.'],
    ['make pubilc', { type: 'SET_TRIP_VISIBILITY', is_public: true }, 'Making this trip public.'],
    ['yo public this route', { type: 'SET_TRIP_VISIBILITY', is_public: true }, 'Making this trip public.'],
    ['publish it', { type: 'SET_TRIP_VISIBILITY', is_public: true }, 'Making this trip public.'],
    ['make private', { type: 'SET_TRIP_VISIBILITY', is_public: false }, 'Making this trip private.'],
    ['make privte', { type: 'SET_TRIP_VISIBILITY', is_public: false }, 'Making this trip private.'],
    ['make prvate', { type: 'SET_TRIP_VISIBILITY', is_public: false }, 'Making this trip private.'],
    ['route private only', { type: 'SET_TRIP_VISIBILITY', is_public: false }, 'Making this trip private.'],
    ['make it crew only', { type: 'SET_TRIP_VISIBILITY', is_public: false }, 'Making this trip private.'],
    ['unpublish it', { type: 'SET_TRIP_VISIBILITY', is_public: false }, 'Making this trip private.'],
    ['publsh it', { type: 'SET_TRIP_VISIBILITY', is_public: true }, 'Making this trip public.'],
    ['confirm delete', { type: 'DELETE_TRIP_DRAFT' }, 'Confirmed delete request.'],
    ['cnfirm delete', { type: 'DELETE_TRIP_DRAFT' }, 'Confirmed delete request.'],
    ['yes delete', { type: 'DELETE_TRIP_DRAFT' }, 'Confirmed delete request.'],
    ['delete this draft', { type: 'REQUEST_DELETE_TRIP_DRAFT' }, 'I can delete this trip draft'],
    ['delte this draft', { type: 'REQUEST_DELETE_TRIP_DRAFT' }, 'I can delete this trip draft'],
    ['trip delete this pls', { type: 'REQUEST_DELETE_TRIP_DRAFT' }, 'I can delete this trip draft'],
    ['start clear it', { type: 'CLEAR_FIELD', field: 'start' }, 'Removed the start place from the planner.'],
    ['destination delete', { type: 'CLEAR_FIELD', field: 'end' }, 'Removed the final destination from the planner.'],
    ['renmae this trip to Dallas Weekend', { type: 'SET_FIELD', field: 'title', value: 'Dallas Weekend' }, 'Renamed the trip to Dallas Weekend.'],
    ['trip title Dallas Food Weekend', { type: 'SET_FIELD', field: 'title', value: 'Dallas Food Weekend' }, 'Renamed the trip to Dallas Food Weekend.'],
    ['zoom in', { type: 'SET_MAP_COMMAND', command: 'zoom_in' }, 'Zooming the planner map in.'],
    ['zoom out a little', { type: 'SET_MAP_COMMAND', command: 'zoom_out' }, 'Zooming the planner map out.'],
    ['zoom dallas texas', { type: 'SET_MAP_COMMAND', command: 'zoom_to_place', query: 'dallas texas' }, 'Zooming the planner map to dallas texas.'],
    ['zoom into texas', { type: 'SET_MAP_COMMAND', command: 'zoom_to_place', query: 'texas' }, 'Zooming the planner map to texas.'],
    ['zoom in dallas texas', { type: 'SET_MAP_COMMAND', command: 'zoom_to_place', query: 'dallas texas' }, 'Zooming the planner map to dallas texas.'],
    ['zoomigng in dallas texas', { type: 'SET_MAP_COMMAND', command: 'zoom_to_place', query: 'dallas texas' }, 'Zooming the planner map to dallas texas.'],
    ['zom in dallas tx', { type: 'SET_MAP_COMMAND', command: 'zoom_to_place', query: 'dallas tx' }, 'Zooming the planner map to dallas tx.'],
    ['zoom to TX', { type: 'SET_MAP_COMMAND', command: 'zoom_to_place', query: 'tx' }, 'Zooming the planner map to tx.'],
    ['center map on New York', { type: 'SET_MAP_COMMAND', command: 'zoom_to_place', query: 'new york' }, 'Zooming the planner map to new york.'],
    ['map dallas tx zoom in', { type: 'SET_MAP_COMMAND', command: 'zoom_to_place', query: 'dallas tx' }, 'Zooming the planner map to dallas tx.'],
    ['dallas tx map zoom', { type: 'SET_MAP_COMMAND', command: 'zoom_to_place', query: 'dallas tx' }, 'Zooming the planner map to dallas tx.'],
    ['zoom to Dallas TX', { type: 'SET_MAP_COMMAND', command: 'zoom_to_place', query: 'dallas tx' }, 'Zooming the planner map to dallas tx.'],
    ['show California on map', { type: 'SET_MAP_COMMAND', command: 'zoom_to_place', query: 'california' }, 'Zooming the planner map to california.'],
    ['on the map zoom to state of California', { type: 'SET_MAP_COMMAND', command: 'zoom_to_place', query: 'state of california' }, 'Zooming the planner map to state of california.'],
    ['zoom to Tokyo', { type: 'SET_MAP_COMMAND', command: 'zoom_to_place', query: 'tokyo' }, 'Zooming the planner map to tokyo.'],
    ['show Japan', { type: 'SET_MAP_COMMAND', command: 'zoom_to_place', query: 'japan' }, 'Zooming the planner map to japan.'],
    ['map Paris France', { type: 'SET_MAP_COMMAND', command: 'zoom_to_place', query: 'paris france' }, 'Zooming the planner map to paris france.'],
    ['zoom into London UK', { type: 'SET_MAP_COMMAND', command: 'zoom_to_place', query: 'london uk' }, 'Zooming the planner map to london uk.'],
    ['show Australia on the map', { type: 'SET_MAP_COMMAND', command: 'zoom_to_place', query: 'australia' }, 'Zooming the planner map to australia.'],
    ['make map light', { type: 'SET_MAP_COMMAND', command: 'map_style_light' }, 'Switching only the planner map to bright mode.'],
    ['map bright pls', { type: 'SET_MAP_COMMAND', command: 'map_style_light' }, 'Switching only the planner map to bright mode.'],
    ['On map switch to dark mode', { type: 'SET_MAP_COMMAND', command: 'map_style_dark' }, 'Switching only the planner map to dark mode.'],
    ['switch map dark', { type: 'SET_MAP_COMMAND', command: 'map_style_dark' }, 'Switching only the planner map to dark mode.'],
    ['swtich map drak', { type: 'SET_MAP_COMMAND', command: 'map_style_dark' }, 'Switching only the planner map to dark mode.'],
    ['toggel map lite', { type: 'SET_MAP_COMMAND', command: 'map_style_light' }, 'Switching only the planner map to bright mode.'],
    ['map dark pls', { type: 'SET_MAP_COMMAND', command: 'map_style_dark' }, 'Switching only the planner map to dark mode.'],
    ['switch to dark mode on the map', { type: 'SET_MAP_COMMAND', command: 'map_style_dark' }, 'Switching only the planner map to dark mode.'],
    ['reset map', { type: 'SET_MAP_COMMAND', command: 'reset_map' }, 'Resetting the planner map view.'],
    ['route fit map', { type: 'SET_MAP_COMMAND', command: 'fit_route' }, 'Fitting the planner map to the route.'],
    ['zoom to route', { type: 'SET_MAP_COMMAND', command: 'fit_route' }, 'Fitting the planner map to the route.'],
    ['show route on map', { type: 'SET_MAP_COMMAND', command: 'fit_route' }, 'Fitting the planner map to the route.'],
    ['center map on route', { type: 'SET_MAP_COMMAND', command: 'fit_route' }, 'Fitting the planner map to the route.'],
    ['view whole route', { type: 'SET_MAP_COMMAND', command: 'fit_route' }, 'Fitting the planner map to the route.'],
    ['map locate me', { type: 'SET_MAP_COMMAND', command: 'locate_user' }, 'Centering the planner map on your location'],
  ])('returns deterministic trip document or map action for "%s"', async (message, action, confirmation) => {
    const parsed = await ask(message, {
      start: '7621 Beach Blvd, Buena Park, California',
      end: null,
      stops: [],
    });

    expect(parsed.actionBlock?.actions).toEqual([action]);
    expect(parsed.confirmationText).toContain(confirmation);
  });

  it('keeps ambiguous compiler-style command tokens from firing the wrong action', async () => {
    const mapStyle = await ask('switch map dark');
    expect(mapStyle.actionBlock?.actions).toEqual([
      { type: 'SET_MAP_COMMAND', command: 'map_style_dark' },
    ]);
    expect(mapStyle.actionBlock?.actions).not.toEqual([
      { type: 'SET_FIELD', field: 'end', value: 'dark mode' },
    ]);

    const saveGasStop = await ask('save gas stop');
    expect(saveGasStop.actionBlock?.actions).not.toEqual([
      { type: 'SAVE_TRIP_DRAFT' },
    ]);

    const keepInsideBudget = await ask('keep this plan inside budget', { start: 'Dallas', end: 'Austin' });
    expect(keepInsideBudget.actionBlock?.actions).not.toEqual([
      { type: 'SAVE_TRIP_DRAFT' },
    ]);
    expect(keepInsideBudget.confirmationText).not.toContain('Saving this trip draft');

    const keepPrivate = await ask('keep it private');
    expect(keepPrivate.actionBlock?.actions).toEqual([
      { type: 'SET_TRIP_VISIBILITY', is_public: false },
    ]);

    const deleteDestination = await ask('delete destination', { end: 'Austin' });
    expect(deleteDestination.actionBlock?.actions).toEqual([
      { type: 'CLEAR_FIELD', field: 'end' },
    ]);

    const sharePanel = await ask('share panel');
    expect(sharePanel.actionBlock?.actions).toEqual([
      { type: 'OPEN_SHARE_MODAL' },
    ]);

    const clearRoute = await ask('clear route', { start: 'Dallas', end: 'Austin' });
    expect(clearRoute.actionBlock).toBeNull();
    expect(clearRoute.confirmationText).toContain('I will not guess');
    expect(clearRoute.confirmationText).toContain('delete this draft');

    const resetRoute = await ask('reset route', { start: 'Dallas', end: 'Austin' });
    expect(resetRoute.actionBlock).toBeNull();
    expect(resetRoute.confirmationText).toContain('I will not guess');

    const deleteRoute = await ask('delete route', { start: 'Dallas', end: 'Austin' });
    expect(deleteRoute.actionBlock?.actions).toEqual([
      { type: 'REQUEST_DELETE_TRIP_DRAFT' },
    ]);
  });

  it('applies verified mixed document and map commands without letting the first intent steal the rest', async () => {
    const privateAndFit = await ask('make private and fit route', { start: 'Dallas', end: 'Austin' });
    expect(privateAndFit.actionBlock?.actions).toEqual([
      { type: 'SET_TRIP_VISIBILITY', is_public: false },
      { type: 'SET_MAP_COMMAND', command: 'fit_route' },
    ]);
    expect(privateAndFit.confirmationText).toContain('multiple planner updates');

    const renameAndPublish = await ask('rename this trip to Dallas Weekend and make public');
    expect(renameAndPublish.actionBlock?.actions).toEqual([
      { type: 'SET_FIELD', field: 'title', value: 'Dallas Weekend' },
      { type: 'SET_TRIP_VISIBILITY', is_public: true },
    ]);

    const inviteAndPrivate = await ask('share with john@example.com as viewer and make private');
    expect(inviteAndPrivate.actionBlock?.actions).toEqual([
      { type: 'INVITE_TRIP_MEMBER', recipient: 'john@example.com', role: 'viewer' },
      { type: 'SET_TRIP_VISIBILITY', is_public: false },
    ]);

    const clearDestinationAndPrivate = await ask('delete destination and make private', { end: 'Austin' });
    expect(clearDestinationAndPrivate.actionBlock?.actions).toEqual([
      { type: 'CLEAR_FIELD', field: 'end' },
      { type: 'SET_TRIP_VISIBILITY', is_public: false },
    ]);
  });

  it('combines safe mixed commands for save, share, rename, visibility, route cleanup, and fuel lookup', async () => {
    const saveShareRename = await ask('save this trip and share panel and rename this trip to Hill Country Loop');
    expect(saveShareRename.actionBlock?.actions).toEqual([
      { type: 'SAVE_TRIP_DRAFT' },
      { type: 'OPEN_SHARE_MODAL' },
      { type: 'SET_FIELD', field: 'title', value: 'Hill Country Loop' },
    ]);

    const fuelAndNearby = await ask('find premium gas within 50 mi and show coffee spots nearby', {
      start: 'Dallas',
      end: 'Austin',
    });
    expect(fuelAndNearby.actionBlock?.actions).toEqual([
      { type: 'SET_FIELD', field: 'fuel_type', value: 'premium' },
      { type: 'SEARCH_NEARBY_FUEL', sort_by: 'closest', radius_km: 80, limit: 5 },
      { type: 'SEARCH_NEARBY_PLACES', category: 'coffee', radius_km: 10, limit: 6 },
    ]);

    const ambiguousClear = await ask('clear route and make public', { start: 'Dallas', end: 'Austin' });
    expect(ambiguousClear.actionBlock?.actions).toEqual([
      { type: 'SET_TRIP_VISIBILITY', is_public: true },
    ]);
    expect(ambiguousClear.confirmationText).toContain('ambiguous route clear left unchanged');
  });

  it('keeps delete safety strict inside mixed commands', async () => {
    const parsed = await ask('confirm delete and make public', { start: 'Dallas', end: 'Austin' });

    expect(parsed.actionBlock).toBeNull();
    expect(parsed.confirmationText).toContain('send delete requests by themselves');
    expect(parsed.confirmationText).not.toContain('Making this trip public');
  });

  it('asks for an explicit year when a natural-language end date would move before the start', async () => {
    const parsed = await ask('end date May 16', {
      start_date: '2026-05-17',
      date: '2026-05-17',
    });

    expect(parsed.actionBlock).toBeNull();
    expect(parsed.confirmationText).toContain('before the current start date 2026-05-17');
    expect(parsed.confirmationText).toContain('include the year or update the start date first');
  });

  it('parses day-first and two-digit-year date updates without routing them to endpoints', async () => {
    const dayFirst = await ask('end date 18 May', {
      start_date: '2026-05-17',
      date: '2026-05-17',
    });
    expect(dayFirst.actionBlock?.actions).toEqual([
      { type: 'SET_FIELD', field: 'end_date', value: '2026-05-18' },
    ]);

    const shortYear = await ask('start date 5/17/27');
    expect(shortYear.actionBlock?.actions).toEqual([
      { type: 'SET_FIELD', field: 'start_date', value: '2027-05-17' },
    ]);
  });

  it('keeps malformed dates unchanged instead of guessing a planner date', async () => {
    const parsed = await ask('set end date 2026-02-30', {
      start_date: '2026-05-17',
      date: '2026-05-17',
    });

    expect(parsed.actionBlock).toBeNull();
    expect(parsed.confirmationText).toContain('could not turn that into a valid trip date');
  });

  it('parses registered member invite commands with explicit roles', async () => {
    const parsed = await ask('share with john@example.com as viewer');

    expect(parsed.actionBlock?.actions).toEqual([
      { type: 'INVITE_TRIP_MEMBER', recipient: 'john@example.com', role: 'viewer' },
    ]);
    expect(parsed.confirmationText).toContain('Inviting john@example.com as a viewer');
  });

  it.each([
    ['share john@example.com viewer', 'john@example.com'],
    ['john@example.com share viewer', 'john@example.com'],
    ['share john@example.com viwer', 'john@example.com'],
    ['invite @maya viewer', '@maya'],
  ])('parses invite recipients from keyword-style wording "%s"', async (message, recipient) => {
    const parsed = await ask(message);

    expect(parsed.actionBlock?.actions).toEqual([
      { type: 'INVITE_TRIP_MEMBER', recipient, role: 'viewer' },
    ]);
    expect(parsed.confirmationText).toContain(`Inviting ${recipient} as a viewer`);
  });

  it('asks for a concrete registered member when an invite recipient is missing', async () => {
    const parsed = await ask('invite a friend');

    expect(parsed.actionBlock).toBeNull();
    expect(parsed.confirmationText).toContain('registered Scope username');
  });

  it.each([
    ['relaxed pace', { type: 'SET_FIELD', field: 'pace', value: 'relaxed' }, 'Set the trip pace to relaxed.'],
    ['make it balanced', { type: 'SET_FIELD', field: 'pace', value: 'standard' }, 'Set the trip pace to moderate.'],
    ['packed trip', { type: 'SET_FIELD', field: 'pace', value: 'packed' }, 'Set the trip pace to packed.'],
    ['vibe food scenic nightlife', { type: 'SET_FIELD', field: 'theme', value: ['food', 'scenic', 'nightlife'] }, 'Set the trip vibe to food, scenic, nightlife.'],
    ['gas price is 3.45', { type: 'SET_FIELD', field: 'gas_price', value: 3.45 }, 'Set gas price to $3.45 per gallon.'],
  ])('handles broad planner setting command "%s"', async (message, action, confirmation) => {
    const parsed = await ask(message);

    expect(parsed.actionBlock?.actions).toEqual([action]);
    expect(parsed.confirmationText).toBe(confirmation);
  });

  it('routes nearby, fuel, weather, packing, and status prompts through local state-aware behavior', async () => {
    const nearby = await ask('Find nightlife stops near the route', { start: 'Dallas', end: 'Austin' });
    expect(nearby.actionBlock?.actions).toEqual([
      { type: 'SEARCH_NEARBY_PLACES', category: 'nightlife', radius_km: 10, limit: 6 },
    ]);

    const fuel = await ask('Find nearest gas within 20 mi', { start: 'Dallas' });
    expect(fuel.actionBlock?.actions).toEqual([
      { type: 'SEARCH_NEARBY_FUEL', sort_by: 'closest', radius_km: 32, limit: 5 },
    ]);

    const diesel = await ask('find cheapest diesel within 20 miles', { start: 'Dallas' });
    expect(diesel.actionBlock?.actions).toEqual([
      { type: 'SET_FIELD', field: 'fuel_type', value: 'diesel' },
      { type: 'SEARCH_NEARBY_FUEL', sort_by: 'best_price', radius_km: 32, limit: 5 },
    ]);

    const keywordNearby = await ask('nearby food route show', { start: 'Dallas', end: 'Austin' });
    expect(keywordNearby.actionBlock?.actions).toEqual([
      { type: 'SEARCH_NEARBY_PLACES', category: 'food', radius_km: 10, limit: 6 },
    ]);

    const bestPlaces = await ask('best places around here', { start: 'Dallas' });
    expect(bestPlaces.actionBlock?.actions).toEqual([
      { type: 'SEARCH_NEARBY_PLACES', radius_km: 10, limit: 6 },
    ]);

    const researchNearStart = await ask('research near the start', { start: 'Dallas' });
    expect(researchNearStart.actionBlock?.actions).toEqual([
      { type: 'SEARCH_NEARBY_PLACES', radius_km: 10, limit: 6 },
    ]);

    const goodAroundRoute = await ask("what's good around the route", { start: 'Dallas', end: 'Austin' });
    expect(goodAroundRoute.actionBlock?.actions).toEqual([
      { type: 'SEARCH_NEARBY_PLACES', radius_km: 10, limit: 6 },
    ]);

    const showMorePlaces = await ask('show more places', { start: 'Dallas' });
    expect(showMorePlaces.actionBlock?.actions).toEqual([
      { type: 'SEARCH_NEARBY_PLACES', radius_km: 10, limit: 6 },
    ]);

    const weather = await ask('weather for this route', { start: 'Dallas', end: 'Austin' });
    expect(weather.actionBlock).toBeNull();
    expect(weather.confirmationText).toContain('existing weather lookup');

    const packing = await ask('what should I pack?', { theme: ['scenic'], pace: 'packed' });
    expect(packing.actionBlock).toBeNull();
    expect(packing.confirmationText).toContain('Driver license and registration');

    const status = await ask('what should I do next?', { start: 'Dallas', end: 'Austin', budget_max: 400 });
    expect(status.confirmationText).toContain('I have the route from Dallas to Austin');
    expect(status.confirmationText).not.toContain('Tell me a start');

    const keywordBuild = await ask('route itinerary buidl pls', { start: 'Dallas', end: 'Austin' });
    expect(keywordBuild.actionBlock).toBeNull();
    expect(keywordBuild.confirmationText).toContain('Ready to build from the current planner state');

    const keywordStatus = await ask('planner current state', { start: 'Dallas', end: 'Austin' });
    expect(keywordStatus.actionBlock).toBeNull();
    expect(keywordStatus.confirmationText).toContain('Route status: Dallas to Austin');
  });

  it('adapts route-status guidance to partial and blank planner routes', async () => {
    const startOnly = await ask('what should I do next?', {
      start: 'Dallas',
      start_date: '2026-05-17',
      budget_max: 900,
      pace: 'standard',
      stops: [{ id: 'bbq', title: 'BBQ stop' }],
    });
    expect(startOnly.confirmationText).toContain('I already have the start as Dallas');
    expect(startOnly.confirmationText).toContain('2026-05-17 to end date not set');
    expect(startOnly.confirmationText).toContain('up to $900');
    expect(startOnly.chips).toContain('Find practical endpoints');

    const endOnly = await ask('route status please', {
      end: 'Austin',
      end_date: '2026-05-19',
      pace: 'relaxed',
    });
    expect(endOnly.confirmationText).toContain('I already have the final destination as Austin');
    expect(endOnly.chips).toContain('Add a start place');

    const blank = await ask('planner current state');
    expect(blank.confirmationText).toContain('I do not have route endpoints yet');
    expect(blank.chips).toContain('Help me choose an endpoint');
  });

  it('maps route-aware nearby category prompts and fuel type commands without backend guessing', async () => {
    const categoryCases: Array<[string, string]> = [
      ['Find coffee near the route', 'coffee'],
      ['Find restrooms near the route', 'restrooms'],
      ['Show shopping stops nearby', 'shopping'],
      ['Find bowling near the route', 'entertainment'],
      ['Find scenic photo stops on the way', 'scenic'],
      ['Find parks and trails around the route', 'outdoors'],
    ];

    for (const [message, category] of categoryCases) {
      const parsed = await ask(message, { start: 'Dallas', end: 'Austin' });
      expect(parsed.actionBlock?.actions).toEqual([
        { type: 'SEARCH_NEARBY_PLACES', category, radius_km: 10, limit: 6 },
      ]);
    }

    const fuelCases: Array<[string, string]> = [
      ['set fuel to midgrade', 'midgrade'],
      ['set fuel to premium', 'premium'],
      ['set fuel to regular gas', 'regular'],
      ['set fuel to electric car', 'ev'],
    ];

    for (const [message, fuelType] of fuelCases) {
      const parsed = await ask(message);
      expect(parsed.actionBlock?.actions).toEqual([
        { type: 'SET_FIELD', field: 'fuel_type', value: fuelType },
      ]);
    }
  });

  it('covers local utility commands for undo, start help, packing, vehicle settings, and route guidance', async () => {
    const undo = await ask('undo that change');
    expect(undo.actionBlock?.actions).toEqual([{ type: 'UNDO' }]);
    expect(undo.confirmationText).toContain('Undid the last Scope AI planner change');

    const startHelp = await ask('how do I add a start place');
    expect(startHelp.actionBlock).toBeNull();
    expect(startHelp.confirmationText).toContain('type it into the Start city');

    const addPacking = await ask('add rain jacket to packing');
    expect(addPacking.actionBlock?.actions).toEqual([
      { type: 'ADD_PACKING_ITEM', label: 'rain jacket' },
    ]);

    const removePacking = await ask('remove rain jacket from packing list');
    expect(removePacking.actionBlock?.actions).toEqual([
      { type: 'REMOVE_PACKING_ITEM', item_id: 'rain jacket' },
    ]);

    const mpg = await ask('set vehicle to 34 mpg');
    expect(mpg.actionBlock?.actions).toEqual([
      { type: 'SET_FIELD', field: 'mpg', value: 34 },
    ]);

    const buildMissing = await ask('build itinerary please', { start: 'Dallas' });
    expect(buildMissing.actionBlock).toBeNull();
    expect(buildMissing.confirmationText).toContain('I can build once the route has enough shape');
    expect(buildMissing.confirmationText).toContain('I already have the start as Dallas');

    const tightenPartial = await ask('tighten this route', { end: 'Austin' });
    expect(tightenPartial.actionBlock).toBeNull();
    expect(tightenPartial.confirmationText).toContain('I will tighten against the route state I already have');

    const helpBlank = await ask('what can you do');
    expect(helpBlank.actionBlock).toBeNull();
    expect(helpBlank.confirmationText).toContain('I can also handle budget, dates, travelers');
  });

  it('keeps local fallbacks for invalid dates, route-aware stale backend text, and unavailable image vision', async () => {
    const impossibleDate = await ask('set end date 2026-02-30', {
      start_date: '2026-05-17',
      date: '2026-05-17',
    });
    expect(impossibleDate.actionBlock).toBeNull();
    expect(impossibleDate.confirmationText).toContain('could not turn that into a valid trip date');

    apiPostMock.mockResolvedValueOnce({
      data: {
        response: 'Please add your start and finish before I can help.',
        model: 'stale-backend',
      },
    });
    const stale = await ask('give me ideas for this route', { start: 'Dallas' });
    expect(stale.confirmationText).toContain('I already have the start as Dallas');
    expect(stale.confirmationText).not.toContain('Please add your start and finish');

    apiPostMock.mockRejectedValueOnce(new Error('vision offline'));
    const image = await callScopeAi({
      ...baseInput,
      message: 'inspect this attached image for the trip',
      images: [{
        filename: 'stop.png',
        mime_type: 'image/png',
        data: 'YXRsYXM=',
      }],
    });
    expect(image.model).toBe('scope-ai-vision-unavailable');
    expect(image.responseText).toContain('could not inspect the attached image');
  });
});
