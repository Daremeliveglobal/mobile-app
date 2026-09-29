import { View } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import { useAppleAuthentication } from '../src/hooks/useAppleAuthentication';

type Props = {
  mode: 'signin' | 'signup';
};

/**
 * Apple's own Sign in with Apple button (Apple requires its standard design).
 * Renders nothing where Sign in with Apple isn't available, e.g. Android.
 */
export function AppleSignInButton({ mode }: Props) {
  const apple = useAppleAuthentication();
  if (!apple.isAvailable) return null;

  return (
    <View className="w-full mb-4" pointerEvents={apple.isLoading ? 'none' : 'auto'}>
      <AppleAuthentication.AppleAuthenticationButton
        buttonType={
          mode === 'signup'
            ? AppleAuthentication.AppleAuthenticationButtonType.SIGN_UP
            : AppleAuthentication.AppleAuthenticationButtonType.CONTINUE
        }
        buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
        cornerRadius={28}
        style={{ width: '100%', height: 56, opacity: apple.isLoading ? 0.6 : 1 }}
        onPress={() => { void apple.start(); }}
      />
    </View>
  );
}

export default AppleSignInButton;
