export function getPasswordPolicyMessage() {
  return 'Password must be at least 10 characters and include uppercase, lowercase, and a number.';
}

export function isStrongPassword(password: string) {
  if (password.length < 10) return false;
  if (!/[a-z]/.test(password)) return false;
  if (!/[A-Z]/.test(password)) return false;
  if (!/[0-9]/.test(password)) return false;
  return true;
}
