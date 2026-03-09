import React, { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, StyleSheet, TextInput, TouchableOpacity, View as RNView } from 'react-native';
import { Redirect, Stack, useRouter } from 'expo-router';
import { ArrowLeft, Lock, Mail, User } from 'lucide-react-native';

import { Card, Screen, Text } from '@/components/Themed';
import { BrandLogo } from '@/components/BrandLogo';
import { GoogleLogo } from '@/components/GoogleLogo';
import { waitForAuthSession } from '@/services/authSession';
import { getPasswordPolicyMessage, isStrongPassword } from '@/services/passwordPolicy';
import { supabase } from '@/services/supabase';
import { getGoogleOAuthUnavailableReason, isGoogleOAuthEnabledForBuild, signInWithGoogle } from '@/services/oauth';
import { useAuthStore } from '@/store/authStore';
import { WebAuthLayout } from '@/components/website/WebAuthLayout';

type FeedbackTone = 'error' | 'success' | 'info';
type RegisterStep = 'details' | 'verify';

export default function RegisterScreen() {
    const router = useRouter();
    const { initialized, user } = useAuthStore();
    const [fullName, setFullName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [verificationCode, setVerificationCode] = useState('');
    const [step, setStep] = useState<RegisterStep>('details');
    const [loading, setLoading] = useState(false);
    const [verifyingCode, setVerifyingCode] = useState(false);
    const [googleLoading, setGoogleLoading] = useState(false);
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

    const mapAuthError = (message: string) => {
        const normalized = message.toLowerCase();

        if (normalized.includes('already registered')) {
            return 'This email is already registered. Try signing in or reset your password.';
        }
        if (normalized.includes('password should be at least')) {
            return getPasswordPolicyMessage();
        }
        if (normalized.includes('unable to validate email address')) {
            return 'Please enter a valid email address.';
        }

        return message;
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

    const normalizedEmail = normalizeEmail(email);
    const busy = loading || verifyingCode || googleLoading;

    const validateAccountFields = () => {
        if (!fullName.trim()) {
            showMessage('Error', 'Please enter your full name.', 'error');
            return false;
        }
        if (!normalizedEmail) {
            showMessage('Error', 'Please enter your email address.', 'error');
            return false;
        }
        if (!isValidEmail(normalizedEmail)) {
            showMessage('Error', 'Please enter a valid email address.', 'error');
            return false;
        }
        if (!isStrongPassword(password)) {
            showMessage('Error', getPasswordPolicyMessage(), 'error');
            return false;
        }
        if (password !== confirmPassword) {
            showMessage('Error', 'Passwords do not match.', 'error');
            return false;
        }

        return true;
    };

    const sendVerificationCode = async () => {
        if (busy) return;

        if (!validateAccountFields()) {
            return;
        }

        try {
            setFeedback(null);
            setLoading(true);

            const { error } = await withTimeout(
                supabase.auth.signInWithOtp({
                    email: normalizedEmail,
                    options: {
                        shouldCreateUser: true,
                        data: {
                            full_name: fullName.trim(),
                        },
                    },
                })
            );

            if (error) {
                showMessage('Verification failed', mapAuthError(error.message), 'error');
                return;
            }

            setStep('verify');
            showMessage(
                'Verification code sent',
                'Enter the 6-digit code sent to your email to finish creating your account.',
                'info'
            );
        } catch (error: any) {
            showMessage('Verification failed', error?.message || 'Could not send a verification code right now.', 'error');
        } finally {
            setLoading(false);
        }
    };

    const verifyEmailCode = async () => {
        if (busy) return;

        const token = verificationCode.trim().replace(/\s+/g, '');
        if (token.length < 6) {
            showMessage('Error', 'Please enter the 6-digit verification code.', 'error');
            return;
        }

        try {
            setFeedback(null);
            setVerifyingCode(true);

            let verificationError: Error | null = null;
            let verificationSucceeded = false;
            const verificationTypes: Array<'email' | 'signup'> = ['email', 'signup'];

            for (const type of verificationTypes) {
                const { error } = await withTimeout(
                    supabase.auth.verifyOtp({
                        email: normalizedEmail,
                        token,
                        type,
                    })
                );

                if (!error) {
                    verificationSucceeded = true;
                    break;
                }

                verificationError = error;
            }

            if (!verificationSucceeded) {
                showMessage(
                    'Invalid code',
                    mapAuthError(verificationError?.message || 'The verification code is invalid or expired.'),
                    'error'
                );
                return;
            }

            const { error: passwordError } = await withTimeout(
                supabase.auth.updateUser({
                    password,
                    data: {
                        full_name: fullName.trim(),
                    },
                })
            );

            if (passwordError) {
                showMessage('Account setup failed', mapAuthError(passwordError.message), 'error');
                return;
            }

            const { data: userData } = await supabase.auth.getUser();
            const userId = userData.user?.id;
            if (userId) {
                const { error: profileError } = await supabase
                    .from('profiles')
                    .update({
                        full_name: fullName.trim(),
                        email: normalizedEmail,
                    })
                    .eq('id', userId);

                if (profileError) {
                    console.error('profile update after code verification failed:', profileError.message);
                }
            }

            const session = await waitForAuthSession();
            if (!session) {
                showMessage('Account setup failed', 'Your session did not finish loading. Please try signing in.', 'error');
                return;
            }

            showMessage('Account created', 'Email verified. Your account is ready.', 'success');
            router.replace(nextRoute as never);
        } catch (error: any) {
            showMessage('Verification failed', error?.message || 'Could not verify the code right now.', 'error');
        } finally {
            setVerifyingCode(false);
        }
    };

    const onContinueWithGoogle = async () => {
        if (busy) return;
        if (googleUnavailableReason) {
            showMessage('Unavailable in Expo Go', googleUnavailableReason, 'info');
            return;
        }

        try {
            setFeedback(null);
            setGoogleLoading(true);

            const result = await withTimeout(signInWithGoogle(), 30000);
            if (result.status === 'success') {
                showMessage('Success', 'Signed in with Google.', 'success');
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
            setGoogleLoading(false);
        }
    };

    if (Platform.OS === 'web' && initialized && user) {
        return <Redirect href="/settings" />;
    }

    const form = (
        <>
            {step === 'details' ? (
                <>
                    <RNView style={styles.inputGroup}>
                        <Text style={styles.label}>Full Name</Text>
                        <RNView style={styles.inputWrapper}>
                            <User size={18} color="#94A3B8" style={styles.inputIcon} />
                            <TextInput
                                placeholder="Enter your full name"
                                placeholderTextColor="#94A3B8"
                                value={fullName}
                                onChangeText={setFullName}
                                autoCapitalize="words"
                                style={styles.input}
                            />
                        </RNView>
                    </RNView>

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
                                keyboardType="email-address"
                                style={styles.input}
                            />
                        </RNView>
                    </RNView>

                    <RNView style={styles.inputGroup}>
                        <Text style={styles.label}>Password</Text>
                        <RNView style={styles.inputWrapper}>
                            <Lock size={18} color="#94A3B8" style={styles.inputIcon} />
                            <TextInput
                                placeholder="At least 10 chars, mixed case, and number"
                                placeholderTextColor="#94A3B8"
                                value={password}
                                onChangeText={setPassword}
                                secureTextEntry
                                style={styles.input}
                            />
                        </RNView>
                    </RNView>

                    <RNView style={styles.inputGroup}>
                        <Text style={styles.label}>Confirm Password</Text>
                        <RNView style={styles.inputWrapper}>
                            <Lock size={18} color="#94A3B8" style={styles.inputIcon} />
                            <TextInput
                                placeholder="Repeat your password"
                                placeholderTextColor="#94A3B8"
                                value={confirmPassword}
                                onChangeText={setConfirmPassword}
                                secureTextEntry
                                style={styles.input}
                            />
                        </RNView>
                    </RNView>

                    <TouchableOpacity
                        onPress={sendVerificationCode}
                        disabled={busy}
                        style={[styles.primaryButton, busy && { opacity: 0.75 }]}
                    >
                        <Text style={styles.buttonText}>{loading ? 'SENDING CODE...' : 'Send Verification Code'}</Text>
                    </TouchableOpacity>
                </>
            ) : (
                <>
                    <RNView style={styles.inputGroup}>
                        <Text style={styles.label}>Verification Code</Text>
                        <RNView style={styles.inputWrapper}>
                            <Mail size={18} color="#94A3B8" style={styles.inputIcon} />
                            <TextInput
                                placeholder="Enter 6-digit code"
                                placeholderTextColor="#94A3B8"
                                value={verificationCode}
                                onChangeText={setVerificationCode}
                                autoCapitalize="none"
                                keyboardType="number-pad"
                                style={styles.input}
                                maxLength={6}
                            />
                        </RNView>
                    </RNView>

                    <TouchableOpacity
                        onPress={verifyEmailCode}
                        disabled={busy}
                        style={[styles.primaryButton, busy && { opacity: 0.75 }]}
                    >
                        <Text style={styles.buttonText}>{verifyingCode ? 'VERIFYING...' : 'Verify Code & Create Account'}</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        onPress={sendVerificationCode}
                        disabled={busy}
                        style={styles.secondaryButton}
                    >
                        <Text style={styles.secondaryButtonText}>{loading ? 'SENDING...' : 'Resend code'}</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        onPress={() => setStep('details')}
                        disabled={busy}
                        style={styles.secondaryButton}
                    >
                        <Text style={styles.secondaryButtonText}>Edit registration details</Text>
                    </TouchableOpacity>
                </>
            )}

            {googleEnabledForBuild ? (
                <>
                    <TouchableOpacity
                        onPress={onContinueWithGoogle}
                        disabled={busy}
                        style={[
                            styles.googleButton,
                            busy && styles.googleButtonDisabled,
                            googleUnavailableReason && styles.googleButtonUnavailable,
                        ]}
                    >
                        <GoogleLogo />
                        <Text style={styles.googleButtonText}>
                            {googleLoading
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

            <TouchableOpacity onPress={() => router.replace('/(auth)/login')} style={styles.secondaryButton} disabled={busy}>
                <Text style={styles.secondaryButtonText}>Already have an account? Sign In</Text>
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
                        eyebrow="Create account"
                        title="Create a Buddy Balance account that works on mobile and web."
                        description="Start with email verification, then manage profile details, membership, security, and support from the browser with the same account."
                        highlights={[
                            'Same sign-in as the app',
                            'Email code verification',
                            'Profile and referral setup',
                            'Membership and support access',
                        ]}
                        altAction={{ href: '/(auth)/login', label: 'Back to sign in' }}
                    >
                        <RNView style={styles.webIntro}>
                            <Text style={styles.webTitle}>{step === 'details' ? 'Create your account' : 'Verify your email'}</Text>
                            <Text style={styles.webBody}>
                                {step === 'details'
                                    ? 'Set up your account credentials first. Buddy Balance will send a short verification code before final activation.'
                                    : 'Enter the six-digit code from your inbox to finish the account setup and unlock the web account center.'}
                            </Text>
                        </RNView>
                        <Card style={styles.authCard}>{form}</Card>
                    </WebAuthLayout>
                ) : (
                <RNView style={styles.content}>
                    <TouchableOpacity onPress={() => router.replace('/(auth)/login')} style={styles.backButton}>
                        <ArrowLeft size={20} color="#0F172A" />
                        <Text style={styles.backText}>Back to login</Text>
                    </TouchableOpacity>

                    <RNView style={styles.header}>
                        <BrandLogo size="md" showWordmark centered />
                        <Text style={styles.subtitle}>Create your account</Text>
                    </RNView>

                    <Card style={styles.authCard}>{form}</Card>
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
    header: {
        alignItems: 'center',
        marginBottom: 24,
        backgroundColor: 'transparent',
    },
    subtitle: {
        marginTop: 10,
        color: '#64748B',
        fontSize: 15,
        fontWeight: '600',
    },
    authCard: {
        padding: 24,
    },
    inputGroup: {
        marginBottom: 14,
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
    },
    buttonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '800',
        letterSpacing: 0.5,
    },
    secondaryButton: {
        padding: 14,
        borderRadius: 14,
        alignItems: 'center',
        marginTop: 8,
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
    googleButtonDisabled: {
        opacity: 0.75,
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
    secondaryButtonText: {
        color: '#6366F1',
        fontSize: 14,
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
});
