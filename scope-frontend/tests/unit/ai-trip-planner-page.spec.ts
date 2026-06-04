import { flushPromises, mount } from '@vue/test-utils';
import AITripPlannerPage from '@/views/AITripPlannerPage.vue';

const planTripMock = vi.hoisted(() => vi.fn());
const authStoreMock = vi.hoisted(() => ({
  currentUser: {
    id: 'user-1',
    interests: [] as string[],
  },
}));

vi.mock('@/services/agentService', () => ({
  planTrip: planTripMock,
}));

vi.mock('@/stores/auth', () => ({
  useAuthStore: () => authStoreMock,
}));

function mountPage() {
  return mount(AITripPlannerPage, {
    global: {
      stubs: {
        AppShell: { template: '<main><slot /></main>' },
        SectionHeading: {
          props: ['eyebrow', 'title', 'description'],
          template: '<header data-test="section-heading">{{ eyebrow }}|{{ title }}|{{ description }}</header>',
        },
      },
    },
  });
}

describe('AITripPlannerPage', () => {
  beforeEach(() => {
    planTripMock.mockReset();
    authStoreMock.currentUser = { id: 'user-1', interests: [] };
    Object.defineProperty(HTMLElement.prototype, 'scrollTo', {
      configurable: true,
      value: vi.fn(),
    });
  });

  it('fills the prompt from a suggestion chip and renders a formatted successful plan', async () => {
    planTripMock.mockResolvedValueOnce({
      itinerary: '**Day 1**\nStreet food crawl\n\n**Day 2**\nTemple loop',
      model: 'ollama-test',
      steps: 4,
    });
    const wrapper = mountPage();

    expect(wrapper.get('[data-test="section-heading"]').text()).toContain('AI trip planner');
    await wrapper.findAll('.suggestion-chip')[0].trigger('click');

    const input = wrapper.get('#ai-trip-prompt').element as HTMLInputElement;
    expect(input.value).toBe('Plan a 3-day trip to Tokyo focused on street food and temples');

    await wrapper.get('form').trigger('submit');
    await flushPromises();

    expect(planTripMock).toHaveBeenCalledWith({
      prompt: 'Plan a 3-day trip to Tokyo focused on street food and temples',
      user_id: 'user-1',
    });
    expect(wrapper.get('.model-badge').text()).toBe('ollama-test - 4 steps');
    expect(wrapper.get('.response-body').html()).toContain('<strong>Day 1</strong><br>Street food crawl');
    expect(wrapper.get('.response-body').html()).toContain('<p><strong>Day 2</strong><br>Temple loop</p>');
  });

  it('escapes model markdown HTML and resets the planner response', async () => {
    planTripMock.mockResolvedValueOnce({
      itinerary: '**Safe** <script>alert("x")</script>',
      model: 'ollama-test',
      steps: 1,
    });
    const wrapper = mountPage();

    await wrapper.get('#ai-trip-prompt').setValue('Plan safely');
    await wrapper.get('form').trigger('submit');
    await flushPromises();

    expect(wrapper.get('.response-body').html()).toContain('&lt;script&gt;alert("x")&lt;/script&gt;');

    await wrapper.get('.planner-actions button').trigger('click');

    expect((wrapper.get('#ai-trip-prompt').element as HTMLInputElement).value).toBe('');
    expect(wrapper.find('.chat-response').exists()).toBe(false);
    expect(wrapper.find('.chat-welcome').exists()).toBe(true);
  });

  it('injects saved account vibes into free-form AI planner prompts', async () => {
    authStoreMock.currentUser.interests = ['food', 'scenic', 'other'];
    planTripMock.mockResolvedValueOnce({
      itinerary: 'Food-forward scenic plan',
      model: 'ollama-test',
      steps: 2,
    });
    const wrapper = mountPage();

    await wrapper.get('#ai-trip-prompt').setValue('Plan a quick weekend in Austin');
    await wrapper.get('form').trigger('submit');
    await flushPromises();

    expect(planTripMock).toHaveBeenCalledWith({
      prompt: 'Interests: food, scenic.\nTraveler request: Plan a quick weekend in Austin',
      user_id: 'user-1',
    });
  });

  it('shows a helpful error and does not submit blank or loading prompts', async () => {
    let rejectPlan!: (error: Error) => void;
    planTripMock.mockReturnValueOnce(new Promise((_resolve, reject) => {
      rejectPlan = reject;
    }));
    const wrapper = mountPage();

    await wrapper.get('form').trigger('submit');
    expect(planTripMock).not.toHaveBeenCalled();

    await wrapper.get('#ai-trip-prompt').setValue('Plan a short trip');
    await wrapper.get('form').trigger('submit');
    await wrapper.vm.$nextTick();

    expect((wrapper.get('#ai-trip-prompt').element as HTMLInputElement).disabled).toBe(true);
    await wrapper.get('form').trigger('submit');
    expect(planTripMock).toHaveBeenCalledTimes(1);

    rejectPlan(new Error('Ollama is offline'));
    await flushPromises();

    expect(wrapper.get('[role="alert"]').text()).toContain('Ollama is offline');
    expect((wrapper.get('#ai-trip-prompt').element as HTMLInputElement).disabled).toBe(false);
  });
});
