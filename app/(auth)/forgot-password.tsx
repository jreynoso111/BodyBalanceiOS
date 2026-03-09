import React, { useState } from 'react';
import { StyleSheet, TextInput, TouchableOpacity, Alert, KeyboardAvoidingView, Platform, View as RNView } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import * as Linking from 'expo-linking';
import { Mail, ArrowLeft } from 'lucide-react-native';

import { Text, Screen, Card } from '@/components/Themed';
import { supabase } from '@/services/supabase';
import { WebAuthLayout } from '@/components/website/WebAuthLayout';

type FeedbackTone = 'error' | 'success' | 'info';

export default function ForgotPasswordScreen() {
    const router = useRouter();
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [feedback, setFeedback] = useState<{ tone: FeedbackTone; text: string } | null>(null);

    const showMessage = (title: string, message: string, tone: FeedbackTone) => {
        setFeedback({ tone, text: message });
        if (Platform.OS !== 'web') {
            Alert.alert(title, message);
        }
    };

    const onSendResetEmail = async () => {
        const normalizedEmail = email.trim().toLowerCase();
        if (!normalizedEmail) {
            showMessage('Error', 'Please enter your email.', 'error');
            return;
        }

        try {
            setLoading(true);
            setFeedback(null);
            const redirectTo = Linking.createURL('/reset-password');
            const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, { redirectTo });

            if (error) {
                showMessage('Error', 'Could not send the recovery email.', 'error');
                return;
            }

            showMessage(
                'Email sent',
                'Check your inbox and open the link to reset your password.',
                'success'
            );
        } finally {
            setLoading(false);
        }
    };

    const form = (
        <Card style={styles.card}>
            <Text style={styles.title}>Reset password</Text>
            <Text style={styles.subtitle}>
                We will send a link to reset your password.
            </Text>

            <RNView style={styles.inputGroup}>
                <Text style={styles.label}>Email</Text>
                <RNView style={styles.inputWrapper}>
                    <Mail size={18} color="#94A3B8" style={styles.inputIcon} />
                    <TextInput
                        placeholder="name@email.com"
                        placeholderTextColor="#94A3B8"
                        value={email}
                        onChangeText={setEmail}
                        autoCapitalize="none"
                        keyboardType="email-address"
                        style={styles.input}
                    />
                </RNView>
            </RNView>

            <TouchableOpacity
                onPress={onSendResetEmail}
                disabled={loading}
                style={[styles.primaryButton, loading && { opacity: 0.7 }]}
            >
                <Text style={styles.buttonText}>{loading ? 'SENDING...' : 'Send link'}</Text>
            </TouchableOpacity>

            {feedback ? (
                <RNView
                    style={[
                        styles.feedbackBox,
                        feedback.tone === 'error' && styles.feedbackError,
                        feedback.tone === 'success' && styles.feedbackSuccess,
                        feedback.tone === 'info' && styles.feedbackInfo,
                    ]}
                >
                    <Text
                        style={[
                            styles.feedbackText,
                            feedback.tone === 'error' && styles.feedbackTextError,
                            feedback.tone === 'success' && styles.feedbackTextSuccess,
                            feedback.tone === 'info' && styles.feedbackTextInfo,
                        ]}
                    >
                        {feedback.text}
                    </Text>
                </RNView>
            ) : null}
        </Card>
    );

    return (
        <Screen style={styles.container}>
            <Stack.Screen options={{ headerShown: false }} />
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={{ flex: 1 }}
            >
                {Platform.OS === 'web' ? (
                    <WebAuthLayout
                        eyebrow="Password recovery"
                        title="Recover your Buddy Balance account without leaving the browser."
                        description="Use the same password reset flow as the app. A secure recovery link will be sent to the email address tied to your account."
                        highlights={[
                            'Same account as mobile',
                            'Secure email reset flow',
                            'Works with your new branded sender',
                            'Access restored to web and app',
                        ]}
                        altAction={{ href: '/(auth)/login', label: 'Back to sign in' }}
                    >
                        <RNView style={styles.webIntro}>
                            <Text style={styles.webTitle}>Forgot your password?</Text>
                            <Text style={styles.webBody}>
                                Enter the email you use for Buddy Balance and we will send a recovery link.
                            </Text>
                        </RNView>
                        {form}
                    </WebAuthLayout>
                ) : (
                <RNView style={styles.content}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                        <ArrowLeft size={20} color="#0F172A" />
                        <Text style={styles.backText}>Back</Text>
                    </TouchableOpacity>
                    {form}
                </RNView>
                )}
            </KeyboardAvoidingView>
        </Screen>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    content: {
        flex: 1,
        padding: 24,
        justifyContent: 'center',
    },
    webIntro: {
        marginBottom: 18,
        backgroundColor: 'transparent',
    },
    webTitle: {
        fontSize: 28,
        lineHeight: 34,
        fontWeight: '900',
        color: '#0F172A',
    },
    webBody: {
        marginTop: 10,
        fontSize: 15,
        lineHeight: 24,
        color: '#64748B',
    },
    backButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 16,
        alignSelf: 'flex-start',
    },
    backText: {
        color: '#0F172A',
        fontWeight: '700',
        fontSize: 14,
    },
    card: {
        padding: 24,
    },
    title: {
        fontSize: 26,
        fontWeight: '900',
        color: '#0F172A',
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 14,
        color: '#64748B',
        marginBottom: 24,
        lineHeight: 20,
    },
    inputGroup: {
        marginBottom: 20,
        backgroundColor: 'transparent',
    },
    label: {
        fontSize: 14,
        fontWeight: '700',
        color: '#64748B',
        marginBottom: 8,
    },
    inputWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F8FAFC',
        borderRadius: 14,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        paddingHorizontal: 16,
    },
    inputIcon: {
        marginRight: 12,
    },
    input: {
        flex: 1,
        paddingVertical: 16,
        fontSize: 16,
        color: '#0F172A',
    },
    primaryButton: {
        backgroundColor: '#0F172A',
        padding: 18,
        borderRadius: 16,
        alignItems: 'center',
    },
    buttonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '800',
        letterSpacing: 0.5,
    },
    feedbackBox: {
        marginTop: 12,
        borderRadius: 12,
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderWidth: 1,
    },
    feedbackError: {
        backgroundColor: 'rgba(239, 68, 68, 0.08)',
        borderColor: 'rgba(239, 68, 68, 0.24)',
    },
    feedbackSuccess: {
        backgroundColor: 'rgba(16, 185, 129, 0.08)',
        borderColor: 'rgba(16, 185, 129, 0.24)',
    },
    feedbackInfo: {
        backgroundColor: 'rgba(99, 102, 241, 0.08)',
        borderColor: 'rgba(99, 102, 241, 0.24)',
    },
    feedbackText: {
        fontSize: 13,
        fontWeight: '600',
    },
    feedbackTextError: {
        color: '#B91C1C',
    },
    feedbackTextSuccess: {
        color: '#047857',
    },
    feedbackTextInfo: {
        color: '#4338CA',
    },
});
