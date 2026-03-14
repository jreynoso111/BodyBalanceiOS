import { getPasswordPolicyMessage, isStrongPassword } from '@/services/passwordPolicy';

export function normalizeAuthEmail(value: string) {
  return value.trim().toLowerCase();
}

export function isValidEmail(value: string) {
  return /\S+@\S+\.\S+/.test(value);
}

export function mapRegistrationAuthError(message: string) {
  const normalized = message.toLowerCase();

  if (normalized.includes('already registered')) {
    return 'This email is already registered. Try signing in or reset your password.';
  }
  if (normalized.includes('password should be at least')) {
    return getPasswordPolicyMessage();
  }
  if (normalized.includes('unable to validate email address')) {
    return 'Please enter a valid email address.';
  }

  return message;
}

export function validateRegistrationFields(input: {
  fullName: string;
  email: string;
  password: string;
  confirmPassword: string;
}) {
  const normalizedEmail = normalizeAuthEmail(input.email);

  if (!input.fullName.trim()) {
    return 'Please enter your full name.';
  }
  if (!normalizedEmail) {
    return 'Please enter your email address.';
  }
  if (!isValidEmail(normalizedEmail)) {
    return 'Please enter a valid email address.';
  }
  if (!isStrongPassword(input.password)) {
    return getPasswordPolicyMessage();
  }
  if (input.password !== input.confirmPassword) {
    return 'Passwords do not match.';
  }

  return null;
}

export function validateVerificationCodeInput(value: string) {
  const token = value.trim().replace(/\s+/g, '');
  if (token.length < 6) {
    return 'Please enter the 6-digit verification code.';
  }

  return null;
}
