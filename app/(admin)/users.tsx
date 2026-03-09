import React, { useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Modal,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import * as Linking from 'expo-linking';
import { Card, Screen } from '@/components/Themed';
import { supabase } from '@/services/supabase';
import {
    AlertCircle,
    BadgeCheck,
    Crown,
    History,
    Mail,
    RefreshCcw,
    Search,
    Settings2,
    Shield,
    Trash2,
    User as UserIcon,
    X,
} from 'lucide-react-native';
import { getPlanLabel, normalizePlanTier, PlanTier } from '@/services/subscriptionPlan';

interface AdminUserProfile {
    id: string;
    full_name: string;
    email: string;
    phone: string | null;
    role: string;
    plan_tier: string | null;
    updated_at: string;
}

interface AuditLogEntry {
    id: number;
    created_at: string;
    table_name: string;
    operation: 'INSERT' | 'UPDATE' | 'DELETE';
    row_id: string | null;
    changed_columns: string[] | null;
}

interface SupportMessageEntry {
    id: string;
    subject: string | null;
    message: string;
    channel: string;
    status: string;
    created_at: string;
}

const formatDateTime = (value?: string | null) => {
    if (!value) return 'Unknown date';

    try {
        return new Intl.DateTimeFormat('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
        }).format(new Date(value));
    } catch {
        return value;
    }
};

const formatAuditSummary = (entry: AuditLogEntry) => {
    const labelMap: Record<string, string> = {
        profiles: 'profile',
        contacts: 'contact',
        loans: 'record',
        payments: 'payment',
        p2p_requests: 'confirmation',
        payment_history: 'payment history',
    };

    const subject = labelMap[entry.table_name] || entry.table_name;
    const verb =
        entry.operation === 'INSERT'
            ? 'created'
            : entry.operation === 'DELETE'
              ? 'deleted'
              : 'updated';

    if (entry.operation === 'UPDATE' && entry.changed_columns?.length) {
        return `${verb} ${subject}: ${entry.changed_columns.slice(0, 3).join(', ')}`;
    }

    return `${verb} ${subject}`;
};

