export const CURRENCIES = [
    { code: 'USD', symbol: '$', name: 'US Dollar' },
    { code: 'EUR', symbol: '€', name: 'Euro' },
    { code: 'GBP', symbol: '£', name: 'British Pound' },
    { code: 'MXN', symbol: '$', name: 'Mexican Peso' },
    { code: 'COP', symbol: '$', name: 'Colombian Peso' },
    { code: 'ARS', symbol: '$', name: 'Argentine Peso' },
    { code: 'CLP', symbol: '$', name: 'Chilean Peso' },
    { code: 'PEN', symbol: 'S/', name: 'Peruvian Sol' },
    { code: 'BRL', symbol: 'R$', name: 'Brazilian Real' },
    { code: 'DOP', symbol: 'RD$', name: 'Dominican Peso' },
];

export const getCurrencySymbol = (code: string) => {
    return CURRENCIES.find(c => c.code === code)?.symbol || '$';
};
