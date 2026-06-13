import { parseScopeAiResponse } from '@/services/scopeAiResponseParser';
import {
  __scopeAiServiceCoverage,
  callScopeAi,
} from '@/services/scopeAiService';

const apiPostMock = vi.hoisted(() => vi.fn());

vi.mock('@/services/api', () => ({
  default: {
    post: apiPostMock,
  },
}));

const plannerState = {
  start: null,
  end: null,
  stops: [],
  pace: 'relaxed',
  theme: [],
};

describe('Scope AI service edge contracts', () => {
  const coverage = __scopeAiServiceCoverage!;

  beforeEach(() => {
    apiPostMock.mockReset();
  });

  it('rejects malformed date tokens and orders a reversed valid range', () => {
    expect(coverage.parseDateToken('2026-02-30', 2026)).toBeNull();
    expect(coverage.parseDateToken('13/40', 2026)).toBeNull();
    expect(coverage.parseDateToken('Notamonth 4', 2026)).toBeNull();
    expect(coverage.parseDateToken('4 Notamonth', 2026)).toBeNull();
    expect(coverage.extractDateTokens('No valid dates here', 2026)).toEqual([]);

    const response = coverage.extractDateCommand(
      'trip dates June 5 to June 1',
      plannerState,
    );
    expect(parseScopeAiResponse(response?.responseText ?? '').actionBlock?.actions).toEqual([
      { type: 'SET_FIELD', field: 'start_date', value: '2026-06-01' },
      { type: 'SET_FIELD', field: 'end_date', value: '2026-06-05' },
    ]);
  });

  it('drops underspecified cleanup targets and preserves valid lexical values', () => {
    expect(coverage.getScopeAiKeywordTokens('')).toEqual(new Set());
    expect(coverage.cleanupKeywordTargetValue('x')).toBeNull();
    expect(coverage.cleanupEndpointCommandValue('x')).toBeNull();
    expect(coverage.cleanupMapTargetQuery('x')).toBeNull();
    expect(coverage.cleanupLocationRecommendationQuery('x')).toBeNull();
    expect(coverage.extractBareAddressStartCommand(
      '100 Main Street',
      { ...plannerState, start: 'Dallas' },
    )).toBeNull();
    expect(coverage.extractEndpointCommand('set start to x', 'start')).toBeNull();
    expect(coverage.isEndpointRecommendationRequest('')).toBe(false);
    expect(coverage.normalizeScopeAiImagePayload([{
      mime_type: 'image/png',
      data: 'data:image/png;base64,YWJjZA==',
    }])).toEqual([{
      mime_type: 'image/png',
      data: 'YWJjZA==',
    }]);
    expect(coverage.extractActionsFromLocalResponse({
      responseText: '```action\n{"actions":"not-an-array"}\n```',
      model: 'edge',
    })).toEqual([]);
  });

  it('recognizes keyword-driven share, save, and map commands without overmatching', () => {
    expect(coverage.isOpenShareCommand('could you launch sharing')).toBe(true);
    expect(coverage.isOpenShareCommand('could you show invite panel')).toBe(true);
    expect(coverage.isOpenShareCommand('invite this')).toBe(true);
    expect(coverage.isSaveTripCommand('keep planner')).toBe(true);

    expect(coverage.extractMapCommand('map route zoom')).toEqual({ command: 'fit_route' });
    expect(coverage.extractMapCommand('zoom farther')).toEqual({ command: 'zoom_out' });
    expect(coverage.extractMapCommand('route whole')).toEqual({ command: 'fit_route' });

    const endOnly = coverage.buildStateAwareNextMove({
      ...plannerState,
      end: 'Austin',
      stops: [{ id: 'stop-1' }],
    });
    expect(endOnly.text).toContain('1 stop.');
    expect(coverage.extractRadiusKm('within 0 km')).toBeNull();
  });

  it('adds map, clear-endpoint, and category-free nearby actions once', () => {
    const actions: object[] = [];
    const confirmations: string[] = [];

    expect(coverage.addParsedPlannerCommandAction(
      coverage.parseScopeAiPlannerCommand('show Dallas on the map'),
      actions,
      confirmations,
    )).toBe(true);
    expect(coverage.addParsedPlannerCommandAction(
      coverage.parseScopeAiPlannerCommand('clear destination'),
      actions,
      confirmations,
    )).toBe(true);
    expect(coverage.addParsedPlannerCommandAction(
      coverage.parseScopeAiPlannerCommand('best places around here'),
      actions,
      confirmations,
    )).toBe(true);

    expect(actions).toEqual(expect.arrayContaining([
      { type: 'SET_MAP_COMMAND', command: 'zoom_to_place', query: 'dallas' },
      { type: 'CLEAR_FIELD', field: 'end' },
      { type: 'SEARCH_NEARBY_PLACES', radius_km: 10, limit: 6 },
    ]));
    expect(confirmations).toEqual(expect.arrayContaining([
      'map command',
      'destination removal',
      'nearby places',
    ]));
  });

  it('renders sparse provider cards using every supported detail fallback', async () => {
    apiPostMock.mockResolvedValueOnce({
      data: {
        response: 'Fresh Dallas ideas.',
        model: 'scope-ai-provider',
        chips: ['Open map', 'Open map', ''],
        place_cards: [
          { title: 'Subtitle Place', subtitle: 'Neighborhood favorite' },
          { title: 'Camel Source Place', sourceLabel: 'Provider verified' },
          { title: 'Snake Source Place', source_label: 'Partner feed' },
          { title: 'Default Detail Place' },
          { title: ' ' },
        ],
      },
    });

    const response = await callScopeAi({
      message: 'Things to do in Dallas this weekend',
      plannerState,
      sessionHistory: [],
      preferences: {},
    });

    expect(response.model).toBe('scope-ai-provider');
    expect(response.responseText).toContain('Subtitle Place - Neighborhood favorite');
    expect(response.responseText).toContain('Camel Source Place - Provider verified');
    expect(response.responseText).toContain('Snake Source Place - Partner feed');
    expect(response.responseText).toContain('Default Detail Place - provider-backed nearby option');
    expect(response.responseText).toContain('CHIPS: ["Open map"]');
  });

  it('keeps parser edge fallbacks bounded for dates, images, map commands, and mixed actions', async () => {
    expect(coverage.parseDateToken('2026-05-17', 2026)).toEqual({
      iso: '2026-05-17',
      explicitYear: true,
    });
    expect(coverage.parseDateToken('5/17/27', 2026)).toEqual({
      iso: '2027-05-17',
      explicitYear: true,
    });
    expect(coverage.parseDateToken('May 17 27', 2026)).toEqual({
      iso: '2027-05-17',
      explicitYear: true,
    });
    expect(coverage.parseDateToken('17 May 2027', 2026)).toEqual({
      iso: '2027-05-17',
      explicitYear: true,
    });
    expect(coverage.extractDateCommand('trip from May 17', plannerState)).toBeNull();
    expect(coverage.extractDateCommand('keep the route flexible', plannerState)).toBeNull();

    expect(coverage.normalizeScopeAiImagePayload([
      { mime_type: 'image/png', data: 'data:image/png;base64,' },
      { mime_type: 'image/jpeg', data: ' cmVjZWlwdA== ' },
    ])).toEqual([
      { mime_type: 'image/jpeg', data: 'cmVjZWlwdA==' },
    ]);

    expect(coverage.extractMapCommand('zoom out')).toEqual({ command: 'zoom_out' });
    expect(coverage.extractMapCommand('open the whole route map')).toEqual({ command: 'fit_route' });
    expect(coverage.extractMapCommand('map mode')).toEqual({ command: 'zoom_to_place', query: 'mode' });
    expect(coverage.cleanupMapTargetQuery('show the map around San Antonio please')).toBe('show the map around San Antonio');
    expect(coverage.extractExplicitLocationRecommendationQuery('best coffee Dallas')).toBe('Dallas');
    expect(coverage.extractExplicitLocationRecommendationQuery('coffee nightlife scenic')).toBeNull();

    const actions: object[] = [];
    const confirmations: string[] = [];
    coverage.addParsedPlannerCommandAction(
      coverage.parseScopeAiPlannerCommand('clear start'),
      actions,
      confirmations,
    );
    coverage.addParsedPlannerCommandAction(
      coverage.parseScopeAiPlannerCommand('clear start'),
      actions,
      confirmations,
    );
    expect(actions).toEqual([{ type: 'CLEAR_FIELD', field: 'start' }]);
    expect(confirmations).toEqual(['start removal']);

    const mixedPrompt = 'budget between $400 and $600 and find cheapest diesel within 20 miles and final destination Austin';
    const mixed = coverage.buildMixedIntentResponse(
      mixedPrompt,
      mixedPrompt.toLowerCase(),
      { ...plannerState, budget_min: 300 },
    );
    const parsedMixed = parseScopeAiResponse(mixed?.responseText ?? '');
    expect(parsedMixed.actionBlock?.actions).toEqual([
      { type: 'SET_FIELD', field: 'budget_max', value: 400 },
      { type: 'SET_FIELD', field: 'fuel_type', value: 'diesel' },
      { type: 'SEARCH_NEARBY_FUEL', sort_by: 'best_price', radius_km: 32, limit: 5 },
      { type: 'SET_FIELD', field: 'end', value: 'Austin, TX' },
    ]);

    apiPostMock.mockResolvedValueOnce({
      data: {
        response: 'Provider-backed Dallas ideas are ready.',
        model: 'scope-ai-provider',
        actions: [{ type: 'SET_FIELD', field: 'budget_max', value: 500 }],
        chips: ['Keep it cheap', 'Keep it cheap', ''],
      },
    });

    const response = await callScopeAi({
      message: 'Compare Dallas lunch options with current provider data',
      plannerState,
      sessionHistory: [],
      preferences: {},
    });

    expect(response.responseText).toContain('```action');
    expect(response.responseText).toContain('CHIPS: ["Keep it cheap"]');
  });

  it('keeps local command fallbacks deterministic for sparse command text', async () => {
    expect(coverage.cleanupKeywordTargetValue(' a ')).toBeNull();
    expect(coverage.cleanupMapTargetQuery('x on the map')).toBeNull();
    expect(coverage.extractMapCommand('map route frame')).toEqual({ command: 'fit_route' });
    expect(coverage.extractMapCommand('zoom further')).toEqual({ command: 'zoom_out' });
    expect(coverage.extractRadiusKm('within 3 km')).toBe(3);
    expect(coverage.extractExplicitLocationRecommendationQuery('best coffee @@@')).toBe('best');

    const mixedFuelPrompt = 'find fuel and set max budget 500';
    const mixedFuel = coverage.buildMixedIntentResponse(
      mixedFuelPrompt,
      mixedFuelPrompt,
      plannerState,
    );
    expect(parseScopeAiResponse(mixedFuel?.responseText ?? '').actionBlock?.actions).toEqual(expect.arrayContaining([
      { type: 'SEARCH_NEARBY_FUEL', sort_by: 'closest', radius_km: 10, limit: 5 },
      { type: 'SET_FIELD', field: 'budget_max', value: 500 },
    ]));

    const mpg = await callScopeAi({
      message: 'mpg 31',
      plannerState,
      sessionHistory: [],
      preferences: {},
    });
    expect(parseScopeAiResponse(mpg.responseText).actionBlock?.actions).toEqual([
      { type: 'SET_FIELD', field: 'mpg', value: 31 },
    ]);

    const gas = await callScopeAi({
      message: 'gas is 3.21',
      plannerState,
      sessionHistory: [],
      preferences: {},
    });
    expect(parseScopeAiResponse(gas.responseText).actionBlock?.actions).toEqual([
      { type: 'SET_FIELD', field: 'gas_price', value: 3.21 },
    ]);

    const fuelFallbackSort = await callScopeAi({
      message: 'find fuel nearby',
      plannerState,
      sessionHistory: [],
      preferences: {},
    });
    expect(parseScopeAiResponse(fuelFallbackSort.responseText).actionBlock?.actions).toEqual([
      { type: 'SEARCH_NEARBY_FUEL', sort_by: 'best_price', radius_km: 10, limit: 5 },
    ]);

    const routeWithBudgetRange = await callScopeAi({
      message: 'from Dallas to Austin with budget 400 to 600 for 3 people',
      plannerState,
      sessionHistory: [],
      preferences: {},
    });
    expect(parseScopeAiResponse(routeWithBudgetRange.responseText).actionBlock?.actions).toEqual([
      { type: 'SET_FIELD', field: 'start', value: 'Dallas, TX' },
      { type: 'SET_FIELD', field: 'end', value: 'Austin, TX' },
      { type: 'SET_FIELD', field: 'budget_min', value: 400 },
      { type: 'SET_FIELD', field: 'budget_max', value: 600 },
      { type: 'SET_FIELD', field: 'party_size', value: 3 },
    ]);

    const routeWithExactBudget = await callScopeAi({
      message: 'from Dallas to Austin with budget at 700',
      plannerState,
      sessionHistory: [],
      preferences: {},
    });
    expect(parseScopeAiResponse(routeWithExactBudget.responseText).actionBlock?.actions).toEqual([
      { type: 'SET_FIELD', field: 'start', value: 'Dallas, TX' },
      { type: 'SET_FIELD', field: 'end', value: 'Austin, TX' },
      { type: 'SET_FIELD', field: 'budget_min', value: 700 },
      { type: 'SET_FIELD', field: 'budget_max', value: 700 },
    ]);

    const blankTighten = await callScopeAi({
      message: 'tighten route',
      plannerState,
      sessionHistory: [],
      preferences: {},
    });
    expect(blankTighten.responseText).toContain('I do not have route endpoints yet');

    apiPostMock.mockResolvedValueOnce({ data: {} });
    const missingBackendResponse = await callScopeAi({
      message: 'Any fun ideas for this route',
      plannerState: {
        ...plannerState,
        start: 'Dallas',
        end: 'Austin',
      },
      sessionHistory: [],
      preferences: {},
    });
    expect(apiPostMock).toHaveBeenCalledTimes(1);
    expect(missingBackendResponse.model).toBe('scope-ai-local');
  });
});
