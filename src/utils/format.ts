import type { Language } from '../types'

/** All grouped integers and decimals use this locale so digits stay 0–9 even in Arabic UI. */
export const DIGIT_LOCALE = 'en-US' as const

/** Arabic month/day wording with Western numerals (`-u-nu-latn`). */
export function dateLocaleWithLatinDigits(language: Language): string {
  return language === 'ar' ? 'ar-SA-u-nu-latn' : 'en-GB'
}

export function formatDateTimeForUi(language: Language, date: Date): string {
  return new Intl.DateTimeFormat(dateLocaleWithLatinDigits(language), {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

export function formatDecimalForUi(
  value: number,
  opts: { minimumFractionDigits?: number; maximumFractionDigits?: number } = {},
): string {
  return new Intl.NumberFormat(DIGIT_LOCALE, {
    minimumFractionDigits: opts.minimumFractionDigits ?? 0,
    maximumFractionDigits: opts.maximumFractionDigits ?? 4,
  }).format(value)
}

export const currency = (value: number) =>
  new Intl.NumberFormat(DIGIT_LOCALE, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value)

/** Spend with cents when small; good for ad dashboards. */
export function formatAdSpend(value: number): string {
  const abs = Math.abs(value)
  const maxFrac = abs > 0 && abs < 100 ? 2 : abs >= 1000 ? 0 : 1
  return new Intl.NumberFormat(DIGIT_LOCALE, {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: maxFrac,
  }).format(value)
}

/** Large counts: 1.2K, 3.4M — tabular, Latin digits for scanability. */
export function formatCompactCount(value: number): string {
  if (!Number.isFinite(value)) return '—'
  return new Intl.NumberFormat(DIGIT_LOCALE, {
    notation: 'compact',
    compactDisplay: 'short',
    maximumFractionDigits: 1,
  }).format(value)
}

/** Full grouping for tooltips / detail rows (1,234,567). */
export function formatGroupedInt(value: number): string {
  if (!Number.isFinite(value)) return '—'
  return new Intl.NumberFormat(DIGIT_LOCALE, { maximumFractionDigits: 0 }).format(value)
}
