import Constants from 'expo-constants';
import {
  type ProductOrSubscription,
  type Purchase,
  endConnection,
  fetchProducts,
  finishTransaction,
  getAvailablePurchases,
  initConnection,
  requestPurchase,
  restorePurchases,
} from 'expo-iap';
import { Platform } from 'react-native';

import { supabase } from '@/services/supabase';
import { PlanTier } from '@/services/subscriptionPlan';
import { useAuthStore } from '@/store/authStore';

type BillingUser = {
  userId?: string | null;
  email?: string | null;
  phone?: string | null;
  displayName?: string | null;
};

type BillingSyncResult = {
  planTier: PlanTier;
  synced: boolean;
  error?: string;
};

type PremiumOffering = {
  offering: {
    id: string;
    products: ProductOrSubscription[];
  } | null;
  featuredPackage: ProductOrSubscription | null;
};

type SyncPurchaseParams = {
  productId: string;
  purchaseToken: string;
};

const ANDROID_PREMIUM_PRODUCT_ID = String(process.env.EXPO_PUBLIC_ANDROID_PREMIUM_PRODUCT_ID || '').trim();
const ANDROID_PACKAGE_NAME =
  String(Constants.expoConfig?.android?.package || Constants.manifest2?.extra?.expoClient?.android?.package || '').trim();

let billingConfiguredUser: BillingUser = {};
let billingConnectionReady = false;
let billingConnectionPromise: Promise<boolean> | null = null;

function hasAndroidBillingConfig() {
  return Boolean(ANDROID_PREMIUM_PRODUCT_ID && ANDROID_PACKAGE_NAME);
}

async function ensureBillingConnection() {
  if (Platform.OS !== 'android' || !hasAndroidBillingConfig()) {
    return false;
  }

  if (billingConnectionReady) {
    return true;
  }

  if (!billingConnectionPromise) {
    billingConnectionPromise = initConnection()
      .then((connected) => {
        billingConnectionReady = Boolean(connected);
        return billingConnectionReady;
      })
      .catch((error) => {
        billingConnectionReady = false;
        throw error;
      })
      .finally(() => {
        billingConnectionPromise = null;
      });
  }

  return billingConnectionPromise;
}

function getMissingAndroidBillingConfigReason() {
  if (!ANDROID_PREMIUM_PRODUCT_ID) {
    return 'Google Play billing is missing EXPO_PUBLIC_ANDROID_PREMIUM_PRODUCT_ID.';
  }

  if (!ANDROID_PACKAGE_NAME) {
    return 'Google Play billing is missing the Android package name in the Expo app config.';
  }

  return null;
}

function getSignedInUserId() {
  return String(billingConfiguredUser.userId || '').trim();
}

function getMatchingPremiumPurchase(purchases: Purchase[]) {
  return purchases.find(
    (purchase) =>
      purchase.productId === ANDROID_PREMIUM_PRODUCT_ID &&
      (purchase.purchaseState === 'purchased' || purchase.isAutoRenewing)
  );
}

function isPurchaseCancelled(error: unknown) {
  const code = String((error as any)?.code || '').toLowerCase();
  return code === 'user-cancelled' || code === 'e_user_cancelled';
}

async function fetchPremiumProduct() {
  await ensureBillingConnection();

  const products = (await fetchProducts({
    skus: [ANDROID_PREMIUM_PRODUCT_ID],
    type: 'in-app',
  })) ?? [];

  return products.find((product) => product.id === ANDROID_PREMIUM_PRODUCT_ID && product.type === 'in-app') || null;
}

function updateLocalPlanTier(planTier: PlanTier) {
  useAuthStore.getState().setPlanTier(planTier);
}

function normalizePurchaseError(error: unknown) {
  if (isPurchaseCancelled(error)) {
    return 'Purchase was cancelled.';
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message.trim();
  }

  return 'Premium checkout is not available right now.';
}

async function syncGooglePlayPurchase({ productId, purchaseToken }: SyncPurchaseParams): Promise<BillingSyncResult> {
  const { data, error } = await supabase.functions.invoke('google-play-sync', {
    body: {
      package_name: ANDROID_PACKAGE_NAME,
      product_id: productId,
      purchase_token: purchaseToken,
      is_subscription: false,
    },
  });

  if (error) {
    return {
      planTier: 'free',
      synced: false,
      error: error.message || 'Could not validate the Google Play purchase.',
    };
  }

  const planTier = String(data?.planTier || 'free').toLowerCase() === 'premium' ? 'premium' : 'free';
  return {
    planTier,
    synced: Boolean(data?.ok),
    error: typeof data?.error === 'string' ? data.error : undefined,
  };
}

export function isBillingAvailable() {
  return Platform.OS === 'android' && hasAndroidBillingConfig();
}

export function getBillingUnavailableReason() {
  if (Platform.OS === 'web') {
    return 'Premium checkout is currently available in the Android app through Google Play.';
  }

  if (Platform.OS === 'ios') {
    return 'Android billing is live first. iOS billing is still pending App Store setup.';
  }

  return getMissingAndroidBillingConfigReason();
}

export function getBillingEntitlementId() {
  return ANDROID_PREMIUM_PRODUCT_ID || 'premium';
}

export async function getPlanTierFromCustomerInfo() {
  return getLocalBillingPlanTier();
}

export function subscribeToBillingCustomerInfo() {
  return () => {};
}

