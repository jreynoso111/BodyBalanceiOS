import AsyncStorage from '@react-native-async-storage/async-storage';

function getBiometricLockKey(userId: string) {
  return `biometric_lock_enabled:${userId}`;
}

export async function getCachedBiometricLockEnabled(userId: string): Promise<boolean> {
  if (!userId) return false;
  const value = await AsyncStorage.getItem(getBiometricLockKey(userId));
  return value === 'true';
}

export async function setCachedBiometricLockEnabled(userId: string, enabled: boolean) {
  if (!userId) return;
  await AsyncStorage.setItem(getBiometricLockKey(userId), enabled ? 'true' : 'false');
}
