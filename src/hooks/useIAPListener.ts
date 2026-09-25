/**
 * Keeps the App Store purchase listener running for the whole session.
 *
 * StoreKit redelivers any purchase that was paid for but not yet confirmed
 * by our server (app closed, network dropped) as soon as a listener is
 * registered. Registering at launch, rather than only on the Get Coins
 * screen, means those buyers get their Riz without having to go back there.
 */

import { useEffect } from 'react';
import { Platform } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { iapService } from '../services/iapService';
import { walletApi } from '../api/walletApi';
import { selectIsAuthenticated } from '../store/authSlice';

export const useIAPListener = () => {
  const isAuthenticated = useSelector(selectIsAuthenticated);
  const dispatch = useDispatch();

  useEffect(() => {
    // Receipts are validated against the signed-in account, so wait for login.
    if (Platform.OS !== 'ios' || !isAuthenticated) return;

    iapService.setOnCredited(() => {
      dispatch(walletApi.util.invalidateTags(['Wallet', 'Transactions']));
    });
    iapService.initialize();
  }, [isAuthenticated, dispatch]);
};

export default useIAPListener;
