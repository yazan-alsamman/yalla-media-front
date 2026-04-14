import type { CSSProperties } from 'react'

interface SkeletonProps {
  className?: string
  style?: CSSProperties
}

export function SkeletonLine({ className = '', style }: SkeletonProps) {
  return <div className={`skeleton skeleton--line ${className}`.trim()} style={style} aria-hidden />
}

export function SkeletonBlock({ className = '', style }: SkeletonProps) {
  return <div className={`skeleton skeleton--block ${className}`.trim()} style={style} aria-hidden />
}

export function TableSkeletonRows({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="skeleton-table" aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }).map((_, ri) => (
        <div key={ri} className="skeleton-table__row">
          {Array.from({ length: cols }).map((_, ci) => (
            <SkeletonLine key={ci} className="skeleton-table__cell" />
          ))}
        </div>
      ))}
    </div>
  )
}
