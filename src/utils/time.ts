import type { Language } from '../types'

export function relativeFromIso(language: Language, iso: string | null | undefined): string {
  if (!iso) return '—'
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return '—'
  const sec = Math.max(0, Math.floor((Date.now() - then) / 1000))
  if (sec < 10) return language === 'ar' ? 'الآن' : 'just now'
  if (sec < 60) return language === 'ar' ? `منذ ${sec} ثانية` : `${sec}s ago`
  const min = Math.floor(sec / 60)
  if (min < 60) return language === 'ar' ? `منذ ${min} دقيقة` : `${min} min ago`
  const h = Math.floor(min / 60)
  if (h < 48) return language === 'ar' ? `منذ ${h} ساعة` : `${h} hour${h === 1 ? '' : 's'} ago`
  const d = Math.floor(h / 24)
  if (d < 60) return language === 'ar' ? `منذ ${d} يوم` : `${d} day${d === 1 ? '' : 's'} ago`
  const mo = Math.floor(d / 30)
  return language === 'ar' ? `منذ ${mo} شهر` : `${mo} month${mo === 1 ? '' : 's'} ago`
}
