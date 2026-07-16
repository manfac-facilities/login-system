import Reveal from '../Reveal'
import { COMO_FUNCIONA } from '@/lib/content'

// Ícones por passo: mapa, prancheta, capacete, monitor, gráfico — linha laranja/azul da marca.
const ICONS = [
  // 01 Mapeamento inicial — pino de mapa sobre grade
  <svg key="i0" viewBox="0 0 32 32" fill="none" className="h-8 w-8">
    <rect x="4" y="6" width="24" height="20" rx="2" stroke="#00345e" strokeWidth="1.8" />
    <line x1="12" y1="6" x2="12" y2="26" stroke="#00345e" strokeWidth="1" opacity="0.4" />
    <line x1="20" y1="6" x2="20" y2="26" stroke="#00345e" strokeWidth="1" opacity="0.4" />
    <path d="M16 10c2.5 0 4.5 2 4.5 4.4 0 3.3-4.5 7.6-4.5 7.6s-4.5-4.3-4.5-7.6C11.5 12 13.5 10 16 10Z" fill="#f85e0b" />
    <circle cx="16" cy="14.4" r="1.6" fill="white" />
  </svg>,
  // 02 Plano operacional — prancheta com checks
  <svg key="i1" viewBox="0 0 32 32" fill="none" className="h-8 w-8">
    <rect x="7" y="5" width="18" height="23" rx="2" stroke="#00345e" strokeWidth="1.8" />
    <rect x="12" y="2.5" width="8" height="5" rx="1.5" fill="#1a4873" />
    <path d="M10.5 13l2 2 3.5-3.5" stroke="#f85e0b" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    <line x1="18" y1="13" x2="22" y2="13" stroke="#00345e" strokeWidth="1.5" strokeLinecap="round" />
    <path d="M10.5 20l2 2 3.5-3.5" stroke="#f85e0b" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    <line x1="18" y1="20" x2="22" y2="20" stroke="#00345e" strokeWidth="1.5" strokeLinecap="round" />
  </svg>,
  // 03 Execução em campo — capacete
  <svg key="i2" viewBox="0 0 32 32" fill="none" className="h-8 w-8">
    <path d="M5 21a11 11 0 0 1 22 0" stroke="#00345e" strokeWidth="1.8" />
    <rect x="3" y="21" width="26" height="4" rx="2" fill="#f85e0b" />
    <rect x="14" y="8" width="4" height="7" rx="1.5" fill="#1a4873" />
  </svg>,
  // 04 Gestão e comunicação — monitor com barras
  <svg key="i3" viewBox="0 0 32 32" fill="none" className="h-8 w-8">
    <rect x="4" y="6" width="24" height="16" rx="2" stroke="#00345e" strokeWidth="1.8" />
    <rect x="9" y="14" width="3" height="5" rx="1" fill="#f85e0b" />
    <rect x="14.5" y="11" width="3" height="8" rx="1" fill="#f85e0b" opacity="0.7" />
    <rect x="20" y="9" width="3" height="10" rx="1" fill="#f85e0b" />
    <line x1="12" y1="27" x2="20" y2="27" stroke="#00345e" strokeWidth="1.8" strokeLinecap="round" />
    <line x1="16" y1="22" x2="16" y2="27" stroke="#00345e" strokeWidth="1.8" />
  </svg>,
  // 05 Melhoria contínua — setas em ciclo
  <svg key="i4" viewBox="0 0 32 32" fill="none" className="h-8 w-8">
    <path d="M25 16a9 9 0 1 1-3-6.7" stroke="#00345e" strokeWidth="1.8" strokeLinecap="round" />
    <path d="M22 4l1 5.5L17.5 9" stroke="#f85e0b" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    <path d="M12.5 16.5l2.5 2.5 4.5-5" stroke="#f85e0b" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>,
]

export default function ComoFunciona() {
  return (
    <section className="border-b border-[var(--border)] bg-[var(--surface)]">
      <div className="mx-auto max-w-6xl px-6 py-20">
        <Reveal>
          <p className="text-center font-mono text-xs uppercase tracking-widest text-[var(--orange)]">
            Como funciona na prática
          </p>
          <h2 className="mt-3 text-center text-2xl font-bold leading-snug text-[var(--ink)] md:text-3xl">
            A operação Manfac, do diagnóstico à melhoria contínua.
          </h2>
        </Reveal>
        <div className="mx-auto mt-12 grid max-w-4xl gap-4">
          {COMO_FUNCIONA.map((p, i) => (
            <Reveal key={p.n} delay={i * 100}>
              <div className="flex items-start gap-5 rounded-2xl border border-[var(--border)] bg-[var(--background)] p-5 md:items-center">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--orange)] text-xs font-bold text-white">
                  {p.n}
                </span>
                <div className="icon-float shrink-0" style={{ animationDelay: `${i * 350}ms` }}>
                  {ICONS[i]}
                </div>
                <div>
                  <p className="font-semibold text-[var(--ink)]">{p.title}</p>
                  <p className="mt-0.5 text-sm text-[var(--muted)]">{p.description}</p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}
