import React, { useState, useEffect } from 'react';
import { StyleSheet, Text as RNText, ScrollView, TouchableOpacity, Alert, ActivityIndicator, View as RNView, TextInput, Image, Modal, Platform, RefreshControl } from 'react-native';
import { Text, View, Screen, Card } from '@/components/Themed';
import { AppLegalFooter } from '@/components/AppLegalFooter';
import { useLocalSearchParams, useNavigation, useRouter, Stack, useFocusEffect } from 'expo-router';
import { CommonActions } from '@react-navigation/native';
import { supabase } from '@/services/supabase';
import { ArrowLeft, Wallet, Calendar, Plus, Clock, FileText, Trash2, Edit, Box, ChevronRight, TrendingUp, TrendingDown, Zap, Activity, ShieldCheck, ShieldAlert, Shield, Bell, History, MoreHorizontal, Info, Share2, X } from 'lucide-react-native';
import { useAuthStore } from '@/store/authStore';
import { CURRENCIES, getCurrencySymbol } from '@/constants/Currencies';
import { getOrCreateUserPreferences, sanitizePreferredCurrencies, updateUserPreferences } from '@/services/userPreferences';
import { cancelLoanReminders, upsertLoanReminderForUser } from '@/services/notificationService';
import { shareLoanAsPdf } from '@/services/exportService';

const isMissingRequestPayloadColumn = (message?: string) =>
    String(message || '').toLowerCase().includes('request_payload');

