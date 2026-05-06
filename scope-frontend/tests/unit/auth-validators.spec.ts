import type { RegisterForm } from '@/types';
import { validateLoginForm, validateRegisterForm } from '@/utils/authValidators';

// Centralise defaults so every test only overrides the field under test.
// Keeping dateOfBirth dynamic (today minus 20y) means the COPPA threshold
// doesn't silently flip a test failure as the calendar advances.
function buildRegisterForm(overrides: Partial<RegisterForm> = {}): RegisterForm {
  const twentyYearsAgo = new Date();
  twentyYearsAgo.setUTCFullYear(twentyYearsAgo.getUTCFullYear() - 20);
  const isoDob = twentyYearsAgo.toISOString().slice(0, 10);

  return {
    username: 'johndoe',
    firstName: 'John',
    lastName: 'Doe',
    displayName: 'John Doe',
    email: 'john@example.com',
    phoneNumber: '',
    password: 'SecurePass123!',
    confirmPassword: 'SecurePass123!',
    dateOfBirth: isoDob,
    acceptedTerms: true,
    ...overrides,
  };
}

describe('auth validators', () => {
  it('flags empty login inputs', () => {
    const result = validateLoginForm({
      email: '   ',
      password: '   ',
    });

    expect(result.email).toContain('email');
    expect(result.password).toContain('password');
  });

  it('accepts email, phone, and name as login identifiers', () => {
    expect(validateLoginForm({
      email: 'louis@example.com',
      password: 'SecurePass123!',
    }).email).toBeUndefined();

    expect(validateLoginForm({
      email: '(555) 123-4567',
      password: 'SecurePass123!',
    }).email).toBeUndefined();

    expect(validateLoginForm({
      email: 'Louis Do',
      password: 'SecurePass123!',
    }).email).toBeUndefined();
  });

  it('flags malformed registration input', () => {
    const result = validateRegisterForm(buildRegisterForm({
      username: ' a ',
      firstName: '   ',
      lastName: '   ',
      displayName: '',
      email: 'not-an-email',
      password: '123',
      confirmPassword: '123',
    }));

    expect(result.username).toContain('at least 3');
    expect(result.firstName).toContain('first name');
    expect(result.lastName).toContain('last name');
    expect(result.email).toContain('valid email');
    expect(result.password).toContain('at least 10');
  });

  it('validates an optional registration phone number', () => {
    const missing = validateRegisterForm(buildRegisterForm({ phoneNumber: '' }));
    expect(missing.phoneNumber).toBeUndefined();

    const valid = validateRegisterForm(buildRegisterForm({ phoneNumber: '+1 (555) 123-4567' }));
    expect(valid.phoneNumber).toBeUndefined();

    const invalid = validateRegisterForm(buildRegisterForm({ phoneNumber: '555' }));
    expect(invalid.phoneNumber).toContain('10 to 15 digits');
  });

  it('rejects first and last names that look like handles', () => {
    const handleLike = validateRegisterForm(buildRegisterForm({
      firstName: 'John_Doe',
    }));

    expect(handleLike.firstName).toContain('letters, spaces');

    const withAtSymbol = validateRegisterForm(buildRegisterForm({
      lastName: '@johndoe',
    }));

    expect(withAtSymbol.lastName).toContain('letters, spaces');
  });

  it('accepts first and last names with spaces, hyphens, and apostrophes', () => {
    const plain = validateRegisterForm(buildRegisterForm({
      firstName: 'John',
      lastName: 'Doe',
      displayName: 'John Doe',
    }));
    expect(plain.firstName).toBeUndefined();
    expect(plain.lastName).toBeUndefined();

    const hyphenated = validateRegisterForm(buildRegisterForm({
      username: 'marylou',
      firstName: 'Mary-Lou',
      lastName: 'Smith',
      displayName: 'Mary-Lou Smith',
      email: 'mary@example.com',
    }));
    expect(hyphenated.firstName).toBeUndefined();
    expect(hyphenated.lastName).toBeUndefined();

    const apostrophe = validateRegisterForm(buildRegisterForm({
      username: 'seanob',
      firstName: 'Sean',
      lastName: "O'Brien",
      displayName: "Sean O'Brien",
      email: 'sean@example.com',
    }));
    expect(apostrophe.firstName).toBeUndefined();
    expect(apostrophe.lastName).toBeUndefined();
  });

  it('accepts handles with underscores, periods, and hyphens', () => {
    const result = validateRegisterForm(buildRegisterForm({
      username: 'louis.do_99-test',
      firstName: 'Louis',
      lastName: 'Do',
      displayName: 'Louis Do',
      email: 'louis@example.com',
    }));

    expect(result.username).toBeUndefined();
    expect(result.firstName).toBeUndefined();
    expect(result.lastName).toBeUndefined();
  });

  it('rejects handles with at signs or unsupported punctuation', () => {
    const withAtPrefix = validateRegisterForm(buildRegisterForm({
      username: '@louis',
    }));
    expect(withAtPrefix.username).toContain('letters, numbers');

    const emailLike = validateRegisterForm(buildRegisterForm({
      username: 'lou@scope',
    }));
    expect(emailLike.username).toContain('letters, numbers');
  });

  it('requires the confirm password to match exactly', () => {
    const mismatch = validateRegisterForm(buildRegisterForm({
      password: 'SecurePass123!',
      confirmPassword: 'SecurePass124!',
    }));
    expect(mismatch.confirmPassword).toContain('do not match');

    const missing = validateRegisterForm(buildRegisterForm({
      confirmPassword: '',
    }));
    expect(missing.confirmPassword).toContain('Re-enter');

    const matching = validateRegisterForm(buildRegisterForm());
    expect(matching.confirmPassword).toBeUndefined();
  });

  it('requires a birthday and enforces the 13+ minimum age', () => {
    const missing = validateRegisterForm(buildRegisterForm({ dateOfBirth: '' }));
    expect(missing.dateOfBirth).toContain('birthday');

    const malformed = validateRegisterForm(buildRegisterForm({ dateOfBirth: '12-31-2000' }));
    expect(malformed.dateOfBirth).toContain('YYYY-MM-DD');

    const future = new Date();
    future.setUTCFullYear(future.getUTCFullYear() + 1);
    const futureResult = validateRegisterForm(buildRegisterForm({
      dateOfBirth: future.toISOString().slice(0, 10),
    }));
    expect(futureResult.dateOfBirth).toContain('future');

    const tenYearsAgo = new Date();
    tenYearsAgo.setUTCFullYear(tenYearsAgo.getUTCFullYear() - 10);
    const tooYoung = validateRegisterForm(buildRegisterForm({
      dateOfBirth: tenYearsAgo.toISOString().slice(0, 10),
    }));
    expect(tooYoung.dateOfBirth).toContain('13');

    const justOldEnough = new Date();
    justOldEnough.setUTCFullYear(justOldEnough.getUTCFullYear() - 13);
    const accepted = validateRegisterForm(buildRegisterForm({
      dateOfBirth: justOldEnough.toISOString().slice(0, 10),
    }));
    expect(accepted.dateOfBirth).toBeUndefined();
  });

  it('requires acceptance of the terms and privacy policy', () => {
    const missing = validateRegisterForm(buildRegisterForm({ acceptedTerms: false }));
    expect(missing.acceptedTerms).toContain('Agree to the Terms');

    const ok = validateRegisterForm(buildRegisterForm({ acceptedTerms: true }));
    expect(ok.acceptedTerms).toBeUndefined();
  });
});
