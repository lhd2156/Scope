<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/authStore';

const router = useRouter();
const auth = useAuthStore();
const email = ref('');
const password = ref('');
const toast = ref<string | null>(null);

async function submit() {
  try {
    await auth.login(email.value, password.value);
    await router.replace('/dashboard');
  } catch (error) {
    toast.value =
      error instanceof Error && error.message === 'Access Denied' ? 'Access Denied' : 'Login failed';
  }
}
</script>

<template>
  <main class="login-page">
    <section class="glass-panel login-card">
      <div class="login-mark">AT</div>
      <p class="eyebrow">Scope Admin</p>
      <h1>Sign in to the control plane</h1>

      <form class="form-grid" @submit.prevent="submit">
        <label>
          Email
          <input v-model="email" required type="email" autocomplete="email" placeholder="admin@scope.local" />
        </label>
        <label>
          Password
          <input
            v-model="password"
            required
            type="password"
            autocomplete="current-password"
            placeholder="Enter password"
          />
        </label>
        <button class="btn primary" type="submit" :disabled="auth.loading">
          {{ auth.loading ? 'Signing in...' : 'Log in' }}
        </button>
      </form>
    </section>
    <div v-if="toast" class="toast" role="alert">
      <strong>{{ toast }}</strong>
      <span>Check your credentials and try again.</span>
    </div>
  </main>
</template>
