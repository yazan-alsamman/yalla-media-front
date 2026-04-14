import type { Language } from '../types'

export type NotificationItem = { title: string; body: string; type: string }

function isMessyPayload(body: string): boolean {
  const s = body.trim()
  if (s.length === 0) return false
  if (s.includes('{') && (s.includes('"') || s.includes("'"))) return true
  if (/ad_account_id|meta_ad_account_id|customer_email/i.test(s)) return true
  if (s.includes('":') && s.includes(',')) return true
  return false
}

/** Short Arabic title from English API copy (UI is Arabic-first). */
function titleForLanguage(language: Language, title: string, type: string): string {
  if (language !== 'ar') return title.trim()

  const raw = title.trim()
  const lower = raw.toLowerCase()

  if (lower.includes('ad account') && lower.includes('meta') && lower.includes('link')) {
    return 'حساب إعلان — ربط ميتا'
  }
  if (lower.includes('link meta ad account') || (lower.startsWith('new task:') && lower.includes('meta'))) {
    return 'مهمة: ربط حساب إعلان'
  }
  if (lower.startsWith('new task:')) {
    const rest = raw.replace(/^new task:\s*/i, '').trim()
    if (rest.length > 0 && rest.length <= 48) return `مهمة: ${rest}`
    return 'مهمة جديدة'
  }
  if (lower.includes('receipt') && lower.includes('approv')) return 'إيصال بانتظار الموافقة'
  if (lower.includes('top-up') || lower.includes('top up') || lower.includes('wallet')) return 'تنبيه محفظة'
  if (lower.includes('subscription')) return 'تنبيه اشتراك'

  const ty = type.toLowerCase()
  if (ty.includes('ad_account') || ty.includes('adaccount')) return 'حساب إعلان'
  if (ty.includes('task')) return 'مهمة'
  if (ty.includes('receipt')) return 'إيصال'

  if (raw.length <= 56 && !/[{}]/.test(raw)) return raw
  return 'تنبيه'
}

/** One-line Arabic body or omit when payload is noisy. */
function bodyForLanguage(language: Language, body: string, title: string): string | null {
  const b = body.trim()
  if (b.length === 0) return null
  if (language !== 'ar') return b.length > 200 ? `${b.slice(0, 197)}…` : b

  if (isMessyPayload(b)) return null

  const customerAdded = b.match(/[\s.]*customer\s+(.+?)\s+added\s+['"]([^'"]+)['"]/i)
  if (customerAdded) {
    const who = customerAdded[1].trim()
    const label = customerAdded[2].trim()
    return `العميل ${who} — ${label}`
  }

  const simple = b.replace(/^\.\s*/, '').trim()
  if (simple.length <= 100 && !/[{}]/.test(simple)) {
    if (/complete\s+linking/i.test(simple) && /meta/i.test(title.toLowerCase())) {
      return 'أكمل الربط من المهام المعينة لك.'
    }
    return simple
  }

  return null
}

export function formatNotificationForDisplay(language: Language, item: NotificationItem): { title: string; body: string | null } {
  return {
    title: titleForLanguage(language, item.title, item.type),
    body: bodyForLanguage(language, item.body, item.title),
  }
}
