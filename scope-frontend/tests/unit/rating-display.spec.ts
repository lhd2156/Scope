import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import StarRatingDisplay from '@/components/common/StarRatingDisplay.vue';
import { starFillPortionAtIndex } from '@/utils/ratingDisplay';

describe('starFillPortionAtIndex', () => {
  it('returns 1 for full stars and the fractional tail on the last star', () => {
    const portions = [1, 2, 3, 4, 5].map((i) => starFillPortionAtIndex(4.4, i));
    [1, 2, 3, 4].forEach((i) => {
      expect(portions[i - 1]).toBe(1);
    });
    expect(portions[4]).toBeCloseTo(0.4, 5);
  });

  it('clamps rating to 0-5', () => {
    expect(starFillPortionAtIndex(6, 5)).toBe(1);
    expect(starFillPortionAtIndex(-1, 1)).toBe(0);
    expect(starFillPortionAtIndex(Number.NaN, 1)).toBe(0);
    expect(starFillPortionAtIndex(3, 0)).toBe(0);
    expect(starFillPortionAtIndex(3, 6)).toBe(0);
  });

  it('renders decimal ratings as partial final stars', () => {
    const wrapper = mount(StarRatingDisplay, {
      props: {
        rating: 4.8,
        label: 'Rated 4.8 out of 5',
        idPrefix: 'test-rating',
      },
      global: {
        stubs: {
          ScopeIcon: {
            props: ['name'],
            template: '<span class="scope-icon-stub" :data-icon="name" />',
          },
        },
      },
    });

    const clips = wrapper.findAll('.star-rating__clip');
    expect(clips).toHaveLength(5);
    expect(clips.slice(0, 4).every((clip) => clip.attributes('style')?.includes('width: 100%'))).toBe(true);
    expect(clips[4].attributes('style')).toContain('width: 80%');

    const almostFullWrapper = mount(StarRatingDisplay, {
      props: {
        rating: 4.9,
        label: 'Rated 4.9 out of 5',
        idPrefix: 'test-rating-49',
        variant: 'compact',
      },
      global: {
        stubs: {
          ScopeIcon: {
            props: ['name'],
            template: '<span class="scope-icon-stub" :data-icon="name" />',
          },
        },
      },
    });

    const almostFullClips = almostFullWrapper.findAll('.star-rating__clip');
    expect(almostFullClips[4].attributes('style')).toContain('width: 90%');
    expect(almostFullClips[4].classes()).toContain('is-partial');
  });
});
