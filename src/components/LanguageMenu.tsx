import { ChevronDown } from 'lucide-react'
import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { t } from '../i18n'
import type { Language } from '../types'

const LANGS: Language[] = ['ar']

type Props = {
  value: Language
  onChange: (lang: Language) => void
  /** Current UI language (for option labels). */
  language: Language
  /** Topbar: inline; settings: full width like a field. */
  variant?: 'compact' | 'block'
}

function optionLabel(uiLang: Language, _code: Language): string {
  return t(uiLang, 'common.arabic')
}

export function LanguageMenu({ value, onChange, language, variant = 'compact' }: Props) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const menuId = useId()

  useEffect(() => {
    if (!open) return
    function onDoc(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const pick = useCallback(
    (lang: Language) => {
      onChange(lang)
      setOpen(false)
    },
    [onChange],
  )

  return (
    <div
      ref={rootRef}
      className={`language-menu${variant === 'block' ? ' language-menu--block' : ''}`}
    >
      <button
        type="button"
        className="language-menu__trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={menuId}
        aria-label={t(language, 'settings.language')}
        onClick={() => setOpen((o) => !o)}
      >
        <span className="language-menu__value">{optionLabel(language, value)}</span>
        <ChevronDown size={16} className="language-menu__chevron" aria-hidden strokeWidth={2.25} />
      </button>
      {open ? (
        <div id={menuId} className="language-menu__panel" role="listbox" aria-label={t(language, 'settings.language')}>
          {LANGS.map((code) => (
            <button
              key={code}
              type="button"
              role="option"
              aria-selected={code === value}
              className={`language-menu__item${code === value ? ' language-menu__item--active' : ''}`}
              onClick={() => pick(code)}
            >
              {optionLabel(language, code)}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}
