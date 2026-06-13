<template>
  <Modal
    :open="open"
    title="Share this trip"
    eyebrow="Crew access"
    size="md"
    @close="$emit('close')"
  >
    <div class="share-modal">
      <section class="share-link-panel">
        <span class="share-link-panel__icon" aria-hidden="true">
          <ScopeIcon name="share" label="" />
        </span>
        <div>
          <p class="eyebrow">Shared trip link</p>
          <strong>{{ trip?.title ?? 'Trip draft' }}</strong>
          <span>{{ linkCopy }}</span>
        </div>
        <button
          type="button"
          class="copy-link-button"
          data-test="copy-trip-link"
          :disabled="!shareLink"
          @click="copyShareLink"
        >
          <ScopeIcon name="share" label="Copy share link" />
          <span>{{ copied ? 'Copied' : 'Copy' }}</span>
        </button>
      </section>

      <label class="field share-url-field">
        <span>Anonymous read-only URL</span>
        <div class="input-shell">
          <ScopeIcon name="share" label="Trip share URL" />
          <input
            :value="shareLink"
            data-test="trip-share-link-input"
            type="url"
            readonly
            :placeholder="shareLinkPlaceholder"
            @focus="$event.target instanceof HTMLInputElement && $event.target.select()"
          />
        </div>
      </label>

      <form class="invite-form" data-test="trip-share-form" @submit.prevent="handleSubmit">
        <p class="share-modal__member-note">
          Invite an existing Scope account for editor or viewer access. Phone-only invites stay blocked so membership and roles remain enforceable.
        </p>
        <label class="field">
          <span>Scope member</span>
          <div class="input-shell">
            <ScopeIcon name="search" label="Find member" />
            <input
              v-model.trim="recipient"
              data-test="trip-share-recipient"
              type="text"
              autocomplete="off"
              placeholder="@maya, Maya Chen, or account email"
            />
          </div>
          <small class="field-hint">Only registered Scope members can be added to this crew.</small>
        </label>

        <div class="field">
          <span>Access</span>
          <div class="role-choice" data-test="trip-share-role" role="radiogroup" aria-label="Invite access">
            <button
              v-for="option in roleOptions"
              :key="option.value"
              type="button"
              class="role-option"
              :class="{ active: role === option.value }"
              :aria-checked="String(role === option.value)"
              role="radio"
              @click="role = option.value"
            >
              <ScopeIcon :name="option.icon" label="" />
              <span>
                <strong>{{ option.label }}</strong>
                <small>{{ option.copy }}</small>
              </span>
            </button>
          </div>
        </div>

        <small v-if="errorMessage" class="field-error">{{ errorMessage }}</small>

        <button type="submit" class="send-button" data-test="trip-share-submit" :disabled="submitting">
          <ScopeIcon name="share" label="Send invite" />
          <span>{{ submitting ? 'Sending invite' : 'Send invite' }}</span>
        </button>
      </form>

      <section v-if="members.length" class="crew-list" aria-label="Current trip crew">
        <p class="eyebrow">Current crew</p>
        <article v-for="member in members" :key="member.id" class="crew-row">
          <Avatar :name="member.displayName" :src="member.avatarUrl" :size="38" />
          <div class="crew-row__copy">
            <strong>{{ member.displayName }}</strong>
            <span>{{ roleLabel(member) }}</span>
          </div>
          <div
            v-if="canManage && member.status !== 'owner'"
            class="crew-role-actions"
            :aria-label="`Change ${member.displayName} access`"
            data-test="trip-member-role-select"
            role="group"
          >
            <button
              v-for="option in roleOptions"
              :key="option.value"
              type="button"
              class="crew-role-button"
              :class="{ active: getMemberRole(member) === option.value }"
              :aria-pressed="String(getMemberRole(member) === option.value)"
              @click="handleRoleChange(member, option.value)"
            >
              {{ option.label }}
            </button>
          </div>
        </article>
      </section>
    </div>
  </Modal>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import Avatar from '@/components/common/Avatar.vue';
import ScopeIcon from '@/components/common/ScopeIcon.vue';
import Modal from '@/components/common/Modal.vue';
import type { Trip, TripInviteInput, TripMember } from '@/types';

