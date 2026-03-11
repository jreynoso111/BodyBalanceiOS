if (__DEV__) {
  try {
    require('expo-dev-client');
  } catch {
    // Ignore when the dev launcher is not present in the current native build.
  }
}
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import 'react-native-reanimated';
import { Platform } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SystemUI from 'expo-system-ui';

import { ReferralRewardModal } from '@/components/ReferralRewardModal';
import { AppBiometricGate } from '@/components/AppBiometricGate';
import { useAuth } from '@/hooks/useAuth';
import { useAuthStore } from '@/store/authStore';
import { useThemeStore } from '@/store/themeStore';
import { usePaletteStore } from '@/store/paletteStore';
import { useAppTheme } from '@/hooks/useAppTheme';

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary,
} from 'expo-router';

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  // Expo Router uses Error Boundaries to catch errors in the navigation tree.
  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded && Platform.OS !== 'web') {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  if (!loaded && Platform.OS !== 'web') {
    return null;
  }

  return <RootLayoutNav />;
}

function RootLayoutNav() {
  useAuth(); // Handle redirects based on auth state
  const userId = useAuthStore((state) => state.user?.id);
  const hydrateThemePreference = useThemeStore((state) => state.hydrateThemePreference);
  const hydratePalettePreference = usePaletteStore((state) => state.hydratePalettePreference);
  const { colorScheme, theme } = useAppTheme();
  const navigationTheme = colorScheme === 'dark'
    ? {
        ...DarkTheme,
        colors: {
          ...DarkTheme.colors,
          ...theme.navigation,
        },
      }
    : {
        ...DefaultTheme,
        colors: {
          ...DefaultTheme.colors,
          ...theme.navigation,
        },
      };

  useEffect(() => {
    void hydrateThemePreference(userId);
  }, [hydrateThemePreference, userId]);

  useEffect(() => {
    void hydratePalettePreference(userId);
  }, [hydratePalettePreference, userId]);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    void SystemUI.setBackgroundColorAsync(theme.systemBackground).catch(() => null);
  }, [theme.systemBackground]);

  return (
    <SafeAreaProvider>
      <ThemeProvider value={navigationTheme}>
        <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
        <Stack
          screenOptions={{
            headerTransparent: true,
            headerTintColor: colorScheme === 'dark' ? '#F1F5F9' : '#0F172A',
            headerBackButtonDisplayMode: 'minimal',
            headerTitleStyle: {
              fontWeight: '800',
              fontSize: 18,
            },
            headerTitleAlign: 'center',
          }}
        >
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="(auth)/login" options={{ headerShown: false }} />
          <Stack.Screen name="(auth)/register" options={{ headerShown: false }} />
          <Stack.Screen name="auth/callback" options={{ headerShown: false }} />
          <Stack.Screen name="(auth)/forgot-password" options={{ title: 'Recover Password' }} />
          <Stack.Screen name="(auth)/reset-password" options={{ title: 'Reset Password' }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="(admin)" options={{ headerShown: false }} />
          <Stack.Screen name="admin" options={{ headerShown: false }} />
          <Stack.Screen name="loan/[id]" options={{ title: 'Lend/Borrow Details' }} />
          <Stack.Screen name="new-loan" options={{ title: 'New Lend/Borrow' }} />
          <Stack.Screen
            name="new-contact"
            options={{
              title: 'New Contact',
              headerTransparent: false,
              headerStyle: {
                backgroundColor: theme.navigation.card,
              },
            }}
          />
          <Stack.Screen name="payment" options={{ headerShown: false }} />
          <Stack.Screen name="register-payment" options={{ headerShown: false }} />
          <Stack.Screen name="profile" options={{ title: 'Profile' }} />
          <Stack.Screen name="subscription" options={{ title: 'Premium' }} />
          <Stack.Screen name="notifications" options={{ title: 'Notifications' }} />
          <Stack.Screen name="security" options={{ title: 'Security' }} />
          <Stack.Screen name="help-support" options={{ title: 'Help & Support' }} />
          <Stack.Screen name="contact" options={{ title: 'Contact Support' }} />
          <Stack.Screen name="help/[slug]" options={{ title: 'Help' }} />
          <Stack.Screen name="terms" options={{ title: 'Terms of Service' }} />
          <Stack.Screen name="privacy" options={{ title: 'Privacy Policy' }} />
          <Stack.Screen name="faq" options={{ title: 'FAQ' }} />
          <Stack.Screen name="modal" options={{ presentation: 'modal' }} />
        </Stack>
        <AppBiometricGate />
        <ReferralRewardModal />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
