import { useEffect, useRef } from 'react';
import { Alert, Platform } from 'react-native';

import {
  dismissAndroidUpdatePrompt,
  openGooglePlayForUpdate,
  shouldPromptForAndroidUpdate,
} from '@/services/appUpdate';
import { useAuthStore } from '@/store/authStore';

export function AppUpdatePrompt() {
  const initialized = useAuthStore((state) => state.initialized);
  const userId = useAuthStore((state) => state.user?.id);
  const hasPromptedRef = useRef(false);

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    if (!initialized || !userId || hasPromptedRef.current) return;

    let cancelled = false;
    hasPromptedRef.current = true;

    void (async () => {
      try {
        const updateInfo = await shouldPromptForAndroidUpdate();
        if (cancelled || !updateInfo.shouldPrompt || updateInfo.latestVersionCode == null) {
          return;
        }

        Alert.alert(
          'Update available',
          'A newer version of Buddy Balance is available in Google Play. Update now to keep using the latest fixes and features.',
          [
            {
              text: 'Later',
              style: 'cancel',
              onPress: () => {
                void dismissAndroidUpdatePrompt(updateInfo.latestVersionCode);
              },
            },
            {
              text: 'Update',
              onPress: () => {
                void openGooglePlayForUpdate();
              },
            },
          ],
          { cancelable: true }
        );
      } catch (error) {
        console.warn('app update check failed:', error);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [initialized, userId]);

  return null;
}
