import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import { setAccessToken } from '@/services/api';
import type { AuthForm, RegisterForm, UserProfile } from '@/types';

const demoUser: UserProfile = {
  id: 'user-1',
  username: 'louisdo',
  email: 'louis@example.com',
  displayName: 'Louis Do',
  interests: ['food', 'culture'],
  bio: 'Documenting premium adventures one pin at a time.',
  homeBase: 'Fort Worth, TX',
  stats: { spots: 42, trips: 8, friends: 126 },
};

export const useAuthStore = defineStore('auth', () => {
  const token = ref('');
  const refreshToken = ref('');
  const currentUser = ref<UserProfile | null>(null);
  const isAuthenticated = computed(() => Boolean(token.value || currentUser.value));

  async function login(_payload: AuthForm) {
    token.value = 'demo-token';
    refreshToken.value = 'demo-refresh';
    currentUser.value = demoUser;
    setAccessToken(token.value);
  }

  async function register(payload: RegisterForm) {
    await login({ email: payload.email, password: payload.password });
  }

  function logout() {
    token.value = '';
    refreshToken.value = '';
    currentUser.value = null;
    setAccessToken('');
  }

  return { token, refreshToken, currentUser, isAuthenticated, login, register, logout };
});
