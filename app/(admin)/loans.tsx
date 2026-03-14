import React, { useEffect, useState } from 'react';
import { StyleSheet, View, Text, FlatList, TextInput, ActivityIndicator, TouchableOpacity } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Screen, Card } from '@/components/Themed';
import { supabase } from '@/services/supabase';
import { Search, Banknote, AlertCircle, ArrowLeft, RefreshCcw } from 'lucide-react-native';

interface AdminLoan {
    id: string;
    amount: number;
    currency: string;
    status: string;
    description: string;
    created_at: string;
    user_id: string;
    target_user_id: string | null;
    profiles: { full_name: string; email: string } | null;
    target_profiles: { full_name: string; email: string } | null;
}

export default function AdminLoansList() {
    const router = useRouter();
    const [loans, setLoans] = useState<AdminLoan[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [search, setSearch] = useState('');
    const [refreshing, setRefreshing] = useState(false);

    useEffect(() => {
        fetchLoans();
    }, []);

    const handleBack = () => {
        if (router.canGoBack()) {
            router.back();
            return;
        }

        router.replace('/admin');
    };

    const fetchLoans = async () => {
        setLoading(true);
        setError('');
        try {
            const { data, error } = await supabase
                .from('loans')
                .select(`
                    id,
                    amount,
                    currency,
                    status,
                    description,
                    created_at,
                    user_id,
                    target_user_id
                `)
                .order('created_at', { ascending: false });

            if (error) throw error;

            const baseLoans = (data || []) as Omit<AdminLoan, 'profiles' | 'target_profiles'>[];
            const profileIds = Array.from(
                new Set(
                    baseLoans.flatMap((loan) => [loan.user_id, loan.target_user_id]).filter((value): value is string => Boolean(value))
                )
            );

            let profilesById = new Map<string, { full_name: string; email: string }>();
            if (profileIds.length > 0) {
                const { data: profileRows, error: profilesError } = await supabase
                    .from('profiles')
                    .select('id, full_name, email')
                    .in('id', profileIds);

                if (profilesError) {
                    console.error('admin loans profile lookup failed:', profilesError.message);
                } else {
                    profilesById = new Map(
                        (profileRows || []).map((profile: any) => [
                            String(profile.id),
                            {
                                full_name: String(profile.full_name || ''),
                                email: String(profile.email || ''),
                            },
                        ])
                    );
                }
            }

            setLoans(
                baseLoans.map((loan) => ({
                    ...loan,
                    profiles: profilesById.get(loan.user_id) || null,
                    target_profiles: loan.target_user_id ? profilesById.get(loan.target_user_id) || null : null,
                }))
            );
        } catch (err: any) {
            setError(err.message || 'Failed to fetch lend/borrow records');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const handleRefresh = () => {
        setRefreshing(true);
        fetchLoans();
    };

    const filteredLoans = loans.filter((l) => {
        const query = search.toLowerCase();
        const userName = l.profiles?.full_name?.toLowerCase() || l.profiles?.email?.toLowerCase() || '';
        const targetName = l.target_profiles?.full_name?.toLowerCase() || l.target_profiles?.email?.toLowerCase() || '';
        const desc = (l.description || '').toLowerCase();

        return userName.includes(query) || targetName.includes(query) || desc.includes(query);
    });

    const getStatusColor = (status: string) => {
        if (status === 'active') return '#F59E0B';
        if (status === 'completed') return '#10B981';
        if (status === 'cancelled') return '#EF4444';
        return '#64748B';
    };

    const renderItem = ({ item }: { item: AdminLoan }) => {
        const lenderName = item.profiles?.full_name || item.profiles?.email || 'Unknown';
        const borrowerName = item.target_profiles?.full_name || item.target_profiles?.email || 'Unregistered';

        return (
            <Card style={styles.loanCard}>
                <View style={styles.loanHeader}>
                    <Text style={styles.loanAmount}>
                        {item.currency} {item.amount.toLocaleString()}
                    </Text>
                    <View style={[styles.statusBadge, { backgroundColor: `${getStatusColor(item.status)}15` }]}>
                        <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
                            {item.status.toUpperCase()}
                        </Text>
                    </View>
                </View>

                <View style={styles.loanBody}>
                    <Text style={styles.loanDesc} numberOfLines={1}>{item.description}</Text>

                    <View style={styles.participants}>
                        <View style={styles.participantCol}>
                            <Text style={styles.participantLabel}>From</Text>
                            <Text style={styles.participantName} numberOfLines={1}>{lenderName}</Text>
                        </View>
                        <View style={styles.participantDivider} />
                        <View style={styles.participantCol}>
                            <Text style={styles.participantLabel}>To</Text>
                            <Text style={styles.participantName} numberOfLines={1}>{borrowerName}</Text>
                        </View>
                    </View>
                </View>
            </Card>
        );
    };

    if (loading && !refreshing) {
        return (
            <Screen style={[styles.container, styles.center]}>
                <Stack.Screen
                    options={{
                        headerLeft: () => (
                            <TouchableOpacity onPress={handleBack} style={styles.headerBackButton}>
                                <ArrowLeft size={18} color="#0F172A" />
                            </TouchableOpacity>
                        ),
                    }}
                />
                <ActivityIndicator size="large" color="#6366F1" />
            </Screen>
        );
    }

    if (error) {
        return (
            <Screen style={[styles.container, styles.center]}>
                <Stack.Screen
                    options={{
                        headerLeft: () => (
                            <TouchableOpacity onPress={handleBack} style={styles.headerBackButton}>
                                <ArrowLeft size={18} color="#0F172A" />
                            </TouchableOpacity>
                        ),
                    }}
                />
                <AlertCircle size={48} color="#EF4444" />
                <Text style={styles.errorText}>{error}</Text>
                <View style={styles.errorActions}>
                    <TouchableOpacity onPress={handleBack} style={styles.secondaryBtn}>
                        <Text style={styles.secondaryBtnText}>Back to admin</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={fetchLoans} style={styles.retryBtn}>
                        <Text style={styles.retryText}>Retry</Text>
                    </TouchableOpacity>
                </View>
            </Screen>
        );
    }

    return (
        <Screen style={styles.container}>
            <Stack.Screen
                options={{
                    headerLeft: () => (
                        <TouchableOpacity onPress={handleBack} style={styles.headerBackButton}>
                            <ArrowLeft size={18} color="#0F172A" />
                        </TouchableOpacity>
                    ),
                }}
            />
            <View style={styles.header}>
                <View style={styles.searchBar}>
                    <Search size={20} color="#94A3B8" style={styles.searchIcon} />
                    <TextInput
                        placeholder="Search by user or description..."
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
                data={filteredLoans}
                keyExtractor={(item) => item.id}
                renderItem={renderItem}
                contentContainerStyle={styles.listContent}
                refreshing={refreshing}
                onRefresh={handleRefresh}
                ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                        <Banknote size={48} color="#CBD5E1" />
                        <Text style={styles.emptyText}>No lend/borrow records found.</Text>
                    </View>
                }
            />
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
    loanCard: {
        padding: 16,
        marginBottom: 12,
    },
    loanHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    loanAmount: {
        fontSize: 18,
        fontWeight: '800',
        color: '#0F172A',
    },
    statusBadge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
    },
    statusText: {
        fontSize: 11,
        fontWeight: '800',
    },
    loanBody: {
        marginTop: 4,
    },
    loanDesc: {
        fontSize: 14,
        color: '#475569',
        marginBottom: 12,
    },
    participants: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F8FAFC',
        padding: 12,
        borderRadius: 8,
    },
    participantCol: {
        flex: 1,
    },
    participantLabel: {
        fontSize: 11,
        color: '#94A3B8',
        fontWeight: '600',
        marginBottom: 2,
        textTransform: 'uppercase',
    },
    participantName: {
        fontSize: 14,
        fontWeight: '600',
        color: '#0F172A',
    },
    participantDivider: {
        width: 1,
        height: 24,
        backgroundColor: '#E2E8F0',
        marginHorizontal: 16,
    },
    errorText: {
        marginTop: 16,
        color: '#EF4444',
        fontSize: 16,
        textAlign: 'center',
    },
    errorActions: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 24,
        backgroundColor: 'transparent',
    },
    headerBackButton: {
        paddingHorizontal: 8,
        paddingVertical: 4,
    },
    secondaryBtn: {
        backgroundColor: '#FFFFFF',
        paddingHorizontal: 18,
        paddingVertical: 12,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#CBD5E1',
    },
    secondaryBtnText: {
        color: '#334155',
        fontWeight: '700',
    },
    retryBtn: {
        backgroundColor: '#6366F1',
        paddingHorizontal: 24,
        paddingVertical: 12,
        borderRadius: 8,
    },
    retryText: {
        color: 'white',
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
});
