<template>
  <AuthSplitShell
    class="register-stage"
    hero-eyebrow="Build your scope"
    hero-title="Map the stories waiting beyond the next ridge."
    hero-description="Create an account to drop pins, upload rich travel photography, and turn real-world community data into smarter itineraries."
    :hero-highlights="registerHighlights"
    :hero-image-src="DEMO_HERO_IMAGES.auth"
    hero-image-alt="Golden hour over an alpine valley with winding rivers and steep mountain ridges"
    :show-panel-effects="false"
  >
    <article class="auth-card glass-panel">
      <header class="auth-card__header">
        <p class="eyebrow">Create account</p>
        <h2>Create your Scope account</h2>
        <p class="section-copy auth-card__description">
          Document real places, real photos, and real stories on a map built for premium travel planning.
        </p>
      </header>

      <form class="auth-form" novalidate @submit.prevent="submit">
        <p v-if="formError" class="form-error" role="alert">{{ formError }}</p>

        <div class="auth-form__row">
          <AuthField
            v-model="firstName"
            label="First name"
            icon="user"
            autocomplete="given-name"
            placeholder="John"
            :maxlength="40"
            :error="fieldErrors.firstName"
          />

          <AuthField
            v-model="lastName"
            label="Last name"
            icon="user"
            autocomplete="family-name"
            placeholder="Doe"
            :maxlength="40"
            :error="fieldErrors.lastName"
          />
        </div>

        <div class="auth-form__row">
          <AuthField
            v-model="username"
            label="Username"
            icon="user"
            autocomplete="username"
            placeholder="johndoe"
            prefix="@"
            :maxlength="30"
            :error="fieldErrors.username"
          />

          <AuthField
            v-model="email"
            label="Email address"
            icon="mail"
            autocomplete="email"
            inputmode="email"
            placeholder="john@example.com"
            :error="fieldErrors.email"
          />
        </div>

        <div class="auth-form__row auth-form__row--birthday-phone">
          <DateField
            v-model="dateOfBirth"
            label="Birthday"
            autocomplete="bday"
            placeholder="MM/DD/YYYY"
            :error="fieldErrors.dateOfBirth"
            help="You must be 13 or older to use Scope."
            prefer-help-when-error
          />

          <AuthField
            v-model="phoneNumber"
            type="tel"
            label="Phone number"
            icon="phone"
            autocomplete="tel"
            inputmode="tel"
            placeholder="(555) 123-4567"
            :maxlength="32"
            :error="fieldErrors.phoneNumber"
            help="Optional sign-in method."
          />
        </div>

        <div class="auth-form__row">
          <AuthField
            v-model="password"
            :type="showPassword ? 'text' : 'password'"
            label="Password"
            icon="lock"
            autocomplete="new-password"
            placeholder="Create a strong password"
            :error="fieldErrors.password"
            :trailing-icon="showPassword ? 'eye-off' : 'eye'"
            :trailing-label="showPassword ? 'Hide password' : 'Show password'"
            @trailing-click="showPassword = !showPassword"
          />

          <AuthField
            v-model="confirmPassword"
            :type="showConfirmPassword ? 'text' : 'password'"
            label="Confirm password"
            icon="lock"
            autocomplete="new-password"
            placeholder="Re-enter your password"
            :error="fieldErrors.confirmPassword"
            :trailing-icon="showConfirmPassword ? 'eye-off' : 'eye'"
            :trailing-label="showConfirmPassword ? 'Hide password' : 'Show password'"
            @trailing-click="showConfirmPassword = !showConfirmPassword"
          />
        </div>

        <div class="auth-form__consent">
          <input
            id="register-accept-terms"
            v-model="acceptedTerms"
            class="auth-form__consent-input"
            type="checkbox"
            :aria-invalid="Boolean(fieldErrors.acceptedTerms)"
            :aria-describedby="fieldErrors.acceptedTerms ? 'register-accept-terms-error' : undefined"
          />
          <div class="auth-form__consent-copy">
            <label class="auth-form__consent-label" for="register-accept-terms">
              I agree to the Scope
              <RouterLink class="auth-form__consent-link" to="/terms">Terms of Service</RouterLink>
              and
              <RouterLink class="auth-form__consent-link" to="/privacy">Privacy Policy</RouterLink>
              .
            </label>
            <small
              id="register-accept-terms-error"
              class="auth-form__consent-error"
              :class="{ 'is-empty': !fieldErrors.acceptedTerms }"
              :role="fieldErrors.acceptedTerms ? 'alert' : undefined"
              :aria-hidden="fieldErrors.acceptedTerms ? undefined : 'true'"
            >{{ fieldErrors.acceptedTerms || '\u00a0' }}</small>
          </div>
        </div>

        <Button class="submit-button" type="submit" :loading="isSubmitting" block>
          Create Account
        </Button>
      </form>

      <div class="auth-divider" aria-hidden="true">
        <span>Or continue with</span>
      </div>

      <Button class="oauth-button" type="button" variant="secondary" :loading="isOAuthSubmitting" block icon="globe" @click="registerWithGoogle">
        Continue with Google
      </Button>

      <p class="form-note">
        Already have an account?
        <RouterLink to="/login">Sign in</RouterLink>
      </p>
    </article>
  </AuthSplitShell>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { RouterLink, useRoute, useRouter } from 'vue-router';