const props = withDefaults(
  defineProps<{
    open: boolean;
    trip?: Trip | null;
    members?: TripMember[];
    shareLink?: string;
    submitting?: boolean;
    canManage?: boolean;
  }>(),
  {
    trip: null,
    members: () => [],
    shareLink: '',
    submitting: false,
    canManage: true,
  },
);

const emit = defineEmits<{
  (event: 'close'): void;
  (event: 'invite', payload: TripInviteInput): void;
  (event: 'updateRole', payload: { userId: string; role: TripInviteInput['role'] }): void;
}>();

const roleOptions: Array<{
  value: TripInviteInput['role'];
  label: string;
  copy: string;
  icon: string;
}> = [
  {
    value: 'editor',
    label: 'Can edit',
    copy: 'Plan route, stops, budget, and AI handoff.',
    icon: 'settings',
  },
  {
    value: 'viewer',
    label: 'Can view',
    copy: 'Read the trip and follow updates.',
    icon: 'eye',
  },
];
const phoneLikeRecipientPattern = /^\+?[\d\s().-]{7,}$/;
const recipient = ref('');
const role = ref<TripInviteInput['role']>('editor');
const copied = ref(false);
const attemptedSubmit = ref(false);

const linkCopy = computed(() =>
  props.shareLink
    ? 'Anyone with this URL can open the shared trip view. Members still need invites for edit access.'
    : props.trip && !props.trip.isPublic
      ? 'This trip is private. Only invited Scope members can open it; no anonymous link is available.'
      : 'Save this trip first to create a live backend share token.',
);
const shareLinkPlaceholder = computed(() =>
  props.trip && !props.trip.isPublic
    ? 'Private trips do not have anonymous links'
    : 'Save the trip to create a live share link',
);

const errorMessage = computed(() => {
  if (!attemptedSubmit.value) {
    return '';
  }

  const trimmedRecipient = recipient.value.trim();
  if (!trimmedRecipient) {
    return 'Search for a registered Scope member before sending an invite.';
  }

  if (phoneLikeRecipientPattern.test(trimmedRecipient)) {
    return 'Use a Scope username, display name, or account email. Phone-only invites are not supported.';
  }

  return '';
});

watch(
  () => props.open,
  (isOpen) => {
    if (!isOpen) {
      recipient.value = '';
      role.value = 'editor';
      copied.value = false;
      attemptedSubmit.value = false;
    }
  },
);

async function copyShareLink() {
  if (!props.shareLink) {
    return;
  }

  try {
    await navigator.clipboard?.writeText(props.shareLink);
    copied.value = true;
  } catch {
    copied.value = false;
  }
}

function roleLabel(member: TripMember): string {
  const roleName = member.status ? member.status.charAt(0).toUpperCase() + member.status.slice(1) : 'Member';
  return member.inviteStatus === 'pending' ? `${roleName} invite pending` : roleName;
}

function getMemberRole(member: TripMember): TripInviteInput['role'] {
  return member.status === 'editor' ? 'editor' : 'viewer';
}

function handleSubmit() {
  attemptedSubmit.value = true;
  if (errorMessage.value) {
    return;
  }

  emit('invite', {
    recipient: recipient.value,
    role: role.value,
  });
}

function handleRoleChange(member: TripMember, nextRole: TripInviteInput['role']): void {
  if (getMemberRole(member) === nextRole) {
    return;
  }

  emit('updateRole', {
    userId: member.id,
    role: nextRole,
  });
}
</script>

<style scoped>
.share-modal,
.invite-form,
.crew-list {
  display: grid;
  gap: var(--space-4);
}

.share-link-panel,
.crew-row {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: var(--space-3);
}

.share-link-panel {
  padding: var(--space-4);
  border-radius: var(--radius-xl);
  border: 1px solid color-mix(in srgb, var(--accent-teal) 22%, var(--glass-border));
  background:
    linear-gradient(135deg, color-mix(in srgb, var(--accent-teal) 10%, var(--bg-secondary)), color-mix(in srgb, var(--bg-primary) 92%, var(--bg-secondary)));
}

