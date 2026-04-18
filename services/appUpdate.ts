import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Application from 'expo-application';
import { Linking, Platform } from 'react-native';

import { supabase } from '@/services/supabase';

const GOOGLE_PLAY_PACKAGE_NAME = 'com.jreynoso.buddybalance';
const GOOGLE_PLAY_URL = `https://play.google.com/store/apps/details?id=${GOOGLE_PLAY_PACKAGE_NAME}`;
const GOOGLE_PLAY_MARKET_URL = `market://details?id=${GOOGLE_PLAY_PACKAGE_NAME}`;
const LAST_DISMISSED_UPDATE_VERSION_KEY = 'last_dismissed_update_version_code';
const ANDROID_UPDATE_TRACK = 'internal';

export type AndroidUpdateInfo = {
  updateAvailable: boolean;
  installedVersionCode: number | null;
  latestVersionCode: number | null;
  releaseStatus: string | null;
  track: string;
};

function getInstalledAndroidVersionCode() {
  const nativeBuildVersion = Number(Application.nativeBuildVersion || '');
  return Number.isFinite(nativeBuildVersion) ? nativeBuildVersion : null;
}

export async function getAndroidUpdateInfo(): Promise<AndroidUpdateInfo> {
  const installedVersionCode = getInstalledAndroidVersionCode();

  if (Platform.OS !== 'android') {
    return {
      updateAvailable: false,
      installedVersionCode,
      latestVersionCode: null,
      releaseStatus: null,
      track: ANDROID_UPDATE_TRACK,
    };
  }

  const result = await supabase.functions.invoke('google-play-sync', {
    body: {
      mode: 'latest_release',
      track: ANDROID_UPDATE_TRACK,
      package_name: Application.applicationId || GOOGLE_PLAY_PACKAGE_NAME,
    },
  });

  if (result.error) {
    throw new Error(result.error.message || 'Could not check Google Play for updates.');
  }

  const latestRelease = result.data?.latestRelease || null;
  const latestVersionCode = Number(latestRelease?.latestVersionCode || '');
  const normalizedLatestVersionCode = Number.isFinite(latestVersionCode) ? latestVersionCode : null;
  const releaseStatus = latestRelease?.status ? String(latestRelease.status) : null;

  return {
    updateAvailable:
      installedVersionCode != null &&
      normalizedLatestVersionCode != null &&
      normalizedLatestVersionCode > installedVersionCode &&
      String(releaseStatus || '').toLowerCase() !== 'draft',
    installedVersionCode,
    latestVersionCode: normalizedLatestVersionCode,
    releaseStatus,
    track: ANDROID_UPDATE_TRACK,
  };
}

export async function shouldPromptForAndroidUpdate() {
  const updateInfo = await getAndroidUpdateInfo();
  if (!updateInfo.updateAvailable || updateInfo.latestVersionCode == null) {
    return {
      ...updateInfo,
      shouldPrompt: false,
    };
  }

  const dismissedVersionCode = Number(await AsyncStorage.getItem(LAST_DISMISSED_UPDATE_VERSION_KEY));
  const shouldPrompt = !Number.isFinite(dismissedVersionCode) || dismissedVersionCode < updateInfo.latestVersionCode;

  return {
    ...updateInfo,
    shouldPrompt,
  };
}

export async function dismissAndroidUpdatePrompt(latestVersionCode: number | null) {
  if (!latestVersionCode) return;
  await AsyncStorage.setItem(LAST_DISMISSED_UPDATE_VERSION_KEY, String(latestVersionCode));
}

export async function openGooglePlayForUpdate() {
  if (Platform.OS !== 'android') {
    await Linking.openURL(GOOGLE_PLAY_URL);
    return;
  }

  const canOpenMarket = await Linking.canOpenURL(GOOGLE_PLAY_MARKET_URL);
  await Linking.openURL(canOpenMarket ? GOOGLE_PLAY_MARKET_URL : GOOGLE_PLAY_URL);
}
