import React from 'react';
import { Platform, ScrollView, StyleSheet, View } from 'react-native';
import { Stack, type Href } from 'expo-router';
import { Screen, Card, Text } from '@/components/Themed';
import { LinearGradient } from 'expo-linear-gradient';
import { PublicSiteLayout } from '@/components/website/PublicSiteLayout';

const SECTIONS = [
  {
    title: 'What we store',
    body:
      'Buddy Balance stores the information you intentionally provide to operate the service, including account details, contacts, records, payment history, item return history, support messages, preferences, and related metadata needed to show balances and shared activity.',
  },
  {
    title: 'What other participants can see',
    body:
      'When you interact with another connected account, the app can create shared events, confirmations, notifications, or activity records so both sides can see what changed. This shared data is part of the product experience and may be visible to the people involved in that record or request.',
  },
  {
    title: 'How the app uses that data',
    body:
      'We use account and record data to authenticate you, render balances, keep contact history accurate, power notifications, support Premium and admin experiences, respond to support requests, and improve reliability of the product.',
  },
  {
    title: 'Premium, admin, and support context',
    body:
      'If your account has Premium access, the app may enable additional features such as exports and Premium labeling in the interface. If your account has admin privileges, admin tools can expose broader operational data required to review users, requests, and support communications.',
  },
  {
    title: 'Security and infrastructure',
    body:
      'We apply reasonable technical and organizational measures to protect data in the app. No internet-connected system is perfectly secure, so we cannot promise absolute security, but we do design the product to limit accidental loss, corruption, and unauthorized access where practical.',
  },
  {
    title: 'Third-party services',
    body:
      'The app relies on infrastructure providers to authenticate users, store application data, and deliver connected product behavior. Those providers process data only as needed to operate the service on our behalf.',
  },
  {
    title: 'Retention and deletion',
    body:
      'We retain data for as long as it is needed to operate the service, satisfy support or audit needs, and maintain shared record history. If you need your account reviewed for deletion, use the in-app support form so the request can be verified and processed.',
  },
  {
    title: 'Policy changes',
    body:
      'We may update this Privacy Policy as the product evolves. Continued use of Buddy Balance after an update means the revised policy applies from that point forward.',
  },
] as const;

const HIGHLIGHTS = [
  'Your account data is stored so the app can authenticate you and render balances correctly.',
  'Shared records and event history can be visible to the other person involved in that relationship.',
  'Buddy Balance is not a payment processor; it is a tracking and coordination product.',
] as const;

export default function PrivacyPolicyScreen() {
  if (Platform.OS === 'web') {
    return (
      <PublicSiteLayout
        eyebrow="Support / Privacy"
        title="Privacy is the policy branch of the Buddy Balance support section."
        description="Buddy Balance is built around shared activity between connected people, so this policy explains both the personal data you provide and the event history that can become visible to other participants."
        actions={[
          { href: '/help-support', label: 'Back to Support' },
          { href: '/contact' as Href, label: 'Contact support', variant: 'secondary' },
        ]}
      >
        <LinearGradient colors={['rgba(255,255,255,0.94)', 'rgba(255,255,255,0.74)']} style={styles.summaryPanel}>
          <Text style={styles.summaryLabel}>AT A GLANCE</Text>
          <View style={styles.summaryList}>
            {HIGHLIGHTS.map((item) => (
              <View key={item} style={styles.summaryRow}>
                <View style={styles.summaryDot} />
                <Text style={styles.summaryText}>{item}</Text>
              </View>
            ))}
          </View>
        </LinearGradient>

        <View style={styles.articleStack}>
          {SECTIONS.map((section, index) => (
            <View key={section.title} style={styles.articleRow}>
              <Text style={styles.articleIndex}>{String(index + 1).padStart(2, '0')}</Text>
              <View style={styles.articleCopy}>
                <Text style={styles.articleTitle}>{section.title}</Text>
                <Text style={styles.articleBody}>{section.body}</Text>
              </View>
            </View>
          ))}
        </View>
      </PublicSiteLayout>
    );
  }

  return (
    <Screen style={styles.container}>
      <Stack.Screen options={{ title: 'Privacy Policy' }} />
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Card style={styles.introCard}>
          <Text style={styles.introTitle}>Privacy overview</Text>
          <Text style={styles.introText}>
            Buddy Balance is built around shared record tracking, so privacy depends both on your own account data
            and on the events you intentionally create with connected people.
          </Text>
        </Card>

        {SECTIONS.map((section) => (
          <Card key={section.title} style={styles.sectionCard}>
            <Text style={styles.heading}>{section.title}</Text>
            <Text style={styles.content}>{section.body}</Text>
          </Card>
        ))}
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
  introCard: {
    padding: 20,
    marginBottom: 16,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  introTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#1D4ED8',
    marginBottom: 8,
  },
  introText: {
    fontSize: 14,
    lineHeight: 21,
    color: '#1E3A8A',
  },
  sectionCard: {
    padding: 18,
    marginBottom: 12,
  },
  summaryPanel: {
    padding: 22,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.72)',
  },
  summaryLabel: {
    color: '#4F46E5',
    fontFamily: 'SpaceMono',
    fontSize: 11,
    letterSpacing: 1.6,
  },
  summaryList: {
    marginTop: 14,
    gap: 10,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  summaryDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    backgroundColor: '#5B63FF',
    marginTop: 8,
  },
  summaryText: {
    flex: 1,
    fontSize: 15,
    lineHeight: 24,
    color: '#334155',
  },
  articleStack: {
    gap: 18,
  },
  articleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 16,
    paddingTop: 18,
    borderTopWidth: 1,
    borderTopColor: 'rgba(148,163,184,0.18)',
  },
  articleIndex: {
    width: 32,
    color: '#94A3B8',
    fontFamily: 'SpaceMono',
    fontSize: 12,
    marginTop: 4,
  },
  articleCopy: {
    flex: 1,
  },
  articleTitle: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '900',
    color: '#0F172A',
  },
  articleBody: {
    marginTop: 8,
    fontSize: 15,
    lineHeight: 25,
    color: '#475569',
  },
  heading: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 8,
  },
  content: {
    fontSize: 14,
    lineHeight: 22,
    color: '#334155',
  },
});
