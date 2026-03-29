import { mount } from '@vue/test-utils';
import SearchBar from '@/components/common/SearchBar.vue';

describe('SearchBar', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('debounces and trims emitted search values', async () => {
    const wrapper = mount(SearchBar, {
      props: {
        modelValue: '',
        debounceMs: 300,
      },
    });

    await wrapper.get('input').setValue('  Fort Worth tacos  ');
    await vi.advanceTimersByTimeAsync(300);

    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual(['Fort Worth tacos']);
    expect(wrapper.emitted('search')?.[0]).toEqual(['Fort Worth tacos']);
  });

  it('enforces a 300ms minimum debounce even when a smaller value is requested', async () => {
    const wrapper = mount(SearchBar, {
      props: {
        modelValue: '',
        debounceMs: 50,
      },
    });

    await wrapper.get('input').setValue('nightlife');
    await vi.advanceTimersByTimeAsync(299);
    expect(wrapper.emitted('search')).toBeUndefined();

    await vi.advanceTimersByTimeAsync(1);
    expect(wrapper.emitted('search')?.[0]).toEqual(['nightlife']);
  });

  it('clears the input immediately when the clear button is pressed', async () => {
    const wrapper = mount(SearchBar, {
      props: {
        modelValue: 'Nightlife',
      },
    });

    await wrapper.get('.search-bar__clear').trigger('click');

    const updateEvents = wrapper.emitted('update:modelValue');
    const searchEvents = wrapper.emitted('search');
    expect(updateEvents?.at(-1)).toEqual(['']);
    expect(searchEvents?.at(-1)).toEqual(['']);
  });
});
