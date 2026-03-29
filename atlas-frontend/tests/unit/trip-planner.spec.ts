import { mount } from '@vue/test-utils';
import TripPlanner from '@/components/trips/TripPlanner.vue';
import type { TripPlannerInput } from '@/types';

const initialValue: TripPlannerInput = {
  destination: 'Fort Worth, TX',
  startDate: '2026-04-01',
  endDate: '2026-04-03',
  budget: 500,
  interests: ['food', 'culture'],
  pace: 'moderate',
  groupSize: 2,
};

describe('TripPlanner', () => {
  it('emits a normalized itinerary request when the planner is valid', async () => {
    const wrapper = mount(TripPlanner, {
      props: {
        initialValue,
      },
    });

    await wrapper.get('[data-test="destination-input"]').setValue('Austin, TX');
    await wrapper.get('[data-test="trip-planner"]').trigger('submit');

    const payload = wrapper.emitted('submit')?.[0]?.[0];
    expect(payload.destination).toBe('Austin, TX');
    expect(payload.interests).toEqual(['food', 'culture']);
    expect(payload.groupSize).toBe(2);
  });

  it('shows a validation message when all interests are removed', async () => {
    const wrapper = mount(TripPlanner, {
      props: {
        initialValue,
      },
    });

    const chips = wrapper.findAll('button.interest-chip');
    await chips[0].trigger('click');
    await chips[3].trigger('click');
    await wrapper.get('[data-test="trip-planner"]').trigger('submit');

    expect(wrapper.text()).toContain('Select at least one interest');
  });
});
