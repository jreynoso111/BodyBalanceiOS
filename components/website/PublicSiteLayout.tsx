import React from 'react';
import { Link, usePathname, type Href } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';

import { AppLegalFooter } from '@/components/AppLegalFooter';
import { BrandLogo } from '@/components/BrandLogo';
import { Text } from '@/components/Themed';
import { useAuthStore } from '@/store/authStore';

type PublicAction = {
  href: Href;
  label: string;
  variant?: 'primary' | 'secondary';
};

type PublicSiteLayoutProps = {
  eyebrow?: string;
  title: string;
  description: string;
  actions?: PublicAction[];
  heroVisual?: React.ReactNode;
  children: React.ReactNode;
};

const NAV_ITEMS: { href: Href; label: string; matches: string[] }[] = [
  { href: '/', label: 'Home', matches: ['/'] },
  {
    href: '/help-support',
    label: 'Support',
    matches: ['/help-support', '/faq', '/privacy', '/terms', '/contact'],
  },
];

const SIGNALS = [
  'Shared records',
  'Notification events',
  'Friend-linked accounts',
  'Premium exports',
];

function isActivePath(currentPath: string, matches: string[]) {
  return matches.some((href) => {
    if (href === '/') return currentPath === '/';
    return currentPath === href || currentPath.startsWith(`${href}/`);
  });
}

export function PublicSiteLayout({
  eyebrow,
  title,
  description,
  actions,
  heroVisual,
  children,
}: PublicSiteLayoutProps) {
  const { width } = useWindowDimensions();
  const pathname = usePathname() || '/';
  const user = useAuthStore((state) => state.user);
  const mobile = width < 640;
  const tablet = width < 900;
  const compact = width < 1080;
  const contentPadding = mobile ? 14 : tablet ? 18 : 22;
  const heroTitleSize = mobile ? 36 : compact ? 46 : 54;
  const heroTitleLineHeight = mobile ? 40 : compact ? 50 : 58;

  return (
    <ScrollView
      style={styles.page}
      contentContainerStyle={[styles.content, { paddingHorizontal: contentPadding, paddingVertical: mobile ? 16 : 22 }]}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.backgroundLayer}>
        <LinearGradient colors={['#EEF2FF', '#F7F1FF', '#FFF5E9']} style={styles.gradientWash} />
        <View style={[styles.orb, styles.orbLeft]} />
        <View style={[styles.orb, styles.orbRight]} />
        <View style={[styles.orb, styles.orbBottom]} />
      </View>

      <View style={styles.shell}>
        <LinearGradient
          colors={['rgba(255,255,255,0.88)', 'rgba(255,255,255,0.62)']}
          style={[styles.headerChrome, mobile && styles.headerChromeMobile]}
        >
          <Link href="/" asChild>
            <Pressable style={styles.brandLink}>
              <View style={styles.brandWrap}>
                <BrandLogo size={mobile ? 'sm' : 'md'} showWordmark={false} />
                <View style={styles.brandMeta}>
                  <Text style={[styles.brandTitle, mobile && styles.brandTitleMobile]}>Buddy Balance</Text>
                  {!tablet ? (
                    <Text style={styles.brandSubcopy}>Shared tracking for people who actually know each other.</Text>
                  ) : null}
                </View>
              </View>
            </Pressable>
          </Link>

          <View style={[styles.nav, compact && styles.navCompact, mobile && styles.navMobile]}>
            {NAV_ITEMS.map((item) => {
              const active = isActivePath(pathname, item.matches);
              return (
                <Link key={item.label} href={item.href} asChild>
                  <Pressable
                    style={StyleSheet.flatten([
                      styles.navLink,
                      mobile && styles.navLinkMobile,
                      active ? styles.navLinkActive : null,
                    ])}
                  >
                    <Text style={[styles.navLabel, mobile && styles.navLabelMobile, active ? styles.navLabelActive : null]}>
                      {item.label}
                    </Text>
                  </Pressable>
                </Link>
              );
            })}
            <Link href={user ? '/settings' : '/(auth)/login'} asChild>
              <Pressable
                style={StyleSheet.flatten([
                  styles.accountLink,
                  user && styles.accountLinkActive,
                ])}
              >
                <Text style={[styles.accountLabel, user && styles.accountLabelActive]}>
                  {user ? 'Account' : 'Sign in'}
                </Text>
              </Pressable>
            </Link>
          </View>
        </LinearGradient>

        <View style={[styles.heroShell, compact && styles.heroShellCompact]}>
          <LinearGradient
            colors={['rgba(255,255,255,0.92)', 'rgba(255,255,255,0.68)']}
            style={[styles.heroPanel, compact && styles.heroPanelCompact]}
          >
            <View style={styles.heroPanelHeader}>
              <Text style={styles.heroDot}>REC</Text>
              <View style={styles.heroSignalRow}>
                {SIGNALS.map((signal) => (
                  <View key={signal} style={styles.signalChip}>
                    <Text style={styles.signalLabel}>{signal}</Text>
                  </View>
                ))}
              </View>
            </View>

            {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
            <Text
              style={[
                styles.title,
                compact && styles.titleCompact,
                { fontSize: heroTitleSize, lineHeight: heroTitleLineHeight },
              ]}
            >
              {title}
            </Text>
            <Text style={[styles.description, mobile && styles.descriptionMobile]}>{description}</Text>

            {actions?.length ? (
              <View style={[styles.actions, mobile && styles.actionsMobile]}>
                {actions.map((action) => (
                  <Link key={`${action.href}:${action.label}`} href={action.href} asChild>
                    <Pressable
                      style={StyleSheet.flatten([
                        styles.actionButton,
                        mobile && styles.actionButtonMobile,
                        action.variant === 'secondary' ? styles.actionSecondary : styles.actionPrimary,
                      ])}
                    >
                      <Text
                        style={[
                          styles.actionLabel,
                          action.variant === 'secondary' ? styles.actionSecondaryLabel : styles.actionPrimaryLabel,
                        ]}
                      >
                        {action.label}
                      </Text>
                    </Pressable>
                  </Link>
                ))}
              </View>
            ) : null}
          </LinearGradient>

          {heroVisual ? (
            <View style={[styles.heroVisual, compact && styles.heroVisualCompact, mobile && styles.heroVisualMobile]}>
              {heroVisual}
            </View>
          ) : null}
        </View>

        <View style={styles.body}>{children}</View>

        <LinearGradient colors={['rgba(15,23,42,0.96)', 'rgba(30,41,59,0.92)']} style={[styles.footerShell, mobile && styles.footerShellMobile]}>
          <View style={[styles.footerRow, mobile && styles.footerRowMobile]}>
            <View style={styles.footerStamp}>
              <Text style={styles.footerStampText}>MOBILE FIRST</Text>
            </View>
            <Text style={styles.footerNote}>
              Buddy Balance is rolling toward public release. This site hosts support, policies, and product context
              while the mobile app gets finalized.
            </Text>
          </View>
          <AppLegalFooter style={styles.footerText} />
        </LinearGradient>
      </View>
    </ScrollView>
  );
}

