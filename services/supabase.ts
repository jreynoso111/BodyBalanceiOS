import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error(
        'Missing Supabase configuration. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY.'
    );
}

if (!SUPABASE_ANON_KEY.startsWith('sb_publishable_')) {
    throw new Error('Invalid Supabase key for frontend. Use only EXPO_PUBLIC_SUPABASE_ANON_KEY.');
}

const isExpoGoIOS = Platform.OS === 'ios' && Constants.appOwnership === 'expo';
const authStorageKeyPrefix = SUPABASE_URL.replace(/^https?:\/\//, '').split('.')[0];
const authStorageKeys = [
    `sb-${authStorageKeyPrefix}-auth-token`,
    `sb-${authStorageKeyPrefix}-auth-token-code-verifier`,
];

// Custom storage adapter to handle different platforms and avoid crashes in Node.js
const customStorage = {
    getItem: async (key: string) => {
        if (Platform.OS === 'web') {
            if (typeof window !== 'undefined') {
                return localStorage.getItem(key);
            }
            return null;
        }
        if (isExpoGoIOS) {
            return AsyncStorage.getItem(key);
        }
        try {
            return await SecureStore.getItemAsync(key);
        } catch {
            return AsyncStorage.getItem(key);
        }
    },
    setItem: async (key: string, value: string) => {
        if (Platform.OS === 'web') {
            if (typeof window !== 'undefined') {
                localStorage.setItem(key, value);
            }
            return;
        }
        if (isExpoGoIOS) {
            await AsyncStorage.setItem(key, value);
            return;
        }
        try {
            await SecureStore.setItemAsync(key, value);
        } catch {
            await AsyncStorage.setItem(key, value);
        }
    },
    removeItem: async (key: string) => {
        if (Platform.OS === 'web') {
            if (typeof window !== 'undefined') {
                localStorage.removeItem(key);
            }
            return;
        }
        if (isExpoGoIOS) {
            await AsyncStorage.removeItem(key);
            return;
        }
        try {
            await SecureStore.deleteItemAsync(key);
        } catch {
            await AsyncStorage.removeItem(key);
        }
    },
};

export async function clearPersistedAuthState() {
    await Promise.all(
        authStorageKeys.flatMap((key) => [
            AsyncStorage.removeItem(key).catch(() => null),
            SecureStore.deleteItemAsync(key).catch(() => null),
        ])
    );
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
        storage: customStorage as any,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
    },
});
