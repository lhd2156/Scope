<template>
  <AppShell>
    <div class="page-container auth-page">
      <section class="glass-panel auth-shell">
        <div class="auth-copy">
          <p class="eyebrow">Welcome back</p>
          <h1>Pick up your next mapped adventure.</h1>
          <p class="section-copy">
            Sign in to sync saved spots, AI itineraries, friend activity, and notification history across the Atlas platform.
          </p>
        </div>

        <form class="surface-card auth-card" @submit.prevent="submit">
          <label class="field-group">
            <span>Email</span>
            <input v-model.trim="email" type="email" autocomplete="email" placeholder="louis@example.com" required />
          </label>

          <label class="field-group">
            <span>Password</span>
            <input v-model="password" type="password" autocomplete="current-password" placeholder="Enter your password" required />
          </label>

          <div class="auth-actions">
            <Button type="submit" :loading="isSubmitting" block>Log in</Button>
            <Button type="button" variant="secondary" :loading="isOAuthSubmitting" block icon="globe" @click="loginWithGoogle">
              Login with Google
            </Button>
          </div>

          <p class="form-note">
            New here?
            <RouterLink to="/register">Create an account</RouterLink>
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

const email = ref('louis@example.com');
const password = ref('SecurePass123!');
const isSubmitting = ref(false);
const isOAuthSubmitting = ref(false);
const authStore = useAuthStore();
const route = useRoute();
const router = useRouter();

function resolveRedirectTarget() {
  const redirectTarget = typeof route.query.redirect === 'string' ? route.query.redirect : '';
  return redirectTarget || '/map';
}

async function submit() {
  isSubmitting.value = true;
  await authStore.login({ email: email.value, password: password.value });
  isSubmitting.value = false;
  await router.push(resolveRedirectTarget());
}

async function loginWithGoogle() {
  isOAuthSubmitting.value = true;
  await authStore.loginWithCognito();
  isOAuthSubmitting.value = false;
  await router.push(resolveRedirectTarget());
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

.field-group,
.auth-actions {
  display: grid;
  gap: var(--space-3);
}

.field-group span,
.form-note {
  color: var(--text-secondary);
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
