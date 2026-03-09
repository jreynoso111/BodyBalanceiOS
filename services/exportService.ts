import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { supabase } from './supabase';
import { Alert } from 'react-native';

export const exportLoansToCSV = async (userId: string) => {
    try {
        const { data, error } = await supabase
            .from('loans')
            .select('*, contacts(name)')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

        if (error) throw error;
        if (!data || data.length === 0) {
            Alert.alert('No data', 'You have no loan records to export.');
            return;
        }

        const header = 'ID,Contact,Amount,Type,Status,Description,Due Date,Created At\n';
        const rows = data.map(loan => {
            const contactName = loan.contacts?.name || 'Unknown';
            const description = (loan.description || '').replace(/,/g, ' ');
            return `${loan.id},"${contactName}",${loan.amount},${loan.type},${loan.status},"${description}",${loan.due_date || ''},${loan.created_at}`;
        }).join('\n');

        const csvContent = header + rows;
        const fileUri = FileSystem.documentDirectory + 'I_GOT_YOU_Report.csv';

        await FileSystem.writeAsStringAsync(fileUri, csvContent, {
            encoding: FileSystem.EncodingType.UTF8,
        });

        if (await Sharing.isAvailableAsync()) {
            await Sharing.shareAsync(fileUri, {
                mimeType: 'text/csv',
                dialogTitle: 'Export Loan Data',
                UTI: 'public.comma-separated-values-text',
            });
        } else {
            Alert.alert('Error', 'Sharing is not available on this device');
        }
    } catch (error: any) {
        Alert.alert('Export Failed', error.message);
    }
};

type LoanPdfExportInput = {
    loan: any;
    payments: any[];
    paymentHistoryByPaymentId?: Record<string, any[]>;
    summary: {
        remaining: number;
        totalPaid: number;
        safeLoanAmount: number;
        timeProgress: number;
        paymentProgress: number;
        avgPayment: number;
        daysSinceLastPayment: number;
        health: 'ahead' | 'on_track' | 'behind';
    };
};

const escapeHtml = (value: unknown) =>
    String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

const formatDate = (value?: string | null, fallback = 'Not set') => {
    if (!value) return fallback;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return escapeHtml(value);
    return date.toLocaleDateString();
};

const formatDateTime = (value?: string | null, fallback = 'Not set') => {
    if (!value) return fallback;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return escapeHtml(value);
    return date.toLocaleString();
};

const formatMoney = (amount: number, currency = 'USD') => {
    const numericAmount = Number.isFinite(amount) ? amount : 0;
    return `${currency} ${Math.round(numericAmount).toLocaleString()}`;
};

const sanitizeFilename = (value: string) =>
    value
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '') || 'record';

