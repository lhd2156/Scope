import type { AuthForm, RegisterForm } from '@/types';

// Keep in sync with Scope.Core.Infrastructure.Services.PasswordPolicy.
// Frontend only surfaces fast, client-side feedback; the authoritative
// policy lives server-side and is enforced by AuthService.RegisterAsync.
const PASSWORD_MIN_LENGTH = 10;
const PASSWORD_REQUIRED_CLASSES = 3;
const COMMON_PASSWORDS = new Set([
  'password',
  'password1',
  'password123',
  'qwerty123',
  'letmein',
  'welcome1',
  'admin1234',
  'scope1234',
  'scope_dev_2026!',
  'changeme',
  'p@ssw0rd',
]);
const HANDLE_MIN_LENGTH = 3;
const HANDLE_MAX_LENGTH = 30;
const NAME_MAX_LENGTH = 40;
const DISPLAY_NAME_MIN_LENGTH = 2;
const DISPLAY_NAME_MAX_LENGTH = 60;
const PHONE_DIGIT_MIN_LENGTH = 10;
const PHONE_DIGIT_MAX_LENGTH = 15;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Scope handles allow letters, digits, underscores, periods, and hyphens.
// No @ signs, spaces, emoji, or other punctuation.
const HANDLE_PATTERN = /^[a-zA-Z0-9._-]+$/;
// Display names are presented as "First Last" style labels, so we allow
// unicode letters, spaces, apostrophes, hyphens, and periods - but no @,
// digits, or other punctuation that would make it feel like a handle.
const DISPLAY_NAME_PATTERN = /^[\p{L}][\p{L}\s'.-]*$/u;
const PHONE_IDENTIFIER_PATTERN = /^\+?[0-9\s().-]+$/;

const HANDLE_RULES_MESSAGE =
  'Use only letters, numbers, underscores, periods, or hyphens (e.g. johndoe).';
const PERSONAL_NAME_RULES_MESSAGE =
  'Use letters, spaces, hyphens, or apostrophes.';

// Scope follows the US COPPA floor for account creation. Keep in sync with
// the backend profile validator if/when it is added.
const MIN_AGE_YEARS = 13;
const MAX_AGE_YEARS = 120;
const DATE_OF_BIRTH_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export type LoginFormErrors = Partial<Record<keyof AuthForm, string>>;
export type RegisterFormErrors = Partial<Record<keyof RegisterForm, string>>;

export function validateLoginForm(input: AuthForm): LoginFormErrors {
  const errors: LoginFormErrors = {};
  const identifier = input.email.trim();
  const password = input.password.trim();

  const identifierError = validateLoginIdentifier(identifier);
  if (identifierError) {
    errors.email = identifierError;
  }

  if (!password) {
    errors.password = 'Enter your password to continue.';
  }

  return errors;
}

function validateHandle(value: string): string | undefined {
  if (!value) {
    return 'required';
  }

  if (value.length < HANDLE_MIN_LENGTH) {
    return `Use at least ${HANDLE_MIN_LENGTH} characters.`;
  }

  if (value.length > HANDLE_MAX_LENGTH) {
    return `Keep it under ${HANDLE_MAX_LENGTH} characters.`;
  }

  if (!HANDLE_PATTERN.test(value)) {
    return HANDLE_RULES_MESSAGE;
  }

  return undefined;
}

function validateDateOfBirth(value: string): string | undefined {
  if (!value) {
    return 'required';
  }

  if (!DATE_OF_BIRTH_PATTERN.test(value)) {
    return 'Use the YYYY-MM-DD format.';
  }

  // Build a UTC midnight so local timezone offsets cannot flip the day
  // boundary and push a 13-year-old back below the COPPA minimum.
  const [yearStr, monthStr, dayStr] = value.split('-');
  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);
  const birth = new Date(Date.UTC(year, month - 1, day));

  if (
    Number.isNaN(birth.getTime()) ||
    birth.getUTCFullYear() !== year ||
    birth.getUTCMonth() !== month - 1 ||
    birth.getUTCDate() !== day
  ) {
    return 'Enter a real calendar date.';
  }

  const now = new Date();
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

  if (birth.getTime() > today.getTime()) {
    return 'Your birthday cannot be in the future.';
  }

  // Age in completed years, rounded down. We compare day-of-year so the
  // 13th birthday itself unlocks the account immediately.
  let age = today.getUTCFullYear() - birth.getUTCFullYear();
  const monthDelta = today.getUTCMonth() - birth.getUTCMonth();
  if (monthDelta < 0 || (monthDelta === 0 && today.getUTCDate() < birth.getUTCDate())) {
    age -= 1;
  }

  if (age < MIN_AGE_YEARS) {
    return `You must be at least ${MIN_AGE_YEARS} years old to join Scope.`;
  }

  if (age > MAX_AGE_YEARS) {
    return 'Double-check that birthday — that looks too far back.';
  }

  return undefined;
}

function validatePersonalName(value: string, label: 'first' | 'last'): string | undefined {
  if (!value) {
    return 'required';
  }

  if (value.length > NAME_MAX_LENGTH) {
    return `Keep your ${label} name under ${NAME_MAX_LENGTH} characters.`;
  }

  if (!DISPLAY_NAME_PATTERN.test(value)) {
    return PERSONAL_NAME_RULES_MESSAGE;
  }

  return undefined;
}

function digitCount(value: string): number {
  return value.replace(/\D/g, '').length;
}