.share-link-panel__icon {
  width: 3.1rem;
  height: 3.1rem;
  display: inline-grid;
  place-items: center;
  border-radius: var(--radius-full);
  border: 1px solid color-mix(in srgb, var(--accent-teal) 46%, var(--glass-border));
  background: color-mix(in srgb, var(--accent-teal) 18%, var(--bg-secondary));
  color: var(--accent-teal);
}

.share-link-panel__icon :deep(.scope-icon) {
  width: 1.25rem;
  height: 1.25rem;
}

.share-link-panel strong,
.share-link-panel span,
.crew-row strong,
.crew-row span {
  display: block;
  min-width: 0;
}

.share-link-panel strong,
.crew-row strong {
  color: var(--text-primary);
}

.share-link-panel span,
.crew-row span {
  color: var(--text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
}

.crew-row span {
  white-space: nowrap;
}

.share-link-panel span {
  white-space: normal;
  line-height: var(--line-height-normal);
}

.copy-link-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  min-height: 2.65rem;
  padding: 0.62rem 0.9rem;
  border: 1px solid color-mix(in srgb, var(--accent-teal) 42%, var(--glass-border));
  border-radius: var(--radius-full);
  background: color-mix(in srgb, var(--accent-teal) 16%, var(--bg-secondary));
  color: var(--text-primary);
  cursor: pointer;
  font-weight: var(--font-weight-semibold);
  transition:
    border-color var(--transition-fast),
    background var(--transition-fast),
    transform var(--transition-fast);
}

.copy-link-button:hover:not(:disabled),
.copy-link-button:focus-visible {
  outline: none;
  transform: translateY(var(--motion-button-lift));
  border-color: var(--accent-teal);
  background: color-mix(in srgb, var(--accent-teal) 24%, var(--bg-secondary));
}

.copy-link-button:disabled {
  cursor: wait;
  opacity: 0.62;
}

.copy-link-button :deep(.scope-icon) {
  width: 1rem;
  height: 1rem;
}

.share-url-field {
  margin-top: calc(var(--space-2) * -1);
}

.share-url-field input {
  color: var(--text-secondary);
}

.share-modal__member-note {
  margin: 0;
  color: var(--text-secondary);
  font-size: var(--font-size-body-sm);
  line-height: var(--line-height-normal);
}

.field {
  display: grid;
  gap: var(--space-2);
}

.field > span {
  color: var(--text-primary);
  font-weight: var(--font-weight-semibold);
}

.input-shell {
  display: grid;
  grid-template-columns: auto 1fr;
  align-items: center;
  gap: var(--space-3);
  min-height: 3.35rem;
  padding: 0 var(--space-4);
  border: 1px solid var(--border);
  border-radius: var(--radius-xl);
  background: color-mix(in srgb, var(--bg-secondary) 92%, transparent);
  color: var(--text-secondary);
}

.input-shell:focus-within {
  border-color: var(--accent-teal);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent-teal) 18%, transparent);
}

.input-shell :deep(.scope-icon) {
  width: 1.05rem;
  height: 1.05rem;
  color: var(--accent-teal);
}

input {
  width: 100%;
  min-width: 0;
  font: inherit;
  border: 0;
  outline: 0;
  background: transparent;
  color: var(--text-primary);
}

.field-hint {
  color: var(--text-secondary);
  font-size: var(--font-size-caption);
  line-height: var(--line-height-normal);
}

.role-choice {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-3);
}

.role-option {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
  gap: var(--space-3);
  min-height: 4.7rem;
  padding: 0.86rem 0.95rem;
  border: 1px solid color-mix(in srgb, var(--accent-teal) 18%, var(--glass-border));
  border-radius: var(--radius-xl);
  background: color-mix(in srgb, var(--bg-secondary) 88%, transparent);
  color: var(--text-primary);
  cursor: pointer;
  text-align: left;
  transition:
    transform var(--transition-fast),
    border-color var(--transition-fast),
    background var(--transition-fast),
    box-shadow var(--transition-fast);
}

.role-option :deep(.scope-icon) {
  width: 1.1rem;
  height: 1.1rem;
  color: var(--accent-teal);
}

