import {
  buildPendingLocationAction,
  buildPendingLocationFollowUpQuery,
  cleanupFollowUpQualifier,
  cleanupReplacementLocationQuery,
  extractRadiusKmFromFollowUp,
  extractStateQualifier,
  filterPendingItemsByFollowUp,
  getDistanceFromPendingItem,
  getFuelPriceFromPendingItem,
  inferNearbyCategoryFromFollowUp,
  isExplicitNewScopeAiCommand,
  isPendingFollowUpForContext,
  planPendingScopeAiTurn,
  selectPendingContextItem,
} from '@/components/trips/tripAiPendingContext';
import type { ScopeAiPendingScopeAiContext } from '@/stores/scopeAiPlanner';

function createPendingContext(overrides: Partial<ScopeAiPendingScopeAiContext> = {}): ScopeAiPendingScopeAiContext {
  return {
    kind: 'place-candidates',
    sourcePrompt: 'find museums nearby',
    targetField: 'stop',
    rawValue: 'nearby museums',
    candidates: [{
      id: 'garden',
      label: '1. Botanic Garden',
      value: '3220 Botanic Garden Blvd, Fort Worth, TX',
      source: 'Map search',
      latitude: 32.7495,
      longitude: -97.3621,
      meta: {
        address: '3220 Botanic Garden Blvd',
        category: 'park',
        categoryLabel: 'Park',
        city: 'Fort Worth',
        placeName: 'Botanic Garden',
        reason: 'Scenic stop',
      },
    }],
    results: [{
      id: 'museum',
      label: '2. Modern Art Museum',
      value: '3200 Darnell St, Fort Worth, TX',
      source: 'Map search',
      latitude: 32.7509,
      longitude: -97.363,
      meta: {
        address: '3200 Darnell St',
        category: 'museum',
        categoryLabel: 'Museum',
        city: 'Fort Worth',
        placeName: 'Modern Art Museum',
        reason: 'Culture stop',
      },
    }],
    lastAnswer: 'Pick one.',
    createdAt: Date.now(),
    turnCount: 0,
    ...overrides,
  };
}

describe('tripAiPendingContext', () => {
  it('selects and filters pending context items with the same ordinal and qualifier rules', () => {
    const context = createPendingContext();

    expect(selectPendingContextItem('pick the second', context)).toMatchObject({ id: 'museum' });
    expect(selectPendingContextItem('the one near garden', context)).toMatchObject({ id: 'garden' });
    expect(filterPendingItemsByFollowUp('culture', context)).toEqual([expect.objectContaining({ id: 'museum' })]);
    expect(cleanupFollowUpQualifier('pick the first one in Texas please')).toBe('Texas');
    expect(extractStateQualifier('Fort Worth TX')).toBe('Texas');
  });

  it('builds pending location queries without reviving stale raw prompts', () => {
    expect(cleanupReplacementLocationQuery('actually 3220 Botanic Garden Blvd')).toBe('3220 Botanic Garden Blvd');
    expect(cleanupReplacementLocationQuery('actually Austin')).toBeNull();

    expect(buildPendingLocationFollowUpQuery(
      'in Texas',
      createPendingContext({
        kind: 'location-resolution',
        rawValue: 'Springfield',
      }),
    )).toBe('Springfield Texas');

    expect(buildPendingLocationFollowUpQuery(
      'in Texas',
      createPendingContext({
        kind: 'location-resolution',
        rawValue: 'build a food route',
      }),
    )).toBeNull();
  });

  it('keeps the pending-turn routing decisions equivalent to the inline flow', () => {
    const context = createPendingContext({ kind: 'place-candidates' });

    expect(planPendingScopeAiTurn('first', context)).toEqual({
      startsNewIntent: false,
      isPendingFollowUp: true,
      clearReason: null,
    });
    expect(planPendingScopeAiTurn('set end in Austin', context)).toEqual({
      startsNewIntent: true,
      isPendingFollowUp: false,
      clearReason: 'explicit-new-command',
    });
    expect(planPendingScopeAiTurn('thanks that helps', context)).toEqual({
      startsNewIntent: false,
      isPendingFollowUp: false,
      clearReason: 'pending-context-new-turn',
    });
    expect(isPendingFollowUpForContext('show more', createPendingContext({ kind: 'nearby-results' }))).toBe(true);
    expect(isExplicitNewScopeAiCommand('start over', context)).toBe(true);
  });

  it('parses small pending action details without touching component state', () => {
    expect(buildPendingLocationAction({ targetField: 'stop' }, 'Botanic Garden')).toMatchObject({
      actions: [{ type: 'ADD_STOP', stop: { name: 'Botanic Garden', address: 'Botanic Garden' } }],
    });
    expect(buildPendingLocationAction({ targetField: 'endDestination' }, 'Austin')).toMatchObject({
      actions: [{ type: 'SET_FIELD', field: 'end', value: 'Austin' }],
    });
    expect(extractRadiusKmFromFollowUp('within 5 miles')).toBeCloseTo(8.046, 2);
    expect(extractRadiusKmFromFollowUp('within 3 km')).toBe(3);
    expect(inferNearbyCategoryFromFollowUp('need bowling nearby', 'food')).toBe('entertainment');
    expect(getFuelPriceFromPendingItem({ label: 'Fuel', meta: { pricePerUnit: 3.19 } })).toBe(3.19);
    expect(getDistanceFromPendingItem({ label: 'Fuel', meta: { distanceKm: 4.2 } })).toBe(4.2);
  });
});
