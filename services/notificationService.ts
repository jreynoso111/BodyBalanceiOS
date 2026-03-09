import * as Device from 'expo-device';
import { Platform, Alert } from 'react-native';
import Constants from 'expo-constants';
import { getOrCreateUserPreferences } from '@/services/userPreferences';
import { supabase } from '@/services/supabase';

const isWeb = Platform.OS === 'web';
const isAndroidExpoGo = Platform.OS === 'android' && Constants.appOwnership === 'expo';
type ReminderCategory = 'money' | 'item';
type ReminderDirection = 'lent' | 'borrowed';

type ReminderScheduleOptions = {
    loanId: string;
    contactName: string;
    amount: number;
    dueDate: string;
    category?: ReminderCategory;
    direction?: ReminderDirection;
    frequency?: string;
    interval?: number;
    currency?: string | null;
    itemName?: string | null;
};

async function getNotificationsModule() {
    if (isWeb || isAndroidExpoGo) {
        return null;
    }

    const Notifications = await import('expo-notifications');

    if (
        typeof Notifications.getPermissionsAsync !== 'function' ||
        typeof Notifications.scheduleNotificationAsync !== 'function'
    ) {
        console.warn('expo-notifications unavailable: required APIs are missing');
        return null;
    }

    return Notifications;
}

export async function showSharedUpdateNotification(options: {
    type: string;
    fromName?: string | null;
    message?: string | null;
}) {
    if (isWeb) return;
    const Notifications = await getNotificationsModule();
    if (!Notifications) return;

    const sender = options.fromName?.trim() || 'Someone';
    let title = 'Shared update';
    let body = options.message?.trim() || `${sender} sent you an update in Buddy Balance.`;

    if (options.type === 'friend_request') {
        title = 'New friend request';
        body = options.message?.trim() || `${sender} wants to connect with you.`;
    } else if (options.type === 'loan_notice') {
        title = 'Shared record added';
        body = options.message?.trim() || `${sender} added a shared record with you.`;
    } else if (options.type === 'loan_validation') {
        title = 'Shared record request';
        body = options.message?.trim() || `${sender} shared a new record with you.`;
    } else if (options.type === 'payment_validation') {
        title = 'Payment update';
        body = options.message?.trim() || `${sender} logged a payment that needs your confirmation.`;
    } else if (options.type === 'payment_notice') {
        title = 'Payment recorded';
        body = options.message?.trim() || `${sender} recorded a payment on your shared record.`;
    } else if (options.type === 'debt_reduction') {
        title = 'Adjustment request';
        body = options.message?.trim() || `${sender} suggested a new total for a shared record.`;
    } else if (options.type === 'referral_reward') {
        title = 'Premium unlocked';
        body = options.message?.trim() || 'Your invite code reached the reward goal and Premium is now active.';
    }

    await Notifications.scheduleNotificationAsync({
        content: {
            title,
            body,
            sound: true,
        },
        trigger: null,
    });
}

async function ensureAndroidNotificationChannel() {
    if (Platform.OS === 'android') {
        const Notifications = await getNotificationsModule();
        if (!Notifications) return;

        await Notifications.setNotificationChannelAsync('default', {
            name: 'default',
            importance: Notifications.AndroidImportance.MAX,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: '#FF231F7C',
        });
    }
}

function isMissingPushTokenColumn(message?: string) {
    return String(message || '').toLowerCase().includes('push_token');
}

function getExpoProjectId() {
    return (
        Constants.easConfig?.projectId ||
        Constants.expoConfig?.extra?.eas?.projectId ||
        process.env.EXPO_PUBLIC_EAS_PROJECT_ID ||
        null
    );
}

function formatReminderAmount(amount: number, currency?: string | null) {
    const formattedAmount = amount.toLocaleString();
    return currency ? `${currency} ${formattedAmount}` : `$${formattedAmount}`;
}

function buildReminderMessage(options: {
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

async function savePushToken(userId: string, token: string | null) {
    if (!userId) return;

    const { error } = await supabase
        .from('profiles')
        .update({ push_token: token, updated_at: new Date().toISOString() })
        .eq('id', userId);

    // Keep compatibility with DBs that do not yet include push_token.
    if (error && !isMissingPushTokenColumn(error.message)) {
        console.warn('Failed to save push token:', error.message);
    }
}

export async function getPushPermissionStatus() {
    if (isWeb) return 'granted' as const;
    if (isAndroidExpoGo) return 'unavailable' as const;
    const Notifications = await getNotificationsModule();
    if (!Notifications) return 'unavailable' as const;
    const { status } = await Notifications.getPermissionsAsync();
    return status;
}

export async function registerForPushNotificationsAsync(options?: {
    requestPermission?: boolean;
    userId?: string;
}) {
    const requestPermission = options?.requestPermission ?? true;
    let token: string | null = null;

    if (!Device.isDevice && !isWeb) {
        return null;
    }

    const Notifications = await getNotificationsModule();
    if (!Notifications) {
        if (options?.userId) {
            await savePushToken(options.userId, null);
        }
        if (requestPermission) {
            Alert.alert(
                'Push notifications are unavailable',
                isAndroidExpoGo
                    ? 'Expo Go on Android does not support this notifications flow. Use a development build for push testing.'
                    : 'We could not load the notifications module on this device.'
            );
        }
        return null;
    }

    await ensureAndroidNotificationChannel();

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted' && requestPermission) {
        const permissionResult = await Notifications.requestPermissionsAsync();
        finalStatus = permissionResult.status;
    }

    if (finalStatus !== 'granted') {
        if (options?.userId) {
            await savePushToken(options.userId, null);
        }
        if (requestPermission) {
            Alert.alert('Push notifications are disabled', 'Enable notifications in system settings to receive alerts.');
        }
        return null;
    }

    if (!isWeb) {
        try {
            const projectId = getExpoProjectId();
            token = (
                await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined)
            ).data;
        } catch (error: any) {
            console.warn('Failed to get Expo push token:', error?.message || error);
            if (options?.userId) {
                await savePushToken(options.userId, null);
            }
            if (requestPermission) {
                Alert.alert('Push notifications are unavailable', 'We could not finish device setup for notifications.');
            }
            return null;
        }
    } else {
        token = 'web-local';
    }

    if (options?.userId) {
        await savePushToken(options.userId, token);
    }

    return token;
}

