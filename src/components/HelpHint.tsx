import { useState } from 'react'
import { HelpCircle } from 'lucide-react'
import { ExplainPanels } from './ExplainPanels'
import { t } from '../i18n'
import type { Language } from '../types'

type Props = {
  language: Language
  titleKey: string
  whatKey: string
  whyKey: string
  howKey: string
}

/** بطاقة مساعدة: ما / لماذا / كيف — تصميم بطاقات متناسق مع بقية لوحة التحكم. */
export function HelpHint({ language, titleKey, whatKey, whyKey, howKey }: Props) {
  const [open, setOpen] = useState(false)

  return (
    <div className="help-hint help-hint--page">
      <button
        type="button"
        className="help-hint__toggle help-hint__toggle--page"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <HelpCircle size={18} aria-hidden />
        <span>{t(language, titleKey)}</span>
      </button>
      {open ? (
        <div className="help-hint__body help-hint__body--panels">
          <ExplainPanels language={language} whatKey={whatKey} whyKey={whyKey} howKey={howKey} size="comfortable" />
        </div>
      ) : null}
    </div>
  )
}
