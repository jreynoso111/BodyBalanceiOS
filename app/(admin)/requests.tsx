import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { AlertCircle, BellRing, RefreshCcw, Search, UserPlus, Wallet } from 'lucide-react-native';
import { Card, Screen } from '@/components/Themed';
import { supabase } from '@/services/supabase';

type AdminRequestFilter = 'confirmations' | 'friend_requests' | 'all';

interface AdminRequestRow {
  id: string;
  type: string;
  status: string;
  message: string | null;
  created_at: string;
  loan_id?: string | null;
  payment_id?: string | null;
  request_payload?: Record<string, unknown> | null;
  from_profile?: { full_name?: string | null; email?: string | null } | null;
  to_profile?: { full_name?: string | null; email?: string | null } | null;
}

function getRequestTypeLabel(type: string) {
  if (type === 'friend_request') return 'Friend request';
  if (type === 'loan_notice') return 'Shared record notice';
  if (type === 'loan_validation') return 'Shared record confirmation';
  if (type === 'payment_validation') return 'Payment confirmation';
  if (type === 'debt_reduction') return 'Adjustment request';
  return 'Shared update';
}

function getRequestIcon(type: string) {
  if (type === 'friend_request') return <UserPlus size={18} color="#4F46E5" />;
  if (type === 'loan_notice' || type === 'loan_validation' || type === 'payment_validation' || type === 'debt_reduction') {
    return <Wallet size={18} color="#10B981" />;
  }
  return <BellRing size={18} color="#6366F1" />;
}

function getDisplayName(profile?: { full_name?: string | null; email?: string | null } | null) {
  return profile?.full_name?.trim() || profile?.email || 'Unknown user';
}

function formatDateTime(value?: string | null) {
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
}

