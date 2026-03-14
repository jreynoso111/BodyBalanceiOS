const invoke = jest.fn();

jest.mock('@/services/supabase', () => ({
  supabase: {
    functions: {
      invoke,
    },
  },
}));

import { requestPasswordReset, requestSignupCode } from '@/services/publicAuth';

describe('publicAuth', () => {
  beforeEach(() => {
    invoke.mockReset();
  });

  it('routes signup code requests through the public-auth function', async () => {
    invoke.mockResolvedValue({
      data: { ok: true, action: 'request_signup_code', email: 'user@example.com' },
      error: null,
    });

    await expect(requestSignupCode({ email: ' USER@example.com ', fullName: ' Test User ' })).resolves.toEqual({
      ok: true,
      action: 'request_signup_code',
      email: 'user@example.com',
    });

    expect(invoke).toHaveBeenCalledWith('public-auth', {
      body: {
        action: 'request_signup_code',
        email: 'user@example.com',
        fullName: 'Test User',
      },
    });
  });

  it('routes reset password requests through the public-auth function', async () => {
    invoke.mockResolvedValue({
      data: { ok: true, action: 'request_password_reset', email: 'user@example.com', redirectTo: 'buddybalance://reset-password' },
      error: null,
    });

    await expect(
      requestPasswordReset({
        email: ' user@example.com ',
        redirectTo: ' buddybalance://reset-password ',
      })
    ).resolves.toEqual({
      ok: true,
      action: 'request_password_reset',
      email: 'user@example.com',
      redirectTo: 'buddybalance://reset-password',
    });

    expect(invoke).toHaveBeenCalledWith('public-auth', {
      body: {
        action: 'request_password_reset',
        email: 'user@example.com',
        redirectTo: 'buddybalance://reset-password',
      },
    });
  });

  it('surfaces backend failures', async () => {
    invoke.mockResolvedValue({ data: null, error: { message: 'Too many attempts' } });

    await expect(requestSignupCode({ email: 'user@example.com', fullName: 'User' })).rejects.toThrow('Too many attempts');
  });
});
