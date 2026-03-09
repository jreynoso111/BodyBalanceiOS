import React, { useState, useEffect } from 'react';
import { StyleSheet, FlatList, TouchableOpacity, View as RNView, Alert, RefreshControl } from 'react-native';
import { Text, View, Screen, Card } from '@/components/Themed';
import { AppLegalFooter } from '@/components/AppLegalFooter';
import { supabase } from '@/services/supabase';
import { useAuthStore } from '@/store/authStore';
import { Stack } from 'expo-router';
import { Check, X, Bell, ArrowDownLeft, Wallet, UserPlus } from 'lucide-react-native';
import { useI18n } from '@/hooks/useI18n';
import { getRequestedLoanAmount } from '@/utils/p2pRequests';

function getRequestTypeLabel(type: string) {
    if (type === 'friend_request') return 'Friend request';
    if (type === 'loan_validation') return 'Shared record confirmation';
    if (type === 'payment_validation') return 'Payment confirmation';
    if (type === 'debt_reduction') return 'Adjustment request';
    return 'Shared update';
}

function getRequestActionMessage(type: string, action: 'approved' | 'rejected') {
    if (action === 'approved') {
        if (type === 'friend_request') return 'You are now connected as friends.';
        if (type === 'loan_validation') return 'The shared record has been confirmed.';
        if (type === 'payment_validation') return 'The payment update has been confirmed.';
        if (type === 'debt_reduction') return 'The new total has been saved.';
        return 'The update has been confirmed.';
    }

    if (type === 'friend_request') return 'The friend request was declined.';
    if (type === 'loan_validation') return 'The shared record was declined.';
    if (type === 'payment_validation') return 'The payment update was declined.';
    if (type === 'debt_reduction') return 'The adjustment request was declined.';
    return 'The update was declined.';
}

function getDisplayName(request: any) {
    return request?.request_payload?.sender_name || request?.from_profile?.full_name || request?.from_profile?.email || 'Someone';
}

