import type { AuthForm, RegisterForm } from '@/types';

const PASSWORD_MIN_LENGTH = 8;
const USERNAME_MIN_LENGTH = 3;
const USERNAME_MAX_LENGTH = 40;
const DISPLAY_NAME_MAX_LENGTH = 80;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_PATTERN = /^[a-zA-Z0-9._-]+$/;

export type LoginFormErrors = Partial<Record<keyof AuthForm, string>>;
export type RegisterFormErrors = Partial<Record<keyof RegisterForm, string>>;

export function validateLoginForm(input: AuthForm): LoginFormErrors {
  const errors: LoginFormErrors = {};
  const email = input.email.trim();
  const password = input.password.trim();

  if (!email) {
    errors.email = 'Enter the email tied to your Atlas account.';
  } else if (!EMAIL_PATTERN.test(email)) {
    errors.email = 'Enter a valid email address.';
  }

  if (!password) {
    errors.password = 'Enter your password to continue.';
  }

  return errors;
}

export function validateRegisterForm(input: RegisterForm): RegisterFormErrors {
  const errors: RegisterFormErrors = {
    ...validateLoginForm(input),
  };
  const username = input.username.trim();
  const displayName = input.displayName.trim();
  const password = input.password.trim();

  if (!username) {
    errors.username = 'Choose a username for your Atlas profile.';
  } else if (username.length < USERNAME_MIN_LENGTH) {
    errors.username = `Use at least ${USERNAME_MIN_LENGTH} characters for your username.`;
  } else if (username.length > USERNAME_MAX_LENGTH) {
    errors.username = `Keep the username under ${USERNAME_MAX_LENGTH} characters.`;
  } else if (!USERNAME_PATTERN.test(username)) {
    errors.username = 'Usernames can only use letters, numbers, periods, underscores, and hyphens.';
  }

  if (!displayName) {
    errors.displayName = 'Add the name people will see across Atlas.';
  } else if (displayName.length > DISPLAY_NAME_MAX_LENGTH) {
    errors.displayName = `Keep the display name under ${DISPLAY_NAME_MAX_LENGTH} characters.`;
  }

  if (password && password.length < PASSWORD_MIN_LENGTH) {
    errors.password = `Use at least ${PASSWORD_MIN_LENGTH} characters for a stronger password.`;
  }

  return errors;
}
