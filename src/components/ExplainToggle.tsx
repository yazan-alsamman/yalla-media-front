import { useState } from 'react'
import { HelpCircle } from 'lucide-react'
import { ExplainPanels } from './ExplainPanels'
import { t } from '../i18n'
import type { Language } from '../types'

type Props = {
  language: Language
  /** Short label on the button (e.g. «شرح») */
  labelKey: string
  whatKey: string
  whyKey: string
  howKey: string
  size?: 'comfortable' | 'compact'
  /** Icon-only control (for table rows) */
  iconOnly?: boolean
}

export function ExplainToggle({ language, labelKey, whatKey, whyKey, howKey, size = 'compact', iconOnly }: Props) {
  const [open, setOpen] = useState(false)

  return (
    <div className={`explain-toggle${iconOnly ? ' explain-toggle--icon-only' : ''}`}>
      <button
        type="button"
        className={iconOnly ? 'explain-toggle__icon-btn' : 'explain-toggle__btn'}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <HelpCircle size={iconOnly ? 16 : 15} aria-hidden />
        {iconOnly ? <span className="visually-hidden">{t(language, labelKey)}</span> : <span>{t(language, labelKey)}</span>}
      </button>
      {open ? (
        <div className="explain-toggle__body">
          <ExplainPanels language={language} whatKey={whatKey} whyKey={whyKey} howKey={howKey} size={size} />
        </div>
      ) : null}
    </div>
  )
}
