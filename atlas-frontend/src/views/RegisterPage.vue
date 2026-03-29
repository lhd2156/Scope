<template>
  <AppShell>
    <div class="page-container auth-page">
      <section class="glass-panel auth-shell">
        <div class="auth-copy">
          <p class="eyebrow">Create account</p>
          <h1>Start documenting real places and real stories.</h1>
          <p class="section-copy">
            Register to drop pins, upload photos, coordinate trips, and turn community signals into route-ready itineraries.
          </p>
        </div>

        <form class="surface-card auth-card" @submit.prevent="submit">
          <p v-if="formError" class="form-error" role="alert">{{ formError }}</p>
          <label class="field-group">
            <span>Username</span>
            <input v-model.trim="username" maxlength="40" placeholder="louisdo" autocomplete="username" required />
          </label>

          <label class="field-group">
            <span>Display name</span>
            <input v-model.trim="displayName" maxlength="80" placeholder="Louis Do" autocomplete="name" required />
          </label>

          <label class="field-group">
            <span>Email</span>
            <input v-model.trim="email" type="email" autocomplete="email" placeholder="louis@example.com" required />
          </label>

          <label class="field-group">
            <span>Password</span>
            <input v-model="password" type="password" autocomplete="new-password" placeholder="Create a strong password" required />
          </label>

          <Button type="submit" :loading="isSubmitting" block>Create account</Button>

          <p class="form-note">
            Already have an account?
            <RouterLink to="/login">Log in</RouterLink>
          </p>
        </form>
      </section>
    </div>
  </AppShell>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { RouterLink, useRoute, useRouter } from 'vue-router';
import AppShell from '@/components/common/AppShell.vue';
import Button from '@/components/common/Button.vue';
import { useAuthStore } from '@/stores/auth';

const username = ref('louisdo');
const displayName = ref('Louis Do');
const email = ref('louis@example.com');
const password = ref('SecurePass123!');
const isSubmitting = ref(false);
const formError = ref('');
const authStore = useAuthStore();
const route = useRoute();
const router = useRouter();

function resolveRedirectTarget() {
  const redirectTarget = typeof route.query.redirect === 'string' ? route.query.redirect : '';
  return redirectTarget || '/map';
}

async function submit() {
  isSubmitting.value = true;
  formError.value = '';
  authStore.clearError();

  try {
    await authStore.register({
      username: username.value,
      displayName: displayName.value,
      email: email.value,
      password: password.value,
    });
    await router.push(resolveRedirectTarget());
  } catch {
    formError.value = authStore.error || 'Atlas could not create your account right now.';
  } finally {
    isSubmitting.value = false;
  }
}
</script>

<style scoped>
.auth-page {
  display: grid;
  align-items: center;
  min-height: 100vh;
}

.auth-shell {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(20rem, 28rem);
  gap: var(--space-8);
  padding: var(--space-8);
}

.auth-copy,
.auth-card {
  display: grid;
  gap: var(--space-4);
}

.auth-copy {
  align-content: center;
}

.auth-card {
  padding: var(--space-6);
}

.eyebrow,
.auth-copy h1,
.field-group span,
.form-note {
  margin: 0;
}

.eyebrow {
  color: var(--accent-teal);
  text-transform: uppercase;
  letter-spacing: 0.14em;
  font-size: var(--font-size-caption);
}

.auth-copy h1 {
  font-size: clamp(2rem, 3vw, 2.85rem);
  line-height: var(--line-height-tight);
}

.field-group {
  display: grid;
  gap: var(--space-3);
}

.field-group span,
.form-note {
  color: var(--text-secondary);
}

.form-error {
  margin: 0;
  color: var(--danger);
}

.field-group input {
  width: 100%;
  border: 1px solid var(--input-border);
  border-radius: var(--radius-xl);
  background: var(--input-bg);
  color: var(--text-primary);
  padding: 0.95rem 1rem;
}

.field-group input:focus-visible {
  outline: 2px solid var(--input-focus);
  outline-offset: 2px;
}

.form-note a {
  color: var(--accent-teal);
  font-weight: var(--font-weight-semibold);
}

@media (max-width: 960px) {
  .auth-shell {
    grid-template-columns: 1fr;
  }
}
</style>