export default function AdminRequestsScreen() {
  const { filter } = useLocalSearchParams<{ filter?: string }>();
  const activeFilter: AdminRequestFilter =
    filter === 'friend_requests' || filter === 'all' ? filter : 'confirmations';
  const [requests, setRequests] = useState<AdminRequestRow[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    void fetchRequests();
  }, [activeFilter]);

  const fetchRequests = async () => {
    setLoading(true);
    setError('');
    try {
      let query = supabase
        .from('p2p_requests')
        .select('id, type, status, message, created_at, loan_id, payment_id, request_payload, from_profile:profiles!from_user_id(full_name, email), to_profile:profiles!to_user_id(full_name, email)')
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (activeFilter === 'friend_requests') {
        query = query.eq('type', 'friend_request');
      } else if (activeFilter === 'confirmations') {
        query = query.neq('type', 'friend_request');
      }

      const { data, error } = await query;
      if (error) throw error;

      setRequests((data || []) as AdminRequestRow[]);
    } catch (err: any) {
      setError(err.message || 'Failed to load admin requests');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const filteredRequests = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return requests;

    return requests.filter((item) =>
      [
        getRequestTypeLabel(item.type),
        item.message || '',
        getDisplayName(item.from_profile),
        getDisplayName(item.to_profile),
        item.loan_id || '',
        item.payment_id || '',
      ]
        .join(' ')
        .toLowerCase()
        .includes(query)
    );
  }, [requests, search]);

  const title =
    activeFilter === 'friend_requests'
      ? 'Friend Requests'
      : activeFilter === 'all'
        ? 'Admin Requests'
        : 'Pending Confirmations';

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
        <TouchableOpacity onPress={() => void fetchRequests()} style={styles.retryBtn}>
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </Screen>
    );
  }

  return (
    <Screen style={styles.container}>
      <Stack.Screen options={{ title }} />

      <View style={styles.header}>
        <View style={styles.searchBar}>
          <Search size={18} color="#94A3B8" />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search by user, type, or record id..."
            placeholderTextColor="#94A3B8"
            style={styles.searchInput}
          />
        </View>
        <TouchableOpacity onPress={() => { setRefreshing(true); void fetchRequests(); }} style={styles.refreshBtn}>
          <RefreshCcw size={18} color="#475569" />
        </TouchableOpacity>
      </View>

      <FlatList
        data={filteredRequests}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void fetchRequests(); }} />}
        renderItem={({ item }) => (
          <Card style={styles.requestCard}>
            <View style={styles.requestHeader}>
              <View style={styles.requestIconWrap}>{getRequestIcon(item.type)}</View>
              <View style={styles.requestHeaderCopy}>
                <Text style={styles.requestType}>{getRequestTypeLabel(item.type)}</Text>
                <Text style={styles.requestDate}>{formatDateTime(item.created_at)}</Text>
              </View>
              <View style={styles.requestStatusBadge}>
                <Text style={styles.requestStatusText}>{item.status}</Text>
              </View>
            </View>

            <View style={styles.participantsRow}>
              <View style={styles.participantBlock}>
                <Text style={styles.participantLabel}>From</Text>
                <Text style={styles.participantValue}>{getDisplayName(item.from_profile)}</Text>
              </View>
              <View style={styles.participantDivider} />
              <View style={styles.participantBlock}>
                <Text style={styles.participantLabel}>To</Text>
                <Text style={styles.participantValue}>{getDisplayName(item.to_profile)}</Text>
              </View>
            </View>

            {item.message ? <Text style={styles.message}>{item.message}</Text> : null}

            <View style={styles.metaList}>
              {item.loan_id ? <Text style={styles.metaItem}>Loan ID: {item.loan_id}</Text> : null}
              {item.payment_id ? <Text style={styles.metaItem}>Payment ID: {item.payment_id}</Text> : null}
              {item.request_payload?.['sender_contact_id'] ? (
                <Text style={styles.metaItem}>Sender contact: {String(item.request_payload['sender_contact_id'])}</Text>
              ) : null}
            </View>
          </Card>
        )}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <BellRing size={44} color="#CBD5E1" />
            <Text style={styles.emptyTitle}>No records for this filter</Text>
            <Text style={styles.emptyText}>When new admin-visible confirmations or friend requests arrive, they will show up here.</Text>
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
    padding: 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 14,
    color: '#0F172A',
  },
  refreshBtn: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
  },
  listContent: {
    padding: 16,
    paddingBottom: 40,
  },
  requestCard: {
    padding: 16,
    marginBottom: 12,
  },
  requestHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  requestIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(99, 102, 241, 0.08)',
    marginRight: 12,
  },
  requestHeaderCopy: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  requestType: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  requestDate: {
    marginTop: 3,
    fontSize: 12,
    color: '#64748B',
  },
  requestStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
  },
  requestStatusText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#B45309',
    textTransform: 'uppercase',
  },
  participantsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 14,
    padding: 12,
    borderRadius: 14,
    backgroundColor: '#F8FAFC',
  },
  participantBlock: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  participantDivider: {
    width: 1,
    height: 28,
    marginHorizontal: 12,
    backgroundColor: '#E2E8F0',
  },
  participantLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    color: '#94A3B8',
  },
  participantValue: {
    marginTop: 4,
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  message: {
    marginTop: 14,
    fontSize: 14,
    lineHeight: 20,
    color: '#475569',
  },
  metaList: {
    marginTop: 14,
    gap: 4,
    backgroundColor: 'transparent',
  },
  metaItem: {
    fontSize: 12,
    color: '#64748B',
  },
  emptyState: {
    alignItems: 'center',
    padding: 40,
    backgroundColor: 'transparent',
  },
  emptyTitle: {
    marginTop: 16,
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  emptyText: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 20,
    color: '#64748B',
    textAlign: 'center',
  },
  errorText: {
    marginTop: 16,
    fontSize: 16,
    color: '#EF4444',
    textAlign: 'center',
  },
  retryBtn: {
    marginTop: 24,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#6366F1',
  },
  retryText: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
});
