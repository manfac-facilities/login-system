import Reveal from '../Reveal'
import { RECORRENTE_SPOT } from '@/lib/content'

// Ícone do recorrente: calendário com seta cíclica. Ícone do spot: raio/alvo pontual.
function RecorrenteIcon() {
  return (
    <svg viewBox="0 0 32 32" fill="none" className="h-9 w-9">
      <rect x="4" y="7" width="24" height="20" rx="2" stroke="#f85e0b" strokeWidth="1.8" />
      <line x1="4" y1="12.5" x2="28" y2="12.5" stroke="#f85e0b" strokeWidth="1.5" />
      <line x1="10" y1="4.5" x2="10" y2="9" stroke="#f85e0b" strokeWidth="1.8" strokeLinecap="round" />
      <line x1="22" y1="4.5" x2="22" y2="9" stroke="#f85e0b" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M20.5 19.5a4.5 4.5 0 1 1-1.4-3.2" stroke="white" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M20.5 14.5v2.3h-2.3" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function SpotIcon() {
  return (
    <svg viewBox="0 0 32 32" fill="none" className="h-9 w-9">
      <circle cx="16" cy="16" r="11" stroke="#00345e" strokeWidth="1.8" />
      <circle cx="16" cy="16" r="6.5" stroke="#00345e" strokeWidth="1.5" opacity="0.5" />
      <circle cx="16" cy="16" r="2.5" fill="#f85e0b" />
      <line x1="16" y1="2" x2="16" y2="7" stroke="#f85e0b" strokeWidth="1.8" strokeLinecap="round" />
      <line x1="30" y1="16" x2="25" y2="16" stroke="#f85e0b" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

function Item({ children, dark }: { children: string; dark?: boolean }) {
  return (
    <li className="flex items-start gap-3 text-sm">
      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--orange)]/15">
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
          <path d="M1.5 5l2.5 2.5 4.5-4.5" stroke="#f85e0b" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      <span className={dark ? 'text-white/85' : 'text-[var(--body-text)]'}>{children}</span>
    </li>
  )
}

export default function RecorrenteSpot() {
  const { recorrente, spot } = RECORRENTE_SPOT
  return (
    <div className="mx-auto mt-10 grid max-w-6xl gap-5 px-6 pb-20 md:grid-cols-2">
      <Reveal>
        <div className="h-full rounded-2xl p-8" style={{ backgroundColor: 'var(--ink)' }}>
          <div className="icon-float inline-block"><RecorrenteIcon /></div>
          <p className="mt-4 font-mono text-xs uppercase tracking-widest text-[var(--orange)]">
            {recorrente.tagline}
          </p>
          <h3 className="mt-2 text-lg font-bold text-white">{recorrente.title}</h3>
          <ul className="mt-4 space-y-3">
            {recorrente.items.map((item) => (
              <Item key={item} dark>{item}</Item>
            ))}
          </ul>
        </div>
      </Reveal>
      <Reveal delay={140}>
        <div className="h-full rounded-2xl border border-[var(--border)] bg-[var(--background)] p-8">
          <div className="icon-float inline-block" style={{ animationDelay: '350ms' }}><SpotIcon /></div>
          <p className="mt-4 font-mono text-xs uppercase tracking-widest text-[var(--muted)]">
            {spot.tagline}
          </p>
          <h3 className="mt-2 text-lg font-bold text-[var(--ink)]">{spot.title}</h3>
          <ul className="mt-4 space-y-3">
            {spot.items.map((item) => (
              <Item key={item}>{item}</Item>
            ))}
          </ul>
        </div>
      </Reveal>
    </div>
  )
}
