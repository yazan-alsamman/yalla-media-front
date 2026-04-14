import type { LucideIcon } from 'lucide-react'

interface StatCardProps {
  title: string
  value: string
  /** Omit or pass null to show a neutral placeholder (no fake trend). */
  trend?: string | null
  icon: LucideIcon
}

export function StatCard({ title, value, trend, icon: Icon }: StatCardProps) {
  const neutral = trend == null || trend === '' || trend === '—'
  const trendClass = neutral
    ? 'stat-card__trend stat-card__trend--neutral'
    : trend.startsWith('-')
      ? 'stat-card__trend stat-card__trend--down'
      : 'stat-card__trend stat-card__trend--up'
  const trendPrefix = neutral ? '' : trend.startsWith('-') ? '↓ ' : '↑ '
  const trendText = neutral ? '—' : `${trendPrefix}${trend}`

  return (
    <article className="stat-card">
      <div className="stat-card__header">
        <span className="stat-card__icon">
          <Icon size={20} strokeWidth={1.75} />
        </span>
        <p className={trendClass} title={neutral ? undefined : 'Illustrative trend; connect live analytics for real deltas.'}>
          {trendText}
        </p>
      </div>
      <p className="stat-card__value">{value}</p>
      <p className="stat-card__label">{title}</p>
    </article>
  )
}
