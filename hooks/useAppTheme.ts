import { getAppTheme } from '@/constants/AppTheme';
import { useColorScheme } from '@/components/useColorScheme';
import { usePaletteStore } from '@/store/paletteStore';

export function useAppTheme() {
  const colorScheme = useColorScheme();
  const palette = usePaletteStore((state) => state.palette);

  return {
    colorScheme,
    palette,
    theme: getAppTheme(colorScheme, palette),
  };
}
