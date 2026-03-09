import React from 'react';
import { Platform, ScrollView, StyleSheet, View } from 'react-native';
import { Stack } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';

import { Screen, Text } from '@/components/Themed';
import { AppLegalFooter } from '@/components/AppLegalFooter';
import { SupportMessageCard } from '@/components/support/SupportMessageCard';
import { PublicSiteLayout } from '@/components/website/PublicSiteLayout';

const CONTACT_LANES = [
  {
    title: 'Account or record issue',
    body: 'If the question depends on your own contacts, records, notifications, or friend-linked activity, the right support path is the tracked in-app message flow after sign-in.',
  },
  {
    title: 'General product question',
    body: 'If you are trying to understand how Buddy Balance works before using it, start with FAQ and the public support pages instead of opening a case tied to an account.',
  },
  {
    title: 'Policy or store-review context',
    body: 'Privacy and Terms stay public on the website so app-store reviewers, launch visitors, and users can reach one stable source of truth.',
  },
] as const;

export default function ContactScreen() {
  if (Platform.OS === 'web') {
    return (
      <PublicSiteLayout
        eyebrow="Support / Contact"
        title="Contact is the lane for real account help, not generic marketing copy."
        description="Use this page when you need to know where a request belongs. Buddy Balance keeps product questions, account issues, and policy pages separated so support stays clean and auditable."
        actions={[
          { href: '/help-support', label: 'Back to Support' },
          { href: '/faq', label: 'Open FAQ', variant: 'secondary' },
        ]}
      >
        <LinearGradient colors={['rgba(255,255,255,0.94)', 'rgba(255,255,255,0.74)']} style={styles.webPanel}>
          <Text style={styles.webLabel}>CONTACT LANES</Text>
          <View style={styles.webLaneList}>
            {CONTACT_LANES.map((lane) => (
              <View key={lane.title} style={styles.webLaneItem}>
                <Text style={styles.webLaneTitle}>{lane.title}</Text>
                <Text style={styles.webLaneBody}>{lane.body}</Text>
              </View>
            ))}
          </View>
        </LinearGradient>

        <SupportMessageCard
          title="Open a tracked support request"
          description="Write what happened, which record or contact was involved, and what result you expected. The request will be saved for admin follow-up."
          signedOutTitle="Public contact starts with direction, not a blind inbox"
          signedOutDescription="Sign in if the request depends on your account. Public pages stay available for launch visitors, but account support should remain attached to the right user history."
        />
      </PublicSiteLayout>
    );
  }

  return (
    <Screen style={styles.container}>
      <Stack.Screen options={{ title: 'Contact Support' }} />
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <SupportMessageCard
          title="Contact support"
          description="Use this form for account issues, record mismatches, confirmation problems, or help that depends on your own activity."
        />
        <AppLegalFooter style={styles.footer} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingTop: 120,
    paddingBottom: 40,
  },
  webPanel: {
    padding: 22,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.72)',
  },
  webLabel: {
    color: '#5B63FF',
    fontFamily: 'SpaceMono',
    fontSize: 11,
    letterSpacing: 1.6,
  },
  webLaneList: {
    marginTop: 16,
    gap: 14,
  },
  webLaneItem: {
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: 'rgba(148,163,184,0.18)',
  },
  webLaneTitle: {
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '900',
    color: '#0F172A',
  },
  webLaneBody: {
    marginTop: 8,
    fontSize: 15,
    lineHeight: 24,
    color: '#475569',
  },
  footer: {
    fontSize: 12,
    textAlign: 'center',
    color: '#94A3B8',
    marginTop: 18,
  },
});
