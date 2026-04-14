import { Check, Copy } from 'lucide-react'
import { useCallback, useState } from 'react'

interface TruncatedCopyProps {
  value: string
  maxLen?: number
  monospace?: boolean
}

export function TruncatedCopy({ value, maxLen = 14, monospace = true }: TruncatedCopyProps) {
  const [copied, setCopied] = useState(false)

  const copy = useCallback(async () => {
    if (!value) return
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    } catch {
      /* ignore */
    }
  }, [value])

  const show = value.length > maxLen ? `${value.slice(0, maxLen)}…` : value || '—'

  return (
    <span className="trunc-copy">
      <span className={`trunc-copy__text ${monospace ? 'trunc-copy__mono' : ''}`.trim()} title={value}>
        {show}
      </span>
      {value ? (
        <button
          type="button"
          className="trunc-copy__btn icon-btn icon-btn--plain"
          aria-label={copied ? 'Copied' : 'Copy to clipboard'}
          title={value}
          onClick={(e) => {
            e.stopPropagation()
            void copy()
          }}
        >
          {copied ? <Check size={14} style={{ color: 'var(--success)' }} /> : <Copy size={14} />}
        </button>
      ) : null}
    </span>
  )
}
