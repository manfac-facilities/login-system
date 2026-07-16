import BlueprintSection from './BlueprintSection'
import Reveal from './Reveal'
import { DIFERENCIAIS } from '@/lib/content'

const ICONS = [
  // Gestão ativa
  <svg key="gestao" viewBox="0 0 32 32" fill="none" className="h-7 w-7">
    <rect x="4" y="8" width="24" height="18" rx="2" fill="#00345e" />
    <rect x="4" y="8" width="24" height="6" rx="2" fill="#1a4873" />
    <line x1="9" y1="20" x2="18" y2="20" stroke="#f85e0b" strokeWidth="2" strokeLinecap="round" />
    <line x1="9" y1="24" x2="14" y2="24" stroke="#f85e0b" strokeWidth="2" strokeLinecap="round" opacity="0.6" />
    <circle cx="24" cy="23" r="4" fill="#f85e0b" />
    <path d="M22.5 23l1 1 2-2" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>,
  // Transparência
  <svg key="trans" viewBox="0 0 32 32" fill="none" className="h-7 w-7">
    <circle cx="16" cy="16" r="12" fill="#00345e" />
    <path d="M16 9v7l4 4" stroke="#f85e0b" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    <circle cx="16" cy="16" r="2" fill="#f85e0b" />
  </svg>,
  // Comunicação
  <svg key="com" viewBox="0 0 32 32" fill="none" className="h-7 w-7">
    <path d="M4 6h24a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H10l-6 4V8a2 2 0 0 1 2-2z" fill="#00345e" />
    <line x1="10" y1="12" x2="22" y2="12" stroke="#f85e0b" strokeWidth="2" strokeLinecap="round" />
    <line x1="10" y1="17" x2="17" y2="17" stroke="#f85e0b" strokeWidth="2" strokeLinecap="round" opacity="0.6" />
  </svg>,
  // Tecnologia
  <svg key="tech" viewBox="0 0 32 32" fill="none" className="h-7 w-7">
    <rect x="3" y="6" width="26" height="18" rx="2" fill="#00345e" />
    <rect x="3" y="6" width="26" height="7" rx="2" fill="#1a4873" />
    <polyline points="8,20 12,15 16,18 20,13 24,16" stroke="#f85e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    <rect x="12" y="24" width="8" height="3" rx="1" fill="#1a4873" />
  </svg>,
  // Proatividade
  <svg key="pro" viewBox="0 0 32 32" fill="none" className="h-7 w-7">
    <circle cx="16" cy="16" r="12" fill="#00345e" />
    <path d="M16 8v5l3-3" stroke="#f85e0b" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M16 8v5l-3-3" stroke="#f85e0b" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    <line x1="16" y1="13" x2="16" y2="22" stroke="#f85e0b" strokeWidth="2.5" strokeLinecap="round" />
  </svg>,
]

const DESCRICOES = [
  'Não deixamos a operação rodar sozinha. Acompanhamos, ajustamos e garantimos o resultado.',
  'Nada fica escondido. Prazos, custos e andamento são reportados com clareza e recorrência.',
  'Canal direto com o responsável técnico em cada etapa — sem ruído, com comunicação recorrente sobre cronograma e custos.',
  'Dados e sistemas para tomar decisões mais rápidas e com menos erros no campo.',
  'Antecipamos problemas antes que virem crise. Agimos, não reagimos.',
]

export default function Diferencial() {
  return (
    <BlueprintSection index="03" label="Diferenciais">
      <Reveal>
        <h2 className="max-w-2xl text-2xl font-bold leading-snug text-[var(--ink)] md:text-3xl">
          Por que gestores de grandes operações escolhem a Manfac.
        </h2>
      </Reveal>

      <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {DIFERENCIAIS.map((d, i) => (
          <Reveal key={d} delay={i * 80}>
            <div className="flex flex-col gap-4 rounded-xl border border-[var(--border)] bg-[var(--background)] p-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-[var(--surface)]">
                {ICONS[i]}
              </div>
              <div>
                <h3 className="font-bold text-[var(--ink)]">{d}</h3>
                <p className="mt-2 text-sm leading-relaxed text-[var(--body-text)]">
                  {DESCRICOES[i]}
                </p>
              </div>
            </div>
          </Reveal>
        ))}
      </div>

      <Reveal delay={500}>
        <blockquote className="mt-16 border-l-4 border-[var(--orange)] pl-6">
          <p className="text-xl font-semibold leading-snug text-[var(--ink)]">
            "Não escondemos problemas. Assumimos, tratamos e evoluímos continuamente."
          </p>
        </blockquote>
      </Reveal>
    </BlueprintSection>
  )
}
