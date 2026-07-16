import Reveal from '../Reveal'
import { DIFERENCIAIS_HOME } from '@/lib/content'

// Um ícone pequeno por diferencial: capacete, escudo, documento, alvo, prédios.
const ICONS = [
  <svg key="d0" viewBox="0 0 20 20" fill="none" className="h-5 w-5">
    <path d="M3.5 13a6.5 6.5 0 0 1 13 0" stroke="#f85e0b" strokeWidth="1.6" />
    <rect x="2" y="13" width="16" height="2.6" rx="1.3" fill="#f85e0b" />
    <rect x="8.7" y="5" width="2.6" height="4.5" rx="1" fill="#00345e" />
  </svg>,
  <svg key="d1" viewBox="0 0 20 20" fill="none" className="h-5 w-5">
    <path d="M10 2.5l6 2.2v4.5c0 3.7-2.6 6.6-6 8.3-3.4-1.7-6-4.6-6-8.3V4.7l6-2.2Z" stroke="#00345e" strokeWidth="1.6" strokeLinejoin="round" />
    <path d="M7 10l2 2 4-4.5" stroke="#f85e0b" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>,
  <svg key="d2" viewBox="0 0 20 20" fill="none" className="h-5 w-5">
    <rect x="4" y="2.5" width="12" height="15" rx="1.5" stroke="#00345e" strokeWidth="1.6" />
    <line x1="7" y1="7" x2="13" y2="7" stroke="#f85e0b" strokeWidth="1.4" strokeLinecap="round" />
    <line x1="7" y1="10.5" x2="13" y2="10.5" stroke="#f85e0b" strokeWidth="1.4" strokeLinecap="round" />
    <line x1="7" y1="14" x2="10.5" y2="14" stroke="#f85e0b" strokeWidth="1.4" strokeLinecap="round" />
  </svg>,
  <svg key="d3" viewBox="0 0 20 20" fill="none" className="h-5 w-5">
    <circle cx="10" cy="10" r="7" stroke="#00345e" strokeWidth="1.6" />
    <circle cx="10" cy="10" r="2" fill="#f85e0b" />
    <line x1="10" y1="1.5" x2="10" y2="4.5" stroke="#f85e0b" strokeWidth="1.6" strokeLinecap="round" />
  </svg>,
  <svg key="d4" viewBox="0 0 20 20" fill="none" className="h-5 w-5">
    <rect x="2.5" y="8" width="6.5" height="9.5" rx="1" stroke="#00345e" strokeWidth="1.6" />
    <rect x="11" y="4" width="6.5" height="13.5" rx="1" stroke="#f85e0b" strokeWidth="1.6" />
    <line x1="5.75" y1="11" x2="5.75" y2="14" stroke="#f85e0b" strokeWidth="1.4" strokeLinecap="round" />
    <line x1="14.25" y1="8" x2="14.25" y2="14" stroke="#00345e" strokeWidth="1.4" strokeLinecap="round" />
  </svg>,
]

export default function Diferenciais() {
  return (
    <section className="border-y border-[var(--border)]">
      <div className="mx-auto max-w-6xl px-6 py-20 text-center">
        <Reveal>
          <p className="font-mono text-xs uppercase tracking-widest text-[var(--orange)]">
            Por que a Manfac
          </p>
          <h2 className="mt-3 text-2xl font-bold leading-snug text-[var(--ink)] md:text-3xl">
            Equipe própria. Ponto único de responsabilidade.
          </h2>
        </Reveal>
        <div className="mt-9 flex flex-wrap justify-center gap-3">
          {DIFERENCIAIS_HOME.map((d, i) => (
            <Reveal key={d} delay={i * 80}>
              <span className="inline-flex items-center gap-2.5 rounded-full border border-[var(--border)] bg-[var(--background)] px-5 py-2.5 text-sm font-semibold text-[var(--ink)]">
                <span className="icon-float inline-flex" style={{ animationDelay: `${i * 300}ms` }}>
                  {ICONS[i]}
                </span>
                {d}
              </span>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}
