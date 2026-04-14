import { useAppContext } from '../context/AppContext'
import type { Language } from '../types'
import { t } from '../i18n'

function parseAudience(aud: unknown): Record<string, unknown> | null {
  if (!aud || typeof aud !== 'object' || Array.isArray(aud)) return null
  return aud as Record<string, unknown>
}

function normalizeExternalUrl(raw: string): string | null {
  const s = raw.trim()
  if (!s) return null
  const httpIdx = s.search(/https?:\/\//i)
  if (httpIdx >= 0) {
    return s.slice(httpIdx).trim()
  }
  const cleaned = s.replace(/^\/+:*/, '').replace(/^\/+/, '')
  if (!cleaned) return null
  if (/^https?:\/\//i.test(cleaned)) return cleaned
  return `https://${cleaned}`
}

function audienceRow(
  language: Language,
  key: string,
  v: unknown,
): { label: string; value: string } | null {
  if (v == null || v === '') return null
  const k = key.toLowerCase()
  let value = ''
  if (k === 'interests' && Array.isArray(v)) {
    value = v.map((x) => String(x)).join(language === 'ar' ? '، ' : ', ')
  } else if (typeof v === 'object' && !Array.isArray(v)) {
    value = JSON.stringify(v)
  } else {
    value = String(v)
  }
  const label =
    k === 'age_from'
      ? t(language, 'campaigns.descAgeFrom')
      : k === 'age_to'
        ? t(language, 'campaigns.descAgeTo')
        : k === 'gender'
          ? t(language, 'campaigns.descGender')
          : k === 'interests'
            ? t(language, 'campaigns.descInterests')
            : k === 'cities'
              ? t(language, 'campaigns.descCities')
              : key
  return { label, value }
}

/**
 * Renders campaign `description` as structured UI when it is JSON (audience, content_url, messaging_channels).
 * Falls back to plain text for non-JSON.
 */
export function CampaignDescriptionStructured({ raw }: { raw: string | null | undefined }) {
  const { language } = useAppContext()
  const s = raw != null ? String(raw).trim() : ''
  if (!s) return <span className="muted">—</span>

  let parsed: Record<string, unknown> | null = null
  try {
    const o = JSON.parse(s) as unknown
    if (o && typeof o === 'object' && !Array.isArray(o)) parsed = o as Record<string, unknown>
  } catch {
    parsed = null
  }

  if (!parsed) {
    return <span className="muted" style={{ whiteSpace: 'pre-wrap' }}>{s}</span>
  }

  const audience = parseAudience(parsed.audience)
  const contentUrlRaw = parsed.content_url != null ? String(parsed.content_url).trim() : ''
  const contentUrl = normalizeExternalUrl(contentUrlRaw) ?? ''
  const channels = parsed.messaging_channels
  const summary =
    parsed.campaign_summary && typeof parsed.campaign_summary === 'object' && !Array.isArray(parsed.campaign_summary)
      ? (parsed.campaign_summary as Record<string, unknown>)
      : null

  const audienceRows: { label: string; value: string }[] = []
  if (audience) {
    const preferred = ['age_from', 'age_to', 'gender', 'interests', 'cities'] as const
    const used = new Set<string>()
    for (const pk of preferred) {
      if (!Object.prototype.hasOwnProperty.call(audience, pk)) continue
      const row = audienceRow(language, pk, audience[pk])
      if (row) {
        audienceRows.push(row)
        used.add(pk)
      }
    }
    for (const [k, v] of Object.entries(audience)) {
      if (used.has(k)) continue
      const row = audienceRow(language, k, v)
      if (row) audienceRows.push(row)
    }
  }

  const channelEntries =
    channels && typeof channels === 'object' && !Array.isArray(channels)
      ? Object.entries(channels as Record<string, unknown>).filter(([, on]) => on === true)
      : []

  const summaryRows: { label: string; value: string }[] = []
  if (summary) {
    const g = summary.objective != null ? String(summary.objective).trim() : ''
    const d = summary.duration_days != null ? String(summary.duration_days).trim() : ''
    const db = summary.daily_budget != null ? String(summary.daily_budget).trim() : ''
    if (g) summaryRows.push({ label: t(language, 'campaigns.descGoal'), value: g })
    if (d) summaryRows.push({ label: t(language, 'campaigns.descDuration'), value: `${d} ${language === 'ar' ? 'أيام' : 'days'}` })
    if (db) summaryRows.push({ label: t(language, 'campaigns.descDailyBudget'), value: `$${db}` })
  }

  return (
    <div className="campaign-desc-structured">
      {summaryRows.length > 0 ? (
        <dl className="campaign-desc-summary-grid">
          {summaryRows.map((row) => (
            <div key={row.label} className="campaign-desc-summary-row">
              <dt>{row.label}</dt>
              <dd>{row.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      {contentUrl ? (
        <section className="campaign-desc-block">
          <h5 className="campaign-desc-block__title">{t(language, 'campaigns.descContentUrl')}</h5>
          <a href={contentUrl} target="_blank" rel="noreferrer">
            {contentUrl}
          </a>
        </section>
      ) : null}
      {channelEntries.length > 0 ? (
        <section className="campaign-desc-block">
          <h5 className="campaign-desc-block__title">{t(language, 'campaigns.descMessaging')}</h5>
          <ul className="campaign-desc-list campaign-desc-list--inline">
            {channelEntries.map(([name]) => (
              <li key={name}>
                <span className="pill pill--gray">{name}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {audienceRows.length > 0 ? (
        <section className="campaign-desc-block">
          <h5 className="campaign-desc-block__title">{t(language, 'campaigns.descAudience')}</h5>
          <dl className="campaign-desc-summary-grid">
            {audienceRows.map((row) => (
              <div key={row.label + row.value} className="campaign-desc-summary-row">
                <dt>{row.label}</dt>
                <dd>{row.value}</dd>
              </div>
            ))}
          </dl>
        </section>
      ) : null}
      {contentUrl || channelEntries.length || audienceRows.length ? null : (
        <span className="muted" style={{ whiteSpace: 'pre-wrap' }}>
          {s}
        </span>
      )}
    </div>
  )
}
