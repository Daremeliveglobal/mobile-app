/**
 * Apple In-App Purchase Service
 *
 * Handles all Apple IAP operations for purchasing Riz coins, using StoreKit 2
 * through expo-iap. Every purchase is confirmed by our server (which checks
 * Apple's signature on the transaction) before it is finished, so a purchase
 * interrupted before that point is redelivered by StoreKit on next launch.
 */

import { Platform } from 'react-native';
import type * as ExpoIapModule from 'expo-iap';
import type { Purchase, PurchaseError } from 'expo-iap';
import { API_BASE_URL } from '../config/env';
import { logger } from '../utils/logger';
import { authenticatedFetch } from '../api/authenticatedFetch';

// expo-iap loads its native module as soon as it is imported, and it is only
// linked on iOS (see "autolinking" in package.json), so never import it on
// Android.
const ExpoIap: typeof ExpoIapModule | null =
  Platform.OS === 'ios' ? require('expo-iap') : null;

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
  private subscriptions: { remove: () => void }[] = [];
  // Transactions currently being confirmed with the server; StoreKit can
  // deliver the same one through the purchase call and the updates stream.
  private validating = new Set<string>();
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
    if (!ExpoIap) {
      return false;
    }

    try {
      // Listen before connecting: StoreKit replays unfinished transactions
      // as soon as the connection starts.
      this.subscriptions = [
        ExpoIap.purchaseUpdatedListener((purchase) => {
          void this.handlePurchase(purchase);
        }),
        ExpoIap.purchaseErrorListener((error) => this.handlePurchaseError(error)),
      ];

      await ExpoIap.initConnection();

      this.isInitialized = true;

      // Fetch products
      await this.fetchProducts();

      return true;
    } catch (error) {
      logger.error('Failed to initialize IAP Service:', error);
      this.subscriptions.forEach((subscription) => subscription.remove());
      this.subscriptions = [];
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
    if (!this.isInitialized || !ExpoIap) return;

    try {
      this.subscriptions.forEach((subscription) => subscription.remove());
      this.subscriptions = [];
      await ExpoIap.endConnection();
      this.isInitialized = false;
    } catch (error) {
      logger.error('Failed to disconnect IAP Service:', error);
    }
  }

  /**
   * Fetch available products from the App Store
   */
  async fetchProducts(): Promise<IAPProduct[]> {
    if (!this.isInitialized || !ExpoIap) {
      return [];
    }

    try {
      const results = await ExpoIap.requestProducts({ skus: ALL_PRODUCT_IDS, type: 'inapp' });

      this.products = results
        .map((product) => ({
          productId: product.id,
          title: product.title,
          description: product.description,
          price: product.displayPrice,
          priceCurrencyCode: product.currency,
          rizAmount: PRODUCT_RIZ_AMOUNTS[product.id] || 0,
        }))
        .sort((a, b) => a.rizAmount - b.rizAmount);

      return this.products;
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
   * The tag Apple attaches to this account's purchases (appAccountToken).
   * Lets the server refuse a purchase claimed from a different account.
   */
  private async getAppAccountToken(): Promise<string | undefined> {
    try {
      const response = await authenticatedFetch(`${API_BASE_URL}wallet/`);
      if (!response.ok) return undefined;
      const data = await response.json();
      return typeof data.app_account_token === 'string' ? data.app_account_token : undefined;
    } catch (error) {
      logger.error('Could not load App Store account tag:', error);
      return undefined;
    }
  }

  /**
   * Purchase a product
   */
  async purchaseProduct(productId: string): Promise<IAPPurchaseResult> {
    if (!this.isInitialized || !ExpoIap) {
      return { success: false, error: 'IAP Service not initialized' };
    }

    if (!PRODUCT_RIZ_AMOUNTS[productId]) {
      return { success: false, error: 'Unknown purchase product' };
    }

    if (this.pendingPurchase) {
      return { success: false, error: 'Another purchase is already in progress' };
    }

    const appAccountToken = await this.getAppAccountToken();
    const iap = ExpoIap;

    return new Promise<IAPPurchaseResult>((resolve) => {
      const timeoutId = setTimeout(() => {
        this.resolvePendingPurchase({
          success: false,
          productId,
          error: 'Purchase confirmation timed out. Check your wallet before retrying.',
        });
      }, 120_000);

      this.pendingPurchase = { productId, resolve, timeoutId };

      // The result arrives through purchaseUpdatedListener / purchaseErrorListener.
      iap.requestPurchase({
        request: { ios: { sku: productId, appAccountToken } },
        type: 'inapp',
      }).catch((error: unknown) => {
        this.handlePurchaseError(error as PurchaseError);
      });
    });
  }

  private handlePurchaseError(error: PurchaseError | undefined): void {
    const code = error?.code;
    if (code === 'E_USER_CANCELLED') {
      this.resolvePendingPurchase({ success: false, error: 'Purchase cancelled' });
    } else if (code === 'E_DEFERRED_PAYMENT' || code === 'E_PENDING') {
      this.resolvePendingPurchase({
        success: false,
        error: 'Purchase is awaiting approval. Your wallet will update after approval.',
      });
    } else {
      logger.error('Purchase failed:', error);
      this.resolvePendingPurchase({
        success: false,
        error: error?.message || 'The App Store could not complete this purchase',
      });
    }
  }

  /**
   * Handle a purchase delivered by StoreKit, either from a purchase the user
   * just made or an unfinished one redelivered at launch.
   */
  private async handlePurchase(purchase: Purchase): Promise<void> {
    if (!ExpoIap) return;
    const transactionId = purchase.id;
    if (this.validating.has(transactionId)) return;
    this.validating.add(transactionId);

    try {
      const validation = await this.validatePurchase(purchase);

      if (validation.success) {
        await ExpoIap.finishTransaction({ purchase, isConsumable: true });
        this.onCredited?.();
        if (this.pendingPurchase?.productId === purchase.productId) {
          this.resolvePendingPurchase({
            success: true,
            transactionId,
            productId: purchase.productId,
            rizAmount: PRODUCT_RIZ_AMOUNTS[purchase.productId],
          });
        }
      } else {
        logger.error('Purchase validation failed:', validation.message);
        // Do not finish a paid transaction that the server has not
        // validated. StoreKit redelivers it after a transient outage.
        if (this.pendingPurchase?.productId === purchase.productId) {
          this.resolvePendingPurchase({
            success: false,
            transactionId,
            productId: purchase.productId,
            error: validation.message,
          });
        }
      }
    } finally {
      this.validating.delete(transactionId);
    }
  }

  private async postValidation(body: Record<string, string>): Promise<Response> {
    return authenticatedFetch(`${API_BASE_URL}wallet/validate-apple-receipt/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
  }

  /**
   * Have our server confirm the purchase with Apple and credit the Riz.
   * This is CRITICAL for security - never trust the client alone!
   */
  private async validatePurchase(purchase: Purchase): Promise<IAPReceiptValidationResponse> {
    try {
      const signedTransaction = purchase.purchaseToken;
      if (!signedTransaction) {
        return { success: false, message: 'The App Store did not return a signed transaction' };
      }

      let response = await this.postValidation({
        signed_transaction: signedTransaction,
        product_id: purchase.productId,
        transaction_id: purchase.id,
      });
      let data = await response.json();

      // Servers from before StoreKit 2 support only understand the app
      // receipt. Remove once the server with signed_transaction is live.
      if (
        response.status === 400
        && typeof data.message === 'string'
        && data.message.startsWith('Missing required fields')
        && ExpoIap
      ) {
        const receipt = await ExpoIap.getReceiptIOS();
        response = await this.postValidation({
          receipt_data: receipt,
          product_id: purchase.productId,
          transaction_id: purchase.id,
        });
        data = await response.json();
      }

      if (response.ok) {
        return {
          success: true,
          message: data.message || 'Purchase validated successfully',
          coins_added: data.coins_added,
          new_balance: data.new_balance,
          transaction_id: data.transaction_id,
        };
      }
      return {
        success: false,
        message: data.message || data.detail || 'Purchase validation failed',
      };
    } catch (error: any) {
      logger.error('Purchase validation error:', error);
      return {
        success: false,
        message: error.message || 'Network error during validation',
      };
    }
  }

  /**
   * Retry any purchase that was paid for but never credited (for example if
   * the app closed mid-purchase). Riz are consumables, so there is nothing
   * else to restore.
   */
  async restorePurchases(): Promise<boolean> {
    if (!this.isInitialized || !ExpoIap) {
      return false;
    }

    try {
      // StoreKit's full transaction list leaves out consumables once they
      // are finished, so any Riz purchase in it has not been credited yet.
      const unfinished = await ExpoIap.getAvailablePurchases({
        alsoPublishToEventListener: false,
        onlyIncludeActiveItems: false,
      });
      const riz = unfinished.filter((purchase) => PRODUCT_RIZ_AMOUNTS[purchase.productId]);
      for (const purchase of riz) {
        await this.handlePurchase(purchase);
      }
      return riz.length > 0;
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
