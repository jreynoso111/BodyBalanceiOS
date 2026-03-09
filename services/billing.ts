import { Platform } from 'react-native';

import { PlanTier } from '@/services/subscriptionPlan';

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

export function isBillingAvailable() {
  return Platform.OS === 'android';
}

export function getBillingUnavailableReason() {
  if (Platform.OS === 'web') {
    return 'Premium checkout is only available in the Android and iOS apps.';
  }

  if (Platform.OS === 'ios') {
    return 'iOS billing is paused until the App Store setup is completed.';
  }

  return null;
}

export function getBillingEntitlementId() {
  return 'Buddy Balance Pro';
}

export function getPlanTierFromCustomerInfo() {
  return 'free' as PlanTier;
}

export function subscribeToBillingCustomerInfo() {
  return () => {};
}

export async function configureBillingForUser(_user: BillingUser) {
  return null;
}

export async function fetchPremiumOffering() {
  return {
    offering: null,
    featuredPackage: null,
  };
}

export function describePackage() {
  return 'Google Play lifetime access';
}

export async function syncPlanTierFromBillingServer(): Promise<BillingSyncResult> {
  return {
    planTier: 'free',
    synced: false,
    error: 'Direct store sync is not configured yet.',
  };
}

export async function purchasePremiumPackage() {
  throw new Error('Direct Google Play purchases are not configured yet.');
}

export async function restorePremiumAccess() {
  return {
    planTier: 'free' as PlanTier,
    synced: false,
    error: 'Google Play restore is not configured yet.',
  };
}

export async function getLocalBillingPlanTier() {
  return 'free' as PlanTier;
}
