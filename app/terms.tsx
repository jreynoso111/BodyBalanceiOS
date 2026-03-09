import React from 'react';
import { Platform, ScrollView, StyleSheet, View } from 'react-native';
import { Stack, type Href } from 'expo-router';
import { Screen, Card, Text } from '@/components/Themed';
import { LinearGradient } from 'expo-linear-gradient';
import { PublicSiteLayout } from '@/components/website/PublicSiteLayout';

const SECTIONS = [
  {
    title: 'Using the app means you accept these terms',
    body:
      'By creating an account, signing in, or using Buddy Balance, you agree to these Terms of Service. If you do not agree, do not use the application.',
  },
  {
    title: 'What Buddy Balance is',
    body:
      'Buddy Balance is a record-keeping and coordination tool for money loans, item loans, payments, returns, friend connections, and related shared activity. The app does not transfer funds, enforce debts, or act as a bank, escrow service, or legal collection platform.',
  },
  {
    title: 'Your responsibility',
    body:
      'You are responsible for the accuracy of the information you enter, the people you connect with, and any actions you take based on the records shown in the app. You remain solely responsible for real-world agreements, collections, returns, and disputes outside the product.',
  },
  {
    title: 'Shared records and confirmations',
    body:
      'Some actions can create shared events, notifications, requests, or confirmations for another user. You agree to use those flows honestly and not to misrepresent balances, payments, item returns, or record ownership.',
  },
  {
    title: 'Premium and admin features',
    body:
      'Certain capabilities may be limited to Premium users or administrator accounts. Premium access can enable additional management features, while admin access is intended only for platform operations, review, and support handling.',
  },
  {
    title: 'What is not allowed',
    body:
      'You may not use the app for unlawful activity, fraud, harassment, abuse of other users, or tracking illicit transactions. We may restrict or remove access if the service is used in ways that threaten the platform or other users.',
  },
  {
    title: 'Availability and product changes',
    body:
      'We may update, improve, limit, suspend, or remove parts of the service at any time. Features, interfaces, notifications, and plan benefits can change as the product evolves.',
  },
  {
    title: 'Limits of responsibility',
    body:
      'Buddy Balance is provided as a tool to help users track shared obligations and history. We are not liable for personal, financial, or legal consequences arising from off-platform arrangements, incorrect entries, or reliance on information entered by users.',
  },
  {
    title: 'Account suspension or termination',
    body:
      'We may suspend or terminate accounts that violate these terms, create risk for the service, or misuse shared workflows. You may also stop using the app at any time.',
  },
  {
    title: 'Updates to these terms',
    body:
      'We may revise these terms from time to time. Continued use of the app after an update means you accept the revised terms.',
  },
] as const;

const HIGHLIGHTS = [
  'Buddy Balance is a tracking tool, not a bank, escrow service, or debt collector.',
  'Users remain responsible for the real-world agreements behind every record.',
  'Platform access can be limited if the app is used dishonestly or abusively.',
] as const;

export default function TermsOfServiceScreen() {
  if (Platform.OS === 'web') {
    return (
      <PublicSiteLayout
        eyebrow="Support / Terms"
        title="Terms is the rules-and-limits branch of the Buddy Balance support section."
        description="Buddy Balance is a shared tracking tool. It helps people record loans, payments, returns, and related activity, but it does not replace the real-world responsibility between the people involved."
        actions={[
          { href: '/help-support', label: 'Back to Support' },
          { href: '/contact' as Href, label: 'Contact support', variant: 'secondary' },
        ]}
      >
        <LinearGradient colors={['rgba(255,255,255,0.94)', 'rgba(255,255,255,0.74)']} style={styles.summaryPanel}>
          <Text style={styles.summaryLabel}>THE SHORT VERSION</Text>
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
      <Stack.Screen options={{ title: 'Terms of Service' }} />
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Card style={styles.introCard}>
          <Text style={styles.introTitle}>Terms overview</Text>
          <Text style={styles.introText}>
            Buddy Balance is a tracking and coordination product. It records what users say happened; it does not
            replace the real-world responsibility between the people involved.
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
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FED7AA',
  },
  introTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#C2410C',
    marginBottom: 8,
  },
  introText: {
    fontSize: 14,
    lineHeight: 21,
    color: '#9A3412',
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
    color: '#5B63FF',
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
