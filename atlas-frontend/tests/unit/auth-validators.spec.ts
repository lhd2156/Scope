import { validateLoginForm, validateRegisterForm } from '@/utils/authValidators';

describe('auth validators', () => {
  it('flags empty login inputs', () => {
    const result = validateLoginForm({
      email: '   ',
      password: '   ',
    });

    expect(result.email).toContain('email');
    expect(result.password).toContain('password');
  });

  it('flags malformed registration input', () => {
    const result = validateRegisterForm({
      username: ' a ',
      displayName: '   ',
      email: 'not-an-email',
      password: '123',
    });

    expect(result.username).toContain('at least 3');
    expect(result.displayName).toContain('name people will see');
    expect(result.email).toContain('valid email');
    expect(result.password).toContain('at least 8');
  });
});
