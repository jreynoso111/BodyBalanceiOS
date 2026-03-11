import Colors from './Colors';

export type AppThemeScheme = 'light' | 'dark';
export type AppPaletteName = 'indigo' | 'slate' | 'emerald' | 'sunset';

export const APP_PALETTES: Record<
  AppPaletteName,
  {
    label: string;
    lightAccent: string;
    lightAccentSoft: string;
    lightAccentBorder: string;
    lightBlobA: readonly [string, string];
    lightBlobB: readonly [string, string];
    darkAccent: string;
    darkAccentSoft: string;
    darkAccentBorder: string;
    darkBlobA: readonly [string, string];
    darkBlobB: readonly [string, string];
  }
> = {
  indigo: {
    label: 'Indigo',
    lightAccent: '#6366F1',
    lightAccentSoft: '#EEF2FF',
    lightAccentBorder: '#C7D2FE',
    lightBlobA: ['#4F46E5', '#818CF8'],
    lightBlobB: ['#7C3AED', '#A78BFA'],
    darkAccent: '#CBD5E1',
    darkAccentSoft: '#1E293B',
    darkAccentBorder: '#334155',
    darkBlobA: ['#0F172A', '#1E293B'],
    darkBlobB: ['#111827', '#334155'],
  },
  slate: {
    label: 'Slate',
    lightAccent: '#475569',
    lightAccentSoft: '#F1F5F9',
    lightAccentBorder: '#CBD5E1',
    lightBlobA: ['#CBD5E1', '#E2E8F0'],
    lightBlobB: ['#E5E7EB', '#F1F5F9'],
    darkAccent: '#E2E8F0',
    darkAccentSoft: '#1F2937',
    darkAccentBorder: '#475569',
    darkBlobA: ['#0F172A', '#1F2937'],
    darkBlobB: ['#111827', '#374151'],
  },
  emerald: {
    label: 'Emerald',
    lightAccent: '#059669',
    lightAccentSoft: '#ECFDF5',
    lightAccentBorder: '#A7F3D0',
    lightBlobA: ['#10B981', '#6EE7B7'],
    lightBlobB: ['#0F766E', '#5EEAD4'],
    darkAccent: '#A7F3D0',
    darkAccentSoft: '#0F172A',
    darkAccentBorder: '#134E4A',
    darkBlobA: ['#0F172A', '#052E2B'],
    darkBlobB: ['#111827', '#0F3D36'],
  },
  sunset: {
    label: 'Sunset',
    lightAccent: '#EA580C',
    lightAccentSoft: '#FFF7ED',
    lightAccentBorder: '#FED7AA',
    lightBlobA: ['#FB923C', '#FDBA74'],
    lightBlobB: ['#F97316', '#FCA5A5'],
    darkAccent: '#FDBA74',
    darkAccentSoft: '#1C1917',
    darkAccentBorder: '#7C2D12',
    darkBlobA: ['#0F172A', '#3F1D0F'],
    darkBlobB: ['#111827', '#7C2D12'],
  },
};

export function getAppTheme(colorScheme: AppThemeScheme, paletteName: AppPaletteName) {
  const palette = APP_PALETTES[paletteName];

  if (colorScheme === 'light') {
    return {
      systemBackground: '#F8F5FF',
      navigation: {
        primary: palette.lightAccent,
        background: '#F8F5FF',
        card: '#FFFFFF',
        border: '#E2E8F0',
        text: '#0F172A',
        notification: palette.lightAccent,
      },
      title: '#0F172A',
      secondaryText: '#64748B',
      tertiaryText: '#94A3B8',
      inputBackground: '#F8FAFC',
      inputBorder: '#E2E8F0',
      inputText: '#0F172A',
      primaryButton: '#0F172A',
      primaryButtonText: '#FFFFFF',
      secondaryButtonText: palette.lightAccent,
      googleButtonBackground: '#FFFFFF',
      googleButtonBorder: '#E2E8F0',
      googleButtonText: '#0F172A',
      googleButtonUnavailableBackground: '#F8FAFC',
      googleButtonUnavailableBorder: '#CBD5E1',
      backButton: '#0F172A',
      loadingIndicator: palette.lightAccent,
      feedbackErrorBackground: 'rgba(239, 68, 68, 0.08)',
      feedbackErrorBorder: 'rgba(239, 68, 68, 0.24)',
      feedbackErrorText: '#B91C1C',
      feedbackSuccessBackground: 'rgba(16, 185, 129, 0.08)',
      feedbackSuccessBorder: 'rgba(16, 185, 129, 0.24)',
      feedbackSuccessText: '#047857',
      feedbackInfoBackground: `${palette.lightAccent}14`,
      feedbackInfoBorder: `${palette.lightAccent}33`,
      feedbackInfoText: palette.lightAccent,
      backgroundBase: '#FFFFFF',
      backgroundOverlay: 'rgba(255, 255, 255, 0.4)',
      blobOpacity: 0.15,
      blobColorsA: palette.lightBlobA,
      blobColorsB: palette.lightBlobB,
      brandWordmark: '#0F172A',
      brandTagline: '#64748B',
      cardBackground: Colors.light.card,
      cardBorder: Colors.light.border,
      tint: palette.lightAccent,
      tintSoft: palette.lightAccentSoft,
      tintBorder: palette.lightAccentBorder,
    } as const;
  }

  return {
    systemBackground: '#020617',
    navigation: {
      primary: palette.darkAccent,
      background: '#020617',
      card: '#0F172A',
      border: '#334155',
      text: '#F1F5F9',
      notification: palette.darkAccent,
    },
    title: '#F8FAFC',
    secondaryText: '#94A3B8',
    tertiaryText: '#94A3B8',
    inputBackground: '#0F172A',
    inputBorder: '#334155',
    inputText: '#F8FAFC',
    primaryButton: '#334155',
    primaryButtonText: '#F8FAFC',
    secondaryButtonText: palette.darkAccent,
    googleButtonBackground: '#0F172A',
    googleButtonBorder: '#334155',
    googleButtonText: '#F8FAFC',
    googleButtonUnavailableBackground: '#0F172A',
    googleButtonUnavailableBorder: '#475569',
    backButton: '#F1F5F9',
    loadingIndicator: palette.darkAccent,
    feedbackErrorBackground: 'rgba(239, 68, 68, 0.14)',
    feedbackErrorBorder: 'rgba(248, 113, 113, 0.3)',
    feedbackErrorText: '#FCA5A5',
    feedbackSuccessBackground: 'rgba(16, 185, 129, 0.14)',
    feedbackSuccessBorder: 'rgba(52, 211, 153, 0.32)',
    feedbackSuccessText: '#6EE7B7',
    feedbackInfoBackground: 'rgba(51, 65, 85, 0.32)',
    feedbackInfoBorder: 'rgba(71, 85, 105, 0.5)',
    feedbackInfoText: '#CBD5E1',
    backgroundBase: '#020617',
    backgroundOverlay: 'rgba(2, 6, 23, 0.58)',
    blobOpacity: 0.28,
    blobColorsA: palette.darkBlobA,
    blobColorsB: palette.darkBlobB,
    brandWordmark: '#F8FAFC',
    brandTagline: '#94A3B8',
    cardBackground: Colors.dark.card,
    cardBorder: Colors.dark.border,
    tint: palette.darkAccent,
    tintSoft: palette.darkAccentSoft,
    tintBorder: palette.darkAccentBorder,
  } as const;
}

export type AppResolvedTheme = ReturnType<typeof getAppTheme>;
