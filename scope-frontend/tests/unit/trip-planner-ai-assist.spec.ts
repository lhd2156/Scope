import { flushPromises, mount } from '@vue/test-utils';
import { nextTick } from 'vue';
import TripPlannerAiAssist from '@/components/trips/TripPlannerAiAssist.vue';

const planTripMock = vi.hoisted(() => vi.fn());
const searchPlacesMock = vi.hoisted(() => vi.fn());
const searchLocationsMock = vi.hoisted(() => vi.fn());
const trackScopeAiInteractionMock = vi.hoisted(() => vi.fn());

vi.mock('@/services/agentService', () => ({
  planTrip: planTripMock,
}));

vi.mock('@/services/mapService', () => ({
  searchPlaces: searchPlacesMock,
  searchLocations: searchLocationsMock,
}));

vi.mock('@/services/analyticsService', () => ({
  trackScopeAiInteraction: trackScopeAiInteractionMock,
}));

vi.mock('@/utils/analyticsConsent', () => ({
  useAnalyticsConsent: () => ({
    consent: { value: 'granted' },
  }),
}));

describe('TripPlannerAiAssist', () => {
  const createObjectUrlMock = vi.fn(() => 'blob:scope-chat-image');
  const revokeObjectUrlMock = vi.fn();

  beforeEach(() => {
    planTripMock.mockReset();
    searchPlacesMock.mockReset();
    searchLocationsMock.mockReset();
    trackScopeAiInteractionMock.mockReset();
    createObjectUrlMock.mockClear();
    revokeObjectUrlMock.mockClear();
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: createObjectUrlMock,
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      value: revokeObjectUrlMock,
    });
    planTripMock.mockResolvedValue({
      itinerary: 'Add a lunch stop near Waco and keep the final drive under 3 hours.',
      model: 'scope-local',
      steps: 4,
    });
    searchPlacesMock.mockResolvedValue({ data: [] });
    searchLocationsMock.mockResolvedValue({ data: [] });
  });

  it('asks the trip agent with the current draft context', async () => {
    const wrapper = mount(TripPlannerAiAssist, {
      props: {
        userId: 'user-1',
        tripTitle: 'Texas weekend',
        draft: {
          destination: 'Fort Worth, TX',
          endDestination: 'Austin, TX',
          startDate: '2026-05-08',
          endDate: '2026-05-10',
          budgetFloor: 500,
          budget: 1500,
          interests: ['food', 'scenic'],
          pace: 'moderate',
          groupSize: 2,
        },
        stops: [{
          spotId: 'stop-1',
          title: 'Waco lunch',
          latitude: 31.5493,
          longitude: -97.1467,
          category: 'food',
          city: 'Waco',
        }],
      },
    });

    await wrapper.get('[data-test="trip-ai-input"]').setValue('Check this route');
    await wrapper.get('[data-test="trip-ai-form"]').trigger('submit');
    await flushPromises();

    expect(planTripMock).toHaveBeenCalledWith(expect.objectContaining({
      user_id: 'user-1',
      start_date: '2026-05-08',
      prompt: expect.stringContaining('Title: Texas weekend'),
    }));
    expect(planTripMock.mock.calls[0][0].prompt).toContain('Start: Fort Worth, TX');
    expect(planTripMock.mock.calls[0][0].prompt).toContain('End: Austin, TX');
    expect(planTripMock.mock.calls[0][0].prompt).toContain('Stops:');
    expect(wrapper.get('[data-test="trip-ai-user-message"]').text()).toContain('Check this route');
    expect(wrapper.get('[data-test="trip-ai-response"]').text()).toContain('Add a lunch stop near Waco');
    expect(wrapper.get('[data-test="trip-ai-quickbar"]').exists()).toBe(true);
    expect(wrapper.get('[data-test="trip-ai-context"]').attributes('data-context-state')).toBe('expanded');
    expect(trackScopeAiInteractionMock).toHaveBeenCalledWith(expect.objectContaining({
      source: 'typed',
      prompt: 'Check this route',
      assistantResponse: 'Add a lunch stop near Waco and keep the final drive under 3 hours.',
      responseKind: 'text',
      responseModel: 'scope-local',
      hasStart: true,
      hasEnd: true,
      stopCount: 1,
      interestCount: 2,
      routeName: 'trip-planner',
    }));
  });

  it('renders plain conversational replies without a fake summary header', async () => {
    planTripMock.mockResolvedValueOnce({
      itinerary: 'Hey, I am here. Tell me what you want to check and I will keep it clear.',
      model: 'scope-local-copilot',
      steps: 0,
    });

    const wrapper = mount(TripPlannerAiAssist, {
      props: {
        tripTitle: 'Texas weekend',
        draft: {
          destination: '',
          endDestination: '',
          startDate: '2026-05-08',
          endDate: '2026-05-10',
          budgetFloor: 500,
          budget: 1500,
          interests: ['scenic'],
          pace: 'relaxed',
          groupSize: 2,
        },
      },
    });

    await wrapper.get('[data-test="trip-ai-input"]').setValue('yo');
    await wrapper.get('[data-test="trip-ai-form"]').trigger('submit');
    await flushPromises();

    const responseText = wrapper.get('[data-test="trip-ai-response"]').text();
    expect(responseText).toContain('Hey, I am here');
    expect(responseText).not.toContain('Summary');
    expect(responseText).not.toContain('Ask me one of these');
  });

  it('opens chat actions without showing the old ready status chip', async () => {
    const wrapper = mount(TripPlannerAiAssist, {
      props: {
        tripTitle: 'Texas weekend',
        draft: {
          destination: 'Fort Worth, TX',
          endDestination: 'Austin, TX',
          startDate: '2026-05-08',
          endDate: '2026-05-10',
          budgetFloor: 500,
          budget: 1500,
          interests: ['scenic'],
          pace: 'relaxed',
          groupSize: 2,
        },
      },
    });

    expect(wrapper.find('.trip-ai-assist__status').exists()).toBe(false);

    await wrapper.get('[data-test="trip-ai-menu-button"]').trigger('click');

    expect(wrapper.get('[data-test="trip-ai-menu"]').text()).toContain('Restart Chat');
    expect(wrapper.get('[data-test="trip-ai-menu"]').text()).toContain('Save Transcript');
  });

  it('restarts the chat only after confirmation', async () => {
    const originalConfirm = window.confirm;
    Object.defineProperty(window, 'confirm', {
      configurable: true,
      value: vi.fn(() => true),
    });

    const wrapper = mount(TripPlannerAiAssist, {
      props: {
        tripTitle: 'Texas weekend',
        draft: {
          destination: 'Fort Worth, TX',
          endDestination: 'Austin, TX',
          startDate: '2026-05-08',
          endDate: '2026-05-10',
          budgetFloor: 500,
          budget: 1500,
          interests: ['scenic'],
          pace: 'relaxed',
          groupSize: 2,
        },
      },
    });

    await wrapper.get('[data-test="trip-ai-input"]').setValue('Check this route');
    await wrapper.get('[data-test="trip-ai-form"]').trigger('submit');
    await flushPromises();

    expect(wrapper.find('[data-test="trip-ai-user-message"]').exists()).toBe(true);

    await wrapper.get('[data-test="trip-ai-menu-button"]').trigger('click');
    await wrapper.get('[data-test="trip-ai-restart"]').trigger('click');
    await nextTick();

    expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining('Restart this Scope AI chat'));
    expect(wrapper.find('[data-test="trip-ai-user-message"]').exists()).toBe(false);
    expect(wrapper.get('[data-test="trip-ai-starter"]').text()).toContain('I already have Fort Worth, TX to Austin, TX');

    Object.defineProperty(window, 'confirm', {
      configurable: true,
      value: originalConfirm,
    });
  });

  it('exports the full chat transcript as a text file', async () => {
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    const wrapper = mount(TripPlannerAiAssist, {
      props: {
        tripTitle: 'Texas weekend',
        draft: {
          destination: 'Fort Worth, TX',
          endDestination: 'Austin, TX',
          startDate: '2026-05-08',
          endDate: '2026-05-10',
          budgetFloor: 500,
          budget: 1500,
          interests: ['scenic'],
          pace: 'relaxed',
          groupSize: 2,
        },
      },
    });

    await wrapper.get('[data-test="trip-ai-input"]').setValue('Check this route');
    await wrapper.get('[data-test="trip-ai-form"]').trigger('submit');
    await flushPromises();
    createObjectUrlMock.mockClear();

    await wrapper.get('[data-test="trip-ai-menu-button"]').trigger('click');
    await wrapper.get('[data-test="trip-ai-save-transcript"]').trigger('click');

    expect(createObjectUrlMock).toHaveBeenCalledWith(expect.any(Blob));
    expect(clickSpy).toHaveBeenCalled();

    clickSpy.mockRestore();
  });

  it('shows one clean thinking message without a duplicate literal ellipsis', async () => {
    let resolvePlan: ((value: { itinerary: string; model: string; steps: number }) => void) | undefined;
    planTripMock.mockReturnValueOnce(new Promise((resolve) => {
      resolvePlan = resolve;
    }));

    const wrapper = mount(TripPlannerAiAssist, {
      props: {
        tripTitle: 'Texas weekend',
        draft: {
          destination: '',
          endDestination: '',
          startDate: '2026-05-08',
          endDate: '2026-05-10',
          budgetFloor: 500,
          budget: 1500,
          interests: ['scenic'],
          pace: 'relaxed',
          groupSize: 2,
        },
      },
    });

    await wrapper.get('[data-test="trip-ai-input"]').setValue('hey');
    await wrapper.get('[data-test="trip-ai-form"]').trigger('submit');
    await nextTick();

    const thinkingMessage = wrapper.get('.trip-ai-assist__message--thinking');
    expect(thinkingMessage.text()).toContain('Thinking through this route');
    expect(thinkingMessage.text()).not.toContain('...');

    resolvePlan?.({
      itinerary: 'Hey, I am here. What should we check first?',
      model: 'scope-local-copilot',
      steps: 0,
    });
    await flushPromises();
  });

  it('moves the copilot into the stable active chat layout after the first turn', async () => {
    const wrapper = mount(TripPlannerAiAssist, {
      props: {
        tripTitle: 'Texas weekend',
        draft: {
          destination: '',
          endDestination: '',
          startDate: '2026-05-08',
          endDate: '2026-05-10',
          budgetFloor: 500,
          budget: 1500,
          interests: ['scenic'],
          pace: 'relaxed',
          groupSize: 2,
        },
      },
    });

    await wrapper.get('[data-test="trip-ai-input"]').setValue('yo');
    await wrapper.get('[data-test="trip-ai-form"]').trigger('submit');
    await flushPromises();

    const shell = wrapper.get('[data-test="trip-ai-assist"]');
    expect(shell.attributes('data-chat-state')).toBe('active');
    expect(shell.attributes('style') ?? '').not.toContain('--trip-ai-assist-locked-height');
  });

  it('keeps internal model labels out of visible assistant replies', async () => {
    const wrapper = mount(TripPlannerAiAssist, {
      props: {
        tripTitle: 'Texas weekend',
        draft: {
          destination: 'Fort Worth, TX',
          endDestination: 'Austin, TX',
          startDate: '2026-05-08',
          endDate: '2026-05-10',
          budgetFloor: 500,
          budget: 1500,
          interests: ['scenic'],
          pace: 'relaxed',
          groupSize: 2,
        },
      },
    });

    await wrapper.get('[data-test="trip-ai-input"]').setValue('Check this route');
    await wrapper.get('[data-test="trip-ai-form"]').trigger('submit');
    await flushPromises();

    expect(wrapper.get('[data-test="trip-ai-response"]').text()).toContain('Add a lunch stop near Waco');
    expect(wrapper.get('[data-test="trip-ai-response"]').text()).not.toContain('scope-local');
  });

  it('shows tailored suggestion prompts from the current trip draft', () => {
    const wrapper = mount(TripPlannerAiAssist, {
      props: {
        tripTitle: 'Texas weekend',
        draft: {
          destination: 'Fort Worth, TX',
          endDestination: 'Austin, TX',
          startDate: '2026-05-08',
          endDate: '2026-05-10',
          budgetFloor: 500,
          budget: 1500,
          interests: ['food', 'scenic'],
          pace: 'moderate',
          groupSize: 2,
        },
        stops: [{
          spotId: 'stop-1',
          title: 'Waco lunch',
          latitude: 31.5493,
          longitude: -97.1467,
          category: 'food',
          city: 'Waco',
        }],
      },
    });

    const suggestions = wrapper.findAll('[data-test="trip-ai-suggestion"]').map((button) => button.text());
    expect(wrapper.get('[data-test="trip-ai-starter"]').text()).toContain('I already have Fort Worth, TX to Austin, TX');
    expect(wrapper.get('[data-test="trip-ai-learning-note"]').text()).toContain('opted-in chats');
    expect(suggestions).toHaveLength(3);
    expect(suggestions[0]).toContain('Build the itinerary');
    expect(suggestions.join(' ')).toMatch(/Fort Worth|Austin|food|scenic|\$500|2026-05-08|route|stop/i);
    expect(suggestions).not.toEqual([
      'Tighten this route and call out missing stops',
      'Check if the dates and pace are realistic',
      'Find a coffee or scenic stop near this route',
    ]);
  });

  it('handles a suggested prompt when a suggestion is clicked', async () => {
    const wrapper = mount(TripPlannerAiAssist, {
      props: {
        tripTitle: '',
        draft: {
          destination: '',
          endDestination: '',
          startDate: '2026-05-08',
          endDate: '2026-05-10',
          budgetFloor: 500,
          budget: 1500,
          interests: [],
          pace: 'moderate',
          groupSize: 2,
        },
      },
    });

    await wrapper.findAll('[data-test="trip-ai-suggestion"]')[0]?.trigger('click');
    await flushPromises();

    expect(wrapper.findAll('[data-test="trip-ai-user-message"]')).toHaveLength(1);
    expect(wrapper.findAll('[data-test="trip-ai-response"]')).toHaveLength(1);
    if (planTripMock.mock.calls.length) {
      expect(planTripMock.mock.calls[0][0].prompt).toContain('Traveler request:');
    } else if (searchPlacesMock.mock.calls.length) {
      expect(searchPlacesMock).toHaveBeenCalled();
    } else {
      expect(
        wrapper.emitted('itinerary-build-request')
        ?? wrapper.get('[data-test="trip-ai-response"]').text(),
      ).toBeTruthy();
    }
  });

  it('appends follow-up prompts and answers instead of replacing the conversation', async () => {
    const wrapper = mount(TripPlannerAiAssist, {
      props: {
        tripTitle: 'Texas weekend',
        draft: {
          destination: 'Fort Worth, TX',
          endDestination: 'Austin, TX',
          startDate: '2026-05-08',
          endDate: '2026-05-10',
          budgetFloor: 500,
          budget: 1500,
          interests: ['food', 'scenic'],
          pace: 'moderate',
          groupSize: 2,
        },
      },
    });

    await wrapper.get('[data-test="trip-ai-input"]').setValue('Keep this plan inside budget');
    await wrapper.get('[data-test="trip-ai-form"]').trigger('submit');
    await flushPromises();

    await wrapper.findAll('[data-test="trip-ai-quick-suggestion"]')[0]?.trigger('click');
    await flushPromises();

    expect(planTripMock).toHaveBeenCalled();
    expect(wrapper.findAll('[data-test="trip-ai-user-message"]')).toHaveLength(2);
    expect(wrapper.findAll('[data-test="trip-ai-response"], [data-test="trip-ai-place-results"]')).toHaveLength(2);
    expect(wrapper.get('[data-test="trip-ai-thread"]').text()).toContain('Keep this plan inside budget');
  });

  it('passes recent chat into follow-up trip agent prompts', async () => {
    planTripMock
      .mockResolvedValueOnce({
        itinerary: 'First timing answer',
        model: 'scope-local',
        steps: 1,
      })
      .mockResolvedValueOnce({
        itinerary: 'Second timing angle',
        model: 'scope-local',
        steps: 1,
      });

    const wrapper = mount(TripPlannerAiAssist, {
      props: {
        tripTitle: 'Texas weekend',
        draft: {
          destination: 'Fort Worth, TX',
          endDestination: 'Austin, TX',
          startDate: '2026-05-08',
          endDate: '2026-05-10',
          budgetFloor: 500,
          budget: 1500,
          interests: ['food', 'scenic'],
          pace: 'moderate',
          groupSize: 2,
        },
      },
    });

    await wrapper.get('[data-test="trip-ai-input"]').setValue('How does timing look?');
    await wrapper.get('[data-test="trip-ai-form"]').trigger('submit');
    await flushPromises();

    await wrapper.get('[data-test="trip-ai-input"]').setValue('Can you explain the timing another way?');
    await wrapper.get('[data-test="trip-ai-form"]').trigger('submit');
    await flushPromises();

    const secondPrompt = planTripMock.mock.calls[1][0].prompt;
    expect(secondPrompt).toContain('Recent chat:');
    expect(secondPrompt).toContain('User: How does timing look?');
    expect(secondPrompt).toContain('Scope AI: First timing answer');
    expect(secondPrompt).toContain('Traveler request: Can you explain the timing another way?');
  });

  it('lets travelers attach images to a chat turn', async () => {
    const wrapper = mount(TripPlannerAiAssist, {
      props: {
        tripTitle: 'Texas weekend',
        draft: {
          destination: 'Fort Worth, TX',
          endDestination: 'Austin, TX',
          startDate: '2026-05-08',
          endDate: '2026-05-10',
          budgetFloor: 500,
          budget: 1500,
          interests: ['food', 'scenic'],
          pace: 'moderate',
          groupSize: 2,
        },
      },
    });

    const imageFile = new File(['scope'], 'route-photo.png', { type: 'image/png' });
    const fileInput = wrapper.get('[data-test="trip-ai-file-input"]').element as HTMLInputElement;
    Object.defineProperty(fileInput, 'files', {
      configurable: true,
      value: [imageFile],
    });

    await wrapper.get('[data-test="trip-ai-file-input"]').trigger('change');
    expect(wrapper.get('[data-test="trip-ai-pending-attachments"]').text()).toContain('route-photo.png');

    await wrapper.get('[data-test="trip-ai-input"]').setValue('Does this stop fit the route?');
    await wrapper.get('[data-test="trip-ai-form"]').trigger('submit');
    await flushPromises();

    expect(planTripMock.mock.calls[0][0].prompt).toContain('Attached images:');
    expect(planTripMock.mock.calls[0][0].prompt).toContain('route-photo.png');
    expect(wrapper.get('[data-test="trip-ai-user-attachments"]').text()).toContain('route-photo.png');
  });

  it('starts the planner build when asked to tighten a route with no committed stops', async () => {
    const wrapper = mount(TripPlannerAiAssist, {
      props: {
        tripTitle: 'Texas weekend',
        draft: {
          destination: 'Fort Worth, TX',
          endDestination: 'Austin, TX',
          destinationLatitude: 32.7555,
          destinationLongitude: -97.3308,
          endDestinationLatitude: 30.2672,
          endDestinationLongitude: -97.7431,
          startDate: '2026-05-08',
          endDate: '2026-05-10',
          budgetFloor: 500,
          budget: 1500,
          interests: ['food', 'scenic'],
          pace: 'moderate',
          groupSize: 2,
        },
      },
    });

    await wrapper.get('[data-test="trip-ai-input"]').setValue('Tighten this route and remove filler');
    await wrapper.get('[data-test="trip-ai-form"]').trigger('submit');
    await flushPromises();

    expect(planTripMock).not.toHaveBeenCalled();
    expect(wrapper.emitted('itinerary-build-request')?.[0]?.[0]).toMatchObject({
      prompt: 'Tighten this route and remove filler',
      reason: 'tighten',
    });
    expect(wrapper.get('[data-test="trip-ai-response"]').text()).toContain('handed Fort Worth, TX to Austin, TX to Scope AI');
  });

  it('asks for a destination conversationally before route-action builds', async () => {
    const wrapper = mount(TripPlannerAiAssist, {
      props: {
        tripTitle: 'Texas weekend',
        draft: {
          destination: '',
          endDestination: '',
          startDate: '2026-05-08',
          endDate: '2026-05-10',
          budgetFloor: 500,
          budget: 1500,
          interests: ['food', 'scenic'],
          pace: 'moderate',
          groupSize: 2,
        },
      },
    });

    await wrapper.get('[data-test="trip-ai-input"]').setValue('Build a balanced first draft');
    await wrapper.get('[data-test="trip-ai-form"]').trigger('submit');
    await flushPromises();

    const responseText = wrapper.get('[data-test="trip-ai-response"]').text();
    expect(planTripMock).not.toHaveBeenCalled();
    expect(responseText).toContain('What destination should I use');
    expect(responseText).not.toContain('actually change');
    expect(responseText).not.toContain('Summary');
  });

  it('asks for missing itinerary brief details before route-action builds', async () => {
    const wrapper = mount(TripPlannerAiAssist, {
      props: {
        tripTitle: 'Texas weekend',
        draft: {
          destination: 'Fort Worth, TX',
          endDestination: 'Austin, TX',
          startDate: '2026-05-08',
          endDate: '2026-05-10',
          budgetFloor: 500,
          budget: 1500,
          interests: [],
          pace: 'moderate',
          groupSize: 2,
        },
      },
    });

    await wrapper.get('[data-test="trip-ai-input"]').setValue('Build a balanced first draft');
    await wrapper.get('[data-test="trip-ai-form"]').trigger('submit');
    await flushPromises();

    const responseText = wrapper.get('[data-test="trip-ai-response"]').text();
    expect(planTripMock).not.toHaveBeenCalled();
    expect(wrapper.emitted('itinerary-build-request')).toBeUndefined();
    expect(responseText).toContain('What kind of trip should this feel like');
    expect(responseText).not.toContain('-');
    expect(responseText).not.toContain('morning, afternoon, and evening');
    expect(responseText).not.toContain('handed Fort Worth, TX to Austin, TX to Scope AI');
  });

  it('treats vague help replies as surprise me and builds with smart defaults from the pending brief', async () => {
    const wrapper = mount(TripPlannerAiAssist, {
      props: {
        tripTitle: 'Texas road trip',
        draft: {
          destination: 'Robert Lee, Texas',
          endDestination: '177 Kothman Road, La Vernia',
          startDate: '2026-05-08',
          endDate: '2026-05-08',
          budgetFloor: 500,
          budget: 1500,
          interests: [],
          pace: 'relaxed',
          groupSize: 2,
        },
      },
    });

    await wrapper.get('[data-test="trip-ai-input"]').setValue('Build the itinerary from Robert Lee, Texas to 177 Kothman Road, La Vernia');
    await wrapper.get('[data-test="trip-ai-form"]').trigger('submit');
    await flushPromises();

    expect(wrapper.get('[data-test="trip-ai-response"]').text()).toContain('How many days should I plan for?');
    expect(wrapper.get('[data-test="trip-ai-response"]').text()).not.toContain('What kind of trip should this feel like');
    expect(wrapper.emitted('itinerary-build-request')).toBeUndefined();

    await wrapper.get('[data-test="trip-ai-input"]').setValue('idk u wanna help');
    await wrapper.get('[data-test="trip-ai-form"]').trigger('submit');
    await flushPromises();

    const buildPayload = wrapper.emitted('itinerary-build-request')?.[0]?.[0];
    expect(buildPayload).toMatchObject({
      reason: 'build',
      draftDefaults: {
        startDate: '2026-05-08',
        endDate: '2026-05-09',
        interests: ['food', 'culture', 'scenic'],
      },
    });
    expect(buildPayload?.prompt).toContain('Smart defaults from follow-up');
    expect(wrapper.findAll('[data-test="trip-ai-response"]').at(-1)?.text()).toContain('handed Robert Lee, Texas to 177 Kothman Road, La Vernia to Scope AI');
  });

  it('treats broad noncommittal follow-ups as surprise me instead of literal-only phrases', async () => {
    const vagueReplies = [
      'whatever you think',
      'no preference',
      'you-pick',
      'sounds good',
      'surprise us',
      'do your thing',
      'I trust you',
    ];

    for (const reply of vagueReplies) {
      const wrapper = mount(TripPlannerAiAssist, {
        props: {
          tripTitle: 'Texas road trip',
          draft: {
            destination: 'Robert Lee, Texas',
            endDestination: '177 Kothman Road, La Vernia',
            startDate: '2026-05-08',
            endDate: '2026-05-08',
            budgetFloor: 500,
            budget: 1500,
            interests: [],
            pace: 'relaxed',
            groupSize: 2,
          },
        },
      });

      await wrapper.get('[data-test="trip-ai-input"]').setValue('Build the itinerary from Robert Lee, Texas to 177 Kothman Road, La Vernia');
      await wrapper.get('[data-test="trip-ai-form"]').trigger('submit');
      await flushPromises();

      await wrapper.get('[data-test="trip-ai-input"]').setValue(reply);
      await wrapper.get('[data-test="trip-ai-form"]').trigger('submit');
      await flushPromises();

      const buildPayload = wrapper.emitted('itinerary-build-request')?.[0]?.[0];
      expect(buildPayload, reply).toMatchObject({
        reason: 'build',
        draftDefaults: {
          startDate: '2026-05-08',
          endDate: '2026-05-09',
          interests: ['food', 'culture', 'scenic'],
        },
      });
      expect(wrapper.findAll('[data-test="trip-ai-response"]').at(-1)?.text(), reply).not.toContain('What kind of trip should this feel like');

      wrapper.unmount();
    }
  });

  it('keeps brief answers attached to the pending itinerary question one at a time', async () => {
    const wrapper = mount(TripPlannerAiAssist, {
      props: {
        tripTitle: 'Texas road trip',
        draft: {
          destination: 'Robert Lee, Texas',
          endDestination: '177 Kothman Road, La Vernia',
          startDate: '2026-05-08',
          endDate: '2026-05-08',
          budgetFloor: 500,
          budget: 1500,
          interests: [],
          pace: 'relaxed',
          groupSize: 2,
        },
      },
    });

    await wrapper.get('[data-test="trip-ai-input"]').setValue('Build the itinerary from Robert Lee to La Vernia');
    await wrapper.get('[data-test="trip-ai-form"]').trigger('submit');
    await flushPromises();

    await wrapper.get('[data-test="trip-ai-input"]').setValue('3 days');
    await wrapper.get('[data-test="trip-ai-form"]').trigger('submit');
    await flushPromises();

    const responses = wrapper.findAll('[data-test="trip-ai-response"]');
    expect(responses.at(-1)?.text()).toContain('Got it. What kind of trip should this feel like');
    expect(wrapper.emitted('itinerary-build-request')).toBeUndefined();

    await wrapper.get('[data-test="trip-ai-input"]').setValue('food and culture');
    await wrapper.get('[data-test="trip-ai-form"]').trigger('submit');
    await flushPromises();

    const buildPayload = wrapper.emitted('itinerary-build-request')?.[0]?.[0];
    expect(buildPayload).toMatchObject({
      reason: 'build',
      draftDefaults: {
        startDate: '2026-05-08',
        endDate: '2026-05-10',
        interests: ['food', 'culture'],
      },
    });
  });

  it('allows one-place destination itinerary builds when the brief is complete', async () => {
    const wrapper = mount(TripPlannerAiAssist, {
      props: {
        tripTitle: 'Patagonia itinerary',
        draft: {
          destination: 'Patagonia',
          endDestination: '',
          startDate: '2026-05-08',
          endDate: '2026-05-10',
          budgetFloor: 500,
          budget: 1500,
          interests: ['adventure'],
          pace: 'relaxed',
          groupSize: 1,
        },
      },
    });

    await wrapper.get('[data-test="trip-ai-input"]').setValue('Build the itinerary starting from Patagonia');
    await wrapper.get('[data-test="trip-ai-form"]').trigger('submit');
    await flushPromises();

    expect(planTripMock).not.toHaveBeenCalled();
    expect(wrapper.emitted('itinerary-build-request')?.[0]?.[0]).toMatchObject({
      prompt: 'Build the itinerary starting from Patagonia',
      reason: 'build',
    });
    expect(wrapper.get('[data-test="trip-ai-response"]').text()).toContain('handed Patagonia to Scope AI');
  });

  it('keeps route actions in a working state until the planner returns', async () => {
    let capturedRequest: {
      handled: boolean;
      resolve: (result: { status: 'success'; routeLabel: string; stopCount: number }) => void;
    } | null = null;

    const wrapper = mount(TripPlannerAiAssist, {
      props: {
        tripTitle: 'Texas weekend',
        draft: {
          destination: 'Fort Worth, TX',
          endDestination: 'Austin, TX',
          destinationLatitude: 32.7555,
          destinationLongitude: -97.3308,
          endDestinationLatitude: 30.2672,
          endDestinationLongitude: -97.7431,
          startDate: '2026-05-08',
          endDate: '2026-05-10',
          budgetFloor: 500,
          budget: 1500,
          interests: ['food', 'scenic'],
          pace: 'moderate',
          groupSize: 2,
        },
        onItineraryBuildRequest: (payload: {
          handled: boolean;
          resolve: (result: { status: 'success'; routeLabel: string; stopCount: number }) => void;
        }) => {
          payload.handled = true;
          capturedRequest = payload;
        },
      },
    });

    await wrapper.get('[data-test="trip-ai-input"]').setValue('Build a simple weekend route');
    await wrapper.get('[data-test="trip-ai-form"]').trigger('submit');
    await flushPromises();

    expect(wrapper.find('[data-test="trip-ai-response"]').exists()).toBe(false);
    expect(wrapper.get('.trip-ai-assist__message--thinking').text()).toContain('Building a simple weekend route');

    capturedRequest?.resolve({
      status: 'success',
      routeLabel: 'Fort Worth, TX to Austin, TX',
      stopCount: 3,
    });
    await flushPromises();

    expect(wrapper.get('[data-test="trip-ai-response"]').text()).toContain('built Fort Worth, TX to Austin, TX into an itinerary with 3 stops');
  });

  it('does not replay an unchanged route build as a duplicate planner run', async () => {
    let requestCount = 0;

    const wrapper = mount(TripPlannerAiAssist, {
      props: {
        tripTitle: 'Texas weekend',
        draft: {
          destination: 'Fort Worth, TX',
          endDestination: 'Austin, TX',
          destinationLatitude: 32.7555,
          destinationLongitude: -97.3308,
          endDestinationLatitude: 30.2672,
          endDestinationLongitude: -97.7431,
          startDate: '2026-05-08',
          endDate: '2026-05-10',
          budgetFloor: 500,
          budget: 1500,
          interests: ['food', 'scenic'],
          pace: 'moderate',
          groupSize: 2,
        },
        onItineraryBuildRequest: (payload: {
          handled: boolean;
          resolve: (result: { status: 'success'; routeLabel: string; stopCount: number }) => void;
        }) => {
          requestCount += 1;
          payload.handled = true;
          payload.resolve({
            status: 'success',
            routeLabel: 'Fort Worth, TX to Austin, TX',
            stopCount: 3,
          });
        },
      },
    });

    await wrapper.get('[data-test="trip-ai-input"]').setValue('Build a simple weekend route');
    await wrapper.get('[data-test="trip-ai-form"]').trigger('submit');
    await flushPromises();

    await wrapper.get('[data-test="trip-ai-input"]').setValue('Build a simple weekend route');
    await wrapper.get('[data-test="trip-ai-form"]').trigger('submit');
    await flushPromises();

    const responses = wrapper.findAll('[data-test="trip-ai-response"]');
    expect(requestCount).toBe(1);
    expect(responses).toHaveLength(2);
    expect(responses[0]?.text()).toContain('built Fort Worth, TX to Austin, TX into an itinerary with 3 stops');
    expect(responses[0]?.text()).not.toContain('scope-action');
    expect(responses[1]?.text()).toContain('already built and synced');
  });

  it('keeps suggestive route wording in the chat instead of launching the planner', async () => {
    const wrapper = mount(TripPlannerAiAssist, {
      props: {
        tripTitle: 'Texas weekend',
        draft: {
          destination: 'Fort Worth, TX',
          endDestination: 'Austin, TX',
          destinationLatitude: 32.7555,
          destinationLongitude: -97.3308,
          endDestinationLatitude: 30.2672,
          endDestinationLongitude: -97.7431,
          startDate: '2026-05-08',
          endDate: '2026-05-10',
          budgetFloor: 500,
          budget: 1500,
          interests: ['food', 'scenic'],
          pace: 'moderate',
          groupSize: 2,
        },
      },
    });

    await wrapper.get('[data-test="trip-ai-input"]').setValue('Suggest a simple weekend route');
    await wrapper.get('[data-test="trip-ai-form"]').trigger('submit');
    await flushPromises();

    expect(planTripMock).toHaveBeenCalled();
    expect(wrapper.emitted('itinerary-build-request')).toBeUndefined();
    expect(wrapper.get('[data-test="trip-ai-response"]').text()).toContain('Add a lunch stop near Waco');
  });

  it('treats a balanced first draft prompt as a planner build action', async () => {
    const wrapper = mount(TripPlannerAiAssist, {
      props: {
        tripTitle: 'Texas weekend',
        draft: {
          destination: 'Fort Worth, TX',
          endDestination: 'Austin, TX',
          destinationLatitude: 32.7555,
          destinationLongitude: -97.3308,
          endDestinationLatitude: 30.2672,
          endDestinationLongitude: -97.7431,
          startDate: '2026-05-08',
          endDate: '2026-05-10',
          budgetFloor: 500,
          budget: 1500,
          interests: ['food', 'scenic'],
          pace: 'moderate',
          groupSize: 2,
        },
      },
    });

    await wrapper.get('[data-test="trip-ai-input"]').setValue('Build a balanced first draft');
    await wrapper.get('[data-test="trip-ai-form"]').trigger('submit');
    await flushPromises();

    expect(planTripMock).not.toHaveBeenCalled();
    expect(wrapper.emitted('itinerary-build-request')?.[0]?.[0]).toMatchObject({
      prompt: 'Build a balanced first draft',
      reason: 'build',
    });
    expect(wrapper.get('[data-test="trip-ai-response"]').text()).toContain('handed Fort Worth, TX to Austin, TX to Scope AI');
  });

  it('replaces duplicate committed stops when asked to tighten a route', async () => {
    const wrapper = mount(TripPlannerAiAssist, {
      props: {
        tripTitle: 'Texas weekend',
        draft: {
          destination: 'Fort Worth, TX',
          endDestination: 'Austin, TX',
          destinationLatitude: 32.7555,
          destinationLongitude: -97.3308,
          endDestinationLatitude: 30.2672,
          endDestinationLongitude: -97.7431,
          startDate: '2026-05-08',
          endDate: '2026-05-10',
          budgetFloor: 500,
          budget: 1500,
          interests: ['food', 'scenic'],
          pace: 'moderate',
          groupSize: 2,
        },
        stops: [
          {
            spotId: 'stop-1',
            title: 'Waco lunch',
            latitude: 31.5493,
            longitude: -97.1467,
            category: 'food',
            city: 'Waco',
          },
          {
            spotId: 'stop-2',
            title: 'Waco lunch',
            latitude: 31.5493,
            longitude: -97.1467,
            category: 'food',
            city: 'Waco',
          },
        ],
      },
    });

    await wrapper.get('[data-test="trip-ai-input"]').setValue('Tighten this route and remove filler');
    await wrapper.get('[data-test="trip-ai-form"]').trigger('submit');
    await flushPromises();

    const replacement = wrapper.emitted('route-stops-replace')?.[0]?.[0];
    expect(replacement).toHaveLength(1);
    expect(replacement?.[0]).toMatchObject({ title: 'Waco lunch' });
    expect(wrapper.get('[data-test="trip-ai-response"]').text()).toContain('removing 1 duplicate');
  });

  it('exposes a planner handoff method that starts the same Scope AI route-action flow', async () => {
    const wrapper = mount(TripPlannerAiAssist, {
      props: {
        tripTitle: 'Texas weekend',
        draft: {
          destination: 'Fort Worth, TX',
          endDestination: 'Austin, TX',
          destinationLatitude: 32.7555,
          destinationLongitude: -97.3308,
          endDestinationLatitude: 30.2672,
          endDestinationLongitude: -97.7431,
          startDate: '2026-05-08',
          endDate: '2026-05-10',
          budgetFloor: 500,
          budget: 1500,
          interests: ['food', 'scenic'],
          pace: 'moderate',
          groupSize: 2,
        },
      },
    });

    const vm = wrapper.vm as unknown as {
      handoffPlannerBrief: (options?: { prompt?: string }) => Promise<void>;
    };

    await vm.handoffPlannerBrief();
    await flushPromises();

    expect(planTripMock).not.toHaveBeenCalled();
    expect(wrapper.findAll('[data-test="trip-ai-user-message"]')).toHaveLength(1);
    expect(wrapper.emitted('itinerary-build-request')?.[0]?.[0]).toMatchObject({
      reason: 'build',
    });
    expect(wrapper.get('[data-test="trip-ai-response"]').text()).toContain('handed Fort Worth, TX to Austin, TX to Scope AI');
  });

  it('turns route midpoint stop requests into live place search results', async () => {
    searchPlacesMock.mockResolvedValue({
      data: [{
        id: 'poi.midpoint',
        latitude: 31.48,
        longitude: -97.12,
        placeName: 'Midway Coffee',
        formattedAddress: '10 Route Street, Waco, Texas',
        city: 'Waco',
        category: 'coffee shop',
        distanceKm: 4.2,
        source: 'mapbox',
      }],
    });

    const wrapper = mount(TripPlannerAiAssist, {
      props: {
        tripTitle: 'Texas weekend',
        draft: {
          destination: 'Fort Worth, TX',
          endDestination: 'Austin, TX',
          destinationLatitude: 32.7555,
          destinationLongitude: -97.3308,
          endDestinationLatitude: 30.2672,
          endDestinationLongitude: -97.7431,
          startDate: '2026-05-08',
          endDate: '2026-05-10',
          budgetFloor: 500,
          budget: 1500,
          interests: ['food', 'scenic'],
          pace: 'moderate',
          groupSize: 2,
        },
      },
    });

    await wrapper.get('[data-test="trip-ai-input"]').setValue('Find a local stop between Fort Worth and Austin');
    await wrapper.get('[data-test="trip-ai-form"]').trigger('submit');
    await flushPromises();

    expect(planTripMock).not.toHaveBeenCalled();
    expect(searchPlacesMock).toHaveBeenCalledWith('restaurant', {
      limit: 6,
      proximity: {
        latitude: (32.7555 + 30.2672) / 2,
        longitude: (-97.3308 + -97.7431) / 2,
      },
    });
    expect(wrapper.get('[data-test="trip-ai-thread"]').text()).toContain('Find a local stop between Fort Worth and Austin');
    expect(wrapper.get('[data-test="trip-ai-place-results"]').text()).toContain('Midway Coffee');
  });

  it('turns nearby place requests into live route-aware place search results', async () => {
    searchPlacesMock.mockResolvedValue({
      data: [{
        id: 'poi.123',
        latitude: 32.753,
        longitude: -97.333,
        placeName: 'Starbucks',
        formattedAddress: '100 Coffee Street, Fort Worth, Texas',
        city: 'Fort Worth',
        category: 'coffee shop',
        distanceKm: 1.6,
        source: 'mapbox',
      }],
    });

    const wrapper = mount(TripPlannerAiAssist, {
      props: {
        tripTitle: 'Texas weekend',
        draft: {
          destination: 'Fort Worth, TX',
          endDestination: 'Austin, TX',
          destinationLatitude: 32.7555,
          destinationLongitude: -97.3308,
          endDestinationLatitude: 30.2672,
          endDestinationLongitude: -97.7431,
          startDate: '2026-05-08',
          endDate: '2026-05-10',
          budgetFloor: 500,
          budget: 1500,
          interests: ['food', 'scenic'],
          pace: 'moderate',
          groupSize: 2,
        },
      },
    });

    await wrapper.get('[data-test="trip-ai-input"]').setValue('hey i wanna go to a closeby Starbucks');
    await wrapper.get('[data-test="trip-ai-form"]').trigger('submit');
    await flushPromises();

    expect(planTripMock).not.toHaveBeenCalled();
    expect(searchPlacesMock).toHaveBeenCalledWith('Starbucks', {
      limit: 6,
      proximity: {
        latitude: 32.7555,
        longitude: -97.3308,
      },
    });
    expect(wrapper.get('[data-test="trip-ai-place-results"]').text()).toContain('Starbucks');

    await wrapper.get('[data-test="trip-ai-place-add"]').trigger('click');

    expect(wrapper.emitted('route-stop-add')?.[0]?.[0]).toMatchObject({
      spotId: 'place-poi-123',
      title: 'Starbucks',
      latitude: 32.753,
      longitude: -97.333,
      category: 'food',
      city: 'Fort Worth',
    });
  });

  it('turns real-world where-is questions into live location search results without requiring route anchors', async () => {
    searchLocationsMock.mockResolvedValue({
      data: [{
        id: 'place.paris',
        latitude: 48.8566,
        longitude: 2.3522,
        placeName: 'Paris',
        formattedAddress: 'Paris, Ile-de-France, France',
        city: 'Paris',
        country: 'France',
        source: 'mapbox',
      }],
    });

    const wrapper = mount(TripPlannerAiAssist, {
      props: {
        tripTitle: '',
        draft: {
          destination: '',
          endDestination: '',
          startDate: '2026-05-08',
          endDate: '2026-05-10',
          budgetFloor: 500,
          budget: 1500,
          interests: ['scenic'],
          pace: 'moderate',
          groupSize: 2,
        },
      },
    });

    await wrapper.get('[data-test="trip-ai-input"]').setValue('where is Paris');
    await wrapper.get('[data-test="trip-ai-form"]').trigger('submit');
    await flushPromises();

    expect(planTripMock).not.toHaveBeenCalled();
    expect(searchPlacesMock).not.toHaveBeenCalled();
    expect(searchLocationsMock).toHaveBeenCalledWith('Paris', { limit: 6 });
    expect(wrapper.get('[data-test="trip-ai-place-results"]').text()).toContain('Paris, Ile-de-France, France');
  });

  it('turns address-style prompts into live location search results', async () => {
    searchLocationsMock.mockResolvedValue({
      data: [{
        id: 'address.botanic',
        latitude: 32.7495,
        longitude: -97.3621,
        placeName: 'Fort Worth Botanic Garden',
        formattedAddress: '3220 Botanic Garden Blvd, Fort Worth, Texas 76107, United States',
        city: 'Fort Worth',
        country: 'United States',
        source: 'mapbox',
      }],
    });

    const wrapper = mount(TripPlannerAiAssist, {
      props: {
        tripTitle: 'Texas weekend',
        draft: {
          destination: 'Fort Worth, TX',
          endDestination: 'Austin, TX',
          destinationLatitude: 32.7555,
          destinationLongitude: -97.3308,
          endDestinationLatitude: 30.2672,
          endDestinationLongitude: -97.7431,
          startDate: '2026-05-08',
          endDate: '2026-05-10',
          budgetFloor: 500,
          budget: 1500,
          interests: ['food', 'scenic'],
          pace: 'moderate',
          groupSize: 2,
        },
      },
    });

    await wrapper.get('[data-test="trip-ai-input"]').setValue('3220 Botanic Garden Blvd');
    await wrapper.get('[data-test="trip-ai-form"]').trigger('submit');
    await flushPromises();

    expect(planTripMock).not.toHaveBeenCalled();
    expect(searchPlacesMock).not.toHaveBeenCalled();
    expect(searchLocationsMock).toHaveBeenCalledWith('3220 Botanic Garden Blvd', {
      limit: 6,
      proximity: {
        latitude: 32.7555,
        longitude: -97.3308,
      },
    });
    expect(wrapper.get('[data-test="trip-ai-place-results"]').text()).toContain('Fort Worth Botanic Garden');
  });
});
