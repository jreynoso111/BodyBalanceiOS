import React from 'react';
import { Platform, ScrollView, StyleSheet, View } from 'react-native';
import { Stack, type Href } from 'expo-router';
import { Screen, Card, Text } from '@/components/Themed';
import { PublicSiteLayout } from '@/components/website/PublicSiteLayout';

const FAQ_ITEMS = [
  {
    question: 'How do I create a new record?',
    answer:
      'You can create a new record from the Home screen using the main "+" action, or directly from an expanded contact card using "Add record". Choose whether it is a money or item record, then save the amount, owner direction, and any due date details.',
  },
  {
    question: 'What is the difference between "they owe you" and "you owe"?',
    answer:
      'These values reflect direction. "They owe you" means you lent money or an item. "You owe" means the other person lent it to you. Open Balance summarizes the net position across your active records.',
  },
  {
    question: 'What happens when the balance is zero?',
    answer:
      'A zero balance is treated as neutral. The app should not present that state as "you lent more" or "you owe more" because neither side is ahead when the balance is fully settled.',
  },
  {
    question: 'How do I add a payment or mark an item as returned?',
    answer:
      'Open the record details screen and use "Add payment" for money records or the return action for item records. These actions update the balance while preserving the history so both users can understand what happened over time.',
  },
  {
    question: 'What does "Adjust total" do?',
    answer:
      'Adjust total changes the original record amount without deleting payments that were already logged. In shared scenarios this can become a suggested change that the other side reviews, so the timeline stays auditable instead of silently rewriting history.',
  },
  {
    question: 'When does the other user need to approve something?',
    answer:
      'Approvals are used for workflows that can materially change a shared state, such as some confirmations or suggested updates. Other actions can be sent as informational events only, so the other user is notified without being asked to approve.',
  },
  {
    question: 'Why did the other person get a notification but no approval request?',
    answer:
      'Some shared actions are intentionally informational. For example, when a connected friend account is involved, the system can create an event so the other user sees that the record activity happened, but the event is not treated as a pending confirmation.',
  },
  {
    question: 'How do I manage contacts faster?',
    answer:
      'Go to Contacts and tap a row to expand it. From there you can review recent activity, inspect open records, edit the contact, and create a new record tied to that contact without selecting them again.',
  },
  {
    question: 'What do the notifications counts mean in admin tools?',
    answer:
      'Admin counters are shortcuts into the underlying queues. Pending confirmations, friend requests, and total records can be opened as filtered admin views so you can inspect the actual items instead of just seeing the counts.',
  },
  {
    question: 'What does Premium change?',
    answer:
      'Premium unlocks premium-only capabilities such as export and broader record management benefits. When the active account is Premium, the app can show that plan status in the header and in Settings.',
  },
  {
    question: 'Can I export my records?',
    answer:
      'Yes. Premium users can go to Settings and use "Export Data (CSV)" to download records, payments, and related contact data.',
  },
  {
    question: 'Does Buddy Balance move real money?',
    answer:
      'No. The app is a ledger, reminder, and shared history tool. Real payments and item handoffs happen outside the app and are then recorded here for tracking.',
  },
] as const;

export default function FAQScreen() {
  if (Platform.OS === 'web') {
    return (
      <PublicSiteLayout
        eyebrow="Support / FAQ"
        title="FAQ is the fast-answer branch of the Buddy Balance support section."
        description="These answers reflect the current product behavior around records, contacts, notifications, shared history, Premium, and account support."
        actions={[
          { href: '/help-support', label: 'Back to Support' },
          { href: '/contact' as Href, label: 'Contact support', variant: 'secondary' },
        ]}
      >
        <View style={styles.webFaqList}>
          {FAQ_ITEMS.map((item, index) => (
            <View key={item.question} style={[styles.webFaqRow, index === 0 && styles.webFaqRowFirst]}>
              <Text style={styles.webFaqQuestion}>{item.question}</Text>
              <Text style={styles.webFaqAnswer}>{item.answer}</Text>
            </View>
          ))}
        </View>
      </PublicSiteLayout>
    );
  }

  return (
    <Screen style={styles.container}>
      <Stack.Screen options={{ title: 'Frequently Asked Questions' }} />
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Card style={styles.introCard}>
          <Text style={styles.introTitle}>Current FAQ</Text>
          <Text style={styles.introText}>
            These answers reflect the current behavior of contacts, shared records, notifications, Premium,
            and admin review flows in the app today.
          </Text>
        </Card>

        {FAQ_ITEMS.map((item) => (
          <Card key={item.question} style={styles.faqCard}>
            <Text style={styles.question}>{item.question}</Text>
            <Text style={styles.answer}>{item.answer}</Text>
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
    backgroundColor: '#EEF2FF',
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  introTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#312E81',
    marginBottom: 8,
  },
  introText: {
    fontSize: 14,
    lineHeight: 21,
    color: '#4338CA',
  },
  faqCard: {
    padding: 18,
    marginBottom: 12,
  },
  webFaqList: {
    borderRadius: 26,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.16)',
    backgroundColor: 'rgba(255,255,255,0.78)',
  },
  webFaqRow: {
    padding: 22,
    borderTopWidth: 1,
    borderTopColor: 'rgba(148,163,184,0.14)',
  },
  webFaqRowFirst: {
    borderTopWidth: 0,
  },
  webFaqQuestion: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '900',
    color: '#0F172A',
  },
  webFaqAnswer: {
    marginTop: 10,
    fontSize: 15,
    lineHeight: 25,
    color: '#475569',
  },
  question: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 8,
  },
  answer: {
    fontSize: 14,
    lineHeight: 22,
    color: '#475569',
  },
});
