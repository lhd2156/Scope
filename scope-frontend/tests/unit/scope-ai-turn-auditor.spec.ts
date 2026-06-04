import { auditScopeAiTurn, type ScopeAiAuditableMessage } from '@/services/scopeAiTurnAuditor';
import { containsUnsafeScopeAiText, sanitizeScopeAiProviderQuery, sanitizeScopeAiVisibleText } from '@/services/scopeAiSafety';

describe('scope AI turn auditor', () => {
  const planner = {
    start: 'Fort Worth, Texas, United States',
    end: 'Austin, Texas, United States',
    stopCount: 1,
    budgetMax: 900,
    startDate: '2026-05-17',
    endDate: '2026-05-18',
    pace: 'relaxed',
    stateSignature: 'fw-austin',
  };

  function text(content: string, chips?: string[], model?: string): ScopeAiAuditableMessage {
    return {
      id: 'assistant-test',
      role: 'assistant',
      kind: 'text',
      content,
      ...(model ? { model } : {}),
      ...(chips ? { chips } : {}),
    };
  }

  function unsafeTerm(codes: number[]): string {
    return String.fromCharCode(...codes);
  }

  it('rejects stale route requests when the planner already has route state', () => {
    const audit = auditScopeAiTurn(text('Tell me a start, end, and budget and I can help plan this trip.'), {
      userPrompt: 'any ideas?',
      planner,
    });

    expect(audit.approved).toBe(false);
    expect(audit.reasons).toContain('asked_for_known_route_piece');
    expect(audit.message.content).toContain('I have the route from Fort Worth');
    expect(audit.message.content).not.toContain('Tell me a start');
  });

  it('rejects unsupported weather and fuel claims without provider proof', () => {
    const weather = auditScopeAiTurn(text('Weather for Austin is sunny, 80F, with light wind.'), {
      userPrompt: 'what about this route?',
      planner,
    });
    const fuel = auditScopeAiTurn(text('Gas is $2.11/gal near Austin.'), {
      userPrompt: 'what about this route?',
      planner,
    });

    expect(weather.approved).toBe(false);
    expect(weather.reasons).toContain('unsupported_weather_claim');
    expect(fuel.approved).toBe(false);
    expect(fuel.reasons).toContain('unsupported_fuel_claim');
  });

  it('approves provider-backed weather and fuel replies', () => {
    const weather = auditScopeAiTurn(text('Austin: 72F, Partly Cloudy, 9 mph wind.', undefined, 'scope-weather-provider'), {
      userPrompt: 'weather for Austin',
      planner,
    });
    const fuel = auditScopeAiTurn(text('Fuel near Austin:\n1. Matrix Fuel - $3.12/gal, 1.0 km away\nFuel source: configured fuel lookup.'), {
      userPrompt: 'fuel nearby',
      planner,
    });

    expect(weather.approved).toBe(true);
    expect(fuel.approved).toBe(true);
  });

  it('dedupes chips and place cards by stable keys', () => {
    const audit = auditScopeAiTurn({
      id: 'places-test',
      role: 'assistant',
      kind: 'places',
      content: 'I found endpoint ideas.',
      queryLabel: 'Endpoint ideas',
      results: [
        {
          id: 'quartz',
          placeName: 'Quartz Mountain State Park',
          formattedAddress: '14722 Highway 44A, Lone Wolf, Oklahoma',
          latitude: 34.889,
          longitude: -99.303,
          source: 'mapbox',
        },
        {
          id: 'quartz',
          placeName: 'Quartz Mountain State Park',
          formattedAddress: '14722 Highway 44A, Lone Wolf, Oklahoma',
          latitude: 34.889,
          longitude: -99.303,
          source: 'mapbox',
        },
      ],
    }, {
      userPrompt: 'find endpoints',
      planner,
    });
    const chips = auditScopeAiTurn(text('Ready.', ['Build', 'Build ', 'Check route status']), {
      userPrompt: 'status',
      planner,
    });

    expect(audit.approved).toBe(false);
    expect(audit.reasons).toContain('deduped_place_results');
    if (audit.message.kind !== 'places') {
      throw new Error('expected places');
    }
    expect(audit.message.results).toHaveLength(1);
    expect(chips.message.kind).toBe('text');
    if (chips.message.kind === 'text') {
      expect(chips.message.chips).toEqual(['Build', 'Check route status']);
    }
  });

  it('replaces exact duplicate assistant replies only when the user repeats the same prompt without state changes', () => {
    const audit = auditScopeAiTurn(text('Set the max trip budget to $400.'), {
      userPrompt: 'max 400',
      previousUserPrompt: 'max 400',
      planner,
      previousAssistantMessages: [{
        kind: 'text',
        content: 'Set the max trip budget to $400.',
        stateSignature: 'fw-austin',
      }],
    });
    const variant = auditScopeAiTurn(text('Set the max trip budget to $400.'), {
      userPrompt: 'budget ceiling 400',
      previousUserPrompt: 'max 400',
      planner,
      previousAssistantMessages: [{
        kind: 'text',
        content: 'Set the max trip budget to $400.',
        stateSignature: 'fw-austin',
      }],
    });

    expect(audit.approved).toBe(false);
    expect(audit.reasons).toContain('duplicate_assistant_reply');
    expect(audit.message.content).toContain('No new change');
    expect(variant.approved).toBe(true);
  });

  it('redacts unsafe language from visible assistant text, chips, and provider queries', () => {
    const severe = unsafeTerm([110, 105, 103, 103, 101, 114]);
    const prompt = `start 100 Example Road ${severe}`;
    const audit = auditScopeAiTurn(text(`I could not find "${prompt}".`, ['Build', `repeat ${severe}`]), {
      userPrompt: prompt,
      planner,
    });

    expect(containsUnsafeScopeAiText(prompt)).toBe(true);
    expect(sanitizeScopeAiVisibleText(prompt)).toContain('[redacted]');
    expect(sanitizeScopeAiProviderQuery(prompt)).toBe('start 100 Example Road');
    expect(audit.approved).toBe(false);
    expect(audit.reasons).toContain('unsafe_language_redacted');
    expect(audit.message.content).toContain('I will not repeat abusive language');
    expect(audit.message.content).not.toContain(severe);
    if (audit.message.kind === 'text') {
      expect(audit.message.chips?.join(' ')).not.toContain(severe);
    }
  });

  it('redacts unsafe place result fields before cards can render', () => {
    const severe = unsafeTerm([110, 105, 103, 103, 101, 114]);
    const audit = auditScopeAiTurn({
      id: 'places-redaction-test',
      role: 'assistant',
      kind: 'places',
      content: `Endpoint ideas for ${severe}`,
      queryLabel: `Endpoint ideas for ${severe}`,
      results: [{
        id: 'unsafe-result',
        placeName: `Place ${severe}`,
        formattedAddress: `100 Test Road ${severe}`,
        latitude: 32,
        longitude: -97,
      }],
    }, {
      userPrompt: `find endpoint ${severe}`,
      planner,
    });

    expect(audit.approved).toBe(false);
    expect(audit.reasons).toContain('unsafe_language_redacted');
    if (audit.message.kind !== 'places') {
      throw new Error('expected places');
    }
    const visible = [
      audit.message.content,
      audit.message.queryLabel,
      audit.message.results[0]?.placeName,
      audit.message.results[0]?.formattedAddress,
    ].join(' ');
    expect(visible).toContain('[redacted]');
    expect(visible).not.toContain(severe);
  });
});
