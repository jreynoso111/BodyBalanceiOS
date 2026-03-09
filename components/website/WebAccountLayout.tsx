import React from 'react';
import { Link, usePathname, useRouter, type Href } from 'expo-router';
import { Pressable, StyleSheet, TouchableOpacity, View } from 'react-native';

import { AppLegalFooter } from '@/components/AppLegalFooter';
import { Text } from '@/components/Themed';
import { clearPersistedAuthState, supabase } from '@/services/supabase';
import { getDeviceLanguage } from '@/constants/i18n';
import { getPlanLabel } from '@/services/subscriptionPlan';
import { useAuthStore } from '@/store/authStore';

type AccountNavItem = {
  href: Href;
  label: string;
  matches: string[];
};

const ACCOUNT_NAV: AccountNavItem[] = [
  { href: '/dashboard', label: 'Dashboard', matches: ['/dashboard'] },
  { href: '/settings', label: 'Account', matches: ['/settings'] },
  { href: '/profile', label: 'Profile', matches: ['/profile'] },
  { href: '/subscription', label: 'Membership', matches: ['/subscription'] },
  { href: '/notifications', label: 'Notifications', matches: ['/notifications'] },
  { href: '/security', label: 'Security', matches: ['/security'] },
  { href: '/help-support', label: 'Support', matches: ['/help-support', '/faq', '/privacy', '/terms'] },
];

function matchesPath(pathname: string, patterns: string[]) {
  return patterns.some((pattern) => pathname === pattern || pathname.startsWith(`${pattern}/`));
}

export function WebAccountLayout({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname() || '/settings';
  const router = useRouter();
  const { user, role, planTier, setSession, setUser, setRole, setPlanTier, setLanguage } = useAuthStore();
  const displayName =
    String(user?.user_metadata?.full_name || '').trim() ||
    String(user?.email || '').split('@')[0] ||
    'Account';
  const normalizedRole = String(role || '').toLowerCase().trim();
  const hasAdminAccess = normalizedRole === 'admin' || normalizedRole === 'administrator';

  const signOut = async () => {
    await supabase.auth.signOut().catch(() => null);
    await clearPersistedAuthState().catch(() => null);
    setSession(null);
    setUser(null);
    setRole(null);
    setPlanTier('free');
    setLanguage(getDeviceLanguage());
    router.replace('/');
  };

  return (
    <View style={styles.page}>
      <View style={styles.shell}>
        <View style={styles.topbar}>
          <View>
            <Text style={styles.productLabel}>Buddy Balance account</Text>
            <Text style={styles.productSubcopy}>Signed in with the same Supabase account used in the app.</Text>
          </View>
          <View style={styles.topbarActions}>
            <Link href="/" asChild>
              <Pressable style={styles.siteButton}>
                <Text style={styles.siteButtonText}>Public site</Text>
              </Pressable>
            </Link>
            <TouchableOpacity style={styles.signOutButton} onPress={() => void signOut()}>
              <Text style={styles.signOutButtonText}>Sign out</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.main}>
          <View style={styles.sidebar}>
            <View style={styles.profileCard}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{displayName.charAt(0).toUpperCase()}</Text>
              </View>
              <Text style={styles.profileName}>{displayName}</Text>
              <Text style={styles.profileEmail}>{user?.email}</Text>
              <Text style={styles.profileMeta}>
                {getPlanLabel(planTier)} plan{hasAdminAccess ? ' • Admin' : ''}
              </Text>
            </View>

            <View style={styles.navCard}>
              {ACCOUNT_NAV.map((item) => {
                const active = matchesPath(pathname, item.matches);
                return (
                  <Link key={item.label} href={item.href} asChild>
                    <Pressable style={StyleSheet.flatten([styles.navLink, active && styles.navLinkActive])}>
                      <Text style={[styles.navText, active && styles.navTextActive]}>{item.label}</Text>
                    </Pressable>
                  </Link>
                );
              })}
            </View>
          </View>

          <View style={styles.content}>
            <View style={styles.headerCard}>
              {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
              <Text style={styles.title}>{title}</Text>
              <Text style={styles.description}>{description}</Text>
            </View>

            <View style={styles.body}>{children}</View>
          </View>
        </View>

        <AppLegalFooter style={styles.footer} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: '#F6F8FF',
  },
  shell: {
    width: '100%',
    maxWidth: 1280,
    alignSelf: 'center',
    paddingHorizontal: 20,
    paddingVertical: 24,
    gap: 18,
  },
  topbar: {
    borderRadius: 24,
    padding: 20,
    backgroundColor: 'rgba(255,255,255,0.84)',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 14,
  },
  productLabel: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0F172A',
  },
  productSubcopy: {
    marginTop: 4,
    fontSize: 13,
    lineHeight: 20,
    color: '#64748B',
  },
  topbarActions: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
  },
  siteButton: {
    minHeight: 42,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#D6DAFF',
    backgroundColor: '#FFFFFF',
  },
  siteButtonText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1E293B',
  },
  signOutButton: {
    minHeight: 42,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: '#101A3A',
  },
  signOutButtonText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  main: {
    flexDirection: 'row',
    gap: 18,
    alignItems: 'flex-start',
    flexWrap: 'wrap',
  },
  sidebar: {
    width: 290,
    gap: 14,
  },
  profileCard: {
    borderRadius: 28,
    padding: 22,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#DDE5FF',
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EEF2FF',
  },
  avatarText: {
    fontSize: 22,
    fontWeight: '900',
    color: '#4F46E5',
  },
  profileName: {
    marginTop: 14,
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '900',
    color: '#0F172A',
  },
  profileEmail: {
    marginTop: 4,
    fontSize: 14,
    lineHeight: 22,
    color: '#475569',
  },
  profileMeta: {
    marginTop: 10,
    fontSize: 12,
    lineHeight: 18,
    color: '#6366F1',
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  navCard: {
    borderRadius: 28,
    padding: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 6,
  },
  navLink: {
    minHeight: 44,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
    justifyContent: 'center',
  },
  navLinkActive: {
    backgroundColor: '#EEF2FF',
  },
  navText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#334155',
  },
  navTextActive: {
    color: '#4338CA',
  },
  content: {
    flex: 1,
    minWidth: 320,
    gap: 16,
  },
  headerCard: {
    borderRadius: 32,
    padding: 28,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#DDE5FF',
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: '800',
    color: '#6366F1',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  title: {
    fontSize: 38,
    lineHeight: 42,
    fontWeight: '900',
    color: '#0F172A',
  },
  description: {
    marginTop: 12,
    fontSize: 17,
    lineHeight: 28,
    color: '#475569',
  },
  body: {
    gap: 16,
  },
  footer: {
    marginTop: 6,
  },
});
