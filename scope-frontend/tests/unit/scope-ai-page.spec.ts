import { flushPromises, mount } from '@vue/test-utils';
import { nextTick } from 'vue';
import ScopeAIPage from '@/views/ScopeAIPage.vue';

const routeMock = vi.hoisted(() => ({
  query: {} as Record<string, string | undefined>,
}));
const askScopeAIMock = vi.hoisted(() => vi.fn());
const getRagHealthMock = vi.hoisted(() => vi.fn());
const fetchTripMock = vi.hoisted(() => vi.fn());
const authStoreMock = vi.hoisted(() => ({
  currentUser: {
    id: 'user-1',
    interests: [] as string[],
  },
}));

vi.mock('vue-router', () => ({
  useRoute: () => routeMock,
}));

vi.mock('@/services/ragService', () => ({
  askScopeAI: askScopeAIMock,
  getRagHealth: getRagHealthMock,
}));

vi.mock('@/stores/auth', () => ({
  useAuthStore: () => authStoreMock,
}));

vi.mock('@/stores/trips', () => ({
  useTripsStore: () => ({
    fetchTrip: fetchTripMock,
  }),
}));

vi.mock('@/utils/scopeAiResponsePace', () => ({
  getScopeAiResponseStartedAt: () => performance.now(),
  waitForScopeAiResponsePace: vi.fn().mockResolvedValue(undefined),
}));

function mountScopeAIPage() {
  return mount(ScopeAIPage, {
    global: {
      stubs: {
        AppShell: { template: '<main><slot /></main>' },
        SectionHeading: {
          props: ['eyebrow', 'title', 'description'],
          template: '<header><p>{{ eyebrow }}</p><h1>{{ title }}</h1><p>{{ description }}</p></header>',
        },
        ScopeIcon: { template: '<svg />' },
        RouterLink: { template: '<a><slot /></a>' },
      },
    },
  });
}

async function askQuestion(wrapper: ReturnType<typeof mountScopeAIPage>, question: string) {
  await wrapper.get('#ai-question-input').setValue(question);
  await wrapper.get('form.chat-input-bar').trigger('submit');
  await flushPromises();
}

