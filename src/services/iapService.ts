/**
 * Apple In-App Purchase Service
 *
 * This service handles all Apple IAP operations for purchasing Riz coins.
 * It integrates with StoreKit via expo-in-app-purchases.
 */

import * as InAppPurchases from 'expo-in-app-purchases';
import { Platform } from 'react-native';
import { API_BASE_URL } from '../config/env';
import { logger } from '../utils/logger';
import { authenticatedFetch } from '../api/authenticatedFetch';

// IAP Product IDs - These must match the products in App Store Connect
export const IAP_PRODUCT_IDS = {
  RIZ_100: 'com.mobile.daremelive.riz.100',
  RIZ_500: 'com.mobile.daremelive.riz.500',
  RIZ_1000: 'com.mobile.daremelive.riz.1000',
  RIZ_2000: 'com.mobile.daremelive.riz.2000',
  RIZ_5000: 'com.mobile.daremelive.riz.5000',
  RIZ_10000: 'com.mobile.daremelive.riz.10000',
};

// All product IDs as array for fetching
export const ALL_PRODUCT_IDS = Object.values(IAP_PRODUCT_IDS);

// Types
export interface IAPProduct {
  productId: string;
  title: string;
  description: string;
  price: string;
  priceAmountMicros: number;
  priceCurrencyCode: string;
  rizAmount: number;
}

export interface IAPPurchaseResult {
  success: boolean;
  transactionId?: string;
  productId?: string;
  rizAmount?: number;
  error?: string;
}

export interface IAPReceiptValidationResponse {
  success: boolean;
  message: string;
  coins_added?: number;
  new_balance?: number;
  transaction_id?: string;
}

// Map product IDs to Riz amounts
const PRODUCT_RIZ_AMOUNTS: Record<string, number> = {
  [IAP_PRODUCT_IDS.RIZ_100]: 100,
  [IAP_PRODUCT_IDS.RIZ_500]: 500,
  [IAP_PRODUCT_IDS.RIZ_1000]: 1000,
  [IAP_PRODUCT_IDS.RIZ_2000]: 2000,
  [IAP_PRODUCT_IDS.RIZ_5000]: 5000,
  [IAP_PRODUCT_IDS.RIZ_10000]: 10000,
};

class IAPService {
  private isInitialized = false;
  private products: IAPProduct[] = [];
  private onCredited: (() => void) | null = null;
  private pendingPurchase: {
    productId: string;
    resolve: (result: IAPPurchaseResult) => void;
    timeoutId: ReturnType<typeof setTimeout>;
  } | null = null;

  private resolvePendingPurchase(result: IAPPurchaseResult): void {
    if (!this.pendingPurchase) return;
    clearTimeout(this.pendingPurchase.timeoutId);
    const { resolve } = this.pendingPurchase;
    this.pendingPurchase = null;
    resolve(result);
  }

  /**
   * Initialize the IAP service
   * Must be called before any other IAP operations
   */
  async initialize(): Promise<boolean> {
    if (this.isInitialized) {
      return true;
    }

    // Only initialize on iOS
    if (Platform.OS !== 'ios') {
      return false;
    }

    try {

      // Connect to the App Store
      await InAppPurchases.connectAsync();

      // Set up purchase listener
      InAppPurchases.setPurchaseListener(this.handlePurchaseUpdate.bind(this));

      this.isInitialized = true;

      // Fetch products
      await this.fetchProducts();

      return true;
    } catch (error) {
      logger.error('Failed to initialize IAP Service:', error);
      return false;
    }
  }

  /**
   * Called whenever the server credits Riz for a purchase, including ones
   * StoreKit redelivers at launch after an interrupted purchase.
   */
  setOnCredited(callback: (() => void) | null): void {
    this.onCredited = callback;
  }

  /**
   * Disconnect from the App Store
   * Call this when the app is closing or IAP is no longer needed
   */
  async disconnect(): Promise<void> {
    if (!this.isInitialized) return;

    try {
      await InAppPurchases.disconnectAsync();
      this.isInitialized = false;
    } catch (error) {
      logger.error('Failed to disconnect IAP Service:', error);
    }
  }

  /**
   * Fetch available products from the App Store
   */
  async fetchProducts(): Promise<IAPProduct[]> {
    if (!this.isInitialized) {
      return [];
    }

    try {

      const { results, responseCode } = await InAppPurchases.getProductsAsync(ALL_PRODUCT_IDS);

      if (responseCode === InAppPurchases.IAPResponseCode.OK && results) {
        this.products = results.map((product) => ({
          productId: product.productId,
          title: product.title,
          description: product.description,
          price: product.price,
          priceAmountMicros: product.priceAmountMicros,
          priceCurrencyCode: product.priceCurrencyCode,
          rizAmount: PRODUCT_RIZ_AMOUNTS[product.productId] || 0,
        }));

        return this.products;
      } else {
        return [];
      }
    } catch (error) {
      logger.error('Error fetching IAP products:', error);
      return [];
    }
  }

  /**
   * Get cached products
   */
  getProducts(): IAPProduct[] {
    return this.products;
  }

