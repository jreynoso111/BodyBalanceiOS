import React, { useCallback, useState } from 'react';
import { StyleSheet, FlatList, TouchableOpacity, View as RNView, TextInput, useWindowDimensions, Modal, ScrollView, RefreshControl } from 'react-native';
import { Text, View, Screen, Card } from '@/components/Themed';
import { AppLegalFooter } from '@/components/AppLegalFooter';
import { supabase } from '@/services/supabase';
import { useAuthStore } from '@/store/authStore';
import { UserPlus, Search, ChevronDown, ChevronUp, X, Link2, Plus } from 'lucide-react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getCurrencySymbol } from '@/constants/Currencies';

type ContactLoan = {
  id: string;
  amount: number | null;
  type: 'lent' | 'borrowed';
  contact_id: string;
  category: 'money' | 'item';
  status: string;
  item_name: string | null;
  due_date: string | null;
  currency: string | null;
  created_at: string;
  remaining?: number;
};

type ContactPayment = {
  id: string;
  amount: number | null;
  loan_id: string;
  payment_date: string | null;
  payment_method: 'money' | 'item' | null;
  note: string | null;
  returned_item_name: string | null;
};

type ContactHistoryEvent = {
  id: string;
  loanId: string;
  occurredAt: string;
  title: string;
  subtitle: string;
  value?: string;
  valueColor?: string;
};

type ContactItem = {
  id: string;
  name: string;
  target_user_id?: string | null;
  link_status?: 'private' | 'pending' | 'accepted' | null;
  phone?: string | null;
  email?: string | null;
  social_network?: string | null;
  notes?: string | null;
  balance: number;
  itemsOwed: number;
  activeLoansList: ContactLoan[];
  historyEntries: ContactHistoryEvent[];
  target_profile?: {
    full_name?: string | null;
    email?: string | null;
    phone?: string | null;
    friend_code?: string | null;
  } | null;
};

function getLinkedContactName(contact: Pick<ContactItem, 'name' | 'link_status' | 'target_profile'>) {
  if (contact.link_status === 'accepted') {
    const profileName = String(contact.target_profile?.full_name || contact.target_profile?.email || '').trim();
    if (profileName) return profileName;
  }

  return contact.name;
}

function getLinkedContactPhone(contact: Pick<ContactItem, 'phone' | 'link_status' | 'target_profile'>) {
  if (contact.link_status === 'accepted') {
    const profilePhone = String(contact.target_profile?.phone || '').trim();
    if (profilePhone) return profilePhone;
  }

  return contact.phone || null;
}

function getLinkedContactEmail(contact: Pick<ContactItem, 'email' | 'link_status' | 'target_profile'>) {
  if (contact.link_status === 'accepted') {
    const profileEmail = String(contact.target_profile?.email || '').trim();
    if (profileEmail) return profileEmail;
  }

  return contact.email || null;
}

