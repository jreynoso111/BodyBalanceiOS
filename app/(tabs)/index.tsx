import React, { useRef, useState } from 'react';
import { StyleSheet, ScrollView, TouchableOpacity, View as RNView, RefreshControl, Share, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Text, View, Screen, Card } from '@/components/Themed';
import { supabase } from '@/services/supabase';
import { useAuthStore } from '@/store/authStore';
import { ArrowUpRight, ArrowDownLeft, ArrowRight, Plus, Send, Wallet, Box, Bell, Clock3, AlertTriangle, CheckCircle2, UserPlus, ChevronDown, ChevronUp } from 'lucide-react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { getCurrencySymbol } from '@/constants/Currencies';
import { useGreetingStore } from '@/store/greetingStore';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type LoanRecord = {
  id: string;
  amount: number | null;
  type: 'lent' | 'borrowed';
  status: string;
  category: 'money' | 'item';
  created_at: string;
  due_date: string | null;
  item_name: string | null;
  currency: string | null;
  contacts?: { name?: string | null } | null;
  remaining_amount?: number;
  last_activity_at?: string;
  last_payment_at?: string | null;
  last_payment_amount?: number | null;
  last_payment_method?: 'money' | 'item' | null;
};

type PaymentRecord = {
  amount: number | null;
  loan_id: string;
  payment_date: string | null;
  payment_method: 'money' | 'item' | null;
};

