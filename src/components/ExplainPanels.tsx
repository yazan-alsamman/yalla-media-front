import { t } from '../i18n'
import type { Language } from '../types'

type Props = {
  language: Language
  whatKey: string
  whyKey: string
  howKey: string
  size?: 'comfortable' | 'compact'
}

/** Three cards: what / why / how — shared by page help, sections, and metric rows. */
export function ExplainPanels({ language, whatKey, whyKey, howKey, size = 'comfortable' }: Props) {
  const compact = size === 'compact'
  return (
    <div className={`explain-panels explain-panels--${size}`} role="region" aria-label={t(language, 'help.regionLabel')}>
      <div className="explain-panels__card explain-panels__card--what">
        <span className="explain-panels__emoji" aria-hidden={true}>
          {compact ? '💡' : '✨'}
        </span>
        <div>
          <div className="explain-panels__label">{t(language, 'help.what')}</div>
          <p className="explain-panels__text">{t(language, whatKey)}</p>
        </div>
      </div>
      <div className="explain-panels__card explain-panels__card--why">
        <span className="explain-panels__emoji" aria-hidden={true}>
          {compact ? '🎯' : '📌'}
        </span>
        <div>
          <div className="explain-panels__label">{t(language, 'help.why')}</div>
          <p className="explain-panels__text">{t(language, whyKey)}</p>
        </div>
      </div>
      <div className="explain-panels__card explain-panels__card--how">
        <span className="explain-panels__emoji" aria-hidden={true}>
          {compact ? '🚀' : '\u2764\uFE0F'}
        </span>
        <div>
          <div className="explain-panels__label">{t(language, 'help.how')}</div>
          <p className="explain-panels__text">{t(language, howKey)}</p>
        </div>
      </div>
    </div>
  )
}
