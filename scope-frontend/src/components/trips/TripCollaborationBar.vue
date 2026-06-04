<template>
  <section class="collaboration-bar glass-panel" data-test="trip-collaboration-bar">
    <div class="collaboration-status">
      <span class="status-icon" aria-hidden="true">
        <ScopeIcon name="route" />
      </span>
      <div>
        <p class="eyebrow">Trip document</p>
        <h2>{{ title }}</h2>
        <p
          class="save-status"
          :data-save-state="effectiveSaveState"
          data-test="trip-autosave-status"
          aria-live="polite"
        >
          <span>{{ saveStatusLabel }}</span>
        </p>
      </div>
    </div>

    <div class="crew-strip" aria-label="Trip crew">
      <div class="crew-avatars">
        <Avatar
          v-for="member in visibleMembers"
          :key="member.id"
          :name="member.displayName"
          :src="member.avatarUrl"
          :size="38"
          class="crew-avatar"
        />
      </div>
      <div class="crew-copy">
        <strong>{{ crewLabel }}</strong>
        <span>{{ crewNames }}</span>
      </div>
    </div>

    <div class="collaboration-actions">
      <RouterLink class="workspace-link" to="/trips">
        <ScopeIcon name="home" label="Trips workspace" />
        <span>Trips</span>
      </RouterLink>
      <RouterLink v-if="trip && showEditLink" class="workspace-link workspace-link--edit" :to="`/trips/${trip.id}/edit`">
        <ScopeIcon name="edit" label="Edit saved draft" />
        <span>Edit</span>
      </RouterLink>
      <button
        v-if="showAiAction"
        type="button"
        class="workspace-link workspace-link--ai"
        data-test="trip-open-ai"
        :disabled="saving"
        @click="$emit('open-ai')"
      >
        <ScopeIcon name="sparkle" label="Open Scope AI" />
        <span>Scope AI</span>
      </button>
      <button
        v-if="canEdit"
        type="button"
        class="action-button action-button--secondary"
        data-test="trip-save-draft"
        :disabled="saving"
        @click="$emit('save')"
      >
        <ScopeIcon name="edit" label="Save draft" />
        <span>{{ saveButtonLabel }}</span>
      </button>
      <button
        v-if="trip && canManage"
        type="button"
        class="action-button action-button--danger"
        data-test="trip-delete-draft"
        :disabled="saving"
        @click="$emit('delete')"
      >
        <ScopeIcon name="close" label="Delete draft" />
        <span>Delete</span>
      </button>
      <button
        v-if="canManage"
        type="button"
        class="action-button action-button--primary"
        data-test="trip-share-button"
        :disabled="saving"
        @click="$emit('share')"
      >
        <ScopeIcon name="share" label="Share trip" />
        <span>Share</span>
      </button>
      <div v-if="canManage" class="sharing-control" role="group" aria-label="Who can view this trip">
        <button
          type="button"
          class="sharing-option"
          :class="{ 'sharing-option--active': isPublic }"
          :title="'Visible to others'"
          :aria-label="'Set trip to public'"
          :aria-pressed="String(isPublic)"
          data-test="trip-visibility-public"
          @click="emitVisibility(true)"
        >
          <ScopeIcon name="globe" label="" />
          Public
        </button>
        <button
          type="button"
          class="sharing-option"
          :class="{ 'sharing-option--active': !isPublic }"
          :title="'Only you can view'"
          :aria-label="'Set trip to private'"
          :aria-pressed="String(!isPublic)"
          data-test="trip-visibility-private"
          @click="emitVisibility(false)"
        >
          <ScopeIcon name="lock" label="" />
          Private
        </button>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { RouterLink } from 'vue-router';
import Avatar from '@/components/common/Avatar.vue';
import ScopeIcon from '@/components/common/ScopeIcon.vue';
import type { Trip, TripMember } from '@/types';

const props = withDefaults(
  defineProps<{
    trip?: Trip | null;
    members?: TripMember[];
    saveState?: 'unsaved' | 'saving' | 'saved';
    saving?: boolean;
    showEditLink?: boolean;
    isPublic?: boolean;
    canEdit?: boolean;
    canManage?: boolean;
    showAiAction?: boolean;
  }>(),
  {
    trip: null,
    members: () => [],
    saveState: 'unsaved',
    saving: false,
    showEditLink: true,
    isPublic: false,
    canEdit: true,
    canManage: true,
    showAiAction: true,
  },
);

const emit = defineEmits<{
  (event: 'save'): void;
  (event: 'share'): void;
  (event: 'delete'): void;
  (event: 'open-ai'): void;
  (event: 'update:isPublic', value: boolean): void;
}>();

