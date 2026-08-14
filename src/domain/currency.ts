export type Currency = 'RUB' | 'USD' | 'EUR' | 'GBP' | 'CNY';

export const CURRENCY_SYMBOL: Record<Currency, string> = {
  RUB: '₽',
  USD: '$',
  EUR: '€',
  GBP: '£',
  CNY: '¥',
};

export const CURRENCIES: Currency[] = ['RUB', 'USD', 'EUR', 'GBP', 'CNY'];

export function nextCurrency(current: Currency): Currency {
  return CURRENCIES[(CURRENCIES.indexOf(current) + 1) % CURRENCIES.length];
}
