describe('android app updates', () => {
  afterEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  it('checks the production Google Play track in production', async () => {
    const invoke = jest.fn().mockResolvedValue({
      data: {
        latestRelease: {
          latestVersionCode: 29,
          status: 'completed',
        },
      },
      error: null,
    });

    jest.doMock('react-native', () => ({
      Platform: { OS: 'android' },
      Linking: {
        canOpenURL: jest.fn(),
        openURL: jest.fn(),
      },
    }));
    jest.doMock('expo-application', () => ({
      nativeBuildVersion: '28',
      applicationId: 'com.test.buddybalance',
    }));
    jest.doMock('expo-constants', () => ({
      __esModule: true,
      default: {
        expoConfig: {
          extra: {
            appEnv: 'production',
          },
        },
      },
    }));
    jest.doMock('@react-native-async-storage/async-storage', () => ({
      getItem: jest.fn(),
      setItem: jest.fn(),
    }));
    jest.doMock('@/services/supabase', () => ({
      supabase: {
        functions: {
          invoke,
        },
      },
    }));

    const { getAndroidUpdateInfo } = await import('@/services/appUpdate');
    await expect(getAndroidUpdateInfo()).resolves.toMatchObject({
      updateAvailable: true,
      installedVersionCode: 28,
      latestVersionCode: 29,
      releaseStatus: 'completed',
      track: 'production',
    });
    expect(invoke).toHaveBeenCalledWith('google-play-sync', {
      body: {
        mode: 'latest_release',
        track: 'production',
        package_name: 'com.test.buddybalance',
      },
    });
  });

  it('keeps internal track outside production', async () => {
    const invoke = jest.fn().mockResolvedValue({
      data: {
        latestRelease: {
          latestVersionCode: 28,
          status: 'draft',
        },
      },
      error: null,
    });

    jest.doMock('react-native', () => ({
      Platform: { OS: 'android' },
      Linking: {
        canOpenURL: jest.fn(),
        openURL: jest.fn(),
      },
    }));
    jest.doMock('expo-application', () => ({
      nativeBuildVersion: '28',
      applicationId: 'com.test.buddybalance',
    }));
    jest.doMock('expo-constants', () => ({
      __esModule: true,
      default: {
        expoConfig: {
          extra: {
            appEnv: 'preview',
          },
        },
      },
    }));
    jest.doMock('@react-native-async-storage/async-storage', () => ({
      getItem: jest.fn(),
      setItem: jest.fn(),
    }));
    jest.doMock('@/services/supabase', () => ({
      supabase: {
        functions: {
          invoke,
        },
      },
    }));

    const { getAndroidUpdateInfo } = await import('@/services/appUpdate');
    await expect(getAndroidUpdateInfo()).resolves.toMatchObject({
      updateAvailable: false,
      installedVersionCode: 28,
      latestVersionCode: 28,
      releaseStatus: 'draft',
      track: 'internal',
    });
    expect(invoke).toHaveBeenCalledWith('google-play-sync', {
      body: {
        mode: 'latest_release',
        track: 'internal',
        package_name: 'com.test.buddybalance',
      },
    });
  });
});
