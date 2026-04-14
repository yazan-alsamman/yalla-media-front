import type { ReactNode } from 'react'

const variantClass: Record<'green' | 'amber' | 'red' | 'gray' | 'violet', string> = {
  green: 'pill pill--green',
  amber: 'pill pill--amber',
  red: 'pill pill--red',
  gray: 'pill pill--gray',
  violet: 'pill pill--violet',
}

/** Status / role chip — uses global `.pill` styles (purple theme). */
export function UiBadge({ variant, children, className }: { variant: keyof typeof variantClass; children: ReactNode; className?: string }) {
  return <span className={[variantClass[variant], className].filter(Boolean).join(' ')}>{children}</span>
}
