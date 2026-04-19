import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatEUR(v: number | null | undefined) {
  if (v == null) return '—';
  return new Intl.NumberFormat('uk-UA', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 }).format(v);
}

export function formatPLN(v: number | null | undefined) {
  if (v == null) return '—';
  return new Intl.NumberFormat('uk-UA', { style: 'currency', currency: 'PLN', maximumFractionDigits: 2 }).format(v);
}

export function formatCurrency(v: number | null | undefined, c: 'EUR' | 'PLN' | null | undefined) {
  if (v == null) return '—';
  return new Intl.NumberFormat('uk-UA', { style: 'currency', currency: c ?? 'EUR', maximumFractionDigits: 2 }).format(v);
}

export function formatKm(v: number | null | undefined) {
  if (v == null) return '—';
  return new Intl.NumberFormat('uk-UA', { maximumFractionDigits: 0 }).format(v) + ' км';
}

export function formatDate(v: string | Date | null | undefined) {
  if (!v) return '—';
  const d = typeof v === 'string' ? new Date(v) : v;
  return new Intl.DateTimeFormat('uk-UA', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(d);
}

export function formatDateTime(v: string | Date | null | undefined) {
  if (!v) return '—';
  const d = typeof v === 'string' ? new Date(v) : v;
  return new Intl.DateTimeFormat('uk-UA', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  }).format(d);
}

export function daysUntil(target: string | Date | null | undefined) {
  if (!target) return null;
  const d = typeof target === 'string' ? new Date(target) : target;
  const now = new Date();
  return Math.round((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}