  /**
   * Purchase a product
   */
  async purchaseProduct(productId: string): Promise<IAPPurchaseResult> {
    if (!this.isInitialized) {
      return { success: false, error: 'IAP Service not initialized' };
    }

    if (Platform.OS !== 'ios') {
      return { success: false, error: 'IAP only available on iOS' };
    }

    if (!PRODUCT_RIZ_AMOUNTS[productId]) {
      return { success: false, error: 'Unknown purchase product' };
    }

    if (this.pendingPurchase) {
      return { success: false, error: 'Another purchase is already in progress' };
    }


    return new Promise<IAPPurchaseResult>((resolve) => {
      const timeoutId = setTimeout(() => {
        this.resolvePendingPurchase({
          success: false,
          productId,
          error: 'Purchase confirmation timed out. Check your wallet before retrying.',
        });
      }, 120_000);

      this.pendingPurchase = { productId, resolve, timeoutId };

      InAppPurchases.purchaseItemAsync(productId).catch((error: unknown) => {
        logger.error('Purchase error:', error);
        const purchaseError = error as { code?: string; message?: string };
        this.resolvePendingPurchase({
          success: false,
          productId,
          error: purchaseError.code === 'E_USER_CANCELLED'
            ? 'Purchase cancelled'
            : purchaseError.message || 'Purchase failed',
        });
      });
    });
  }

  /**
   * Handle purchase updates from the App Store
   */
  private async handlePurchaseUpdate(queryResponse: InAppPurchases.IAPQueryResponse<InAppPurchases.InAppPurchase>): Promise<void> {

    const { responseCode, results } = queryResponse;

    if (responseCode === InAppPurchases.IAPResponseCode.OK && results) {
      for (const purchase of results) {
        if (!purchase.acknowledged) {

          // Validate the receipt with our backend
          const validation = await this.validateReceipt(purchase);

          if (validation.success) {
            // Finish the transaction
            await InAppPurchases.finishTransactionAsync(purchase, true);
            this.onCredited?.();
            if (this.pendingPurchase?.productId === purchase.productId) {
              this.resolvePendingPurchase({
                success: true,
                transactionId: purchase.orderId,
                productId: purchase.productId,
                rizAmount: PRODUCT_RIZ_AMOUNTS[purchase.productId],
              });
            }
          } else {
            logger.error('Receipt validation failed:', validation.message);
            // Do not finish a paid transaction that the server has not
            // validated. StoreKit can redeliver it after a transient outage.
            if (this.pendingPurchase?.productId === purchase.productId) {
              this.resolvePendingPurchase({
                success: false,
                transactionId: purchase.orderId,
                productId: purchase.productId,
                error: validation.message,
              });
            }
          }
        }
      }
    } else if (responseCode === InAppPurchases.IAPResponseCode.USER_CANCELED) {
      this.resolvePendingPurchase({ success: false, error: 'Purchase cancelled' });
    } else if (responseCode === InAppPurchases.IAPResponseCode.DEFERRED) {
      this.resolvePendingPurchase({
        success: false,
        error: 'Purchase is awaiting approval. Your wallet will update after approval.',
      });
    } else {
      logger.error('Purchase failed with code:', responseCode);
      this.resolvePendingPurchase({ success: false, error: 'The App Store could not complete this purchase' });
    }
  }

  /**
   * Validate the receipt with our backend server
   * This is CRITICAL for security - never trust the client alone!
   */
  private async validateReceipt(purchase: InAppPurchases.InAppPurchase): Promise<IAPReceiptValidationResponse> {
    try {
      const response = await authenticatedFetch(`${API_BASE_URL}wallet/validate-apple-receipt/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          receipt_data: purchase.transactionReceipt,
          product_id: purchase.productId,
          transaction_id: purchase.orderId, // orderId is the transaction identifier
        }),
      });

      const data = await response.json();

      if (response.ok) {
        return {
          success: true,
          message: data.message || 'Receipt validated successfully',
          coins_added: data.coins_added,
          new_balance: data.new_balance,
          transaction_id: data.transaction_id,
        };
      } else {
        return {
          success: false,
          message: data.message || data.detail || 'Receipt validation failed',
        };
      }
    } catch (error: any) {
      logger.error('Receipt validation error:', error);
      return {
        success: false,
        message: error.message || 'Network error during validation',
      };
    }
  }

  /**
   * Restore previous purchases
   * Useful for when users reinstall the app or get a new device
   */
  async restorePurchases(): Promise<boolean> {
    if (!this.isInitialized) {
      return false;
    }

    try {

      const { results, responseCode } = await InAppPurchases.getPurchaseHistoryAsync();

      if (responseCode === InAppPurchases.IAPResponseCode.OK && results) {

        // Re-validate each purchase with our backend
        for (const purchase of results) {
          await this.validateReceipt(purchase);
        }

        return true;
      }

      return false;
    } catch (error) {
      logger.error('Error restoring purchases:', error);
      return false;
    }
  }

  /**
   * Check if IAP is available on this device
   */
  isAvailable(): boolean {
    return Platform.OS === 'ios' && this.isInitialized;
  }

  /**
   * Get Riz amount for a product ID
   */
  getRizAmount(productId: string): number {
    return PRODUCT_RIZ_AMOUNTS[productId] || 0;
  }
}

// Export a singleton instance
export const iapService = new IAPService();

// Export default for convenience
export default iapService;
