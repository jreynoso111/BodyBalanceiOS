import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { AlertCircle, ArrowDownToLine, BellRing, ChevronDown, ChevronRight, ChevronUp, Crown, RefreshCcw, Search, TrendingUp, UserMinus, Users, Wallet } from 'lucide-react-native';
import { Card, Screen } from '@/components/Themed';
import { supabase } from '@/services/supabase';
import { getPlanLabel, normalizePlanTier, PlanTier } from '@/services/subscriptionPlan';

interface DashboardStats {
  total_users: number;
  new_users_7d: number;
  new_users_30d: number;
  active_users_7d: number;
  active_users_30d: number;
  premium_users: number;
  free_users: number;
  premium_new_7d: number;
  total_loans: number;
  active_loans: number;
  money_in_transit: number;
  records_created_7d: number;
  payments_logged_7d: number;
  pending_confirmations: number;
  pending_friend_requests: number;
  push_enabled_users: number;
}

interface AdminPlanUser {
  id: string;
  full_name: string | null;
  email: string | null;
  plan_tier: string | null;
  updated_at: string | null;
}

function formatMoney(value?: number | null) {
  return `$${Math.round(Number(value || 0)).toLocaleString()}`;
}

function formatPercent(numerator: number, denominator: number) {
  if (!denominator) return '0%';
  return `${Math.round((numerator / denominator) * 100)}%`;
}