export default function LoanDetailScreen() {
    const { id } = useLocalSearchParams();
    const loanId = Array.isArray(id) ? id[0] : id;
    const router = useRouter();
    const navigation = useNavigation();
    const { user, planTier } = useAuthStore();
    const [loan, setLoan] = useState<any>(null);
    const [payments, setPayments] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [note, setNote] = useState('');
    const [reminderFrequency, setReminderFrequency] = useState<string>('none');
    const [reminderInterval, setReminderInterval] = useState<string>('1');
    const [editCurrency, setEditCurrency] = useState('USD');
    const [editAmount, setEditAmount] = useState('');
    const [editItemName, setEditItemName] = useState('');
    const [editDueDate, setEditDueDate] = useState('');
    const [selectedPaymentHistory, setSelectedPaymentHistory] = useState<any[]>([]);
    const [historyModalVisible, setHistoryModalVisible] = useState(false);
    const [availableCurrencies, setAvailableCurrencies] = useState<string[]>(['USD']);
    const [currencyPickerVisible, setCurrencyPickerVisible] = useState(false);
    const [reductionModalVisible, setReductionModalVisible] = useState(false);
    const [reductionAmount, setReductionAmount] = useState('');
    const [reductionReason, setReductionReason] = useState('');
    const [sendingReductionRequest, setSendingReductionRequest] = useState(false);
    const [adjustmentModalVisible, setAdjustmentModalVisible] = useState(false);
    const [adjustedTotal, setAdjustedTotal] = useState('');
    const [savingAdjustedTotal, setSavingAdjustedTotal] = useState(false);
    const [sharingPdf, setSharingPdf] = useState(false);

    useFocusEffect(
        React.useCallback(() => {
            if (!loanId || !user?.id) return;
            void fetchLoanDetails();
        }, [loanId, user?.id])
    );

    useEffect(() => {
        if (!user?.id) return;
        void loadCurrencyPreferences();
    }, [user?.id]);

    const goToHome = () => {
        navigation.dispatch(
            CommonActions.reset({
                index: 0,
                routes: [{ name: '(tabs)' as never }],
            })
        );
    };

    const goBackToPrevious = () => {
        if (typeof navigation.canGoBack === 'function' && navigation.canGoBack()) {
            navigation.goBack();
            return;
        }

        goToHome();
    };

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
                    text: 'Confirm',
                    onPress: () => {
                        void onConfirm();
                    },
                },
            ]
        );
    };

    const fetchLoanDetails = async () => {
        if (!loanId) return;
        setLoading(true);
        const { data: loanData, error: loanError } = await supabase
            .from('loans')
            .select('*, contacts(name)')
            .eq('id', loanId)
            .is('deleted_at', null)
            .maybeSingle();

        if (loanError || !loanData) {
            Alert.alert('Error', loanError?.message || 'Record not found');
            goToHome();
            setLoading(false);
            return;
        }

        const { data: paymentData } = await supabase
            .from('payments')
            .select('*')
            .eq('loan_id', loanId)
            .order('payment_date', { ascending: false });

        setLoan(loanData);
        setNote(loanData.description || '');
        setReminderFrequency(loanData.reminder_frequency || 'none');
        setReminderInterval(loanData.reminder_interval?.toString() || '1');
        setEditCurrency(loanData.currency || 'USD');
        if (loanData.currency) {
            setAvailableCurrencies((current) => sanitizePreferredCurrencies([...current, loanData.currency]));
        }
        setEditAmount(loanData.amount ? String(loanData.amount) : '');
        setEditItemName(loanData.item_name || '');
        setEditDueDate(loanData.due_date || '');
        setPayments(paymentData || []);
        setLoading(false);
    };

    const handleRefresh = async () => {
        if (!loanId || !user?.id) return;
        setRefreshing(true);
        try {
            await Promise.all([fetchLoanDetails(), loadCurrencyPreferences()]);
        } finally {
            setRefreshing(false);
        }
    };

    const loadCurrencyPreferences = async () => {
        if (!user?.id) return;

        const { data, error } = await getOrCreateUserPreferences(user.id);
        if (error) {
            console.error('currency preferences load failed:', error.message);
            return;
        }

        const preferred = sanitizePreferredCurrencies(data?.preferred_currencies);
        setAvailableCurrencies(preferred);
        setEditCurrency((current) => (preferred.includes(current) ? current : preferred[0]));
    };

    const addableCurrencies = CURRENCIES.filter((c) => !availableCurrencies.includes(c.code));

    const openAddCurrencyPicker = () => {
        if (addableCurrencies.length === 0) {
            Alert.alert('Info', 'All available currencies are already enabled.');
            return;
        }
        setCurrencyPickerVisible(true);
    };

    const handleAddCurrency = async (code: string) => {
        const next = sanitizePreferredCurrencies([...availableCurrencies, code]);
        setAvailableCurrencies(next);
        setEditCurrency(code);
        setCurrencyPickerVisible(false);

        if (!user?.id) return;
        const { error } = await updateUserPreferences(user.id, { preferred_currencies: next });
        if (error) {
            Alert.alert('Error', error.message);
            await loadCurrencyPreferences();
        }
    };

    const openReductionModal = () => {
        setReductionAmount(safeLoanAmount > 0 ? String(safeLoanAmount) : '');
        setReductionReason('');
        setReductionModalVisible(true);
    };

    const openAdjustmentModal = () => {
        setAdjustedTotal(safeLoanAmount > 0 ? String(safeLoanAmount) : '');
        setAdjustmentModalVisible(true);
    };

    const closeAdjustmentModal = (force = false) => {
        if (savingAdjustedTotal && !force) return;
        setAdjustmentModalVisible(false);
        setAdjustedTotal('');
    };

    const handleCloseAdjustmentModal = () => {
        closeAdjustmentModal();
    };

    const closeReductionModal = (force = false) => {
        if (sendingReductionRequest && !force) return;
        setReductionModalVisible(false);
        setReductionAmount('');
        setReductionReason('');
    };

    const submitReductionRequest = async () => {
        if (!loan?.id || !user?.id || !loan?.target_user_id) {
            Alert.alert('Error', 'This request is unavailable right now.');
            return;
        }

        const parsedAmount = Number.parseFloat(reductionAmount);
        const normalizedReason = reductionReason.trim();

        if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
            Alert.alert('Error', 'Enter a valid new total.');
            return;
        }

        if (!normalizedReason) {
            Alert.alert('Error', 'Please add a short note so the other person has context.');
            return;
        }

        if (parsedAmount === safeLoanAmount) {
            Alert.alert('Error', 'Enter a different total than the current one.');
            return;
        }

        if (parsedAmount < totalPaid) {
            Alert.alert('Error', 'The new total cannot be lower than what is already marked as paid.');
            return;
        }

        setSendingReductionRequest(true);

        try {
            const formattedAmount = `${loan.currency || 'USD'} ${parsedAmount.toLocaleString()}`;
            const requestPayload = {
                mode: 'set_total',
                proposed_total: parsedAmount,
                currency: loan.currency || 'USD',
                reason: normalizedReason,
            };
            const requestRow = {
                type: 'debt_reduction',
                loan_id: loan.id,
                from_user_id: user.id,
                to_user_id: loan.target_user_id,
                message: `Suggested updating this shared total to ${formattedAmount}. Reason: ${normalizedReason}`,
                request_payload: requestPayload,
                status: 'pending',
            };

            let { error } = await supabase.from('p2p_requests').insert([requestRow]);

            if (error && isMissingRequestPayloadColumn(error.message)) {
                const fallback = await supabase.from('p2p_requests').insert([
                    {
                        type: requestRow.type,
                        loan_id: requestRow.loan_id,
                        from_user_id: requestRow.from_user_id,
                        to_user_id: requestRow.to_user_id,
                        message: requestRow.message,
                        status: requestRow.status,
                    },
                ]);
                error = fallback.error;
            }

            if (error) {
                Alert.alert('Error', error.message);
                return;
            }

            closeReductionModal(true);
            Alert.alert('Sent', 'Your suggestion has been shared.');
        } finally {
            setSendingReductionRequest(false);
        }
    };

    const submitAdjustedTotal = async () => {
        if (!loanId || !loan || !user?.id) {
            Alert.alert('Error', 'Record not found');
            return;
        }

        const parsedAmount = Number.parseFloat(adjustedTotal);
        if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
            Alert.alert('Error', 'Please enter a valid total.');
            return;
        }

        if (parsedAmount === safeLoanAmount) {
            Alert.alert('Info', 'The total is already set to that amount.');
            return;
        }

        if (parsedAmount < totalPaid) {
            Alert.alert('Error', 'The total cannot be lower than the amount already marked as paid.');
            return;
        }

        setSavingAdjustedTotal(true);

        try {
            const { error } = await supabase
                .from('loans')
                .update({ amount: parsedAmount })
                .eq('id', loanId)
                .is('deleted_at', null);

            if (error) {
                Alert.alert('Error', error.message);
                return;
            }

            const updatedLoanContext = {
                ...loan,
                amount: parsedAmount,
            };

            await syncLoanStatus(updatedLoanContext);
            closeAdjustmentModal(true);
            Alert.alert('Success', 'Total updated');
            await fetchLoanDetails();
        } finally {
            setSavingAdjustedTotal(false);
        }
    };

    const syncLoanStatus = async (loanOverride?: Record<string, any>) => {
        if (!loanId) return;

        const { data: loanSnapshot, error: loanSnapshotError } = await supabase
            .from('loans')
            .select('id, category, amount, type, currency, item_name')
            .eq('id', loanId)
            .single();

        if (loanSnapshotError || !loanSnapshot) return;

        const { data: itemSettlement } = await supabase
            .from('payments')
            .select('id')
            .eq('loan_id', loanId)
            .eq('payment_method', 'item')
            .limit(1);

        const hasItemSettlement = (itemSettlement?.length || 0) > 0;
        if (hasItemSettlement) {
            await supabase
                .from('loans')
                .update({ status: 'paid' })
                .eq('id', loanId);
            await cancelLoanReminders(String(loanId));
            return;
        }

        const { data: allMoneyPayments } = await supabase
            .from('payments')
            .select('amount')
            .eq('loan_id', loanId)
            .eq('payment_method', 'money');

        const totalPaid = (allMoneyPayments || []).reduce((acc, payment) => {
            const parsed = Number(payment.amount);
            return Number.isFinite(parsed) ? acc + parsed : acc;
        }, 0);

        const loanAmount = Number(loanSnapshot.amount);
        let nextStatus: 'active' | 'partial' | 'paid' = 'active';

        if (Number.isFinite(loanAmount) && loanAmount > 0) {
            if (totalPaid >= loanAmount) nextStatus = 'paid';
            else if (totalPaid > 0) nextStatus = 'partial';
        }

        await supabase
            .from('loans')
            .update({ status: nextStatus })
            .eq('id', loanId);

        if (nextStatus === 'paid') {
            await cancelLoanReminders(String(loanId));
            return;
        }

        const loanContext = loanOverride ? { ...loan, ...loanOverride } : loan;
        if (!user?.id || !loanContext) return;
        await upsertLoanReminderForUser({
            userId: user.id,
            loanId: String(loanId),
            contactName: loanContext?.contacts?.name || 'Someone',
            amount: (loanSnapshot as any)?.category === 'money' ? Number((loanSnapshot as any)?.amount || 0) : 0,
            dueDate: loanContext?.due_date || new Date().toISOString().split('T')[0],
            category: loanContext?.category || (loanSnapshot as any)?.category || 'money',
            direction: loanContext?.type || (loanSnapshot as any)?.type || 'lent',
            status: nextStatus,
            frequency: loanContext?.reminder_frequency || 'none',
            interval: Number(loanContext?.reminder_interval || 1),
            currency: loanContext?.currency || (loanSnapshot as any)?.currency || null,
            itemName: loanContext?.item_name || (loanSnapshot as any)?.item_name || null,
        });
    };

    const handleUpdate = async () => {
        if (!loanId || !user?.id) {
            Alert.alert('Error', 'Record not found');
            return;
        }

        if (loan?.category === 'money') {
            const parsedAmount = parseFloat(editAmount);
            if (!editAmount || Number.isNaN(parsedAmount) || parsedAmount <= 0) {
                Alert.alert('Error', 'Please enter a valid amount');
                return;
            }
        }

        if (loan?.category === 'item' && !editItemName.trim()) {
            Alert.alert('Error', 'Item name is required');
            return;
        }

        if (editDueDate && Number.isNaN(new Date(editDueDate).getTime())) {
            Alert.alert('Error', 'Due date must be a valid date (YYYY-MM-DD)');
            return;
        }

        const payload: Record<string, any> = {
            description: note.trim() || null,
            reminder_frequency: reminderFrequency,
            reminder_interval: parseInt(reminderInterval) || 1,
            due_date: editDueDate || null,
        };

        if (loan?.category === 'money') {
            payload.currency = editCurrency;
            payload.amount = parseFloat(editAmount);
            payload.item_name = null;
        } else {
            payload.item_name = editItemName.trim();
        }

        const { data, error } = await supabase
            .from('loans')
            .update(payload)
            .eq('id', loanId)
            .is('deleted_at', null)
            .select('id');

        if (error) {
            Alert.alert('Error', error.message);
        } else if (!data || data.length === 0) {
            Alert.alert('Error', 'Record could not be updated');
        } else {
            const updatedLoanContext = {
                ...loan,
                ...payload,
                amount: loan?.category === 'money' ? Number.parseFloat(editAmount) : loan?.amount,
                currency: loan?.category === 'money' ? editCurrency : loan?.currency,
                item_name: loan?.category === 'item' ? editItemName.trim() : null,
            };

            await syncLoanStatus(updatedLoanContext);
            Alert.alert('Success', 'Record updated');
            setIsEditing(false);
            fetchLoanDetails();
        }
    };

    const handleDeletePayment = (paymentId: string) => {
        if (!loanId || !user?.id) {
            Alert.alert('Error', 'Record not found');
            return;
        }

        confirmAction(
            'Delete Payment',
            'Are you sure you want to delete this payment? This action cannot be undone.',
            async () => {
                const { error } = await supabase
                    .from('payments')
                    .delete()
                    .eq('id', paymentId)
                    .eq('loan_id', loanId);

                if (error) {
                    Alert.alert('Error', error.message);
                    return;
                }

                await syncLoanStatus();
                await fetchLoanDetails();
                Alert.alert('Success', 'Payment deleted');
            }
        );
    };

    const handleDelete = async () => {
        if (!loanId || !user?.id) {
            Alert.alert('Error', 'Record not found');
            return;
        }

        confirmAction(
            'Delete Record',
            'Are you sure you want to delete this record? This action is undoable only by contact supports.',
            async () => {
                await confirmDelete();
            }
        );
    };

    const confirmDelete = async () => {
        if (!loanId || !user?.id) {
            Alert.alert('Error', 'Record not found');
            return;
        }

        try {
            setLoading(true);

            const { error: hardDeleteError, count } = await supabase
                .from('loans')
                .delete({ count: 'exact' })
                .eq('id', loanId)
                .eq('user_id', user.id);

            if (!hardDeleteError && (count ?? 0) > 0) {
                await cancelLoanReminders(String(loanId));
                Alert.alert('Success', 'Record deleted');
                router.replace('/(tabs)');
                return;
            }

            const { data, error } = await supabase
                .from('loans')
                .update({ deleted_at: new Date().toISOString() })
                .eq('id', loanId)
                .eq('user_id', user.id)
                .select('id');

            if (error) {
                Alert.alert('Error', error.message);
                return;
            }

            if (!data || data.length === 0) {
                Alert.alert('Error', 'Record could not be deleted');
                return;
            }

            await cancelLoanReminders(String(loanId));
            Alert.alert('Success', 'Record deleted');
            router.replace('/(tabs)');
        } catch (error: any) {
            Alert.alert('Error', error?.message || 'Unexpected error deleting record');
        } finally {
            setLoading(false);
        }
    };

    const fetchPaymentHistory = async (paymentId: string) => {
        const { data, error } = await supabase
            .from('payment_history')
            .select('*')
            .eq('payment_id', paymentId)
            .order('created_at', { ascending: false });

        if (error) {
            Alert.alert('Error', 'Could not fetch history');
        } else {
            setSelectedPaymentHistory(data || []);
            setHistoryModalVisible(true);
        }
    };

    const handleSharePdf = async () => {
        if (planTier !== 'premium') {
            Alert.alert('Premium feature', 'PDF sharing is available only for Premium accounts.');
            return;
        }

        if (!loan?.id) {
            Alert.alert('Error', 'Record not found');
            return;
        }

        setSharingPdf(true);

        try {
            const paymentIds = payments.map((payment) => payment.id).filter(Boolean);
            const paymentHistoryByPaymentId: Record<string, any[]> = {};

            if (paymentIds.length > 0) {
                const { data: paymentHistoryData, error: paymentHistoryError } = await supabase
                    .from('payment_history')
                    .select('*')
                    .in('payment_id', paymentIds)
                    .order('created_at', { ascending: false });

                if (paymentHistoryError) {
                    console.error('payment history export load failed:', paymentHistoryError.message);
                } else {
                    (paymentHistoryData || []).forEach((entry) => {
                        const current = paymentHistoryByPaymentId[entry.payment_id] || [];
                        current.push(entry);
                        paymentHistoryByPaymentId[entry.payment_id] = current;
                    });
                }
            }

            await shareLoanAsPdf({
                loan,
                payments,
                paymentHistoryByPaymentId,
                summary: {
                    remaining,
                    totalPaid,
                    safeLoanAmount,
                    timeProgress,
                    paymentProgress: paymentProgressClamped,
                    avgPayment,
                    daysSinceLastPayment,
                    health,
                },
            });
        } finally {
            setSharingPdf(false);
        }
    };

    if (loading) return <View style={styles.centered}><ActivityIndicator size="large" color="#000" /></View>;

    const loanAmountValue = Number(loan.amount);
    const safeLoanAmount = Number.isFinite(loanAmountValue) && loanAmountValue > 0 ? loanAmountValue : 0;
    const totalPaid = payments.reduce((acc, p) => {
        const paymentAmount = Number(p.amount);
        return Number.isFinite(paymentAmount) ? acc + paymentAmount : acc;
    }, 0);
    const remaining = Math.max(safeLoanAmount - totalPaid, 0);
    const canSuggestNewTotal = loan.category === 'money' && loan.status !== 'paid' && !!loan.target_user_id;
    const canAdjustTotalDirectly = loan.category === 'money' && loan.status !== 'paid' && !canSuggestNewTotal;

    const openPaymentForm = (paymentId?: string) => {
        router.push({
            pathname: '/payment',
            params: {
                loanId: String(loan.id),
                remaining: String(remaining),
                currency: String(loan.currency || 'USD'),
                category: String(loan.category || 'money'),
                ...(paymentId ? { paymentId: String(paymentId) } : {}),
            },
        } as any);
    };

    // Analytics Calculations
    const totalDays = loan.due_date ? Math.max(1, (new Date(loan.due_date).getTime() - new Date(loan.created_at).getTime()) / (1000 * 60 * 60 * 24)) : 0;
    const elapsedDays = Math.max(0, (new Date().getTime() - new Date(loan.created_at).getTime()) / (1000 * 60 * 60 * 24));
    const timeProgress = totalDays > 0 ? Math.min(100, (elapsedDays / totalDays) * 100) : 0;
    const paymentProgress = safeLoanAmount > 0 ? (totalPaid / safeLoanAmount) * 100 : 0;
    const paymentProgressClamped = Math.max(0, Math.min(paymentProgress, 100));

    let health: 'ahead' | 'on_track' | 'behind' = 'on_track';
    if (paymentProgress > timeProgress + 10) health = 'ahead';
    else if (paymentProgress < timeProgress - 10) health = 'behind';

    const avgPayment = payments.length > 0 ? totalPaid / payments.length : 0;
    const daysSinceLastPayment = payments.length > 0 ? (new Date().getTime() - new Date(payments[0].payment_date).getTime()) / (1000 * 60 * 60 * 24) : elapsedDays;

    return (
        <Screen style={styles.container}>
            <Stack.Screen
                options={{
                    title: 'Record Details',
                    headerLeft: () => (
                        <TouchableOpacity onPress={goBackToPrevious} style={styles.closeHeaderBtn}>
                            <ArrowLeft size={20} color="#0F172A" />
                        </TouchableOpacity>
                    ),
                    headerRight: () => (
                        <RNView style={styles.headerActions}>
                            {planTier === 'premium' ? (
                                <TouchableOpacity onPress={() => void handleSharePdf()} style={styles.shareHeader} disabled={sharingPdf}>
                                    {sharingPdf ? <ActivityIndicator size="small" color="#4F46E5" /> : <Share2 size={20} color="#4F46E5" />}
                                </TouchableOpacity>
                            ) : null}
                            <TouchableOpacity onPress={handleDelete} style={styles.deleteHeader}>
                                <Trash2 size={20} color="#EF4444" />
                            </TouchableOpacity>
                        </RNView>
                    )
                }}
            />
            <ScrollView
                contentContainerStyle={styles.scroll}
                showsVerticalScrollIndicator={false}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void handleRefresh()} />}
            >
                <Card style={styles.mainCard}>
                    <RNView style={styles.headerRow}>
                        <RNView style={[styles.iconBox, { backgroundColor: loan.category === 'item' ? 'rgba(99, 102, 241, 0.1)' : 'rgba(148, 163, 184, 0.05)' }]}>
                            {loan.category === 'item' ? (
                                <Box size={32} color="#6366F1" />
                            ) : (
                                <Wallet size={32} color={loan.type === 'lent' ? '#10B981' : '#EF4444'} />
                            )}
                        </RNView>
                        <RNView style={styles.headerInfo}>
                            <Text style={styles.headerName}>{loan.contacts?.name}</Text>
                            <Text style={styles.headerSub}>
                                {loan.category === 'item' ? 'Shared item' : (loan.type === 'lent' ? 'You shared money' : 'You received money')}
                            </Text>
                        </RNView>
                    </RNView>

                    <RNText style={styles.amountLabel}>Still open</RNText>
                    <Text style={styles.amountText}>
                        {loan.category === 'item' ? loan.item_name : `${getCurrencySymbol(loan.currency)}${remaining.toLocaleString()}`}
                    </Text>

                    {loan.category === 'money' && (
                        <RNView style={styles.balanceBreakdown}>
                            <RNView style={styles.breakdownItem}>
                                <RNText style={styles.breakdownLabel}>Paid</RNText>
                                <Text style={styles.breakdownValue}>{getCurrencySymbol(loan.currency)}{totalPaid.toLocaleString()}</Text>
                            </RNView>
                            <RNView style={[styles.breakdownItem, { alignItems: 'flex-end' }]}>
                                <RNText style={styles.breakdownLabel}>Original Total</RNText>
                                <Text style={styles.breakdownValue}>{getCurrencySymbol(loan.currency)}{safeLoanAmount.toLocaleString()}</Text>
                            </RNView>
                        </RNView>
                    )}

                    {loan.category === 'money' && (
                        <RNView style={styles.progressSection}>
                            <RNView style={styles.progressLabels}>
                                <Text style={styles.progressLabel}>Progress</Text>
                                <Text style={styles.progressPercent}>{Math.round(paymentProgressClamped)}%</Text>
                            </RNView>
                            <RNView style={styles.progressBar}>
                                <RNView style={[styles.progressFill, { width: `${paymentProgressClamped}%` }]} />
                            </RNView>
                        </RNView>
                    )}
                </Card>

                <Card style={styles.detailsCard}>
                    <Text style={styles.sectionTitle}>Information</Text>
                    <RNView style={styles.infoRow}>
                        <RNView style={styles.infoItem}>
                            <Calendar size={18} color="#94A3B8" />
                            <Text style={styles.infoLabel}>Due Date</Text>
                            <Text style={styles.infoValue}>{loan.due_date ? new Date(loan.due_date).toLocaleDateString() : 'No date'}</Text>
                        </RNView>
                        <RNView style={styles.infoItem}>
                            <Clock size={18} color="#94A3B8" />
                            <Text style={styles.infoLabel}>Status</Text>
                            <Text style={[styles.infoValue, { textTransform: 'uppercase', color: loan.status === 'paid' ? '#10B981' : '#6366F1' }]}>{loan.status}</Text>
                        </RNView>
                    </RNView>

                    {!isEditing && (
                        <TouchableOpacity style={styles.saveNoteBtn} onPress={() => setIsEditing(true)}>
                            <Text style={styles.saveNoteText}>Edit details</Text>
                        </TouchableOpacity>
                    )}

                    {isEditing && (
                        <RNView>
                            {loan.category === 'money' ? (
                                <RNView>
                                    <Text style={styles.label}>Currency</Text>
                                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.currencySelector}>
                                        {availableCurrencies.map((code) => (
                                            <TouchableOpacity
                                                key={code}
                                                onPress={() => setEditCurrency(code)}
                                                style={[styles.currencyChip, editCurrency === code && styles.currencyChipActive]}
                                            >
                                                <Text style={[styles.currencyChipText, editCurrency === code && styles.currencyChipTextActive]}>
                                                    {code}
                                                </Text>
                                            </TouchableOpacity>
                                        ))}
                                        <TouchableOpacity style={styles.currencyAddChip} onPress={openAddCurrencyPicker}>
                                            <Plus size={14} color="#475569" />
                                            <Text style={styles.currencyAddChipText}>Add</Text>
                                        </TouchableOpacity>
                                    </ScrollView>

                                    <Text style={styles.label}>Amount</Text>
                                    <TextInput
                                        placeholder="0.00"
                                        placeholderTextColor="#94A3B8"
                                        value={editAmount}
                                        onChangeText={setEditAmount}
                                        keyboardType="decimal-pad"
                                        style={styles.input}
                                    />
                                </RNView>
                            ) : (
                                <RNView>
                                    <Text style={styles.label}>Item Name</Text>
                                    <TextInput
                                        placeholder="Item name"
                                        placeholderTextColor="#94A3B8"
                                        value={editItemName}
                                        onChangeText={setEditItemName}
                                        style={styles.input}
                                    />
                                </RNView>
                            )}

                            <Text style={styles.label}>Due Date</Text>
                            <TextInput
                                placeholder="YYYY-MM-DD"
                                placeholderTextColor="#94A3B8"
                                value={editDueDate}
                                onChangeText={setEditDueDate}
                                style={styles.input}
                            />
                        </RNView>
                    )}

                    <Text style={[styles.sectionTitle, { marginTop: 24 }]}>Description</Text>
                    {isEditing ? (
                        <RNView style={styles.editWrapper}>
                            <TextInput
                                style={styles.noteInput}
                                value={note}
                                onChangeText={setNote}
                                multiline
                                placeholder="Add a description..."
                                placeholderTextColor="#94A3B8"
                            />
                            <TouchableOpacity style={styles.saveNoteBtn} onPress={handleUpdate}>
                                <Text style={styles.saveNoteText}>Save Changes</Text>
                            </TouchableOpacity>
                        </RNView>
                    ) : (
                        <TouchableOpacity style={styles.descriptionBox} onPress={() => setIsEditing(true)}>
                            <Text style={styles.descriptionText}>
                                {loan.description || 'No description provided. Tap to add one.'}
                            </Text>
                            <Edit size={16} color="#94A3B8" />
                        </TouchableOpacity>
                    )}

                    <Text style={[styles.sectionTitle, { marginTop: 24 }]}>Reminders</Text>
                    {isEditing ? (
                        <RNView>
                            <Text style={styles.label}>Frequency</Text>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.currencySelector}>
                                {['none', 'daily', 'weekly', 'custom', 'monthly', 'yearly'].map((f) => (
                                    <TouchableOpacity
                                        key={f}
                                        onPress={() => setReminderFrequency(f as any)}
                                        style={[styles.currencyChip, reminderFrequency === f && styles.currencyChipActive]}
                                    >
                                        <Text style={[styles.currencyChipText, reminderFrequency === f && styles.currencyChipTextActive]}>
                                            {f.charAt(0).toUpperCase() + f.slice(1)}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>
                            {reminderFrequency === 'custom' && (
                                <RNView>
                                    <Text style={styles.label}>Every X days</Text>
                                    <TextInput
                                        placeholder="e.g. 3"
                                        placeholderTextColor="#94A3B8"
                                        value={reminderInterval}
                                        onChangeText={setReminderInterval}
                                        keyboardType="number-pad"
                                        style={styles.input}
                                    />
                                </RNView>
                            )}
                        </RNView>
                    ) : (
                        <RNView style={styles.infoRow}>
                            <RNView style={styles.infoItem}>
                                <Bell size={18} color="#94A3B8" />
                                <Text style={styles.infoLabel}>Frequency</Text>
                                <Text style={styles.infoValue}>
                                    {loan.reminder_frequency === 'custom'
                                        ? `Every ${loan.reminder_interval} days`
                                        : (loan.reminder_frequency?.charAt(0).toUpperCase() + loan.reminder_frequency?.slice(1) || 'None')}
                                </Text>
                            </RNView>
                        </RNView>
                    )}
                </Card>

                {loan.evidence_url && (
                    <Card style={styles.evidenceCard}>
                        <Text style={styles.sectionTitle}>Evidence</Text>
                        <TouchableOpacity
                            style={styles.attachmentButton}
                            onPress={() => {
                                const { data } = supabase.storage.from('receipts').getPublicUrl(loan.evidence_url);
                                Alert.alert('Attachment', 'Opening secure receipt view...');
                            }}
                        >
                            <FileText size={20} color="#6366F1" />
                            <Text style={styles.attachmentLabel}>View Attached Receipt</Text>
                            <ChevronRight size={18} color="#94A3B8" />
                        </TouchableOpacity>
                    </Card>
                )}

                {loan.category === 'money' && (
                    <RNView style={styles.analyticsSection}>
                        <Text style={styles.sectionTitle}>Record insights</Text>
                        <RNView style={styles.analyticsGrid}>
                            <Card style={styles.analyticsCard}>
                                <RNView style={[styles.analyticsIcon, { backgroundColor: health === 'ahead' ? 'rgba(16, 185, 129, 0.1)' : health === 'behind' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(99, 102, 241, 0.1)' }]}>
                                    {health === 'ahead' ? <ShieldCheck size={20} color="#10B981" /> : health === 'behind' ? <ShieldAlert size={20} color="#EF4444" /> : <Shield size={20} color="#6366F1" />}
                                </RNView>
                                <Text style={styles.analyticsLabel}>Pace</Text>
                                <Text style={[styles.analyticsValue, { color: health === 'ahead' ? '#10B981' : health === 'behind' ? '#EF4444' : '#6366F1' }]}>
                                    {health === 'ahead' ? 'Ahead' : health === 'behind' ? 'Needs attention' : 'On track'}
                                </Text>
                            </Card>

                            <Card style={styles.analyticsCard}>
                                <RNView style={[styles.analyticsIcon, { backgroundColor: 'rgba(245, 158, 11, 0.1)' }]}>
                                    <Zap size={20} color="#F59E0B" />
                                </RNView>
                                <Text style={styles.analyticsLabel}>Average payment</Text>
                                <Text style={styles.analyticsValue}>{getCurrencySymbol(loan.currency)}{Math.round(avgPayment).toLocaleString()}/entry</Text>
                            </Card>
                        </RNView>

                        <Card style={styles.efficiencyCard}>
                            <RNView style={styles.efficiencyHeader}>
                                <TrendingUp size={18} color="#6366F1" />
                                <Text style={styles.efficiencyTitle}>How it's going</Text>
                            </RNView>
                            <Text style={styles.efficiencyDesc}>
                                {health === 'ahead'
                                    ? "This record is moving faster than expected."
                                    : health === 'behind'
                                        ? "This one is moving slower than expected. A quick follow-up may help."
                                        : "Everything looks steady so far."}
                            </Text>
                        </Card>
                    </RNView>
                )}

                <RNView style={styles.timelineSection}>
                    <Text style={styles.sectionTitle}>{loan.category === 'money' ? 'Payments & history' : 'Activity history'}</Text>
                    <RNView style={styles.timelineContainer}>
                        <RNView style={styles.timelineLine} />
                        <RNView style={styles.timelineItem}>
                            <RNView style={[styles.timelineDot, { backgroundColor: '#CBD5E1' }]} />
                            <RNView style={styles.timelineContent}>
                                <Text style={styles.timelineTitle}>Record created</Text>
                                <Text style={styles.timelineDate}>{new Date(loan.created_at).toLocaleDateString()}</Text>
                            </RNView>
                        </RNView>

                        {payments.length === 0 && loan.category === 'money' ? (
                            <Card style={styles.emptyTimelineCard}>
                                <Text style={styles.emptyTimelineTitle}>No payments logged yet</Text>
                                <Text style={styles.emptyTimelineText}>
                                    Add the first payment here so the record keeps a clear history.
                                </Text>
                                <TouchableOpacity style={styles.emptyTimelineButton} onPress={() => openPaymentForm()}>
                                    <Text style={styles.emptyTimelineButtonText}>Add payment</Text>
                                </TouchableOpacity>
                            </Card>
                        ) : null}

                        {payments.map((p) => (
                            <RNView key={p.id} style={styles.timelineItem}>
                                <RNView style={[styles.timelineDot, { backgroundColor: '#10B981' }]} />
                                <RNView style={styles.timelineContent}>
                                    <RNView style={styles.timelineHeader}>
                                        <Text style={styles.timelineTitle}>
                                            {p.payment_method === 'item'
                                                ? 'Item returned'
                                                : `Payment logged: ${getCurrencySymbol(loan.currency)}${Number(p.amount).toLocaleString()}`}
                                        </Text>
                                        <RNView style={styles.paymentActions}>
                                            <TouchableOpacity
                                                onPress={() => fetchPaymentHistory(p.id)}
                                                style={styles.actionIcon}
                                                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                            >
                                                <History size={16} color="#64748B" />
                                            </TouchableOpacity>
                                            <TouchableOpacity
                                                onPress={() => openPaymentForm(p.id)}
                                                style={styles.actionIcon}
                                                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                            >
                                                <Edit size={16} color="#64748B" />
                                            </TouchableOpacity>
                                            <TouchableOpacity
                                                onPress={() => handleDeletePayment(p.id)}
                                                style={styles.actionIcon}
                                                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                            >
                                                <Trash2 size={16} color="#EF4444" />
                                            </TouchableOpacity>
                                        </RNView>
                                    </RNView>
                                    <Text style={styles.timelineDate}>{new Date(p.payment_date).toLocaleDateString()}</Text>
                                    {p.note ? <Text style={styles.paymentNote}>{p.note}</Text> : null}
                                    {p.returned_item_name ? <Text style={styles.paymentNote}>Item: {p.returned_item_name}</Text> : null}
                                </RNView>
                            </RNView>
                        ))}
                    </RNView>
                </RNView>

                <AppLegalFooter style={styles.copyright} />
            </ScrollView>

            <Modal
                animationType="slide"
                transparent={true}
                visible={historyModalVisible}
                onRequestClose={() => setHistoryModalVisible(false)}
            >
                <RNView style={styles.modalOverlay}>
                    <RNView style={styles.modalContent}>
                        <RNView style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Modification History</Text>
                            <TouchableOpacity onPress={() => setHistoryModalVisible(false)}>
                                <X size={24} color="#0F172A" />
                            </TouchableOpacity>
                        </RNView>

                        <ScrollView style={styles.historyList}>
                            {selectedPaymentHistory.length === 0 ? (
                                <RNView style={styles.emptyHistory}>
                                    <Info size={40} color="#CBD5E1" />
                                    <Text style={styles.emptyHistoryText}>No modifications recorded for this payment.</Text>
                                </RNView>
                            ) : (
                                selectedPaymentHistory.map((h) => (
                                    <RNView key={h.id} style={styles.historyItem}>
                                        <RNView style={styles.historyIconBox}>
                                            <Edit size={16} color="#6366F1" />
                                        </RNView>
                                        <RNView style={styles.historyDetails}>
                                            <Text style={styles.historyDate}>{new Date(h.created_at).toLocaleString()}</Text>
                                            <Text style={styles.historyReason}>{h.change_reason}</Text>
                                            {h.old_amount !== h.new_amount && (
                                                <Text style={styles.historyChange}>
                                                    Amount: {getCurrencySymbol(loan.currency)}{h.old_amount} → {getCurrencySymbol(loan.currency)}{h.new_amount}
                                                </Text>
                                            )}
                                            {h.old_note !== h.new_note && (
                                                <Text style={styles.historyChange}>
                                                    Note: "{h.old_note || 'N/A'}" → "{h.new_note || 'N/A'}"
                                                </Text>
                                            )}
                                            {h.old_item_name !== h.new_item_name && (
                                                <Text style={styles.historyChange}>
                                                    Item: "{h.old_item_name || 'N/A'}" → "{h.new_item_name || 'N/A'}"
                                                </Text>
                                            )}
                                        </RNView>
                                    </RNView>
                                ))
                            )}
                        </ScrollView>
                    </RNView>
                </RNView>
            </Modal>

            <Modal
                animationType="slide"
                transparent
                visible={currencyPickerVisible}
                onRequestClose={() => setCurrencyPickerVisible(false)}
            >
                <RNView style={styles.currencyModalOverlay}>
                    <Card style={styles.currencyModalCard}>
                        <Text style={styles.currencyModalTitle}>Add Currency</Text>
                        <ScrollView style={styles.currencyModalList}>
                            {addableCurrencies.map((c) => (
                                <TouchableOpacity
                                    key={c.code}
                                    style={styles.currencyModalItem}
                                    onPress={() => {
                                        void handleAddCurrency(c.code);
                                    }}
                                >
                                    <Text style={styles.currencyModalCode}>{c.code}</Text>
                                    <Text style={styles.currencyModalName}>{c.name}</Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                        <TouchableOpacity style={styles.currencyModalClose} onPress={() => setCurrencyPickerVisible(false)}>
                            <Text style={styles.currencyModalCloseText}>Close</Text>
                        </TouchableOpacity>
                    </Card>
                </RNView>
            </Modal>

            <Modal
                animationType="slide"
                transparent
                visible={reductionModalVisible}
                onRequestClose={() => closeReductionModal()}
            >
                <RNView style={styles.reductionModalOverlay}>
                    <Card style={styles.reductionModalCard}>
                        <RNView style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Suggest a new total</Text>
                            <TouchableOpacity onPress={() => closeReductionModal()} disabled={sendingReductionRequest}>
                                <X size={24} color="#0F172A" />
                            </TouchableOpacity>
                        </RNView>
                        <Text style={styles.reductionModalDescription}>
                            Suggest a higher or lower total for this shared record and explain why.
                        </Text>
                        <Text style={styles.label}>Suggested total</Text>
                        <TextInput
                            value={reductionAmount}
                            onChangeText={setReductionAmount}
                            keyboardType="decimal-pad"
                            placeholder="0.00"
                            placeholderTextColor="#94A3B8"
                            style={styles.input}
                            editable={!sendingReductionRequest}
                        />
                        <Text style={styles.label}>Reason</Text>
                        <TextInput
                            value={reductionReason}
                            onChangeText={setReductionReason}
                            placeholder="Add a short note"
                            placeholderTextColor="#94A3B8"
                            style={[styles.input, styles.reductionReasonInput]}
                            multiline
                            textAlignVertical="top"
                            editable={!sendingReductionRequest}
                        />
                        <RNView style={styles.reductionModalActions}>
                            <TouchableOpacity
                                style={styles.reductionCancelButton}
                                onPress={() => closeReductionModal()}
                                disabled={sendingReductionRequest}
                            >
                                <Text style={styles.reductionCancelButtonText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[
                                    styles.reductionSubmitButton,
                                    sendingReductionRequest && styles.reductionSubmitButtonDisabled,
                                ]}
                                onPress={() => {
                                    void submitReductionRequest();
                                }}
                                disabled={sendingReductionRequest}
                            >
                                <Text style={styles.reductionSubmitButtonText}>
                                    {sendingReductionRequest ? 'Sending...' : 'Send suggestion'}
                                </Text>
                            </TouchableOpacity>
                        </RNView>
                    </Card>
                </RNView>
            </Modal>

            <Modal
                animationType="slide"
                transparent
                visible={adjustmentModalVisible}
                onRequestClose={handleCloseAdjustmentModal}
            >
                <RNView style={styles.reductionModalOverlay}>
                    <Card style={styles.reductionModalCard}>
                        <RNView style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Adjust total</Text>
                            <TouchableOpacity onPress={handleCloseAdjustmentModal} disabled={savingAdjustedTotal}>
                                <X size={24} color="#0F172A" />
                            </TouchableOpacity>
                        </RNView>
                        <Text style={styles.reductionModalDescription}>
                            Update the total amount for this record. Payments already logged will stay in the history below.
                        </Text>
                        <Text style={styles.label}>New total</Text>
                        <TextInput
                            value={adjustedTotal}
                            onChangeText={setAdjustedTotal}
                            keyboardType="decimal-pad"
                            placeholder="0.00"
                            placeholderTextColor="#94A3B8"
                            style={styles.input}
                            editable={!savingAdjustedTotal}
                        />
                        <RNView style={styles.reductionModalActions}>
                            <TouchableOpacity
                                style={styles.reductionCancelButton}
                                onPress={handleCloseAdjustmentModal}
                                disabled={savingAdjustedTotal}
                            >
                                <Text style={styles.reductionCancelButtonText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[
                                    styles.reductionSubmitButton,
                                    savingAdjustedTotal && styles.reductionSubmitButtonDisabled,
                                ]}
                                onPress={() => {
                                    void submitAdjustedTotal();
                                }}
                                disabled={savingAdjustedTotal}
                            >
                                <Text style={styles.reductionSubmitButtonText}>
                                    {savingAdjustedTotal ? 'Saving...' : 'Save total'}
                                </Text>
                            </TouchableOpacity>
                        </RNView>
                    </Card>
                </RNView>
            </Modal>

            <RNView style={styles.footer}>
                {loan.category === 'money' && loan.status !== 'paid' && (
                    <TouchableOpacity
                        style={styles.primaryBtn}
                        onPress={() => openPaymentForm()}
                    >
                        <Wallet color="#fff" size={22} />
                        <Text style={styles.primaryBtnText}>Add payment</Text>
                    </TouchableOpacity>
                )}

                {loan.category === 'item' && loan.status !== 'paid' && (
                    <TouchableOpacity
                        style={[styles.primaryBtn, { backgroundColor: '#6366F1' }]}
                        onPress={async () => {
                            const { error } = await supabase
                                .from('loans')
                                .update({ status: 'paid' })
                                .eq('id', loanId)
                                .eq('user_id', user?.id);
                            if (!error) {
                                await cancelLoanReminders(String(loanId));
                                fetchLoanDetails();
                            }
                        }}
                    >
                        <Box color="#fff" size={22} />
                        <Text style={styles.primaryBtnText}>Mark as Returned</Text>
                    </TouchableOpacity>
                )}

                {canSuggestNewTotal && (
                    <TouchableOpacity
                        style={styles.secondaryBtn}
                        onPress={openReductionModal}
                    >
                        <TrendingDown color="#6366F1" size={22} />
                        <Text style={styles.secondaryBtnText}>Suggest new total</Text>
                    </TouchableOpacity>
                )}

                {canAdjustTotalDirectly && (
                    <TouchableOpacity
                        style={styles.secondaryBtn}
                        onPress={openAdjustmentModal}
                    >
                        <TrendingUp color="#6366F1" size={22} />
                        <Text style={styles.secondaryBtnText}>Adjust total</Text>
                    </TouchableOpacity>
                )}

            </RNView>
        </Screen>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    centered: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    scroll: {
        padding: 20,
        paddingTop: 100,
        paddingBottom: 120,
    },
    deleteHeader: {
        width: 36,
        height: 36,
        borderRadius: 10,
        backgroundColor: 'rgba(239, 68, 68, 0.05)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    shareHeader: {
        width: 36,
        height: 36,
        borderRadius: 10,
        backgroundColor: 'rgba(79, 70, 229, 0.08)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        backgroundColor: 'transparent',
    },
    closeHeaderBtn: {
        width: 36,
        height: 36,
        borderRadius: 10,
        backgroundColor: 'rgba(15, 23, 42, 0.06)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    mainCard: {
        padding: 24,
        marginBottom: 16,
    },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 24,
        backgroundColor: 'transparent',
    },
    iconBox: {
        width: 60,
        height: 60,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 16,
    },
    headerInfo: {
        backgroundColor: 'transparent',
    },
    headerName: {
        fontSize: 20,
        fontWeight: '800',
        color: '#0F172A',
    },
    headerSub: {
        fontSize: 14,
        color: '#64748B',
        marginTop: 2,
    },
    amountLabel: {
        fontSize: 12,
        fontWeight: '700',
        color: '#64748B',
        textTransform: 'uppercase',
        letterSpacing: 1,
        marginBottom: 4,
    },
    amountText: {
        fontSize: 48,
        fontWeight: '900',
        color: '#0F172A',
        marginBottom: 20,
    },
    balanceBreakdown: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        backgroundColor: 'rgba(148, 163, 184, 0.05)',
        padding: 16,
        borderRadius: 16,
        marginBottom: 24,
    },
    breakdownItem: {
        backgroundColor: 'transparent',
    },
    breakdownLabel: {
        fontSize: 11,
        fontWeight: '600',
        color: '#64748B',
        textTransform: 'uppercase',
        marginBottom: 4,
    },
    breakdownValue: {
        fontSize: 16,
        fontWeight: '800',
        color: '#1E293B',
    },
    progressSection: {
        backgroundColor: 'transparent',
    },
    progressLabels: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 10,
        backgroundColor: 'transparent',
    },
    progressLabel: {
        fontSize: 12,
        fontWeight: '700',
        color: '#64748B',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    progressPercent: {
        fontSize: 14,
        fontWeight: '800',
        color: '#6366F1',
    },
    progressBar: {
        height: 8,
        backgroundColor: '#F1F5F9',
        borderRadius: 4,
        overflow: 'hidden',
    },
    progressFill: {
        height: '100%',
        backgroundColor: '#6366F1',
        borderRadius: 4,
    },
    progressStats: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 10,
        backgroundColor: 'transparent',
    },
    statText: {
        fontSize: 12,
        color: '#94A3B8',
        fontWeight: '600',
    },
    detailsCard: {
        padding: 24,
        marginBottom: 16,
    },
    sectionTitle: {
        fontSize: 14,
        fontWeight: '800',
        color: '#0F172A',
        textTransform: 'uppercase',
        letterSpacing: 1,
        marginBottom: 16,
    },
    infoRow: {
        flexDirection: 'row',
        gap: 16,
        backgroundColor: 'transparent',
    },
    infoItem: {
        flex: 1,
        backgroundColor: '#FFFFFF',
        padding: 16,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#F1F5F9',
        elevation: 1,
        shadowColor: '#000',
        shadowOpacity: 0.02,
        shadowRadius: 5,
    },
    infoLabel: {
        fontSize: 12,
        color: '#94A3B8',
        fontWeight: '600',
        marginTop: 8,
    },
    infoValue: {
        fontSize: 14,
        fontWeight: '700',
        color: '#1E293B',
        marginTop: 2,
    },
    descriptionBox: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#FFFFFF',
        padding: 16,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#F1F5F9',
        elevation: 1,
        shadowColor: '#000',
        shadowOpacity: 0.02,
        shadowRadius: 5,
    },
    descriptionText: {
        flex: 1,
        fontSize: 15,
        color: '#475569',
        fontStyle: 'italic',
        lineHeight: 22,
        marginRight: 10,
    },
    editWrapper: {
        backgroundColor: 'transparent',
    },
    noteInput: {
        backgroundColor: '#F8FAFC',
        borderRadius: 16,
        padding: 16,
        fontSize: 15,
        minHeight: 100,
        textAlignVertical: 'top',
        color: '#0F172A',
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    saveNoteBtn: {
        backgroundColor: '#0F172A',
        padding: 14,
        borderRadius: 12,
        marginTop: 12,
        alignItems: 'center',
    },
    saveNoteText: {
        color: '#fff',
        fontWeight: '700',
    },
    evidenceCard: {
        padding: 20,
        marginBottom: 16,
    },
    attachmentButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F8FAFC',
        padding: 16,
        borderRadius: 16,
        gap: 12,
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    attachmentLabel: {
        flex: 1,
        fontSize: 14,
        fontWeight: '700',
        color: '#6366F1',
    },
    analyticsSection: {
        marginBottom: 24,
        backgroundColor: 'transparent',
    },
    analyticsGrid: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 12,
        backgroundColor: 'transparent',
    },
    analyticsCard: {
        flex: 1,
        padding: 16,
        alignItems: 'center',
    },
    analyticsIcon: {
        width: 40,
        height: 40,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 8,
    },
    analyticsLabel: {
        fontSize: 11,
        color: '#94A3B8',
        fontWeight: '700',
        textTransform: 'uppercase',
    },
    analyticsValue: {
        fontSize: 15,
        fontWeight: '800',
        marginTop: 4,
    },
    efficiencyCard: {
        padding: 16,
    },
    efficiencyHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 8,
        backgroundColor: 'transparent',
    },
    efficiencyTitle: {
        fontSize: 13,
        fontWeight: '700',
        color: '#0F172A',
    },
    efficiencyDesc: {
        fontSize: 13,
        color: '#64748B',
        lineHeight: 18,
    },
    timelineSection: {
        paddingTop: 8,
        paddingHorizontal: 4,
        backgroundColor: 'transparent',
    },
    timelineContainer: {
        marginTop: 8,
        backgroundColor: 'transparent',
    },
    emptyTimelineCard: {
        padding: 18,
        marginLeft: 28,
        marginBottom: 24,
        borderRadius: 18,
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    emptyTimelineTitle: {
        fontSize: 16,
        fontWeight: '800',
        color: '#0F172A',
    },
    emptyTimelineText: {
        fontSize: 14,
        color: '#64748B',
        lineHeight: 20,
        marginTop: 6,
    },
    emptyTimelineButton: {
        marginTop: 14,
        alignSelf: 'flex-start',
        backgroundColor: '#0F172A',
        borderRadius: 999,
        paddingHorizontal: 14,
        paddingVertical: 10,
    },
    emptyTimelineButtonText: {
        color: '#FFFFFF',
        fontSize: 13,
        fontWeight: '800',
    },
    timelineLine: {
        position: 'absolute',
        top: 8,
        bottom: 8,
        left: 7,
        width: 2,
        backgroundColor: '#E2E8F0',
    },
    timelineItem: {
        flexDirection: 'row',
        marginBottom: 24,
        backgroundColor: 'transparent',
    },
    timelineDot: {
        width: 16,
        height: 16,
        borderRadius: 8,
        borderWidth: 3,
        borderColor: '#fff',
        zIndex: 1,
    },
    timelineContent: {
        flex: 1,
        marginLeft: 16,
        backgroundColor: 'transparent',
    },
    timelineTitle: {
        fontSize: 15,
        fontWeight: '700',
        color: '#1E293B',
    },
    timelineDate: {
        fontSize: 12,
        color: '#94A3B8',
        marginTop: 2,
    },
    paymentNote: {
        fontSize: 13,
        color: '#64748B',
        marginTop: 6,
        padding: 10,
        backgroundColor: '#F1F5F9',
        borderRadius: 10,
        overflow: 'hidden',
    },
    footer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        padding: 20,
        paddingBottom: 34,
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        borderTopWidth: 1,
        borderTopColor: '#F1F5F9',
    },
    primaryBtn: {
        backgroundColor: '#0F172A',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
        borderRadius: 18,
        gap: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.2,
        shadowRadius: 12,
        elevation: 6,
    },
    primaryBtnText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '800',
    },
    secondaryBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(99, 102, 241, 0.05)',
        padding: 20,
        borderRadius: 18,
        gap: 12,
        borderWidth: 1,
        borderColor: 'rgba(99, 102, 241, 0.1)',
        marginTop: 12,
    },
    secondaryBtnText: {
        color: '#6366F1',
        fontSize: 16,
        fontWeight: '700',
    },
    copyright: {
        textAlign: 'center',
        color: '#94A3B8',
        fontSize: 12,
        fontWeight: '600',
        marginTop: 32,
    },
    currencySelector: {
        marginTop: 12,
        flexDirection: 'row',
    },
    currencyChip: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 12,
        backgroundColor: '#F1F5F9',
        marginRight: 8,
        borderWidth: 1,
        borderColor: 'transparent',
    },
    currencyChipActive: {
        backgroundColor: '#0F172A',
        borderColor: '#0F172A',
    },
    currencyChipText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#64748B',
    },
    currencyChipTextActive: {
        color: '#FFFFFF',
    },
    currencyAddChip: {
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 12,
        backgroundColor: '#EEF2FF',
        marginRight: 8,
        borderWidth: 1,
        borderColor: '#C7D2FE',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    currencyAddChipText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#475569',
    },
    input: {
        borderWidth: 1,
        borderColor: '#E2E8F0',
        padding: 16,
        borderRadius: 14,
        fontSize: 16,
        backgroundColor: '#F8FAFC',
        color: '#0F172A',
        marginTop: 8,
    },
    label: {
        fontSize: 14,
        fontWeight: '700',
        color: '#64748B',
        marginTop: 16,
    },
    timelineHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    paymentActions: {
        flexDirection: 'row',
        gap: 12,
    },
    actionIcon: {
        width: 32,
        height: 32,
        borderRadius: 8,
        backgroundColor: '#F8FAFC',
        justifyContent: 'center',
        alignItems: 'center',
    },
    currencyModalOverlay: {
        flex: 1,
        justifyContent: 'flex-end',
        backgroundColor: 'rgba(15,23,42,0.45)',
    },
    currencyModalCard: {
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        padding: 20,
        maxHeight: '70%',
    },
    currencyModalTitle: {
        fontSize: 18,
        fontWeight: '800',
        color: '#0F172A',
        marginBottom: 12,
    },
    currencyModalList: {
        maxHeight: 360,
    },
    currencyModalItem: {
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#E2E8F0',
    },
    currencyModalCode: {
        fontSize: 14,
        fontWeight: '800',
        color: '#0F172A',
    },
    currencyModalName: {
        fontSize: 12,
        color: '#64748B',
        marginTop: 2,
    },
    currencyModalClose: {
        marginTop: 14,
        backgroundColor: '#0F172A',
        paddingVertical: 12,
        borderRadius: 12,
        alignItems: 'center',
    },
    currencyModalCloseText: {
        color: '#fff',
        fontWeight: '700',
        fontSize: 14,
    },
    reductionModalOverlay: {
        flex: 1,
        justifyContent: 'flex-end',
        backgroundColor: 'rgba(15,23,42,0.45)',
    },
    reductionModalCard: {
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        padding: 20,
    },
    reductionModalDescription: {
        fontSize: 14,
        lineHeight: 20,
        color: '#475569',
        marginBottom: 4,
    },
    reductionReasonInput: {
        minHeight: 120,
    },
    reductionModalActions: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 20,
    },
    reductionCancelButton: {
        flex: 1,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: '#CBD5E1',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 14,
        backgroundColor: '#FFFFFF',
    },
    reductionCancelButtonText: {
        fontSize: 14,
        fontWeight: '700',
        color: '#475569',
    },
    reductionSubmitButton: {
        flex: 1,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 14,
        backgroundColor: '#0F172A',
    },
    reductionSubmitButtonDisabled: {
        opacity: 0.7,
    },
    reductionSubmitButtonText: {
        fontSize: 14,
        fontWeight: '700',
        color: '#FFFFFF',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: '#FFFFFF',
        borderTopLeftRadius: 32,
        borderTopRightRadius: 32,
        padding: 24,
        height: '70%',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 24,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: '800',
        color: '#0F172A',
    },
    historyList: {
        flex: 1,
    },
    historyItem: {
        flexDirection: 'row',
        marginBottom: 20,
        backgroundColor: '#F8FAFC',
        padding: 16,
        borderRadius: 16,
    },
    historyIconBox: {
        width: 32,
        height: 32,
        borderRadius: 10,
        backgroundColor: 'rgba(99, 102, 241, 0.1)',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    historyDetails: {
        flex: 1,
    },
    historyDate: {
        fontSize: 12,
        color: '#94A3B8',
        fontWeight: '600',
        marginBottom: 4,
    },
    historyReason: {
        fontSize: 14,
        fontWeight: '700',
        color: '#1E293B',
        marginBottom: 8,
    },
    historyChange: {
        fontSize: 13,
        color: '#64748B',
        lineHeight: 18,
    },
    emptyHistory: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 40,
    },
    emptyHistoryText: {
        color: '#94A3B8',
        fontSize: 14,
        textAlign: 'center',
        marginTop: 12,
        maxWidth: '80%',
    }
});
