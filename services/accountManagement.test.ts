const getSession = jest.fn();
const invoke = jest.fn();

jest.mock('@/services/supabase', () => ({
  supabase: {
    auth: {
      getSession,
    },
    functions: {
      invoke,
    },
  },
}));

import { deleteMyAccount } from '@/services/accountManagement';

describe('accountManagement', () => {
  beforeEach(() => {
    getSession.mockReset();
    invoke.mockReset();
  });

  it('rejects missing confirmation text before hitting the backend', async () => {
    await expect(deleteMyAccount('delete-me')).rejects.toThrow('Type DELETE to confirm account deletion.');
    expect(getSession).not.toHaveBeenCalled();
  });

  it('requires an authenticated session before deleting the account', async () => {
    getSession.mockResolvedValue({ data: { session: null } });

    await expect(deleteMyAccount('DELETE')).rejects.toThrow('Your session is no longer available. Sign in again and retry.');
    expect(invoke).not.toHaveBeenCalled();
  });

  it('passes the authenticated deletion request to the backend', async () => {
    getSession.mockResolvedValue({ data: { session: { access_token: 'token-123' } } });
    invoke.mockResolvedValue({ data: { ok: true, action: 'delete_my_account' }, error: null });

    await expect(deleteMyAccount(' delete ')).resolves.toEqual({ ok: true, action: 'delete_my_account' });
    expect(invoke).toHaveBeenCalledWith('account-management', {
      body: {
        action: 'delete_my_account',
        confirmation: 'DELETE',
      },
      headers: {
        Authorization: 'Bearer token-123',
      },
    });
  });

  it('surfaces backend failures', async () => {
    getSession.mockResolvedValue({ data: { session: { access_token: 'token-123' } } });
    invoke.mockResolvedValue({ data: null, error: { message: 'Server unavailable' } });

    await expect(deleteMyAccount('DELETE')).rejects.toThrow('Server unavailable');
  });
});
