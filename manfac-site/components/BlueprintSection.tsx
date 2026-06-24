import type { ReactNode } from 'react'

type BlueprintSectionProps = {
  index: string
  label: string
  tone?: 'default' | 'alt'
  className?: string
  children: ReactNode
}

export default function BlueprintSection({
  index,
  label,
  tone = 'default',
  className = '',
  children,
}: BlueprintSectionProps) {
  return (
    <section
      className={`blueprint-grid border-y border-[var(--border)] ${
        tone === 'alt' ? 'bg-[var(--surface)]' : 'bg-[var(--background)]'
      } ${className}`}
    >
      <div className="mx-auto max-w-6xl px-6 py-20">
        <div className="mb-6 flex items-center gap-2">
          <span className="h-px w-4 bg-[var(--orange)]" />
          <p className="font-mono text-xs tracking-wide text-[var(--orange)]">
            {index} — {label}
          </p>
        </div>
        {children}
      </div>
    </section>
  )
}