export default function ContactsScreen() {
  const { user } = useAuthStore();
  const [contacts, setContacts] = useState<ContactItem[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedContactId, setExpandedContactId] = useState<string | null>(null);
  const [selectedHistoryContact, setSelectedHistoryContact] = useState<{ name: string; events: ContactHistoryEvent[] } | null>(null);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  const isTablet = width >= 768;
  const horizontalPadding = isTablet ? 28 : 20;
  const maxContentWidth = isTablet ? 760 : undefined;
  const bottomInset = Math.max(insets.bottom, 12);
  const fabBottomOffset = bottomInset + 16;
  const listBottomPadding = bottomInset + 88;

  const fetchContacts = useCallback(async () => {
    if (!user?.id) return;

    const { data: contactsData } = await supabase
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
      .eq('user_id', user.id)
      .is('deleted_at', null)
      .order('name', { ascending: true });

    if (!contactsData || contactsData.length === 0) {
      setContacts([]);
      return;
    }

    const { data: allLoansData } = await supabase
      .from('loans')
      .select('id, amount, type, contact_id, category, status, item_name, due_date, currency, created_at')
      .eq('user_id', user.id)
      .is('deleted_at', null);

    const allLoans = (allLoansData || []) as ContactLoan[];
    let paymentsData: ContactPayment[] = [];

    if (allLoans.length > 0) {
      const loanIds = allLoans.map((loan) => loan.id);
      const { data: pData } = await supabase
        .from('payments')
        .select('id, amount, loan_id, payment_date, payment_method, note, returned_item_name')
        .in('loan_id', loanIds);

      paymentsData = (pData || []) as ContactPayment[];
    }

    const paymentsByLoan = new Map<string, ContactPayment[]>();
    paymentsData.forEach((payment) => {
      const current = paymentsByLoan.get(payment.loan_id) || [];
      current.push(payment);
      paymentsByLoan.set(payment.loan_id, current);
    });

    const contactsWithSummary = contactsData.map((contact: any) => {
      let balance = 0;
      let itemsOwed = 0;

      const contactLoans = allLoans.filter((loan) => loan.contact_id === contact.id);
      const activeLoansList = contactLoans
        .filter((loan) => loan.status === 'active' || loan.status === 'partial')
        .map((loan) => {
          if (loan.category === 'money') {
            const loanPayments = paymentsByLoan.get(loan.id) || [];
            const totalPaid = loanPayments.reduce((acc, payment) => {
              const paymentAmount = Number(payment.amount || 0);
              return payment.payment_method === 'money' && Number.isFinite(paymentAmount)
                ? acc + paymentAmount
                : acc;
            }, 0);
            const remaining = Math.max(Number(loan.amount || 0) - totalPaid, 0);

            if (loan.type === 'lent') {
              balance += remaining;
            } else if (loan.type === 'borrowed') {
              balance -= remaining;
            }

            return { ...loan, remaining };
          }

          if (loan.type === 'lent') {
            itemsOwed += 1;
          } else if (loan.type === 'borrowed') {
            itemsOwed -= 1;
          }

          return loan;
        });

      return {
        ...contact,
        balance,
        itemsOwed,
        activeLoansList,
        historyEntries: buildContactHistory(contactLoans, paymentsByLoan),
      } as ContactItem;
    });

    setContacts(contactsWithSummary);
  }, [user?.id]);

  useFocusEffect(
    useCallback(() => {
      void fetchContacts();
    }, [fetchContacts])
  );

  React.useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel(`contacts:${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'contacts',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          void fetchContacts();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [fetchContacts, user?.id]);

  const filteredContacts = contacts.filter((contact) => {
    const displayName = getLinkedContactName(contact).toLowerCase();
    const normalizedQuery = searchQuery.toLowerCase();

    return (
      displayName.includes(normalizedQuery) ||
      contact.name.toLowerCase().includes(normalizedQuery) ||
      Boolean(contact.phone && contact.phone.includes(searchQuery)) ||
      Boolean(contact.email && contact.email.toLowerCase().includes(normalizedQuery)) ||
      Boolean(contact.target_profile?.phone && contact.target_profile.phone.includes(searchQuery)) ||
      Boolean(contact.target_profile?.email && contact.target_profile.email.toLowerCase().includes(normalizedQuery))
    );
  });

  const openHistoryModal = (contact: ContactItem) => {
    setSelectedHistoryContact({
      name: getLinkedContactName(contact),
      events: contact.historyEntries,
    });
  };

  const closeHistoryModal = () => {
    setSelectedHistoryContact(null);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await fetchContacts();
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <Screen style={styles.container} safeAreaEdges={['left', 'right', 'bottom']}>
      <RNView style={[styles.searchWrapper, { paddingHorizontal: horizontalPadding, paddingTop: isTablet ? 24 : 20 }]}>
        <View style={[styles.searchContainer, maxContentWidth ? { maxWidth: maxContentWidth, alignSelf: 'center', width: '100%' } : null]}>
          <Search size={20} color="#94A3B8" />
          <TextInput
            placeholder="Search contacts..."
            placeholderTextColor="#94A3B8"
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
      </RNView>

      <FlatList
        data={filteredContacts}
        keyExtractor={(item) => item.id}
        contentInsetAdjustmentBehavior="never"
        automaticallyAdjustContentInsets={false}
        contentContainerStyle={[
          styles.listContent,
          {
            paddingHorizontal: horizontalPadding,
            paddingBottom: listBottomPadding,
          },
        ]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => void handleRefresh()} />
        }
        ListEmptyComponent={
          <Card style={[styles.emptyCard, maxContentWidth ? { maxWidth: maxContentWidth, alignSelf: 'center', width: '100%' } : null]}>
            <Text style={styles.emptyText}>No contacts found.</Text>
          </Card>
        }
        renderItem={({ item }) => {
          const isExpanded = expandedContactId === item.id;
          const summaryTone = getSummaryTone(item.balance, item.itemsOwed);
          const compactDetails = getCompactDetails(item);
          const recentHistory = item.historyEntries.slice(0, 3);
          const displayName = getLinkedContactName(item);

          return (
            <RNView
              style={[
                styles.contactItemWrapper,
                maxContentWidth ? { maxWidth: maxContentWidth, alignSelf: 'center', width: '100%' } : null,
              ]}
            >
              <TouchableOpacity activeOpacity={0.9} onPress={() => setExpandedContactId(isExpanded ? null : item.id)}>
                <Card style={[styles.contactItem, isExpanded && styles.contactItemExpanded]}>
                  <RNView style={styles.avatar}>
                    <Text style={styles.avatarText}>{displayName[0]?.toUpperCase()}</Text>
                  </RNView>

                  <RNView style={styles.contactInfo}>
                    <RNView style={styles.contactNameRow}>
                      <Text style={styles.contactName}>{displayName}</Text>
                      {item.link_status === 'accepted' ? (
                        <RNView style={[styles.contactLinkBadge, styles.contactLinkBadgeAccepted]}>
                          <Text style={[styles.contactLinkBadgeText, styles.contactLinkBadgeTextAccepted]}>Linked</Text>
                        </RNView>
                      ) : item.link_status === 'pending' ? (
                        <RNView style={[styles.contactLinkBadge, styles.contactLinkBadgePending]}>
                          <Text style={[styles.contactLinkBadgeText, styles.contactLinkBadgeTextPending]}>Invite sent</Text>
                        </RNView>
                      ) : null}
                    </RNView>
                    <Text style={styles.contactDetail}>
                      {getLinkedContactPhone(item) || getLinkedContactEmail(item) || item.social_network || 'Tap to view details and history'}
                    </Text>
                  </RNView>

                  <RNView style={styles.summaryColumn}>
                    <Text style={[styles.summaryValue, summaryTone === 'positive' ? styles.summaryPositive : summaryTone === 'negative' ? styles.summaryNegative : styles.summaryNeutral]}>
                      {getPrimarySummary(item.balance, item.itemsOwed)}
                    </Text>
                    <Text style={styles.summaryLabel}>{getSecondarySummary(item.balance, item.itemsOwed, item.activeLoansList.length)}</Text>
                  </RNView>

                  <RNView style={styles.chevronButton}>
                    {isExpanded ? <ChevronUp size={20} color="#94A3B8" /> : <ChevronDown size={20} color="#94A3B8" />}
                  </RNView>
                </Card>
              </TouchableOpacity>

              {isExpanded && (
                <Card style={styles.expandedCard}>
                  <RNView style={styles.expandedHeaderRow}>
                    <Text style={styles.expandedSectionTitle}>Contact snapshot</Text>
                    <RNView style={styles.inlineActionsRow}>
                      <TouchableOpacity
                        style={styles.inlineActionButton}
                        onPress={() =>
                          router.push({
                            pathname: '/new-loan',
                            params: {
                              contactId: item.id,
                            },
                          })
                        }
                      >
                        <Plus size={14} color="#FFFFFF" />
                        <Text style={styles.inlineActionButtonText}>Add record</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.inlineLinkButton}
                        onPress={() => router.push({ pathname: '/new-contact', params: { id: item.id } })}
                      >
                        <Text style={styles.inlineLinkText}>Edit contact</Text>
                      </TouchableOpacity>
                    </RNView>
                  </RNView>

                  {compactDetails.length > 0 ? (
                    <RNView style={styles.detailList}>
                      {compactDetails.map((detail, index) => (
                        <RNView
                          key={`${item.id}-${detail.label}`}
                          style={[styles.detailRow, index === compactDetails.length - 1 && styles.detailRowLast]}
                        >
                          <Text style={styles.detailRowLabel}>{detail.label}</Text>
                          <Text style={styles.detailRowValue}>{detail.value}</Text>
                        </RNView>
                      ))}
                    </RNView>
                  ) : (
                    <Text style={styles.emptyInlineText}>No extra details saved for this contact yet.</Text>
                  )}

                  {item.notes ? (
                    <RNView style={styles.noteCard}>
                      <Text style={styles.noteLabel}>Notes</Text>
                      <Text style={styles.noteText} numberOfLines={3}>{item.notes}</Text>
                    </RNView>
                  ) : null}

                  <RNView style={styles.accountLinkCard}>
                    <RNView style={styles.accountLinkHeader}>
                      <RNView style={styles.accountLinkIcon}>
                        <Link2 size={16} color="#4F46E5" />
                      </RNView>
                      <RNView style={styles.accountLinkCopy}>
                        <Text style={styles.accountLinkTitle}>
                          {item.link_status === 'accepted'
                            ? 'Linked to a Buddy Balance account'
                            : item.link_status === 'pending'
                              ? 'Friend invitation sent'
                              : 'Link this contact to a friend account'}
                        </Text>
                        <Text style={styles.accountLinkText}>
                          {item.link_status === 'accepted'
                            ? 'Shared records with this person can sync across both accounts.'
                            : item.link_status === 'pending'
                              ? 'Good to go. Your invitation is on its way, and shared records will start syncing as soon as they accept.'
                              : 'If this person uses Buddy Balance, add their friend code to connect both accounts.'}
                        </Text>
                      </RNView>
                    </RNView>

                    {item.link_status !== 'accepted' ? (
                      <TouchableOpacity
                        style={styles.accountLinkButton}
                        onPress={() =>
                          router.push({
                            pathname: '/new-contact',
                            params: { id: item.id, mode: 'friend' },
                          })
                        }
                      >
                        <Text style={styles.accountLinkButtonText}>
                          {item.link_status === 'pending' ? 'Review friend link' : 'Link with friend code'}
                        </Text>
                      </TouchableOpacity>
                    ) : null}
                  </RNView>

                  <RNView style={styles.expandedHeaderRow}>
                    <Text style={styles.expandedSectionTitle}>Recent activity</Text>
                    {item.historyEntries.length > 0 ? (
                      <TouchableOpacity style={styles.inlineLinkButton} onPress={() => openHistoryModal(item)}>
                        <Text style={styles.inlineLinkText}>View history</Text>
                      </TouchableOpacity>
                    ) : null}
                  </RNView>

                  {recentHistory.length === 0 ? (
                    <Text style={styles.emptyInlineText}>No activity recorded with this contact yet.</Text>
                  ) : (
                    <RNView style={styles.activityList}>
                      {recentHistory.map((event, index) => (
                        <TouchableOpacity
                          key={event.id}
                          activeOpacity={0.85}
                          style={[styles.activityRow, index === recentHistory.length - 1 && styles.activityRowLast]}
                          onPress={() => router.push(`/loan/${event.loanId}`)}
                        >
                          <RNView style={styles.activityCopy}>
                            <Text style={styles.activityTitle}>{event.title}</Text>
                            <Text style={styles.activitySubtitle}>{event.subtitle}</Text>
                          </RNView>
                          <RNView style={styles.activityRight}>
                            {event.value ? <Text style={[styles.activityValue, event.valueColor ? { color: event.valueColor } : null]}>{event.value}</Text> : null}
                            <Text style={styles.activityDate}>{formatActivityDate(event.occurredAt)}</Text>
                          </RNView>
                        </TouchableOpacity>
                      ))}
                    </RNView>
                  )}

                  <RNView style={styles.expandedHeaderRow}>
                    <Text style={styles.expandedSectionTitle}>Open records</Text>
                    <Text style={styles.sectionMeta}>{item.activeLoansList.length}</Text>
                  </RNView>

                  {item.activeLoansList.length === 0 ? (
                    <Text style={styles.emptyInlineText}>Nothing open with this contact right now.</Text>
                  ) : (
                    item.activeLoansList.map((loan, idx) => (
                      <RNView
                        key={loan.id}
                        style={[
                          styles.openRecordRow,
                          idx === item.activeLoansList.length - 1 && styles.openRecordRowLast,
                        ]}
                      >
                        <TouchableOpacity
                          activeOpacity={0.85}
                          onPress={() => router.push(`/loan/${loan.id}`)}
                        >
                          <RNView style={styles.openRecordContent}>
                            <RNView style={styles.openRecordCopy}>
                              <Text style={styles.openRecordTitle}>
                                {loan.category === 'money' ? 'Money record' : loan.item_name || 'Item record'}
                              </Text>
                              {loan.due_date ? (
                                <Text style={styles.openRecordMeta}>
                                  {loan.category === 'money' ? 'Due' : 'Expected'} {formatSimpleDate(loan.due_date)}
                                </Text>
                              ) : (
                                <Text style={styles.openRecordMeta}>No due date</Text>
                              )}
                              <Text style={styles.openRecordHint}>Tap to open details</Text>
                            </RNView>
                            <RNView style={styles.openRecordRight}>
                              {loan.category === 'money' ? (
                                <Text style={[styles.openRecordValue, loan.type === 'lent' ? styles.summaryPositive : styles.summaryNegative]}>
                                  {getCurrencySymbol(loan.currency || 'USD')}{Math.round(Number(loan.remaining || 0)).toLocaleString()}
                                </Text>
                              ) : (
                                <Text style={styles.openRecordValue}>Active</Text>
                              )}
                              <Text style={styles.openRecordType}>{loan.type === 'lent' ? 'Lent' : 'Borrowed'}</Text>
                            </RNView>
                          </RNView>
                        </TouchableOpacity>

                        {loan.category === 'money' && (
                          <RNView style={styles.recordActionRow}>
                            <TouchableOpacity
                              activeOpacity={0.85}
                              onPress={() =>
                                router.push({
                                  pathname: '/payment',
                                  params: {
                                    loanId: String(loan.id),
                                    remaining: String(Math.max(Number(loan.remaining) || 0, 0)),
                                    currency: String(loan.currency || 'USD'),
                                    category: String(loan.category || 'money'),
                                  },
                                })
                              }
                              style={styles.recordActionButton}
                            >
                              <Text style={styles.recordActionText}>Add payment</Text>
                            </TouchableOpacity>
                          </RNView>
                        )}
                      </RNView>
                    ))
                  )}
                </Card>
              )}
            </RNView>
          );
        }}
        ListFooterComponent={<AppLegalFooter style={styles.copyright} />}
      />

      <TouchableOpacity
        style={[
          styles.fab,
          {
            right: horizontalPadding,
            bottom: fabBottomOffset,
          },
        ]}
        onPress={() => router.push('/new-contact')}
      >
        <UserPlus color="#fff" size={28} />
      </TouchableOpacity>

      <Modal
        animationType="slide"
        transparent
        visible={!!selectedHistoryContact}
        onRequestClose={closeHistoryModal}
      >
        <RNView style={styles.modalOverlay}>
          <Card style={styles.modalCard}>
            <RNView style={styles.modalHeader}>
              <RNView style={styles.modalHeaderCopy}>
                <Text style={styles.modalTitle}>{selectedHistoryContact?.name || 'Contact'} history</Text>
                <Text style={styles.modalSubtitle}>Tap an event to open the related record.</Text>
              </RNView>
              <TouchableOpacity onPress={closeHistoryModal} style={styles.modalCloseButton}>
                <X size={20} color="#0F172A" />
              </TouchableOpacity>
            </RNView>

            <ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalScrollContent} showsVerticalScrollIndicator={false}>
              {selectedHistoryContact?.events.length ? (
                selectedHistoryContact.events.map((event, index) => (
                  <TouchableOpacity
                    key={event.id}
                    activeOpacity={0.85}
                    style={[styles.historyRow, index === selectedHistoryContact.events.length - 1 && styles.historyRowLast]}
                    onPress={() => {
                      closeHistoryModal();
                      router.push(`/loan/${event.loanId}`);
                    }}
                  >
                    <RNView style={styles.activityCopy}>
                      <Text style={styles.activityTitle}>{event.title}</Text>
                      <Text style={styles.activitySubtitle}>{event.subtitle}</Text>
                    </RNView>
                    <RNView style={styles.activityRight}>
                      {event.value ? <Text style={[styles.activityValue, event.valueColor ? { color: event.valueColor } : null]}>{event.value}</Text> : null}
                      <Text style={styles.activityDate}>{formatActivityDate(event.occurredAt)}</Text>
                    </RNView>
                  </TouchableOpacity>
                ))
              ) : (
                <Text style={styles.emptyInlineText}>No history yet for this contact.</Text>
              )}
            </ScrollView>
          </Card>
        </RNView>
      </Modal>
    </Screen>
  );
}

function buildContactHistory(loans: ContactLoan[], paymentsByLoan: Map<string, ContactPayment[]>) {
  const events: ContactHistoryEvent[] = [];

  loans.forEach((loan) => {
    events.push({
      id: `loan-${loan.id}`,
      loanId: loan.id,
      occurredAt: loan.created_at,
      title: getLoanCreatedTitle(loan),
      subtitle: loan.due_date ? `Due ${formatSimpleDate(loan.due_date)}` : 'Record created without a due date',
      value: loan.category === 'money'
        ? `${loan.type === 'lent' ? '+' : '-'}${formatMoneyValue(loan.amount, loan.currency)}`
        : loan.item_name || 'Item',
      valueColor: loan.category === 'money'
        ? loan.type === 'lent' ? '#10B981' : '#EF4444'
        : '#6366F1',
    });

    const loanPayments = [...(paymentsByLoan.get(loan.id) || [])].sort(
      (a, b) => getTimestamp(b.payment_date) - getTimestamp(a.payment_date)
    );

    loanPayments.forEach((payment) => {
      const occurredAt = payment.payment_date || loan.created_at;
      const moneyAmount = Number(payment.amount || 0);
      const hasMoneyAmount = payment.payment_method === 'money' && Number.isFinite(moneyAmount);

      events.push({
        id: `payment-${payment.id}`,
        loanId: loan.id,
        occurredAt,
        title: payment.payment_method === 'item'
          ? 'Item return logged'
          : loan.type === 'lent'
            ? 'Payment logged'
            : 'Repayment logged',
        subtitle: payment.note?.trim()
          ? payment.note.trim()
          : payment.payment_method === 'item'
            ? payment.returned_item_name || 'Item handoff recorded'
            : 'Payment added to this shared record',
        value: hasMoneyAmount
          ? `${loan.type === 'lent' ? '+' : '-'}${formatMoneyValue(payment.amount, loan.currency)}`
          : payment.returned_item_name || 'Item',
        valueColor: hasMoneyAmount
          ? loan.type === 'lent' ? '#10B981' : '#EF4444'
          : '#6366F1',
      });
    });
  });

  return events.sort((a, b) => getTimestamp(b.occurredAt) - getTimestamp(a.occurredAt));
}

function getCompactDetails(contact: ContactItem) {
  const profile = contact.target_profile;
  const phone = getLinkedContactPhone(contact);
  const email = getLinkedContactEmail(contact);

  return [
    phone ? { label: 'Phone', value: phone } : null,
    email ? { label: 'Email', value: email } : null,
    contact.social_network ? { label: 'Social', value: contact.social_network } : null,
    profile?.friend_code ? { label: 'Friend code', value: profile.friend_code } : null,
  ].filter(Boolean) as Array<{ label: string; value: string }>;
}

function getPrimarySummary(balance: number, itemsOwed: number) {
  if (balance !== 0) {
    return `${balance > 0 ? '+' : '-'}$${Math.abs(Math.round(balance)).toLocaleString()}`;
  }

  if (itemsOwed !== 0) {
    return `${Math.abs(itemsOwed)} item${Math.abs(itemsOwed) === 1 ? '' : 's'}`;
  }

  return 'No balance';
}

function getSecondarySummary(balance: number, itemsOwed: number, openCount: number) {
  if (balance > 0) return 'Owes you';
  if (balance < 0) return 'You owe';
  if (itemsOwed > 0) return 'Items owed to you';
  if (itemsOwed < 0) return 'Items you owe';
  return openCount > 0 ? `${openCount} open record${openCount === 1 ? '' : 's'}` : 'No open records';
}

function getSummaryTone(balance: number, itemsOwed: number) {
  if (balance > 0 || itemsOwed > 0) return 'positive';
  if (balance < 0 || itemsOwed < 0) return 'negative';
  return 'neutral';
}

function getLoanCreatedTitle(loan: ContactLoan) {
  if (loan.category === 'item') {
    return loan.type === 'lent' ? 'Item record created' : 'Borrowed item record created';
  }

  return loan.type === 'lent' ? 'Money record created' : 'Borrowed money record created';
}

function getTimestamp(value?: string | null) {
  if (!value) return 0;
  const timestamp = new Date(value).getTime();
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function formatSimpleDate(value?: string | null) {
  if (!value) return 'No date';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value.split('T')[0];
  }

  return date.toLocaleDateString();
}

function formatActivityDate(value?: string | null) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString();
}

function formatMoneyValue(amount: number | null, currency: string | null) {
  const symbol = getCurrencySymbol(currency || 'USD');
  const numericAmount = Number(amount || 0);
  return `${symbol}${Math.abs(Math.round(numericAmount)).toLocaleString()}`;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  searchWrapper: {
    backgroundColor: 'transparent',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#0F172A',
  },
  listContent: {
    paddingTop: 20,
  },
  contactItemWrapper: {
    marginBottom: 12,
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  contactItemExpanded: {
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    borderBottomWidth: 0,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#6366F1',
  },
  contactInfo: {
    flex: 1,
    backgroundColor: 'transparent',
    paddingRight: 10,
  },
  contactNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'transparent',
  },
  contactName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  contactLinkBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  contactLinkBadgeAccepted: {
    backgroundColor: '#ECFDF5',
  },
  contactLinkBadgePending: {
    backgroundColor: '#ECFDF5',
  },
  contactLinkBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  contactLinkBadgeTextAccepted: {
    color: '#047857',
  },
  contactLinkBadgeTextPending: {
    color: '#047857',
  },
  contactDetail: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 3,
  },
  summaryColumn: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    marginRight: 10,
  },
  summaryValue: {
    fontSize: 15,
    fontWeight: '800',
  },
  summaryPositive: {
    color: '#10B981',
  },
  summaryNegative: {
    color: '#EF4444',
  },
  summaryNeutral: {
    color: '#64748B',
  },
  summaryLabel: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '700',
    marginTop: 2,
  },
  chevronButton: {
    width: 30,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  expandedCard: {
    marginTop: -16,
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 18,
    paddingBottom: 16,
    paddingHorizontal: 16,
  },
  expandedHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    backgroundColor: 'transparent',
  },
  expandedSectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  sectionMeta: {
    fontSize: 12,
    fontWeight: '700',
    color: '#94A3B8',
  },
  inlineLinkButton: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 999,
    backgroundColor: '#EEF2FF',
  },
  inlineActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'transparent',
  },
  inlineActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: '#0F172A',
  },
  inlineActionButtonText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  inlineLinkText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#6366F1',
  },
  detailList: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    marginBottom: 12,
    overflow: 'hidden',
    backgroundColor: '#F8FAFC',
  },
  detailRow: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    backgroundColor: 'transparent',
  },
  detailRowLast: {
    borderBottomWidth: 0,
  },
  detailRowLabel: {
    fontSize: 10,
    color: '#94A3B8',
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  detailRowValue: {
    fontSize: 14,
    color: '#0F172A',
    fontWeight: '600',
  },
  noteCard: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    padding: 12,
    marginBottom: 16,
  },
  noteLabel: {
    fontSize: 10,
    color: '#94A3B8',
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 6,
  },
  noteText: {
    fontSize: 13,
    lineHeight: 18,
    color: '#334155',
  },
  accountLinkCard: {
    marginBottom: 16,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E0E7FF',
    backgroundColor: '#F8FAFF',
  },
  accountLinkHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'transparent',
  },
  accountLinkIcon: {
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  accountLinkCopy: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  accountLinkTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#312E81',
  },
  accountLinkText: {
    marginTop: 4,
    fontSize: 12,
    lineHeight: 17,
    color: '#5B5BD6',
  },
  accountLinkButton: {
    alignSelf: 'flex-start',
    marginTop: 12,
    backgroundColor: '#EEF2FF',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  accountLinkButtonText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#4F46E5',
  },
  activityList: {
    borderWidth: 1,
    borderColor: '#F1F5F9',
    borderRadius: 16,
    marginBottom: 16,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
  },
  activityRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F8FAFC',
    backgroundColor: 'transparent',
  },
  activityRowLast: {
    borderBottomWidth: 0,
  },
  activityCopy: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  activityTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  activitySubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 3,
    lineHeight: 16,
  },
  activityRight: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    minWidth: 92,
  },
  activityValue: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
  },
  activityDate: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '700',
    marginTop: 4,
  },
  openRecordRow: {
    borderWidth: 1,
    borderColor: '#F1F5F9',
    borderRadius: 16,
    marginBottom: 10,
    overflow: 'hidden',
  },
  openRecordRowLast: {
    marginBottom: 0,
  },
  openRecordContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 10,
    backgroundColor: 'transparent',
  },
  openRecordCopy: {
    flex: 1,
    paddingRight: 12,
    backgroundColor: 'transparent',
  },
  openRecordTitle: {
    fontSize: 14,
    color: '#0F172A',
    fontWeight: '700',
  },
  openRecordMeta: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 3,
  },
  openRecordHint: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 5,
  },
  openRecordRight: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  openRecordValue: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  openRecordType: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '700',
    marginTop: 3,
  },
  recordActionRow: {
    paddingHorizontal: 14,
    paddingBottom: 12,
    backgroundColor: 'transparent',
  },
  recordActionButton: {
    alignSelf: 'flex-start',
    backgroundColor: '#0F172A',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  recordActionText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  emptyCard: {
    alignItems: 'center',
    padding: 40,
    borderStyle: 'dashed',
    backgroundColor: 'transparent',
  },
  emptyText: {
    textAlign: 'center',
    color: '#94A3B8',
  },
  emptyInlineText: {
    fontSize: 13,
    color: '#94A3B8',
    marginBottom: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    maxHeight: '82%',
    paddingTop: 18,
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
    backgroundColor: 'transparent',
  },
  modalHeaderCopy: {
    flex: 1,
    paddingRight: 12,
    backgroundColor: 'transparent',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#0F172A',
  },
  modalSubtitle: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 4,
  },
  modalCloseButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
  },
  modalScroll: {
    flexGrow: 0,
  },
  modalScrollContent: {
    paddingBottom: 8,
  },
  historyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    backgroundColor: 'transparent',
  },
  historyRowLast: {
    borderBottomWidth: 0,
  },
  fab: {
    position: 'absolute',
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#6366F1',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
  },
  copyright: {
    textAlign: 'center',
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 32,
    marginBottom: 12,
  },
});
