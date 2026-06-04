import { mount } from '@vue/test-utils';
import { defineComponent, nextTick } from 'vue';
import FloatingTripAiAssistant from '@/components/trips/FloatingTripAiAssistant.vue';

const handoffPlannerBriefMock = vi.fn();
const focusComposerMock = vi.fn();
const authStoreMock = vi.hoisted(() => ({
  currentUser: {
    id: 'user-1',
    interests: [] as string[],
  },
}));

vi.mock('@/stores/auth', () => ({
  useAuthStore: () => authStoreMock,
}));

const TripPlannerAiAssistStub = defineComponent({
  name: 'TripPlannerAiAssist',
  props: {
    draft: {
      type: Object,
      required: true,
    },
    locationSearchProximity: {
      type: Object,
      required: false,
      default: undefined,
    },
    tripTitle: {
      type: String,
      required: true,
    },
    stops: {
      type: Array,
      required: true,
    },
    userId: {
      type: String,
      required: false,
      default: undefined,
    },
  },
  emits: ['route-stop-add', 'route-stops-replace', 'itinerary-build-request'],
  setup(_props, { emit, expose }) {
    expose({
      handoffPlannerBrief: handoffPlannerBriefMock,
      focusComposer: focusComposerMock,
    });

    return { emit };
  },
  template: `
    <div data-test="trip-ai-child">
      <button
        data-test="child-add-stop"
        @click="emit('route-stop-add', { spotId: 'child-stop', title: 'Child Stop', category: 'food', position: 1 })"
      >
        Add stop
      </button>
      <button
        data-test="child-replace-stops"
        @click="emit('route-stops-replace', [{ spotId: 'replacement-stop', title: 'Replacement Stop', category: 'scenic', position: 1 }])"
      >
        Replace stops
      </button>
      <button
        data-test="child-build-request"
        @click="emit('itinerary-build-request', {
          prompt: 'Build this route',
          reason: 'build',
          handled: false,
          resolve: () => {},
          reject: () => {},
        })"
      >
        Build route
      </button>
    </div>
  `,
});

function mountAssistant(props: Record<string, unknown> = {}) {
  return mount(FloatingTripAiAssistant, {
    props,
    global: {
      stubs: {
        ScopeIcon: {
          props: ['name'],
          template: '<span data-test="scope-icon">{{ name }}</span>',
        },
        TripPlannerAiAssist: TripPlannerAiAssistStub,
      },
    },
  });
}

