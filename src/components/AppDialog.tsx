import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'
import { Modal } from './Modal'

type ConfirmDialogProps = {
  open: boolean
  title: string
  message: ReactNode
  confirmLabel: string
  cancelLabel: string
  danger?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel,
  danger,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <Modal
      title={title}
      open={open}
      onClose={onCancel}
      closeOnBackdrop={false}
      footer={
        <div className="row-actions" style={{ justifyContent: 'flex-end', gap: 8 }}>
          <button type="button" className="ghost-btn" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button
            type="button"
            className={danger ? 'primary-btn primary-btn--danger' : 'primary-btn'}
            onClick={() => onConfirm()}
          >
            {confirmLabel}
          </button>
        </div>
      }
    >
      <div className="app-dialog-message">{message}</div>
    </Modal>
  )
}

type AlertDialogProps = {
  open: boolean
  title: string
  message: ReactNode
  okLabel: string
  onClose: () => void
}

export function AlertDialog({ open, title, message, okLabel, onClose }: AlertDialogProps) {
  return (
    <Modal
      title={title}
      open={open}
      onClose={onClose}
      footer={
        <div className="row-actions" style={{ justifyContent: 'flex-end' }}>
          <button type="button" className="primary-btn" onClick={onClose}>
            {okLabel}
          </button>
        </div>
      }
    >
      <div className="app-dialog-message">{message}</div>
    </Modal>
  )
}

type PromptDialogProps = {
  open: boolean
  title: string
  label?: string
  initialValue?: string
  multiline?: boolean
  confirmLabel: string
  cancelLabel: string
  onSubmit: (value: string) => void
  onCancel: () => void
}

export function PromptDialog({
  open,
  title,
  label,
  initialValue = '',
  multiline,
  confirmLabel,
  cancelLabel,
  onSubmit,
  onCancel,
}: PromptDialogProps) {
  const [value, setValue] = useState(initialValue)

  useEffect(() => {
    if (open) setValue(initialValue)
  }, [open, initialValue])

  return (
    <Modal
      title={title}
      open={open}
      onClose={onCancel}
      closeOnBackdrop={false}
      footer={
        <div className="row-actions" style={{ justifyContent: 'flex-end', gap: 8 }}>
          <button type="button" className="ghost-btn" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button type="button" className="primary-btn" onClick={() => onSubmit(value)}>
            {confirmLabel}
          </button>
        </div>
      }
    >
      {label ? (
        <label className="modal-field">
          <span>{label}</span>
          {multiline ? (
            <textarea
              className="modal-textarea"
              rows={3}
              value={value}
              onChange={(e) => setValue(e.target.value)}
            />
          ) : (
            <input value={value} onChange={(e) => setValue(e.target.value)} />
          )}
        </label>
      ) : multiline ? (
        <textarea
          className="modal-textarea"
          rows={4}
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
      ) : (
        <input value={value} onChange={(e) => setValue(e.target.value)} />
      )}
    </Modal>
  )
}
