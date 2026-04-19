import { useCallback } from 'react';

import { translateText } from '@/constants/i18n';
import { useAuthStore } from '@/store/authStore';

export function useI18n() {
  const language = useAuthStore((state) => state.language);

  const t = useCallback(
    (text: string, values?: Record<string, string | number | null | undefined>) =>
      translateText(text, language, values),
    [language]
  );

  return { language, t };
}
