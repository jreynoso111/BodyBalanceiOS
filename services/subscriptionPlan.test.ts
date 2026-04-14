describe('subscription plan trial access', () => {
  const now = Date.parse('2026-04-12T12:00:00.000Z');

  beforeEach(() => {
    jest.resetModules();
    jest.spyOn(Date, 'now').mockReturnValue(now);
    jest.doMock('@/services/supabase', () => ({
      supabase: {},
    }));
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('treats recent free accounts as trial users', async () => {
    const {
      PREMIUM_TRIAL_DAYS,
      getMembershipStatus,
      getPlanLabel,
      getPremiumTrialDaysRemaining,
      hasPremiumAccess,
      hasPremiumTrialAccess,
    } = await import('@/services/subscriptionPlan');
    const createdAt = '2026-04-01T12:00:00.000Z';

    expect(hasPremiumTrialAccess(createdAt, now)).toBe(true);
    expect(getPremiumTrialDaysRemaining(createdAt, now)).toBe(PREMIUM_TRIAL_DAYS - 11);
    expect(getMembershipStatus('free', { trialStartedAt: createdAt })).toBe('trial');
    expect(hasPremiumAccess('free', { trialStartedAt: createdAt })).toBe(true);
    expect(getPlanLabel('free', { trialStartedAt: createdAt })).toBe('Trial');
  });

  it('expires trial access after 21 days', async () => {
    const {
      getMembershipStatus,
      getPremiumTrialDaysRemaining,
      hasPremiumAccess,
      hasPremiumTrialAccess,
    } = await import('@/services/subscriptionPlan');
    const createdAt = '2026-03-20T12:00:00.000Z';

    expect(hasPremiumTrialAccess(createdAt, now)).toBe(false);
    expect(getPremiumTrialDaysRemaining(createdAt, now)).toBe(0);
    expect(getMembershipStatus('free', { trialStartedAt: createdAt })).toBe('free');
    expect(hasPremiumAccess('free', { trialStartedAt: createdAt })).toBe(false);
  });

  it('keeps paid users as premium regardless of trial window', async () => {
    const { getMembershipStatus, getPlanLabel, hasPremiumAccess } = await import('@/services/subscriptionPlan');

    expect(getMembershipStatus('premium', { trialStartedAt: '2020-01-01T00:00:00.000Z' })).toBe('premium');
    expect(hasPremiumAccess('premium', { trialStartedAt: '2020-01-01T00:00:00.000Z' })).toBe(true);
    expect(getPlanLabel('premium', { trialStartedAt: '2020-01-01T00:00:00.000Z' })).toBe('Premium');
  });
});
