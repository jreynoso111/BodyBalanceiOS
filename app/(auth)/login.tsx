import React, { useState } from 'react';
import { StyleSheet, TextInput, TouchableOpacity, Alert, KeyboardAvoidingView, Platform, View as RNView } from 'react-native';
import { Text, View, Screen, Card } from '@/components/Themed';
import { supabase } from '@/services/supabase';
import { Redirect, Stack, useRouter } from 'expo-router';
import { Mail, Lock } from 'lucide-react-native';
import { BrandLogo } from '@/components/BrandLogo';
import { GoogleLogo } from '@/components/GoogleLogo';
import { AppLegalFooter } from '@/components/AppLegalFooter';
import { waitForAuthSession } from '@/services/authSession';
import { getGoogleOAuthUnavailableReason, isGoogleOAuthEnabledForBuild, signInWithGoogle } from '@/services/oauth';
import { useAuthStore } from '@/store/authStore';
import { WebAuthLayout } from '@/components/website/WebAuthLayout';

type FeedbackTone = 'error' | 'success' | 'info';

export default function LoginScreen() {
    const router = useRouter();
    const { initialized, user } = useAuthStore();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [authAction, setAuthAction] = useState<'sign_in' | 'google' | null>(null);
    const [feedback, setFeedback] = useState<{ tone: FeedbackTone; text: string } | null>(null);
    const googleEnabledForBuild = isGoogleOAuthEnabledForBuild();
    const googleUnavailableReason = getGoogleOAuthUnavailableReason();
    const nextRoute = Platform.OS === 'web' ? '/settings' : '/(tabs)';

    const normalizeEmail = (value: string) => value.trim().toLowerCase();

    const isValidEmail = (value: string) => /\S+@\S+\.\S+/.test(value);

    const showMessage = (title: string, message: string, tone: FeedbackTone) => {
        setFeedback({ tone, text: message });

        if (Platform.OS !== 'web') {
            Alert.alert(title, message);
        }
    };

    const withTimeout = async <T,>(promise: Promise<T>, timeoutMs = 20000): Promise<T> => {
        let timeoutId: ReturnType<typeof setTimeout> | null = null;
        try {
            const timeoutPromise = new Promise<never>((_, reject) => {
                timeoutId = setTimeout(() => {
                    reject(new Error('The request timed out. Please try again.'));
                }, timeoutMs);
            });

            return await Promise.race([promise, timeoutPromise]);
        } finally {
            if (timeoutId) clearTimeout(timeoutId);
        }
    };

    const mapAuthError = (message: string) => {
        const normalized = message.toLowerCase();

        if (normalized.includes('invalid login credentials')) {
            return 'Invalid email or password.';
        }
        if (normalized.includes('email not confirmed')) {
            return 'Your email is not confirmed yet. Check your inbox and confirm your account first.';
        }

        return message;
    };

    const onSignIn = async () => {
        if (authAction) return;
        const normalizedEmail = normalizeEmail(email);
        if (!normalizedEmail || !password) {
            showMessage('Error', 'Please enter your email and password.', 'error');
            return;
        }
        if (!isValidEmail(normalizedEmail)) {
            showMessage('Error', 'Please enter a valid email address.', 'error');
            return;
        }

        try {
            setFeedback(null);
            setAuthAction('sign_in');
            const { data, error } = await withTimeout(supabase.auth.signInWithPassword({
                email: normalizedEmail,
                password,
            }));

            if (error) {
                showMessage('Sign in failed', mapAuthError(error.message), 'error');
                return;
            }

            const session = data.session ?? await waitForAuthSession();
            if (!session) {
                showMessage('Sign in failed', 'Your session did not finish loading. Please try again.', 'error');
                return;
            }

            setFeedback({ tone: 'success', text: 'Signed in successfully.' });
            router.replace(nextRoute as never);
        } catch (error: any) {
            showMessage('Sign in failed', error?.message || 'Unable to sign in right now. Please try again.', 'error');
        } finally {
            setAuthAction(null);
        }
    };

    const onGoogleSignIn = async () => {
        if (authAction) return;
        if (googleUnavailableReason) {
            showMessage('Unavailable in Expo Go', googleUnavailableReason, 'info');
            return;
        }

        try {
            setFeedback(null);
            setAuthAction('google');

            const result = await withTimeout(signInWithGoogle(), 30000);
            if (result.status === 'success') {
                setFeedback({ tone: 'success', text: 'Signed in with Google.' });
                router.replace(nextRoute as never);
                return;
            }

            if (result.status === 'redirect') {
                setFeedback({ tone: 'info', text: 'Continuing with Google...' });
                return;
            }

            if (result.status === 'canceled') {
                showMessage('Canceled', result.message || 'Google sign in was canceled.', 'info');
                return;
            }

            showMessage('Google sign in failed', result.message || 'Unable to continue with Google right now.', 'error');
        } catch (error: any) {
            showMessage('Google sign in failed', error?.message || 'Unable to continue with Google right now.', 'error');
        } finally {
            setAuthAction(null);
        }
    };

    if (Platform.OS === 'web' && initialized && user) {
        return <Redirect href="/settings" />;
    }

    const form = (
        <>
            <RNView style={styles.inputGroup}>
                <Text style={styles.label}>Email Address</Text>
                <RNView style={styles.inputWrapper}>
                    <Mail size={18} color="#94A3B8" style={styles.inputIcon} />
                    <TextInput
                        placeholder="Enter your email"
                        placeholderTextColor="#94A3B8"
                        value={email}
                        onChangeText={setEmail}
                        autoCapitalize="none"
                        style={styles.input}
                    />
                </RNView>
            </RNView>

            <RNView style={styles.inputGroup}>
                <Text style={styles.label}>Password</Text>
                <RNView style={styles.inputWrapper}>
                    <Lock size={18} color="#94A3B8" style={styles.inputIcon} />
                    <TextInput
                        placeholder="••••••••"
                        placeholderTextColor="#94A3B8"
                        value={password}
                        onChangeText={setPassword}
                        secureTextEntry
                        style={styles.input}
                    />
                </RNView>
            </RNView>

            <TouchableOpacity
                onPress={() => router.push('/forgot-password')}
                disabled={!!authAction}
                style={styles.forgotButton}
            >
                <Text style={styles.forgotButtonText}>Forgot your password?</Text>
            </TouchableOpacity>

            <TouchableOpacity
                onPress={onSignIn}
                disabled={!!authAction}
                style={styles.primaryButton}
            >
                <Text style={styles.buttonText}>{authAction === 'sign_in' ? 'SIGNING IN...' : 'Sign In'}</Text>
            </TouchableOpacity>

            {googleEnabledForBuild ? (
                <>
                    <TouchableOpacity
                        onPress={onGoogleSignIn}
                        disabled={!!authAction}
                        style={[styles.googleButton, googleUnavailableReason && styles.googleButtonUnavailable]}
                    >
                        <GoogleLogo />
                        <Text style={styles.googleButtonText}>
                            {authAction === 'google'
                                ? 'CONNECTING TO GOOGLE...'
                                : googleUnavailableReason
                                    ? 'Google Sign In Requires App Build'
                                    : 'Continue with Google'}
                        </Text>
                    </TouchableOpacity>

                    {googleUnavailableReason ? (
                        <Text style={styles.googleHintText}>{googleUnavailableReason}</Text>
                    ) : null}
                </>
            ) : null}

            <TouchableOpacity
                onPress={() => router.push('/(auth)/register')}
                disabled={!!authAction}
                style={styles.secondaryButton}
            >
                <Text style={styles.secondaryButtonText}>Create New Account</Text>
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
        </>
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
                        eyebrow="Web sign in"
                        title="Sign in to the same Buddy Balance account you use in the app."
                        description="Access your profile, membership, notifications, security controls, and support history from the browser with the same Supabase account."
                        highlights={[
                            'Shared profile and preferences',
                            'Membership and referral status',
                            'Security and notifications',
                            'Same reset and recovery flow',
                        ]}
                        altAction={{ href: '/', label: 'Back to public site' }}
                    >
                        <View style={styles.webIntro}>
                            <Text style={styles.webTitle}>Welcome back</Text>
                            <Text style={styles.webBody}>
                                Sign in to manage your account, review your plan, and keep profile details aligned
                                across mobile and web.
                            </Text>
                        </View>
                        <Card style={styles.authCard}>{form}</Card>
                    </WebAuthLayout>
                ) : (
                <RNView style={styles.content}>
                    <RNView style={styles.header}>
                        <TouchableOpacity activeOpacity={0.8} onPress={() => router.replace('/')}>
                            <BrandLogo size="lg" showWordmark centered />
                        </TouchableOpacity>
                        <Text style={styles.subtitle}>Securely manage what's yours.</Text>
                    </RNView>

                    <Card style={styles.authCard}>{form}</Card>

                    <AppLegalFooter style={styles.copyright} />
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
    header: {
        alignItems: 'center',
        marginBottom: 40,
        marginTop: 100,
        backgroundColor: 'transparent',
    },
    subtitle: {
        fontSize: 16,
        color: '#64748B',
        marginTop: 10,
        fontWeight: '500',
    },
    authCard: {
        padding: 24,
        marginBottom: 32,
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
        marginTop: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 4,
    },
    secondaryButton: {
        padding: 18,
        borderRadius: 16,
        alignItems: 'center',
        marginTop: 8,
        backgroundColor: 'transparent',
    },
    googleButton: {
        marginTop: 8,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        minHeight: 56,
        paddingHorizontal: 16,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
    },
    googleButtonUnavailable: {
        backgroundColor: '#F8FAFC',
        borderColor: '#CBD5E1',
    },
    googleButtonText: {
        color: '#0F172A',
        fontSize: 14,
        fontWeight: '700',
    },
    googleHintText: {
        marginTop: 8,
        fontSize: 12,
        lineHeight: 18,
        color: '#64748B',
        textAlign: 'center',
    },
    forgotButton: {
        alignSelf: 'flex-end',
        marginTop: -4,
        marginBottom: 8,
        paddingVertical: 6,
    },
    forgotButtonText: {
        color: '#6366F1',
        fontSize: 13,
        fontWeight: '700',
    },
    buttonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '800',
        letterSpacing: 0.5,
    },
    secondaryButtonText: {
        color: '#6366F1',
        fontSize: 15,
        fontWeight: '700',
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
    copyright: {
        textAlign: 'center',
        color: '#64748B',
        fontSize: 12,
        fontWeight: '600',
    },
});