export default function AdminUsersList() {
    const [users, setUsers] = useState<AdminUserProfile[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [search, setSearch] = useState('');
    const [refreshing, setRefreshing] = useState(false);
    const [savingUserId, setSavingUserId] = useState<string | null>(null);
    const [selectedUser, setSelectedUser] = useState<AdminUserProfile | null>(null);
    const [manageVisible, setManageVisible] = useState(false);
    const [supportMessages, setSupportMessages] = useState<SupportMessageEntry[]>([]);
    const [supportLoading, setSupportLoading] = useState(false);
    const [historyVisible, setHistoryVisible] = useState(false);
    const [historyUser, setHistoryUser] = useState<AdminUserProfile | null>(null);
    const [historyLogs, setHistoryLogs] = useState<AuditLogEntry[]>([]);
    const [historyLoading, setHistoryLoading] = useState(false);

    useEffect(() => {
        void fetchUsers();
    }, []);

    const filteredUsers = useMemo(() => {
        const query = search.toLowerCase();
        return users.filter((user) => {
            return (
                (user.full_name || '').toLowerCase().includes(query) ||
                (user.email || '').toLowerCase().includes(query) ||
                (user.phone || '').includes(query)
            );
        });
    }, [search, users]);

    const fetchUsers = async () => {
        setLoading(true);
        setError('');
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .order('full_name', { ascending: true });

            if (error) throw error;
            setUsers(data as AdminUserProfile[]);
        } catch (err: any) {
            setError(err.message || 'Failed to fetch users');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const handleRefresh = () => {
        setRefreshing(true);
        void fetchUsers();
    };

    const invokeAdminUserManagement = async (body: Record<string, unknown>) => {
        const {
            data: { session },
        } = await supabase.auth.getSession();

        if (!session?.access_token) {
            throw new Error('The admin session is not available.');
        }

        const { data, error } = await supabase.functions.invoke('admin-user-management', {
            body,
            headers: {
                Authorization: `Bearer ${session.access_token}`,
            },
        });

        if (error) {
            throw error;
        }

        return data;
    };

    const updatePlanTier = async (userId: string, nextPlan: PlanTier) => {
        setSavingUserId(userId);
        try {
            const { error } = await supabase.rpc('admin_set_profile_plan_tier', {
                p_user_id: userId,
                p_plan_tier: nextPlan,
            });

            if (error) throw error;

            setUsers((current) =>
                current.map((item) => (item.id === userId ? { ...item, plan_tier: nextPlan } : item))
            );
            setSelectedUser((current) => (current?.id === userId ? { ...current, plan_tier: nextPlan } : current));
        } catch (err: any) {
            setError(err.message || 'Failed to update plan');
        } finally {
            setSavingUserId(null);
        }
    };

    const openManageModal = (user: AdminUserProfile) => {
        setSelectedUser(user);
        setManageVisible(true);
        void loadSupportMessages(user.id);
    };

    const closeManageModal = () => {
        setManageVisible(false);
        setSelectedUser(null);
        setSupportMessages([]);
    };

    const loadSupportMessages = async (userId: string) => {
        setSupportLoading(true);
        try {
            const { data, error } = await supabase
                .from('support_messages')
                .select('id, subject, message, channel, status, created_at')
                .eq('user_id', userId)
                .order('created_at', { ascending: false })
                .limit(5);

            if (error) throw error;
            setSupportMessages((data || []) as SupportMessageEntry[]);
        } catch (err: any) {
            setError(err.message || 'Failed to load support communications.');
        } finally {
            setSupportLoading(false);
        }
    };

    const openHistoryModal = async (user: AdminUserProfile) => {
        setHistoryUser(user);
        setHistoryVisible(true);
        setHistoryLoading(true);
        setHistoryLogs([]);

        try {
            const { data, error } = await supabase
                .from('audit_logs')
                .select('id, created_at, table_name, operation, row_id, changed_columns')
                .eq('actor_user_id', user.id)
                .order('created_at', { ascending: false })
                .limit(30);

            if (error) throw error;
            setHistoryLogs((data || []) as AuditLogEntry[]);
        } catch (err: any) {
            setError(err.message || 'Failed to load activity history');
            setHistoryVisible(false);
        } finally {
            setHistoryLoading(false);
        }
    };

    const sendPasswordReset = async (user: AdminUserProfile) => {
        if (!user.email) {
            Alert.alert('Email missing', 'This user does not have an email address on the profile.');
            return;
        }

        setSavingUserId(user.id);
        try {
            await invokeAdminUserManagement({
                action: 'send_password_reset',
                email: user.email,
                redirectTo: Linking.createURL('/reset-password'),
            });

            Alert.alert('Reset email sent', `A password reset email was sent to ${user.email}.`);
        } catch (err: any) {
            Alert.alert('Action failed', err.message || 'The reset email could not be sent.');
        } finally {
            setSavingUserId(null);
        }
    };

    const deleteUser = async (user: AdminUserProfile) => {
        Alert.alert(
            'Delete user',
            `Delete ${user.full_name || user.email}? This removes the account and its related data.`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete user',
                    style: 'destructive',
                    onPress: () => {
                        void (async () => {
                            setSavingUserId(user.id);
                            try {
                                await invokeAdminUserManagement({
                                    action: 'delete_user',
                                    userId: user.id,
                                });

                                setUsers((current) => current.filter((item) => item.id !== user.id));
                                setSelectedUser((current) => (current?.id === user.id ? null : current));
                                setManageVisible(false);
                            } catch (err: any) {
                                Alert.alert('Delete failed', err.message || 'The user could not be deleted.');
                            } finally {
                                setSavingUserId(null);
                            }
                        })();
                    },
                },
            ]
        );
    };

    const renderItem = ({ item }: { item: AdminUserProfile }) => {
        const normalizedPlan = normalizePlanTier(item.plan_tier);
        const isSaving = savingUserId === item.id;

        return (
            <Card style={styles.userCard}>
                <View style={styles.userTopRow}>
                    <View style={styles.userLeft}>
                        <View style={styles.avatar}>
                            <Text style={styles.avatarText}>
                                {item.full_name ? item.full_name[0].toUpperCase() : item.email ? item.email[0].toUpperCase() : '?'}
                            </Text>
                        </View>
                        <View style={styles.userInfo}>
                            <Text style={styles.userName}>{item.full_name || 'No Name'}</Text>
                            <Text style={styles.userEmail}>{item.email}</Text>
                            {item.phone ? <Text style={styles.userPhone}>{item.phone}</Text> : null}
                            <Text style={styles.updatedAt}>Updated {formatDateTime(item.updated_at)}</Text>
                        </View>
                    </View>
                    <View style={styles.userRight}>
                        <Text style={[styles.roleBadge, item.role === 'admin' ? styles.roleAdmin : styles.roleUser]}>
                            {item.role.toUpperCase()}
                        </Text>
                        <Text style={[styles.planBadge, normalizedPlan === 'premium' ? styles.planPremium : styles.planFree]}>
                            {getPlanLabel(normalizedPlan).toUpperCase()}
                        </Text>
                    </View>
                </View>

                <View style={styles.actionRow}>
                    <TouchableOpacity style={styles.secondaryActionButton} onPress={() => void openHistoryModal(item)} disabled={isSaving}>
                        <History size={16} color="#475569" />
                        <Text style={styles.secondaryActionText}>History</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.secondaryActionButton} onPress={() => void sendPasswordReset(item)} disabled={isSaving}>
                        <Mail size={16} color="#475569" />
                        <Text style={styles.secondaryActionText}>Reset</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.primaryActionButton} onPress={() => openManageModal(item)} disabled={isSaving}>
                        <Settings2 size={16} color="#FFFFFF" />
                        <Text style={styles.primaryActionText}>Manage</Text>
                    </TouchableOpacity>
                </View>

                {isSaving ? <Text style={styles.savingText}>Processing admin action...</Text> : null}
            </Card>
        );
    };

    if (loading && !refreshing) {
        return (
            <Screen style={[styles.container, styles.center]}>
                <ActivityIndicator size="large" color="#6366F1" />
            </Screen>
        );
    }

    if (error) {
        return (
            <Screen style={[styles.container, styles.center]}>
                <AlertCircle size={48} color="#EF4444" />
                <Text style={styles.errorText}>{error}</Text>
                <TouchableOpacity onPress={() => void fetchUsers()} style={styles.retryBtn}>
                    <Text style={styles.retryText}>Retry</Text>
                </TouchableOpacity>
            </Screen>
        );
    }

    const selectedPlan = normalizePlanTier(selectedUser?.plan_tier);
    const nextPlan = selectedPlan === 'premium' ? 'free' : 'premium';

    return (
        <Screen style={styles.container}>
            <View style={styles.header}>
                <View style={styles.searchBar}>
                    <Search size={20} color="#94A3B8" style={styles.searchIcon} />
                    <TextInput
                        placeholder="Search users by name, email, or phone..."
                        placeholderTextColor="#94A3B8"
                        style={styles.searchInput}
                        value={search}
                        onChangeText={setSearch}
                    />
                </View>
                <TouchableOpacity onPress={handleRefresh} style={styles.refreshBtn}>
                    <RefreshCcw size={20} color="#64748B" />
                </TouchableOpacity>
            </View>

            <FlatList
                data={filteredUsers}
                keyExtractor={(item) => item.id}
                renderItem={renderItem}
                contentContainerStyle={styles.listContent}
                refreshing={refreshing}
                onRefresh={handleRefresh}
                ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                        <UserIcon size={48} color="#CBD5E1" />
                        <Text style={styles.emptyText}>No users found.</Text>
                    </View>
                }
            />

            <Modal visible={manageVisible} transparent animationType="fade" onRequestClose={closeManageModal}>
                <Pressable style={styles.modalBackdrop} onPress={closeManageModal}>
                    <Pressable style={styles.modalCard} onPress={(event) => event.stopPropagation()}>
                        <View style={styles.modalHeader}>
                            <View>
                                <Text style={styles.modalTitle}>Manage user</Text>
                                <Text style={styles.modalSubtitle}>{selectedUser?.full_name || selectedUser?.email}</Text>
                            </View>
                            <TouchableOpacity style={styles.closeButton} onPress={closeManageModal}>
                                <X size={18} color="#475569" />
                            </TouchableOpacity>
                        </View>

                        {selectedUser ? (
                            <>
                                <View style={styles.manageSummaryRow}>
                                    <View style={styles.summaryChip}>
                                        <Shield size={14} color="#6366F1" />
                                        <Text style={styles.summaryChipText}>{selectedUser.role.toUpperCase()}</Text>
                                    </View>
                                    <View style={[styles.summaryChip, selectedPlan === 'premium' ? styles.summaryChipPremium : styles.summaryChipFree]}>
                                        <Crown size={14} color={selectedPlan === 'premium' ? '#047857' : '#475569'} />
                                        <Text style={[styles.summaryChipText, selectedPlan === 'premium' ? styles.summaryChipTextPremium : null]}>
                                            {getPlanLabel(selectedPlan)}
                                        </Text>
                                    </View>
                                </View>

                                <TouchableOpacity
                                    style={styles.managePrimaryButton}
                                    onPress={() => void updatePlanTier(selectedUser.id, nextPlan)}
                                    disabled={savingUserId === selectedUser.id}
                                >
                                    <BadgeCheck size={16} color="#FFFFFF" />
                                    <Text style={styles.managePrimaryButtonText}>
                                        Change tier to {getPlanLabel(nextPlan)}
                                    </Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={styles.manageSecondaryButton}
                                    onPress={() => void sendPasswordReset(selectedUser)}
                                    disabled={savingUserId === selectedUser.id}
                                >
                                    <Mail size={16} color="#1E293B" />
                                    <Text style={styles.manageSecondaryButtonText}>Send password reset email</Text>
                                </TouchableOpacity>

                                <View style={styles.supportSection}>
                                    <Text style={styles.supportSectionTitle}>Support communications</Text>
                                    {supportLoading ? (
                                        <Text style={styles.supportLoadingText}>Loading communication log...</Text>
                                    ) : supportMessages.length === 0 ? (
                                        <Text style={styles.supportEmptyText}>This user has not contacted support yet.</Text>
                                    ) : (
                                        supportMessages.map((entry) => (
                                            <View key={entry.id} style={styles.supportItem}>
                                                <View style={styles.supportItemHeader}>
                                                    <Text style={styles.supportItemTitle}>{entry.subject?.trim() || 'General support message'}</Text>
                                                    <Text style={styles.supportItemMeta}>{formatDateTime(entry.created_at)}</Text>
                                                </View>
                                                <Text style={styles.supportItemBody} numberOfLines={4}>{entry.message}</Text>
                                                <Text style={styles.supportItemFooter}>
                                                    {entry.channel.replace('_', ' ')} • {entry.status}
                                                </Text>
                                            </View>
                                        ))
                                    )}
                                </View>

                                <TouchableOpacity
                                    style={styles.manageDangerButton}
                                    onPress={() => void deleteUser(selectedUser)}
                                    disabled={savingUserId === selectedUser.id}
                                >
                                    <Trash2 size={16} color="#FFFFFF" />
                                    <Text style={styles.manageDangerButtonText}>Delete user</Text>
                                </TouchableOpacity>
                            </>
                        ) : null}
                    </Pressable>
                </Pressable>
            </Modal>

            <Modal visible={historyVisible} transparent animationType="fade" onRequestClose={() => setHistoryVisible(false)}>
                <Pressable style={styles.modalBackdrop} onPress={() => setHistoryVisible(false)}>
                    <Pressable style={[styles.modalCard, styles.historyModalCard]} onPress={(event) => event.stopPropagation()}>
                        <View style={styles.modalHeader}>
                            <View>
                                <Text style={styles.modalTitle}>Activity history</Text>
                                <Text style={styles.modalSubtitle}>{historyUser?.full_name || historyUser?.email}</Text>
                            </View>
                            <TouchableOpacity style={styles.closeButton} onPress={() => setHistoryVisible(false)}>
                                <X size={18} color="#475569" />
                            </TouchableOpacity>
                        </View>

                        {historyLoading ? (
                            <View style={styles.historyLoadingBox}>
                                <ActivityIndicator size="small" color="#6366F1" />
                                <Text style={styles.historyLoadingText}>Loading recent activity...</Text>
                            </View>
                        ) : (
                            <ScrollView contentContainerStyle={styles.historyList}>
                                {historyLogs.length === 0 ? (
                                    <Text style={styles.emptyHistoryText}>No tracked activity yet for this user.</Text>
                                ) : (
                                    historyLogs.map((entry) => (
                                        <View key={entry.id} style={styles.historyItem}>
                                            <Text style={styles.historyItemTitle}>{formatAuditSummary(entry)}</Text>
                                            <Text style={styles.historyItemMeta}>{formatDateTime(entry.created_at)}</Text>
                                        </View>
                                    ))
                                )}
                            </ScrollView>
                        )}
                    </Pressable>
                </Pressable>
            </Modal>
        </Screen>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    center: {
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    header: {
        flexDirection: 'row',
        padding: 16,
        alignItems: 'center',
        gap: 12,
        backgroundColor: '#FFFFFF',
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9',
    },
    searchBar: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F8FAFC',
        borderRadius: 12,
        paddingHorizontal: 12,
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    searchIcon: {
        marginRight: 8,
    },
    searchInput: {
        flex: 1,
        paddingVertical: 12,
        fontSize: 15,
        color: '#0F172A',
    },
    refreshBtn: {
        padding: 12,
        backgroundColor: '#F8FAFC',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    listContent: {
        padding: 16,
        paddingBottom: 40,
    },
    userCard: {
        padding: 16,
        marginBottom: 12,
    },
    userTopRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        backgroundColor: 'transparent',
    },
    userLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
        backgroundColor: 'transparent',
    },
    avatar: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: '#EEF2FF',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    avatarText: {
        color: '#6366F1',
        fontWeight: '700',
        fontSize: 18,
    },
    userInfo: {
        flex: 1,
        backgroundColor: 'transparent',
    },
    userName: {
        fontSize: 16,
        fontWeight: '700',
        color: '#0F172A',
    },
    userEmail: {
        fontSize: 13,
        color: '#64748B',
        marginTop: 2,
    },
    userPhone: {
        fontSize: 13,
        color: '#94A3B8',
        marginTop: 2,
    },
    updatedAt: {
        fontSize: 12,
        color: '#94A3B8',
        marginTop: 6,
    },
    userRight: {
        paddingLeft: 12,
        alignItems: 'flex-end',
        gap: 8,
        backgroundColor: 'transparent',
    },
    roleBadge: {
        fontSize: 11,
        fontWeight: '800',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
        overflow: 'hidden',
    },
    roleAdmin: {
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        color: '#EF4444',
    },
    roleUser: {
        backgroundColor: 'rgba(99, 102, 241, 0.1)',
        color: '#6366F1',
    },
    planBadge: {
        fontSize: 11,
        fontWeight: '800',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
        overflow: 'hidden',
    },
    planFree: {
        backgroundColor: 'rgba(148, 163, 184, 0.14)',
        color: '#475569',
    },
    planPremium: {
        backgroundColor: 'rgba(16, 185, 129, 0.14)',
        color: '#047857',
    },
    actionRow: {
        flexDirection: 'row',
        gap: 10,
        marginTop: 14,
        backgroundColor: 'transparent',
    },
    secondaryActionButton: {
        flex: 1,
        minHeight: 42,
        borderRadius: 12,
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#CBD5E1',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
        gap: 8,
    },
    secondaryActionText: {
        fontSize: 13,
        fontWeight: '700',
        color: '#475569',
    },
    primaryActionButton: {
        flex: 1.1,
        minHeight: 42,
        borderRadius: 12,
        backgroundColor: '#0F172A',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
        gap: 8,
    },
    primaryActionText: {
        fontSize: 13,
        fontWeight: '800',
        color: '#FFFFFF',
    },
    savingText: {
        marginTop: 10,
        fontSize: 12,
        color: '#64748B',
    },
    errorText: {
        marginTop: 16,
        color: '#EF4444',
        fontSize: 16,
        textAlign: 'center',
    },
    retryBtn: {
        marginTop: 24,
        backgroundColor: '#6366F1',
        paddingHorizontal: 24,
        paddingVertical: 12,
        borderRadius: 8,
    },
    retryText: {
        color: '#FFFFFF',
        fontWeight: '700',
    },
    emptyContainer: {
        alignItems: 'center',
        padding: 40,
    },
    emptyText: {
        marginTop: 16,
        color: '#94A3B8',
        fontSize: 15,
    },
    modalBackdrop: {
        flex: 1,
        backgroundColor: 'rgba(15, 23, 42, 0.38)',
        justifyContent: 'center',
        padding: 20,
    },
    modalCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 24,
        padding: 20,
    },
    historyModalCard: {
        maxHeight: '72%',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 16,
        backgroundColor: 'transparent',
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: '900',
        color: '#0F172A',
    },
    modalSubtitle: {
        marginTop: 4,
        fontSize: 14,
        color: '#64748B',
    },
    closeButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#F8FAFC',
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    manageSummaryRow: {
        flexDirection: 'row',
        gap: 10,
        marginBottom: 18,
        backgroundColor: 'transparent',
    },
    summaryChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderRadius: 14,
        backgroundColor: '#F8FAFC',
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    summaryChipFree: {
        backgroundColor: 'rgba(148, 163, 184, 0.14)',
        borderColor: 'rgba(148, 163, 184, 0.18)',
    },
    summaryChipPremium: {
        backgroundColor: 'rgba(16, 185, 129, 0.12)',
        borderColor: 'rgba(16, 185, 129, 0.18)',
    },
    summaryChipText: {
        fontSize: 13,
        fontWeight: '800',
        color: '#334155',
    },
    summaryChipTextPremium: {
        color: '#047857',
    },
    managePrimaryButton: {
        minHeight: 48,
        borderRadius: 16,
        backgroundColor: '#6366F1',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
        gap: 8,
        marginBottom: 12,
    },
    managePrimaryButtonText: {
        fontSize: 15,
        fontWeight: '800',
        color: '#FFFFFF',
    },
    manageSecondaryButton: {
        minHeight: 46,
        borderRadius: 16,
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#CBD5E1',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
        gap: 8,
        marginBottom: 10,
    },
    manageSecondaryButtonText: {
        fontSize: 14,
        fontWeight: '700',
        color: '#1E293B',
    },
    manageDangerButton: {
        minHeight: 46,
        borderRadius: 16,
        backgroundColor: '#EF4444',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
        gap: 8,
        marginTop: 6,
    },
    manageDangerButtonText: {
        fontSize: 14,
        fontWeight: '800',
        color: '#FFFFFF',
    },
    supportSection: {
        marginTop: 8,
        marginBottom: 8,
        backgroundColor: 'transparent',
    },
    supportSectionTitle: {
        fontSize: 15,
        fontWeight: '800',
        color: '#0F172A',
        marginBottom: 10,
    },
    supportLoadingText: {
        fontSize: 13,
        color: '#64748B',
    },
    supportEmptyText: {
        fontSize: 13,
        color: '#94A3B8',
        lineHeight: 18,
    },
    supportItem: {
        padding: 12,
        borderRadius: 14,
        backgroundColor: '#F8FAFC',
        borderWidth: 1,
        borderColor: '#E2E8F0',
        marginBottom: 10,
    },
    supportItemHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        gap: 10,
        backgroundColor: 'transparent',
        marginBottom: 6,
    },
    supportItemTitle: {
        flex: 1,
        fontSize: 13,
        fontWeight: '800',
        color: '#0F172A',
    },
    supportItemMeta: {
        fontSize: 11,
        fontWeight: '700',
        color: '#94A3B8',
    },
    supportItemBody: {
        fontSize: 13,
        lineHeight: 18,
        color: '#475569',
    },
    supportItemFooter: {
        marginTop: 8,
        fontSize: 11,
        fontWeight: '700',
        color: '#64748B',
        textTransform: 'capitalize',
    },
    historyLoadingBox: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingVertical: 20,
        backgroundColor: 'transparent',
    },
    historyLoadingText: {
        fontSize: 14,
        color: '#64748B',
        fontWeight: '600',
    },
    historyList: {
        paddingBottom: 8,
    },
    historyItem: {
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9',
        backgroundColor: 'transparent',
    },
    historyItemTitle: {
        fontSize: 14,
        fontWeight: '700',
        color: '#0F172A',
        marginBottom: 4,
    },
    historyItemMeta: {
        fontSize: 12,
        color: '#64748B',
    },
    emptyHistoryText: {
        fontSize: 14,
        color: '#94A3B8',
        textAlign: 'center',
        paddingVertical: 20,
    },
});
