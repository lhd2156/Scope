import { mount } from '@vue/test-utils';
import SettingsForm from '@/components/profile/SettingsForm.vue';

describe('SettingsForm', () => {
  const initialValue = {
    displayName: 'Louis Do',
    avatarUrl: ' https://images.example.com/avatar.jpg ',
    bio: ' Collecting rooftop taco stops. ',
    homeBase: ' Fort Worth, TX ',
    privacy: 'friends' as const,
    tripInvites: 'instant' as const,
    emailAlerts: true,
  };

  it('emits trimmed settings payloads when the form is valid', async () => {
    const wrapper = mount(SettingsForm, {
      props: {
        initialValue,
      },
    });

    await wrapper.get('form').trigger('submit');

    expect(wrapper.emitted('submit')?.[0]?.[0]).toEqual({
      displayName: 'Louis Do',
      avatarUrl: 'https://images.example.com/avatar.jpg',
      bio: 'Collecting rooftop taco stops.',
      homeBase: 'Fort Worth, TX',
      privacy: 'friends',
      tripInvites: 'instant',
      emailAlerts: true,
    });
  });

  it('emits a model update when display name is missing', async () => {
    const wrapper = mount(SettingsForm, {
      props: {
        initialValue: {
          ...initialValue,
          displayName: '   ',
        },
      },
    });

    await wrapper.get('form').trigger('submit');

    expect(wrapper.emitted('update:errorMessage')?.[0]).toEqual(['Display name is required so your profile stays recognizable.']);
    expect(wrapper.emitted('submit')).toBeUndefined();
  });
});