function validatePhoneNumber(value: string): string | undefined {
  if (!PHONE_IDENTIFIER_PATTERN.test(value) || !/\d/.test(value)) {
    return 'Use a phone number with digits, spaces, dashes, or parentheses.';
  }

  const digits = digitCount(value);
  if (digits < PHONE_DIGIT_MIN_LENGTH || digits > PHONE_DIGIT_MAX_LENGTH) {
    return `Use a phone number with ${PHONE_DIGIT_MIN_LENGTH} to ${PHONE_DIGIT_MAX_LENGTH} digits.`;
  }

  return undefined;
}

function validateOptionalPhoneNumber(value: string): string | undefined {
  if (!value) return undefined;
  return validatePhoneNumber(value);
}

function validateLoginIdentifier(value: string): string | undefined {
  if (!value) {
    return 'Enter your email, phone number, or display name.';
  }

  if (value.includes('@')) {
    return EMAIL_PATTERN.test(value) ? undefined : 'Enter a valid email address.';
  }

  if (PHONE_IDENTIFIER_PATTERN.test(value) && /\d/.test(value)) {
    return validatePhoneNumber(value);
  }

  if (!validateDisplayName(value) || !validateHandle(value)) {
    return undefined;
  }

  return 'Use a valid email, phone number, or display name.';
}

function validateDisplayName(value: string): string | undefined {
  if (!value) {
    return 'required';
  }

  if (value.length < DISPLAY_NAME_MIN_LENGTH) {
    return `Use at least ${DISPLAY_NAME_MIN_LENGTH} characters.`;
  }

  if (value.length > DISPLAY_NAME_MAX_LENGTH) {
    return `Keep it under ${DISPLAY_NAME_MAX_LENGTH} characters.`;
  }

  if (!DISPLAY_NAME_PATTERN.test(value)) {
    return PERSONAL_NAME_RULES_MESSAGE;
  }

  return undefined;
}

export function validateRegisterForm(input: RegisterForm): RegisterFormErrors {
  const errors: RegisterFormErrors = {};
  const username = input.username.trim();
  const firstName = input.firstName.trim();
  const lastName = input.lastName.trim();
  const displayName = input.displayName.trim() || [firstName, lastName].filter(Boolean).join(' ');
  const email = input.email.trim();
  const password = input.password.trim();

  if (!email) {
    errors.email = 'Enter your email address.';
  } else if (!EMAIL_PATTERN.test(email)) {
    errors.email = 'Enter a valid email address.';
  }

  const usernameError = validateHandle(username);
  if (usernameError === 'required') {
    errors.username = 'Choose a handle (e.g. johndoe).';
  } else if (usernameError) {
    errors.username = usernameError;
  }

  const firstNameError = validatePersonalName(firstName, 'first');
  if (firstNameError === 'required') {
    errors.firstName = 'Enter your first name.';
  } else if (firstNameError) {
    errors.firstName = firstNameError;
  }

  const lastNameError = validatePersonalName(lastName, 'last');
  if (lastNameError === 'required') {
    errors.lastName = 'Enter your last name.';
  } else if (lastNameError) {
    errors.lastName = lastNameError;
  }

  const displayNameError = validateDisplayName(displayName);
  if (!firstNameError && !lastNameError && displayNameError) {
    errors.lastName = displayNameError;
  }

  const passwordError = validatePasswordStrength(password, {
    username,
    email,
  });
  if (!password) {
    errors.password = 'Create a password to continue.';
  } else if (passwordError) {
    errors.password = passwordError;
  }

  const confirmPassword = input.confirmPassword.trim();
  if (!confirmPassword) {
    errors.confirmPassword = 'Re-enter your password.';
  } else if (confirmPassword !== password) {
    errors.confirmPassword = 'Passwords do not match yet — try again.';
  }

  const dateOfBirthError = validateDateOfBirth(input.dateOfBirth.trim());
  if (dateOfBirthError === 'required') {
    errors.dateOfBirth = 'Add your birthday so we can set up age-appropriate defaults.';
  } else if (dateOfBirthError) {
    errors.dateOfBirth = dateOfBirthError;
  }

  if (input.acceptedTerms !== true) {
    errors.acceptedTerms = 'Agree to the Terms and Privacy Policy.';
  }

  const phoneNumberError = validateOptionalPhoneNumber(input.phoneNumber?.trim() ?? '');
  if (phoneNumberError) {
    errors.phoneNumber = phoneNumberError;
  }

  return errors;
}

export function validatePasswordStrength(
  password: string,
  context: { username?: string; email?: string } = {},
): string | undefined {
  if (!password) {
    return undefined;
  }
  if (password.length < PASSWORD_MIN_LENGTH) {
    return `Use at least ${PASSWORD_MIN_LENGTH} characters for a stronger password.`;
  }
  let classes = 0;
  if (/[a-z]/.test(password)) classes++;
  if (/[A-Z]/.test(password)) classes++;
  if (/[0-9]/.test(password)) classes++;
  if (/[^A-Za-z0-9]/.test(password)) classes++;
  if (classes < PASSWORD_REQUIRED_CLASSES) {
    return 'Include at least three of: lowercase, uppercase, digit, symbol.';
  }
  if (COMMON_PASSWORDS.has(password.toLowerCase())) {
    return 'That password is too common. Pick something less predictable.';
  }
  if (context.username && password.toLowerCase().includes(context.username.toLowerCase())) {
    return 'Your password should not contain your handle.';
  }
  const emailLocal = context.email?.split('@', 1)[0];
  if (emailLocal && password.toLowerCase().includes(emailLocal.toLowerCase())) {
    return 'Your password should not contain your email name.';
  }
  return undefined;
}
