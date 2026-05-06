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
});
