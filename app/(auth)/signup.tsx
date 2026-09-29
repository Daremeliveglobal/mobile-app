import { SafeAreaView } from 'react-native-safe-area-context';
import { KeyboardAwareScreen } from '../../components/KeyboardAwareScreen';
import { getErrorMessage, getFieldErrors } from '../../src/utils/errorMessage';
import { BRAND_GRADIENT } from '@/constants/Gradients';
import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Image, Alert } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSignupMutation } from '../../src/store/authApi';
import { useDispatch } from 'react-redux';
import { setPendingEmail, setError } from '../../src/store/authSlice';
import { useGoogleAuthentication } from '../../src/hooks/useGoogleAuthentication';
import { AppleSignInButton } from '../../components/AppleSignInButton';

export default function SignupScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');

  const dispatch = useDispatch();
  const [signup, { isLoading }] = useSignupMutation();
  const google = useGoogleAuthentication('signup');

  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const validatePassword = (password: string) => {
    return password.length >= 8;
  };

  const handleSignup = async () => {
    // Clear previous errors
    setEmailError('');
    setPasswordError('');
    dispatch(setError(null));

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

    if (!validatePassword(password)) {
      setPasswordError('Password must be at least 8 characters');
      return;
    }

    if (password !== confirmPassword) {
      setPasswordError('Passwords do not match');
      return;
    }

    try {
      const result = await signup({
        email: email.trim().toLowerCase(),
        password,
        confirm_password: confirmPassword,
      }).unwrap();

      // Store email for OTP verification
      dispatch(setPendingEmail(email.trim().toLowerCase()));

      // Navigate to verification screen
      router.push('/verify');
    } catch (error: any) {
      // Field problems are shown under the input they belong to; anything else
      // gets one plain sentence explaining what happened.
      const fields = getFieldErrors(error);
      if (fields.email) setEmailError(fields.email);
      if (fields.password || fields.confirm_password) {
        setPasswordError(fields.password ?? fields.confirm_password);
      }
      if (!fields.email && !fields.password && !fields.confirm_password) {
        Alert.alert('Error', getErrorMessage(error));
      }
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-[#090909]">
      <StatusBar style="light" />
      <KeyboardAwareScreen
        className="flex-1"
        contentContainerStyle={{ flexGrow: 1 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View className="flex-1 px-6 pt-16 pb-8">
          {/* Header */}
          <View className="mb-12">
            <Text className="text-white text-2xl font-bold mb-3">
              Create your Account
            </Text>
            <Text className="text-gray-400 text-base leading-6">
              Unlock live streaming, virtual gifts, and real-time interactions with just a few steps.
            </Text>
          </View>

        {/* Form */}
        <View className="space-y-6">
          {/* Email Field */}
          <View className="mb-6">
            <Text className="text-white text-sm mb-2">Email</Text>
            <TextInput
              value={email}
              onChangeText={(text) => {
                setEmail(text);
                if (emailError) setEmailError('');
              }}
              placeholder="e.g joedoe@gmail.com"
              placeholderTextColor="#6B7280"
              className={`bg-[#1C1C1E] text-white px-4 py-4 rounded-full border ${
                emailError ? 'border-red-500' : 'border-[#2C2C2E]'
              }`}
              keyboardType="email-address"
              autoCapitalize="none"
              editable={!isLoading}
            />
            {emailError ? (
              <Text className="text-red-500 text-sm mt-1 ml-4">{emailError}</Text>
            ) : null}
          </View>

          {/* Password Field */}
          <View className="mb-6">
            <Text className="text-white text-sm mb-2">Password</Text>
            <View className="relative">
              <TextInput
                value={password}
                onChangeText={(text) => {
                  setPassword(text);
                  if (passwordError) setPasswordError('');
                }}
                placeholder="••••••••"
                placeholderTextColor="#6B7280"
                className={`bg-[#1C1C1E] text-white px-4 py-4 rounded-full border pr-12 ${
                  passwordError ? 'border-red-500' : 'border-[#2C2C2E]'
                }`}
                secureTextEntry={!showPassword}
                editable={!isLoading}
              />
              <TouchableOpacity
                onPress={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-4"
                disabled={isLoading}
              >
                <Ionicons
                  name={showPassword ? "eye-off" : "eye"}
                  size={20}
                  color="#6B7280"
                />
              </TouchableOpacity>
            </View>
            {passwordError ? (
              <Text className="text-red-500 text-sm mt-1 ml-4">{passwordError}</Text>
            ) : null}
          </View>

          {/* Confirm Password Field */}
          <View className="mb-6">
            <Text className="text-white text-sm mb-2">Confirm Password</Text>
            <View className="relative">
              <TextInput
                value={confirmPassword}
                onChangeText={(text) => {
                  setConfirmPassword(text);
                  if (passwordError) setPasswordError('');
                }}
                placeholder="••••••••"
                placeholderTextColor="#6B7280"
                className={`bg-[#1C1C1E] text-white px-4 py-4 rounded-full border pr-12 ${
                  passwordError ? 'border-red-500' : 'border-[#2C2C2E]'
                }`}
                secureTextEntry={!showConfirmPassword}
                editable={!isLoading}
              />
              <TouchableOpacity
                onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-4 top-4"
                disabled={isLoading}
              >
                <Ionicons
                  name={showConfirmPassword ? "eye-off" : "eye"}
                  size={20}
                  color="#6B7280"
                />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Terms & Conditions */}
        <View className=" mb-10">
          <Text className="text-gray-400 text-sm">
            By signing up, you agree to our{' '}
            <Text className="text-red-500">Terms & Conditions</Text> and{' '}
            <Text className="text-red-500">Privacy Policy</Text>
          </Text>
        </View>

        {/* Sign Up Button */}
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
              onPress={handleSignup}
              disabled={isLoading}
            >
              <Text className="text-white text-[17px] font-semibold">
                {isLoading ? 'Creating Account...' : 'Sign Up'}
              </Text>
            </TouchableOpacity>
          </LinearGradient>
        </View>

        {/* Or Divider */}
        <View className="flex-row items-center mb-6">
          <View className="flex-1 h-[1px] bg-[#2C2C2E]" />
          <Text className="text-gray-400 px-4">or</Text>
          <View className="flex-1 h-[1px] bg-[#2C2C2E]" />
        </View>

        {/* Google Continue Button */}
        <AppleSignInButton mode="signup" />

        {google.isConfigured && (
        <TouchableOpacity
          className="w-full h-[52px] bg-[#1C1C1E] border border-[#2C2C2E] rounded-full flex-row items-center justify-center mb-8"
          onPress={async () => {
            setTimeout(() => {
              void google.start();
            }, 100);
          }}
          disabled={google.isLoading || !google.isReady}
        >
          <Image
            source={require('../../assets/icons/google.png')}
            className="w-8 h-8 mr-3"
          />
          <Text className="text-white text-[17px] font-medium ml-3">{google.isLoading ? 'Signing in...' : 'Continue with Google'}</Text>
        </TouchableOpacity>
        )}

        {/* Sign In Link */}
        <View className="flex-row justify-center mt-8 mb-8">
          <Text className="text-gray-400 text-base">
            Already have an account?{' '}
          </Text>
          <TouchableOpacity onPress={() => router.push('/(auth)/signin')}>
            <Text className="text-red-500 text-base font-medium">Sign In</Text>
          </TouchableOpacity>
        </View>
      </View>
      </KeyboardAwareScreen>
    </SafeAreaView>
  );
}
