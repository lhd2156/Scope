import { mount } from '@vue/test-utils';
import TripPlanner from '@/components/trips/TripPlanner.vue';
import type { TripPlannerInput, TripSpot } from '@/types';

const initialValue: TripPlannerInput = {
  destination: 'Fort Worth, TX',
  startDate: '2026-04-01',
  endDate: '2026-04-03',
  budget: 500,
  interests: ['food', 'culture', 'nightlife'],
  pace: 'moderate',
  groupSize: 2,
};

const selectedStops: TripSpot[] = [
  {
    spotId: 'stop-1',
    title: 'Mount Fitz Roy',
    latitude: -49.2711,
    longitude: -73.0439,
    category: 'adventure',
    city: 'El Chaltén',
    duration: 180,
    photoUrl: 'https://images.unsplash.com/photo-1516026672322-bc52d61a55d5?w=800',
    notes: 'Sunrise alpine start.',
  },
  {
    spotId: 'stop-2',
    title: 'Perito Moreno Glacier',
    latitude: -50.496,
    longitude: -73.1373,
    category: 'scenic',
    city: 'El Calafate',
    duration: 150,
    photoUrl: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=800',
    notes: 'Glacier boardwalk and cruise.',
  },
];

const suggestedStops: TripSpot[] = [
  ...selectedStops,
  {
    spotId: 'stop-3',
    title: 'Torres del Paine',
    latitude: -50.9423,
    longitude: -72.9874,
    category: 'nature',
    city: 'Torres del Paine',
    duration: 210,
    photoUrl: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?w=800',
    notes: 'Finish with the iconic towers.',
  },
];

describe('TripPlanner', () => {
  it('emits a normalized planner payload after a valid submit', async () => {
    const wrapper = mount(TripPlanner, {
      props: {
        initialValue,
        initialTitle: 'Epic Patagonia Trek',
        budgetRange: [1500, 3000],
        selectedStops,
        suggestedStops,
      },
    });

    await wrapper.get('[data-test="trip-title-input"]').setValue('Epic Andes Escape');
    await wrapper.get('[data-test="destination-input"]').setValue('Austin, TX ');

    const paceButtons = wrapper.findAll('button.pace-card');
    await paceButtons[2]?.trigger('click');

    const interestButtons = wrapper.findAll('button.interest-chip');
    await interestButtons[1]?.trigger('click');

    await wrapper.get('[data-test="trip-planner"]').trigger('submit');

    const emitted = wrapper.emitted('submit')?.[0]?.[0] as TripPlannerInput;
    expect(emitted.destination).toBe('Austin, TX');
    expect(emitted.pace).toBe('packed');
    expect(emitted.interests).toEqual(['food', 'culture', 'nightlife', 'nature']);
    expect(wrapper.emitted('update:title')?.at(-1)?.[0]).toBe('Epic Andes Escape');
    expect(wrapper.text()).toContain('/ day');
  });

  it('blocks submission when all interests are removed', async () => {
    const wrapper = mount(TripPlanner, {
      props: {
        initialValue,
        initialTitle: 'Epic Patagonia Trek',
        budgetRange: [1500, 3000],
        selectedStops,
        suggestedStops,
      },
    });

    const interestButtons = wrapper.findAll('button.interest-chip');
    await interestButtons[0]?.trigger('click');
    await interestButtons[3]?.trigger('click');
    await interestButtons[2]?.trigger('click');

    await wrapper.get('[data-test="trip-planner"]').trigger('submit');

    expect(wrapper.emitted('submit')).toBeUndefined();
    expect(wrapper.text()).toContain('Select at least one interest to guide the itinerary.');
  });

  it('adds a suggested stop and emits the refreshed route order', async () => {
    const wrapper = mount(TripPlanner, {
      props: {
        initialValue,
        initialTitle: 'Epic Patagonia Trek',
        budgetRange: [1500, 3000],
        selectedStops: [selectedStops[0]],
        suggestedStops,
      },
    });

    await wrapper.get('[data-test="destination-search-input"]').setValue('Torres');
    await wrapper.get('.add-stop-button').trigger('click');

    const latestStops = wrapper.emitted('update:stops')?.at(-1)?.[0] as TripSpot[];
    expect(latestStops).toHaveLength(2);
    expect(latestStops[1]?.title).toBe('Torres del Paine');
  });

  it('renders a vertical mobile wizard with only the active step expanded', async () => {
    const wrapper = mount(TripPlanner, {
      props: {
        initialValue,
        initialTitle: 'Epic Patagonia Trek',
        budgetRange: [1500, 3000],
        selectedStops,
        suggestedStops,
        mobileWizard: true,
        mobileActiveStep: 2,
      },
    });

    expect(wrapper.get('[data-test="planner-step-1-toggle"]').attributes('aria-expanded')).toBe('false');
    expect(wrapper.get('[data-test="planner-step-2-toggle"]').attributes('aria-expanded')).toBe('true');
    expect(wrapper.get('[data-test="planner-step-1-content"]').isVisible()).toBe(false);
    expect(wrapper.get('[data-test="planner-step-2-content"]').isVisible()).toBe(true);
    expect(wrapper.get('[data-test="planner-step-3-content"]').isVisible()).toBe(false);
  });

  it('emits wizard step changes from the mobile step actions', async () => {
    const wrapper = mount(TripPlanner, {
      props: {
        initialValue,
        initialTitle: 'Epic Patagonia Trek',
        budgetRange: [1500, 3000],
        selectedStops,
        suggestedStops,
        mobileWizard: true,
        mobileActiveStep: 1,
      },
    });

    await wrapper.get('[data-test="planner-step-1-continue"]').trigger('click');

    expect(wrapper.emitted('wizard-step-change')?.[0]?.[0]).toBe(2);
  });
});