.role-option span {
  display: grid;
  gap: 0.14rem;
}

.role-option strong,
.role-option small {
  display: block;
  min-width: 0;
}

.role-option strong {
  color: var(--text-primary);
  line-height: var(--line-height-tight);
}

.role-option small {
  color: var(--text-secondary);
  font-size: var(--font-size-caption);
  line-height: var(--line-height-normal);
}

.role-option:hover,
.role-option:focus-visible,
.role-option.active {
  outline: none;
  transform: translateY(var(--motion-button-lift));
  border-color: color-mix(in srgb, var(--accent-teal) 66%, var(--glass-border));
  background: color-mix(in srgb, var(--accent-teal) 13%, var(--bg-secondary));
}

.role-option.active {
  box-shadow:
    inset 0 0 0 1px color-mix(in srgb, var(--accent-teal) 24%, transparent),
    0 0 0 3px color-mix(in srgb, var(--accent-teal) 12%, transparent);
}

.field-error {
  color: var(--danger);
  font-weight: var(--font-weight-semibold);
}

.send-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  border-radius: var(--radius-full);
  border: 1px solid color-mix(in srgb, var(--accent-teal) 42%, var(--border));
  font-weight: var(--font-weight-semibold);
  cursor: pointer;
  transition:
    transform var(--transition-fast),
    border-color var(--transition-fast),
    box-shadow var(--transition-fast),
    background var(--transition-fast);
}

.send-button {
  justify-self: end;
  min-height: 3rem;
  padding: 0.8rem 1.15rem;
  background: var(--accent-teal);
  color: var(--bg-primary);
}

.send-button:hover:not(:disabled),
.send-button:focus-visible {
  transform: translateY(var(--motion-button-lift));
  border-color: var(--accent-teal);
  box-shadow: var(--shadow-glow-teal);
  outline: none;
}

.send-button:disabled {
  cursor: wait;
  opacity: 0.68;
}

.crew-list {
  padding-top: var(--space-2);
}

.crew-row {
  grid-template-columns: auto minmax(0, 1fr) auto;
  padding: var(--space-3);
  border-radius: var(--radius-xl);
  background: color-mix(in srgb, var(--glass-bg) 76%, transparent);
  border: 1px solid color-mix(in srgb, var(--glass-border) 80%, transparent);
}

.crew-row__copy {
  min-width: 0;
}

.crew-role-actions {
  display: inline-flex;
  align-items: center;
  gap: 0.22rem;
  min-width: 11.5rem;
  padding: 0.22rem;
  border-radius: var(--radius-full);
  border: 1px solid color-mix(in srgb, var(--accent-teal) 18%, var(--glass-border));
  background: color-mix(in srgb, var(--bg-primary) 60%, transparent);
}

.crew-role-button {
  min-height: 2.15rem;
  padding: 0.34rem 0.62rem;
  border: 1px solid transparent;
  border-radius: var(--radius-full);
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  font-size: var(--font-size-caption);
  font-weight: var(--font-weight-semibold);
  transition:
    border-color var(--transition-fast),
    background var(--transition-fast),
    color var(--transition-fast);
}

.crew-role-button:hover,
.crew-role-button:focus-visible,
.crew-role-button.active {
  outline: none;
  border-color: color-mix(in srgb, var(--accent-teal) 44%, var(--glass-border));
  background: color-mix(in srgb, var(--accent-teal) 16%, var(--bg-secondary));
  color: var(--text-primary);
}

@media (max-width: 640px) {
  .share-link-panel,
  .role-choice {
    grid-template-columns: 1fr;
  }

  .copy-link-button {
    justify-self: stretch;
  }

  .send-button {
    justify-self: stretch;
  }

  .crew-row {
    grid-template-columns: auto minmax(0, 1fr);
  }

  .crew-role-actions {
    grid-column: 1 / -1;
    width: 100%;
  }
}

@media (prefers-reduced-motion: reduce) {
  .role-option,
  .send-button {
    transition-duration: 1ms;
  }

  .role-option:hover,
  .role-option:focus-visible,
  .role-option.active,
  .send-button:hover:not(:disabled),
  .send-button:focus-visible {
    transform: none;
  }
}
</style>