export async function disablePushNotifications(userId?: string) {
    await clearAllLoanReminders();
    if (userId) {
        await savePushToken(userId, null);
    }
}

export async function clearAllLoanReminders() {
    if (isWeb) return;
    const Notifications = await getNotificationsModule();
    if (!Notifications) return;
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    const targets = scheduled.filter((item) => {
        const data = (item.content?.data || {}) as Record<string, any>;
        return data.kind === 'loan_reminder' || typeof data.loanId === 'string';
    });

    await Promise.all(targets.map((item) => Notifications.cancelScheduledNotificationAsync(item.identifier)));
}

export async function cancelLoanReminders(loanId: string) {
    if (isWeb || !loanId) return;
    const Notifications = await getNotificationsModule();
    if (!Notifications) return;
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    const targets = scheduled.filter((item) => {
        const data = (item.content?.data || {}) as Record<string, any>;
        return data.loanId === loanId;
    });

    await Promise.all(targets.map((item) => Notifications.cancelScheduledNotificationAsync(item.identifier)));
}

export async function scheduleLoanReminder(
    {
        loanId,
        contactName,
        amount,
        dueDate,
        category = 'money',
        direction = 'lent',
        frequency = 'none',
        interval = 1,
        currency,
        itemName,
    }: ReminderScheduleOptions
) {
    if (isWeb) return null;
    const Notifications = await getNotificationsModule();
    if (!Notifications) return null;

    const triggerDate = new Date(dueDate);
    triggerDate.setHours(9, 0, 0, 0);

    const { title, body } = buildReminderMessage({
        category,
        direction,
        contactName,
        amount,
        currency,
        itemName,
    });

    let trigger: any;

    if (frequency === 'none') {
        if (triggerDate < new Date()) return;
        trigger = triggerDate;
    } else if (frequency === 'daily') {
        trigger = {
            hour: 9,
            minute: 0,
            repeats: true,
        };
    } else if (frequency === 'weekly') {
        trigger = {
            weekday: triggerDate.getDay() + 1, // Expo uses 1-7 for Sunday-Saturday
            hour: 9,
            minute: 0,
            repeats: true,
        };
    } else if (frequency === 'monthly') {
        trigger = {
            day: triggerDate.getDate(),
            hour: 9,
            minute: 0,
            repeats: true,
        };
    } else if (frequency === 'yearly') {
        trigger = {
            month: triggerDate.getMonth() + 1,
            day: triggerDate.getDate(),
            hour: 9,
            minute: 0,
            repeats: true,
        };
    } else if (frequency === 'custom') {
        trigger = {
            seconds: interval * 24 * 60 * 60,
            repeats: true,
        };
    }

    const identifier = await Notifications.scheduleNotificationAsync({
        content: {
            title: title,
            body: body,
            data: { loanId, kind: 'loan_reminder', direction, category },
        },
        trigger,
    });

    return identifier;
}

export async function scheduleLoanReminderForUser(
    userId: string,
    options: ReminderScheduleOptions
) {
    if (!userId) return null;
    const { data: prefs, error } = await getOrCreateUserPreferences(userId);
    if (error || !prefs) return null;

    if (!prefs.push_enabled || !prefs.reminder_enabled) return null;

    const permission = await getPushPermissionStatus();
    if (permission !== 'granted') return null;

    return scheduleLoanReminder(options);
}

export async function upsertLoanReminderForUser(options: {
    userId: string;
    loanId: string;
    contactName: string;
    amount: number;
    dueDate: string;
    category: ReminderCategory;
    direction?: ReminderDirection;
    status?: string | null;
    frequency?: string | null;
    interval?: number | null;
    currency?: string | null;
    itemName?: string | null;
}) {
    await cancelLoanReminders(options.loanId);

    const frequency = options.frequency || 'none';
    if (options.status === 'paid' || frequency === 'none') return null;

    return scheduleLoanReminderForUser(options.userId, {
        loanId: options.loanId,
        contactName: options.contactName,
        amount: options.amount,
        dueDate: options.dueDate,
        category: options.category,
        direction: options.direction,
        frequency,
        interval: options.interval || 1,
        currency: options.currency,
        itemName: options.itemName,
    });
}