const buildLoanPdfHtml = ({ loan, payments, paymentHistoryByPaymentId = {}, summary }: LoanPdfExportInput) => {
    const contactName = loan?.contacts?.name || 'Unknown contact';
    const currency = loan?.currency || 'USD';
    const isMoney = loan?.category === 'money';
    const generatedAt = new Date().toLocaleString();
    const healthLabel =
        summary.health === 'ahead' ? 'Ahead' : summary.health === 'behind' ? 'Needs attention' : 'On track';
    const reminderLabel =
        loan?.reminder_frequency === 'custom'
            ? `Every ${loan?.reminder_interval || 1} days`
            : loan?.reminder_frequency
                ? `${String(loan.reminder_frequency).charAt(0).toUpperCase()}${String(loan.reminder_frequency).slice(1)}`
                : 'None';

    const paymentsMarkup = payments.length
        ? payments.map((payment, index) => {
            const paymentAmount = Number(payment?.amount || 0);
            const changeHistory = paymentHistoryByPaymentId[payment.id] || [];

            return `
                <div class="payment-card">
                    <div class="payment-header">
                        <div>
                            <div class="payment-title">
                                ${payment.payment_method === 'item'
                                    ? 'Item return logged'
                                    : `Payment ${index + 1}: ${escapeHtml(formatMoney(paymentAmount, currency))}`}
                            </div>
                            <div class="payment-date">${escapeHtml(formatDate(payment.payment_date))}</div>
                        </div>
                        <div class="payment-badge">${escapeHtml(String(payment.payment_method || 'money').toUpperCase())}</div>
                    </div>
                    ${payment.note ? `<div class="payment-note">${escapeHtml(payment.note)}</div>` : ''}
                    ${payment.returned_item_name ? `<div class="payment-note">Returned item: ${escapeHtml(payment.returned_item_name)}</div>` : ''}
                    ${changeHistory.length ? `
                        <div class="history-block">
                            <div class="history-title">Payment change history</div>
                            ${changeHistory.map((entry) => `
                                <div class="history-item">
                                    <div class="history-date">${escapeHtml(formatDateTime(entry.created_at))}</div>
                                    <div class="history-text">${escapeHtml(entry.change_reason || 'Change recorded')}</div>
                                    ${entry.old_amount !== entry.new_amount ? `<div class="history-text">Amount: ${escapeHtml(String(entry.old_amount ?? 'N/A'))} -> ${escapeHtml(String(entry.new_amount ?? 'N/A'))}</div>` : ''}
                                    ${entry.old_note !== entry.new_note ? `<div class="history-text">Note: ${escapeHtml(entry.old_note || 'N/A')} -> ${escapeHtml(entry.new_note || 'N/A')}</div>` : ''}
                                    ${entry.old_item_name !== entry.new_item_name ? `<div class="history-text">Item: ${escapeHtml(entry.old_item_name || 'N/A')} -> ${escapeHtml(entry.new_item_name || 'N/A')}</div>` : ''}
                                </div>
                            `).join('')}
                        </div>
                    ` : ''}
                </div>
            `;
        }).join('')
        : `<div class="empty-state">${isMoney ? 'No payments logged yet.' : 'No activity logged yet.'}</div>`;

    return `
        <!DOCTYPE html>
        <html>
            <head>
                <meta charset="utf-8" />
                <style>
                    @page { margin: 32px 28px; }
                    body {
                        font-family: Helvetica, Arial, sans-serif;
                        color: #0f172a;
                        font-size: 12px;
                        line-height: 1.45;
                    }
                    .page {
                        width: 100%;
                    }
                    .hero {
                        background: linear-gradient(135deg, #eef2ff 0%, #ffffff 100%);
                        border: 1px solid #c7d2fe;
                        border-radius: 20px;
                        padding: 20px;
                        margin-bottom: 18px;
                    }
                    .eyebrow {
                        color: #4f46e5;
                        font-size: 11px;
                        font-weight: 700;
                        text-transform: uppercase;
                        letter-spacing: 1px;
                        margin-bottom: 6px;
                    }
                    .title {
                        font-size: 28px;
                        font-weight: 800;
                        margin: 0 0 4px 0;
                    }
                    .subtitle {
                        color: #475569;
                        font-size: 13px;
                        margin: 0;
                    }
                    .hero-amount {
                        margin-top: 18px;
                        font-size: 26px;
                        font-weight: 800;
                    }
                    .hero-meta {
                        color: #64748b;
                        margin-top: 4px;
                    }
                    .section {
                        margin-bottom: 18px;
                        page-break-inside: avoid;
                    }
                    .section-title {
                        font-size: 13px;
                        font-weight: 800;
                        text-transform: uppercase;
                        letter-spacing: 0.8px;
                        color: #334155;
                        margin-bottom: 10px;
                    }
                    .grid {
                        display: table;
                        width: 100%;
                        border-spacing: 10px 0;
                        margin: 0 -10px;
                    }
                    .grid-row {
                        display: table-row;
                    }
                    .cell {
                        display: table-cell;
                        width: 50%;
                        background: #f8fafc;
                        border: 1px solid #e2e8f0;
                        border-radius: 14px;
                        padding: 14px;
                        vertical-align: top;
                    }
                    .label {
                        color: #64748b;
                        font-size: 10px;
                        text-transform: uppercase;
                        letter-spacing: 0.8px;
                        margin-bottom: 6px;
                    }
                    .value {
                        font-size: 16px;
                        font-weight: 700;
                    }
                    .body-card {
                        background: #ffffff;
                        border: 1px solid #e2e8f0;
                        border-radius: 14px;
                        padding: 14px;
                    }
                    .body-text {
                        color: #475569;
                        white-space: pre-wrap;
                    }
                    .payment-card {
                        border: 1px solid #e2e8f0;
                        border-radius: 16px;
                        padding: 14px;
                        margin-bottom: 12px;
                        page-break-inside: avoid;
                    }
                    .payment-header {
                        display: table;
                        width: 100%;
                    }
                    .payment-header > div {
                        display: table-cell;
                        vertical-align: top;
                    }
                    .payment-header > div:last-child {
                        text-align: right;
                    }
                    .payment-title {
                        font-size: 14px;
                        font-weight: 700;
                    }
                    .payment-date {
                        color: #64748b;
                        margin-top: 3px;
                    }
                    .payment-badge {
                        display: inline-block;
                        background: #eef2ff;
                        color: #4338ca;
                        font-size: 10px;
                        font-weight: 700;
                        border-radius: 999px;
                        padding: 5px 9px;
                    }
                    .payment-note {
                        margin-top: 10px;
                        background: #f8fafc;
                        border-radius: 10px;
                        padding: 10px;
                        color: #475569;
                    }
                    .history-block {
                        margin-top: 12px;
                        padding-top: 12px;
                        border-top: 1px solid #e2e8f0;
                    }
                    .history-title {
                        font-size: 11px;
                        font-weight: 700;
                        color: #475569;
                        text-transform: uppercase;
                        letter-spacing: 0.6px;
                        margin-bottom: 8px;
                    }
                    .history-item {
                        margin-bottom: 10px;
                    }
                    .history-date {
                        font-size: 11px;
                        color: #6366f1;
                        font-weight: 700;
                    }
                    .history-text {
                        color: #64748b;
                        margin-top: 2px;
                    }
                    .empty-state {
                        border: 1px dashed #cbd5e1;
                        border-radius: 14px;
                        padding: 16px;
                        color: #64748b;
                        text-align: center;
                    }
                    .footer {
                        margin-top: 20px;
                        text-align: center;
                        color: #94a3b8;
                        font-size: 10px;
                    }
                </style>
            </head>
            <body>
                <div class="page">
                    <div class="hero">
                        <div class="eyebrow">Buddy Balance record export</div>
                        <h1 class="title">${escapeHtml(contactName)}</h1>
                        <p class="subtitle">${escapeHtml(isMoney ? (loan?.type === 'lent' ? 'You shared money' : 'You received money') : 'Shared item')}</p>
                        <div class="hero-amount">${escapeHtml(isMoney ? formatMoney(summary.remaining, currency) : String(loan?.item_name || 'Item'))}</div>
                        <div class="hero-meta">Open balance as of ${escapeHtml(generatedAt)}</div>
                    </div>

                    <div class="section">
                        <div class="section-title">Record summary</div>
                        <div class="grid">
                            <div class="grid-row">
                                <div class="cell">
                                    <div class="label">Status</div>
                                    <div class="value">${escapeHtml(String(loan?.status || 'active').toUpperCase())}</div>
                                </div>
                                <div class="cell">
                                    <div class="label">Due date</div>
                                    <div class="value">${escapeHtml(formatDate(loan?.due_date))}</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    ${isMoney ? `
                        <div class="section">
                            <div class="section-title">Money breakdown</div>
                            <div class="grid">
                                <div class="grid-row">
                                    <div class="cell">
                                        <div class="label">Original total</div>
                                        <div class="value">${escapeHtml(formatMoney(summary.safeLoanAmount, currency))}</div>
                                    </div>
                                    <div class="cell">
                                        <div class="label">Paid so far</div>
                                        <div class="value">${escapeHtml(formatMoney(summary.totalPaid, currency))}</div>
                                    </div>
                                </div>
                                <div class="grid-row">
                                    <div class="cell">
                                        <div class="label">Payment progress</div>
                                        <div class="value">${escapeHtml(`${Math.round(summary.paymentProgress)}%`)}</div>
                                    </div>
                                    <div class="cell">
                                        <div class="label">Pace</div>
                                        <div class="value">${escapeHtml(healthLabel)}</div>
                                    </div>
                                </div>
                                <div class="grid-row">
                                    <div class="cell">
                                        <div class="label">Average payment</div>
                                        <div class="value">${escapeHtml(formatMoney(summary.avgPayment, currency))}</div>
                                    </div>
                                    <div class="cell">
                                        <div class="label">Days since last payment</div>
                                        <div class="value">${escapeHtml(`${Math.max(0, Math.round(summary.daysSinceLastPayment))} days`)}</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ` : ''}

                    <div class="section">
                        <div class="section-title">Details</div>
                        <div class="grid">
                            <div class="grid-row">
                                <div class="cell">
                                    <div class="label">Reminder</div>
                                    <div class="value">${escapeHtml(reminderLabel)}</div>
                                </div>
                                <div class="cell">
                                    <div class="label">Created</div>
                                    <div class="value">${escapeHtml(formatDateTime(loan?.created_at))}</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="section">
                        <div class="section-title">Description</div>
                        <div class="body-card">
                            <div class="body-text">${escapeHtml(loan?.description || 'No description provided.')}</div>
                        </div>
                    </div>

                    <div class="section">
                        <div class="section-title">${escapeHtml(isMoney ? 'Payments and history' : 'Activity history')}</div>
                        ${paymentsMarkup}
                    </div>

                    <div class="footer">
                        Generated from Buddy Balance on ${escapeHtml(generatedAt)}
                    </div>
                </div>
            </body>
        </html>
    `;
};