const emitVisibility = (value: boolean) => {
  if (props.isPublic === value || props.saving) {
    return;
  }
  emit('update:isPublic', value);
};

const title = computed(() => props.trip?.title?.trim() || 'Unsaved draft');
const visibleMembers = computed(() => props.members.slice(0, 4));
const crewLabel = computed(() => `${props.members.length || 1} crew member${(props.members.length || 1) === 1 ? '' : 's'}`);
const crewNames = computed(() => {
  const names = props.members.map((member) => {
    const pendingLabel = member.inviteStatus === 'pending' ? ' pending' : '';
    return `${member.displayName}${pendingLabel}`;
  });
  return names.length ? names.join(', ') : 'Only you for now';
});
const saveButtonLabel = computed(() => {
  if (props.saving || props.saveState === 'saving') {
    return 'Saving...';
  }

  return 'Save';
});
const effectiveSaveState = computed(() => (props.saving ? 'saving' : props.saveState));
const saveStatusLabel = computed(() => {
  switch (effectiveSaveState.value) {
    case 'saving':
      return 'Autosaving...';
    case 'saved':
      return 'Autosaved';
    default:
      return 'Autosave pending';
  }
});
</script>

<style scoped>
.collaboration-bar {
  display: grid;
  grid-template-columns: minmax(18rem, 1fr) minmax(13rem, 0.42fr) auto;
  gap: clamp(var(--space-3), 1.3vw, var(--space-5));
  align-items: center;
  padding: clamp(var(--space-3), 1.15vw, var(--space-4));
  border-color: var(--glass-border);
  background: var(--bg-secondary);
  box-shadow:
    var(--shadow-md),
    inset 0 1px 0 color-mix(in srgb, white 6%, transparent);
}

.collaboration-status,
.crew-strip,
.collaboration-actions {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.status-icon {
  width: 2.7rem;
  height: 2.7rem;
  display: inline-grid;
  place-items: center;
  flex-shrink: 0;
  border-radius: var(--radius-full);
  color: var(--accent-teal);
  background: color-mix(in srgb, var(--accent-teal) 16%, var(--bg-secondary));
  border: 1px solid color-mix(in srgb, var(--accent-teal) 36%, var(--glass-border));
}

.status-icon :deep(.scope-icon) {
  width: 1.15rem;
  height: 1.15rem;
}

.collaboration-status h2,
.collaboration-status p,
.crew-copy strong,
.crew-copy span {
  margin: 0;
}

.collaboration-status h2 {
  display: -webkit-box;
  overflow: hidden;
  font-size: clamp(var(--font-size-body), 1.35vw, var(--font-size-h3));
  line-height: var(--line-height-tight);
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 1;
}

.collaboration-status p:not(.eyebrow),
.crew-copy span {
  color: var(--text-secondary);
  line-height: var(--line-height-normal);
}

.collaboration-status p:not(.eyebrow) {
  display: -webkit-box;
  overflow: hidden;
  font-size: var(--font-size-small);
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 1;
}

.collaboration-status p.save-status {
  display: block;
  width: fit-content;
  margin-top: 0.24rem;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--text-secondary);
  font-size: var(--font-size-caption);
  font-weight: var(--font-weight-semibold);
}

.collaboration-status p.save-status[data-save-state='unsaved'] {
  color: color-mix(in srgb, var(--accent-gold) 86%, var(--text-primary));
}

.collaboration-status p.save-status[data-save-state='saving'] {
  color: color-mix(in srgb, var(--text-primary) 86%, var(--accent-teal));
}

.collaboration-status p.save-status[data-save-state='saved'] {
  color: color-mix(in srgb, var(--success) 82%, var(--text-secondary));
}

.crew-strip {
  min-width: 0;
  padding: 0.62rem 0.72rem;
  border: 1px solid color-mix(in srgb, var(--glass-border) 82%, var(--border));
  border-radius: var(--radius-xl);
  background: color-mix(in srgb, var(--glass-bg) 82%, transparent);
}

.sharing-control {
  display: inline-flex;
  align-items: center;
  gap: 0.24rem;
  padding: 0.22rem;
  border: 1px solid color-mix(in srgb, var(--glass-border) 84%, var(--border));
  border-radius: var(--radius-full);
  background: color-mix(in srgb, var(--bg-primary) 36%, var(--glass-bg));
}

.sharing-option {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.32rem;
  min-height: 1.65rem;
  padding: 0.18rem 0.54rem;
  border-radius: var(--radius-full);
  border: 1px solid color-mix(in srgb, var(--glass-border) 90%, var(--border));
  background: color-mix(in srgb, var(--bg-secondary) 72%, transparent);
  color: var(--text-secondary);
  cursor: pointer;
  font: inherit;
  font-size: 0.78rem;
  font-weight: var(--font-weight-semibold);
  transition:
    border-color var(--transition-fast),
    background var(--transition-fast),
    color var(--transition-fast),
    transform var(--transition-fast),
    box-shadow var(--transition-fast);
}

