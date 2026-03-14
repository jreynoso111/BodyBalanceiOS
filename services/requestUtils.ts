export function getRequestTypeLabel(type: string) {
  if (type === 'friend_request') return 'Friend request';
  if (type === 'friend_merge_choice') return 'Choose shared history';
  if (type === 'loan_validation') return 'Shared record confirmation';
  if (type === 'payment_validation') return 'Payment confirmation';
  if (type === 'debt_reduction') return 'Adjustment request';
  return 'Shared update';
}

export function getRequestActionMessage(type: string, action: 'approved' | 'rejected') {
  if (action === 'approved') {
    if (type === 'friend_request') return 'You are now connected as friends.';
    if (type === 'friend_merge_choice') return 'The shared history has been aligned.';
    if (type === 'loan_validation') return 'The shared record has been confirmed.';
    if (type === 'payment_validation') return 'The payment update has been confirmed.';
    if (type === 'debt_reduction') return 'The new total has been saved.';
    return 'The update has been confirmed.';
  }

  if (type === 'friend_request') return 'The friend request was declined.';
  if (type === 'friend_merge_choice') return 'The merge was canceled. Both histories remain separate.';
  if (type === 'loan_validation') return 'The shared record was declined.';
  if (type === 'payment_validation') return 'The payment update was declined.';
  if (type === 'debt_reduction') return 'The adjustment request was declined.';
  return 'The update was declined.';
}

export function getDisplayName(request: any) {
  if (request?.type === 'friend_merge_choice') return 'Buddy Balance';
  return request?.request_payload?.sender_name || request?.from_profile?.full_name || request?.from_profile?.email || 'Someone';
}

export function getMergeChoiceOptions(request: any) {
  const payload = request?.request_payload || {};
  const options = [
    {
      userId: String(payload.user_a_id || '').trim(),
      label: String(payload.user_a_name || 'User 1').trim() || 'User 1',
      summary: payload.user_a_summary || {},
    },
    {
      userId: String(payload.user_b_id || '').trim(),
      label: String(payload.user_b_name || 'User 2').trim() || 'User 2',
      summary: payload.user_b_summary || {},
    },
  ];

  return options.filter((option) => option.userId);
}

function formatSignedMetric(value: number, positiveLabel: string, negativeLabel: string) {
  if (!Number.isFinite(value) || value === 0) return 'Balanced';
  const direction = value > 0 ? positiveLabel : negativeLabel;
  return `${Math.abs(value).toLocaleString()} ${direction}`;
}

export function formatMergeChoiceSummary(summary: any) {
  const recordCount = Number(summary?.record_count || 0);
  const activeCount = Number(summary?.active_record_count || 0);
  const paymentCount = Number(summary?.payment_count || 0);
  const openMoneyTotal = Number(summary?.open_money_total || 0);
  const openItemTotal = Number(summary?.open_item_total || 0);

  return [
    `${recordCount} record${recordCount === 1 ? '' : 's'}`,
    `${activeCount} open`,
    `${paymentCount} payment${paymentCount === 1 ? '' : 's'}`,
    formatSignedMetric(openMoneyTotal, 'owed to you', 'you owe'),
    formatSignedMetric(openItemTotal, 'items owed to you', 'items you owe'),
  ].join(' • ');
}

export function buildMergeChoiceConfirmationMessage(request: any, keepUserId: string, keepLabel: string, currentUserId?: string | null) {
  const options = getMergeChoiceOptions(request);
  const discardedOption = options.find((option) => option.userId !== keepUserId);
  const currentUserLosesData = Boolean(currentUserId && currentUserId === discardedOption?.userId);
  const messageParts = [
    `If you keep ${keepLabel}'s history, ${discardedOption?.label || 'the other'} user's separate data will be deleted.`,
    'This cannot be undone.',
  ];

  if (currentUserLosesData) {
    messageParts.push('If you need a backup, download your CSV from Settings first. CSV export requires Premium.');
  }

  return {
    title: `Keep ${keepLabel}'s history?`,
    message: messageParts.join('\n\n'),
  };
}

export function getMergeCancelMessage() {
  return {
    title: 'Cancel this merge?',
    message: 'This will stop the merge, keep both histories separate, and require a new friend request if you want to try again later.',
  };
}