export const shareLoanAsPdf = async (input: LoanPdfExportInput) => {
    try {
        if (!(await Sharing.isAvailableAsync())) {
            Alert.alert('Sharing unavailable', 'This device cannot share files right now.');
            return;
        }

        let Print: typeof import('expo-print');
        try {
            Print = await import('expo-print');
        } catch (error) {
            Alert.alert('PDF unavailable', 'This build does not include PDF export yet. Reopen the app in a build that includes expo-print.');
            return;
        }

        const html = buildLoanPdfHtml(input);
        const { uri } = await Print.printToFileAsync({
            html,
            base64: false,
        });

        const contactName = input.loan?.contacts?.name || 'record';
        const targetUri = `${FileSystem.cacheDirectory || FileSystem.documentDirectory}${sanitizeFilename(contactName)}_record.pdf`;
        let finalUri = uri;

        try {
            await FileSystem.copyAsync({ from: uri, to: targetUri });
            finalUri = targetUri;
        } catch {
            // Keep the original generated URI if the rename fails.
        }

        await Sharing.shareAsync(finalUri, {
            mimeType: 'application/pdf',
            dialogTitle: 'Share record PDF',
            UTI: 'com.adobe.pdf',
        });
    } catch (error: any) {
        Alert.alert('PDF export failed', error?.message || 'The PDF could not be generated right now.');
    }
};
