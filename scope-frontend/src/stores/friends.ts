import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import {
  acceptFriendRequest as acceptFriendRequestRequest,
  listFriends,
  listFriendSuggestions,
  listPendingFriendRequests,
  rejectFriendRequest as rejectFriendRequestRequest,
  removeFriend as removeFriendRequest,
  searchFriendCandidates,
  sendFriendRequest as sendFriendRequestRequest,
} from '@/services/friendService';
import type { FriendConnection, FriendPresence, FriendRequest, FriendSuggestion, PaginationMeta, UserProfile } from '@/types';
import { toAsyncErrorMessage } from '@/utils/errors';
import { isShowcaseUserId } from '@/utils/showcaseActors';

const ONLINE_PRESENCES = new Set<FriendPresence>(['planning', 'online']);
const PRESENCE_RANK: Record<FriendPresence, number> = {
  planning: 5,
  online: 4,
  idle: 2,
  hidden: 1,
  offline: 0,
};

function lastActiveScore(connection: FriendConnection): number {
  const timestamp = Date.parse(connection.lastActiveAt ?? '');
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function compareFriendConnections(left: FriendConnection, right: FriendConnection): number {
  const presenceDelta = PRESENCE_RANK[right.presence] - PRESENCE_RANK[left.presence];
  if (presenceDelta !== 0) {
    return presenceDelta;
  }

  const sharedTripsDelta = right.sharedTrips - left.sharedTrips;
  if (sharedTripsDelta !== 0) {
    return sharedTripsDelta;
  }

  const mutualFriendsDelta = right.mutualFriends - left.mutualFriends;
  if (mutualFriendsDelta !== 0) {
    return mutualFriendsDelta;
  }

  const activityDelta = lastActiveScore(right) - lastActiveScore(left);
  if (activityDelta !== 0) {
    return activityDelta;
  }

  return left.user.displayName.localeCompare(right.user.displayName);
}

function rankConnections(entries: FriendConnection[]): FriendConnection[] {
  return [...entries].sort(compareFriendConnections);
}

export const useFriendsStore = defineStore('friends', () => {
  const connections = ref<FriendConnection[]>([]);
  const requests = ref<FriendRequest[]>([]);
  const suggestions = ref<FriendSuggestion[]>([]);
  const searchResults = ref<UserProfile[]>([]);
  const meta = ref<PaginationMeta | null>(null);
  const sentRequestUserIds = ref<Set<string>>(new Set());
  const loading = ref(false);
  const searching = ref(false);
  const saving = ref(false);
  const error = ref<string | null>(null);

  const rankedConnections = computed(() => rankConnections(connections.value));
  const onlineConnections = computed(() => rankedConnections.value.filter((connection) => ONLINE_PRESENCES.has(connection.presence)));
  const idleConnections = computed(() => connections.value.filter((connection) => connection.presence === 'idle'));
  const hiddenConnections = computed(() => connections.value.filter((connection) => connection.presence === 'hidden'));
  const connectionUserIds = computed(() => new Set(connections.value.map((connection) => connection.user.id)));
  let searchRequestId = 0;

  function clearError(): void {
    error.value = null;
  }

  function hasSentRequestTo(userId: string): boolean {
    return sentRequestUserIds.value.has(userId);
  }

  function isAlreadyFriend(userId: string): boolean {
    return connectionUserIds.value.has(userId);
  }

  async function fetchAll(): Promise<void> {
    loading.value = true;
    error.value = null;

    try {
      const [friendsResponse, requestsResponse, suggestionsResponse] = await Promise.all([
        listFriends(1, 100),
        listPendingFriendRequests(),
        listFriendSuggestions('best', 8),
      ]);
      connections.value = friendsResponse.data;
      requests.value = requestsResponse.data;
      suggestions.value = suggestionsResponse.data.filter((suggestion) => !isAlreadyFriend(suggestion.user.id));
      meta.value = friendsResponse.meta ?? null;
    } catch (nextError) {
      error.value = toAsyncErrorMessage(nextError, 'Scope could not load your social circle right now.');
      throw nextError;
    } finally {
      loading.value = false;
    }
  }

  async function refreshConnections(): Promise<void> {
    error.value = null;

    try {
      const friendsResponse = await listFriends(1, 100);
      connections.value = friendsResponse.data;
      meta.value = friendsResponse.meta ?? null;
      suggestions.value = suggestions.value.filter((suggestion) => !isAlreadyFriend(suggestion.user.id));
    } catch (nextError) {
      error.value = toAsyncErrorMessage(nextError, 'Scope could not refresh friend presence right now.');
      throw nextError;
    }
  }

  async function refreshSuggestions(mode: 'best' | 'mutuals' | 'vibes' | 'random' = 'best'): Promise<void> {
    loading.value = true;
    error.value = null;

    try {
      const response = await listFriendSuggestions(mode, 8);
      suggestions.value = response.data.filter((suggestion) => !isAlreadyFriend(suggestion.user.id) && !hasSentRequestTo(suggestion.user.id));
    } catch (nextError) {
      error.value = toAsyncErrorMessage(nextError, 'Scope could not refresh friend suggestions right now.');
    } finally {
      loading.value = false;
    }
  }

  async function search(query: string): Promise<UserProfile[]> {
    const trimmedQuery = query.trim();
    const requestId = ++searchRequestId;

    if (trimmedQuery.length < 2) {
      searchResults.value = [];
      searching.value = false;
      error.value = null;
      return [];
    }

    searching.value = true;
    error.value = null;

    try {
      const response = await searchFriendCandidates(trimmedQuery, 1, 12);
      const nextResults = response.data.filter((candidate) => !isAlreadyFriend(candidate.id));

      if (requestId === searchRequestId) {
        searchResults.value = nextResults;
      }

      return nextResults;
    } catch (nextError) {
      if (requestId === searchRequestId) {
        error.value = toAsyncErrorMessage(nextError, 'Scope could not search members right now.');
      }

      throw nextError;
    } finally {
      if (requestId === searchRequestId) {
        searching.value = false;
      }
    }
  }

  async function sendRequest(user: UserProfile): Promise<void> {
    if (isAlreadyFriend(user.id) || hasSentRequestTo(user.id)) {
      return;
    }

    const nextSent = new Set(sentRequestUserIds.value);
    nextSent.add(user.id);
    sentRequestUserIds.value = nextSent;
    saving.value = true;
    error.value = null;

    try {
      const matchingSuggestion = suggestions.value.find((suggestion) => suggestion.user.id === user.id);
      if (!isShowcaseUserId(user.id)) {
        await sendFriendRequestRequest(user.id);
      }
      suggestions.value = suggestions.value.filter((suggestion) => suggestion.user.id !== user.id);
      requests.value = [
        {
          id: `outgoing-${user.id}`,
          user,
          direction: 'outgoing',
          createdAt: new Date().toISOString(),
          mutualFriends: matchingSuggestion?.mutualFriends ?? 0,
          note: 'Request sent from Scope member search.',
        },
        ...requests.value.filter((request) => request.user.id !== user.id),
      ];
    } catch (nextError) {
      const rollbackSent = new Set(sentRequestUserIds.value);
      rollbackSent.delete(user.id);
      sentRequestUserIds.value = rollbackSent;
      error.value = toAsyncErrorMessage(nextError, 'Scope could not send that friend request right now.');
      throw nextError;
    } finally {
      saving.value = false;
    }
  }

  async function acceptRequest(requestId: string): Promise<void> {
    const request = requests.value.find((entry) => entry.id === requestId);
    if (!request) {
      return;
    }

    saving.value = true;
    error.value = null;

    try {
      const connection = await acceptFriendRequestRequest(requestId);
      requests.value = requests.value.filter((entry) => entry.id !== requestId);
      connections.value = [connection, ...connections.value.filter((entry) => entry.id !== connection.id)];
      suggestions.value = suggestions.value.filter((suggestion) => suggestion.user.id !== connection.user.id);
    } catch (nextError) {
      error.value = toAsyncErrorMessage(nextError, 'Scope could not accept that request right now.');
      throw nextError;
    } finally {
      saving.value = false;
    }
  }

  async function rejectRequest(requestId: string): Promise<void> {
    saving.value = true;
    error.value = null;

    try {
      await rejectFriendRequestRequest(requestId);
      requests.value = requests.value.filter((entry) => entry.id !== requestId);
    } catch (nextError) {
      error.value = toAsyncErrorMessage(nextError, 'Scope could not decline that request right now.');
      throw nextError;
    } finally {
      saving.value = false;
    }
  }

  async function removeConnection(connectionId: string): Promise<void> {
    saving.value = true;
    error.value = null;

    try {
      await removeFriendRequest(connectionId);
      connections.value = connections.value.filter((entry) => entry.id !== connectionId);
    } catch (nextError) {
      error.value = toAsyncErrorMessage(nextError, 'Scope could not remove that friend right now.');
      throw nextError;
    } finally {
      saving.value = false;
    }
  }

  return {
    connections,
    requests,
    suggestions,
    searchResults,
    meta,
    sentRequestUserIds,
    loading,
    searching,
    saving,
    error,
    rankedConnections,
    onlineConnections,
    idleConnections,
    hiddenConnections,
    clearError,
    fetchAll,
    refreshConnections,
    refreshSuggestions,
    search,
    sendRequest,
    acceptRequest,
    rejectRequest,
    removeConnection,
    hasSentRequestTo,
    isAlreadyFriend,
  };
});
