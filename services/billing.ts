import Constants from 'expo-constants';
import type { ActiveSubscription, ProductOrSubscription, Purchase } from 'expo-iap';
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

type BillingReadinessResult = {
  available: boolean;
  ready: boolean;
  reason: string | null;
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

const ANDROID_ANNUAL_PRODUCT_ID = String(
  process.env.EXPO_PUBLIC_ANDROID_PREMIUM_SUBSCRIPTION_ID || process.env.EXPO_PUBLIC_ANDROID_PREMIUM_PRODUCT_ID || ''
).trim();
const ANDROID_MONTHLY_PRODUCT_ID = String(process.env.EXPO_PUBLIC_ANDROID_PREMIUM_MONTHLY_SUBSCRIPTION_ID || '').trim();
const ANDROID_PACKAGE_NAME =
  String(Constants.expoConfig?.android?.package || Constants.manifest2?.extra?.expoClient?.android?.package || '').trim();
const ANDROID_PREMIUM_PRODUCT_IDS = Array.from(
  new Set([ANDROID_ANNUAL_PRODUCT_ID, ANDROID_MONTHLY_PRODUCT_ID].filter(Boolean))
);

let billingConfiguredUser: BillingUser = {};
let billingConnectionReady = false;
let billingConnectionPromise: Promise<boolean> | null = null;
let expoIapModulePromise: Promise<typeof import('expo-iap')> | null = null;

async function getExpoIapModule() {
  if (Platform.OS !== 'android') {
    throw new Error('Google Play billing is only available on Android.');
  }

  if (!expoIapModulePromise) {
    expoIapModulePromise = import('expo-iap');
  }

  return expoIapModulePromise;
}

function hasAndroidBillingConfig() {
  return Boolean(ANDROID_PREMIUM_PRODUCT_IDS.length > 0 && ANDROID_PACKAGE_NAME);
}

async function ensureBillingConnection() {
  if (Platform.OS !== 'android' || !hasAndroidBillingConfig()) {
    return false;
  }

  if (billingConnectionReady) {
    return true;
  }

  if (!billingConnectionPromise) {
    billingConnectionPromise = getExpoIapModule()
      .then((module) => module.initConnection())
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
  if (ANDROID_PREMIUM_PRODUCT_IDS.length === 0) {
    return 'Google Play billing is missing EXPO_PUBLIC_ANDROID_PREMIUM_SUBSCRIPTION_ID or EXPO_PUBLIC_ANDROID_PREMIUM_MONTHLY_SUBSCRIPTION_ID.';
  }

  if (!ANDROID_PACKAGE_NAME) {
    return 'Google Play billing is missing the Android package name in the Expo app config.';
  }

  return null;
}

function getSignedInUserId() {
  return String(billingConfiguredUser.userId || '').trim();
}

function getPrimaryPremiumProductId() {
  return ANDROID_ANNUAL_PRODUCT_ID || ANDROID_MONTHLY_PRODUCT_ID || '';
}

function getConfiguredPremiumProductIds() {
  return ANDROID_PREMIUM_PRODUCT_IDS;
}

function isConfiguredPremiumProductId(productId: string) {
  return getConfiguredPremiumProductIds().includes(productId);
}

function getMatchingPremiumPurchase(purchases: Purchase[]) {
  return purchases.find(
    (purchase) =>
      isConfiguredPremiumProductId(String(purchase.productId || '').trim()) &&
      (purchase.purchaseState === 'purchased' || purchase.isAutoRenewing || Boolean(purchase.purchaseToken))
  );
}

function getMatchingPremiumSubscription(purchases: ActiveSubscription[]) {
  return purchases.find(
    (purchase) =>
      isConfiguredPremiumProductId(String(purchase.productId || '').trim()) &&
      (purchase.isActive || Boolean(purchase.autoRenewingAndroid) || Boolean(purchase.purchaseToken))
  );
}

function isPurchaseCancelled(error: unknown) {
  const code = String((error as any)?.code || '').toLowerCase();
  return code === 'user-cancelled' || code === 'e_user_cancelled';
}

function sortPremiumProducts(products: ProductOrSubscription[]) {
  const priority = new Map(
    getConfiguredPremiumProductIds().map((productId, index) => [productId, index])
  );

  return [...products].sort((left, right) => {
    const leftPriority = priority.get(left.id) ?? Number.MAX_SAFE_INTEGER;
    const rightPriority = priority.get(right.id) ?? Number.MAX_SAFE_INTEGER;
    return leftPriority - rightPriority;
  });
}

function inferBillingPeriodLabel(productId: string) {
  const normalizedId = productId.toLowerCase();
  if (normalizedId.includes('month')) {
    return 'monthly';
  }

  if (normalizedId.includes('year') || normalizedId.includes('annual')) {
    return 'annual';
  }

  return 'Premium';
}

async function fetchPremiumProducts() {
  await ensureBillingConnection();
  const { fetchProducts } = await getExpoIapModule();

  const products = (await fetchProducts({
    skus: getConfiguredPremiumProductIds(),
    type: 'subs',
  })) ?? [];

  return sortPremiumProducts(products.filter((product) => product.type === 'subs'));
}

async function fetchPremiumProduct(productId?: string) {
  const products = await fetchPremiumProducts();
  if (productId) {
    return products.find((product) => product.id === productId) || null;
  }

  return products[0] || null;
}

function getSubscriptionOfferToken(product: ProductOrSubscription | null) {
  if (!product || product.type !== 'subs' || product.platform !== 'android') {
    return null;
  }

  const standardizedOfferToken = product.subscriptionOffers?.find((offer) => offer.offerTokenAndroid)?.offerTokenAndroid;
  if (standardizedOfferToken) {
    return standardizedOfferToken;
  }

  return product.subscriptionOfferDetailsAndroid?.[0]?.offerToken || null;
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
      is_subscription: true,
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

async function fetchGooglePlayBillingHealth(): Promise<BillingReadinessResult> {
  const { data, error } = await supabase.functions.invoke('google-play-sync', {
    body: {
      mode: 'health',
      package_name: ANDROID_PACKAGE_NAME,
      product_id: getPrimaryPremiumProductId(),
      is_subscription: true,
    },
  });

  if (error) {
    return {
      available: true,
      ready: false,
      reason: error.message || 'Google Play billing backend is not responding correctly.',
    };
  }

  if (!data?.ok || !data?.ready) {
    return {
      available: true,
      ready: false,
      reason: typeof data?.error === 'string' ? data.error : 'Google Play billing backend is not ready.',
    };
  }

  return {
    available: true,
    ready: true,
    reason: null,
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
  return getPrimaryPremiumProductId() || 'premium';
}

export function getBillingEntitlementIds() {
  return getConfiguredPremiumProductIds();
}

export async function getBillingReadiness(): Promise<BillingReadinessResult> {
  if (Platform.OS !== 'android') {
    return {
      available: false,
      ready: false,
      reason: getBillingUnavailableReason(),
    };
  }

  if (!hasAndroidBillingConfig()) {
    return {
      available: false,
      ready: false,
      reason: getMissingAndroidBillingConfigReason(),
    };
  }

  try {
    const connectionReady = await ensureBillingConnection();
    if (!connectionReady) {
      return {
        available: true,
        ready: false,
        reason: 'Google Play Billing could not connect on this device.',
      };
    }
  } catch (error) {
    return {
      available: true,
      ready: false,
      reason: normalizePurchaseError(error),
    };
  }

  return fetchGooglePlayBillingHealth();
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
      const { endConnection } = await getExpoIapModule().catch(() => ({ endConnection: async () => null }));
      await endConnection().catch(() => null);
      billingConnectionReady = false;
    }
    return null;
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

  const products = await fetchPremiumProducts();
  const featuredPackage = products[0] || null;
  return {
    offering: featuredPackage
      ? {
          id: 'android-google-play',
          products,
        }
      : null,
    featuredPackage,
  };
}

export function describePackage(product?: ProductOrSubscription | null) {
  if (product?.displayPrice) {
    return `Google Play ${inferBillingPeriodLabel(product.id)} subscription for ${product.displayPrice}`;
  }

  return `Google Play ${product ? inferBillingPeriodLabel(product.id) : 'Premium'} subscription`;
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
  const productId = String(params?.productId || getPrimaryPremiumProductId()).trim();

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

export async function purchasePremiumPackage(productId?: string) {
  if (!isBillingAvailable()) {
    throw new Error(getBillingUnavailableReason() || 'Billing is unavailable on this device.');
  }

  const userId = getSignedInUserId();
  if (!userId) {
    throw new Error('Sign in before starting a Google Play purchase.');
  }

  const targetProductId = String(productId || getPrimaryPremiumProductId()).trim();
  const product = await fetchPremiumProduct(targetProductId);
  if (!product) {
    throw new Error(`Google Play product "${targetProductId}" was not returned by Billing.`);
  }

  try {
    const { requestPurchase, finishTransaction } = await getExpoIapModule();
    const offerToken = getSubscriptionOfferToken(product);
    const purchaseResult = await requestPurchase({
      type: 'subs',
      request: {
        google: {
          skus: [product.id],
          ...(offerToken ? { subscriptionOffers: [{ sku: product.id, offerToken }] } : {}),
          obfuscatedAccountId: userId,
          obfuscatedProfileId: userId,
        },
      },
    });

    const purchases = Array.isArray(purchaseResult) ? purchaseResult : purchaseResult ? [purchaseResult] : [];
    const purchase = getMatchingPremiumPurchase(purchases);

    if (!purchase) {
      throw new Error('Google Play did not return a completed Premium subscription.');
    }

    if (!purchase.purchaseToken) {
      throw new Error('Google Play did not return a purchase token for Premium.');
    }

    if (purchase.purchaseState !== 'purchased') {
      throw new Error('Your Google Play subscription is still pending approval.');
    }

    const syncResult = await syncGooglePlayPurchase({
      productId: purchase.productId,
      purchaseToken: purchase.purchaseToken,
    });

    if (!syncResult.synced || syncResult.planTier !== 'premium') {
      throw new Error(syncResult.error || 'The subscription was completed, but Premium could not be activated yet.');
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
    const { getActiveSubscriptions, restorePurchases } = await getExpoIapModule();
    await ensureBillingConnection();
    await restorePurchases();

    const purchases = await getActiveSubscriptions(getConfiguredPremiumProductIds());
    const premiumPurchase = getMatchingPremiumSubscription(purchases);

    if (!premiumPurchase?.purchaseToken) {
      return {
        planTier: 'free' as PlanTier,
        synced: false,
        error: 'No Google Play Premium subscription was found to restore.',
      };
    }

    const syncResult = await syncGooglePlayPurchase({
      productId: premiumPurchase.productId,
      purchaseToken: premiumPurchase.purchaseToken,
    });

    if (!syncResult.synced || syncResult.planTier !== 'premium') {
      return syncResult;
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

  const { getActiveSubscriptions } = await getExpoIapModule();
  await ensureBillingConnection();
  const purchases = await getActiveSubscriptions(getConfiguredPremiumProductIds());

  return getMatchingPremiumSubscription(purchases) ? ('premium' as PlanTier) : ('free' as PlanTier);
}