import AuthField from '@/components/auth/AuthField.vue';
import AuthSplitShell from '@/components/auth/AuthSplitShell.vue';
import DateField from '@/components/auth/DateField.vue';
import Button from '@/components/common/Button.vue';
import { useAuthStore } from '@/stores/auth';
import { validateRegisterForm, type RegisterFormErrors } from '@/utils/authValidators';
import { DEMO_HERO_IMAGES } from '@/utils/demoMedia';
import { sanitizeInternalRouteTarget } from '@/utils/navigationSafety';

const registerHighlights = [
  'Drop pins with real photos',
  'Coordinate shared trips faster',
  'Unlock AI itinerary planning',
];

const username = ref('');
const firstName = ref('');
const lastName = ref('');
const email = ref('');
const dateOfBirth = ref('');
const phoneNumber = ref('');
const password = ref('');
const confirmPassword = ref('');
const showPassword = ref(false);
const showConfirmPassword = ref(false);
const acceptedTerms = ref(false);
const isSubmitting = ref(false);
const isOAuthSubmitting = ref(false);
const formError = ref('');
const fieldErrors = ref<RegisterFormErrors>({});
const authStore = useAuthStore();
const route = useRoute();
const router = useRouter();

function resolveRedirectTarget() {
  return sanitizeInternalRouteTarget(route.query.redirect, '/map');
}

// After account creation we always walk new explorers through the
// interest picker so the rest of the app can personalize immediately.
// The original redirect target is preserved via query so the preferences
// screen can forward users to whatever route originally kicked them to
// register (e.g. deep link to /trips/:id).
async function routeToOnboarding() {
  const destination = resolveRedirectTarget();
  await router.push({
    name: 'onboarding-preferences',
    query: destination && destination !== '/map' ? { redirect: destination } : undefined,
  });
}

function buildDisplayName() {
  return [firstName.value, lastName.value].map((part) => part.trim()).filter(Boolean).join(' ');
}

async function submit() {
  const displayName = buildDisplayName();

  fieldErrors.value = validateRegisterForm({
    username: username.value,
    firstName: firstName.value,
    lastName: lastName.value,
    displayName,
    email: email.value,
    phoneNumber: phoneNumber.value,
    password: password.value,
    confirmPassword: confirmPassword.value,
    dateOfBirth: dateOfBirth.value,
    acceptedTerms: acceptedTerms.value,
  });
  formError.value = '';
  authStore.clearError();

  if (Object.keys(fieldErrors.value).length) {
    return;
  }

  isSubmitting.value = true;

  try {
    await authStore.register({
      username: username.value,
      firstName: firstName.value,
      lastName: lastName.value,
      displayName,
      email: email.value,
      phoneNumber: phoneNumber.value,
      password: password.value,
      confirmPassword: confirmPassword.value,
      dateOfBirth: dateOfBirth.value,
      acceptedTerms: acceptedTerms.value,
    });
    await routeToOnboarding();
  } catch {
    formError.value = authStore.error || 'Scope could not create your account right now.';
  } finally {
    isSubmitting.value = false;
  }
}

async function registerWithGoogle() {
  formError.value = '';
  fieldErrors.value = {};
  if (!acceptedTerms.value) {
    formError.value = 'Agree to the Terms of Service and Privacy Policy before continuing with Google.';
    return;
  }

  isOAuthSubmitting.value = true;
  authStore.clearError();

  try {
    await authStore.loginWithCognito();
    await routeToOnboarding();
  } catch {
    formError.value = authStore.error || 'Scope could not continue with Google right now.';
  } finally {
    isOAuthSubmitting.value = false;
  }
}
</script>

