import type { ButtonHTMLAttributes, ReactNode } from 'react'

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'ghost'
  children: ReactNode
}

/** Primary / ghost actions — same classes as the rest of the dashboard. */
export function UiButton({ variant = 'primary', className, children, type = 'button', ...rest }: Props) {
  const base = variant === 'primary' ? 'primary-btn' : 'ghost-btn'
  return (
    <button type={type} className={[base, className].filter(Boolean).join(' ')} {...rest}>
      {children}
    </button>
  )
}
