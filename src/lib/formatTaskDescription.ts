/** Arabic labels for JSON blobs stored in task.description (workflow / automation). */
const DETAIL_KEYS_AR: Record<string, string> = {
  top_up_request_id: 'طلب الشحن',
  subscription_request_id: 'طلب الاشتراك',
  amount: 'المبلغ',
  notes: 'ملاحظات',
  email: 'البريد',
  name: 'الاسم',
  campaign_id: 'الحملة',
  receipt_id: 'الإيصال',
}

/**
 * Turns raw description (plain text, JSON, or text + trailing JSON) into readable Arabic lines for the UI.
 */
export function formatTaskDescriptionPreview(raw: string | null | undefined, maxLen = 240): string {
  if (raw == null) return ''
  let s = String(raw).trim()
  if (!s) return ''

  const tryParseObject = (jsonStr: string): Record<string, unknown> | null => {
    try {
      const o = JSON.parse(jsonStr) as unknown
      return o && typeof o === 'object' && !Array.isArray(o) ? (o as Record<string, unknown>) : null
    } catch {
      return null
    }
  }

  const formatObject = (o: Record<string, unknown>): string => {
    const parts: string[] = []
    for (const [k, v] of Object.entries(o)) {
      if (v === null || v === undefined || v === '') continue
      const label = DETAIL_KEYS_AR[k] ?? k
      parts.push(`${label}: ${typeof v === 'object' ? JSON.stringify(v) : String(v)}`)
    }
    return parts.join(' · ')
  }

  // Whole string is JSON
  if (s.startsWith('{')) {
    const o = tryParseObject(s)
    if (o) {
      const out = formatObject(o)
      return clip(out, maxLen)
    }
  }

  // Trailing JSON after title line (e.g. "Review…" + ",{...}")
  const braceIdx = s.indexOf('{')
  if (braceIdx !== -1) {
    const prefix = s.slice(0, braceIdx).replace(/[\s,]+$/g, '').trim()
    const jsonPart = s.slice(braceIdx)
    const lastBrace = jsonPart.lastIndexOf('}')
    const slice = lastBrace >= 0 ? jsonPart.slice(0, lastBrace + 1) : jsonPart
    const o = tryParseObject(slice)
    if (o) {
      const detail = formatObject(o)
      const out = [prefix, detail].filter(Boolean).join(' — ')
      return clip(out, maxLen)
    }
  }

  return clip(s, maxLen)
}

/** Full description for modals (no practical length limit). */
export function formatTaskDescriptionFull(raw: string | null | undefined): string {
  return formatTaskDescriptionPreview(raw, 100_000)
}

function clip(text: string, max: number): string {
  if (text.length <= max) return text
  return `${text.slice(0, Math.max(0, max - 1))}…`
}
