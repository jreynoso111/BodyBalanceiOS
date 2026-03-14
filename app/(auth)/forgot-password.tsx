import React, { useState } from 'react';
import { StyleSheet, TextInput, TouchableOpacity, Alert, KeyboardAvoidingView, Platform, View as RNView } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import * as Linking from 'expo-linking';
import { Mail, ArrowLeft } from 'lucide-react-native';

import { Text, Screen, Card } from '@/components/Themed';
import { isValidEmail, normalizeAuthEmail } from '@/services/authFlowUtils';
import { requestPasswordReset } from '@/services/publicAuth';
import { WebAuthLayout } from '@/components/website/WebAuthLayout';
import { useAppTheme } from '@/hooks/useAppTheme';

type FeedbackTone = 'error' | 'success' | 'info';

export default function ForgotPasswordScreen() {
    const router = useRouter();
    const { theme } = useAppTheme();
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
        const normalizedEmail = normalizeAuthEmail(email);
        if (!normalizedEmail) {
            showMessage('Error', 'Please enter your email.', 'error');
            return;
        }

        if (!isValidEmail(normalizedEmail)) {
            showMessage('Error', 'Please enter a valid email address.', 'error');
            return;
        }

        try {
            setLoading(true);
            setFeedback(null);
            const redirectTo = Linking.createURL('/reset-password');
            await requestPasswordReset({ email: normalizedEmail, redirectTo });

            showMessage(
                'Email sent',
                'Check your inbox and open the link to reset your password.',
                'success'
            );
        } catch (error: any) {
            showMessage('Error', error?.message || 'Could not send the recovery email.', 'error');
        } finally {
            setLoading(false);
        }
    };

    const form = (
        <Card style={styles.card}>
            <Text style={[styles.title, { color: theme.title }]}>Reset password</Text>
            <Text style={[styles.subtitle, { color: theme.secondaryText }]}>
                We will send a link to reset your password.
            </Text>

            <RNView style={styles.inputGroup}>
                <Text style={[styles.label, { color: theme.secondaryText }]}>Email</Text>
                <RNView style={[styles.inputWrapper, { backgroundColor: theme.inputBackground, borderColor: theme.inputBorder }]}>
                    <Mail size={18} color={theme.tertiaryText} style={styles.inputIcon} />
                    <TextInput
                        placeholder="name@email.com"
                        placeholderTextColor={theme.tertiaryText}
                        value={email}
                        onChangeText={setEmail}
                        autoCapitalize="none"
                        keyboardType="email-address"
                        style={[styles.input, { color: theme.inputText }]}
                    />
                </RNView>
            </RNView>

            <TouchableOpacity
                onPress={onSendResetEmail}
                disabled={loading}
                style={[styles.primaryButton, { backgroundColor: theme.primaryButton }, loading && { opacity: 0.7 }]}
            >
                <Text style={[styles.buttonText, { color: theme.primaryButtonText }]}>{loading ? 'SENDING...' : 'Send link'}</Text>
            </TouchableOpacity>

            {feedback ? (
                <RNView
                    style={[
                        styles.feedbackBox,
                        feedback.tone === 'error' && {
                            backgroundColor: theme.feedbackErrorBackground,
                            borderColor: theme.feedbackErrorBorder,
                        },
                        feedback.tone === 'success' && {
                            backgroundColor: theme.feedbackSuccessBackground,
                            borderColor: theme.feedbackSuccessBorder,
                        },
                        feedback.tone === 'info' && {
                            backgroundColor: theme.feedbackInfoBackground,
                            borderColor: theme.feedbackInfoBorder,
                        },
                    ]}
                >
                    <Text
                        style={[
                            styles.feedbackText,
                            feedback.tone === 'error' && { color: theme.feedbackErrorText },
                            feedback.tone === 'success' && { color: theme.feedbackSuccessText },
                            feedback.tone === 'info' && { color: theme.feedbackInfoText },
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
                            <Text style={[styles.webTitle, { color: theme.title }]}>Forgot your password?</Text>
                            <Text style={[styles.webBody, { color: theme.secondaryText }]}>
                                Enter the email you use for Buddy Balance and we will send a recovery link.
                            </Text>
                        </RNView>
                        {form}
                    </WebAuthLayout>
                ) : (
                <RNView style={styles.content}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                        <ArrowLeft size={20} color={theme.backButton} />
                        <Text style={[styles.backText, { color: theme.backButton }]}>Back</Text>
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
    feedbackText: {
        fontSize: 13,
        fontWeight: '600',
    },
});
