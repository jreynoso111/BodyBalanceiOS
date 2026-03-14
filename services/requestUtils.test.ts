import {
  buildMergeChoiceConfirmationMessage,
  formatMergeChoiceSummary,
  getDisplayName,
  getMergeCancelMessage,
  getMergeChoiceOptions,
  getRequestActionMessage,
  getRequestTypeLabel,
} from '@/services/requestUtils';

describe('requestUtils', () => {
  const mergeRequest = {
    type: 'friend_merge_choice',
    request_payload: {
      user_a_id: 'user-a',
      user_a_name: 'Ana',
      user_a_summary: {
        record_count: 3,
        active_record_count: 2,
        payment_count: 1,
        open_money_total: 120,
        open_item_total: -1,
      },
      user_b_id: 'user-b',
      user_b_name: 'Ben',
      user_b_summary: {
        record_count: 1,
        active_record_count: 1,
        payment_count: 0,
        open_money_total: -25,
        open_item_total: 0,
      },
    },
  };

  it('returns request labels and action messages for merge flows', () => {
    expect(getRequestTypeLabel('friend_merge_choice')).toBe('Choose shared history');
    expect(getRequestActionMessage('friend_merge_choice', 'approved')).toBe('The shared history has been aligned.');
    expect(getRequestActionMessage('friend_merge_choice', 'rejected')).toBe('The merge was canceled. Both histories remain separate.');
  });

  it('builds merge options and summaries from the request payload', () => {
    expect(getMergeChoiceOptions(mergeRequest)).toEqual([
      expect.objectContaining({ userId: 'user-a', label: 'Ana' }),
      expect.objectContaining({ userId: 'user-b', label: 'Ben' }),
    ]);

    expect(formatMergeChoiceSummary(mergeRequest.request_payload.user_a_summary)).toBe(
      '3 records • 2 open • 1 payment • 120 owed to you • 1 items you owe'
    );
  });

  it('warns about CSV export only when the current user would lose their data', () => {
    const losingMessage = buildMergeChoiceConfirmationMessage(mergeRequest, 'user-a', 'Ana', 'user-b');
    expect(losingMessage.title).toBe("Keep Ana's history?");
    expect(losingMessage.message).toContain("Ben user's separate data will be deleted.");
    expect(losingMessage.message).toContain('CSV export requires Premium.');

    const safeMessage = buildMergeChoiceConfirmationMessage(mergeRequest, 'user-a', 'Ana', 'user-a');
    expect(safeMessage.message).not.toContain('CSV export requires Premium.');
  });

  it('returns merge cancel copy and display names', () => {
    expect(getMergeCancelMessage()).toEqual({
      title: 'Cancel this merge?',
      message: 'This will stop the merge, keep both histories separate, and require a new friend request if you want to try again later.',
    });

    expect(getDisplayName(mergeRequest)).toBe('Buddy Balance');
    expect(
      getDisplayName({
        type: 'friend_request',
        request_payload: { sender_name: 'Manual Merge' },
      })
    ).toBe('Manual Merge');
  });
});
