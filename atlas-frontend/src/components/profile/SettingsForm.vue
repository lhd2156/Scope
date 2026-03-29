<template>
  <form class="settings-form" @submit.prevent="submitForm">
    <div class="field-grid">
      <label class="field-group">
        <span>Display name</span>
        <input v-model.trim="form.displayName" type="text" maxlength="80" placeholder="How your name appears in Atlas" />
      </label>

      <label class="field-group">
        <span>Avatar URL</span>
        <input v-model.trim="form.avatarUrl" type="url" maxlength="240" placeholder="https://images.example.com/avatar.jpg" />
      </label>

      <label class="field-group field-group--wide">
        <span>Bio</span>
        <textarea v-model.trim="form.bio" rows="4" maxlength="280" placeholder="Tell other travelers what kind of adventures you chase." />
      </label>

      <label class="field-group">
        <span>Home base</span>
        <input v-model.trim="form.homeBase" type="text" maxlength="120" placeholder="Fort Worth, TX" />
      </label>

      <label class="field-group">
        <span>Profile visibility</span>
        <select v-model="form.privacy">
          <option value="public">Public</option>
          <option value="friends">Friends only</option>
          <option value="private">Private</option>
        </select>
      </label>

      <label class="field-group">
        <span>Trip invite cadence</span>
        <select v-model="form.tripInvites">
          <option value="instant">Instant</option>
          <option value="daily">Daily digest</option>
          <option value="weekly">Weekly digest</option>
        </select>
      </label>

      <label class="checkbox-row">
        <input v-model="form.emailAlerts" type="checkbox" />
        <span>Email me for friend activity and itinerary updates</span>
      </label>
    </div>

    <p v-if="errorMessage" class="error-copy">{{ errorMessage }}</p>

    <div class="form-actions">
      <Button type="submit" :loading="submitting">Save settings</Button>
    </div>
  </form>
</template>

<script setup lang="ts">
import { reactive, watch } from 'vue';
import Button from '@/components/common/Button.vue';

export interface SettingsFormValue {
  displayName: string;
  avatarUrl: string;
  bio: string;
  homeBase: string;
  privacy: 'public' | 'friends' | 'private';
  tripInvites: 'instant' | 'daily' | 'weekly';
  emailAlerts: boolean;
}

const props = withDefaults(
  defineProps<{
    initialValue: SettingsFormValue;
    submitting?: boolean;
  }>(),
  {
    submitting: false,
  },
);

const emit = defineEmits<{
  (event: 'submit', payload: SettingsFormValue): void;
}>();

const form = reactive<SettingsFormValue>({ ...props.initialValue });
const errorMessage = defineModel<string>('errorMessage', { default: '' });

watch(
  () => props.initialValue,
  (nextValue) => {
    Object.assign(form, nextValue);
    errorMessage.value = '';
  },
  { deep: true },
);

function submitForm() {
  if (!form.displayName.trim()) {
    errorMessage.value = 'Display name is required so your profile stays recognizable.';
    return;
  }

  errorMessage.value = '';
  emit('submit', {
    ...form,
    displayName: form.displayName.trim(),
    avatarUrl: form.avatarUrl.trim(),
    bio: form.bio.trim(),
    homeBase: form.homeBase.trim(),
  });
}
</script>

<style scoped>
.settings-form,
.field-grid {
  display: grid;
  gap: var(--space-4);
}

.field-grid {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.field-group,
.checkbox-row {
  display: grid;
  gap: var(--space-2);
}

.field-group--wide,
.checkbox-row,
.form-actions {
  grid-column: 1 / -1;
}

.field-group span,
.checkbox-row span {
  color: var(--text-secondary);
}

.field-group input,
.field-group textarea,
.field-group select {
  width: 100%;
  border: 1px solid var(--input-border);
  border-radius: var(--radius-xl);
  background: var(--input-bg);
  color: var(--text-primary);
  padding: 0.9rem 1rem;
}

.field-group textarea {
  resize: vertical;
}

.field-group input:focus-visible,
.field-group textarea:focus-visible,
.field-group select:focus-visible {
  outline: 2px solid var(--input-focus);
  outline-offset: 2px;
}

.checkbox-row {
  grid-template-columns: auto 1fr;
  align-items: start;
}

.checkbox-row input {
  margin-top: 0.25rem;
}

.error-copy {
  margin: 0;
  color: var(--danger);
}

.form-actions {
  display: flex;
  justify-content: flex-end;
}

@media (max-width: 820px) {
  .field-grid {
    grid-template-columns: 1fr;
  }

  .form-actions {
    justify-content: stretch;
  }
}
</style>
