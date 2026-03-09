import React from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';

import { Card, Screen, Text } from '@/components/Themed';

type HelpSection = {
  title: string;
  intro: string;
  bullets: string[];
};

const HELP_SECTIONS: Record<string, HelpSection> = {
  'notifications-confirmations': {
    title: 'Notifications and Confirmations',
    intro:
      'Buddy Balance uses both informational notifications and approval-based confirmations. They are related, but they do not mean the same thing.',
    bullets: [
      'A confirmation is used when the other user needs to review and accept a shared action before it should count as fully approved.',
      'An informational notification is used when the app only needs to tell the other person that something happened, without asking for approval.',
      'Friend requests and certain shared updates can appear in confirmation queues.',
      'Some shared record events can notify the other user immediately without creating a pending approval task.',
      'Admin tools can open the underlying queues so an administrator can inspect the actual requests behind the counters.',
    ],
  },
  'contacts-shared-history': {
    title: 'Contacts and Shared History',
    intro:
      'The Contacts screen is designed as a working view, not just a static address book. Expanding a contact gives you direct actions and recent context.',
    bullets: [
      'Tap a contact row to expand its card and reveal the contact snapshot, open records, and recent activity.',
      'Use "Edit contact" to update the saved details for that person.',
      'Use "Add record" from the expanded card to create a new record with that contact already selected.',
      'Shared history helps you review what has happened with that contact without leaving the contact flow.',
      'This view is meant to reduce extra taps when you already know which person the new record belongs to.',
    ],
  },
  'admin-tools': {
    title: 'Admin Tools',
    intro:
      'Administrator tools are for platform review and operational follow-up. They are separate from standard user features.',
    bullets: [
      'Admin screens can expose user lists, confirmation queues, friend request queues, support messages, and platform records.',
      'Count cards in the admin dashboard should lead to the underlying filtered lists, so admins can inspect the real items behind each count.',
      'These tools are intended for operational review, moderation, and support handling.',
      'Admin features are role-based. They are not general help content for standard users and should stay separated from normal account actions.',
      'If a support message is submitted from the app, it is stored so an administrator can review it from the admin side.',
    ],
  },
};

const FALLBACK_SECTION: HelpSection = {
  title: 'Help',
  intro: 'This help page is not available.',
  bullets: ['Return to Help & Support and choose one of the available sections.'],
};

export default function HelpDetailScreen() {
  const { slug } = useLocalSearchParams<{ slug?: string }>();
  const section = (slug && HELP_SECTIONS[slug]) || FALLBACK_SECTION;

  return (
    <Screen style={styles.container}>
      <Stack.Screen options={{ title: section.title }} />
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Card style={styles.heroCard}>
          <Text style={styles.heroTitle}>{section.title}</Text>
          <Text style={styles.heroText}>{section.intro}</Text>
        </Card>

        <Card style={styles.bodyCard}>
          {section.bullets.map((bullet) => (
            <Text key={bullet} style={styles.bullet}>
              {`\u2022 ${bullet}`}
            </Text>
          ))}
        </Card>
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
  heroCard: {
    padding: 20,
    marginBottom: 16,
    backgroundColor: '#EEF2FF',
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  heroTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#1E1B4B',
    marginBottom: 8,
  },
  heroText: {
    fontSize: 14,
    lineHeight: 21,
    color: '#4338CA',
  },
  bodyCard: {
    padding: 18,
  },
  bullet: {
    fontSize: 14,
    lineHeight: 22,
    color: '#334155',
    marginBottom: 12,
  },
});