export default function RequestsScreen() {
    const { user } = useAuthStore();
    const { t } = useI18n();
    const [requests, setRequests] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);

    useEffect(() => {
        fetchRequests();
    }, [user]);

    useEffect(() => {
        if (!user?.id) return;

        const channel = supabase
            .channel(`requests:${user.id}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'p2p_requests',
                    filter: `to_user_id=eq.${user.id}`,
                },
                () => {
                    void fetchRequests();
                }
            )
            .subscribe();

        return () => {
            void supabase.removeChannel(channel);
        };
    }, [user?.id]);

    const fetchRequests = async () => {
        if (!user) return;
        setLoading(true);
        const { data, error } = await supabase
            .from('p2p_requests')
            .select('*, from_profile:profiles!from_user_id(full_name, email)')
            .eq('to_user_id', user.id)
            .eq('status', 'pending')
            .order('created_at', { ascending: false });

        if (error) console.error(error);
        setRequests(data || []);
        setLoading(false);
        setRefreshing(false);
    };

    const applyApprovedRequest = async (request: any) => {
        if (!user?.id) {
            throw new Error('User not found.');
        }

        if (request.type === 'loan_validation') {
            const { error } = await supabase.from('loans').update({ validation_status: 'approved' }).eq('id', request.loan_id);
            if (error) throw error;
            return;
        }

        if (request.type === 'payment_validation') {
            const { data: sourcePayment, error: paymentLoadError } = await supabase
                .from('payments')
                .select('id, loan_id, amount, payment_method, note, returned_item_name, payment_date, target_user_id')
                .eq('id', request.payment_id)
                .maybeSingle();

            if (paymentLoadError) throw paymentLoadError;
            if (!sourcePayment) throw new Error('Payment not found.');

            const { error } = await supabase
                .from('payments')
                .update({ validation_status: 'approved' })
                .eq('id', request.payment_id);
            if (error) throw error;

            const providedCounterpartLoanId = request?.request_payload?.counterpart_loan_id || null;
            let counterpartLoanId: string | null = providedCounterpartLoanId;

            if (!counterpartLoanId) {
                const { data: sourceLoan, error: sourceLoanError } = await supabase
                    .from('loans')
                    .select('id, amount, type, category, currency')
                    .eq('id', request.loan_id)
                    .maybeSingle();

                if (sourceLoanError) throw sourceLoanError;

                if (sourceLoan) {
                    const inverseType = sourceLoan.type === 'lent' ? 'borrowed' : 'lent';
                    const { data: counterpartLoans, error: counterpartLoansError } = await supabase
                        .from('loans')
                        .select('id, amount, status')
                        .eq('user_id', user.id)
                        .eq('target_user_id', request.from_user_id)
                        .eq('type', inverseType)
                        .eq('category', sourceLoan.category)
                        .eq('currency', sourceLoan.currency)
                        .is('deleted_at', null);

                    if (counterpartLoansError) throw counterpartLoansError;

                    counterpartLoanId = (counterpartLoans || [])
                        .sort((a: any, b: any) => {
                            const aAmountScore = Math.abs(Number(a.amount || 0) - Number(sourceLoan.amount || 0));
                            const bAmountScore = Math.abs(Number(b.amount || 0) - Number(sourceLoan.amount || 0));
                            if (aAmountScore !== bAmountScore) return aAmountScore - bAmountScore;

                            const aStatusScore = a.status === 'active' || a.status === 'partial' ? 0 : 1;
                            const bStatusScore = b.status === 'active' || b.status === 'partial' ? 0 : 1;
                            return aStatusScore - bStatusScore;
                        })[0]?.id || null;
                }
            }

            if (counterpartLoanId) {
                const { data: existingCounterpartPayment, error: existingCounterpartPaymentError } = await supabase
                    .from('payments')
                    .select('id')
                    .eq('loan_id', counterpartLoanId)
                    .eq('target_user_id', request.from_user_id)
                    .eq('payment_date', sourcePayment.payment_date)
                    .maybeSingle();

                if (existingCounterpartPaymentError) throw existingCounterpartPaymentError;

                if (existingCounterpartPayment?.id) {
                    const { error: counterpartUpdateError } = await supabase
                        .from('payments')
                        .update({
                            amount: sourcePayment.amount,
                            payment_method: sourcePayment.payment_method,
                            note: sourcePayment.note,
                            returned_item_name: sourcePayment.returned_item_name,
                            validation_status: 'approved',
                        })
                        .eq('id', existingCounterpartPayment.id);

                    if (counterpartUpdateError) throw counterpartUpdateError;
                } else {
                    const { error: counterpartInsertError } = await supabase
                        .from('payments')
                        .insert([
                            {
                                loan_id: counterpartLoanId,
                                user_id: user.id,
                                target_user_id: request.from_user_id,
                                amount: sourcePayment.amount,
                                payment_method: sourcePayment.payment_method,
                                note: sourcePayment.note,
                                returned_item_name: sourcePayment.returned_item_name,
                                payment_date: sourcePayment.payment_date,
                                validation_status: 'approved',
                            },
                        ]);

                    if (counterpartInsertError) throw counterpartInsertError;
                }
            }
            return;
        }

        if (request.type === 'debt_reduction') {
            const { data: loanRecord, error: loanError } = await supabase
                .from('loans')
                .select('id, amount')
                .eq('id', request.loan_id)
                .maybeSingle();

            if (loanError) throw loanError;
            if (!loanRecord) throw new Error('Shared record not found.');

            const currentAmount = Number(loanRecord.amount || 0);
            const nextAmount = getRequestedLoanAmount({
                currentAmount,
                requestPayload: request.request_payload,
                message: request.message,
            });

            if (!Number.isFinite(nextAmount)) {
                throw new Error('This request is missing the proposed total.');
            }

            const { data: payments, error: paymentsError } = await supabase
                .from('payments')
                .select('amount, payment_method')
                .eq('loan_id', request.loan_id);

            if (paymentsError) throw paymentsError;

            const totalPaid = (payments || []).reduce((acc: number, payment: any) => {
                if (payment.payment_method === 'item') return acc;
                return acc + Number(payment.amount || 0);
            }, 0);

            let nextStatus: 'active' | 'partial' | 'paid' = 'active';
            if ((nextAmount as number) <= totalPaid) nextStatus = 'paid';
            else if (totalPaid > 0) nextStatus = 'partial';

            const { error: updateError } = await supabase
                .from('loans')
                .update({ amount: nextAmount, status: nextStatus })
                .eq('id', request.loan_id);

            if (updateError) throw updateError;
        }
    };

    const applyRejectedRequest = async (request: any) => {
        if (request.type === 'loan_validation') {
            const { error } = await supabase.from('loans').update({ validation_status: 'rejected' }).eq('id', request.loan_id);
            if (error) throw error;
            return;
        }

        if (request.type === 'payment_validation') {
            const { error } = await supabase.from('payments').update({ validation_status: 'rejected' }).eq('id', request.payment_id);
            if (error) throw error;
        }
    };

    const handleAction = async (request: any, action: 'approved' | 'rejected') => {
        setLoading(true);

        try {
            if (request.type === 'friend_request') {
                const { error } = await supabase.rpc('resolve_friend_request', {
                    p_request_id: request.id,
                    p_action: action,
                });

                if (error) {
                    throw error;
                }

                Alert.alert('Success', getRequestActionMessage(request.type, action));
                await fetchRequests();
                return;
            }

            if (action === 'approved') {
                await applyApprovedRequest(request);
            } else {
                await applyRejectedRequest(request);
            }

            const { error: requestError } = await supabase
                .from('p2p_requests')
                .update({ status: action, updated_at: new Date().toISOString() })
                .eq('id', request.id);

            if (requestError) {
                throw requestError;
            }

            Alert.alert('Success', getRequestActionMessage(request.type, action));
            await fetchRequests();
        } catch (error: any) {
            Alert.alert('Error', error?.message || 'Something went wrong while updating this request.');
        } finally {
            setLoading(false);
        }
    };

    const renderRequestItem = ({ item }: { item: any }) => (
        <Card style={styles.requestCard}>
            <RNView style={styles.requestHeader}>
                <RNView style={styles.iconContainer}>
                    {item.type === 'loan_validation' ? <Wallet size={20} color="#6366F1" /> :
                        item.type === 'friend_request' ? <UserPlus size={20} color="#4F46E5" /> :
                        item.type === 'payment_validation' ? <Check size={20} color="#10B981" /> :
                            <ArrowDownLeft size={20} color="#F59E0B" />}
                </RNView>
                <RNView style={styles.headerInfo}>
                    <Text style={styles.requestType}>{getRequestTypeLabel(item.type)}</Text>
                    <Text style={styles.requestFrom}>from {getDisplayName(item)}</Text>
                </RNView>
            </RNView>

            <Text style={styles.requestMessage}>{item.message}</Text>

            <RNView style={styles.actionButtons}>
                <TouchableOpacity
                    style={[styles.actionBtn, styles.rejectBtn]}
                    onPress={() => handleAction(item, 'rejected')}
                    disabled={loading}
                >
                    <X size={18} color="#EF4444" />
                    <Text style={styles.rejectText}>Decline</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.actionBtn, styles.approveBtn]}
                    onPress={() => handleAction(item, 'approved')}
                    disabled={loading}
                >
                    <Check size={18} color="#fff" />
                    <Text style={styles.approveText}>Confirm</Text>
                </TouchableOpacity>
            </RNView>
        </Card>
    );

    return (
        <Screen style={styles.container}>
            <Stack.Screen options={{
                title: t('Pending Confirmations'),
                headerTransparent: true,
                headerTintColor: '#0F172A',
            }} />

            <FlatList
                data={requests}
                keyExtractor={(item) => item.id}
                renderItem={renderRequestItem}
                contentContainerStyle={styles.listContent}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchRequests(); }} />
                }
                ListEmptyComponent={
                    <View style={styles.emptyState}>
                        <Bell size={48} color="#CBD5E1" />
                        <Text style={styles.emptyTitle}>No pending confirmations</Text>
                        <Text style={styles.emptyDesc}>When someone shares or updates a record with you, it will show up here.</Text>
                    </View>
                }
                ListFooterComponent={<AppLegalFooter style={styles.copyright} />}
            />
        </Screen>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    listContent: {
        padding: 20,
        paddingTop: 120,
    },
    requestCard: {
        padding: 20,
        marginBottom: 16,
    },
    requestHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
        backgroundColor: 'transparent',
    },
    iconContainer: {
        width: 40,
        height: 40,
        borderRadius: 12,
        backgroundColor: 'rgba(148, 163, 184, 0.05)',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    headerInfo: {
        flex: 1,
        backgroundColor: 'transparent',
    },
    requestType: {
        fontSize: 16,
        fontWeight: '800',
        color: '#0F172A',
    },
    requestFrom: {
        fontSize: 12,
        color: '#64748B',
        fontWeight: '600',
        textTransform: 'uppercase',
        marginTop: 2,
    },
    requestMessage: {
        fontSize: 14,
        color: '#475569',
        lineHeight: 20,
        marginBottom: 20,
    },
    actionButtons: {
        flexDirection: 'row',
        gap: 12,
        backgroundColor: 'transparent',
    },
    actionBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        borderRadius: 12,
        gap: 8,
    },
    approveBtn: {
        backgroundColor: '#0F172A',
    },
    rejectBtn: {
        backgroundColor: 'rgba(239, 68, 68, 0.05)',
        borderWidth: 1,
        borderColor: 'rgba(239, 68, 68, 0.1)',
    },
    approveText: {
        color: '#fff',
        fontWeight: '700',
        fontSize: 14,
    },
    rejectText: {
        color: '#EF4444',
        fontWeight: '700',
        fontSize: 14,
    },
    emptyState: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: 100,
        backgroundColor: 'transparent',
    },
    emptyTitle: {
        fontSize: 18,
        fontWeight: '800',
        color: '#0F172A',
        marginTop: 20,
    },
    emptyDesc: {
        fontSize: 14,
        color: '#94A3B8',
        textAlign: 'center',
        paddingHorizontal: 40,
        marginTop: 8,
        lineHeight: 20,
    },
    copyright: {
        textAlign: 'center',
        color: '#94A3B8',
        fontSize: 12,
        fontWeight: '600',
        marginTop: 32,
        marginBottom: 32,
    },
});
