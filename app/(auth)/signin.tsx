import { SafeAreaView } from 'react-native-safe-area-context';
import { KeyboardAwareScreen } from '../../components/KeyboardAwareScreen';
import { getErrorMessage } from '../../src/utils/errorMessage';
import { BRAND_GRADIENT } from '@/constants/Gradients';
import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Image, Alert } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import EyeOffIcon from '../../assets/icons/eye-off.svg';
import EyeIcon from '../../assets/icons/eye.svg';
import { useSigninMutation } from '../../src/store/authApi';
import { useDispatch } from 'react-redux';
import { setCredentials } from '../../src/store/authSlice';
import { markAccountCreated } from '../../src/hooks/useAuthRouting';
import { useGoogleAuthentication } from '../../src/hooks/useGoogleAuthentication';
import { AppleSignInButton } from '../../components/AppleSignInButton';

export default function SigninScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');

  const dispatch = useDispatch();
  const [signin, { isLoading }] = useSigninMutation();
  const google = useGoogleAuthentication('signin');
  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleSignin = async () => {
    // Clear previous errors
    setEmailError('');
    setPasswordError('');
    // no-op (leftover)
    // Validate inputs
    if (!email.trim()) {
      setEmailError('Email is required');
      return;
    }

    if (!validateEmail(email)) {
      setEmailError('Please enter a valid email address');
      return;
    }

    if (!password) {
      setPasswordError('Password is required');
      return;
    }

    try {
      const result = await signin({
        email: email.trim().toLowerCase(),
        password,
      }).unwrap();

      // Store authentication data
      dispatch(setCredentials(result));

      // MARK ACCOUNT EXISTS - Successful signin means they have an account
      await markAccountCreated();

      // Check if profile completion is required
      if (!result.user.profile_completed) {
        router.replace('/(auth)/signup-two');
      } else {
        router.replace('/(tabs)/home');
      }
    } catch (error: any) {
      if (error.data?.email?.[0]) {
        setEmailError(error.data.email[0]);
      } else if (error.data?.password?.[0]) {
        setPasswordError(error.data.password[0]);
      } else if (error.data?.non_field_errors?.[0]) {
        Alert.alert('Error', error.data.non_field_errors[0]);
      } else if (error.status === 401) {
        Alert.alert('Error', 'Invalid email or password');
      } else {
        Alert.alert('Error', getErrorMessage(error));
      }
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-black">
      <StatusBar style="light" />
      <KeyboardAwareScreen
        className="flex-1"
        contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View className="flex-1 justify-center px-6 py-8">
          <Text className="text-white text-3xl font-bold mb-2">Welcome Back</Text>
          <Text className="text-gray-400 text-base mb-10">
            Log in to stream, connect, and engage with your audience in real time.
          </Text>

          <View className="mb-6">
            <Text className="text-white mb-2">Email</Text>
            <TextInput
              value={email}
              onChangeText={(text) => {
                setEmail(text);
                if (emailError) setEmailError('');
              }}
              placeholder="e.g joedoe@gmail.com"
              placeholderTextColor="#8A8A8E"
              className={`bg-[#1C1C1E] text-white rounded-full border px-5 w-full h-14 ${emailError ? 'border-red-500' : 'border-[#333333]'
                }`}
              keyboardType="email-address"
              autoCapitalize="none"
              editable={!isLoading}
            />
            {emailError ? (
              <Text className="text-red-500 text-sm mt-1 ml-4">{emailError}</Text>
            ) : null}
          </View>

          <View className="mb-4">
            <Text className="text-white mb-2">Password</Text>
            <View className="relative">
              <TextInput
                value={password}
                onChangeText={(text) => {
                  setPassword(text);
                  if (passwordError) setPasswordError('');
                }}
                placeholder="••••••••"
                placeholderTextColor="#8A8A8E"
                className={`bg-[#1C1C1E] text-white rounded-full border px-5 w-full h-14 ${passwordError ? 'border-red-500' : 'border-[#333333]'
                  }`}
                secureTextEntry={!passwordVisible}
                editable={!isLoading}
              />
              <TouchableOpacity
                onPress={() => setPasswordVisible(!passwordVisible)}
                className="absolute right-5 top-1/2 -translate-y-3"
                disabled={isLoading}
              >
                {passwordVisible ? (
                  <EyeIcon width={24} height={24} stroke="#8A8A8E" />
                ) : (
                  <EyeOffIcon width={24} height={24} stroke="#8A8A8E" />
                )}
              </TouchableOpacity>
            </View>
            {passwordError ? (
              <Text className="text-red-500 text-sm mt-1 ml-4">{passwordError}</Text>
            ) : null}
          </View>

          <TouchableOpacity
            className="self-end mb-8"
            onPress={() => router.push('/forgot-password')}
          >
            <Text className="text-[#C40000] font-semibold">Forgot Password?</Text>
          </TouchableOpacity>

          {/* <LinearGradient
          colors={BRAND_GRADIENT}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          className="w-full rounded-full mb-6"
        >
          <TouchableOpacity
            className="w-full h-14 items-center justify-center"
            onPress={() => router.replace('/(tabs)/home')}
          >
            <Text className="text-white text-lg font-semibold">Sign In</Text>
          </TouchableOpacity>
        </LinearGradient> */}

          <View className="w-full h-[52px] rounded-full overflow-hidden mb-6">
            <LinearGradient
              colors={isLoading ? ['#666666', '#333333'] : BRAND_GRADIENT}
              locations={[0, 1]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              className="w-full h-full"
            >
              <TouchableOpacity
                className="w-full h-full items-center justify-center"
                onPress={handleSignin}
                disabled={isLoading}
              >
                <Text className="text-white text-[17px] font-semibold">
                  {isLoading ? 'Signing In...' : 'Sign In'}
                </Text>
              </TouchableOpacity>
            </LinearGradient>
          </View>

          <View className="flex-row items-center my-4">
            <View className="flex-1 h-px bg-gray-600" />
            <Text className="text-gray-400 mx-4">or</Text>
            <View className="flex-1 h-px bg-gray-600" />
          </View>

          <AppleSignInButton mode="signin" />

          {google.isConfigured && (
          <TouchableOpacity
            className="w-full h-14 bg-[#1C1C1E] border border-[#333333] rounded-full flex-row items-center justify-center mb-8"
            onPress={async () => {
              setTimeout(() => {
                void google.start();
              }, 100);
            }}
            disabled={google.isLoading || !google.isReady}
          >
            <Image source={require('../../assets/icons/google.png')} className="w-6 h-6 mr-3" />
            <Text className="text-white text-lg font-semibold">{google.isLoading ? 'Signing in...' : 'Continue with Google'}</Text>
          </TouchableOpacity>
          )}

          <View className="flex-row justify-center">
            <Text className="text-gray-400">Don’t have an account? </Text>
            <TouchableOpacity onPress={() => router.push('/signup')}>
              <Text className="text-[#C40000] font-semibold">Sign Up</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAwareScreen>
    </SafeAreaView>
  );
}
