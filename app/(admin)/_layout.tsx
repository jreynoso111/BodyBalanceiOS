import React from 'react';
import { Stack, Redirect } from 'expo-router';
import { useAuthStore } from '@/store/authStore';
import { useI18n } from '@/hooks/useI18n';

export default function AdminLayout() {
    const { role, initialized } = useAuthStore();
    const { t } = useI18n();
    const normalizedRole = (role || '').toLowerCase().trim();
    const hasAdminAccess = normalizedRole === 'admin' || normalizedRole === 'administrator';

    if (!initialized) {
        return null; // Wait for auth store to load
    }

    if (!hasAdminAccess) {
        // Redirect standard users back to home
        return <Redirect href="/(tabs)" />;
    }

    return (
        <Stack
            screenOptions={{
                headerShown: true,
                headerStyle: {
                    backgroundColor: '#FFFFFF',
                },
                headerTitleStyle: {
                    fontWeight: '800',
                },
                headerBackTitle: 'Back',
            }}
        >
            <Stack.Screen name="index" options={{ title: t('Admin Dashboard') }} />
            <Stack.Screen name="users" options={{ title: t('Platform Users') }} />
            <Stack.Screen name="loans" options={{ title: t('Platform Lend/Borrow') }} />
            <Stack.Screen name="requests" options={{ title: t('Admin Requests') }} />
        </Stack>
    );
}
