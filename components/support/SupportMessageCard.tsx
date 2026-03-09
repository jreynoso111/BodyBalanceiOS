import React, { useState } from 'react';
import { Alert, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';

import { Card, Text } from '@/components/Themed';
import { supabase } from '@/services/supabase';
import { useAuthStore } from '@/store/authStore';

type SupportMessageCardProps = {
  title?: string;
  description?: string;
  signedOutTitle?: string;
  signedOutDescription?: string;
};

export function SupportMessageCard({
  title = 'Send an in-app support message',
  description = 'Include what happened, what account or contact was involved, and what result you expected.',
  signedOutTitle = 'Account-specific help lives in-app',
  signedOutDescription = 'Sign in to send a support message tied to your account history, contacts, and shared records.',
}: SupportMessageCardProps) {
  const { user } = useAuthStore();
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  const submitSupportMessage = async () => {
    if (!user?.id) {
      Alert.alert('Sign in required', 'You need to be signed in to contact support.');
      return;
    }

    const trimmedMessage = message.trim();
    if (!trimmedMessage) {
      Alert.alert('Message required', 'Write a short message so support knows what you need.');
      return;
    }

    setSending(true);
    const { error } = await supabase.from('support_messages').insert([
      {
        user_id: user.id,
        channel: 'in_app',
        subject: subject.trim() || null,
        message: trimmedMessage,
        status: 'open',
      },
    ]);
    setSending(false);

    if (error) {
      Alert.alert('Could not send', error.message);
      return;
    }

    setSubject('');
    setMessage('');
    Alert.alert('Message sent', 'Your support message was saved for admin review.');
  };

  return (
    <Card style={styles.card}>
      <Text style={styles.title}>{user?.id ? title : signedOutTitle}</Text>
      <Text style={styles.description}>{user?.id ? description : signedOutDescription}</Text>

      {user?.id ? (
        <View>
          <TextInput
            value={subject}
            onChangeText={setSubject}
            placeholder="Subject (optional)"
            placeholderTextColor="#94A3B8"
            style={styles.input}
          />
          <TextInput
            value={message}
            onChangeText={setMessage}
            placeholder="Describe what happened, what account or contact was involved, and what you expected..."
            placeholderTextColor="#94A3B8"
            style={[styles.input, styles.textarea]}
            multiline
            textAlignVertical="top"
          />
          <TouchableOpacity style={styles.sendButton} onPress={() => void submitSupportMessage()} disabled={sending}>
            <Text style={styles.sendButtonText}>{sending ? 'Sending...' : 'Send to support'}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.signedOutBadge}>
          <Text style={styles.signedOutBadgeText}>Sign in from the app or web account view to open a tracked support request.</Text>
        </View>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 18,
  },
  title: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0F172A',
    marginBottom: 6,
  },
  description: {
    fontSize: 13,
    lineHeight: 19,
    color: '#64748B',
    marginBottom: 14,
  },
  input: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: '#0F172A',
    marginBottom: 12,
  },
  textarea: {
    minHeight: 120,
  },
  sendButton: {
    minHeight: 48,
    borderRadius: 14,
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  signedOutBadge: {
    padding: 14,
    borderRadius: 16,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  signedOutBadgeText: {
    fontSize: 13,
    lineHeight: 20,
    color: '#475569',
  },
});
