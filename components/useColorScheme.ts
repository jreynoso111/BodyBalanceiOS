import { useColorScheme as useColorSchemeCore } from 'react-native';
import { useThemeStore } from '@/store/themeStore';

export const useColorScheme = () => {
  const coreScheme = useColorSchemeCore();
  const preference = useThemeStore((state) => state.preference);
  const systemScheme = coreScheme === 'dark' ? 'dark' : 'light';

  return preference === 'system' ? systemScheme : preference;
};