describe('ScopeAIPage', () => {
  const createObjectURLMock = vi.fn(() => 'blob:scope-ai-image');
  const revokeObjectURLMock = vi.fn();

  class MockFileReader {
    result: string | ArrayBuffer | null = null;
    onload: ((this: FileReader, ev: ProgressEvent<FileReader>) => unknown) | null = null;
    onerror: ((this: FileReader, ev: ProgressEvent<FileReader>) => unknown) | null = null;

    readAsDataURL(file: File) {
      this.result = `data:${file.type};base64,YXRsYXM=`;
      this.onload?.call(this as unknown as FileReader, {} as ProgressEvent<FileReader>);
    }
  }

  beforeEach(() => {
    routeMock.query = {};
    authStoreMock.currentUser.interests = [];
    askScopeAIMock.mockReset();
    getRagHealthMock.mockReset();
    fetchTripMock.mockReset();
    createObjectURLMock.mockClear();
    revokeObjectURLMock.mockClear();
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: createObjectURLMock,
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      value: revokeObjectURLMock,
    });
    vi.stubGlobal('FileReader', MockFileReader);
    getRagHealthMock.mockResolvedValue({
      status: 'healthy',
      vector_count: 12,
      app_catalog_count: 3,
      model: 'gemini-2.5-flash',
      chat_provider: 'gemini',
      chat_model: 'gemini-2.5-flash',
      local_provider: 'ollama',
      local_fallback_model: 'llama3.2:3b',
      embedding_model: 'nomic-embed-text',
      embedding_provider: 'ollama',
      vision_enabled: true,
      vision_model: 'gemini-2.5-flash',
    });
    askScopeAIMock.mockImplementation(async ({ question }: { question: string }) => ({
      answer: `Answer for ${question}`,
      sources: [],
      model: 'scope-rag-local',
      context_docs_used: 2,
    }));
  });

  it('switches suggestions for trip-planning mode and primes the destination question', async () => {
    routeMock.query = {
      mode: 'trip-planning',
      destination: 'Denver',
    };

    const wrapper = mountScopeAIPage();
    await flushPromises();

    expect(wrapper.text()).toContain('Tighten this route into a better day plan');
    expect(wrapper.text()).toContain('Suggest stops that fit the current trip');
    expect(wrapper.get('#ai-question-input').element).toHaveProperty('value', 'Help me plan Denver');
  });

  it('sends the first ask without echoing the active question into conversation context', async () => {
    const wrapper = mountScopeAIPage();
    await flushPromises();

    await askQuestion(wrapper, 'Help me plan a relaxed weekend nearby');

    expect(askScopeAIMock).toHaveBeenCalledWith({
      question: 'Help me plan a relaxed weekend nearby',
      conversation: [],
    });
  });

  it('adds saved account vibes to Scope AI questions without showing them as chat text', async () => {
    authStoreMock.currentUser.interests = ['food', 'scenic', 'other', 'unknown'];
    askScopeAIMock.mockResolvedValueOnce({
      answer: 'Personalized ideas ready.',
      sources: [],
      model: 'scope-rag-local',
      context_docs_used: 2,
    });
    const wrapper = mountScopeAIPage();
    await flushPromises();

    await askQuestion(wrapper, 'Plan something easy tonight');

    expect(askScopeAIMock).toHaveBeenCalledWith({
      question: 'Account preference context:\nInterests: food, scenic.\n\nTraveler question: Plan something easy tonight',
      conversation: [],
    });
    expect(wrapper.text()).toContain('Plan something easy tonight');
    expect(wrapper.text()).not.toContain('Account preference context');
  });

  it('keeps provider and model details out of the traveler-facing page', async () => {
    const wrapper = mountScopeAIPage();
    await flushPromises();

    expect(wrapper.text()).toContain('Ask anything about your next move');
    expect(wrapper.text()).toContain('Help me plan a relaxed weekend nearby');
    expect(wrapper.text()).not.toContain('Gemini');
    expect(wrapper.text()).not.toContain('Ollama');
    expect(wrapper.text()).not.toContain('RAG');
    expect(wrapper.text()).not.toContain('docs');
  });

  it('fills the composer from suggestions and opens the image picker button', async () => {
    const wrapper = mountScopeAIPage();
    await flushPromises();

    await wrapper.findAll('.suggestion-chip')[0].trigger('click');
    expect(wrapper.get('#ai-question-input').element).toHaveProperty('value', 'Help me plan a relaxed weekend nearby');

    const fileInput = wrapper.get('[data-test="scope-ai-image-input"]').element as HTMLInputElement;
    const click = vi.fn();
    Object.defineProperty(fileInput, 'click', {
      configurable: true,
      value: click,
    });

    await wrapper.get('.chat-image-button').trigger('click');
    expect(click).toHaveBeenCalled();
  });

  it('does not expose backend source metadata in chat answers', async () => {
    askScopeAIMock.mockResolvedValueOnce({
      answer: 'Start with a nearby cafe, then walk to a lookout before sunset.',
      sources: [
        {
          method: 'GET',
          path: '/api/intel/recommendations',
          service: 'intel',
          relevance_score: 0.92,
        },
      ],
      model: 'scope-rag-local',
      context_docs_used: 1,
    });
    const wrapper = mountScopeAIPage();
    await flushPromises();

    await askQuestion(wrapper, 'Find a memorable first stop for tonight');

    expect(wrapper.text()).toContain('Start with a nearby cafe');
    expect(wrapper.text()).not.toContain('Sources');
    expect(wrapper.text()).not.toContain('/api/intel/recommendations');
    expect(wrapper.text()).not.toContain('GET');
  });

  it('uses only prior turns as conversation context for follow-up questions', async () => {
    const wrapper = mountScopeAIPage();
    await flushPromises();

    await askQuestion(wrapper, 'Help me plan a relaxed weekend nearby');
    await askQuestion(wrapper, 'Can you make it low budget?');

    expect(askScopeAIMock).toHaveBeenCalledTimes(2);
    expect(askScopeAIMock.mock.calls[1][0]).toEqual({
      question: 'Can you make it low budget?',
      conversation: [
        {
          role: 'user',
          text: 'Help me plan a relaxed weekend nearby',
        },
        {
          role: 'assistant',
          text: 'Answer for Help me plan a relaxed weekend nearby',
        },
      ],
    });
    expect(askScopeAIMock.mock.calls[1][0].conversation).not.toContainEqual({
      role: 'user',
      text: 'Can you make it low budget?',
    });
  });

  it('keeps repeated questions as prior history once, not as duplicated active context', async () => {
    const wrapper = mountScopeAIPage();
    await flushPromises();

    await askQuestion(wrapper, 'Find a memorable first stop for tonight');
    await askQuestion(wrapper, 'Find a memorable first stop for tonight');

    const secondPayload = askScopeAIMock.mock.calls[1][0];
    const repeatedQuestionContextCount = secondPayload.conversation.filter(
      (turn: { role: string; text: string }) => turn.role === 'user' && turn.text === 'Find a memorable first stop for tonight',
    ).length;

    expect(secondPayload.question).toBe('Find a memorable first stop for tonight');
    expect(repeatedQuestionContextCount).toBe(1);
    expect(secondPayload.conversation.at(-1)).toEqual({
      role: 'assistant',
      text: 'Answer for Find a memorable first stop for tonight',
    });
  });

  it('uses a plain loading status instead of a duplicate dot indicator', async () => {
    let resolveAsk: ((value: {
      answer: string;
      sources: [];
      model: string;
      context_docs_used: number;
    }) => void) | undefined;
    askScopeAIMock.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveAsk = resolve;
      }),
    );
    const wrapper = mountScopeAIPage();
    await flushPromises();

    await wrapper.get('#ai-question-input').setValue('Help me plan a weekend route');
    await wrapper.get('form.chat-input-bar').trigger('submit');
    await nextTick();

    expect(wrapper.text()).toContain('Thinking it through');
    expect(wrapper.find('.typing-indicator').exists()).toBe(false);
    expect(wrapper.get('[role="status"]').text()).not.toContain('...');

    resolveAsk?.({
      answer: 'Answer for weekend route',
      sources: [],
      model: 'scope-rag-local',
      context_docs_used: 2,
    });
    await flushPromises();
  });

  it('sends attached images to Scope AI as base64 payloads', async () => {
    const wrapper = mountScopeAIPage();
    await flushPromises();

    const imageFile = new File(['scope'], 'lookout.png', { type: 'image/png' });
    const fileInput = wrapper.get('[data-test="scope-ai-image-input"]').element as HTMLInputElement;
    Object.defineProperty(fileInput, 'files', {
      configurable: true,
      value: [imageFile],
    });

    await wrapper.get('[data-test="scope-ai-image-input"]').trigger('change');
    await flushPromises();

    expect(wrapper.get('[data-test="scope-ai-pending-images"]').text()).toContain('lookout.png');

    await askQuestion(wrapper, 'What can Scope learn from this photo?');

    expect(askScopeAIMock).toHaveBeenCalledWith({
      question: 'What can Scope learn from this photo?',
      conversation: [],
      images: [
        {
          filename: 'lookout.png',
          mime_type: 'image/png',
          data: 'YXRsYXM=',
        },
      ],
    });
    expect(wrapper.get('[data-test="scope-ai-user-images"]').text()).toContain('lookout.png');
  });

  it('validates image type, size, and pending image limits before asking Scope AI', async () => {
    const wrapper = mountScopeAIPage();
    await flushPromises();

    const fileInput = wrapper.get('[data-test="scope-ai-image-input"]').element as HTMLInputElement;
    Object.defineProperty(fileInput, 'files', {
      configurable: true,
      value: [new File(['scope'], 'notes.txt', { type: 'text/plain' })],
    });

    await wrapper.get('[data-test="scope-ai-image-input"]').trigger('change');
    await flushPromises();

    expect(wrapper.get('[data-test="scope-ai-pending-images"]').text()).toContain('Only JPEG, PNG, and WebP images are supported.');

    Object.defineProperty(fileInput, 'files', {
      configurable: true,
      value: [new File([new Uint8Array(4 * 1024 * 1024 + 1)], 'huge.png', { type: 'image/png' })],
    });

    await wrapper.get('[data-test="scope-ai-image-input"]').trigger('change');
    await flushPromises();

    expect(wrapper.get('[data-test="scope-ai-pending-images"]').text()).toContain('Images must be 4 MB or smaller.');

    Object.defineProperty(fileInput, 'files', {
      configurable: true,
      value: [
        new File(['scope'], 'one.png', { type: 'image/png' }),
        new File(['scope'], 'two.png', { type: 'image/png' }),
        new File(['scope'], 'three.png', { type: 'image/png' }),
        new File(['scope'], 'four.png', { type: 'image/png' }),
      ],
    });

    await wrapper.get('[data-test="scope-ai-image-input"]').trigger('change');
    await flushPromises();

    expect(wrapper.findAll('.pending-image')).toHaveLength(3);
    expect(wrapper.get('[data-test="scope-ai-pending-images"]').text()).toContain('Scope AI can inspect up to 3 images at once.');
  });

  it('surfaces image reader failures and revokes the temporary preview URL', async () => {
    class FailingFileReader {
      result: string | ArrayBuffer | null = null;
      onload: ((this: FileReader, ev: ProgressEvent<FileReader>) => unknown) | null = null;
      onerror: ((this: FileReader, ev: ProgressEvent<FileReader>) => unknown) | null = null;

      readAsDataURL() {
        this.onerror?.call(this as unknown as FileReader, {} as ProgressEvent<FileReader>);
      }
    }
    vi.stubGlobal('FileReader', FailingFileReader);
    const wrapper = mountScopeAIPage();
    await flushPromises();

    const fileInput = wrapper.get('[data-test="scope-ai-image-input"]').element as HTMLInputElement;
    Object.defineProperty(fileInput, 'files', {
      configurable: true,
      value: [new File(['scope'], 'broken.png', { type: 'image/png' })],
    });

    await wrapper.get('[data-test="scope-ai-image-input"]').trigger('change');
    await flushPromises();

    expect(wrapper.get('[data-test="scope-ai-pending-images"]').text()).toContain('Scope AI could not read that image.');
    expect(wrapper.find('.pending-image').exists()).toBe(false);
    expect(revokeObjectURLMock).toHaveBeenCalledWith('blob:scope-ai-image');
  });

  it('removes pending image previews and revokes their object URLs', async () => {
    const wrapper = mountScopeAIPage();
    await flushPromises();

    const imageFile = new File(['scope'], 'lookout.png', { type: 'image/png' });
    const fileInput = wrapper.get('[data-test="scope-ai-image-input"]').element as HTMLInputElement;
    Object.defineProperty(fileInput, 'files', {
      configurable: true,
      value: [imageFile],
    });

    await wrapper.get('[data-test="scope-ai-image-input"]').trigger('change');
    await flushPromises();

    expect(wrapper.get('[data-test="scope-ai-pending-images"]').text()).toContain('lookout.png');

    await wrapper.get('button[aria-label="Remove image"]').trigger('click');
    await nextTick();

    expect(wrapper.find('.pending-image').exists()).toBe(false);
    expect(revokeObjectURLMock).toHaveBeenCalledWith('blob:scope-ai-image');
  });

  it('supports image-only asks with a travel-planning default prompt', async () => {
    const wrapper = mountScopeAIPage();
    await flushPromises();

    const imageFile = new File(['scope'], 'trail.webp', { type: 'image/webp' });
    const fileInput = wrapper.get('[data-test="scope-ai-image-input"]').element as HTMLInputElement;
    Object.defineProperty(fileInput, 'files', {
      configurable: true,
      value: [imageFile],
    });

    await wrapper.get('[data-test="scope-ai-image-input"]').trigger('change');
    await flushPromises();
    await wrapper.get('form.chat-input-bar').trigger('submit');
    await flushPromises();

    expect(askScopeAIMock.mock.calls[0][0]).toMatchObject({
      question: 'Describe this image for Scope travel planning.',
      images: [
        {
          filename: 'trail.webp',
          mime_type: 'image/webp',
          data: 'YXRsYXM=',
        },
      ],
    });
  });

  it('does not send a second request while an answer is already loading', async () => {
    let resolveAsk: ((value: {
      answer: string;
      sources: [];
      model: string;
      context_docs_used: number;
    }) => void) | undefined;
    askScopeAIMock.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveAsk = resolve;
      }),
    );
    const wrapper = mountScopeAIPage();
    await flushPromises();

    await wrapper.get('#ai-question-input').setValue('Help me plan a route');
    await wrapper.get('form.chat-input-bar').trigger('submit');
    await nextTick();
    await wrapper.get('form.chat-input-bar').trigger('submit');

    expect(askScopeAIMock).toHaveBeenCalledTimes(1);

    resolveAsk?.({
      answer: 'Route answer',
      sources: [],
      model: 'scope-rag-local',
      context_docs_used: 2,
    });
    await flushPromises();
  });

  it('shows the assistant error message when Scope AI rejects the ask', async () => {
    askScopeAIMock.mockRejectedValueOnce(new Error('Scope AI is taking a breather.'));

    const wrapper = mountScopeAIPage();
    await flushPromises();

    await askQuestion(wrapper, 'Can you help?');

    expect(wrapper.text()).toContain('Scope AI is taking a breather.');
  });

  it('scrolls the chat viewport after user and assistant messages render', async () => {
    const wrapper = mountScopeAIPage();
    await flushPromises();

    const scrollTo = vi.fn();
    const thread = wrapper.get('.chat-thread').element as HTMLElement;
    Object.defineProperty(thread, 'scrollHeight', {
      configurable: true,
      value: 420,
    });
    thread.scrollTo = scrollTo;

    await askQuestion(wrapper, 'Help me plan a relaxed weekend nearby');

    expect(scrollTo).toHaveBeenCalledWith({ top: 420, behavior: 'smooth' });
  });

  it('adds fetched trip context to trip-planning questions', async () => {
    routeMock.query = {
      mode: 'trip-planning',
      tripId: 'trip-1',
      destination: 'Denver',
    };
    fetchTripMock.mockResolvedValueOnce({
      title: 'Rocky Mountain Loop',
      destination: 'Denver',
      startDate: '2026-06-01',
      endDate: '2026-06-04',
      budget: 1200,
      spots: [
        { title: 'Union Station' },
        { title: 'Red Rocks' },
      ],
    });
    const wrapper = mountScopeAIPage();
    await flushPromises();

    await askQuestion(wrapper, 'Make it scenic');

    expect(fetchTripMock).toHaveBeenCalledWith('trip-1');
    expect(askScopeAIMock.mock.calls[0][0].question).toContain('Current Scope trip context:');
    expect(askScopeAIMock.mock.calls[0][0].question).toContain('Title: Rocky Mountain Loop');
    expect(askScopeAIMock.mock.calls[0][0].question).toContain('Budget: $1200');
    expect(askScopeAIMock.mock.calls[0][0].question).toContain('Stops: Union Station, Red Rocks');
    expect(askScopeAIMock.mock.calls[0][0].question).toContain('Traveler question: Make it scenic');
  });

  it('falls back to destination-only trip context when trip loading fails', async () => {
    routeMock.query = {
      tripId: 'missing-trip',
      destination: 'Austin',
    };
    fetchTripMock.mockRejectedValueOnce(new Error('Trip unavailable'));
    const wrapper = mountScopeAIPage();
    await flushPromises();

    await askQuestion(wrapper, 'What should I prioritize?');

    expect(askScopeAIMock.mock.calls[0][0].question).toContain('Current Scope trip context:');
    expect(askScopeAIMock.mock.calls[0][0].question).toContain('Destination: Austin');
    expect(askScopeAIMock.mock.calls[0][0].question).toContain('Traveler question: What should I prioritize?');
  });

  it('keeps image-reader and sparse trip-context fallbacks bounded', async () => {
    routeMock.query = {
      mode: 'trip-planning',
      tripId: 'trip-sparse',
    };
    fetchTripMock.mockResolvedValueOnce({
      title: 'Sparse Loop',
      destination: 'Fort Worth',
      startDate: '2026-06-01',
      endDate: '2026-06-02',
      budget: undefined,
      spots: [],
    });
    class RawFileReader {
      result: string | ArrayBuffer | null = 'raw-base64';
      onload: ((this: FileReader, ev: ProgressEvent<FileReader>) => unknown) | null = null;
      onerror: ((this: FileReader, ev: ProgressEvent<FileReader>) => unknown) | null = null;

      readAsDataURL() {
        this.onload?.call(this as unknown as FileReader, {} as ProgressEvent<FileReader>);
      }
    }
    vi.stubGlobal('FileReader', RawFileReader);
    askScopeAIMock.mockRejectedValueOnce('string failure');
    const wrapper = mountScopeAIPage();
    await flushPromises();

    const fileInput = wrapper.get('[data-test="scope-ai-image-input"]').element as HTMLInputElement;
    Object.defineProperty(fileInput, 'files', {
      configurable: true,
      value: [new File(['scope'], '', { type: 'image/png' })],
    });
    await wrapper.get('[data-test="scope-ai-image-input"]').trigger('change');
    await flushPromises();

    expect(wrapper.get('[data-test="scope-ai-pending-images"]').text()).toContain('Scope image');

    await askQuestion(wrapper, 'Use the sparse trip');

    expect(askScopeAIMock.mock.calls[0][0].question).toContain('Budget: Not set');
    expect(askScopeAIMock.mock.calls[0][0].question).toContain('Stops: No saved stops yet');
    expect(askScopeAIMock.mock.calls[0][0].images).toEqual([
      {
        filename: 'Scope image',
        mime_type: 'image/png',
        data: 'raw-base64',
      },
    ]);
    expect(wrapper.text()).toContain('Scope AI could not process that question right now.');
  });
});
