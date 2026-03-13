describe('billing readiness', () => {
  afterEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    delete process.env.EXPO_PUBLIC_ANDROID_PREMIUM_PRODUCT_ID;
  });

  it('returns not ready when backend health probe fails', async () => {
    process.env.EXPO_PUBLIC_ANDROID_PREMIUM_PRODUCT_ID = 'premium_access';

    jest.doMock('react-native', () => ({
      Platform: { OS: 'android' },
    }));
    jest.doMock('expo-constants', () => ({
      __esModule: true,
      default: {
        expoConfig: {
          android: { package: 'com.test.buddybalance' },
        },
      },
    }));
    jest.doMock('expo-iap', () => ({
      initConnection: jest.fn().mockResolvedValue(true),
      endConnection: jest.fn(),
      fetchProducts: jest.fn(),
      finishTransaction: jest.fn(),
      getAvailablePurchases: jest.fn(),
      requestPurchase: jest.fn(),
      restorePurchases: jest.fn(),
    }));
    jest.doMock('@/services/supabase', () => ({
      supabase: {
        functions: {
          invoke: jest.fn().mockResolvedValue({
            data: null,
            error: { message: 'Missing Google Play service account secrets.' },
          }),
        },
      },
    }));
    jest.doMock('@/store/authStore', () => ({
      useAuthStore: {
        getState: () => ({
          setPlanTier: jest.fn(),
        }),
      },
    }));

    const { getBillingReadiness } = await import('@/services/billing');
    await expect(getBillingReadiness()).resolves.toEqual({
      available: true,
      ready: false,
      reason: 'Missing Google Play service account secrets.',
    });
  });

  it('returns ready when local config, store connection, and backend probe all pass', async () => {
    process.env.EXPO_PUBLIC_ANDROID_PREMIUM_PRODUCT_ID = 'premium_access';

    jest.doMock('react-native', () => ({
      Platform: { OS: 'android' },
    }));
    jest.doMock('expo-constants', () => ({
      __esModule: true,
      default: {
        expoConfig: {
          android: { package: 'com.test.buddybalance' },
        },
      },
    }));
    jest.doMock('expo-iap', () => ({
      initConnection: jest.fn().mockResolvedValue(true),
      endConnection: jest.fn(),
      fetchProducts: jest.fn(),
      finishTransaction: jest.fn(),
      getAvailablePurchases: jest.fn(),
      requestPurchase: jest.fn(),
      restorePurchases: jest.fn(),
    }));
    jest.doMock('@/services/supabase', () => ({
      supabase: {
        functions: {
          invoke: jest.fn().mockResolvedValue({
            data: { ok: true, ready: true },
            error: null,
          }),
        },
      },
    }));
    jest.doMock('@/store/authStore', () => ({
      useAuthStore: {
        getState: () => ({
          setPlanTier: jest.fn(),
        }),
      },
    }));

    const { getBillingReadiness } = await import('@/services/billing');
    await expect(getBillingReadiness()).resolves.toEqual({
      available: true,
      ready: true,
      reason: null,
    });
  });
});