export default function DashboardScreen() {
  const { user } = useAuthStore();
  const greeting = useGreetingStore((state) => state.greetings[state.currentIndex]);
  const [accountName, setAccountName] = useState('');
  const [friendCode, setFriendCode] = useState('');
  const [friendCodeReady, setFriendCodeReady] = useState(false);
  const [summary, setSummary] = useState({ lent: 0, borrowed: 0, overdue: 0, dueSoon: 0 });
  const [recentLoans, setRecentLoans] = useState<LoanRecord[]>([]);
  const [dueItems, setDueItems] = useState<LoanRecord[]>([]);
  const [requestCount, setRequestCount] = useState(0);
  const [recordCount, setRecordCount] = useState(0);
  const [expandedRecentRecordId, setExpandedRecentRecordId] = useState<string | null>(null);
  const [recentSectionExpanded, setRecentSectionExpanded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const fetchInFlightRef = useRef(false);

  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme() || 'light';
  const bottomInset = Math.max(insets.bottom, 12);
  const fabBottomOffset = bottomInset + 16;
  const scrollBottomPadding = fabBottomOffset + 84;
  const greetingTitle = accountName.trim() ? `${greeting}, ${accountName.trim()}!` : `${greeting}!`;

  const handleInviteToApp = async () => {
    if (!friendCodeReady || !friendCode) {
      Alert.alert('Friend code unavailable', 'Your friend code is still being generated. Try again in a moment.');
      return;
    }

    try {
      await Share.share({
        message: `Join me on Buddy Balance and register with my friend code ${friendCode}. The app helps us keep shared balances and records in one place.`,
      });
    } catch (error: any) {
      Alert.alert('Could not open invite', error?.message || 'The share sheet could not be opened right now.');
    }
  };

  useFocusEffect(
    React.useCallback(() => {
      void fetchData();
    }, [user?.id])
  );

  React.useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel(`dashboard:${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'loans',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          void fetchData();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'payments',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          void fetchData();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'p2p_requests',
          filter: `to_user_id=eq.${user.id}`,
        },
        () => {
          void fetchData();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [user?.id]);

  const fetchData = async (options?: { showRefreshControl?: boolean }) => {
    if (!user || fetchInFlightRef.current) return;
    const showRefreshControl = options?.showRefreshControl === true;
    fetchInFlightRef.current = true;
    if (showRefreshControl) {
      setRefreshing(true);
    }

    try {
      const profileNameFromMetadata =
        typeof user.user_metadata?.full_name === 'string' ? user.user_metadata.full_name.trim() : '';

      if (profileNameFromMetadata) {
        setAccountName(profileNameFromMetadata);
      }

      const [profileResult, loansResult, paymentsResult, requestsResult] = await Promise.all([
        supabase.from('profiles').select('full_name, friend_code').eq('id', user.id).maybeSingle(),
        supabase
          .from('loans')
          .select('id, amount, type, status, category, created_at, due_date, item_name, currency, contacts(name)')
          .eq('user_id', user.id)
          .is('deleted_at', null)
          .order('created_at', { ascending: false }),
        supabase
          .from('payments')
          .select('amount, loan_id, payment_date, payment_method')
          .eq('user_id', user.id),
        supabase
          .from('p2p_requests')
          .select('*', { count: 'exact', head: true })
          .eq('to_user_id', user.id)
          .eq('status', 'pending'),
      ]);

      if (profileResult.error) {
        console.error('dashboard profile load failed:', profileResult.error.message);
      }
      if (loansResult.error) {
        console.error('dashboard loans load failed:', loansResult.error.message);
      }
      if (paymentsResult.error) {
        console.error('dashboard payments load failed:', paymentsResult.error.message);
      }
      if (requestsResult.error) {
        console.error('dashboard requests load failed:', requestsResult.error.message);
      }

      let profileData = profileResult.data;
      if (!profileData) {
        const { data: upsertedProfile, error: upsertError } = await supabase
          .from('profiles')
          .upsert(
            {
              id: user.id,
              full_name: profileNameFromMetadata || null,
              email: user.email || null,
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'id' }
          )
          .select('full_name, friend_code')
          .maybeSingle();

        if (upsertError) {
          console.error('dashboard profile bootstrap failed:', upsertError.message);
        } else {
          profileData = upsertedProfile;
        }
      }

      const profileName = typeof profileData?.full_name === 'string' ? profileData.full_name.trim() : '';
      let resolvedFriendCode = String((profileData as any)?.friend_code || '').trim();

      if (!resolvedFriendCode) {
        const { data: ensuredCode, error: ensureError } = await supabase.rpc('ensure_my_friend_code');
        if (ensureError) {
          console.error('dashboard friend code ensure failed:', ensureError.message);
        } else {
          resolvedFriendCode = String(ensuredCode || '').trim();
        }
      }

      if (profileName) {
        setAccountName(profileName);
      } else if (!profileNameFromMetadata) {
        setAccountName('');
      }

      setFriendCode(resolvedFriendCode);
      setFriendCodeReady(Boolean(resolvedFriendCode));

      const allLoans = (loansResult.data || []) as LoanRecord[];
      const allPayments = (paymentsResult.data || []) as PaymentRecord[];
      const paymentTotals = new Map<string, number>();
      const paymentActivity = new Map<string, {
        at: string;
        amount: number | null;
        method: 'money' | 'item' | null;
      }>();

      allPayments.forEach((payment) => {
        const paymentAmount = Number(payment.amount || 0);
        if (payment.payment_method === 'money') {
          const current = paymentTotals.get(payment.loan_id) || 0;
          paymentTotals.set(payment.loan_id, current + paymentAmount);
        }

        const activityAt = payment.payment_date || '';
        if (!activityAt) {
          return;
        }
        const currentActivity = paymentActivity.get(payment.loan_id);
        if (!currentActivity || getTimestamp(activityAt) > getTimestamp(currentActivity.at)) {
          paymentActivity.set(payment.loan_id, {
            at: activityAt,
            amount: Number.isFinite(paymentAmount) ? paymentAmount : null,
            method: payment.payment_method,
          });
        }
      });

      const enrichedLoans = allLoans.map((loan) => {
        const paid = paymentTotals.get(loan.id) || 0;
        const remaining = loan.category === 'money' ? Math.max(Number(loan.amount || 0) - paid, 0) : 0;
        const latestPayment = paymentActivity.get(loan.id);
        const lastActivityAt =
          latestPayment?.at && getTimestamp(latestPayment.at) > getTimestamp(loan.created_at)
            ? latestPayment.at
            : loan.created_at;

        return {
          ...loan,
          remaining_amount: remaining,
          last_activity_at: lastActivityAt,
          last_payment_at: latestPayment?.at || null,
          last_payment_amount: latestPayment?.amount ?? null,
          last_payment_method: latestPayment?.method ?? null,
        };
      });

      const openLoans = enrichedLoans.filter((loan) => loan.status !== 'paid');
      const moneyLoans = openLoans.filter((loan) => loan.category === 'money');
      const lent = moneyLoans
        .filter((loan) => loan.type === 'lent')
        .reduce((acc, loan) => acc + Number(loan.remaining_amount || 0), 0);
      const borrowed = moneyLoans
        .filter((loan) => loan.type === 'borrowed')
        .reduce((acc, loan) => acc + Number(loan.remaining_amount || 0), 0);

      const now = new Date();
      now.setHours(0, 0, 0, 0);
      const soon = new Date(now);
      soon.setDate(now.getDate() + 7);

      const actionableDueItems = openLoans
        .filter((loan) => loan.status === 'active' && loan.due_date)
        .map((loan) => ({
          ...loan,
          due_date: loan.due_date,
        }))
        .sort((a, b) => new Date(a.due_date || '').getTime() - new Date(b.due_date || '').getTime());

      const overdueCount = actionableDueItems.filter((loan) => {
        const due = new Date(`${loan.due_date}T12:00:00`);
        return due.getTime() < now.getTime();
      }).length;

      const dueSoonCount = actionableDueItems.filter((loan) => {
        const due = new Date(`${loan.due_date}T12:00:00`);
        return due.getTime() >= now.getTime() && due.getTime() <= soon.getTime();
      }).length;

      setSummary({ lent, borrowed, overdue: overdueCount, dueSoon: dueSoonCount });
      setDueItems(actionableDueItems.slice(0, 5));
      setRecentLoans(
        [...enrichedLoans]
          .sort((a, b) => getTimestamp(b.last_activity_at || b.created_at) - getTimestamp(a.last_activity_at || a.created_at))
          .slice(0, 8)
      );
      setRecordCount(enrichedLoans.length);
      setRequestCount(requestsResult.count || 0);
    } catch (error: any) {
      console.error('dashboard load failed:', error?.message || error);
    } finally {
      if (showRefreshControl) {
        setRefreshing(false);
      }
      fetchInFlightRef.current = false;
    }
  };

  const balance = summary.lent - summary.borrowed;
  const hasOpenBalance = summary.lent + summary.borrowed > 0;
  const balanceTone = getBalanceTone(summary.lent, summary.borrowed);
  const balanceDirection = !hasOpenBalance ? 'neutral' : balance > 0 ? 'positive' : 'negative';

  return (
    <Screen style={styles.container} safeAreaEdges={['left', 'right', 'bottom']}>
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: scrollBottomPadding }]}
        contentInsetAdjustmentBehavior="never"
        automaticallyAdjustContentInsets={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void fetchData({ showRefreshControl: true })} tintColor={Colors[colorScheme].tint} />}
      >
        <View style={styles.header}>
          <RNView style={styles.greetingRow}>
            <RNView style={styles.greetingCopy}>
              <Text style={styles.greeting}>{greetingTitle}</Text>
              <Text style={styles.subtitle}>Focus on what needs attention first.</Text>
            </RNView>
            <TouchableOpacity style={styles.requestIcon} onPress={() => router.push('/requests')}>
              <Bell size={24} color="#0F172A" />
              {requestCount > 0 && (
                <RNView style={styles.badge}>
                  <Text style={styles.badgeText}>{requestCount}</Text>
                </RNView>
              )}
            </TouchableOpacity>
          </RNView>
        </View>

        <RNView style={styles.actionRow}>
          <RNView style={styles.actionColumn}>
            <TouchableOpacity style={[styles.actionButton, styles.actionButtonSecondary]} onPress={() => router.push('/new-contact?mode=friend')}>
              <UserPlus size={18} color="#4F46E5" />
              <Text style={styles.actionButtonSecondaryText}>Add friend</Text>
            </TouchableOpacity>
            <RNView style={styles.friendCodeRow}>
              <Text style={styles.friendCodeCaption}>Friend code:</Text>
              <Text style={[styles.friendCodeCaption, styles.friendCodeValue]}>
                {friendCodeReady ? friendCode : 'Generating...'}
              </Text>
            </RNView>
          </RNView>
        </RNView>

        <Card style={[styles.balanceCard, { borderColor: balanceTone.border }]}>
          <LinearGradient
            colors={balanceTone.gradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.balanceGradient}
          >
            <RNView style={styles.balanceCardHeader}>
              <RNView style={styles.balanceHeadlineBlock}>
                <Text style={styles.balanceLabel}>Open balance</Text>
                <Text style={styles.balanceValue}>{formatSignedCurrency(balance)}</Text>
              </RNView>
              <RNView
                style={[
                  styles.netBadge,
                  balanceDirection === 'positive'
                    ? styles.netBadgePositive
                    : balanceDirection === 'negative'
                      ? styles.netBadgeNegative
                      : styles.netBadgeNeutral,
                ]}
              >
                <Text
                  style={[
                    styles.netBadgeText,
                    balanceDirection === 'positive'
                      ? styles.netBadgeTextPositive
                      : balanceDirection === 'negative'
                        ? styles.netBadgeTextNegative
                        : styles.netBadgeTextNeutral,
                  ]}
                >
                  {balanceDirection === 'positive'
                    ? 'You lent more'
                    : balanceDirection === 'negative'
                      ? 'You borrowed more'
                      : 'No open balance'}
                </Text>
              </RNView>
            </RNView>
            <Text style={styles.balanceHint}>
              {balanceDirection === 'positive'
                ? 'Right now, friends owe you more than you owe them.'
                : balanceDirection === 'negative'
                  ? 'Right now, you owe more than friends owe you.'
                  : "Right now, you're all settled up."}
            </Text>

            <RNView style={styles.balanceBreakdownRow}>
              <RNView style={styles.balanceBreakdownCard}>
                <RNView style={[styles.statIcon, { backgroundColor: hasOpenBalance ? 'rgba(16, 185, 129, 0.12)' : 'rgba(148, 163, 184, 0.12)' }]}>
                  <ArrowUpRight size={18} color={hasOpenBalance ? '#10B981' : '#64748B'} />
                </RNView>
                <Text style={styles.breakdownLabel}>They owe you</Text>
                <Text style={[styles.breakdownValue, { color: hasOpenBalance ? '#047857' : '#475569' }]}>{formatCurrency(summary.lent)}</Text>
              </RNView>
              <RNView style={styles.balanceBreakdownCard}>
                <RNView style={[styles.statIcon, { backgroundColor: hasOpenBalance ? 'rgba(239, 68, 68, 0.12)' : 'rgba(148, 163, 184, 0.12)' }]}>
                  <ArrowDownLeft size={18} color={hasOpenBalance ? '#EF4444' : '#64748B'} />
                </RNView>
                <Text style={styles.breakdownLabel}>You owe</Text>
                <Text style={[styles.breakdownValue, { color: hasOpenBalance ? '#B91C1C' : '#475569' }]}>{formatCurrency(summary.borrowed)}</Text>
              </RNView>
            </RNView>

            <RNView style={styles.distributionSection}>
              <RNView style={styles.distributionLabels}>
                <Text style={styles.distributionTitle}>Balance mix</Text>
                <Text style={styles.distributionPercent}>
                  {hasOpenBalance ? `${getCollectShare(summary.lent, summary.borrowed)}% owed to you` : 'No open balances'}
                </Text>
              </RNView>
              <RNView style={styles.distributionBar}>
                {hasOpenBalance ? (
                  <>
                    <RNView
                      style={[
                        styles.distributionCollect,
                        { flex: Math.max(summary.lent, 0.0001) },
                      ]}
                    />
                    <RNView
                      style={[
                        styles.distributionPay,
                        { flex: Math.max(summary.borrowed, 0.0001) },
                      ]}
                    />
                  </>
                ) : (
                  <RNView style={styles.distributionNeutral} />
                )}
              </RNView>
              <RNView style={styles.distributionLegend}>
                <RNView style={styles.legendItem}>
                  <RNView style={[styles.legendDot, { backgroundColor: hasOpenBalance ? '#10B981' : '#94A3B8' }]} />
                  <Text style={styles.legendText}>
                    {hasOpenBalance ? `${getCollectShare(summary.lent, summary.borrowed)}% owed to you` : '$0 owed to you'}
                  </Text>
                </RNView>
                <RNView style={styles.legendItem}>
                  <RNView style={[styles.legendDot, { backgroundColor: hasOpenBalance ? '#EF4444' : '#94A3B8' }]} />
                  <Text style={styles.legendText}>
                    {hasOpenBalance ? `${100 - getCollectShare(summary.lent, summary.borrowed)}% you owe` : '$0 you owe'}
                  </Text>
                </RNView>
              </RNView>
            </RNView>
          </LinearGradient>
        </Card>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Coming up</Text>
            <TouchableOpacity onPress={() => router.push('/requests')}>
              <Text style={styles.sectionLink}>Confirmations</Text>
            </TouchableOpacity>
          </View>

          <RNView style={styles.insightRow}>
            <Card style={styles.insightCard}>
              <RNView style={[styles.insightIcon, { backgroundColor: 'rgba(245, 158, 11, 0.12)' }]}>
                <AlertTriangle size={18} color="#F59E0B" />
              </RNView>
              <Text style={styles.insightValue}>{summary.overdue}</Text>
              <Text style={styles.insightLabel}>Needs attention</Text>
            </Card>
            <Card style={styles.insightCard}>
              <RNView style={[styles.insightIcon, { backgroundColor: 'rgba(59, 130, 246, 0.12)' }]}>
                <Clock3 size={18} color="#3B82F6" />
              </RNView>
              <Text style={styles.insightValue}>{summary.dueSoon}</Text>
              <Text style={styles.insightLabel}>Next 7 days</Text>
            </Card>
            <Card style={styles.insightCard}>
              <RNView style={[styles.insightIcon, { backgroundColor: 'rgba(16, 185, 129, 0.12)' }]}>
                <CheckCircle2 size={18} color="#10B981" />
              </RNView>
              <Text style={styles.insightValue}>{recordCount}</Text>
              <Text style={styles.insightLabel}>Shared records</Text>
            </Card>
          </RNView>

          {dueItems.length === 0 ? (
            <Card style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>Nothing to follow up.</Text>
              <Text style={styles.emptyText}>Your active records are quiet for now. Add a new one when something happens.</Text>
              <TouchableOpacity style={styles.emptyButton} onPress={() => router.push('/new-loan')}>
                <Text style={styles.emptyButtonText}>Add a record</Text>
              </TouchableOpacity>
            </Card>
          ) : (
            dueItems.map((item) => (
              <TouchableOpacity key={item.id} style={styles.listItemWrapper} onPress={() => router.push(`/loan/${item.id}`)}>
                <Card style={styles.listCard}>
                  <RNView style={styles.listLeft}>
                    <RNView style={[styles.iconBox, { backgroundColor: item.category === 'item' ? 'rgba(99, 102, 241, 0.1)' : 'rgba(148, 163, 184, 0.08)' }]}>
                      {item.category === 'item' ? (
                        <Box size={20} color="#6366F1" />
                      ) : (
                        <Wallet size={20} color={item.type === 'lent' ? '#10B981' : '#EF4444'} />
                      )}
                    </RNView>
                    <View style={styles.listInfo}>
                      <Text style={styles.listName}>{item.contacts?.name || 'Unknown contact'}</Text>
                      <Text style={styles.listMeta}>{getDueDescriptor(item.due_date)}</Text>
                      <Text style={styles.listSub}>{getRecordDescriptor(item)}</Text>
                    </View>
                  </RNView>
                  <RNView style={styles.listRight}>
                    <Text style={[styles.amountText, { color: item.type === 'lent' ? '#10B981' : '#EF4444' }]}>{getRecordValue(item)}</Text>
                  </RNView>
                </Card>
              </TouchableOpacity>
            ))
          )}
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent records</Text>
            <TouchableOpacity
              style={styles.sectionToggle}
              activeOpacity={0.85}
              onPress={() => setRecentSectionExpanded((current) => !current)}
            >
              <Text style={styles.sectionToggleText}>
                {recentSectionExpanded ? 'Hide' : `${recentLoans.length} records`}
              </Text>
              {recentSectionExpanded ? (
                <ChevronUp size={18} color="#6366F1" />
              ) : (
                <ChevronDown size={18} color="#6366F1" />
              )}
            </TouchableOpacity>
          </View>

          {!recentSectionExpanded ? (
            <Card style={styles.collapsedSectionCard}>
              <Text style={styles.collapsedSectionTitle}>Recent activity is minimized.</Text>
              <Text style={styles.collapsedSectionText}>
                Expand this section if you want to review your latest shared records.
              </Text>
            </Card>
          ) : recentLoans.length === 0 ? (
            <Card style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>No shared activity yet.</Text>
              <Text style={styles.emptyText}>Start with one record so the overview can remind you what happened and with whom.</Text>
              <TouchableOpacity style={styles.emptyButton} onPress={() => router.push('/new-loan')}>
                <Text style={styles.emptyButtonText}>New record</Text>
              </TouchableOpacity>
            </Card>
          ) : (
            recentLoans.map((item) => (
              <Card key={item.id} style={[styles.listCard, styles.recentRecordCard]}>
                <RNView style={styles.recentRecordHeader}>
                  <TouchableOpacity
                    style={styles.listLeft}
                    activeOpacity={0.85}
                    onPress={() => router.push(`/loan/${item.id}`)}
                  >
                    <RNView style={[styles.iconBox, { backgroundColor: item.category === 'item' ? 'rgba(99, 102, 241, 0.1)' : 'rgba(148, 163, 184, 0.08)' }]}>
                      {item.category === 'item' ? (
                        <Box size={20} color="#6366F1" />
                      ) : (
                        <Wallet size={20} color={item.type === 'lent' ? '#10B981' : '#EF4444'} />
                      )}
                    </RNView>
                    <View style={styles.listInfo}>
                      <Text style={styles.listName}>{item.contacts?.name || 'Unknown contact'}</Text>
                      <Text style={styles.recentRecordSummary}>{getRecentRecordSummary(item)}</Text>
                    </View>
                  </TouchableOpacity>
                  <RNView style={styles.recentRecordHeaderRight}>
                    <RNView style={styles.listRight}>
                      <Text style={[styles.amountText, { color: item.category === 'money' ? (item.type === 'lent' ? '#10B981' : '#EF4444') : '#6366F1' }]}>{getRecentRecordValue(item)}</Text>
                      <Text style={styles.statusBadge}>{item.status}</Text>
                    </RNView>
                    <TouchableOpacity
                      style={styles.expandToggle}
                      activeOpacity={0.85}
                      onPress={() => setExpandedRecentRecordId((current) => current === item.id ? null : item.id)}
                    >
                      {expandedRecentRecordId === item.id ? (
                        <ChevronUp size={18} color="#64748B" />
                      ) : (
                        <ChevronDown size={18} color="#64748B" />
                      )}
                    </TouchableOpacity>
                  </RNView>
                </RNView>

                {expandedRecentRecordId === item.id ? (
                  <RNView style={styles.recentRecordExpanded}>
                    <Text style={styles.listSub}>{getRecordDescriptor(item)}</Text>
                    <Text style={styles.recentRecordMeta}>{getRecentRecordMeta(item)}</Text>
                    <TouchableOpacity
                      style={styles.recentRecordOpenButton}
                      activeOpacity={0.85}
                      onPress={() => router.push(`/loan/${item.id}`)}
                    >
                      <Text style={styles.recentRecordOpenButtonText}>Open record</Text>
                    </TouchableOpacity>
                  </RNView>
                ) : null}
              </Card>
            ))
          )}
        </View>

        <Card style={styles.inviteCard}>
          <Text style={styles.inviteCardTitle}>Invite someone to Buddy Balance</Text>
          <Text style={styles.inviteCardText}>
            Share your friend code and invite someone to register in the app.
          </Text>
          <TouchableOpacity style={[styles.actionButton, styles.actionButtonPrimary]} onPress={() => void handleInviteToApp()}>
            <Send size={18} color="#FFFFFF" />
            <Text style={styles.actionButtonPrimaryText}>Invite</Text>
          </TouchableOpacity>
        </Card>
      </ScrollView>

      <RNView style={[styles.fabHint, { bottom: fabBottomOffset + 10 }]}>
        <Text style={styles.fabHintText}>New record</Text>
        <ArrowRight size={18} color="#4F46E5" />
      </RNView>

      <TouchableOpacity style={[styles.fab, { bottom: fabBottomOffset }]} onPress={() => router.push('/new-loan')}>
        <Plus color="#fff" size={30} />
      </TouchableOpacity>
    </Screen>
  );
}

function formatCurrency(value: number) {
  return `$${Math.round(value).toLocaleString()}`;
}

function formatSignedCurrency(value: number) {
  if (value === 0) return '$0';
  return value > 0 ? `+$${Math.round(value).toLocaleString()}` : `-$${Math.round(Math.abs(value)).toLocaleString()}`;
}

function getTimestamp(value?: string | null) {
  if (!value) return 0;
  const timestamp = new Date(value).getTime();
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function getCollectShare(lent: number, borrowed: number) {
  const total = lent + borrowed;
  if (total <= 0) return 0;
  return Math.round((lent / total) * 100);
}

function getBalanceTone(lent: number, borrowed: number) {
  const total = lent + borrowed;
  if (total <= 0) {
    return {
      gradient: ['#FFFFFF', '#F8FAFC'] as [string, string],
      border: '#E2E8F0',
    };
  }

  const score = total <= 0 ? 0 : (lent - borrowed) / total;

  if (score >= 0) {
    const intensity = Math.min(score, 1);
    return {
      gradient: [
        mixHex('#FFFFFF', '#DCFCE7', 0.35 + intensity * 0.4),
        mixHex('#F8FAFC', '#86EFAC', 0.2 + intensity * 0.5),
      ] as [string, string],
      border: mixHex('#E2E8F0', '#22C55E', 0.25 + intensity * 0.45),
    };
  }

  const intensity = Math.min(Math.abs(score), 1);
  return {
    gradient: [
      mixHex('#FFFFFF', '#FEE2E2', 0.35 + intensity * 0.4),
      mixHex('#F8FAFC', '#FCA5A5', 0.2 + intensity * 0.5),
    ] as [string, string],
    border: mixHex('#E2E8F0', '#EF4444', 0.25 + intensity * 0.45),
  };
}

function mixHex(from: string, to: string, amount: number) {
  const clamped = Math.max(0, Math.min(amount, 1));
  const fromRgb = hexToRgb(from);
  const toRgb = hexToRgb(to);
  const mixed = fromRgb.map((value, index) =>
    Math.round(value + (toRgb[index] - value) * clamped)
  );

  return `#${mixed.map((value) => value.toString(16).padStart(2, '0')).join('')}`;
}

function hexToRgb(hex: string) {
  const normalized = hex.replace('#', '');
  const safeHex = normalized.length === 3
    ? normalized.split('').map((value) => `${value}${value}`).join('')
    : normalized;

  return [
    Number.parseInt(safeHex.slice(0, 2), 16),
    Number.parseInt(safeHex.slice(2, 4), 16),
    Number.parseInt(safeHex.slice(4, 6), 16),
  ];
}

function getDueDescriptor(dueDate: string | null) {
  if (!dueDate) return 'No due date';
  const due = new Date(`${dueDate}T12:00:00`);
  if (Number.isNaN(due.getTime())) return dueDate;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffDays = Math.round((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Due today';
  if (diffDays === 1) return 'Due tomorrow';
  if (diffDays > 1) return `Due in ${diffDays} days`;
  if (diffDays === -1) return '1 day overdue';
  return `${Math.abs(diffDays)} days overdue`;
}

function formatActivityDate(value?: string | null) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString();
}

function getRecordDescriptor(item: LoanRecord) {
  if (item.last_payment_at && item.last_activity_at === item.last_payment_at) {
    if (item.last_payment_method === 'item') {
      return item.type === 'lent' ? 'Latest activity: item returned' : 'Latest activity: item handoff logged';
    }

    if (item.status === 'paid') {
      return item.type === 'lent' ? 'Latest activity: paid in full' : 'Latest activity: settled in full';
    }

    return item.type === 'lent' ? 'Latest activity: payment logged' : 'Latest activity: repayment logged';
  }

  if (item.category === 'item') {
    return item.type === 'lent'
      ? `Needs to return ${item.item_name || 'item'}`
      : `You need to return ${item.item_name || 'item'}`;
  }

  return item.type === 'lent' ? 'Money you should collect' : 'Money you should pay back';
}

function getRecordValue(item: LoanRecord) {
  if (item.category === 'item') {
    return 'ITEM';
  }

  const symbol = getCurrencySymbol(item.currency || 'USD');
  const amount = Math.round(Number(item.remaining_amount || item.amount || 0)).toLocaleString();
  return `${item.type === 'lent' ? '+' : '-'}${symbol}${amount}`;
}

function getRecentRecordValue(item: LoanRecord) {
  if (
    item.category === 'money' &&
    item.last_payment_at &&
    item.last_activity_at === item.last_payment_at &&
    Number.isFinite(Number(item.last_payment_amount))
  ) {
    const symbol = getCurrencySymbol(item.currency || 'USD');
    const amount = Math.round(Number(item.last_payment_amount || 0)).toLocaleString();
    return `${item.type === 'lent' ? '+' : '-'}${symbol}${amount}`;
  }

  return getRecordValue(item);
}

function getRecentRecordSummary(item: LoanRecord) {
  if (item.category === 'item') {
    return item.item_name || 'Item record';
  }

  return item.type === 'lent' ? 'You lent money' : 'You borrowed money';
}

function getRecentRecordMeta(item: LoanRecord) {
  const activityDate = item.last_activity_at || item.created_at;
  const label = item.last_payment_at && item.last_activity_at === item.last_payment_at ? 'Updated' : 'Created';
  return `${label} ${formatActivityDate(activityDate)}`;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingTop: 8,
  },
  header: {
    marginBottom: 16,
    backgroundColor: 'transparent',
  },
  greetingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    backgroundColor: 'transparent',
  },
  greetingCopy: {
    flex: 1,
    paddingRight: 12,
    backgroundColor: 'transparent',
  },
  greeting: {
    fontSize: 28,
    fontWeight: '900',
    color: '#0F172A',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 15,
    color: '#64748B',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
    backgroundColor: 'transparent',
  },
  actionColumn: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  actionButton: {
    minHeight: 52,
    borderRadius: 16,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  actionButtonPrimary: {
    backgroundColor: '#0F172A',
  },
  actionButtonSecondary: {
    backgroundColor: '#EEF2FF',
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  actionButtonPrimaryText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  actionButtonSecondaryText: {
    color: '#4F46E5',
    fontSize: 15,
    fontWeight: '800',
  },
  friendCodeCaption: {
    fontSize: 12,
    color: '#64748B',
    paddingHorizontal: 4,
    textAlign: 'center',
  },
  friendCodeRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  friendCodeValue: {
    color: '#0F172A',
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  requestIcon: {
    padding: 10,
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: 2,
    right: 2,
    backgroundColor: '#EF4444',
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: '#fff',
  },
  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '900',
  },
  balanceCard: {
    padding: 0,
    marginBottom: 24,
    backgroundColor: 'transparent',
    borderWidth: 1,
    overflow: 'hidden',
  },
  balanceGradient: {
    padding: 22,
  },
  inviteCard: {
    padding: 20,
    marginBottom: 12,
  },
  inviteCardTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
  },
  inviteCardText: {
    fontSize: 14,
    lineHeight: 21,
    color: '#64748B',
    marginTop: 8,
    marginBottom: 16,
  },
  balanceCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    backgroundColor: 'transparent',
  },
  balanceHeadlineBlock: {
    backgroundColor: 'transparent',
  },
  balanceLabel: {
    color: '#475569',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  balanceValue: {
    color: '#0F172A',
    fontSize: 38,
    fontWeight: '900',
    marginTop: 8,
  },
  balanceHint: {
    color: '#475569',
    fontSize: 14,
    lineHeight: 20,
    marginTop: 6,
    marginBottom: 16,
  },
  netBadge: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
  },
  netBadgePositive: {
    backgroundColor: 'rgba(255, 255, 255, 0.42)',
    borderColor: 'rgba(16, 185, 129, 0.16)',
  },
  netBadgeNegative: {
    backgroundColor: 'rgba(255, 255, 255, 0.42)',
    borderColor: 'rgba(239, 68, 68, 0.16)',
  },
  netBadgeNeutral: {
    backgroundColor: 'rgba(255, 255, 255, 0.72)',
    borderColor: 'rgba(148, 163, 184, 0.22)',
  },
  netBadgeText: {
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  netBadgeTextPositive: {
    color: '#047857',
  },
  netBadgeTextNegative: {
    color: '#B91C1C',
  },
  netBadgeTextNeutral: {
    color: '#475569',
  },
  balanceBreakdownRow: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: 'transparent',
  },
  balanceBreakdownCard: {
    flex: 1,
    padding: 14,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.46)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.52)',
  },
  statIcon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  breakdownLabel: {
    fontSize: 12,
    color: '#475569',
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 12,
  },
  breakdownValue: {
    fontSize: 18,
    fontWeight: '800',
    marginTop: 2,
  },
  distributionSection: {
    marginTop: 16,
    backgroundColor: 'transparent',
  },
  distributionLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    backgroundColor: 'transparent',
  },
  distributionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#334155',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  distributionPercent: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
  },
  distributionBar: {
    flexDirection: 'row',
    height: 12,
    borderRadius: 999,
    overflow: 'hidden',
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
  },
  distributionNeutral: {
    flex: 1,
    backgroundColor: '#CBD5E1',
  },
  distributionCollect: {
    backgroundColor: '#10B981',
  },
  distributionPay: {
    backgroundColor: '#EF4444',
  },
  distributionLegend: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 10,
    backgroundColor: 'transparent',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'transparent',
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  fabHint: {
    position: 'absolute',
    right: 96,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.96)',
    borderWidth: 1,
    borderColor: '#C7D2FE',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  fabHintText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#4338CA',
  },
  section: {
    marginBottom: 28,
    backgroundColor: 'transparent',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
    backgroundColor: 'transparent',
  },
  sectionTitle: {
    fontSize: 21,
    fontWeight: '800',
    color: '#0F172A',
  },
  sectionLink: {
    fontSize: 14,
    fontWeight: '700',
    color: '#6366F1',
  },
  sectionToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  sectionToggleText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#4F46E5',
  },
  insightRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 14,
    backgroundColor: 'transparent',
  },
  insightCard: {
    flex: 1,
    padding: 14,
  },
  insightIcon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  insightValue: {
    fontSize: 24,
    fontWeight: '900',
    color: '#0F172A',
  },
  insightLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
    marginTop: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  emptyCard: {
    padding: 22,
    alignItems: 'flex-start',
  },
  collapsedSectionCard: {
    padding: 18,
  },
  collapsedSectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 4,
  },
  collapsedSectionText: {
    fontSize: 13,
    lineHeight: 18,
    color: '#64748B',
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 6,
  },
  emptyText: {
    fontSize: 14,
    lineHeight: 20,
    color: '#64748B',
    marginBottom: 14,
  },
  emptyButton: {
    backgroundColor: '#0F172A',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 14,
  },
  emptyButtonText: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  listItemWrapper: {
    marginBottom: 12,
  },
  listCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  recentRecordCard: {
    marginBottom: 12,
    flexDirection: 'column',
    alignItems: 'stretch',
  },
  recentRecordHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  recentRecordHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'transparent',
    marginLeft: 12,
  },
  listLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    backgroundColor: 'transparent',
  },
  iconBox: {
    width: 46,
    height: 46,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  listInfo: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  listName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 3,
  },
  listMeta: {
    fontSize: 13,
    color: '#0F172A',
    fontWeight: '700',
    marginBottom: 2,
  },
  listSub: {
    fontSize: 13,
    lineHeight: 18,
    color: '#64748B',
  },
  recentRecordSummary: {
    fontSize: 13,
    color: '#64748B',
    lineHeight: 18,
  },
  listRight: {
    alignItems: 'flex-end',
    backgroundColor: 'transparent',
  },
  amountText: {
    fontSize: 16,
    fontWeight: '800',
  },
  statusBadge: {
    fontSize: 11,
    color: '#94A3B8',
    textTransform: 'uppercase',
    fontWeight: '700',
    marginTop: 4,
  },
  expandToggle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginLeft: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
  },
  recentRecordExpanded: {
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    backgroundColor: 'transparent',
  },
  recentRecordMeta: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '700',
    marginTop: 8,
  },
  recentRecordOpenButton: {
    alignSelf: 'flex-start',
    marginTop: 12,
    backgroundColor: '#EEF2FF',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  recentRecordOpenButtonText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#4F46E5',
  },
  fab: {
    position: 'absolute',
    right: 24,
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: '#6366F1',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 8,
  },
});
