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
});
