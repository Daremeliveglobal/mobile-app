import { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';
import { fontsToLoad } from '../constants/Fonts';
import { StoreProvider } from '../src/store/Provider';
import { NotificationProvider } from '../src/context/NotificationContext';
import { useAuthRouting } from '../src/hooks/useAuthRouting';
import { useAuthSession } from '../src/hooks/useAuthSession';
import { useIAPListener } from '../src/hooks/useIAPListener';
import { I18nextProvider } from 'react-i18next';
import * as Sentry from '@sentry/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import i18n, { initializeLanguage } from '../src/i18n';
import { logger } from '../src/utils/logger';
import '../global.css';

// Initialize Sentry for production error tracking
import '../sentry.config';

// Keep the splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync();

function AppLayout() {
  const { isLoading: authLoading } = useAuthSession();
  const [fontsLoaded] = useFonts(fontsToLoad);
  const [languageReady, setLanguageReady] = useState(false);
  useIAPListener();

  // Initialize i18n language preferences
  useEffect(() => {
    const setupLanguage = async () => {
      try {
        await initializeLanguage();
        setLanguageReady(true);
      } catch (error) {
        logger.error('Language setup failed:', error);
        setLanguageReady(true); // Continue anyway
      }
    };

    setupLanguage();
  }, []);

  // Only run auth routing after auth session is loaded
  const { isRoutingReady } = useAuthRouting(authLoading);

  useEffect(() => {
    // Only hide splash when all initialization is complete
    if (fontsLoaded && !authLoading && isRoutingReady && languageReady) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, authLoading, isRoutingReady, languageReady]);

  // Show splash screen while any loading is in progress
  if (!fontsLoaded || authLoading || !isRoutingReady || !languageReady) {
    return null;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="popular-channels" options={{ headerShown: false }} />
      <Stack.Screen name="wallet" options={{ headerShown: false }} />
      <Stack.Screen name="get-coins" options={{ headerShown: false }} />
      <Stack.Screen name="withdraw-money" options={{ headerShown: false }} />
      <Stack.Screen name="transactions" options={{ headerShown: false }} />
      <Stack.Screen name="unlock-level" options={{ headerShown: false }} />
      <Stack.Screen name="blocked-list" options={{ headerShown: false }} />
      <Stack.Screen name="notifications" options={{ headerShown: false }} />
      <Stack.Screen name="account" options={{ headerShown: false }} />
      <Stack.Screen name="language" options={{ headerShown: false }} />
      <Stack.Screen name="identity-verification" options={{ headerShown: false }} />
    </Stack>
  );
}

function RootLayout() {
  return (
    // KeyboardProvider tracks the keyboard natively on both platforms and must
    // sit above every screen, since KeyboardAwareScrollView reads from it.
    <KeyboardProvider>
      <SafeAreaProvider>
        <I18nextProvider i18n={i18n}>
          <StoreProvider>
            <NotificationProvider>
              <AppLayout />
            </NotificationProvider>
          </StoreProvider>
        </I18nextProvider>
      </SafeAreaProvider>
    </KeyboardProvider>
  );
}

export default Sentry.wrap(RootLayout);
