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
      isAnonymous: false,
    });
  });

  it('emits anonymous preference when the toggle is selected', async () => {
    const wrapper = mount(ReviewForm);

    await wrapper.get('.anonymous-toggle input').setValue(true);
    await wrapper.get('textarea').setValue('Helpful anonymous note for future travelers.');
    await wrapper.get('form').trigger('submit');

    expect(wrapper.emitted('submit')?.[0]?.[0]).toMatchObject({
      comment: 'Helpful anonymous note for future travelers.',
      isAnonymous: true,
    });
  });

  it('allows one-decimal review ratings from the spots review form', async () => {
    const wrapper = mount(ReviewForm);

    await wrapper.get('[data-test="review-rating-input"]').setValue('4.7');
    await wrapper.get('[data-test="review-rating-input"]').trigger('change');
    await wrapper.get('textarea').setValue('Precise rating note for future travelers.');
    await wrapper.get('form').trigger('submit');

    expect(wrapper.emitted('submit')?.[0]?.[0]).toMatchObject({
      rating: 4.7,
      comment: 'Precise rating note for future travelers.',
    });
  });

  it('clamps typed review ratings into the public 1.0 to 5.0 range', async () => {
    const wrapper = mount(ReviewForm);
    const input = wrapper.get('[data-test="review-rating-input"]');

    await input.setValue('5.9');
    await input.trigger('change');
    expect(wrapper.get('.rating-readout__value').text()).toBe('5.0');
    expect((input.element as HTMLInputElement).valueAsNumber).toBe(5);

    await input.setValue('0.4');
    await input.trigger('change');
    expect(wrapper.get('.rating-readout__value').text()).toBe('1.0');
    expect((input.element as HTMLInputElement).valueAsNumber).toBe(1);
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
      isAnonymous: false,
    });
    expect(wrapper.text()).not.toContain('Add at least 12 characters');
    expect((wrapper.get('textarea').element as HTMLTextAreaElement).value).toBe('');
    expect(wrapper.get('.rating-readout__value').text()).toBe('5.0');
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
