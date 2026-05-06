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
        <div>
          <p class="eyebrow">Editable draft link</p>
          <strong>{{ trip?.title ?? 'Trip draft' }}</strong>
          <span>{{ linkCopy }}</span>
        </div>
        <button type="button" class="icon-action" data-test="copy-trip-link" :disabled="!shareLink" @click="copyShareLink">
          <ScopeIcon name="share" label="Copy share link" />
          <span>{{ copied ? 'Copied' : 'Copy' }}</span>
        </button>
      </section>

      <form class="invite-form" data-test="trip-share-form" @submit.prevent="handleSubmit">
        <label class="field">
          <span>Email, phone, or display name</span>
          <div class="input-shell">
            <ScopeIcon name="mail" label="Invite recipient" />
            <input
              v-model.trim="recipient"
              data-test="trip-share-recipient"
              type="text"
              autocomplete="off"
              placeholder="maya@example.com, 817-555-0198, or Maya Chen"
            />
          </div>
        </label>

        <label class="field">
          <span>Access</span>
          <div class="input-shell select-shell">
            <ScopeIcon name="settings" label="Invite role" />
            <select v-model="role" data-test="trip-share-role">
              <option value="editor">Can edit</option>
              <option value="viewer">Can view</option>
            </select>
          </div>
        </label>

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
          <div>
            <strong>{{ member.displayName }}</strong>
            <span>{{ roleLabel(member) }}</span>
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
  }>(),
  {
    trip: null,
    members: () => [],
    shareLink: '',
    submitting: false,
  },
);

const emit = defineEmits<{
  (event: 'close'): void;
  (event: 'invite', payload: TripInviteInput): void;
}>();

const recipient = ref('');
const role = ref<TripInviteInput['role']>('editor');
const copied = ref(false);
const attemptedSubmit = ref(false);

const errorMessage = computed(() => {
  if (!attemptedSubmit.value || recipient.value.trim()) {
    return '';
  }

  return 'Enter an email, phone number, or display name to invite them.';
});

const linkCopy = computed(() => props.shareLink || 'Save the draft first to create the editable trip link.');

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

function handleSubmit() {
  attemptedSubmit.value = true;
  if (!recipient.value.trim()) {
    return;
  }

  emit('invite', {
    recipient: recipient.value,
    role: role.value,
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
  grid-template-columns: minmax(0, 1fr) auto;
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
  white-space: nowrap;
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

input,
select {
  width: 100%;
  min-width: 0;
  border: 0;
  outline: 0;
  background: transparent;
  color: var(--text-primary);
  font: inherit;
}

select {
  cursor: pointer;
}

.field-error {
  color: var(--danger);
  font-weight: var(--font-weight-semibold);
}

.icon-action,
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

.icon-action {
  min-height: 2.75rem;
  padding: 0.7rem 0.95rem;
  background: color-mix(in srgb, var(--accent-teal) 10%, var(--bg-secondary));
  color: var(--text-primary);
}

.send-button {
  justify-self: end;
  min-height: 3rem;
  padding: 0.8rem 1.15rem;
  background: var(--accent-teal);
  color: var(--bg-primary);
}

.icon-action:hover:not(:disabled),
.icon-action:focus-visible,
.send-button:hover:not(:disabled),
.send-button:focus-visible {
  transform: translateY(var(--motion-button-lift));
  border-color: var(--accent-teal);
  box-shadow: var(--shadow-glow-teal);
  outline: none;
}

.icon-action:disabled,
.send-button:disabled {
  cursor: wait;
  opacity: 0.68;
}

.crew-list {
  padding-top: var(--space-2);
}

.crew-row {
  grid-template-columns: auto minmax(0, 1fr);
  padding: var(--space-3);
  border-radius: var(--radius-xl);
  background: color-mix(in srgb, var(--glass-bg) 76%, transparent);
  border: 1px solid color-mix(in srgb, var(--glass-border) 80%, transparent);
}

@media (max-width: 640px) {
  .share-link-panel {
    grid-template-columns: 1fr;
  }

  .send-button {
    justify-self: stretch;
  }
}

@media (prefers-reduced-motion: reduce) {
  .icon-action,
  .send-button {
    transition-duration: 1ms;
  }

  .icon-action:hover:not(:disabled),
  .icon-action:focus-visible,
  .send-button:hover:not(:disabled),
  .send-button:focus-visible {
    transform: none;
  }
}
</style>
