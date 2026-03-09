import React from 'react';
import { Platform, StyleSheet, TouchableOpacity, View as RNView } from 'react-native';
import { Redirect, useRouter } from 'expo-router';

import { Card, Screen, Text } from '@/components/Themed';
import { WebAccountLayout } from '@/components/website/WebAccountLayout';
import { useAuthStore } from '@/store/authStore';
import { getPlanLabel } from '@/services/subscriptionPlan';

export default function AccountDashboardScreen() {
  const router = useRouter();
  const { initialized, user, role, planTier } = useAuthStore();

  if (Platform.OS === 'web' && initialized && !user) {
    return <Redirect href="/(auth)/login" />;
  }

  if (Platform.OS !== 'web') {
    return (
      <Screen>
        <Text style={styles.mobileTitle}>Dashboard is available on web.</Text>
      </Screen>
    );
  }

  const normalizedRole = String(role || '').toLowerCase();
  const isAdmin = normalizedRole === 'admin' || normalizedRole === 'administrator';

  return (
    <WebAccountLayout
      eyebrow="Dashboard"
      title="A single view of your account privileges and next actions."
      description="This dashboard adapts to your plan and role, showing only the controls and shortcuts you can access."
    >
      <RNView style={styles.grid}>
        <Card style={styles.panel}>
          <Text style={styles.panelTitle}>Account status</Text>
          <Text style={styles.panelBody}>
            Plan: {getPlanLabel(planTier)}
          </Text>
          <Text style={styles.panelBody}>
            Role: {isAdmin ? 'Administrator' : 'Standard user'}
          </Text>
          <Text style={styles.panelBody}>
            Email: {user?.email || '—'}
          </Text>
        </Card>

        <Card style={styles.panel}>
          <Text style={styles.panelTitle}>Your actions</Text>
          <Text style={styles.panelBody}>
            Keep your profile, notifications, and security settings aligned across the app and web.
          </Text>
          <RNView style={styles.actionStack}>
            <TouchableOpacity style={styles.primaryButton} onPress={() => router.push('/profile')}>
              <Text style={styles.primaryButtonText}>Edit profile</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryButton} onPress={() => router.push('/notifications')}>
              <Text style={styles.secondaryButtonText}>Notification preferences</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryButton} onPress={() => router.push('/security')}>
              <Text style={styles.secondaryButtonText}>Security & devices</Text>
            </TouchableOpacity>
          </RNView>
        </Card>
      </RNView>

      <RNView style={styles.grid}>
        <Card style={styles.panel}>
          <Text style={styles.panelTitle}>Membership</Text>
          <Text style={styles.panelBody}>
            Review your current plan, referral status, and available Premium benefits.
          </Text>
          <TouchableOpacity style={styles.secondaryButton} onPress={() => router.push('/subscription')}>
            <Text style={styles.secondaryButtonText}>View membership</Text>
          </TouchableOpacity>
        </Card>

        <Card style={styles.panel}>
          <Text style={styles.panelTitle}>Support & policies</Text>
          <Text style={styles.panelBody}>
            Use the support hub for account-specific issues or review policy pages tied to store submission.
          </Text>
          <RNView style={styles.actionStack}>
            <TouchableOpacity style={styles.secondaryButton} onPress={() => router.push('/help-support')}>
              <Text style={styles.secondaryButtonText}>Support hub</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.ghostButton} onPress={() => router.push('/faq')}>
              <Text style={styles.ghostButtonText}>FAQ</Text>
            </TouchableOpacity>
          </RNView>
        </Card>
      </RNView>

      {isAdmin ? (
        <Card style={styles.adminPanel}>
          <Text style={styles.panelTitle}>Administrator tools</Text>
          <Text style={styles.panelBody}>
            You have admin privileges. Use these shortcuts to inspect records, confirmations, and user lists.
          </Text>
          <RNView style={styles.actionStack}>
            <TouchableOpacity style={styles.primaryButton} onPress={() => router.push('/admin')}>
              <Text style={styles.primaryButtonText}>Open admin dashboard</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryButton} onPress={() => router.push('/admin/requests')}>
              <Text style={styles.secondaryButtonText}>Review requests</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryButton} onPress={() => router.push('/admin/users')}>
              <Text style={styles.secondaryButtonText}>Manage users</Text>
            </TouchableOpacity>
          </RNView>
        </Card>
      ) : (
        <Card style={styles.panel}>
          <Text style={styles.panelTitle}>Admin access</Text>
          <Text style={styles.panelBody}>
            This account does not have administrator access. If you expected admin permissions, contact support.
          </Text>
        </Card>
      )}
    </WebAccountLayout>
  );
}

const styles = StyleSheet.create({
  mobileTitle: {
    padding: 20,
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  panel: {
    flex: 1,
    minWidth: 260,
    padding: 22,
  },
  adminPanel: {
    padding: 22,
    borderWidth: 1,
    borderColor: '#C7D2FE',
    backgroundColor: '#EEF2FF',
  },
  panelTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0F172A',
  },
  panelBody: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 22,
    color: '#475569',
  },
  actionStack: {
    marginTop: 16,
    gap: 10,
  },
  primaryButton: {
    minHeight: 44,
    borderRadius: 14,
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  secondaryButton: {
    minHeight: 44,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
  },
  secondaryButtonText: {
    color: '#0F172A',
    fontSize: 14,
    fontWeight: '800',
  },
  ghostButton: {
    minHeight: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    backgroundColor: '#F8FAFF',
  },
  ghostButtonText: {
    color: '#475569',
    fontSize: 13,
    fontWeight: '700',
  },
});