export async function configureBillingForUser(user: BillingUser) {
  billingConfiguredUser = user;

  if (!user.userId) {
    if (billingConnectionReady) {
      await endConnection().catch(() => null);
      billingConnectionReady = false;
    }
    return null;
  }

  if (Platform.OS === 'android' && hasAndroidBillingConfig()) {
    await ensureBillingConnection();
  }

  return null;
}

export async function fetchPremiumOffering(): Promise<PremiumOffering> {
  if (!isBillingAvailable()) {
    return {
      offering: null,
      featuredPackage: null,
    };
  }

  const featuredPackage = await fetchPremiumProduct();
  return {
    offering: featuredPackage
      ? {
          id: 'android-google-play',
          products: [featuredPackage],
        }
      : null,
    featuredPackage,
  };
}

export function describePackage(product?: ProductOrSubscription | null) {
  if (product?.displayPrice) {
    return `Google Play lifetime access for ${product.displayPrice}`;
  }

  return 'Google Play lifetime access';
}

export async function syncPlanTierFromBillingServer(params?: Partial<SyncPurchaseParams>): Promise<BillingSyncResult> {
  if (!isBillingAvailable()) {
    return {
      planTier: 'free',
      synced: false,
      error: getBillingUnavailableReason() || 'Billing is unavailable on this device.',
    };
  }

  const purchaseToken = String(params?.purchaseToken || '').trim();
  const productId = String(params?.productId || ANDROID_PREMIUM_PRODUCT_ID).trim();

  if (!purchaseToken || !productId) {
    return {
      planTier: 'free',
      synced: false,
      error: 'Missing Google Play purchase details.',
    };
  }

  const result = await syncGooglePlayPurchase({ productId, purchaseToken });
  if (result.synced && result.planTier === 'premium') {
    updateLocalPlanTier('premium');
  }
  return result;
}

export async function purchasePremiumPackage() {
  if (!isBillingAvailable()) {
    throw new Error(getBillingUnavailableReason() || 'Billing is unavailable on this device.');
  }

  const userId = getSignedInUserId();
  if (!userId) {
    throw new Error('Sign in before starting a Google Play purchase.');
  }

  const product = await fetchPremiumProduct();
  if (!product) {
    throw new Error(`Google Play product "${ANDROID_PREMIUM_PRODUCT_ID}" was not returned by Billing.`);
  }

  try {
    const purchaseResult = await requestPurchase({
      type: 'in-app',
      request: {
        google: {
          skus: [product.id],
          obfuscatedAccountId: userId,
          obfuscatedProfileId: userId,
        },
      },
    });

    const purchases = Array.isArray(purchaseResult) ? purchaseResult : purchaseResult ? [purchaseResult] : [];
    const purchase = getMatchingPremiumPurchase(purchases);

    if (!purchase) {
      throw new Error('Google Play did not return a completed Premium purchase.');
    }

    if (!purchase.purchaseToken) {
      throw new Error('Google Play did not return a purchase token for Premium.');
    }

    if (purchase.purchaseState !== 'purchased') {
      throw new Error('Your Google Play purchase is still pending approval.');
    }

    const syncResult = await syncGooglePlayPurchase({
      productId: purchase.productId,
      purchaseToken: purchase.purchaseToken,
    });

    if (!syncResult.synced || syncResult.planTier !== 'premium') {
      throw new Error(syncResult.error || 'The purchase was completed, but Premium could not be activated yet.');
    }

    await finishTransaction({
      purchase,
      isConsumable: false,
    });

    updateLocalPlanTier('premium');
    return syncResult;
  } catch (error) {
    throw new Error(normalizePurchaseError(error));
  }
}

export async function restorePremiumAccess() {
  if (!isBillingAvailable()) {
    return {
      planTier: 'free' as PlanTier,
      synced: false,
      error: getBillingUnavailableReason() || 'Billing is unavailable on this device.',
    };
  }

  try {
    await ensureBillingConnection();
    await restorePurchases();

    const purchases = await getAvailablePurchases({
      alsoPublishToEventListenerIOS: false,
      onlyIncludeActiveItemsIOS: true,
    });
    const premiumPurchase = getMatchingPremiumPurchase(purchases);

    if (!premiumPurchase?.purchaseToken) {
      return {
        planTier: 'free' as PlanTier,
        synced: false,
        error: 'No Google Play Premium purchase was found to restore.',
      };
    }

    const syncResult = await syncGooglePlayPurchase({
      productId: premiumPurchase.productId,
      purchaseToken: premiumPurchase.purchaseToken,
    });

    if (!syncResult.synced || syncResult.planTier !== 'premium') {
      return syncResult;
    }

    if ((premiumPurchase as any).isAcknowledgedAndroid !== true) {
      await finishTransaction({
        purchase: premiumPurchase,
        isConsumable: false,
      });
    }

    updateLocalPlanTier('premium');
    return syncResult;
  } catch (error) {
    return {
      planTier: 'free' as PlanTier,
      synced: false,
      error: normalizePurchaseError(error),
    };
  }
}

export async function getLocalBillingPlanTier() {
  if (!isBillingAvailable()) {
    return 'free' as PlanTier;
  }

  await ensureBillingConnection();
  const purchases = await getAvailablePurchases({
    alsoPublishToEventListenerIOS: false,
    onlyIncludeActiveItemsIOS: true,
  });

  return getMatchingPremiumPurchase(purchases) ? ('premium' as PlanTier) : ('free' as PlanTier);
}