.sharing-option :deep(.scope-icon) {
  width: 0.82rem;
  height: 0.82rem;
}

.sharing-option:hover,
.sharing-option:focus-visible {
  outline: none;
  transform: none;
  border-color: color-mix(in srgb, var(--accent-teal) 54%, var(--glass-border));
  color: var(--text-primary);
}

.sharing-option--active {
  border-color: color-mix(in srgb, var(--accent-teal) 72%, var(--glass-border));
  background: color-mix(in srgb, var(--accent-teal) 18%, var(--bg-secondary));
  color: var(--text-primary);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--accent-teal) 26%, transparent);
}

.crew-avatars {
  display: flex;
  flex-shrink: 0;
}

.crew-avatar + .crew-avatar {
  margin-left: -0.7rem;
}

.crew-copy {
  display: grid;
  min-width: 0;
}

.crew-copy span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: var(--font-size-small);
}

.collaboration-actions {
  justify-content: flex-end;
  flex-wrap: nowrap;
  gap: var(--space-2);
}

.workspace-link,
.action-button {
  min-height: 2.55rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  border-radius: var(--radius-full);
  font-weight: var(--font-weight-semibold);
  text-decoration: none;
  white-space: nowrap;
  transition:
    transform var(--transition-fast),
    border-color var(--transition-fast),
    background var(--transition-fast),
    box-shadow var(--transition-fast);
}

.workspace-link,
.action-button--secondary {
  padding: 0.62rem 0.82rem;
  color: var(--text-primary);
  border: 1px solid color-mix(in srgb, var(--glass-border) 90%, var(--border));
  background: color-mix(in srgb, var(--bg-secondary) 78%, transparent);
}

.workspace-link--edit {
  border-color: color-mix(in srgb, var(--accent-teal) 34%, var(--glass-border));
  background: color-mix(in srgb, var(--accent-teal) 10%, var(--bg-secondary));
}

.workspace-link--ai {
  border-color: color-mix(in srgb, var(--accent-gold) 42%, var(--glass-border));
  background: color-mix(in srgb, var(--accent-gold) 14%, var(--bg-secondary));
}

.action-button {
  cursor: pointer;
}

.action-button--primary {
  padding: 0.68rem 1rem;
  color: var(--bg-primary);
  border: 1px solid color-mix(in srgb, var(--accent-teal) 66%, transparent);
  background: linear-gradient(135deg, var(--accent-teal), color-mix(in srgb, var(--accent-teal) 76%, var(--accent-gold)));
}

.action-button--danger {
  padding: 0.62rem 0.82rem;
  color: var(--text-primary);
  border: 1px solid color-mix(in srgb, var(--danger) 38%, var(--glass-border));
  background: color-mix(in srgb, var(--danger) 10%, var(--bg-secondary));
}

.workspace-link:hover,
.workspace-link:focus-visible,
.action-button:hover:not(:disabled),
.action-button:focus-visible {
  transform: translateY(var(--motion-button-lift));
  border-color: var(--accent-teal);
  box-shadow: var(--shadow-glow-teal);
  outline: none;
}

.action-button:disabled {
  cursor: wait;
  opacity: 0.7;
}

.workspace-link:disabled {
  cursor: wait;
  opacity: 0.7;
}

.workspace-link :deep(.scope-icon),
.action-button :deep(.scope-icon) {
  width: 1rem;
  height: 1rem;
}

@media (max-width: 1220px) {
  .collaboration-bar {
    grid-template-columns: minmax(0, 1fr) auto;
  }

  .crew-strip {
    grid-column: 1 / -1;
    grid-row: 2;
    max-width: 34rem;
  }

  .collaboration-actions {
    grid-column: 1 / -1;
    grid-row: 3;
    justify-content: flex-start;
    flex-wrap: wrap;
  }
}

@media (max-width: 640px) {
  .collaboration-status,
  .crew-strip,
  .collaboration-actions {
    align-items: flex-start;
  }

  .collaboration-status,
  .crew-strip {
    flex-direction: column;
  }

  .action-button,
  .workspace-link {
    flex: 1 1 9rem;
  }

  .sharing-control {
    width: 100%;
    justify-content: center;
  }
}

@media (prefers-reduced-motion: reduce) {
  .workspace-link,
  .action-button {
    transition-duration: 1ms;
  }

  .workspace-link:hover,
  .workspace-link:focus-visible,
  .action-button:hover:not(:disabled),
  .action-button:focus-visible {
    transform: none;
  }

}
</style>
