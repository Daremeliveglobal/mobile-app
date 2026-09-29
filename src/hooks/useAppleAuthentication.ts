import { useEffect, useState } from 'react';
import { Alert, Platform } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import { router } from 'expo-router';
import { useDispatch } from 'react-redux';
import { useAppleAuthMutation } from '../store/authApi';
import { setCredentials } from '../store/authSlice';
import { API_BASE_URL } from '../config/env';
import { markAccountCreated } from './useAuthRouting';
import { logger } from '../utils/logger';

/**
 * Sign in with Apple (iOS only). App Store Review Guideline 4.8 requires it
 * because the app also offers Google sign-in. The server verifies Apple's
 * identity token and signs the user in exactly like the Google flow.
 */
export const useAppleAuthentication = () => {
  const dispatch = useDispatch();
  const [authenticate, { isLoading }] = useAppleAuthMutation();
  const [isAvailable, setIsAvailable] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    AppleAuthentication.isAvailableAsync()
      .then(setIsAvailable)
      .catch(() => setIsAvailable(false));
  }, []);

  const start = async () => {
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
      if (!credential.identityToken) {
        throw new Error('Apple did not return an identity token');
      }

      const result = await authenticate({
        identity_token: credential.identityToken,
        first_name: credential.fullName?.givenName ?? undefined,
        last_name: credential.fullName?.familyName ?? undefined,
      }).unwrap();
      dispatch(setCredentials(result));
      await markAccountCreated();
      router.replace(result.user.profile_completed ? '/(tabs)/home' : '/(auth)/signup-two');
    } catch (cause: any) {
      if (cause?.code === 'ERR_REQUEST_CANCELED') return;
      logger.error('Apple sign-in failed', cause);
      let message = cause?.data?.message
        || cause?.data?.error
        || cause?.data?.detail
        || 'Apple sign-in failed';
      if (cause?.status === 'TIMEOUT_ERROR' || cause?.name === 'AbortError') {
        message = 'The connection timed out. Check your network and try again.';
      } else if (cause?.status === 'FETCH_ERROR') {
        message = `The server at ${API_BASE_URL} could not be reached.`;
      }
      Alert.alert('Sign in with Apple', message);
    }
  };

  return { isAvailable, isLoading, start };
};

export default useAppleAuthentication;