export function PublicCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children?: React.ReactNode;
}) {
  return (
    <LinearGradient colors={['rgba(255,255,255,0.94)', 'rgba(255,255,255,0.7)']} style={styles.card}>
      <Text style={styles.cardTitle}>{title}</Text>
      {description ? <Text style={styles.cardDescription}>{description}</Text> : null}
      {children}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: '#F8F5FF',
  },
  content: {
    paddingHorizontal: 18,
    paddingVertical: 22,
  },
  backgroundLayer: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  gradientWash: {
    ...StyleSheet.absoluteFillObject,
  },
  orb: {
    position: 'absolute',
    borderRadius: 999,
    backgroundColor: 'rgba(99,102,241,0.12)',
  },
  orbLeft: {
    width: 340,
    height: 340,
    left: -120,
    top: 120,
  },
  orbRight: {
    width: 420,
    height: 420,
    right: -150,
    top: 40,
    backgroundColor: 'rgba(14,165,233,0.12)',
  },
  orbBottom: {
    width: 420,
    height: 420,
    right: 80,
    bottom: -220,
    backgroundColor: 'rgba(244,114,182,0.1)',
  },
  shell: {
    width: '100%',
    maxWidth: 1220,
    alignSelf: 'center',
    gap: 18,
  },
  headerChrome: {
    borderRadius: 28,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.78)',
    paddingHorizontal: 18,
    paddingVertical: 16,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    shadowColor: '#4338CA',
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.14,
    shadowRadius: 34,
    elevation: 12,
  },
  headerChromeMobile: {
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: 24,
  },
  brandLink: {
    flexShrink: 1,
  },
  brandWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  brandMeta: {
    gap: 2,
    maxWidth: 360,
  },
  brandTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#0F172A',
  },
  brandTitleMobile: {
    fontSize: 18,
  },
  brandKicker: {
    fontSize: 12,
    letterSpacing: 2,
    color: '#6366F1',
    fontFamily: 'SpaceMono',
  },
  brandSubcopy: {
    color: '#475569',
    fontSize: 13,
    lineHeight: 20,
  },
  nav: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    gap: 10,
  },
  navCompact: {
    justifyContent: 'flex-start',
  },
  navMobile: {
    gap: 8,
  },
  navLink: {
    minHeight: 42,
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.48)',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.24)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  navLinkMobile: {
    minHeight: 36,
    paddingHorizontal: 11,
    paddingVertical: 8,
  },
  navLinkActive: {
    backgroundColor: '#101A3A',
    borderColor: '#101A3A',
  },
  navLabel: {
    fontSize: 14,
    color: '#1E293B',
    fontWeight: '800',
  },
  navLabelMobile: {
    fontSize: 12,
  },
  navLabelActive: {
    color: '#F8FAFC',
  },
  accountLink: {
    minHeight: 40,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#0F172A',
  },
  accountLinkActive: {
    backgroundColor: '#5B63FF',
    borderColor: '#5B63FF',
  },
  accountLabel: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  accountLabelActive: {
    color: '#FFFFFF',
  },
  heroShell: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 18,
  },
  heroShellCompact: {
    flexDirection: 'column',
  },
  heroPanel: {
    flex: 1,
    marginTop: 28,
    padding: 28,
    borderRadius: 34,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.72)',
    shadowColor: '#312E81',
    shadowOffset: { width: 0, height: 24 },
    shadowOpacity: 0.16,
    shadowRadius: 34,
    elevation: 14,
  },
  hero: {
    marginTop: 28,
    padding: 28,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.72)',
    shadowColor: '#312E81',
    shadowOffset: { width: 0, height: 24 },
    shadowOpacity: 0.16,
    shadowRadius: 34,
    elevation: 14,
  },
  heroPanelCompact: {
    padding: 24,
  },
  heroPanelHeader: {
    gap: 14,
    marginBottom: 16,
  },
  heroDot: {
    color: '#EF4444',
    fontFamily: 'SpaceMono',
    fontSize: 12,
    letterSpacing: 1.6,
  },
  heroSignalRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  signalChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(15,23,42,0.06)',
  },
  signalLabel: {
    fontSize: 11,
    color: '#334155',
    fontFamily: 'SpaceMono',
  },
  eyebrow: {
    fontSize: 12,
    letterSpacing: 2.2,
    color: '#4F46E5',
    fontFamily: 'SpaceMono',
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  title: {
    fontSize: 54,
    lineHeight: 58,
    fontWeight: '900',
    color: '#0F172A',
    maxWidth: 720,
  },
  titleCompact: {
    fontSize: 42,
    lineHeight: 46,
  },
  description: {
    marginTop: 18,
    fontSize: 19,
    lineHeight: 31,
    color: '#475569',
    maxWidth: 700,
  },
  descriptionMobile: {
    fontSize: 16,
    lineHeight: 26,
    marginTop: 14,
  },
  actions: {
    marginTop: 28,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  actionsMobile: {
    gap: 10,
  },
  actionButton: {
    minHeight: 52,
    borderRadius: 18,
    paddingHorizontal: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionButtonMobile: {
    minHeight: 46,
    paddingHorizontal: 14,
    flexGrow: 1,
  },
  actionPrimary: {
    backgroundColor: '#5B63FF',
    borderColor: '#5B63FF',
    shadowColor: '#5B63FF',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.22,
    shadowRadius: 18,
    elevation: 8,
  },
  actionSecondary: {
    backgroundColor: 'rgba(255,255,255,0.62)',
    borderColor: '#D6DAFF',
  },
  actionLabel: {
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0.2,
  },
  actionPrimaryLabel: {
    color: '#FFFFFF',
  },
  actionSecondaryLabel: {
    color: '#101A3A',
  },
  heroVisual: {
    width: 420,
    maxWidth: '100%',
  },
  heroVisualCompact: {
    width: '100%',
  },
  heroVisualMobile: {
    marginTop: -2,
  },
  body: {
    gap: 18,
  },
  card: {
    padding: 22,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.74)',
    shadowColor: '#312E81',
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.09,
    shadowRadius: 26,
    elevation: 10,
  },
  cardTitle: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '900',
    color: '#0F172A',
  },
  cardDescription: {
    marginTop: 12,
    fontSize: 15,
    lineHeight: 24,
    color: '#475569',
  },
  footerShell: {
    marginTop: 8,
    borderRadius: 28,
    padding: 22,
    gap: 14,
  },
  footerShellMobile: {
    padding: 18,
  },
  footerRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 14,
  },
  footerRowMobile: {
    flexDirection: 'column',
    alignItems: 'flex-start',
  },
  footerStamp: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  footerStampText: {
    color: '#C7D2FE',
    fontFamily: 'SpaceMono',
    fontSize: 11,
    letterSpacing: 1.8,
  },
  footerNote: {
    flex: 1,
    minWidth: 220,
    color: '#CBD5E1',
    fontSize: 14,
    lineHeight: 22,
  },
  footerText: {
    color: '#F8FAFC',
    fontSize: 12,
  },
});
