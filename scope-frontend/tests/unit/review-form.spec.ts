import { mount } from '@vue/test-utils';
import ReviewForm from '@/components/spots/ReviewForm.vue';

describe('ReviewForm', () => {
  it('sanitizes review copy before emitting it', async () => {
    const wrapper = mount(ReviewForm, {
      props: {
        defaultRating: 4,
      },
    });

    await wrapper.get('textarea').setValue('  Loved the skyline\u0000 view.\n\n\nWould route friends here again.  ');
    await wrapper.get('form').trigger('submit');

    expect(wrapper.emitted('submit')?.[0]?.[0]).toEqual({
      rating: 4,
      comment: 'Loved the skyline view.\n\nWould route friends here again.',
    });
  });

  it('validates useful review length before emitting and clears the error after success', async () => {
    const wrapper = mount(ReviewForm, {
      props: {
        defaultRating: 9,
      },
    });

    expect(wrapper.get('.rating-readout__value').text()).toBe('5.0');

    await wrapper.get('textarea').setValue('too short');
    await wrapper.get('form').trigger('submit');

    expect(wrapper.emitted('submit')).toBeUndefined();
    expect(wrapper.text()).toContain('Add at least 12 characters');

    await wrapper.findAll('.star-button')[1].trigger('click');
    await wrapper.get('textarea').setValue('  Two-star visit with useful notes.  ');
    await wrapper.get('form').trigger('submit');

    expect(wrapper.emitted('submit')?.[0]?.[0]).toEqual({
      rating: 2,
      comment: 'Two-star visit with useful notes.',
    });
    expect(wrapper.text()).not.toContain('Add at least 12 characters');
    expect((wrapper.get('textarea').element as HTMLTextAreaElement).value).toBe('');
    expect(wrapper.get('.rating-readout__value').text()).toBe('9.0');
  });

  it('clamps low default ratings and reflects submitting state on the button', () => {
    const wrapper = mount(ReviewForm, {
      props: {
        defaultRating: -2,
        submitting: true,
      },
    });

    expect(wrapper.get('.rating-readout__value').text()).toBe('1.0');
    expect(wrapper.text()).toContain('Publish review');
  });
});
