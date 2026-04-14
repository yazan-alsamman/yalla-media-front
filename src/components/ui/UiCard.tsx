import type { ReactNode } from 'react'

/** Flat surface card (no header slot) — matches `.section-card` depth. */
export function UiCard({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={['section-card', className].filter(Boolean).join(' ')}>{children}</div>
}