export default function AdminDashboardIndex() {
  const router = useRouter();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [planUsers, setPlanUsers] = useState<AdminPlanUser[]>([]);
  const [planSearch, setPlanSearch] = useState('');
  const [planUsersExpanded, setPlanUsersExpanded] = useState(false);
  const [savingUserId, setSavingUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    void fetchStats();
  }, []);

  const fetchStats = async () => {
    setLoading(true);
    setError('');
    try {
      const [statsResult, usersResult] = await Promise.all([
        supabase.rpc('get_admin_dashboard_stats'),
        supabase
          .from('profiles')
          .select('id, full_name, email, plan_tier, updated_at')
          .order('updated_at', { ascending: false })
          .limit(40),
      ]);

      if (statsResult.error) throw statsResult.error;
      if (usersResult.error) throw usersResult.error;

      setStats(statsResult.data as DashboardStats);
      setPlanUsers((usersResult.data || []) as AdminPlanUser[]);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch admin stats');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const adoption = useMemo(() => {
    if (!stats) return { premiumShare: '0%', pushShare: '0%' };
    return {
      premiumShare: formatPercent(stats.premium_users, stats.total_users),
      pushShare: formatPercent(stats.push_enabled_users, stats.total_users),
    };
  }, [stats]);

  const pendingAdminConfirmations = Math.max(
    (stats?.pending_confirmations || 0) - (stats?.pending_friend_requests || 0),
    0
  );

  const filteredPlanUsers = useMemo(() => {
    const query = planSearch.trim().toLowerCase();
    if (!query) return planUsers.slice(0, 8);

    return planUsers
      .filter((user) =>
        `${user.full_name || ''} ${user.email || ''}`.toLowerCase().includes(query)
      )
      .slice(0, 12);
  }, [planSearch, planUsers]);

  const updatePlanTier = async (userId: string, nextPlan: PlanTier) => {
    setSavingUserId(userId);
    setError('');
    try {
      const { error } = await supabase.rpc('admin_set_profile_plan_tier', {
        p_user_id: userId,
        p_plan_tier: nextPlan,
      });

      if (error) throw error;

      setPlanUsers((current) =>
        current.map((item) => (item.id === userId ? { ...item, plan_tier: nextPlan } : item))
      );
      setStats((current) => {
        if (!current) return current;
        const currentPlan = normalizePlanTier(planUsers.find((item) => item.id === userId)?.plan_tier);
        if (currentPlan === nextPlan) return current;

        if (nextPlan === 'premium') {
          return {
            ...current,
            premium_users: current.premium_users + 1,
            free_users: Math.max(current.free_users - 1, 0),
          };
        }

        return {
          ...current,
          premium_users: Math.max(current.premium_users - 1, 0),
          free_users: current.free_users + 1,
        };
      });
    } catch (err: any) {
      setError(err.message || 'Failed to update plan');
    } finally {
      setSavingUserId(null);
    }
  };

  if (loading && !refreshing) {
    return (
      <Screen style={[styles.container, styles.center]} safeAreaEdges={['left', 'right', 'bottom']}>
        <ActivityIndicator size="large" color="#6366F1" />
      </Screen>
    );
  }

  if (error) {
    return (
      <Screen style={[styles.container, styles.center]} safeAreaEdges={['left', 'right', 'bottom']}>
        <AlertCircle size={48} color="#EF4444" />
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity onPress={() => void fetchStats()} style={styles.retryBtn}>
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </Screen>
    );
  }

  return (
    <Screen style={styles.container} safeAreaEdges={['left', 'right', 'bottom']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        contentInsetAdjustmentBehavior="never"
        automaticallyAdjustContentInsets={false}
      >
        <View style={styles.topRow}>
          <TouchableOpacity style={styles.backToAppButton} onPress={() => router.replace('/(tabs)' as any)}>
            <Text style={styles.backToAppText}>Back to app</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.refreshButton} onPress={() => { setRefreshing(true); void fetchStats(); }}>
            <RefreshCcw size={16} color="#475569" />
            <Text style={styles.refreshText}>Refresh</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.title}>Admin Analytics</Text>
        <Text style={styles.subtitle}>Growth, premium conversion, user activity, and operational load from the live backend.</Text>

        <View style={styles.heroGrid}>
          <Card style={styles.heroCard}>
            <View style={[styles.heroIcon, { backgroundColor: 'rgba(99,102,241,0.12)' }]}>
              <Users size={22} color="#6366F1" />
            </View>
            <Text style={styles.heroLabel}>Users</Text>
            <Text style={styles.heroValue}>{stats?.total_users || 0}</Text>
            <Text style={styles.heroMeta}>{stats?.new_users_7d || 0} new in 7 days</Text>
          </Card>

          <Card style={styles.heroCard}>
            <View style={[styles.heroIcon, { backgroundColor: 'rgba(234,179,8,0.14)' }]}>
              <Crown size={22} color="#CA8A04" />
            </View>
            <Text style={styles.heroLabel}>Premium</Text>
            <Text style={styles.heroValue}>{stats?.premium_users || 0}</Text>
            <Text style={styles.heroMeta}>{adoption.premiumShare} of all users</Text>
          </Card>

          <Card style={styles.heroCard}>
            <View style={[styles.heroIcon, { backgroundColor: 'rgba(16,185,129,0.12)' }]}>
              <TrendingUp size={22} color="#10B981" />
            </View>
            <Text style={styles.heroLabel}>Active Users</Text>
            <Text style={styles.heroValue}>{stats?.active_users_7d || 0}</Text>
            <Text style={styles.heroMeta}>active in last 7 days</Text>
          </Card>

          <Card style={styles.heroCard}>
            <View style={[styles.heroIcon, { backgroundColor: 'rgba(56,189,248,0.14)' }]}>
              <Wallet size={22} color="#0284C7" />
            </View>
            <Text style={styles.heroLabel}>Open Balance</Text>
            <Text style={styles.heroValueSmall}>{formatMoney(stats?.money_in_transit)}</Text>
            <Text style={styles.heroMeta}>{stats?.active_loans || 0} active records</Text>
          </Card>
        </View>

        <Text style={styles.sectionTitle}>Growth</Text>
        <View style={styles.metricsRow}>
          <Card style={styles.metricCard}>
            <Text style={styles.metricLabel}>New users</Text>
            <Text style={styles.metricValue}>{stats?.new_users_30d || 0}</Text>
            <Text style={styles.metricMeta}>Last 30 days</Text>
          </Card>
          <Card style={styles.metricCard}>
            <Text style={styles.metricLabel}>Premium upgrades</Text>
            <Text style={styles.metricValue}>{stats?.premium_new_7d || 0}</Text>
            <Text style={styles.metricMeta}>Last 7 days</Text>
          </Card>
          <Card style={styles.metricCard}>
            <Text style={styles.metricLabel}>Active users</Text>
            <Text style={styles.metricValue}>{stats?.active_users_30d || 0}</Text>
            <Text style={styles.metricMeta}>Last 30 days</Text>
          </Card>
        </View>

        <Text style={styles.sectionTitle}>Plans</Text>
        <Card style={styles.planCard}>
          <View style={styles.planRow}>
            <View>
              <Text style={styles.planTitle}>Premium users</Text>
              <Text style={styles.planCaption}>{adoption.premiumShare} conversion from total users</Text>
            </View>
            <Text style={styles.planValue}>{stats?.premium_users || 0}</Text>
          </View>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: adoption.premiumShare as any }]} />
          </View>
          <View style={styles.planBreakdownRow}>
            <Text style={styles.planBreakdownText}>Free: {stats?.free_users || 0}</Text>
            <Text style={styles.planBreakdownText}>Premium: {stats?.premium_users || 0}</Text>
          </View>
        </Card>

        <Text style={styles.sectionTitle}>Managed Premium</Text>
        <Card style={styles.managedPlanCard}>
          <View style={styles.managedPlanHeader}>
            <View style={styles.managedPlanCopy}>
              <Text style={styles.managedPlanTitle}>Membership control inside the dashboard</Text>
              <Text style={styles.managedPlanText}>Search a user and switch their tier without opening a separate screen.</Text>
            </View>
            <View style={styles.managedPlanSummary}>
              <Text style={styles.managedPlanSummaryValue}>{stats?.premium_users || 0}</Text>
              <Text style={styles.managedPlanSummaryLabel}>premium</Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.managedPlanToggle}
            activeOpacity={0.85}
            onPress={() => setPlanUsersExpanded((current) => !current)}
          >
            <View style={styles.managedPlanToggleCopy}>
              <Text style={styles.managedPlanToggleTitle}>
                {planUsersExpanded ? 'Hide managed users' : 'Show managed users'}
              </Text>
              <Text style={styles.managedPlanToggleText}>
                {planUsersExpanded
                  ? 'Collapse the list to keep the dashboard compact.'
                  : `${filteredPlanUsers.length} users ready to review without filling the screen.`}
              </Text>
            </View>
            {planUsersExpanded ? <ChevronUp size={18} color="#475569" /> : <ChevronDown size={18} color="#475569" />}
          </TouchableOpacity>

          {planUsersExpanded ? (
            <>
              <View style={styles.planSearchBar}>
                <Search size={16} color="#94A3B8" />
                <TextInput
                  value={planSearch}
                  onChangeText={setPlanSearch}
                  placeholder="Search by name or email..."
                  placeholderTextColor="#94A3B8"
                  style={styles.planSearchInput}
                />
              </View>

              <View style={styles.planUsersList}>
                {filteredPlanUsers.map((user) => {
                  const normalizedPlan = normalizePlanTier(user.plan_tier);
                  const isSaving = savingUserId === user.id;
                  const displayName = user.full_name?.trim() || user.email || 'Unknown user';

                  return (
                    <View key={user.id} style={styles.planUserRow}>
                      <View style={styles.planUserLeft}>
                        <View style={[styles.planUserAvatar, normalizedPlan === 'premium' ? styles.planUserAvatarPremium : null]}>
                          <Text style={[styles.planUserAvatarText, normalizedPlan === 'premium' ? styles.planUserAvatarTextPremium : null]}>
                            {displayName[0]?.toUpperCase() || '?'}
                          </Text>
                        </View>
                        <View style={styles.planUserInfo}>
                          <Text style={styles.planUserName}>{displayName}</Text>
                          <Text style={styles.planUserEmail}>{user.email || 'No email'}</Text>
                        </View>
                      </View>

                      <View style={styles.planUserRight}>
                        <Text style={[styles.inlinePlanBadge, normalizedPlan === 'premium' ? styles.inlinePlanBadgePremium : styles.inlinePlanBadgeFree]}>
                          {getPlanLabel(normalizedPlan)}
                        </Text>
                        <View style={styles.inlinePlanActions}>
                          <TouchableOpacity
                            style={[styles.inlinePlanButton, normalizedPlan === 'free' ? styles.inlinePlanButtonActive : null]}
                            disabled={isSaving || normalizedPlan === 'free'}
                            onPress={() => void updatePlanTier(user.id, 'free')}
                          >
                            <Text style={[styles.inlinePlanButtonText, normalizedPlan === 'free' ? styles.inlinePlanButtonTextActive : null]}>Free</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[styles.inlinePlanButton, normalizedPlan === 'premium' ? styles.inlinePlanButtonPremiumActive : null]}
                            disabled={isSaving || normalizedPlan === 'premium'}
                            onPress={() => void updatePlanTier(user.id, 'premium')}
                          >
                            <Text style={[styles.inlinePlanButtonText, normalizedPlan === 'premium' ? styles.inlinePlanButtonTextPremiumActive : null]}>
                              {isSaving ? 'Saving...' : 'Premium'}
                            </Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    </View>
                  );
                })}

                {filteredPlanUsers.length === 0 ? (
                  <View style={styles.planUsersEmpty}>
                    <Text style={styles.planUsersEmptyText}>No users match that search.</Text>
                  </View>
                ) : null}
              </View>
            </>
          ) : (
            <View style={styles.managedPlanCollapsed}>
              <Text style={styles.managedPlanCollapsedText}>
                The membership list is collapsed by default so the admin dashboard stays readable.
              </Text>
            </View>
          )}
        </Card>

        <Text style={styles.sectionTitle}>Usage</Text>
        <View style={styles.metricsRow}>
          <Card style={styles.metricCard}>
            <Text style={styles.metricLabel}>Records created</Text>
            <Text style={styles.metricValue}>{stats?.records_created_7d || 0}</Text>
            <Text style={styles.metricMeta}>Last 7 days</Text>
          </Card>
          <Card style={styles.metricCard}>
            <Text style={styles.metricLabel}>Payments logged</Text>
            <Text style={styles.metricValue}>{stats?.payments_logged_7d || 0}</Text>
            <Text style={styles.metricMeta}>Last 7 days</Text>
          </Card>
          <Card style={styles.metricCard}>
            <Text style={styles.metricLabel}>Push opt-in</Text>
            <Text style={styles.metricValue}>{stats?.push_enabled_users || 0}</Text>
            <Text style={styles.metricMeta}>{adoption.pushShare} of users</Text>
          </Card>
        </View>

        <Text style={styles.sectionTitle}>Notifications & Queue</Text>
        <View style={styles.metricsRow}>
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => router.push('/admin/requests?filter=confirmations' as any)}
          >
            <Card style={[styles.metricCard, styles.metricCardInteractive]}>
              <View style={styles.metricHeader}>
                <BellRing size={16} color="#6366F1" />
                <Text style={styles.metricLabel}>Pending confirmations</Text>
              </View>
              <Text style={styles.metricValue}>{pendingAdminConfirmations}</Text>
              <Text style={styles.metricMeta}>Pending shared-record actions</Text>
              <View style={styles.metricActionRow}>
                <Text style={styles.metricActionText}>Open admin records</Text>
                <ChevronRight size={16} color="#94A3B8" />
              </View>
            </Card>
          </TouchableOpacity>
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => router.push('/admin/requests?filter=friend_requests' as any)}
          >
            <Card style={[styles.metricCard, styles.metricCardInteractive]}>
              <View style={styles.metricHeader}>
                <Users size={16} color="#CA8A04" />
                <Text style={styles.metricLabel}>Friend requests</Text>
              </View>
              <Text style={styles.metricValue}>{stats?.pending_friend_requests || 0}</Text>
              <Text style={styles.metricMeta}>Still waiting for approval</Text>
              <View style={styles.metricActionRow}>
                <Text style={styles.metricActionText}>Open admin records</Text>
                <ChevronRight size={16} color="#94A3B8" />
              </View>
            </Card>
          </TouchableOpacity>
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => router.push('/admin/loans' as any)}
          >
            <Card style={[styles.metricCard, styles.metricCardInteractive]}>
              <View style={styles.metricHeader}>
                <Wallet size={16} color="#10B981" />
                <Text style={styles.metricLabel}>Total records</Text>
              </View>
              <Text style={styles.metricValue}>{stats?.total_loans || 0}</Text>
              <Text style={styles.metricMeta}>All-time loan/item records</Text>
              <View style={styles.metricActionRow}>
                <Text style={styles.metricActionText}>Open admin records</Text>
                <ChevronRight size={16} color="#94A3B8" />
              </View>
            </Card>
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionTitle}>Store Metrics</Text>
        <Card style={styles.externalCard}>
          <View style={styles.externalRow}>
            <ArrowDownToLine size={18} color="#475569" />
            <View style={styles.externalCopy}>
              <Text style={styles.externalTitle}>Downloads</Text>
              <Text style={styles.externalText}>Needs App Store Connect / Play Console or an analytics SDK. Supabase alone cannot infer installs reliably.</Text>
            </View>
          </View>
          <View style={styles.externalRow}>
            <UserMinus size={18} color="#475569" />
            <View style={styles.externalCopy}>
              <Text style={styles.externalTitle}>Uninstalls</Text>
              <Text style={styles.externalText}>Requires external attribution/analytics. The current app backend does not receive uninstall events.</Text>
            </View>
          </View>
        </Card>

        <Text style={styles.sectionTitle}>Management</Text>
        <Card style={styles.menuCard}>
          <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/admin/users' as any)}>
            <View style={styles.menuItemLeft}>
              <View style={[styles.menuIcon, { backgroundColor: 'rgba(99, 102, 241, 0.1)' }]}>
                <Users size={20} color="#6366F1" />
              </View>
              <View style={styles.menuTextWrap}>
                <Text style={styles.menuLabel}>Users</Text>
                <Text style={styles.menuSub}>Advanced user admin: history, password reset, and deletes</Text>
              </View>
            </View>
            <ChevronRight size={18} color="#94A3B8" />
          </TouchableOpacity>

          <TouchableOpacity style={[styles.menuItem, styles.menuItemLast]} onPress={() => router.push('/admin/loans' as any)}>
            <View style={styles.menuItemLeft}>
              <View style={[styles.menuIcon, { backgroundColor: 'rgba(16, 185, 129, 0.1)' }]}>
                <Wallet size={20} color="#10B981" />
              </View>
              <View style={styles.menuTextWrap}>
                <Text style={styles.menuLabel}>Records</Text>
                <Text style={styles.menuSub}>Review platform-wide loans, items, and balances</Text>
              </View>
            </View>
            <ChevronRight size={18} color="#94A3B8" />
          </TouchableOpacity>
        </Card>
      </ScrollView>
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
  scroll: {
    padding: 20,
    paddingBottom: 40,
    gap: 16,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  backToAppButton: {
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: '#EEF2FF',
  },
  backToAppText: {
    color: '#4338CA',
    fontWeight: '800',
    fontSize: 13,
  },
  refreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  refreshText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
  },
  title: {
    fontSize: 28,
    fontWeight: '900',
    color: '#0F172A',
    marginTop: 12,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 21,
    color: '#64748B',
  },
  heroGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    backgroundColor: 'transparent',
  },
  heroCard: {
    width: '48%',
    marginBottom: 12,
    padding: 16,
  },
  heroIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  heroLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748B',
    marginBottom: 6,
  },
  heroValue: {
    fontSize: 28,
    fontWeight: '900',
    color: '#0F172A',
  },
  heroValueSmall: {
    fontSize: 24,
    fontWeight: '900',
    color: '#0F172A',
  },
  heroMeta: {
    marginTop: 6,
    fontSize: 12,
    color: '#64748B',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 6,
  },
  metricsRow: {
    gap: 12,
    backgroundColor: 'transparent',
  },
  metricCard: {
    padding: 16,
  },
  metricCardInteractive: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  metricHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
    backgroundColor: 'transparent',
  },
  metricLabel: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '700',
  },
  metricValue: {
    fontSize: 24,
    fontWeight: '900',
    color: '#0F172A',
  },
  metricMeta: {
    marginTop: 4,
    fontSize: 12,
    color: '#94A3B8',
  },
  metricActionRow: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'transparent',
  },
  metricActionText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  planCard: {
    padding: 18,
  },
  planRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
    backgroundColor: 'transparent',
  },
  planTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  planCaption: {
    marginTop: 4,
    fontSize: 13,
    color: '#64748B',
  },
  planValue: {
    fontSize: 26,
    fontWeight: '900',
    color: '#0F172A',
  },
  progressTrack: {
    height: 12,
    borderRadius: 999,
    backgroundColor: '#E2E8F0',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: '#6366F1',
  },
  planBreakdownRow: {
    marginTop: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: 'transparent',
  },
  planBreakdownText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
  },
  managedPlanCard: {
    padding: 18,
    gap: 14,
  },
  managedPlanHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: 'transparent',
  },
  managedPlanCopy: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  managedPlanTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  managedPlanText: {
    marginTop: 4,
    fontSize: 13,
    lineHeight: 19,
    color: '#64748B',
  },
  managedPlanSummary: {
    minWidth: 74,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 16,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    alignItems: 'center',
  },
  managedPlanSummaryValue: {
    fontSize: 24,
    fontWeight: '900',
    color: '#047857',
  },
  managedPlanSummaryLabel: {
    marginTop: 2,
    fontSize: 11,
    fontWeight: '800',
    color: '#047857',
    textTransform: 'uppercase',
  },
  managedPlanToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  managedPlanToggleCopy: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  managedPlanToggleTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  managedPlanToggleText: {
    marginTop: 4,
    fontSize: 12,
    lineHeight: 18,
    color: '#64748B',
  },
  managedPlanCollapsed: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 16,
    backgroundColor: 'rgba(148, 163, 184, 0.08)',
  },
  managedPlanCollapsedText: {
    fontSize: 12,
    lineHeight: 18,
    color: '#64748B',
  },
  planSearchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    backgroundColor: '#F8FAFC',
  },
  planSearchInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 14,
    color: '#0F172A',
  },
  planUsersList: {
    gap: 10,
    backgroundColor: 'transparent',
  },
  planUserRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 16,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  planUserLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    backgroundColor: 'transparent',
  },
  planUserAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  planUserAvatarPremium: {
    backgroundColor: 'rgba(16, 185, 129, 0.16)',
  },
  planUserAvatarText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#475569',
  },
  planUserAvatarTextPremium: {
    color: '#047857',
  },
  planUserInfo: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  planUserName: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  planUserEmail: {
    marginTop: 2,
    fontSize: 12,
    color: '#64748B',
  },
  planUserRight: {
    alignItems: 'flex-end',
    gap: 8,
    backgroundColor: 'transparent',
  },
  inlinePlanBadge: {
    fontSize: 11,
    fontWeight: '800',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    overflow: 'hidden',
  },
  inlinePlanBadgeFree: {
    backgroundColor: 'rgba(148, 163, 184, 0.14)',
    color: '#475569',
  },
  inlinePlanBadgePremium: {
    backgroundColor: 'rgba(16, 185, 129, 0.14)',
    color: '#047857',
  },
  inlinePlanActions: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: 'transparent',
  },
  inlinePlanButton: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
  },
  inlinePlanButtonActive: {
    backgroundColor: '#E2E8F0',
    borderColor: '#E2E8F0',
  },
  inlinePlanButtonPremiumActive: {
    backgroundColor: '#0F172A',
    borderColor: '#0F172A',
  },
  inlinePlanButtonText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#475569',
  },
  inlinePlanButtonTextActive: {
    color: '#334155',
  },
  inlinePlanButtonTextPremiumActive: {
    color: '#FFFFFF',
  },
  planUsersEmpty: {
    paddingVertical: 12,
    backgroundColor: 'transparent',
  },
  planUsersEmptyText: {
    fontSize: 13,
    color: '#94A3B8',
    textAlign: 'center',
  },
  externalCard: {
    padding: 16,
    gap: 14,
  },
  externalRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: 'transparent',
  },
  externalCopy: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  externalTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 4,
  },
  externalText: {
    fontSize: 13,
    lineHeight: 19,
    color: '#64748B',
  },
  menuCard: {
    padding: 0,
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  menuItemLast: {
    borderBottomWidth: 0,
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    backgroundColor: 'transparent',
  },
  menuIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  menuTextWrap: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  menuLabel: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  menuSub: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 3,
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
    borderRadius: 12,
  },
  retryText: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
});
