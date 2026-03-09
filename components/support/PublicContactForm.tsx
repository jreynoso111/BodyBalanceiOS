import React, { useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';

import { Text } from '@/components/Themed';
import { supabase } from '@/services/supabase';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type FormState = {
  name: string;
  email: string;
  subject: string;
  message: string;
  website: string;
};

const INITIAL_FORM: FormState = {
  name: '',
  email: '',
  subject: '',
  message: '',
  website: '',
};

export function PublicContactForm() {
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const updateField = (field: keyof FormState, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const submit = async () => {
    const name = form.name.trim();
    const email = form.email.trim().toLowerCase();
    const subject = form.subject.trim();
    const message = form.message.trim();

    setError('');
    setSuccess('');

    if (!name || !email || !message) {
      setError('Name, email, and message are required.');
      return;
    }

    if (!EMAIL_PATTERN.test(email)) {
      setError('Enter a valid email address.');
      return;
    }

    if (message.length < 12) {
      setError('Write a little more detail so the message is useful.');
      return;
    }

    setLoading(true);
    const { error: invokeError } = await supabase.functions.invoke('public-contact', {
      body: {
        name,
        email,
        subject,
        message,
        website: form.website,
        source: Platform.OS === 'web' && typeof window !== 'undefined' ? window.location.href : 'app',
      },
    });
    setLoading(false);

    if (invokeError) {
      setError(invokeError.message || 'Could not send your message right now.');
      return;
    }

    setForm(INITIAL_FORM);
    setSuccess('Message sent. Buddy Balance support will receive it by email.');
  };

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Contact Buddy Balance</Text>
      <Text style={styles.description}>
        This public form sends a real email to support. Use it for launch questions, partnership requests, or general website contact.
      </Text>

      <View style={styles.row}>
        <TextInput
          value={form.name}
          onChangeText={(value) => updateField('name', value)}
          placeholder="Your name"
          placeholderTextColor="#94A3B8"
          style={[styles.input, styles.halfInput]}
        />
        <TextInput
          value={form.email}
          onChangeText={(value) => updateField('email', value)}
          placeholder="your@email.com"
          placeholderTextColor="#94A3B8"
          autoCapitalize="none"
          keyboardType="email-address"
          style={[styles.input, styles.halfInput]}
        />
      </View>

      <TextInput
        value={form.subject}
        onChangeText={(value) => updateField('subject', value)}
        placeholder="Subject (optional)"
        placeholderTextColor="#94A3B8"
        style={styles.input}
      />

      <TextInput
        value={form.message}
        onChangeText={(value) => updateField('message', value)}
        placeholder="Tell us what you need, what page you were on, and how we can reach you."
        placeholderTextColor="#94A3B8"
        multiline
        textAlignVertical="top"
        style={[styles.input, styles.textarea]}
      />

      <TextInput
        value={form.website}
        onChangeText={(value) => updateField('website', value)}
        placeholder="Website"
        placeholderTextColor="#94A3B8"
        style={styles.honeypot}
        autoCapitalize="none"
      />

      {error ? <Text style={styles.errorText}>{error}</Text> : null}
      {success ? <Text style={styles.successText}>{success}</Text> : null}

      <TouchableOpacity style={[styles.button, loading && styles.buttonDisabled]} disabled={loading} onPress={() => void submit()}>
        {loading ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={styles.buttonText}>Send message</Text>}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 22,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.74)',
    backgroundColor: 'rgba(255,255,255,0.9)',
    shadowColor: '#312E81',
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.09,
    shadowRadius: 26,
    elevation: 10,
  },
  title: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '900',
    color: '#0F172A',
  },
  description: {
    marginTop: 10,
    marginBottom: 18,
    fontSize: 15,
    lineHeight: 24,
    color: '#475569',
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  input: {
    minHeight: 52,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#D6DAFF',
    backgroundColor: '#F8FAFC',
    fontSize: 14,
    color: '#0F172A',
    marginBottom: 12,
  },
  halfInput: {
    flexGrow: 1,
    minWidth: 220,
  },
  textarea: {
    minHeight: 148,
  },
  honeypot: {
    position: 'absolute',
    left: -10000,
    top: 'auto',
    width: 1,
    height: 1,
    opacity: 0,
  },
  button: {
    minHeight: 50,
    borderRadius: 16,
    backgroundColor: '#5B63FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonDisabled: {
    opacity: 0.75,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
  },
  errorText: {
    marginBottom: 12,
    color: '#DC2626',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
  },
  successText: {
    marginBottom: 12,
    color: '#16A34A',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
  },
});
