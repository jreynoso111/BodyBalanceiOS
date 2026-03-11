import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

import { AppPaletteName } from '@/constants/AppTheme';

const PALETTE_KEY_PREFIX = 'palette_preference';
const DEFAULT_PALETTE: AppPaletteName = 'indigo';

function isPalette(value: string | null): value is AppPaletteName {
  return value === 'indigo' || value === 'slate' || value === 'emerald' || value === 'sunset';
}

function buildStorageKey(userId?: string | null) {
  return `${PALETTE_KEY_PREFIX}:${userId || 'guest'}`;
}

interface PaletteState {
  palette: AppPaletteName;
  hydrated: boolean;
  hydratedKey: string | null;
  hydratePalettePreference: (userId?: string | null) => Promise<void>;
  setPalettePreference: (palette: AppPaletteName, userId?: string | null) => Promise<void>;
}

export const usePaletteStore = create<PaletteState>((set, get) => ({
  palette: DEFAULT_PALETTE,
  hydrated: false,
  hydratedKey: null,
  hydratePalettePreference: async (userId) => {
    const storageKey = buildStorageKey(userId);
    if (get().hydrated && get().hydratedKey === storageKey) return;

    try {
      const stored = await AsyncStorage.getItem(storageKey);
      set({
        palette: isPalette(stored) ? stored : DEFAULT_PALETTE,
        hydrated: true,
        hydratedKey: storageKey,
      });
    } catch {
      set({
        palette: DEFAULT_PALETTE,
        hydrated: true,
        hydratedKey: storageKey,
      });
    }
  },
  setPalettePreference: async (palette, userId) => {
    const storageKey = buildStorageKey(userId);
    set({ palette, hydrated: true, hydratedKey: storageKey });

    try {
      await AsyncStorage.setItem(storageKey, palette);
    } catch {
      // Keep in-memory palette on persistence failures.
    }
  },
}));
