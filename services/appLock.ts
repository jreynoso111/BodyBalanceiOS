import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

function getBiometricLockKey(userId: string) {
  return `biometric_lock_enabled:${userId}`;
}

export async function getCachedBiometricLockEnabled(userId: string): Promise<boolean> {
  if (!userId) return false;
  const key = getBiometricLockKey(userId);

  try {
    const secureValue = await SecureStore.getItemAsync(key);
    if (secureValue === 'true' || secureValue === 'false') {
      return secureValue === 'true';
    }
  } catch {
    // Fall back to AsyncStorage for environments where SecureStore is unavailable.
  }

  const value = await AsyncStorage.getItem(key);
  return value === 'true';
}

export async function setCachedBiometricLockEnabled(userId: string, enabled: boolean) {
  if (!userId) return;
  const key = getBiometricLockKey(userId);
  const value = enabled ? 'true' : 'false';

  try {
    await SecureStore.setItemAsync(key, value);
  } catch {
    // Fall back to AsyncStorage for environments where SecureStore is unavailable.
  }

  await AsyncStorage.setItem(key, value);
}
