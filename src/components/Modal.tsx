import { X } from 'lucide-react'
import type { ReactNode } from 'react'

type ModalProps = {
  title: string
  open: boolean
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
  /** When false, backdrop clicks do not close (use for destructive confirms). Default true. */
  closeOnBackdrop?: boolean
}

export function Modal({ title, open, onClose, children, footer, closeOnBackdrop = true }: ModalProps) {
  if (!open) return null

  const backdropClick = closeOnBackdrop ? onClose : undefined

  return (
    <div className="modal-backdrop modal-backdrop--animated" role="presentation" onClick={backdropClick}>
      <div
        className="modal-panel modal-panel--animated"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="modal-panel__head">
          <h2 id="modal-title">{title}</h2>
          <button type="button" className="icon-btn icon-btn--plain" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </header>
        <div className="modal-panel__body">{children}</div>
        {footer ? <footer className="modal-panel__foot">{footer}</footer> : null}
      </div>
    </div>
  )
}
