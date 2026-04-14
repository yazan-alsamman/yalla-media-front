import { Download, X } from 'lucide-react'
import { useState } from 'react'
import { useAppContext } from '../context/AppContext'
import { useAuthorizedMediaUrl } from '../lib/authorizedMedia'
import { t } from '../i18n'

export function ProofThumbWithLightbox({ proofUrl, viewLabel }: { proofUrl: string; viewLabel: string }) {
  const { language } = useAppContext()
  const { url, failed, loading } = useAuthorizedMediaUrl(proofUrl)
  const [open, setOpen] = useState(false)

  if (!proofUrl.trim()) return <span className="muted">—</span>
  if (failed) return <span className="muted type-caption">{t(language, 'tasks.proofLoadFailed')}</span>
  if (loading || !url) return <span className="muted type-caption">…</span>

  return (
    <>
      <button
        type="button"
        className="ghost-btn"
        style={{ padding: 4 }}
        onClick={() => setOpen(true)}
        title={viewLabel}
      >
        <img src={url} alt="" className="task-receipt-thumb" style={{ display: 'block', maxHeight: 56 }} />
      </button>
      {open ? (
        <div
          className="receipt-lightbox-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label={viewLabel}
          onClick={() => setOpen(false)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setOpen(false)
          }}
        >
          <div className="receipt-lightbox-inner" onClick={(e) => e.stopPropagation()}>
            <div className="receipt-lightbox-toolbar">
              <a
                className="ghost-btn"
                href={url}
                download="proof"
                target="_blank"
                rel="noreferrer"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  borderColor: 'rgba(255,255,255,0.35)',
                  color: '#fff',
                }}
              >
                <Download size={16} /> {t(language, 'tasks.receiptDownload')}
              </a>
              <button
                type="button"
                className="ghost-btn"
                style={{ borderColor: 'rgba(255,255,255,0.35)', color: '#fff' }}
                onClick={() => setOpen(false)}
              >
                <X size={16} /> {t(language, 'tasks.lightboxClose')}
              </button>
            </div>
            <div className="receipt-lightbox-img-wrap">
              <img className="receipt-lightbox-img" src={url} alt={viewLabel} />
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
