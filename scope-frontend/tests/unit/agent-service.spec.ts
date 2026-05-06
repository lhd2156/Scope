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
    apiPostMock.mockReset();
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

    expect(apiPostMock).toHaveBeenCalledWith('/api/intel/agent/plan-trip', {
      prompt: 'Plan a quick route',
      start_date: '2026-05-08',
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
});
