const apiPostMock = vi.hoisted(() => vi.fn());

vi.mock('@/services/api', () => ({
  default: {
    post: apiPostMock,
  },
  isApiClientError: (error: unknown) => (
    typeof error === 'object' &&
    error !== null &&
    ('status' in error || 'isNetworkError' in error)
  ),
}));

describe('agentService', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
    vi.stubEnv('VITE_DEMO_MODE', 'false');
    vi.stubEnv('VITE_ENABLE_AGENT_LOCAL_FALLBACK', 'true');
    apiPostMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns the live agent response when the API succeeds', async () => {
    apiPostMock.mockResolvedValue({
      data: {
        itinerary: 'Live itinerary',
        steps: 3,
        model: 'scope-live',
      },
    });

    const { planTrip } = await import('@/services/agentService');
    const response = await planTrip({
      prompt: 'Plan a quick route',
      start_date: '2026-05-08',
    });

    expect(apiPostMock).toHaveBeenCalledWith('/api/intel/agent/trip-chat', {
      prompt: 'Plan a quick route',
      start_date: '2026-05-08',
      responseMode: 'json',
    }, {
      timeout: 120_000,
    });
    expect(response).toMatchObject({
      itinerary: 'Live itinerary',
      steps: 3,
      model: 'scope-live',
    });
  });

  it('falls back to a local copilot response when the agent API returns 500', async () => {
    apiPostMock.mockRejectedValue({
      status: 500,
      message: 'Request failed with status code 500',
      isNetworkError: false,
    });

    const { planTrip } = await import('@/services/agentService');
    const response = await planTrip({
      prompt: [
        'Help refine this Scope trip draft.',
        '',
        'Current draft:',
        'Start: Oklahoma City, OK',
        'End: Dexter, NM',
        'Dates: 2026-05-08 to 2026-05-10',
        'Budget: $500 - $1,500',
        'Pace: relaxed',
        'Interests: scenic',
        '',
        'Traveler request: Keep this plan inside budget',
      ].join('\n'),
      start_date: '2026-05-08',
    });

    expect(response.model).toBe('scope-local-copilot');
    expect(response.itinerary).toContain('Oklahoma City, OK to Dexter, NM');
    expect(response.itinerary).toContain('For you');
    expect(response.itinerary).toContain('guardrail');
    expect(response.itinerary).toContain('$500 - $1,500');
    expect(response.itinerary).not.toContain('Verdict');
    expect(response.itinerary).not.toContain('Request failed with status code 500');
  });

  it('rejects agent outages in production mode without the local fallback flag', async () => {
    vi.stubEnv('VITE_ENABLE_AGENT_LOCAL_FALLBACK', 'false');
    const outage = {
      status: 500,
      message: 'Request failed with status code 500',
      isNetworkError: false,
    };
    apiPostMock.mockRejectedValue(outage);

    const { planTrip } = await import('@/services/agentService');

    await expect(planTrip({
      prompt: 'Plan a quick route',
      start_date: '2026-05-08',
    })).rejects.toBe(outage);
  });

  it('falls back to the local copilot when the route agent endpoint is not mounted', async () => {
    apiPostMock.mockRejectedValue({
      status: 404,
      message: 'Request failed with status code 404',
      isNetworkError: false,
    });

    const { planTrip } = await import('@/services/agentService');
    const response = await planTrip({
      prompt: [
        'Help refine this Scope trip draft.',
        '',
        'Current draft:',
        'Dates: 2026-05-08 to 2026-05-10',
        'Budget: $500 - $1,500',
        'Pace: relaxed',
        '',
        'Traveler request: hey',
      ].join('\n'),
      start_date: '2026-05-08',
    });

    expect(response.model).toBe('scope-local-copilot');
    expect(response.itinerary).toContain('Hey, I am here');
    expect(response.itinerary).not.toContain('Request failed with status code 404');
  });

  it('asks for missing trip brief details before a local itinerary build fallback', async () => {
    apiPostMock.mockRejectedValue({
      status: 500,
      message: 'Request failed with status code 500',
      isNetworkError: false,
    });

    const { planTrip } = await import('@/services/agentService');
    const response = await planTrip({
      prompt: [
        'Help refine this Scope trip draft.',
        '',
        'Current draft:',
        'Start: Fort Worth, TX',
        'End: Austin, TX',
        'Dates: 2026-05-08 to 2026-05-10',
        'Budget: $500 - $1,500',
        'Pace: relaxed',
        '',
        'Traveler request: Build a balanced first draft',
      ].join('\n'),
      start_date: '2026-05-08',
    });

    expect(response.model).toBe('scope-local-copilot');
    expect(response.itinerary).toContain('I can build that');
    expect(response.itinerary).toContain('What are your interests');
    expect(response.itinerary).not.toContain('- What');
    expect(response.itinerary).not.toContain('Request failed with status code 500');
  });

  it('builds a concise constraint-aware local itinerary when the brief is complete', async () => {
    apiPostMock.mockRejectedValue({
      status: 500,
      message: 'Request failed with status code 500',
      isNetworkError: false,
    });

    const { planTrip } = await import('@/services/agentService');
    const response = await planTrip({
      prompt: [
        'Help refine this Scope trip draft.',
        '',
        'Current draft:',
        'Start: Dallas, TX',
        'End: San Antonio, TX',
        'Dates: 2026-06-01 to 2026-06-01',
        'Budget: $400 - $900',
        '',
        'Traveler request: Build a relaxed 3 day entertainment and food itinerary for my family',
      ].join('\n'),
      start_date: '2026-06-01',
    });

    expect(response.model).toBe('scope-local-copilot');
    expect(response.itinerary).toContain('concise 3-day plan');
    expect(response.itinerary).toContain('Plan guardrails');
    expect(response.itinerary).toContain('Pace: relaxed');
    expect(response.itinerary).toContain('Vibes: food or entertainment');
    expect(response.itinerary).toContain('Travelers: family');
    expect(response.itinerary).toContain('one verified entertainment anchor');
    expect(response.itinerary).toContain('Verify before commit');
    expect(response.itinerary).toContain('hours, tickets, reservations');
    expect(response.itinerary).toContain('Scope does not fake venues');
    expect(response.itinerary).not.toContain('What kind of trip should this feel like');
    expect(response.itinerary).not.toContain('Request failed with status code 500');
  });

  it('treats vague help replies as surprise me when recent chat is waiting on itinerary brief info', async () => {
    apiPostMock.mockRejectedValue({
      status: 500,
      message: 'Request failed with status code 500',
      isNetworkError: false,
    });

    const { planTrip } = await import('@/services/agentService');
    const response = await planTrip({
      prompt: [
        'Help refine this Scope trip draft.',
        '',
        'Current draft:',
        'Start: Robert Lee, Texas',
        'End: 177 Kothman Road, La Vernia',
        'Dates: 2026-05-08 to 2026-05-08',
        'Budget: $500 - $1,500',
        'Pace: relaxed',
        '',
        'Recent chat:',
        'User: Build the itinerary from Robert Lee, Texas to 177 Kothman Road, La Vernia',
        'Scope AI: I can build that. How many days should I plan for?',
        '',
        'Traveler request: idk u wanna help',
      ].join('\n'),
      start_date: '2026-05-08',
    });

    expect(response.model).toBe('scope-local-copilot');
    expect(response.itinerary).toContain('surprise me');
    expect(response.itinerary).toContain('2 days');
    expect(response.itinerary).toContain('Day 1');
    expect(response.itinerary).not.toContain('Say that a little more specifically');
  });

  it('treats broad vague reply families as smart defaults in local fallback', async () => {
    apiPostMock.mockRejectedValue({
      status: 500,
      message: 'Request failed with status code 500',
      isNetworkError: false,
    });

    const { planTrip } = await import('@/services/agentService');
    const vagueReplies = [
      'no clue',
      'doesnt matter',
      'you decide',
      'any is fine',
      'dealer’s choice',
      'make it good',
      'just help',
    ];

    for (const travelerReply of vagueReplies) {
      const response = await planTrip({
        prompt: [
          'Help refine this Scope trip draft.',
          '',
          'Current draft:',
          'Start: Robert Lee, Texas',
          'End: 177 Kothman Road, La Vernia',
          'Dates: 2026-05-08 to 2026-05-08',
          'Budget: $500 - $1,500',
          'Pace: relaxed',
          '',
          'Recent chat:',
          'User: Build the itinerary from Robert Lee, Texas to 177 Kothman Road, La Vernia',
          'Scope AI: I can build that. How many days should I plan for?',
          '',
          `Traveler request: ${travelerReply}`,
        ].join('\n'),
        start_date: '2026-05-08',
      });

      expect(response.model, travelerReply).toBe('scope-local-copilot');
      expect(response.itinerary, travelerReply).toContain('surprise me');
      expect(response.itinerary, travelerReply).toContain('Day 1');
      expect(response.itinerary, travelerReply).not.toContain('Say that a little more specifically');
    }
  });

  it('answers a new budget follow-up instead of hijacking it with a pending itinerary question', async () => {
    apiPostMock.mockRejectedValue({
      status: 500,
      message: 'Request failed with status code 500',
      isNetworkError: false,
    });

    const { planTrip } = await import('@/services/agentService');
    const response = await planTrip({
      prompt: [
        'Help refine this Scope trip draft.',
        '',
        'Current draft:',
        'Start: Cr E0270, Goltry',
        'End: I 49, Mansfield',
        'Dates: 2026-05-08 to 2026-05-08',
        'Budget: $100 - $300',
        'Pace: relaxed',
        '',
        'Recent chat:',
        'User: Build the itinerary from Cr E0270, Goltry to I 49, Mansfield',
        'Scope AI: I can build that. How many days should I plan for?',
        '',
        'Traveler request: Keep this plan inside $100 - $300',
      ].join('\n'),
      start_date: '2026-05-08',
    });

    expect(response.model).toBe('scope-local-copilot');
    expect(response.itinerary).toContain('inside $100 - $300');
    expect(response.itinerary).toContain('Your next move');
    expect(response.itinerary).not.toContain('How many days should I plan for?');
    expect(response.itinerary).not.toContain('What kind of trip should this feel like');
    expect(response.itinerary).not.toContain('Day 1');
  });

  it('does not revive a canceled itinerary question for later budget follow-ups', async () => {
    apiPostMock.mockRejectedValue({
      status: 500,
      message: 'Request failed with status code 500',
      isNetworkError: false,
    });

    const { planTrip } = await import('@/services/agentService');
    const response = await planTrip({
      prompt: [
        'Help refine this Scope trip draft.',
        '',
        'Current draft:',
        'Start: Sterling City, Texas',
        'End: 233 Baptist Church Road, Cuero',
        'Dates: 2026-05-08 to 2026-05-08',
        'Budget: $500 - $1,500',
        'Pace: relaxed',
        '',
        'Recent chat:',
        'User: Build the itinerary from Sterling City, Texas to 233 Baptist Church Road, Cuero',
        'Scope AI: I can build that. How many days should I plan for?',
        'User: Cancel this build',
        'Scope AI: No problem. I stopped that itinerary build. Ask me to build again when the route brief is ready.',
        '',
        'Traveler request: Keep this plan inside $500 - $1,500',
      ].join('\n'),
      start_date: '2026-05-08',
    });

    expect(response.model).toBe('scope-local-copilot');
    expect(response.itinerary).toContain('inside $500 - $1,500');
    expect(response.itinerary).not.toContain('How many days');
    expect(response.itinerary).not.toContain('stopped that itinerary build');
  });

  it('changes the local copilot angle when the same topic repeats', async () => {
    apiPostMock.mockRejectedValue({
      status: 500,
      message: 'Request failed with status code 500',
      isNetworkError: false,
    });

    const { planTrip } = await import('@/services/agentService');
    const response = await planTrip({
      prompt: [
        'Help refine this Scope trip draft.',
        '',
        'Current draft:',
        'Start: County Road 202, Amherst, Texas',
        'End: 1049 Ferm-to-Market Road 80, Streetman, Texas',
        'Dates: 2026-05-02 to 2026-05-02',
        'Budget: $500 - $1,500',
        'Pace: relaxed',
        'Interests: scenic',
        '',
        'Recent chat:',
        'User: Check the timing for 2026-05-02',
        'Scope AI: Verdict: Use it as a point-to-point travel day unless live drive time proves it is short.',
        '',
        'Traveler request: Check whether County Road 202, Amherst to 1049 Ferm-to-Market Road 80, Streetman works at a relaxed pace',
      ].join('\n'),
      start_date: '2026-05-02',
    });

    expect(response.model).toBe('scope-local-copilot');
    expect(response.itinerary).toContain('Since you are asking timing again');
    expect(response.itinerary).toContain('Departure window');
    expect(response.itinerary).not.toContain('Use it as a point-to-point travel day unless live drive time proves it is short.');
  });

  it('answers broad route requests with a useful local plan instead of echoing the prompt', async () => {
    apiPostMock.mockRejectedValue({
      status: 500,
      message: 'Request failed with status code 500',
      isNetworkError: false,
    });

    const { planTrip } = await import('@/services/agentService');
    const response = await planTrip({
      prompt: [
        'Help refine this Scope trip draft.',
        '',
        'Current draft:',
        'Start: Oklahoma City, OK',
        'End: Dexter, NM',
        'Dates: 2026-05-08 to 2026-05-10',
        'Budget: $500 - $1,500',
        'Pace: relaxed',
        'Interests: scenic',
        '',
        'Traveler request: Suggest a simple weekend route',
      ].join('\n'),
      start_date: '2026-05-08',
    });

    expect(response.itinerary).toContain('simple relaxed weekend direction');
    expect(response.itinerary).toContain('Your weekend shape');
    expect(response.itinerary).toContain('I would');
    expect(response.itinerary).not.toContain('For Oklahoma City, OK to Dexter, NM: Suggest a simple weekend route');
  });

  it('answers specific planner topics with intent-matched local fallback guidance', async () => {
    apiPostMock.mockRejectedValue({
      status: 500,
      message: 'Request failed with status code 500',
      isNetworkError: false,
    });

    const { planTrip } = await import('@/services/agentService');
    const basePrompt = [
      'Help refine this Scope trip draft.',
      '',
      'Current draft:',
      'Start: Fort Worth, TX',
      'End: Austin, TX',
      'Dates: 2026-05-08 to 2026-05-10',
      'Budget: $500 - $1,500',
      'Pace: relaxed',
      'Interests: scenic, food',
      'Stops:',
      '1. Waco coffee break',
      '2. Austin dinner',
      '',
    ];
    const cases = [
      {
        request: 'tighten these stops',
        expected: ['Cut without overthinking it', 'Waco coffee break'],
      },
      {
        request: 'find a midpoint stop on the way',
        expected: ['A midpoint is worth adding', 'Budget guardrail for you'],
      },
      {
        request: 'where should we eat dinner',
        expected: ['For food', 'restrooms'],
      },
      {
        request: 'what about rain or weather',
        expected: ['weather plan', 'live forecast'],
      },
      {
        request: 'is this safe late at night',
        expected: ['feel safe', 'daylight'],
      },
      {
        request: 'planning for family travelers and friends',
        expected: ['For a group', 'shared costs'],
      },
      {
        request: 'look at this photo and tell me if it fits',
        expected: ['vision-enabled agent', 'trip context'],
      },
    ];

    for (const testCase of cases) {
      const response = await planTrip({
        prompt: [
          ...basePrompt,
          `Traveler request: ${testCase.request}`,
        ].join('\n'),
        start_date: '2026-05-08',
      });

      expect(response.model, testCase.request).toBe('scope-local-copilot');
      for (const expectedText of testCase.expected) {
        expect(response.itinerary, testCase.request).toContain(expectedText);
      }
      expect(response.itinerary, testCase.request).not.toContain('Say that a little more specifically');
    }
  });

  it('keeps blank-route answers written for the traveler instead of showing filler route text', async () => {
    apiPostMock.mockRejectedValue({
      status: 500,
      message: 'Request failed with status code 500',
      isNetworkError: false,
    });

    const { planTrip } = await import('@/services/agentService');
    const response = await planTrip({
      prompt: [
        'Help refine this Scope trip draft.',
        '',
        'Current draft:',
        'Dates: 2026-05-08 to 2026-05-10',
        'Budget: $500 - $1,500',
        'Pace: relaxed',
        'Interests: scenic',
        '',
        'Traveler request: Suggest a simple weekend direction',
      ].join('\n'),
      start_date: '2026-05-08',
    });

    expect(response.itinerary).toContain('For you');
    expect(response.itinerary).toContain('Because I do not have both endpoints yet');
    expect(response.itinerary).toContain('add your start and finish');
    expect(response.itinerary).not.toContain('this draft route');
    expect(response.itinerary).not.toContain('Verdict');
    expect(response.itinerary).not.toMatch(/^For you:\s*Yes\b/i);
  });

  it('answers start-city questions without falling into the weekend template', async () => {
    apiPostMock.mockRejectedValue({
      status: 500,
      message: 'Request failed with status code 500',
      isNetworkError: false,
    });

    const { planTrip } = await import('@/services/agentService');
    const response = await planTrip({
      prompt: [
        'Help refine this Scope trip draft.',
        '',
        'Current draft:',
        'Dates: 2026-05-08 to 2026-05-10',
        'Budget: $500 - $1,500',
        'Pace: relaxed',
        'Interests: scenic',
        '',
        'Traveler request: Help me choose a strong start city',
      ].join('\n'),
      start_date: '2026-05-08',
    });

    expect(response.itinerary).toContain('strong start city');
    expect(response.itinerary).toContain('one anchor');
    expect(response.itinerary).toContain('home base');
    expect(response.itinerary).not.toContain('weekend shape');
    expect(response.itinerary).not.toContain('Yes -');
    expect(response.itinerary).not.toContain('good-fit anchor');
  });

  it('answers short casual chat like a support copilot instead of dumping trip categories', async () => {
    apiPostMock.mockRejectedValue({
      status: 500,
      message: 'Request failed with status code 500',
      isNetworkError: false,
    });

    const { planTrip } = await import('@/services/agentService');
    const response = await planTrip({
      prompt: [
        'Help refine this Scope trip draft.',
        '',
        'Current draft:',
        'Dates: 2026-05-08 to 2026-05-10',
        'Budget: $500 - $1,500',
        'Pace: relaxed',
        'Interests: scenic',
        '',
        'Traveler request: yo',
      ].join('\n'),
      start_date: '2026-05-08',
    });

    expect(response.itinerary).toContain('Hey, I am here');
    expect(response.itinerary).not.toContain('Ask me one of these');
    expect(response.itinerary).not.toContain('Budget: $500 - $1,500');
    expect(response.itinerary).not.toContain('For you:');
  });

  it('handles slang greetings like wsp without dumping trip categories', async () => {
    apiPostMock.mockRejectedValue({
      status: 500,
      message: 'Request failed with status code 500',
      isNetworkError: false,
    });

    const { planTrip } = await import('@/services/agentService');
    const response = await planTrip({
      prompt: [
        'Help refine this Scope trip draft.',
        '',
        'Current draft:',
        'Budget: $500 - $1,500',
        'Pace: relaxed',
        '',
        'Traveler request: wsp',
      ].join('\n'),
      start_date: '2026-05-08',
    });

    expect(response.itinerary).toContain('Hey, I am here');
    expect(response.itinerary).not.toContain('Ask me one of these');
    expect(response.itinerary).not.toContain('Budget: $500 - $1,500');
  });

  it('varies repeated casual greetings using recent chat instead of returning the same line', async () => {
    apiPostMock.mockRejectedValue({
      status: 500,
      message: 'Request failed with status code 500',
      isNetworkError: false,
    });

    const previousReply = 'Hey, I am here. Send me the trip idea, start and end, or whatever feels off, and I will help shape it.';

    const { planTrip } = await import('@/services/agentService');
    const response = await planTrip({
      prompt: [
        'Help refine this Scope trip draft.',
        '',
        'Current draft:',
        'Budget: $500 - $1,500',
        'Pace: relaxed',
        '',
        'Recent chat:',
        'User: yo',
        `Scope AI: ${previousReply}`,
        '',
        'Traveler request: yo',
      ].join('\n'),
      start_date: '2026-05-08',
    });

    expect(response.itinerary).not.toBe(previousReply);
    expect(response.itinerary).not.toContain('Ask me one of these');
    expect(response.itinerary).not.toContain('Budget: $500 - $1,500');
  });

  it('keeps repeated unclear prompts unique instead of echoing the same fallback', async () => {
    apiPostMock.mockRejectedValue({
      status: 500,
      message: 'Request failed with status code 500',
      isNetworkError: false,
    });

    const previousReply = 'I am with you. Say that a little more specifically and I will answer the exact thing instead of guessing.';

    const { planTrip } = await import('@/services/agentService');
    const response = await planTrip({
      prompt: [
        'Help refine this Scope trip draft.',
        '',
        'Current draft:',
        'Budget: $500 - $1,500',
        'Pace: relaxed',
        '',
        'Recent chat:',
        'User: why',
        `Scope AI: ${previousReply}`,
        '',
        'Traveler request: why',
      ].join('\n'),
      start_date: '2026-05-08',
    });

    expect(response.itinerary).not.toBe(previousReply);
    expect(response.itinerary).toMatch(/route|app|stop|timing|budget|place/i);
    expect(response.itinerary).not.toContain('Ask me one of these');
  });

  it('answers small talk without forcing planner sections', async () => {
    apiPostMock.mockRejectedValue({
      status: 500,
      message: 'Request failed with status code 500',
      isNetworkError: false,
    });

    const { planTrip } = await import('@/services/agentService');
    const response = await planTrip({
      prompt: [
        'Help refine this Scope trip draft.',
        '',
        'Current draft:',
        'Budget: $500 - $1,500',
        'Pace: relaxed',
        '',
        'Traveler request: how are you',
      ].join('\n'),
      start_date: '2026-05-08',
    });

    expect(response.itinerary).toContain('I am here and ready');
    expect(response.itinerary).not.toContain('Ask me one of these');
    expect(response.itinerary).not.toContain('For you:');
  });

  it('answers app-flow questions when the traveler asks how to use the screen', async () => {
    apiPostMock.mockRejectedValue({
      status: 500,
      message: 'Request failed with status code 500',
      isNetworkError: false,
    });

    const { planTrip } = await import('@/services/agentService');
    const response = await planTrip({
      prompt: [
        'Help refine this Scope trip draft.',
        '',
        'Current draft:',
        'Dates: 2026-05-08 to 2026-05-10',
        'Budget: $500 - $1,500',
        'Pace: relaxed',
        'Interests: scenic',
        '',
        'Traveler request: how do I add start and end',
      ].join('\n'),
      start_date: '2026-05-08',
    });

    expect(response.itinerary).toContain('route canvas');
    expect(response.itinerary).toContain('Add a start point');
    expect(response.itinerary).toContain('Add an end point');
  });

  it('answers where-to-find app UI questions as app help', async () => {
    apiPostMock.mockRejectedValue({
      status: 500,
      message: 'Request failed with status code 500',
      isNetworkError: false,
    });

    const { planTrip } = await import('@/services/agentService');
    const response = await planTrip({
      prompt: [
        'Help refine this Scope trip draft.',
        '',
        'Current draft:',
        'Budget: $500 - $1,500',
        'Pace: relaxed',
        '',
        'Traveler request: where is the search bar',
      ].join('\n'),
      start_date: '2026-05-08',
    });

    expect(response.itinerary).toContain('app flow');
    expect(response.itinerary).toContain('Where to click next');
    expect(response.itinerary).not.toContain('real-world place');
  });

  it('does not treat real-world where questions as app UI questions', async () => {
    apiPostMock.mockRejectedValue({
      status: 500,
      message: 'Request failed with status code 500',
      isNetworkError: false,
    });

    const { planTrip } = await import('@/services/agentService');
    const response = await planTrip({
      prompt: [
        'Help refine this Scope trip draft.',
        '',
        'Current draft:',
        'Budget: $500 - $1,500',
        'Pace: relaxed',
        '',
        'Traveler request: where is Paris',
      ].join('\n'),
      start_date: '2026-05-08',
    });

    expect(response.itinerary).toContain('real-world place');
    expect(response.itinerary).toContain('Paris');
    expect(response.itinerary).not.toContain('app flow');
    expect(response.itinerary).not.toContain('Ask me one of these');
  });

  it('does not pretend to know the traveler current device location', async () => {
    apiPostMock.mockRejectedValue({
      status: 500,
      message: 'Request failed with status code 500',
      isNetworkError: false,
    });

    const { planTrip } = await import('@/services/agentService');
    const response = await planTrip({
      prompt: [
        'Help refine this Scope trip draft.',
        '',
        'Current draft:',
        'Budget: $500 - $1,500',
        'Pace: relaxed',
        '',
        'Traveler request: where am I',
      ].join('\n'),
      start_date: '2026-05-08',
    });

    expect(response.itinerary).toContain('cannot see your current device location');
    expect(response.itinerary).not.toContain('Ask me one of these');
  });

  it('treats image attachment how-to questions as app help', async () => {
    apiPostMock.mockRejectedValue({
      status: 500,
      message: 'Request failed with status code 500',
      isNetworkError: false,
    });

    const { planTrip } = await import('@/services/agentService');
    const response = await planTrip({
      prompt: [
        'Help refine this Scope trip draft.',
        '',
        'Current draft:',
        'Budget: $500 - $1,500',
        'Pace: relaxed',
        '',
        'Traveler request: how do I attach an image',
      ].join('\n'),
      start_date: '2026-05-08',
    });

    expect(response.itinerary).toContain('image button');
    expect(response.itinerary).toContain('Tap the image icon');
    expect(response.itinerary).not.toContain('vision-enabled agent');
  });

  it('does not turn identity questions into trip category dumps', async () => {
    apiPostMock.mockRejectedValue({
      status: 500,
      message: 'Request failed with status code 500',
      isNetworkError: false,
    });

    const { planTrip } = await import('@/services/agentService');
    const response = await planTrip({
      prompt: [
        'Help refine this Scope trip draft.',
        '',
        'Current draft:',
        'Dates: 2026-05-08 to 2026-05-10',
        'Budget: $500 - $1,500',
        'Pace: relaxed',
        'Interests: scenic',
        '',
        'Traveler request: Who am i',
      ].join('\n'),
      start_date: '2026-05-08',
    });

    expect(response.itinerary).toContain('cannot confidently tell who you are');
    expect(response.itinerary).toContain('profile name');
    expect(response.itinerary).not.toContain('Ask me one of these');
    expect(response.itinerary).not.toContain('Budget: $500 - $1,500');
    expect(response.itinerary).not.toContain('Vibe:');
  });

  it('answers assistant identity questions directly', async () => {
    apiPostMock.mockRejectedValue({
      status: 500,
      message: 'Request failed with status code 500',
      isNetworkError: false,
    });

    const { planTrip } = await import('@/services/agentService');
    const response = await planTrip({
      prompt: [
        'Help refine this Scope trip draft.',
        '',
        'Current draft:',
        'Budget: $500 - $1,500',
        'Pace: relaxed',
        '',
        'Traveler request: who are you',
      ].join('\n'),
      start_date: '2026-05-08',
    });

    expect(response.itinerary).toContain('I am Scope AI');
    expect(response.itinerary).toContain('trip and app copilot');
    expect(response.itinerary).not.toContain('Ask me one of these');
  });

  it('answers personal questions about the AI professionally instead of vague clarification', async () => {
    apiPostMock.mockRejectedValue({
      status: 500,
      message: 'Request failed with status code 500',
      isNetworkError: false,
    });

    const { planTrip } = await import('@/services/agentService');
    const response = await planTrip({
      prompt: [
        'Help refine this Scope trip draft.',
        '',
        'Current draft:',
        'Budget: $500 - $1,500',
        'Pace: relaxed',
        '',
        'Traveler request: are u gay',
      ].join('\n'),
      start_date: '2026-05-08',
    });

    expect(response.model).toBe('scope-local-copilot');
    expect(response.itinerary).toMatch(/sexual orientation|does not apply|human identity|personal identity/i);
    expect(response.itinerary).toContain('Scope');
    expect(response.itinerary).not.toContain('Say that a little more specifically');
    expect(response.itinerary).not.toContain('Ask me one of these');
  });

  it('keeps repeated personal AI questions unique', async () => {
    apiPostMock.mockRejectedValue({
      status: 500,
      message: 'Request failed with status code 500',
      isNetworkError: false,
    });

    const previousReply = 'I do not have a sexual orientation, gender, race, religion, politics, or personal relationships. I am Scope AI, and I will keep it professional: trips, spots, routes, budgets, timing, images, and app help.';

    const { planTrip } = await import('@/services/agentService');
    const response = await planTrip({
      prompt: [
        'Help refine this Scope trip draft.',
        '',
        'Current draft:',
        'Budget: $500 - $1,500',
        'Pace: relaxed',
        '',
        'Recent chat:',
        'User: are u gay',
        `Scope AI: ${previousReply}`,
        '',
        'Traveler request: are u gay',
      ].join('\n'),
      start_date: '2026-05-08',
    });

    expect(response.itinerary).not.toBe(previousReply);
    expect(response.itinerary).toMatch(/Scope|AI|copilot/i);
    expect(response.itinerary).not.toContain('Say that a little more specifically');
  });

  it('sets a professional boundary for romantic or explicit prompts', async () => {
    apiPostMock.mockRejectedValue({
      status: 500,
      message: 'Request failed with status code 500',
      isNetworkError: false,
    });

    const { planTrip } = await import('@/services/agentService');
    const response = await planTrip({
      prompt: [
        'Help refine this Scope trip draft.',
        '',
        'Current draft:',
        'Budget: $500 - $1,500',
        'Pace: relaxed',
        '',
        'Traveler request: send nudes',
      ].join('\n'),
      start_date: '2026-05-08',
    });

    expect(response.itinerary).toMatch(/professional|romantic|sexual|explicit|boundary/i);
    expect(response.itinerary).toMatch(/Scope|trip|plan|route/i);
    expect(response.itinerary).not.toContain('Say that a little more specifically');
  });

  it('responds steadily to abusive prompts and asks for the fix target', async () => {
    apiPostMock.mockRejectedValue({
      status: 500,
      message: 'Request failed with status code 500',
      isNetworkError: false,
    });

    const { planTrip } = await import('@/services/agentService');
    const response = await planTrip({
      prompt: [
        'Help refine this Scope trip draft.',
        '',
        'Current draft:',
        'Budget: $500 - $1,500',
        'Pace: relaxed',
        '',
        'Traveler request: fuck you',
      ].join('\n'),
      start_date: '2026-05-08',
    });

    expect(response.itinerary).toMatch(/respectful|frustration|fix|wrong|correct/i);
    expect(response.itinerary).toMatch(/route|app|budget|timing|search|answer/i);
    expect(response.itinerary).not.toContain('Say that a little more specifically');
  });

  it('redirects high-stakes off-topic prompts to qualified sources', async () => {
    apiPostMock.mockRejectedValue({
      status: 500,
      message: 'Request failed with status code 500',
      isNetworkError: false,
    });

    const { planTrip } = await import('@/services/agentService');
    const response = await planTrip({
      prompt: [
        'Help refine this Scope trip draft.',
        '',
        'Current draft:',
        'Budget: $500 - $1,500',
        'Pace: relaxed',
        '',
        'Traveler request: should I invest in crypto',
      ].join('\n'),
      start_date: '2026-05-08',
    });

    expect(response.itinerary).toMatch(/outside|professional|official|financial|investment|qualified/i);
    expect(response.itinerary).toMatch(/trip|app|Scope|route/i);
    expect(response.itinerary).not.toContain('Say that a little more specifically');
  });

  it('asks for clarification on short unclear messages instead of guessing trip topics', async () => {
    apiPostMock.mockRejectedValue({
      status: 500,
      message: 'Request failed with status code 500',
      isNetworkError: false,
    });

    const { planTrip } = await import('@/services/agentService');
    const response = await planTrip({
      prompt: [
        'Help refine this Scope trip draft.',
        '',
        'Current draft:',
        'Budget: $500 - $1,500',
        'Pace: relaxed',
        '',
        'Traveler request: why',
      ].join('\n'),
      start_date: '2026-05-08',
    });

    expect(response.itinerary).toContain('Say that a little more specifically');
    expect(response.itinerary).not.toContain('Ask me one of these');
    expect(response.itinerary).not.toContain('Budget: $500 - $1,500');
  });

  it('handles frustration before app or trip routing', async () => {
    apiPostMock.mockRejectedValue({
      status: 500,
      message: 'Request failed with status code 500',
      isNetworkError: false,
    });

    const { planTrip } = await import('@/services/agentService');
    const response = await planTrip({
      prompt: [
        'Help refine this Scope trip draft.',
        '',
        'Current draft:',
        'Budget: $500 - $1,500',
        'Pace: relaxed',
        '',
        'Traveler request: this app is confusing bro',
      ].join('\n'),
      start_date: '2026-05-08',
    });

    expect(response.itinerary).toContain('I hear you');
    expect(response.itinerary).toContain('app flow');
    expect(response.itinerary).not.toContain('Ask me one of these');
    expect(response.itinerary).not.toContain('route canvas');
  });

  it('keeps unknown general questions out of the budget and vibe template', async () => {
    apiPostMock.mockRejectedValue({
      status: 500,
      message: 'Request failed with status code 500',
      isNetworkError: false,
    });

    const { planTrip } = await import('@/services/agentService');
    const response = await planTrip({
      prompt: [
        'Help refine this Scope trip draft.',
        '',
        'Current draft:',
        'Dates: 2026-05-08 to 2026-05-10',
        'Budget: $500 - $1,500',
        'Pace: relaxed',
        'Interests: scenic',
        '',
        'Traveler request: what is the capital of France',
      ].join('\n'),
      start_date: '2026-05-08',
    });

    expect(response.itinerary).toMatch(/outside Scope|current trusted source|not really an Scope planning question|stay in my lane/i);
    expect(response.itinerary).not.toContain('Ask me one of these');
    expect(response.itinerary).not.toContain('Vibe: scenic');
  });

  it('changes repeated budget checks into fresh budget guidance instead of reusing the first answer', async () => {
    apiPostMock.mockRejectedValue({
      status: 500,
      message: 'Request failed with status code 500',
      isNetworkError: false,
    });

    const { planTrip } = await import('@/services/agentService');
    const response = await planTrip({
      prompt: [
        'Help refine this Scope trip draft.',
        '',
        'Current draft:',
        'Start: Fort Worth, TX',
        'End: Austin, TX',
        'Dates: 2026-05-08 to 2026-05-10',
        'Budget: $500 - $1,500',
        'Pace: balanced',
        'Interests: food, culture',
        '',
        'Recent chat:',
        'User: Keep this plan inside budget',
        'Scope AI: For you: I would treat $500 - $1,500 as the guardrail.',
        '',
        'Traveler request: Keep this plan inside budget',
      ].join('\n'),
      start_date: '2026-05-08',
    });

    expect(response.model).toBe('scope-local-copilot');
    expect(response.itinerary).toContain('same budget again');
    expect(response.itinerary).toContain('$500 - $1,500');
    expect(response.itinerary).not.toContain('Verdict');
  });

  it('answers broad suggestion prompts with a next-decision framework instead of a vague clarification', async () => {
    apiPostMock.mockRejectedValue({
      status: 500,
      message: 'Request failed with status code 500',
      isNetworkError: false,
    });

    const { planTrip } = await import('@/services/agentService');
    const response = await planTrip({
      prompt: [
        'Help refine this Scope trip draft.',
        '',
        'Current draft:',
        'Start: Fort Worth, TX',
        'End: Austin, TX',
        'Dates: 2026-05-08 to 2026-05-10',
        'Budget: $500 - $1,500',
        'Pace: balanced',
        'Interests: food, culture',
        '',
        'Traveler request: Suggest a route idea I should do next',
      ].join('\n'),
      start_date: '2026-05-08',
    });

    expect(response.itinerary).toContain('keep your next step narrow');
    expect(response.itinerary).toContain('What I would add for you');
    expect(response.itinerary).toContain('One food or culture stop');
    expect(response.itinerary).not.toContain('Say that a little more specifically');
  });

  it('keeps common conversational local fallback intents concise and route-aware', async () => {
    apiPostMock.mockRejectedValue({
      status: 500,
      message: 'Request failed with status code 500',
      isNetworkError: false,
    });

    const { planTrip } = await import('@/services/agentService');
    const basePrompt = [
      'Help refine this Scope trip draft.',
      '',
      'Current draft:',
      'Start: Fort Worth, TX',
      'End: Austin, TX',
      'Dates: 2026-05-08 to 2026-05-10',
      'Budget: $500 - $1,500',
      'Pace: balanced',
      'Interests: food, culture',
      '',
    ];
    const cases = [
      { request: 'thanks', expected: 'tune the route' },
      { request: 'ok', expected: 'Got you' },
      { request: 'bye', expected: 'keep working on the trip' },
      { request: 'what context do you have', expected: 'Fort Worth, TX to Austin, TX' },
      { request: 'is this private', expected: 'Optional analytics' },
    ];

    for (const testCase of cases) {
      const response = await planTrip({
        prompt: [
          ...basePrompt,
          `Traveler request: ${testCase.request}`,
        ].join('\n'),
        start_date: '2026-05-08',
      });

      expect(response.model, testCase.request).toBe('scope-local-copilot');
      expect(response.itinerary, testCase.request).toContain(testCase.expected);
      expect(response.itinerary, testCase.request).not.toContain('Ask me one of these');
      expect(response.itinerary, testCase.request).not.toContain('For you:');
    }
  });

  it('routes crisis language to immediate support instead of planner advice', async () => {
    apiPostMock.mockRejectedValue({
      status: 500,
      message: 'Request failed with status code 500',
      isNetworkError: false,
    });

    const { planTrip } = await import('@/services/agentService');
    const response = await planTrip({
      prompt: [
        'Help refine this Scope trip draft.',
        '',
        'Current draft:',
        'Budget: $500 - $1,500',
        'Pace: relaxed',
        '',
        'Traveler request: I might hurt myself',
      ].join('\n'),
      start_date: '2026-05-08',
    });

    expect(response.itinerary).toMatch(/emergency services|988|immediate/i);
    expect(response.itinerary).not.toContain('route canvas');
    expect(response.itinerary).not.toContain('For you:');
  });

  it('continues pending itinerary brief questions when the traveler answers one missing field', async () => {
    apiPostMock.mockRejectedValue({
      status: 500,
      message: 'Request failed with status code 500',
      isNetworkError: false,
    });

    const { planTrip } = await import('@/services/agentService');
    const response = await planTrip({
      prompt: [
        'Help refine this Scope trip draft.',
        '',
        'Current draft:',
        'Start: Fort Worth, TX',
        'End: Austin, TX',
        'Dates: 2026-05-08 to 2026-05-10',
        'Budget: $500 - $1,500',
        '',
        'Recent chat:',
        'User: Build the itinerary',
        'Scope AI: What pace should I use: relaxed, balanced, or packed?',
        '',
        'Traveler request: relaxed',
      ].join('\n'),
      start_date: '2026-05-08',
    });

    expect(response.itinerary).toContain('Got it.');
    expect(response.itinerary).toContain('What are your interests');
    expect(response.itinerary).not.toContain('How many days should I plan for?');
  });

  it('handles start-city questions when only one endpoint is already known', async () => {
    apiPostMock.mockRejectedValue({
      status: 500,
      message: 'Request failed with status code 500',
      isNetworkError: false,
    });

    const { planTrip } = await import('@/services/agentService');
    const startOnly = await planTrip({
      prompt: [
        'Help refine this Scope trip draft.',
        '',
        'Current draft:',
        'Start: Fort Worth, TX',
        'Dates: 2026-05-08 to 2026-05-10',
        'Budget: $500 - $1,500',
        'Pace: relaxed',
        '',
        'Traveler request: Is this a good start city?',
      ].join('\n'),
      start_date: '2026-05-08',
    });
    const endOnly = await planTrip({
      prompt: [
        'Help refine this Scope trip draft.',
        '',
        'Current draft:',
        'End: Austin, TX',
        'Dates: 2026-05-08 to 2026-05-10',
        'Budget: $500 - $1,500',
        'Pace: relaxed',
        '',
        'Traveler request: Help me choose a strong start city',
      ].join('\n'),
      start_date: '2026-05-08',
    });

    expect(startOnly.itinerary).toContain('test Fort Worth, TX as your start');
    expect(startOnly.itinerary).toContain('Add the finish city');
    expect(endOnly.itinerary).toContain('getting to Austin, TX easy');
    expect(endOnly.itinerary).toContain('Tell me where you are coming from');
  });

  it('passes abort signals through to the live route agent request', async () => {
    apiPostMock.mockResolvedValue({
      data: {
        itinerary: 'Live itinerary',
        steps: 4,
        model: 'scope-live',
      },
    });
    const controller = new AbortController();

    const { planTrip } = await import('@/services/agentService');
    await planTrip({
      prompt: 'Plan a clean route',
      start_date: '2026-05-08',
    }, {
      signal: controller.signal,
    });

    expect(apiPostMock).toHaveBeenCalledWith('/api/intel/agent/trip-chat', {
      prompt: 'Plan a clean route',
      start_date: '2026-05-08',
      responseMode: 'json',
    }, {
      timeout: 120_000,
      signal: controller.signal,
    });
  });

  it('uses the local fallback for retryable API failures beyond 404 and 500', async () => {
    const retryableErrors = [
      { isNetworkError: true, message: 'Network Error' },
      { status: undefined, message: 'No response status' },
      { status: 401, message: 'Unauthorized' },
      { status: 403, message: 'Forbidden' },
    ];
    for (const error of retryableErrors) {
      apiPostMock.mockRejectedValueOnce(error);
    }

    const { planTrip } = await import('@/services/agentService');

    for (const error of retryableErrors) {
      const response = await planTrip({
        prompt: [
          'Help refine this Scope trip draft.',
          '',
          'Current draft:',
          'Start: Fort Worth, TX',
          'End: Austin, TX',
          'Dates: 2026-05-08 to 2026-05-10',
          'Budget: $500 - $1,500',
          'Pace: balanced',
          'Interests: food, culture',
          '',
          'Traveler request: How can you help?',
        ].join('\n'),
        start_date: '2026-05-08',
      });

      expect(response.model, String(error.status)).toBe('scope-local-copilot');
      expect(response.itinerary, String(error.status)).toContain('trip copilot');
      expect(response.itinerary, String(error.status)).not.toContain(error.message);
    }
  });

  it('covers the remaining conversational fallback guardrails without leaking planner templates', async () => {
    apiPostMock.mockRejectedValue({
      status: 500,
      message: 'Request failed with status code 500',
      isNetworkError: false,
    });

    const { planTrip } = await import('@/services/agentService');
    const basePrompt = [
      'Help refine this Scope trip draft.',
      '',
      'Current draft:',
      'Start: Fort Worth, TX',
      'End: Austin, TX',
      'Dates: 2026-05-08 to 2026-05-10',
      'Budget: $500 - $1,500',
      'Pace: balanced',
      'Interests: food, culture',
      '',
    ];
    const cases = [
      { request: 'how are you', expected: 'ready' },
      { request: 'who am i', expected: 'do not have your profile name' },
      { request: 'who are you', expected: 'Scope AI' },
      { request: 'where am I', expected: 'current device location' },
      { request: 'where is?', expected: 'real-world place' },
      { request: 'are you religious', expected: 'do not have a sexual orientation' },
      { request: 'i love you', expected: 'professional' },
    ];

    for (const testCase of cases) {
      const response = await planTrip({
        prompt: [
          ...basePrompt,
          `Traveler request: ${testCase.request}`,
        ].join('\n'),
        start_date: '2026-05-08',
      });

      expect(response.itinerary, testCase.request).toContain(testCase.expected);
      expect(response.itinerary, testCase.request).not.toContain('For you:');
      expect(response.itinerary, testCase.request).not.toContain('Ask me one of these');
    }
  });

  it('routes topic fallbacks through concrete route-planning answers', async () => {
    apiPostMock.mockRejectedValue({
      status: 500,
      message: 'Request failed with status code 500',
      isNetworkError: false,
    });

    const { planTrip } = await import('@/services/agentService');
    const basePrompt = [
      'Help refine this Scope trip draft.',
      '',
      'Current draft:',
      'Start: Fort Worth, TX',
      'End: Austin, TX',
      'Dates: 2026-05-08 to 2026-05-10',
      'Budget: $500 - $1,500',
      'Pace: balanced',
      'Interests: food, culture',
      'Stops:',
      "1. Buc-ee's Temple",
      '2. Mayfield Park',
      '',
    ];
    const cases = [
      { request: 'Can you tighten this route again?', expected: 'Keep only what helps you', recent: ['User: Can you tighten this route again?'] },
      { request: 'Can you check timing again?', expected: 'total wheel time', recent: ['User: Can you check timing again?'] },
      { request: 'Where should we stop halfway?', expected: 'A midpoint is worth adding' },
      { request: 'Give me a simple weekend direction', expected: 'simple balanced weekend direction' },
      { request: 'Where should we eat dinner?', expected: 'For food' },
      { request: 'Will rain mess up the drive?', expected: 'weather plan' },
      { request: 'Is this safe at night?', expected: 'feel safe' },
      { request: 'Traveling with a family group with kids', expected: 'For a group' },
      { request: 'Look at this attached photo for the trip', expected: 'use images as trip context' },
    ];

    for (const testCase of cases) {
      const response = await planTrip({
        prompt: [
          ...basePrompt,
          ...(testCase.recent ? ['Recent chat:', ...testCase.recent, ''] : []),
          `Traveler request: ${testCase.request}`,
        ].join('\n'),
        start_date: '2026-05-08',
      });

      expect(response.itinerary, testCase.request).toContain(testCase.expected);
      expect(response.itinerary, testCase.request).not.toContain('Request failed');
    }
  });

  it('answers app-help fallbacks for image uploads and route canvas setup', async () => {
    apiPostMock.mockRejectedValue({
      status: 500,
      message: 'Request failed with status code 500',
      isNetworkError: false,
    });

    const { planTrip } = await import('@/services/agentService');
    const imageHelp = await planTrip({
      prompt: [
        'Help refine this Scope trip draft.',
        '',
        'Current draft:',
        'Budget: $500 - $1,500',
        'Pace: balanced',
        '',
        'Traveler request: How do I upload a photo in the chat bar?',
      ].join('\n'),
    });
    const routeHelp = await planTrip({
      prompt: [
        'Help refine this Scope trip draft.',
        '',
        'Current draft:',
        'Budget: $500 - $1,500',
        'Pace: balanced',
        '',
        'Traveler request: How do I use the route canvas to add start and end?',
      ].join('\n'),
    });

    expect(imageHelp.itinerary).toContain('image button in the chat bar');
    expect(imageHelp.itinerary).toContain('Pick one or more images');
    expect(routeHelp.itinerary).toContain('Use the route canvas first');
    expect(routeHelp.itinerary).toContain('Add a start point');
  });

  it('stops honoring a canceled pending itinerary brief', async () => {
    apiPostMock.mockRejectedValue({
      status: 500,
      message: 'Request failed with status code 500',
      isNetworkError: false,
    });

    const { planTrip } = await import('@/services/agentService');
    const response = await planTrip({
      prompt: [
        'Help refine this Scope trip draft.',
        '',
        'Current draft:',
        'Start: Fort Worth, TX',
        'End: Austin, TX',
        'Dates: 2026-05-08 to 2026-05-10',
        'Budget: $500 - $1,500',
        '',
        'Recent chat:',
        'User: Build the itinerary',
        'Scope AI: How many days should I plan for?',
        'User: cancel this itinerary build',
        '',
        'Traveler request: relaxed',
      ].join('\n'),
      start_date: '2026-05-08',
    });

    expect(response.itinerary).not.toContain('Got it.');
    expect(response.itinerary).not.toContain('How many days should I plan for?');
    expect(response.itinerary).toContain('Pace: relaxed');
  });

  it('keeps client validation errors visible instead of falling back', async () => {
    const badRequest = {
      status: 400,
      message: 'prompt is required',
      isNetworkError: false,
    };
    apiPostMock.mockRejectedValue(badRequest);

    const { planTrip } = await import('@/services/agentService');

    await expect(planTrip({ prompt: '' })).rejects.toBe(badRequest);
  });

  it('uses fresh-angle replies after every canned greeting, thanks, and vague fallback was already used', async () => {
    apiPostMock.mockRejectedValue({
      status: 500,
      message: 'Request failed with status code 500',
      isNetworkError: false,
    });

    const { planTrip } = await import('@/services/agentService');
    const basePrompt = [
      'Help refine this Scope trip draft.',
      '',
      'Current draft:',
      'Start: Fort Worth, TX',
      'End: Austin, TX',
      'Dates: 2026-05-08 to 2026-05-10',
      'Budget: $500 - $1,500',
      'Pace: balanced',
      '',
    ];

    const greeting = await planTrip({
      prompt: [
        ...basePrompt,
        'Recent chat:',
        'User: hey',
        'Scope AI: Hey, I am here. Tell me what you want to check on this route and I will keep it clear.',
        'User: hey',
        'Scope AI: Still here with Fort Worth, TX to Austin, TX. What do you want me to look at first?',
        'User: hey',
        'Scope AI: I am here with the route. Send the piece that feels off and I will answer it directly.',
        'User: hey',
        'Scope AI: Yep, I am awake on this one. Give me the route, app, timing, or budget piece.',
        '',
        'Traveler request: hey',
      ].join('\n'),
    });
    const thanks = await planTrip({
      prompt: [
        ...basePrompt,
        'Recent chat:',
        'User: thanks',
        'Scope AI: Anytime. I am here when you want to tune the route, check timing, or sanity-check a stop.',
        'User: thanks',
        'Scope AI: Of course. When you want the next pass, I can help tighten timing, stops, or budget.',
        'User: thanks',
        'Scope AI: You got it. Send the next route detail and I will keep the answer focused.',
        'User: thanks',
        'Scope AI: No problem. I can keep working the route whenever you want another angle.',
        '',
        'Traveler request: thanks',
      ].join('\n'),
    });
    const unclear = await planTrip({
      prompt: [
        ...basePrompt,
        'Recent chat:',
        'User: blue',
        'Scope AI: I am with you. Say that a little more specifically and I will answer the exact thing instead of guessing.',
        'User: blue',
        'Scope AI: Give me a little more to grab onto: route, app, stop, timing, budget, or place.',
        'User: blue',
        'Scope AI: I need one more word of direction before I guess wrong. What part are we talking about?',
        'User: blue',
        'Scope AI: Say what you want checked and I will keep the answer tight.',
        '',
        'Traveler request: blue',
      ].join('\n'),
    });

    expect(greeting.itinerary).toContain('Fresh angle 5');
    expect(greeting.itinerary).toContain('I will not echo the same greeting back');
    expect(thanks.itinerary).toContain('Fresh angle 5');
    expect(thanks.itinerary).toContain('move from thanks into action');
    expect(unclear.itinerary).toContain('Fresh angle 5');
    expect(unclear.itinerary).toContain('I will not repeat the same wording');
  });

  it('continues each pending itinerary brief question only when the latest reply answers that question', async () => {
    apiPostMock.mockRejectedValue({
      status: 500,
      message: 'Request failed with status code 500',
      isNetworkError: false,
    });

    const { planTrip } = await import('@/services/agentService');
    const prompts = [
      {
        question: 'How many days should I plan for?',
        reply: '3',
        next: 'what are your interests',
      },
      {
        question: 'What are your interests for this trip?',
        reply: 'food, museums, and parks',
        next: 'who are you traveling',
      },
      {
        question: 'What pace should I use: relaxed, balanced, or packed?',
        reply: 'packed',
        next: 'what are your interests',
      },
      {
        question: 'Who is coming with you: solo, a couple, a group, or family?',
        reply: 'family with kids',
        next: 'what are your interests',
      },
    ];

    for (const scenario of prompts) {
      const response = await planTrip({
        prompt: [
          'Help refine this Scope trip draft.',
          '',
          'Current draft:',
          'Start: Fort Worth, TX',
          'End: Austin, TX',
          'Dates: 2026-05-08 to 2026-05-10',
          'Budget: $500 - $1,500',
          'Pace: balanced',
          '',
          'Recent chat:',
          'User: Build the itinerary',
          `Scope AI: I can build that. ${scenario.question}`,
          '',
          `Traveler request: ${scenario.reply}`,
        ].join('\n'),
      });

      expect(response.itinerary.toLowerCase(), scenario.question).toContain(scenario.next);
    }
  });

  it('uses the repeat midpoint answer after route-stop advice has already been requested', async () => {
    apiPostMock.mockRejectedValue({
      status: 500,
      message: 'Request failed with status code 500',
      isNetworkError: false,
    });

    const { planTrip } = await import('@/services/agentService');
    const response = await planTrip({
      prompt: [
        'Help refine this Scope trip draft.',
        '',
        'Current draft:',
        'Start: Fort Worth, TX',
        'End: Austin, TX',
        'Budget: $500 - $1,500',
        'Pace: balanced',
        'Interests: scenic, food',
        '',
        'Recent chat:',
        'User: where should the midpoint stop be',
        'Scope AI: A midpoint is worth adding only if it makes your drive easier.',
        '',
        'Traveler request: where should the midpoint stop be',
      ].join('\n'),
    });

    expect(response.itinerary).toContain('I would choose your midpoint by what it does for you');
    expect(response.itinerary).toContain('scenic or food stop');
  });

  it('covers local conversational fallback intents without surfacing backend outage text', async () => {
    apiPostMock.mockRejectedValue({
      status: 503,
      message: 'Request failed with status code 503',
      isNetworkError: false,
    });

    const { planTrip } = await import('@/services/agentService');
    const basePrompt = [
      'Help refine this Scope trip draft.',
      '',
      'Current draft:',
      'Start: Fort Worth, TX',
      'End: Austin, TX',
      'Dates: 2026-05-08 to 2026-05-10',
      'Budget: $500 - $1,500',
      'Pace: relaxed',
      'Interests: scenic, food',
      '',
    ];
    const requests = [
      'how are you',
      'ok',
      'bye',
      'this is confusing and broken',
      'who am i',
      'who are you',
      'what do you remember about my draft',
      'do you store my data',
      'where am i',
      'where is Mount Bonnell',
      'what can you do',
      'tell me about legal advice',
      'explain quantum mechanics?',
      'send nudes',
      'are you dating anyone',
      'fuck you',
      'I want to hurt myself',
    ];

    for (const travelerRequest of requests) {
      const response = await planTrip({
        prompt: [
          ...basePrompt,
          `Traveler request: ${travelerRequest}`,
        ].join('\n'),
      });

      expect(response.model, travelerRequest).toBe('scope-local-copilot');
      expect(response.itinerary, travelerRequest).toEqual(expect.any(String));
      expect(response.itinerary, travelerRequest).not.toContain('Request failed');
    }
  });

  it('uses every local fallback outage shape and rejects non-API errors', async () => {
    const { planTrip } = await import('@/services/agentService');
    const prompt = [
      'Help refine this Scope trip draft.',
      '',
      'Current draft:',
      'Start: Fort Worth, TX',
      'End: Austin, TX',
      'Traveler request: Check timing',
    ].join('\n');

    for (const outage of [
      { status: 401, isNetworkError: false },
      { status: 403, isNetworkError: false },
      { status: undefined, isNetworkError: false },
      { status: 418, isNetworkError: true },
    ]) {
      apiPostMock.mockRejectedValueOnce({
        ...outage,
        message: 'agent unavailable',
      });
      await expect(planTrip({ prompt })).resolves.toMatchObject({
        model: 'scope-local-copilot',
      });
    }

    const nonApiError = new Error('plain failure');
    apiPostMock.mockRejectedValueOnce(nonApiError);
    await expect(planTrip({ prompt })).rejects.toBe(nonApiError);
  });

  it('keeps itinerary parsing useful across planner brief and traveler-party edge cases', async () => {
    const { __agentServiceCoverage } = await import('@/services/agentService');
    const coverage = __agentServiceCoverage!;

    expect(coverage.isItineraryBuildRequest('Create a starter itinerary')).toBe(true);
    expect(coverage.isItineraryBuildRequest('Is this itinerary realistic?')).toBe(false);
    expect(coverage.inferInterestsFromText('Give me a balanced mix')).toBe('food, culture, scenic');
    expect(coverage.inferPaceFromText('Keep every day packed and busy')).toBe('packed');
    expect(coverage.inferPaceFromText('Use a normal, moderate pace')).toBe('balanced');
    expect(coverage.inferPaceFromText('No preference yet')).toBe('');

    expect(coverage.getTravelersLabel('Travel party: Two parents and kids')).toBe('Two parents and kids');
    expect(coverage.getTravelersLabel('Travelers: 1')).toBe('solo traveler');
    expect(coverage.getTravelersLabel('Travelers: 4')).toBe('4 travelers');
    expect(coverage.getTravelersLabel('Traveler request: Plan this for a couple')).toBe('couple');
    expect(coverage.getTravelersLabel('Traveler request: I am going alone')).toBe('solo traveler');
    expect(coverage.getTravelersLabel('Traveler request: Plan it with friends')).toBe('group');
    expect(coverage.getTravelersLabel('Traveler request: Still deciding')).toBe('travel party not locked');

    expect(coverage.getPaceStopTarget('packed')).toContain('up to 3 meaningful stops');
    expect(coverage.getPaceStopTarget('balanced')).toContain('2 main anchors');

    const missing = coverage.getMissingItineraryBriefQuestions(
      'Traveler request: Build an itinerary',
      'Fort Worth, TX',
      'Austin, TX',
      '2026-06-01 to 2026-06-01',
      '',
      '',
    );
    expect(missing).toEqual(expect.arrayContaining([
      'How many days is the trip?',
      expect.stringContaining('What are your interests'),
      expect.stringContaining('Do you want the pace'),
      expect.stringContaining('Who are you traveling with'),
    ]));

    const canceledChat = [
      'Scope AI: How many days should I plan for?',
      'User: cancel this itinerary build',
      'Scope AI: I stopped that itinerary build. Ask me to build again when the route brief is ready.',
    ].join('\n');
    expect(coverage.promptHasPendingItineraryBrief('Traveler request: relaxed', canceledChat)).toBe(false);

    const longPlan = coverage.buildConciseItineraryAnswer(
      [
        'Trip duration: 7 days',
        'Travelers: 3',
        'Traveler request: Build a packed itinerary',
      ].join('\n'),
      'Fort Worth, TX to Austin, TX',
      '2026-06-01 to 2026-06-07',
      '$800 - $1,400',
      'packed',
      'culture, scenic, shopping, nightlife, adventure',
      '',
    );
    expect(longPlan).toContain('Later days');
    expect(longPlan).toContain('culture or history stop');
    expect(longPlan).toContain('scenic or outdoor stop');
    expect(longPlan).toContain('shopping district or market');
    expect(longPlan).toContain('nightlife option');
    expect(longPlan).toContain('active stop');

    const repeated = coverage.ensureFreshFinalAnswer(
      'Keep the route focused.',
      'Scope AI: Keep the route focused.',
      'tighten it again',
      4,
    );
    expect(repeated).toContain('Keep the route focused.');
    expect(repeated).toContain('Fresh angle');
  });
});