<style scoped>
.auth-card {
  --register-card-radius: clamp(var(--radius-xl), 3vw, var(--radius-2xl));

  position: relative;
  display: grid;
  gap: 0.52rem;
  width: min(100%, 40.75rem);
  container-type: inline-size;
  margin-inline: auto;
  padding-block: clamp(0.95rem, 1.55vh, var(--space-4));
  padding-inline: clamp(var(--space-6), 4vw, var(--space-8));
  border-radius: var(--register-card-radius);
  background:
    radial-gradient(circle at 50% 0%, color-mix(in srgb, var(--accent-teal) 10%, transparent), transparent 58%),
    linear-gradient(
      180deg,
      color-mix(in srgb, var(--bg-elevated) 68%, var(--bg-secondary) 32%),
      color-mix(in srgb, var(--bg-secondary) 64%, var(--bg-elevated) 36%)
    );
  border: 1px solid color-mix(in srgb, var(--accent-teal) 18%, var(--glass-border));
  box-shadow:
    var(--shadow-lg),
    0 0 0 1px color-mix(in srgb, var(--accent-teal) 8%, transparent);
  /*
   * No translateY on hover: the auth panel uses overflow:hidden and a
   * negative lift clips the top border off. Shadow + border affordance only.
   */
  transition:
    box-shadow var(--transition-fast),
    border-color var(--transition-fast);
}

.auth-card:hover,
.auth-card:focus-within {
  background:
    radial-gradient(circle at 50% 0%, color-mix(in srgb, var(--accent-teal) 12%, transparent), transparent 58%),
    linear-gradient(
      180deg,
      color-mix(in srgb, var(--bg-elevated) 74%, var(--bg-secondary) 26%),
      color-mix(in srgb, var(--bg-secondary) 58%, var(--bg-elevated) 42%)
    );
  border-color: color-mix(in srgb, var(--accent-teal) 26%, var(--glass-border));
  box-shadow:
    0 1.5rem 3rem color-mix(in srgb, var(--bg-primary) 18%, transparent),
    0 0 0 1px color-mix(in srgb, var(--accent-teal) 14%, transparent);
}

.auth-card__header,
.auth-form {
  display: grid;
  gap: 0.52rem;
}

.auth-card__header {
  gap: 0.26rem;
}

.auth-card__header h2,
.auth-card__description,
.form-note,
.form-error,
.auth-divider {
  margin: 0;
}

.auth-form__row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  align-items: start;
  column-gap: var(--space-4);
  row-gap: 0.4rem;
}

.auth-form__row--single {
  grid-template-columns: minmax(0, 1fr);
}

.auth-form__row--birthday-phone {
  grid-template-columns: minmax(13.25rem, 0.86fr) minmax(13rem, 1.14fr);
}

.auth-form__consent {
  display: grid;
  grid-template-columns: auto 1fr;
  align-items: start;
  gap: var(--space-2);
  padding-block: 0;
}

.auth-form__consent-input {
  width: 1.15rem;
  height: 1.15rem;
  margin: 0.2rem 0 0;
  flex-shrink: 0;
  cursor: pointer;
  accent-color: var(--accent-teal);
  border-radius: var(--radius-sm);
}

.auth-form__consent-copy {
  display: grid;
  gap: var(--space-1);
  min-width: 0;
}

.auth-form__consent-label {
  margin: 0;
  color: var(--text-secondary);
  font-size: var(--font-size-small);
  line-height: var(--line-height-normal);
  cursor: pointer;
}

.auth-form__consent-link {
  color: var(--accent-teal);
  font-weight: var(--font-weight-semibold);
  text-decoration: none;
}

.auth-form__consent-link:hover,
.auth-form__consent-link:focus-visible {
  color: var(--text-primary);
  text-decoration: underline;
  outline: none;
}

.auth-form__consent-error {
  color: var(--danger);
  font-size: var(--font-size-caption);
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
  font-size: min(var(--font-size-h1), 1.9rem);
  line-height: var(--line-height-tight);
  letter-spacing: var(--letter-spacing-display);
}

.auth-card__description {
  color: var(--text-secondary);
  font-size: var(--font-size-small);
}

.form-error {
  padding: 0.75rem 0.9rem;
  border: 1px solid color-mix(in srgb, var(--danger) 48%, transparent);
  border-radius: var(--radius-lg);
  background: color-mix(in srgb, var(--danger) 12%, transparent);
  color: var(--danger);
  font-size: var(--font-size-small);
  font-weight: var(--font-weight-medium);
}

/*
 * Slightly compact shell size keeps all six fields visible on a typical
 * 720-900px tall viewport without scrolling while still giving the
 * inputs enough breathing room to read like a premium auth form.
 */
.auth-form :deep(.auth-field__shell) {
  min-height: 2.66rem;
  padding: 0 0.84rem;
}

.auth-form :deep(.auth-field__input) {
  min-width: 0;
  padding: 0.44rem 0;
  font-size: 0.92rem;
  line-height: 1.25;
}

