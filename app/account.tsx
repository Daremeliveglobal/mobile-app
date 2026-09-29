import { SafeAreaView } from 'react-native-safe-area-context';
import { getErrorMessage } from '../src/utils/errorMessage';
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, SectionList, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import ArrowLeftIcon from '../assets/icons/arrow-left.svg';
import ChevronRightIcon from '../assets/icons/chevron-down.svg';
import BlockedIcon from '../assets/icons/blocked.svg';
import WalletIcon from '../assets/icons/wallet.svg';
import DeactivateAccountConfirmationModal from '../components/modals/DeactivateAccountConfirmationModal';
import HelpUsImproveModal from '../components/modals/HelpUsImproveModal';
import ChangePasswordConfirmationModal from '../components/modals/ChangePasswordConfirmationModal';
import { useGetProfileQuery, useDeactivateAccountMutation, useDeleteAccountMutation } from '../src/store/authApi';
import { useSelector, useDispatch } from 'react-redux';
import { selectCurrentUser, logout } from '../src/store/authSlice';
import { logger } from '../src/utils/logger';

type ListItem = {
  key: string;
  label: string;
  value: string;
  route?: string;
  icon?: React.FC<{ width: number; height: number; className?: string }>;
};

const AccountScreen = () => {
  const router = useRouter();
  const dispatch = useDispatch();
  const [isDeactivateModalVisible, setDeactivateModalVisible] = useState(false);
  const [isHelpModalVisible, setHelpModalVisible] = useState(false);
  const [isPasswordModalVisible, setPasswordModalVisible] = useState(false);
  const currentUser = useSelector(selectCurrentUser);
  const { data: profileData } = useGetProfileQuery();
  const [deactivateAccount, { isLoading: isDeactivating }] = useDeactivateAccountMutation();
  const [deleteAccount, { isLoading: isDeleting }] = useDeleteAccountMutation();

  const getSections = (): { title: string; data: ListItem[] }[] => {
    const user = profileData || currentUser;

    return [
      {
        title: 'Personal Information',
        data: [
          {
            key: '1',
            label: 'Full Name',
            value: user ? `${user.first_name} ${user.last_name}` : 'Loading...',
            route: '/edit-name'
          },
          {
            key: '2',
            label: 'Username',
            value: user?.username || 'Loading...',
            route: '/edit-username'
          },
          {
            key: '3',
            label: 'Phone',
            value: user?.phone_number || 'Not set',
            route: '/edit-phone'
          },
          {
            key: '4',
            label: 'Country',
            value: user?.country || 'Not set',
            route: '/edit-country'
          },
        ],
      },
      {
        title: 'Privacy',
        data: [
          { key: '6', label: 'Password', value: '**********', route: '/forgot-password' },
        ],
      },
    ];
  };

  const handleDeactivate = () => {
    setDeactivateModalVisible(true);
  };

  const handleConfirmDeactivation = () => {
    setDeactivateModalVisible(false);
    setHelpModalVisible(true);
  };

  const handleContinueFromHelp = async (feedback?: string) => {
    try {
      await deactivateAccount({ reason: feedback }).unwrap();

      // Clear user session and redirect to signin
      dispatch(logout());
      setHelpModalVisible(false);
      router.replace('/(auth)/signin');
    } catch (error: any) {
      logger.error('Deactivation error:', error);
      Alert.alert('Error', getErrorMessage(error));
    }
  };

  // Permanent deletion (App Store Review Guideline 5.1.1(v)); unlike
  // deactivation it erases the account's personal data.
  const performDelete = async () => {
    try {
      await deleteAccount({ confirm: 'DELETE' }).unwrap();
      dispatch(logout());
      router.replace('/(auth)/signin');
      Alert.alert('Account deleted', 'Your account and personal data have been deleted.');
    } catch (error: any) {
      logger.error('Account deletion error:', error);
      Alert.alert('Error', getErrorMessage(error));
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete your account?',
      'This permanently deletes your profile, photos, followers and personal details. '
        + 'Any Riz or earnings left in your wallet will be lost. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Account',
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              'Are you sure?',
              'Your account will be deleted immediately.',
              [
                { text: 'Keep Account', style: 'cancel' },
                { text: 'Delete Permanently', style: 'destructive', onPress: () => { void performDelete(); } },
              ],
            );
          },
        },
      ],
    );
  };

  const handlePasswordChange = () => {
    setPasswordModalVisible(false);
    router.push('/forgot-password');
  };

  return (
    <SafeAreaView className="flex-1 bg-[#090909]">
      <StatusBar style="light" />
      <View className="flex-row items-center relative px-4 pt-3 pb-3 mb-6">
        <TouchableOpacity onPress={() => router.back()} className="absolute left-4 z-10">
          <View className="w-14 h-14 bg-[#1A1A1A] rounded-full justify-center items-center">
            <ArrowLeftIcon width={24} height={24}/>
          </View>
        </TouchableOpacity>
        <View className="flex-1 items-center">
          <Text className="text-white text-[20px] font-semibold">Account</Text>
        </View>
      </View>

      <SectionList
        sections={getSections()}
        keyExtractor={(item) => item.key}
        renderItem={({ item }) => (
          <TouchableOpacity
            className="flex-row items-center justify-between px-4 py-4 bg-[#1A1A1A] border-b border-[#333]"
            onPress={() => {
              if (item.route) {
                if (item.label === 'Password') {
                  setPasswordModalVisible(true);
                } else if (item.label === 'Wallet') {
                  router.push('/wallet');
                } else {
                  router.push(item.route as any);
                }
              }
            }}
            disabled={!item.route}
          >
            <Text className="text-white text-base">{item.label}</Text>
            <View className="flex-row items-center">
              {item.icon && <item.icon width={24} height={24} className="mr-2" />}
              <Text className="text-[#666] text-base mr-2">{item.value}</Text>
              <ChevronRightIcon width={24} height={24} fill="#666" style={{ transform: [{ rotate: '-90deg' }]}} />
            </View>
          </TouchableOpacity>
        )}
        renderSectionHeader={({ section: { title } }) => (
          <Text className="text-[#666] text-sm font-semibold px-4 py-2 mt-4">{title}</Text>
        )}
        ListFooterComponent={
            <View className="rounded-md mt-8">
                <TouchableOpacity className="flex-row items-center bg-[#1A1A1A] p-4 rounded-lg" onPress={handleDeactivate}>
                    <View className="w-8 h-8 p-6 rounded-full justify-center items-center mr-4 bg-[#2A2A2A]">
                        <BlockedIcon width={20} height={20} />
                    </View>
                    <Text className="text-[#666] text-base ml-3 flex-1">Deactivate Account</Text>
                    <ChevronRightIcon width={24} height={24} style={{ transform: [{ rotate: '-90deg' }]}} />
                </TouchableOpacity>
                <TouchableOpacity
                    className="flex-row items-center bg-[#1A1A1A] p-4 rounded-lg mt-3"
                    onPress={handleDelete}
                    disabled={isDeleting}
                >
                    <View className="w-8 h-8 p-6 rounded-full justify-center items-center mr-4 bg-[#2A2A2A]">
                        <BlockedIcon width={20} height={20} />
                    </View>
                    <Text className="text-[#FF3B30] text-base ml-3 flex-1">
                        {isDeleting ? 'Deleting…' : 'Delete Account'}
                    </Text>
                    <ChevronRightIcon width={24} height={24} style={{ transform: [{ rotate: '-90deg' }]}} />
                </TouchableOpacity>
            </View>
        }
        contentContainerStyle={{ marginHorizontal: 10 }}
      />
      <DeactivateAccountConfirmationModal
        visible={isDeactivateModalVisible}
        onClose={() => setDeactivateModalVisible(false)}
        onConfirm={handleConfirmDeactivation}
      />
      <HelpUsImproveModal
        visible={isHelpModalVisible}
        onClose={() => setHelpModalVisible(false)}
        onContinue={handleContinueFromHelp}
        isLoading={isDeactivating}
      />
      <ChangePasswordConfirmationModal
        visible={isPasswordModalVisible}
        onClose={() => setPasswordModalVisible(false)}
        onConfirm={handlePasswordChange}
      />
    </SafeAreaView>
  );
};

export default AccountScreen;
