import { flushPromises, mount } from '@vue/test-utils';
import { nextTick } from 'vue';
import ScopeAIPage from '@/views/ScopeAIPage.vue';

const askScopeAIMock = vi.hoisted(() => vi.fn());
const getRagHealthMock = vi.hoisted(() => vi.fn());

vi.mock('@/services/ragService', () => ({
  askScopeAI: askScopeAIMock,
  getRagHealth: getRagHealthMock,
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
    askScopeAIMock.mockReset();
    getRagHealthMock.mockReset();
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
      model: 'gemini-2.5-flash-lite',
      chat_provider: 'gemini',
      chat_model: 'gemini-2.5-flash-lite',
      local_provider: 'ollama',
      local_fallback_model: 'llama3.2:3b',
      embedding_model: 'nomic-embed-text',
      embedding_provider: 'ollama',
      vision_enabled: true,
      vision_model: 'gemini-2.5-flash-lite',
    });
    askScopeAIMock.mockImplementation(async ({ question }: { question: string }) => ({
      answer: `Answer for ${question}`,
      sources: [],
      model: 'scope-rag-local',
      context_docs_used: 2,
    }));
  });

  it('sends the first ask without echoing the active question into conversation context', async () => {
    const wrapper = mountScopeAIPage();
    await flushPromises();

    await askQuestion(wrapper, 'What frontend routes does Scope have?');

    expect(askScopeAIMock).toHaveBeenCalledWith({
      question: 'What frontend routes does Scope have?',
      conversation: [],
    });
  });

  it('shows Ollama as local memory and fallback instead of the main chat brain', async () => {
    const wrapper = mountScopeAIPage();
    await flushPromises();

    expect(wrapper.text()).toContain('Main chat');
    expect(wrapper.text()).toContain('Gemini - gemini-2.5-flash-lite');
    expect(wrapper.text()).toContain('Image input');
    expect(wrapper.text()).toContain('Local memory');
    expect(wrapper.text()).toContain('Ollama - nomic-embed-text');
    expect(wrapper.text()).toContain('Offline fallback');
    expect(wrapper.text()).toContain('Ollama - llama3.2:3b');
  });

  it('uses only prior turns as conversation context for follow-up questions', async () => {
    const wrapper = mountScopeAIPage();
    await flushPromises();

    await askQuestion(wrapper, 'What frontend routes does Scope have?');
    await askQuestion(wrapper, 'Which service owns trip planning endpoints?');

    expect(askScopeAIMock).toHaveBeenCalledTimes(2);
    expect(askScopeAIMock.mock.calls[1][0]).toEqual({
      question: 'Which service owns trip planning endpoints?',
      conversation: [
        {
          role: 'user',
          text: 'What frontend routes does Scope have?',
        },
        {
          role: 'assistant',
          text: 'Answer for What frontend routes does Scope have?',
        },
      ],
    });
    expect(askScopeAIMock.mock.calls[1][0].conversation).not.toContainEqual({
      role: 'user',
      text: 'Which service owns trip planning endpoints?',
    });
  });

  it('keeps repeated questions as prior history once, not as duplicated active context', async () => {
    const wrapper = mountScopeAIPage();
    await flushPromises();

    await askQuestion(wrapper, 'How is Ollama wired into Scope AI?');
    await askQuestion(wrapper, 'How is Ollama wired into Scope AI?');

    const secondPayload = askScopeAIMock.mock.calls[1][0];
    const repeatedQuestionContextCount = secondPayload.conversation.filter(
      (turn: { role: string; text: string }) => turn.role === 'user' && turn.text === 'How is Ollama wired into Scope AI?',
    ).length;

    expect(secondPayload.question).toBe('How is Ollama wired into Scope AI?');
    expect(repeatedQuestionContextCount).toBe(1);
    expect(secondPayload.conversation.at(-1)).toEqual({
      role: 'assistant',
      text: 'Answer for How is Ollama wired into Scope AI?',
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

    expect(wrapper.text()).toContain('Reading Scope context');
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

  it('sends attached images to Scope AI as base64 Gemini-ready payloads', async () => {
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
});
