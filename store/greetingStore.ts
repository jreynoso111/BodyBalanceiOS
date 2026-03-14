import { create } from 'zustand';
import { AppLanguage, getDeviceLanguage } from '@/constants/i18n';
import { buildGreetingSequence, getRandomGreetingIndex } from '@/services/greetingUtils';

interface GreetingState {
  greetings: readonly string[];
  currentIndex: number;
  initialized: boolean;
  language: AppLanguage;
  initializeGreeting: (language?: AppLanguage) => void;
  advanceGreeting: () => void;
  setLanguagePreference: (language: AppLanguage) => void;
}

export const useGreetingStore = create<GreetingState>((set, get) => ({
  greetings: buildGreetingSequence(getDeviceLanguage()),
  currentIndex: 0,
  initialized: false,
  language: getDeviceLanguage(),
  initializeGreeting: (preferredLanguage) =>
    set((state) => {
      const nextLanguage = preferredLanguage || state.language;

      if (state.initialized && state.language === nextLanguage) {
        return state;
      }

      const nextGreetings = buildGreetingSequence(nextLanguage);

      return {
        ...state,
        initialized: true,
        language: nextLanguage,
        greetings: nextGreetings,
        currentIndex: getRandomGreetingIndex(nextGreetings),
      };
    }),
  advanceGreeting: () => {
    const { greetings, currentIndex } = get();
    set({ currentIndex: (currentIndex + 1) % greetings.length });
  },
  setLanguagePreference: (language) =>
    set((state) => {
      if (state.language === language && state.initialized) {
        return state;
      }

      const nextGreetings = buildGreetingSequence(language);

      return {
        ...state,
        language,
        initialized: true,
        greetings: nextGreetings,
        currentIndex: getRandomGreetingIndex(nextGreetings),
      };
    }),
}));
