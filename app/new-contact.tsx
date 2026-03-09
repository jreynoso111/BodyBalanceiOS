import React, { useState, useEffect, useRef, useCallback } from 'react';
import { StyleSheet, View, TextInput, TouchableOpacity, Text, Alert, KeyboardAvoidingView, Platform, ScrollView, RefreshControl, Modal, Pressable } from 'react-native';
import { useHeaderHeight } from '@react-navigation/elements';
import { supabase } from '@/services/supabase';
import { useAuthStore } from '@/store/authStore';
import { useRouter, Stack, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { X, Check, Trash2 } from 'lucide-react-native';
import { countLinkedFriends, PLAN_LIMITS } from '@/services/subscriptionPlan';
import { AppLegalFooter } from '@/components/AppLegalFooter';

export default function NewContactScreen() {
    const { user, planTier } = useAuthStore();
    const router = useRouter();
    const headerHeight = useHeaderHeight();
    const { id, mode } = useLocalSearchParams();
    const contactId = Array.isArray(id) ? id[0] : id;
    const screenMode = Array.isArray(mode) ? mode[0] : mode;
    const isFriendMode = screenMode === 'friend';
    const [name, setName] = useState('');
    const [friendCode, setFriendCode] = useState('');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [notes, setNotes] = useState('');
    const [socialNetwork, setSocialNetwork] = useState('');
    const [existingTargetUserId, setExistingTargetUserId] = useState<string | null>(null);
    const [existingLinkStatus, setExistingLinkStatus] = useState<'private' | 'pending' | 'accepted'>('private');
    const [inviteSentVisible, setInviteSentVisible] = useState(false);
    const [duplicateFriendVisible, setDuplicateFriendVisible] = useState(false);
    const [duplicateFriendLabel, setDuplicateFriendLabel] = useState('');
    const [loading, setLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const scrollViewRef = useRef<ScrollView | null>(null);
    const screenTitle = contactId
        ? isFriendMode
            ? 'Link Friend Account'
            : 'Edit Contact'
        : isFriendMode
            ? 'Add Friend'
            : 'New Contact';
    const navigateAfterSave = () => {
        if (isFriendMode) {
            router.replace('/(tabs)/contacts');
            return;
        }

        router.back();
    };

    const showInviteSentConfirmation = () => {
        setInviteSentVisible(true);
    };

    const showDuplicateFriendError = (label: string) => {
        setDuplicateFriendLabel(label);
        setDuplicateFriendVisible(true);
    };

    const normalizeLinkStatus = (value?: string | null): 'private' | 'pending' | 'accepted' => {
        const normalized = String(value || '').toLowerCase().trim();
        if (normalized === 'accepted') return 'accepted';
        if (normalized === 'pending') return 'pending';
        return 'private';
    };

    const getRelationLookupWarning = (message?: string | null) => {
        const normalized = (message || '').toLowerCase();
        if (normalized.includes('find_profile_match')) {
            return 'This environment is missing the profile match function. The contact was saved, but shared confirmations between accounts will not work until the latest Supabase SQL is applied.';
        }
        if (normalized.includes('find_profile_by_friend_code')) {
            return 'This environment is missing the friend code lookup function. The contact was saved, but the account link could not be created until the latest Supabase SQL is applied.';
        }

        return 'The contact was saved, but the app could not verify whether this person already has an account. Shared confirmations may stay unavailable for this contact.';
    };

    useEffect(() => {
        if (contactId) {
            fetchContact();
        }
    }, [contactId, user]);

    useFocusEffect(
        useCallback(() => {
            const timeoutId = setTimeout(() => {
                scrollViewRef.current?.scrollTo({ y: 0, animated: false });
            }, 0);

            return () => clearTimeout(timeoutId);
        }, [])
    );

    const confirmAction = (title: string, message: string, onConfirm: () => Promise<void> | void) => {
        if (Platform.OS === 'web') {
            const browserConfirm = typeof globalThis.confirm === 'function' ? globalThis.confirm : null;
            const accepted = browserConfirm ? browserConfirm(`${title}\n\n${message}`) : true;
            if (accepted) {
                void onConfirm();
            }
            return;
        }

        Alert.alert(
            title,
            message,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: () => {
                        void onConfirm();
                    },
                },
            ]
        );
    };

    const fetchContact = async () => {
        if (!contactId || !user?.id) return;
        setLoading(true);
        const { data, error } = await supabase
            .from('contacts')
            .select(`
                *,
                target_profile:profiles!contacts_target_user_id_fkey (
                    full_name,
                    email,
                    phone,
                    friend_code
                )
            `)
            .eq('id', contactId)
            .eq('user_id', user.id)
            .single();

        if (error) {
            Alert.alert('Error', error.message);
        }

        if (data) {
            const targetProfile = Array.isArray((data as any).target_profile)
                ? (data as any).target_profile[0]
                : (data as any).target_profile;
            const normalizedLinkStatus = normalizeLinkStatus(data.link_status || (data.target_user_id ? 'accepted' : 'private'));
            const preferLinkedProfile = normalizedLinkStatus === 'accepted' && targetProfile;

            setName(preferLinkedProfile ? (targetProfile?.full_name || targetProfile?.email || data.name || '') : (data.name || targetProfile?.full_name || ''));
            setFriendCode(targetProfile?.friend_code || '');
            setEmail(preferLinkedProfile ? (targetProfile?.email || data.email || '') : (data.email || targetProfile?.email || ''));
            setPhone(preferLinkedProfile ? (targetProfile?.phone || data.phone || '') : (data.phone || targetProfile?.phone || ''));
            setNotes(data.notes || '');
            setSocialNetwork(data.social_network || '');
            setExistingTargetUserId(data.target_user_id || null);
            setExistingLinkStatus(normalizedLinkStatus);
        }
        setLoading(false);
    };

    const handleRefresh = async () => {
        setRefreshing(true);
        try {
            if (contactId) {
                await fetchContact();
            }
        } finally {
            setRefreshing(false);
        }
    };

    const upsertFriendRequest = async (options: {
        toUserId: string;
        contactId: string;
        contactName: string;
        resolvedName: string;
        email: string | null;
        phone: string | null;
        socialNetwork: string | null;
        notes: string | null;
    }) => {
        if (!user?.id) return;

        const requestPayload = {
            sender_contact_id: options.contactId,
            sender_name: options.resolvedName,
            sender_email: options.email,
            sender_phone: options.phone,
            sender_social_network: options.socialNetwork,
            sender_notes: options.notes,
        };

        const baseRequest = {
            type: 'friend_request',
            from_user_id: user.id,
            to_user_id: options.toUserId,
            status: 'pending',
            message: `${options.contactName} wants to connect with you as a friend.`,
            request_payload: requestPayload,
        };

        const { data: existingRequest } = await supabase
            .from('p2p_requests')
            .select('id')
            .eq('type', 'friend_request')
            .eq('from_user_id', user.id)
            .eq('to_user_id', options.toUserId)
            .eq('status', 'pending')
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (existingRequest?.id) {
            await supabase
                .from('p2p_requests')
                .update({
                    message: baseRequest.message,
                    request_payload: requestPayload,
                    updated_at: new Date().toISOString(),
                })
                .eq('id', existingRequest.id);
            return;
        }

        const { error: requestError } = await supabase.from('p2p_requests').insert([baseRequest]);
        if (requestError) {
            throw requestError;
        }
    };

    const onSave = async () => {
        if (!user?.id) {
            Alert.alert('Error', 'User not found');
            return;
        }

        setLoading(true);
        let resolvedName = name.trim();
        let targetUserId: string | null = existingTargetUserId;
        let relationLookupWarning: string | null = null;
        const normalizedFriendCode = friendCode.trim().toUpperCase();
        const wantsAccountLink = Boolean(normalizedFriendCode);

        if (normalizedFriendCode) {
            const { data, error: friendCodeLookupError } = await supabase.rpc('find_profile_by_friend_code', {
                p_friend_code: normalizedFriendCode,
            });
            const linkedProfile = Array.isArray(data) ? data[0] : data;

            if (friendCodeLookupError) {
                relationLookupWarning = getRelationLookupWarning(friendCodeLookupError.message);
            } else if (!linkedProfile?.id) {
                Alert.alert('Error', 'No user was found with that friend code.');
                setLoading(false);
                return;
            } else {
                targetUserId = linkedProfile.id;
                if (!resolvedName) {
                    resolvedName = String(linkedProfile.full_name || linkedProfile.email || `Friend ${normalizedFriendCode}`).trim();
                }
            }
        }

        if (targetUserId === user.id) {
            Alert.alert('Error', "You can't add yourself.");
            setLoading(false);
            return;
        }

        if (!resolvedName) {
            Alert.alert('Error', 'Name is required');
            setLoading(false);
            return;
        }

        if (targetUserId) {
            const isNewLinkedFriend = existingTargetUserId !== targetUserId;
            if (planTier === 'free' && isNewLinkedFriend) {
                const { count, error: countError } = await countLinkedFriends(user.id);
                if (countError) {
                    Alert.alert('Error', countError.message);
                    setLoading(false);
                    return;
                }

                if (count >= PLAN_LIMITS.free.linkedFriends) {
                    Alert.alert(
                        'Free plan limit reached',
                        `Free accounts can link up to ${PLAN_LIMITS.free.linkedFriends} friends. Upgrade to Premium to unlock unlimited linked friends.`,
                        [
                            { text: 'Not now', style: 'cancel' },
                            { text: 'View plans', onPress: () => router.push('/subscription' as any) },
                        ]
                    );
                    setLoading(false);
                    return;
                }
            }

            const { data: targetDuplicates } = await supabase
                .from('contacts')
                .select('id')
                .eq('user_id', user.id)
                .eq('target_user_id', targetUserId)
                .is('deleted_at', null);

            if (targetDuplicates && targetDuplicates.some((duplicate: any) => duplicate.id !== contactId)) {
                showDuplicateFriendError(resolvedName || normalizedFriendCode || 'this friend');
                setLoading(false);
                return;
            }
        }

        const nextLinkStatus: 'private' | 'pending' | 'accepted' = targetUserId
            ? existingLinkStatus === 'accepted' && existingTargetUserId === targetUserId
                ? 'accepted'
                : 'pending'
            : 'private';

        if (contactId) {
            if (!user?.id) {
                Alert.alert('Error', 'User not found');
                setLoading(false);
                return;
            }

            const { data: updatedContact, error } = await supabase
                .from('contacts')
                .update({
                    name: resolvedName,
                    email: email.trim() || null,
                    phone: phone.trim() || null,
                    notes: notes.trim() || null,
                    social_network: socialNetwork.trim() || null,
                    target_user_id: nextLinkStatus === 'private' ? null : targetUserId,
                    link_status: nextLinkStatus,
                })
                .eq('id', contactId)
                .eq('user_id', user.id)
                .select('id')
                .maybeSingle();

            if (error) {
                Alert.alert('Error', error.message);
            } else {
                try {
                    if (targetUserId && nextLinkStatus === 'pending' && updatedContact?.id) {
                        await upsertFriendRequest({
                            toUserId: targetUserId,
                            contactId: updatedContact.id,
                            contactName: resolvedName,
                            resolvedName,
                            email: email.trim() || null,
                            phone: phone.trim() || null,
                            socialNetwork: socialNetwork.trim() || null,
                            notes: notes.trim() || null,
                        });
                    }
                } catch (requestError: any) {
                    Alert.alert('Error', requestError?.message || 'The contact was saved, but the friend request could not be sent.');
                    setLoading(false);
                    return;
                }
                if (relationLookupWarning) {
                    Alert.alert('Saved with warning', relationLookupWarning, [{ text: 'OK', onPress: navigateAfterSave }]);
                } else if (targetUserId && nextLinkStatus === 'pending') {
                    showInviteSentConfirmation();
                } else {
                    Alert.alert('Success', 'Contact updated successfully', [{ text: 'OK', onPress: navigateAfterSave }]);
                }
            }
        } else {
            const { data: insertedContact, error } = await supabase.from('contacts').insert([
                {
                    user_id: user?.id,
                    name: resolvedName,
                    email: email.trim() || null,
                    phone: phone.trim() || null,
                    notes: notes.trim() || null,
                    social_network: socialNetwork.trim() || null,
                    target_user_id: nextLinkStatus === 'private' ? null : targetUserId,
                    link_status: nextLinkStatus,
                },
            ]).select('id').maybeSingle();

            if (error) {
                Alert.alert('Error', error.message);
            } else {
                try {
                    if (targetUserId && nextLinkStatus === 'pending' && insertedContact?.id) {
                        await upsertFriendRequest({
                            toUserId: targetUserId,
                            contactId: insertedContact.id,
                            contactName: resolvedName,
                            resolvedName,
                            email: email.trim() || null,
                            phone: phone.trim() || null,
                            socialNetwork: socialNetwork.trim() || null,
                            notes: notes.trim() || null,
                        });
                    }
                } catch (requestError: any) {
                    Alert.alert('Error', requestError?.message || 'The contact was saved, but the friend request could not be sent.');
                    setLoading(false);
                    return;
                }
                if (relationLookupWarning) {
                    Alert.alert('Saved with warning', relationLookupWarning, [{ text: 'OK', onPress: navigateAfterSave }]);
                } else if (targetUserId && nextLinkStatus === 'pending') {
                    showInviteSentConfirmation();
                } else {
                    Alert.alert('Success', 'Contact created successfully', [{ text: 'OK', onPress: navigateAfterSave }]);
                }
            }
        }

        setLoading(false);
    };

    const handleDelete = async () => {
        if (!contactId || !user?.id) {
            Alert.alert('Error', 'Contact not found');
            return;
        }

        confirmAction(
            'Delete Contact',
            'Are you sure you want to delete this contact? This will not affect existing lend/borrow records.',
            async () => {
                await confirmDelete();
            }
        );
    };

    const confirmDelete = async () => {
        if (!contactId || !user?.id) {
            Alert.alert('Error', 'Contact not found');
            return;
        }

        try {
            setLoading(true);

            // Try hard delete first.
            const { data: hardDeletedRows, error: hardDeleteError } = await supabase
                .from('contacts')
                .delete()
                .eq('id', contactId)
                .eq('user_id', user.id)
                .select('id');

            if (!hardDeleteError && hardDeletedRows && hardDeletedRows.length > 0) {
                Alert.alert('Success', 'Contact deleted');
                router.replace('/(tabs)/contacts');
                return;
            }

            // If hard delete fails because of FK references, soft delete the contact.
            if (hardDeleteError && hardDeleteError.code !== '23503') {
                Alert.alert('Error', hardDeleteError.message);
                return;
            }

            const { data: softData, error: softDeleteError } = await supabase
                .from('contacts')
                .update({ deleted_at: new Date().toISOString() })
                .eq('id', contactId)
                .eq('user_id', user.id)
                .is('deleted_at', null)
                .select('id');

            if (softDeleteError) {
                Alert.alert('Error', softDeleteError.message);
                return;
            }

            if (!softData || softData.length === 0) {
                Alert.alert('Error', 'Contact could not be deleted');
                return;
            }

            Alert.alert('Success', 'Contact deleted');
            router.replace('/(tabs)/contacts');
        } catch (error: any) {
            Alert.alert('Error', error?.message || 'Unexpected error deleting contact');
        } finally {
            setLoading(false);
        }
    };

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={Platform.OS === 'ios' ? headerHeight : 0}
            style={styles.container}
        >
            <Stack.Screen options={{
                title: screenTitle,
                headerTransparent: false,
                headerStyle: {
                    backgroundColor: '#fff',
                },
                headerLeft: () => (
                    <TouchableOpacity onPress={() => router.back()}>
                        <X size={24} color="#000" />
                    </TouchableOpacity>
                ),
                headerRight: () => (
                    <TouchableOpacity onPress={onSave} disabled={loading}>
                        {loading ? <Text>...</Text> : <Check size={24} color="#059669" />}
                    </TouchableOpacity>
                )
            }} />

            <ScrollView
                ref={scrollViewRef}
                contentContainerStyle={styles.form}
                contentInsetAdjustmentBehavior="never"
                automaticallyAdjustContentInsets={false}
                showsVerticalScrollIndicator={false}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void handleRefresh()} />}
            >
                {contactId && isFriendMode ? (
                    <View style={styles.noticeCard}>
                        <Text style={styles.noticeTitle}>Link this contact to a Buddy Balance account</Text>
                        <Text style={styles.noticeText}>
                            Add their friend code to keep shared records and confirmations connected across both accounts.
                        </Text>
                    </View>
                ) : null}

                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Full Name *</Text>
                    <TextInput
                        placeholder="e.g. John Doe"
                        value={name}
                        onChangeText={setName}
                        style={styles.input}
                    />
                </View>

                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Friend Code (Optional)</Text>
                    <TextInput
                        placeholder="e.g. A1B2C3D4"
                        value={friendCode}
                        onChangeText={(value) => setFriendCode(value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                        autoCapitalize="characters"
                        autoCorrect={false}
                        style={styles.input}
                    />
                    <Text style={styles.helperText}>
                        {isFriendMode
                            ? existingLinkStatus === 'accepted'
                                ? 'This contact is already linked. Replace the code only if you need to relink them to another account.'
                                : 'Use their code to connect both accounts so shared records stay in sync.'
                            : 'Paste a friend code if this person also uses the app.'}
                    </Text>
                </View>

                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Email (Optional)</Text>
                    <TextInput
                        placeholder="john@example.com"
                        value={email}
                        onChangeText={setEmail}
                        autoCapitalize="none"
                        keyboardType="email-address"
                        style={styles.input}
                    />
                </View>

                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Phone (Optional)</Text>
                    <TextInput
                        placeholder="+1 234 567 890"
                        value={phone}
                        onChangeText={setPhone}
                        keyboardType="phone-pad"
                        style={styles.input}
                    />
                </View>

                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Social Network (Optional)</Text>
                    <TextInput
                        placeholder="e.g. @johndoe on Instagram"
                        value={socialNetwork}
                        onChangeText={setSocialNetwork}
                        style={styles.input}
                    />
                </View>

                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Notes (Optional)</Text>
                    <TextInput
                        placeholder="Add some notes about this contact..."
                        value={notes}
                        onChangeText={setNotes}
                        multiline
                        style={[styles.input, { minHeight: 80, textAlignVertical: 'top' }]}
                    />
                </View>

                <TouchableOpacity
                    onPress={onSave}
                    disabled={loading}
                    style={styles.saveButton}
                >
                    <Text style={styles.saveButtonText}>
                        {loading ? 'Saving...' : (contactId ? 'Update Contact' : isFriendMode ? 'Save Friend' : 'Save Contact')}
                    </Text>
                </TouchableOpacity>

                {contactId && (
                    <TouchableOpacity
                        onPress={handleDelete}
                        disabled={loading}
                        style={styles.deleteButton}
                    >
                        <Trash2 size={20} color="#EF4444" />
                        <Text style={styles.deleteButtonText}>Delete Contact</Text>
                    </TouchableOpacity>
                )}

                <AppLegalFooter style={styles.copyright} />
            </ScrollView>

            <Modal
                visible={duplicateFriendVisible}
                transparent
                animationType="fade"
                onRequestClose={() => {
                    setDuplicateFriendVisible(false);
                }}
            >
                <Pressable
                    style={styles.duplicateModalBackdrop}
                    onPress={() => {
                        setDuplicateFriendVisible(false);
                    }}
                >
                    <Pressable style={styles.duplicateModalCard} onPress={(event) => event.stopPropagation()}>
                        <View style={styles.duplicateIconWrap}>
                            <X size={28} color="#B91C1C" />
                        </View>
                        <Text style={styles.duplicateEyebrow}>Duplicate friend</Text>
                        <Text style={styles.duplicateTitle}>This friend is already in your contacts</Text>
                        <Text style={styles.duplicateText}>
                            {duplicateFriendLabel
                                ? `${duplicateFriendLabel} is already linked in this account.`
                                : 'This account is already linked in your contacts.'}
                        </Text>
                        <Text style={styles.duplicateHint}>
                            No new invitation was sent. Open the existing contact if you want to edit or relink it.
                        </Text>
                        <TouchableOpacity
                            style={styles.duplicateButton}
                            onPress={() => {
                                setDuplicateFriendVisible(false);
                            }}
                        >
                            <Text style={styles.duplicateButtonText}>Understood</Text>
                        </TouchableOpacity>
                    </Pressable>
                </Pressable>
            </Modal>

            <Modal
                visible={inviteSentVisible}
                transparent
                animationType="fade"
                onRequestClose={() => {
                    setInviteSentVisible(false);
                    navigateAfterSave();
                }}
            >
                <Pressable
                    style={styles.successModalBackdrop}
                    onPress={() => {
                        setInviteSentVisible(false);
                        navigateAfterSave();
                    }}
                >
                    <Pressable style={styles.successModalCard} onPress={(event) => event.stopPropagation()}>
                        <View style={styles.successIconWrap}>
                            <Check size={28} color="#166534" />
                        </View>
                        <Text style={styles.successEyebrow}>Invitation sent</Text>
                        <Text style={styles.successTitle}>Your friend invite is on its way</Text>
                        <Text style={styles.successText}>
                            They will get your request, and once they accept it both accounts will stay connected for shared records and confirmations.
                        </Text>
                        <TouchableOpacity
                            style={styles.successButton}
                            onPress={() => {
                                setInviteSentVisible(false);
                                navigateAfterSave();
                            }}
                        >
                            <Text style={styles.successButtonText}>Perfect</Text>
                        </TouchableOpacity>
                    </Pressable>
                </Pressable>
            </Modal>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
    },
    form: {
        padding: 24,
    },
    inputGroup: {
        marginBottom: 20,
    },
    noticeCard: {
        marginBottom: 20,
        padding: 16,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#C7D2FE',
        backgroundColor: '#EEF2FF',
    },
    noticeTitle: {
        fontSize: 14,
        fontWeight: '800',
        color: '#312E81',
    },
    noticeText: {
        marginTop: 6,
        fontSize: 13,
        lineHeight: 18,
        color: '#4338CA',
    },
    helperText: {
        marginTop: 8,
        fontSize: 12,
        lineHeight: 18,
        color: '#64748B',
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
        color: '#666',
        marginBottom: 8,
    },
    input: {
        borderWidth: 1,
        borderColor: '#eee',
        padding: 16,
        borderRadius: 12,
        fontSize: 16,
        backgroundColor: '#f9fafb',
    },
    saveButton: {
        backgroundColor: '#000',
        padding: 18,
        borderRadius: 14,
        alignItems: 'center',
        marginTop: 20,
    },
    saveButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '700',
    },
    deleteButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        borderRadius: 14,
        marginTop: 12,
        backgroundColor: 'rgba(239, 68, 68, 0.05)',
        gap: 8,
    },
    deleteButtonText: {
        color: '#EF4444',
        fontSize: 15,
        fontWeight: '700',
    },
    copyright: {
        textAlign: 'center',
        color: '#94A3B8',
        fontSize: 12,
        fontWeight: '600',
        marginTop: 32,
    },
    successModalBackdrop: {
        flex: 1,
        backgroundColor: 'rgba(15, 23, 42, 0.45)',
        justifyContent: 'center',
        padding: 24,
    },
    successModalCard: {
        borderRadius: 28,
        padding: 24,
        backgroundColor: '#FFFBEB',
        borderWidth: 1,
        borderColor: '#FDE68A',
        shadowColor: '#000',
        shadowOpacity: 0.12,
        shadowRadius: 18,
        shadowOffset: { width: 0, height: 10 },
        elevation: 8,
    },
    successIconWrap: {
        width: 60,
        height: 60,
        borderRadius: 999,
        backgroundColor: '#DCFCE7',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
    },
    successEyebrow: {
        fontSize: 12,
        fontWeight: '800',
        textTransform: 'uppercase',
        letterSpacing: 1,
        color: '#B45309',
        marginBottom: 8,
    },
    successTitle: {
        fontSize: 24,
        lineHeight: 28,
        fontWeight: '800',
        color: '#111827',
    },
    successText: {
        marginTop: 10,
        fontSize: 15,
        lineHeight: 22,
        color: '#4B5563',
    },
    successButton: {
        marginTop: 22,
        borderRadius: 16,
        backgroundColor: '#16A34A',
        paddingVertical: 16,
        alignItems: 'center',
    },
    successButtonText: {
        color: '#fff',
        fontSize: 15,
        fontWeight: '800',
    },
    duplicateModalBackdrop: {
        flex: 1,
        backgroundColor: 'rgba(15, 23, 42, 0.55)',
        justifyContent: 'center',
        padding: 24,
    },
    duplicateModalCard: {
        borderRadius: 28,
        padding: 24,
        backgroundColor: '#FEF2F2',
        borderWidth: 1,
        borderColor: '#FECACA',
        shadowColor: '#000',
        shadowOpacity: 0.14,
        shadowRadius: 18,
        shadowOffset: { width: 0, height: 10 },
        elevation: 8,
    },
    duplicateIconWrap: {
        width: 60,
        height: 60,
        borderRadius: 999,
        backgroundColor: '#FEE2E2',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
    },
    duplicateEyebrow: {
        fontSize: 12,
        fontWeight: '800',
        textTransform: 'uppercase',
        letterSpacing: 1,
        color: '#B91C1C',
        marginBottom: 8,
    },
    duplicateTitle: {
        fontSize: 24,
        lineHeight: 28,
        fontWeight: '800',
        color: '#111827',
    },
    duplicateText: {
        marginTop: 10,
        fontSize: 15,
        lineHeight: 22,
        color: '#7F1D1D',
        fontWeight: '700',
    },
    duplicateHint: {
        marginTop: 8,
        fontSize: 14,
        lineHeight: 21,
        color: '#4B5563',
    },
    duplicateButton: {
        marginTop: 22,
        borderRadius: 16,
        backgroundColor: '#DC2626',
        paddingVertical: 16,
        alignItems: 'center',
    },
    duplicateButtonText: {
        color: '#fff',
        fontSize: 15,
        fontWeight: '800',
    },
});
