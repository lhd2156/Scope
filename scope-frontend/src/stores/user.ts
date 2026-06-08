import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import {
  deactivateUserProfile as deactivateUserProfileRequest,
  deleteCurrentUserContent as deleteCurrentUserContentRequest,
  getCurrentUserProfile,
  getUserProfile,
  getUserStats as getUserStatsRequest,
  searchUsers as searchUsersRequest,
  updateUserProfile as updateUserProfileRequest,
  type UpdateUserProfileInput,
} from '@/services/userService';
import { useAuthStore } from '@/stores/auth';
import type { PaginationMeta, UserProfile, UserStats } from '@/types';
import { toAsyncErrorMessage } from '@/utils/errors';

export const useUserStore = defineStore('user', () => {
  const authStore = useAuthStore();
  const loadedProfile = ref<UserProfile | null>(null);
  const loadedStats = ref<UserStats | null>(null);
  const searchResults = ref<UserProfile[]>([]);
  const searchMeta = ref<PaginationMeta | null>(null);
  const loading = ref(false);
  const saving = ref(false);
  const error = ref<string | null>(null);

  const profile = computed(() => loadedProfile.value ?? authStore.currentUser);
  const stats = computed(() => loadedStats.value ?? loadedProfile.value?.stats ?? authStore.currentUser?.stats ?? null);
  const isCurrentUserProfile = computed(() => Boolean(profile.value?.id) && profile.value?.id === authStore.currentUser?.id);

  function clearError() {
    error.value = null;
  }

  function clearProfileContext() {
    loadedProfile.value = null;
    loadedStats.value = null;
    searchResults.value = [];
    searchMeta.value = null;
    error.value = null;
  }

  async function fetchCurrentProfile() {
    loading.value = true;
    error.value = null;

    try {
      const response = await getCurrentUserProfile(authStore.currentUser?.id);
      loadedProfile.value = response.data;
      loadedStats.value = response.data.stats ?? loadedStats.value;

      if (authStore.currentUser?.id === response.data.id) {
        authStore.updateCurrentUser(response.data);
      }

      return response.data;
    } catch (nextError) {
      error.value = toAsyncErrorMessage(nextError, 'Scope could not load your profile right now.');
      throw nextError;
    } finally {
      loading.value = false;
    }
  }

  async function fetchProfile(userId: string) {
    loading.value = true;
    error.value = null;

    try {
      const response = await getUserProfile(userId);
      loadedProfile.value = response.data;
      loadedStats.value = response.data.stats ?? null;

      if (authStore.currentUser?.id === response.data.id) {
        authStore.updateCurrentUser(response.data);
      }

      return response.data;
    } catch (nextError) {
      error.value = toAsyncErrorMessage(nextError, 'Scope could not load that explorer profile right now.');
      throw nextError;
    } finally {
      loading.value = false;
    }
  }

  async function fetchStats(userId = profile.value?.id ?? authStore.currentUser?.id ?? '') {
    if (!userId) {
      loadedStats.value = null;
      return null;
    }

    loading.value = true;
    error.value = null;

    try {
      const response = await getUserStatsRequest(userId);
      loadedStats.value = response.data;
      return response.data;
    } catch (nextError) {
      error.value = toAsyncErrorMessage(nextError, 'Scope could not load user stats right now.');
      throw nextError;
    } finally {
      loading.value = false;
    }
  }

  async function saveProfile(updates: UpdateUserProfileInput, userId = profile.value?.id ?? authStore.currentUser?.id ?? '') {
    if (!userId) {
      throw new Error('No Scope user is selected for this profile update.');
    }

    saving.value = true;
    error.value = null;

    try {
      const response = await updateUserProfileRequest(userId, updates);
      loadedProfile.value = response.data;
      loadedStats.value = response.data.stats ?? loadedStats.value;

      if (authStore.currentUser?.id === response.data.id) {
        authStore.updateCurrentUser(response.data);
      }

      return response.data;
    } catch (nextError) {
      error.value = toAsyncErrorMessage(nextError, 'Scope could not update that profile right now.');
      throw nextError;
    } finally {
      saving.value = false;
    }
  }

  async function searchProfiles(query: string, page = 1, pageSize = 10) {
    loading.value = true;
    error.value = null;

    try {
      const response = await searchUsersRequest(query, page, pageSize);
      searchResults.value = response.data;
      searchMeta.value = response.meta ?? null;
      return response.data;
    } catch (nextError) {
      error.value = toAsyncErrorMessage(nextError, 'Scope could not search explorers right now.');
      throw nextError;
    } finally {
      loading.value = false;
    }
  }

  async function deactivateProfile(userId = profile.value?.id ?? authStore.currentUser?.id ?? '') {
    if (!userId) {
      return;
    }

    saving.value = true;
    error.value = null;

    try {
      await deactivateUserProfileRequest(userId);
      searchResults.value = searchResults.value.filter((user) => user.id !== userId);

      if (loadedProfile.value?.id === userId) {
        loadedProfile.value = null;
        loadedStats.value = null;
      }

      if (authStore.currentUser?.id === userId) {
        await authStore.logout();
      }
    } catch (nextError) {
      error.value = toAsyncErrorMessage(nextError, 'Scope could not deactivate that profile right now.');
      throw nextError;
    } finally {
      saving.value = false;
    }
  }

  async function deleteCurrentAccount() {
    const userId = authStore.currentUser?.id ?? '';
    if (!userId) {
      throw new Error('No signed-in Scope account is available to delete');
    }

    saving.value = true;
    error.value = null;

    try {
      await deleteCurrentUserContentRequest();
      await deactivateUserProfileRequest(userId);
      clearProfileContext();
      await authStore.logout();
    } catch (nextError) {
      error.value = toAsyncErrorMessage(nextError, 'Scope could not permanently delete your account right now.');
      throw nextError;
    } finally {
      saving.value = false;
    }
  }

  return {
    profile,
    stats,
    searchResults,
    searchMeta,
    loading,
    saving,
    error,
    isCurrentUserProfile,
    clearError,
    clearProfileContext,
    fetchCurrentProfile,
    fetchProfile,
    fetchStats,
    saveProfile,
    searchProfiles,
    deactivateProfile,
    deleteCurrentAccount,
  };
});
