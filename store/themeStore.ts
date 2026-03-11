import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

export type ThemePreference = 'system' | 'light' | 'dark';

const THEME_PREFERENCE_KEY_PREFIX = 'theme_preference';
const DEFAULT_THEME_PREFERENCE: ThemePreference = 'light';

function isThemePreference(value: string | null): value is ThemePreference {
  return value === 'system' || value === 'light' || value === 'dark';
}

function buildStorageKey(userId?: string | null) {
  return `${THEME_PREFERENCE_KEY_PREFIX}:${userId || 'guest'}`;
}

interface ThemeState {
  preference: ThemePreference;
  hydrated: boolean;
  hydratedKey: string | null;
  hydrateThemePreference: (userId?: string | null) => Promise<void>;
  setThemePreference: (preference: ThemePreference, userId?: string | null) => Promise<void>;
  toggleThemePreference: (currentScheme: 'light' | 'dark', userId?: string | null) => Promise<void>;
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  preference: DEFAULT_THEME_PREFERENCE,
  hydrated: false,
  hydratedKey: null,
  hydrateThemePreference: async (userId) => {
    const storageKey = buildStorageKey(userId);
    if (get().hydrated && get().hydratedKey === storageKey) return;

    try {
      const storedPreference = await AsyncStorage.getItem(storageKey);
      set({
        preference: isThemePreference(storedPreference) ? storedPreference : DEFAULT_THEME_PREFERENCE,
        hydrated: true,
        hydratedKey: storageKey,
      });
    } catch {
      set({
        preference: DEFAULT_THEME_PREFERENCE,
        hydrated: true,
        hydratedKey: storageKey,
      });
    }
  },
  setThemePreference: async (preference, userId) => {
    const storageKey = buildStorageKey(userId);
    set({ preference, hydrated: true, hydratedKey: storageKey });

    try {
      await AsyncStorage.setItem(storageKey, preference);
    } catch {
      // Keep in-memory preference even if persistence fails.
    }
  },
  toggleThemePreference: async (currentScheme, userId) => {
    const nextPreference = currentScheme === 'dark' ? 'light' : 'dark';
    await get().setThemePreference(nextPreference, userId);
  },
}));