describe('FloatingTripAiAssistant', () => {
  beforeEach(() => {
    authStoreMock.currentUser.interests = [];
    handoffPlannerBriefMock.mockReset();
    handoffPlannerBriefMock.mockResolvedValue(true);
    focusComposerMock.mockReset();
    focusComposerMock.mockResolvedValue(undefined);
  });

  it('opens and closes the floating Scope AI panel from the trigger buttons', async () => {
    const wrapper = mountAssistant();

    expect(wrapper.attributes('data-open')).toBe('false');
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false);

    await wrapper.get('[data-test="floating-trip-ai-button"]').trigger('click');

    expect(wrapper.attributes('data-open')).toBe('true');
    expect(wrapper.get('[role="dialog"]').attributes('aria-label')).toBe('Scope AI trip assistant');

    await wrapper.get('.floating-trip-ai__close').trigger('click');

    expect(wrapper.attributes('data-open')).toBe('false');
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false);
  });

  it('derives the assistant draft, title, stops, and party size from the current trip', async () => {
    const wrapper = mountAssistant({
      startOpen: true,
      userId: 'user-2',
      locationSearchProximity: {
        label: 'current location',
        latitude: 32.7767,
        longitude: -96.797,
      },
      trip: {
        id: 'trip-1',
        title: 'North Texas Food Run',
        destination: 'Fort Worth, TX',
        startDate: '2026-05-08',
        endDate: '2026-05-10',
        budget: 1200,
        spots: [
          { spotId: 'stockyards', title: 'Stockyards', city: 'Fort Worth', category: 'culture', position: 1 },
          { spotId: 'waco-lunch', title: 'Waco Lunch', city: 'Waco', category: 'food', position: 2 },
        ],
        members: [{ id: 'user-1', displayName: 'Louis Do', status: 'owner' }],
      },
      members: [
        { id: 'user-1', displayName: 'Louis Do', status: 'owner' },
        { id: 'user-2', displayName: 'Maya Scope', status: 'editor' },
      ],
    });

    await nextTick();

    const child = wrapper.getComponent(TripPlannerAiAssistStub);
    expect(child.props('tripTitle')).toBe('North Texas Food Run');
    expect(child.props('userId')).toBe('user-2');
    expect(child.props('stops')).toHaveLength(2);
    expect(child.props('locationSearchProximity')).toEqual({
      label: 'current location',
      latitude: 32.7767,
      longitude: -96.797,
    });
    expect(child.props('draft')).toMatchObject({
      destination: 'Fort Worth, TX',
      endDestination: 'Waco',
      startDate: '2026-05-08',
      endDate: '2026-05-10',
      budgetFloor: 420,
      budget: 1200,
      interests: ['culture', 'food'],
      pace: 'moderate',
      groupSize: 2,
    });
  });

  it('normalizes explicit draft props without mutating the original draft object', async () => {
    const draft = {
      destination: 'Dallas',
      startDate: '2026-06-01',
      endDate: '2026-06-03',
      budget: 900,
      interests: ['food'],
      pace: 'relaxed',
      groupSize: 1,
    };

    const wrapper = mountAssistant({
      startOpen: true,
      tripTitle: '  Custom draft  ',
      draft,
      stops: [{ spotId: 'coffee', title: 'Coffee Stop', category: 'food', position: 1 }],
    });

    const child = wrapper.getComponent(TripPlannerAiAssistStub);
    const resolvedDraft = child.props('draft') as Record<string, unknown>;

    expect(child.props('tripTitle')).toBe('Custom draft');
    expect(resolvedDraft).toMatchObject({
      destination: 'Dallas',
      endDestination: '',
      budgetFloor: 0,
      interests: ['food'],
    });
    expect(resolvedDraft.interests).not.toBe(draft.interests);
    expect(draft).not.toHaveProperty('endDestination');
    expect(draft).not.toHaveProperty('budgetFloor');
  });

  it('falls back to account vibes when a trip assistant has no draft or stop-derived interests yet', async () => {
    authStoreMock.currentUser.interests = ['nature', 'other', 'unknown'];

    const wrapper = mountAssistant({
      startOpen: true,
      trip: {
        id: 'trip-blank',
        title: 'Fresh route',
        destination: 'Austin',
        startDate: '2026-06-01',
        endDate: '2026-06-02',
        budget: 800,
        spots: [],
        members: [],
      },
    });

    const child = wrapper.getComponent(TripPlannerAiAssistStub);
    expect(child.props('draft')).toMatchObject({
      destination: 'Austin',
      interests: ['nature', 'other'],
    });
  });

  it('opens before delegating public handoff and focus calls to the child assistant', async () => {
    const wrapper = mountAssistant();

    expect(wrapper.attributes('data-open')).toBe('false');

    await expect((wrapper.vm as any).handoffPlannerBrief({ prompt: 'Build this weekend' })).resolves.toBe(true);
    expect(wrapper.attributes('data-open')).toBe('true');
    expect(handoffPlannerBriefMock).toHaveBeenCalledWith({ prompt: 'Build this weekend' });

    await (wrapper.vm as any).focusComposer();
    expect(focusComposerMock).toHaveBeenCalledTimes(1);
  });

  it('reacts to startOpen changes and forwards child route events', async () => {
    const wrapper = mountAssistant();

    await wrapper.setProps({ startOpen: true });
    await nextTick();

    expect(wrapper.attributes('data-open')).toBe('true');

    await wrapper.get('[data-test="child-add-stop"]').trigger('click');
    await wrapper.get('[data-test="child-replace-stops"]').trigger('click');
    await wrapper.get('[data-test="child-build-request"]').trigger('click');

    expect(wrapper.emitted('route-stop-add')?.[0]?.[0]).toMatchObject({
      spotId: 'child-stop',
      title: 'Child Stop',
    });
    expect(wrapper.emitted('route-stops-replace')?.[0]?.[0]).toEqual([
      expect.objectContaining({ spotId: 'replacement-stop' }),
    ]);
    expect(wrapper.emitted('itinerary-build-request')?.[0]?.[0]).toMatchObject({
      prompt: 'Build this route',
      reason: 'build',
      handled: false,
    });
  });
});