.auth-form :deep(.date-field__shell) {
  min-height: 2.66rem;
  padding: 0 0.84rem;
}

.auth-form :deep(.date-field__input) {
  min-width: 0;
  padding: 0.44rem 0;
  font-size: 0.92rem;
  line-height: 1.25;
}

.auth-form :deep(.auth-field__message),
.auth-form :deep(.date-field__message),
.auth-form__consent-error {
  display: block;
  min-height: 0.96rem;
  line-height: 1.2;
  overflow: hidden;
}

.auth-form__consent-error.is-empty {
  visibility: hidden;
  pointer-events: none;
}

.submit-button.scope-button--primary,
.oauth-button.scope-button--secondary {
  width: 100%;
  min-height: 2.68rem;
  padding-inline: 1.25rem;
}

.submit-button.scope-button--primary {
  background: linear-gradient(135deg, var(--accent-teal), color-mix(in srgb, var(--accent-teal) 78%, var(--accent-gold) 12%));
  color: var(--text-primary);
  box-shadow: var(--shadow-glow-teal), var(--shadow-md);
}

.submit-button.scope-button--primary:hover,
.submit-button.scope-button--primary:focus-visible {
  background: linear-gradient(135deg, var(--accent-teal-hover), var(--accent-teal));
}

.oauth-button.scope-button--secondary {
  border-color: color-mix(in srgb, var(--glass-border) 92%, var(--border));
  background: color-mix(in srgb, var(--bg-secondary) 84%, transparent);
  box-shadow: inset 0 1px 0 color-mix(in srgb, var(--text-primary) 5%, transparent);
}

.oauth-button.scope-button--secondary:hover,
.oauth-button.scope-button--secondary:focus-visible {
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
  font-size: var(--font-size-small);
}

.form-note a {
  color: var(--accent-teal);
  font-weight: var(--font-weight-semibold);
  text-decoration: none;
}

.form-note a:hover,
.form-note a:focus-visible {
  color: var(--text-primary);
  text-decoration: underline;
}

:global(.auth-stage.register-stage:not(.is-scope-qa) .auth-stage__panel-shell) {
  max-width: calc(40.75rem + 1.5rem);
  padding: 0.75rem;
  scroll-padding-block: 0.75rem;
}

/*
 * Below this width we stop stacking fields side-by-side so the labels
 * and errors keep their full reading width on phones.
 */
@media (max-width: 680px) {
  .auth-card {
    width: 100%;
    gap: var(--space-3);
  }
}

/*
 * The register form needs real horizontal room for six fields plus inline
 * validation. Until the viewport is wide enough for both the hero and a
 * readable two-column card, let the auth panel own the full screen.
 */
@media (max-width: 1599px) {
  :global(.auth-stage.register-stage:not(.is-scope-qa)) {
    grid-template-columns: minmax(0, 1fr);
  }

  :global(.auth-stage.register-stage:not(.is-scope-qa) .auth-stage__hero) {
    display: none;
  }

  :global(.auth-stage.register-stage:not(.is-scope-qa) .auth-stage__panel-side) {
    min-height: 100dvh;
    padding-block-start: max(
      clamp(1.35rem, 2.7vh, var(--space-7)),
      env(safe-area-inset-top, 0px)
    );
    padding-block-end: max(
      clamp(1.35rem, 2.7vh, var(--space-7)),
      env(safe-area-inset-bottom, 0px)
    );
    padding-left: max(
      clamp(var(--space-5), 8vw, var(--space-16)),
      env(safe-area-inset-left, 0px)
    );
    padding-right: max(
      clamp(var(--space-5), 8vw, var(--space-16)),
      env(safe-area-inset-right, 0px)
    );
  }

  :global(.auth-stage.register-stage:not(.is-scope-qa) .auth-stage__panel-shell) {
    max-height: calc(100dvh - 2.7rem);
  }
}

@media (max-width: 1024px) {
  :global(.auth-stage.register-stage:not(.is-scope-qa) .auth-stage__panel-side) {
    overflow-y: auto;
    overflow-x: hidden;
  }

  :global(.auth-stage.register-stage:not(.is-scope-qa) .auth-stage__panel-shell) {
    max-height: none;
    overflow: visible;
  }
}

@container (max-width: 34rem) {
  .auth-form__row {
    grid-template-columns: minmax(0, 1fr);
    gap: var(--space-3);
  }
}

@media (prefers-reduced-motion: reduce) {
  .auth-card,
  .submit-button.scope-button--primary,
  .oauth-button.scope-button--secondary,
  .form-note a {
    transition: none;
  }
}
</style>
