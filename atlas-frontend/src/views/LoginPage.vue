<template>
  <AuthSplitShell
    hero-eyebrow="Adventure platform"
    hero-title="Find the trip you left mid-route."
    hero-description="Sign in to sync saved spots, AI itineraries, traveler activity, and the real-world stories you already mapped across Atlas."
    :hero-highlights="loginHighlights"
    hero-image-src="https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=1920"
    hero-image-alt="Sunlit alpine valley surrounded by dramatic mountain peaks"
  >
    <article class="auth-card glass-panel">
      <header class="auth-card__header">
        <p class="eyebrow">Welcome back</p>
        <h2>Sign in to Atlas</h2>
        <p class="section-copy auth-card__description">
          Keep your routes, wishlists, and collaborative trip plans moving across every device.
        </p>
      </header>

      <form class="auth-form" @submit.prevent="submit">
        <p v-if="formError" class="form-error" role="alert">{{ formError }}</p>

        <AuthField
          v-model="email"
          type="email"
          label="Email address"
          icon="mail"
          autocomplete="email"
          inputmode="email"
          placeholder="louis@example.com"
          :error="fieldErrors.email"
        />

        <AuthField
          v-model="password"
          :type="showPassword ? 'text' : 'password'"
          label="Password"
          icon="lock"
          autocomplete="current-password"
          placeholder="Enter your password"
          :error="fieldErrors.password"
          :trailing-icon="showPassword ? 'eye-off' : 'eye'"
          :trailing-label="showPassword ? 'Hide password' : 'Show password'"
          @trailing-click="showPassword = !showPassword"
        />

        <div class="auth-meta">
          <label class="remember-toggle">
            <input v-model="rememberMe" type="checkbox" />
            <span>Remember me</span>
          </label>

          <a class="text-link" href="mailto:support@atlas.travel?subject=Atlas%20password%20reset">Forgot password?</a>
        </div>

        <Button class="submit-button" type="submit" :loading="isSubmitting" block>
          Sign In
        </Button>
      </form>

      <div class="auth-divider" aria-hidden="true">
        <span>Or continue with</span>
      </div>

      <Button class="oauth-button" type="button" variant="secondary" :loading="isOAuthSubmitting" block icon="globe" @click="loginWithGoogle">
        Continue with Google
      </Button>

      <p class="form-note">
        New here?
        <RouterLink to="/register">Create an account</RouterLink>
      </p>
    </article>
  </AuthSplitShell>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { RouterLink, useRoute, useRouter } from 'vue-router';
import AuthField from '@/components/auth/AuthField.vue';
import AuthSplitShell from '@/components/auth/AuthSplitShell.vue';
import Button from '@/components/common/Button.vue';
import { useAuthStore } from '@/stores/auth';
import { validateLoginForm, type LoginFormErrors } from '@/utils/authValidators';

const loginHighlights = [
  'Saved spots stay synced',
  'AI route drafts are ready',
  'Traveler activity follows you',
];

const email = ref('louis@example.com');
const password = ref('SecurePass123!');
const rememberMe = ref(true);
const showPassword = ref(false);
const isSubmitting = ref(false);
const isOAuthSubmitting = ref(false);
const formError = ref('');
const fieldErrors = ref<LoginFormErrors>({});
const authStore = useAuthStore();
const route = useRoute();
const router = useRouter();

function resolveRedirectTarget() {
  const redirectTarget = typeof route.query.redirect === 'string' ? route.query.redirect : '';
  return redirectTarget || '/map';
}

async function submit() {
  fieldErrors.value = validateLoginForm({
    email: email.value,
    password: password.value,
  });
  formError.value = '';
  authStore.clearError();

  if (Object.keys(fieldErrors.value).length) {
    return;
  }

  isSubmitting.value = true;

  try {
    await authStore.login({ email: email.value, password: password.value });
    await router.push(resolveRedirectTarget());
  } catch {
    formError.value = authStore.error || 'Atlas could not sign you in right now.';
  } finally {
    isSubmitting.value = false;
  }
}

async function loginWithGoogle() {
  isOAuthSubmitting.value = true;
  formError.value = '';
  authStore.clearError();

  try {
    await authStore.loginWithCognito();
    await router.push(resolveRedirectTarget());
  } catch {
    formError.value = authStore.error || 'Atlas could not sign you in with Google right now.';
  } finally {
    isOAuthSubmitting.value = false;
  }
}
</script>

