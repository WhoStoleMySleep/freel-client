import { Currency, CURRENCY_SYMBOL } from './currency';

export function formatMoney(value: number, currency: Currency): string {
  const rounded = Math.round(value);
  return rounded.toLocaleString('ru-RU') + ' ' + CURRENCY_SYMBOL[currency];
}

export function formatAmount(value: number): string {
  return Math.round(value).toLocaleString('ru-RU');
}
