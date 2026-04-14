import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

interface SectionCardProps {
  id?: string
  title: string
  description?: string
  /** Optional outline icon beside the title (same purple identity). */
  icon?: LucideIcon
  action?: ReactNode
  children: ReactNode
}

export function SectionCard({ id, title, description, icon: Icon, action, children }: SectionCardProps) {
  const showHeader = Boolean(title || description || action)

  return (
    <section id={id} className="section-card">
      {showHeader ? (
        <header className="section-card__header">
          <div style={{ flex: 1, minWidth: 0 }}>
            {Icon ? (
              <div className="section-card__title-row">
                <span className="section-card__title-icon" aria-hidden>
                  <Icon size={20} strokeWidth={1.75} />
                </span>
                <div>
                  {title ? <h3>{title}</h3> : null}
                  {description ? <p>{description}</p> : null}
                </div>
              </div>
            ) : (
              <>
                {title ? <h3>{title}</h3> : null}
                {description ? <p>{description}</p> : null}
              </>
            )}
          </div>
          {action ? <div>{action}</div> : null}
        </header>
      ) : null}
      {children}
    </section>
  )
}