<style scoped>
.auth-card {
  display: grid;
  gap: var(--space-6);
  width: min(100%, 32rem);
  margin-inline: auto;
  padding: clamp(var(--space-6), 4vw, var(--space-8));
  border-radius: clamp(var(--radius-xl), 3vw, var(--radius-2xl));
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--glass-bg) 90%, transparent), color-mix(in srgb, var(--glass-bg) 78%, transparent)),
    radial-gradient(circle at top, color-mix(in srgb, var(--accent-teal) 12%, transparent), transparent 58%);
  border: 1px solid color-mix(in srgb, var(--accent-teal) 16%, var(--glass-border));
  box-shadow:
    var(--shadow-lg),
    0 0 0 1px color-mix(in srgb, var(--accent-teal) 10%, transparent);
  transition:
    transform var(--transition-fast),
    box-shadow var(--transition-fast),
    border-color var(--transition-fast);
}

.auth-card:hover,
.auth-card:focus-within {
  transform: translateY(-0.25rem);
  border-color: color-mix(in srgb, var(--accent-teal) 24%, var(--glass-border));
  box-shadow:
    0 1.5rem 3rem color-mix(in srgb, var(--bg-primary) 18%, transparent),
    0 0 0 1px color-mix(in srgb, var(--accent-teal) 14%, transparent);
}

.auth-card__header,
.auth-form {
  display: grid;
  gap: var(--space-4);
}

.auth-card__header h2,
.auth-card__description,
.form-note,
.form-error,
.auth-divider {
  margin: 0;
}

.eyebrow {
  color: var(--accent-teal);
  text-transform: uppercase;
  letter-spacing: var(--letter-spacing-eyebrow);
  font-size: var(--font-size-caption);
  font-weight: var(--font-weight-medium);
}

.auth-card__header h2 {
  font-size: var(--font-size-h1);
  line-height: var(--line-height-tight);
  letter-spacing: var(--letter-spacing-display);
}

.auth-card__description {
  color: var(--text-secondary);
}

.form-error {
  padding: 0.9rem 1rem;
  border: 1px solid color-mix(in srgb, var(--danger) 48%, transparent);
  border-radius: var(--radius-lg);
  background: color-mix(in srgb, var(--danger) 12%, transparent);
  color: var(--text-primary);
}

.auth-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
  flex-wrap: wrap;
}

.remember-toggle {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  color: var(--text-secondary);
  font-size: var(--font-size-small);
}

.remember-toggle input {
  width: 1rem;
  height: 1rem;
  margin: 0;
  accent-color: var(--accent-teal);
}

.text-link,
.form-note a {
  color: var(--accent-teal);
  text-decoration: none;
}

.text-link {
  font-size: var(--font-size-small);
  font-weight: var(--font-weight-medium);
}

.text-link:hover,
.text-link:focus-visible,
.form-note a:hover,
.form-note a:focus-visible {
  color: var(--text-primary);
  text-decoration: underline;
}

.submit-button.atlas-button--primary,
.oauth-button.atlas-button--secondary {
  width: 100%;
  min-height: 3.7rem;
  padding-inline: 1.25rem;
}

.submit-button.atlas-button--primary {
  background: linear-gradient(135deg, var(--accent-teal), color-mix(in srgb, var(--accent-teal) 78%, var(--accent-gold) 12%));
  color: var(--text-primary);
  box-shadow: var(--shadow-glow-teal), var(--shadow-md);
}

.submit-button.atlas-button--primary:hover,
.submit-button.atlas-button--primary:focus-visible {
  background: linear-gradient(135deg, var(--accent-teal-hover), var(--accent-teal));
}

.oauth-button.atlas-button--secondary {
  border-color: color-mix(in srgb, var(--glass-border) 92%, var(--border));
  background: color-mix(in srgb, var(--bg-secondary) 84%, transparent);
  box-shadow: inset 0 1px 0 color-mix(in srgb, var(--text-primary) 5%, transparent);
}

.oauth-button.atlas-button--secondary:hover,
.oauth-button.atlas-button--secondary:focus-visible {
  border-color: color-mix(in srgb, var(--accent-teal) 28%, var(--border));
  background: color-mix(in srgb, var(--accent-teal-light) 62%, var(--bg-secondary));
}

.auth-divider {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  color: var(--text-muted);
  font-size: var(--font-size-caption);
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.auth-divider::before,
.auth-divider::after {
  content: '';
  flex: 1;
  height: 1px;
  background: linear-gradient(90deg, transparent, color-mix(in srgb, var(--glass-border) 90%, var(--border)), transparent);
}

.form-note {
  color: var(--text-secondary);
  text-align: center;
}

.form-note a {
  font-weight: var(--font-weight-semibold);
}

@media (max-width: 680px) {
  .auth-card {
    width: 100%;
    gap: var(--space-5);
  }
}

@media (prefers-reduced-motion: reduce) {
  .auth-card,
  .submit-button.atlas-button--primary,
  .oauth-button.atlas-button--secondary,
  .text-link,
  .form-note a {
    transition: none;
  }
}
</style>
