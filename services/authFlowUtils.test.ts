import {
  isValidEmail,
  mapRegistrationAuthError,
  normalizeAuthEmail,
  validateRegistrationFields,
  validateVerificationCodeInput,
} from '@/services/authFlowUtils';

describe('authFlowUtils', () => {
  it('normalizes emails and validates format', () => {
    expect(normalizeAuthEmail('  USER@Example.COM  ')).toBe('user@example.com');
    expect(isValidEmail('person@example.com')).toBe(true);
    expect(isValidEmail('not-an-email')).toBe(false);
  });

  it('maps common Supabase auth errors to user-facing copy', () => {
    expect(mapRegistrationAuthError('User already registered')).toContain('already registered');
    expect(mapRegistrationAuthError('password should be at least 6 characters')).toContain('Password');
    expect(mapRegistrationAuthError('Unable to validate email address: invalid format')).toBe('Please enter a valid email address.');
  });

  it('validates registration fields before requesting an auth code', () => {
    expect(
      validateRegistrationFields({
        fullName: '',
        email: 'user@example.com',
        password: 'StrongPass123!',
        confirmPassword: 'StrongPass123!',
      })
    ).toBe('Please enter your full name.');

    expect(
      validateRegistrationFields({
        fullName: 'User',
        email: 'bad-email',
        password: 'StrongPass123!',
        confirmPassword: 'StrongPass123!',
      })
    ).toBe('Please enter a valid email address.');

    expect(
      validateRegistrationFields({
        fullName: 'User',
        email: 'user@example.com',
        password: 'StrongPass123!',
        confirmPassword: 'Mismatch123!',
      })
    ).toBe('Passwords do not match.');

    expect(
      validateRegistrationFields({
        fullName: 'User',
        email: 'user@example.com',
        password: 'StrongPass123!',
        confirmPassword: 'StrongPass123!',
      })
    ).toBeNull();
  });

  it('requires a 6-digit verification code before account verification', () => {
    expect(validateVerificationCodeInput('123')).toBe('Please enter the 6-digit verification code.');
    expect(validateVerificationCodeInput(' 123 456 ')).toBeNull();
  });
});
