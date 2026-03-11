import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/Themed';
import { useColorScheme } from '@/components/useColorScheme';
import { APP_PALETTES, AppPaletteName } from '@/constants/AppTheme';
import { usePaletteStore } from '@/store/paletteStore';
import { useAuthStore } from '@/store/authStore';
import { ThemePreference, useThemeStore } from '@/store/themeStore';

const THEME_OPTIONS: Array<{ label: string; value: ThemePreference }> = [
  { label: 'System', value: 'system' },
  { label: 'Light', value: 'light' },
  { label: 'Dark', value: 'dark' },
];

export function ThemePreferencePicker({
  title = 'Appearance',
  description = 'Choose whether Buddy Balance stays light, dark, or follows the system on this device for this account.',
}: {
  title?: string;
  description?: string;
}) {
  const colorScheme = useColorScheme();
  const preference = useThemeStore((state) => state.preference);
  const setThemePreference = useThemeStore((state) => state.setThemePreference);
  const userId = useAuthStore((state) => state.user?.id);
  const isDark = colorScheme === 'dark';

  return (
    <View style={styles.pickerBlock}>
      <Text style={[styles.pickerTitle, isDark && styles.pickerTitleDark]}>{title}</Text>
      <Text style={[styles.pickerDescription, isDark && styles.pickerDescriptionDark]}>{description}</Text>

      <View style={[styles.pickerRow, isDark && styles.pickerRowDark]}>
        {THEME_OPTIONS.map((option) => {
          const active = preference === option.value;

          return (
            <Pressable
              key={option.value}
              onPress={() => void setThemePreference(option.value, userId)}
              style={({ pressed }) => [
                styles.pickerOption,
                isDark ? styles.pickerOptionDark : styles.pickerOptionLight,
                active && (isDark ? styles.pickerOptionActiveDark : styles.pickerOptionActiveLight),
                pressed && styles.pickerOptionPressed,
              ]}
            >
              <Text
                style={[
                  styles.pickerOptionLabel,
                  isDark ? styles.pickerOptionLabelDark : styles.pickerOptionLabelLight,
                  active && styles.pickerOptionLabelActive,
                ]}
              >
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export function ColorPalettePicker({
  title = 'Color Palette',
  description = 'Choose the accent palette. Dark mode keeps the same neutral gray base and only changes accent color.',
}: {
  title?: string;
  description?: string;
}) {
  const colorScheme = useColorScheme();
  const palette = usePaletteStore((state) => state.palette);
  const setPalettePreference = usePaletteStore((state) => state.setPalettePreference);
  const userId = useAuthStore((state) => state.user?.id);
  const isDark = colorScheme === 'dark';

  return (
    <View style={styles.pickerBlock}>
      <Text style={[styles.pickerTitle, isDark && styles.pickerTitleDark]}>{title}</Text>
      <Text style={[styles.pickerDescription, isDark && styles.pickerDescriptionDark]}>{description}</Text>

      <View style={styles.paletteList}>
        {(Object.entries(APP_PALETTES) as Array<[AppPaletteName, (typeof APP_PALETTES)[AppPaletteName]]>).map(([key, value]) => {
          const active = palette === key;
          const swatchColor = isDark ? value.darkAccent : value.lightAccent;

          return (
            <Pressable
              key={key}
              onPress={() => void setPalettePreference(key, userId)}
              style={({ pressed }) => [
                styles.paletteCard,
                isDark ? styles.paletteCardDark : styles.paletteCardLight,
                active && (isDark ? styles.paletteCardActiveDark : styles.paletteCardActiveLight),
                pressed && styles.pickerOptionPressed,
              ]}
            >
              <View style={[styles.paletteSwatch, { backgroundColor: swatchColor }]} />
              <Text style={[styles.paletteLabel, isDark ? styles.pickerOptionLabelDark : styles.pickerOptionLabelLight]}>
                {value.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  pickerBlock: {
    gap: 10,
    backgroundColor: 'transparent',
  },
  pickerTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  pickerTitleDark: {
    color: '#F8FAFC',
  },
  pickerDescription: {
    fontSize: 13,
    lineHeight: 20,
    color: '#64748B',
  },
  pickerDescriptionDark: {
    color: '#94A3B8',
  },
  pickerRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    padding: 6,
    borderRadius: 18,
    backgroundColor: '#EEF2FF',
  },
  pickerRowDark: {
    backgroundColor: '#111827',
  },
  pickerOption: {
    minHeight: 40,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pickerOptionLight: {
    backgroundColor: '#FFFFFF',
    borderColor: '#D6DAFF',
  },
  pickerOptionDark: {
    backgroundColor: '#0F172A',
    borderColor: '#1F2937',
  },
  pickerOptionActiveLight: {
    backgroundColor: '#5B63FF',
    borderColor: '#5B63FF',
  },
  pickerOptionActiveDark: {
    backgroundColor: '#334155',
    borderColor: '#475569',
  },
  pickerOptionPressed: {
    opacity: 0.92,
  },
  pickerOptionLabel: {
    fontSize: 13,
    fontWeight: '800',
  },
  pickerOptionLabelLight: {
    color: '#334155',
  },
  pickerOptionLabelDark: {
    color: '#CBD5E1',
  },
  pickerOptionLabelActive: {
    color: '#FFFFFF',
  },
  paletteList: {
    gap: 10,
    backgroundColor: 'transparent',
  },
  paletteCard: {
    minHeight: 52,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  paletteCardLight: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E2E8F0',
  },
  paletteCardDark: {
    backgroundColor: '#0F172A',
    borderColor: '#334155',
  },
  paletteCardActiveLight: {
    borderColor: '#94A3B8',
    backgroundColor: '#F8FAFC',
  },
  paletteCardActiveDark: {
    borderColor: '#475569',
    backgroundColor: '#111827',
  },
  paletteSwatch: {
    width: 18,
    height: 18,
    borderRadius: 999,
  },
  paletteLabel: {
    fontSize: 14,
    fontWeight: '800',
  },
});
