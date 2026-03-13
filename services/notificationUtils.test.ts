import { buildReminderMessage, formatReminderAmount } from '@/services/notificationUtils';

describe('notification reminder utils', () => {
  it('formats money reminder amounts with optional currency', () => {
    expect(formatReminderAmount(1500, 'USD')).toBe('USD 1,500');
    expect(formatReminderAmount(1500, null)).toBe('$1,500');
  });

  it('builds item reminder copy for borrowed and lent flows', () => {
    expect(
      buildReminderMessage({
        category: 'item',
        direction: 'borrowed',
        contactName: 'Alex',
        amount: 0,
        itemName: 'camera',
      })
    ).toEqual({
      title: 'Return Reminder! 📦',
      body: 'Reminder: return camera to Alex.',
    });

    expect(
      buildReminderMessage({
        category: 'item',
        direction: 'lent',
        contactName: 'Alex',
        amount: 0,
        itemName: 'camera',
      })
    ).toEqual({
      title: 'Return Reminder! 📦',
      body: 'Reminder: Alex should return camera to you.',
    });
  });

  it('builds money reminder copy for borrowed and lent flows', () => {
    expect(
      buildReminderMessage({
        category: 'money',
        direction: 'borrowed',
        contactName: 'Alex',
        amount: 250,
        currency: 'USD',
      })
    ).toEqual({
      title: 'Repayment Reminder! 💸',
      body: 'Reminder: you owe Alex USD 250.',
    });

    expect(
      buildReminderMessage({
        category: 'money',
        direction: 'lent',
        contactName: 'Alex',
        amount: 250,
        currency: 'USD',
      })
    ).toEqual({
      title: 'Payment Reminder! 💰',
      body: 'Reminder: Alex owes you USD 250.',
    });
  });
});
