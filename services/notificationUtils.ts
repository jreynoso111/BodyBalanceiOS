export type ReminderCategory = 'money' | 'item';
export type ReminderDirection = 'lent' | 'borrowed';

export function formatReminderAmount(amount: number, currency?: string | null) {
  const formattedAmount = amount.toLocaleString();
  return currency ? `${currency} ${formattedAmount}` : `$${formattedAmount}`;
}

export function buildReminderMessage(options: {
  category: ReminderCategory;
  direction: ReminderDirection;
  contactName: string;
  amount: number;
  currency?: string | null;
  itemName?: string | null;
}) {
  const label = options.itemName?.trim() || 'the item';

  if (options.category === 'item') {
    if (options.direction === 'borrowed') {
      return {
        title: 'Return Reminder! 📦',
        body: `Reminder: return ${label} to ${options.contactName}.`,
      };
    }

    return {
      title: 'Return Reminder! 📦',
      body: `Reminder: ${options.contactName} should return ${label} to you.`,
    };
  }

  const formattedAmount = formatReminderAmount(options.amount, options.currency);

  if (options.direction === 'borrowed') {
    return {
      title: 'Repayment Reminder! 💸',
      body: `Reminder: you owe ${options.contactName} ${formattedAmount}.`,
    };
  }

  return {
    title: 'Payment Reminder! 💰',
    body: `Reminder: ${options.contactName} owes you ${formattedAmount}.`,
  };
}
