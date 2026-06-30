import Image from 'next/image'
import Reveal from './Reveal'
import Counter from './Counter'
import { PROBLEMAS, PASSOS, STATS } from '@/lib/content'

const PASSOS_DETALHES = [
  'Levantamento completo das unidades, demandas represadas e fornecedores ativos.',
  'Criação de equipe técnica dedicada, padrões de execução e fluxos de comunicação.',
  'Execução das demandas com registro, prazo e responsável definidos para cada chamado.',
  'Relatórios semanais, dashboard ao vivo e ponto de contato único para o cliente.',
  'Análise mensal de indicadores para reduzir emergências e antecipar melhorias.',
]

export default function Resultados() {
  return (
    <>
      {/* ── Hero ──────────────────────────────────────────────────────── */}
      <section className="relative isolate overflow-hidden border-b border-[var(--border)] text-white">
        <Image
          src="/media/resultados-hero.jpg"
          alt="Vista aérea de cidade com múltiplos edifícios comerciais"
          fill
          priority
          className="object-cover object-center"
          sizes="100vw"
        />
        <div className="absolute inset-0 bg-[var(--ink)]/78" />
        <div className="relative mx-auto max-w-5xl px-6 py-28 text-center md:py-40">
          <Reveal>
            <p className="mb-4 font-mono text-xs uppercase tracking-widest text-[var(--orange)]">
              Case de Sucesso
            </p>
            <h1 className="text-4xl font-bold leading-tight tracking-tight md:text-5xl">
              Gestão que transforma escala
              <br />
              em resultado.
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg text-white/85">
              400+ unidades. Mais de 1.000 ordens de serviço por mês. 7 anos de operação fragmentada
              transformados em referência de excelência no Estado do Rio de Janeiro.
            </p>
          </Reveal>
          <Reveal delay={220}>
            <div className="mt-10 flex flex-wrap justify-center gap-8">
              {[
                { v: 'R$16 bi', l: 'faturamento anual do cliente' },
                { v: '1.600+', l: 'unidades no Brasil' },
                { v: '400+', l: 'unidades no RJ sob gestão Manfac' },
              ].map((s) => (
                <div key={s.l} className="text-center">
                  <p className="text-2xl font-bold text-[var(--orange)]">{s.v}</p>
                  <p className="mt-1 text-xs text-white/60">{s.l}</p>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── O Cliente ─────────────────────────────────────────────────── */}
      <section className="border-b border-[var(--border)] bg-[var(--surface)]">
        <div className="mx-auto max-w-6xl px-6 py-16 md:py-24">
          <div className="grid gap-10 md:grid-cols-[3fr_2fr] md:items-start">
            <Reveal>
              <p className="font-mono text-xs uppercase tracking-widest text-[var(--orange)]">
                O Cliente
              </p>
              <h2 className="mt-3 text-2xl font-bold leading-snug text-[var(--ink)] md:text-3xl">
                Um dos maiores varejistas farmacêuticos do Brasil confiou à Manfac a gestão de 400+ unidades no Rio de Janeiro.
              </h2>
              <p className="mt-4 text-[var(--body-text)]">
                Com faturamento de R$16 bilhões/ano e mais de 1.600 unidades espalhadas pelo país,
                este cliente opera em escala onde cada falha técnica tem custo direto de imagem e
                receita. A exigência é alta — e a Manfac foi escolhida para cumprir.
              </p>
            </Reveal>
            <Reveal delay={180}>
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--background)] p-8">
                <p className="mb-5 font-mono text-xs uppercase tracking-widest text-[var(--muted)]">
                  Escala da operação
                </p>
                {[
                  { value: 'R$16 bi', label: 'em faturamento anual' },
                  { value: '1.600+', label: 'unidades no Brasil' },
                  { value: '400+', label: 'unidades no RJ sob gestão Manfac' },
                  { value: '7 anos', label: 'de histórico com fornecedores sem padrão' },
                ].map((item, i) => (
                  <div
                    key={item.label}
                    className={`${i > 0 ? 'mt-5 border-t border-[var(--border)] pt-5' : ''}`}
                  >
                    <p className="text-2xl font-bold text-[var(--orange)]">{item.value}</p>
                    <p className="mt-0.5 text-sm text-[var(--muted)]">{item.label}</p>
                  </div>
                ))}
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ── O Desafio ─────────────────────────────────────────────────── */}
      <section className="border-b border-[var(--border)]">
        <div className="mx-auto max-w-6xl px-6 py-16 md:py-24">
          <div className="grid gap-12 md:grid-cols-2 md:items-start">
            <Reveal>
              <p className="font-mono text-xs uppercase tracking-widest text-[var(--orange)]">
                O Desafio
              </p>
              <h2 className="mt-3 text-2xl font-bold leading-snug text-[var(--ink)] md:text-3xl">
                7 anos com fornecedores sem padrão. Isso tinha que mudar.
              </h2>
              <p className="mt-4 text-[var(--body-text)]">
                Quando a Manfac assumiu, a operação estava fragmentada entre múltiplos fornecedores
                sem padronização, sem comunicação e sem rastreabilidade. O cliente não sabia o que
                estava acontecendo nas suas unidades — e o custo disso aparecia toda semana em forma
                de emergência, retrabalho e insatisfação.
              </p>
            </Reveal>
            <Reveal delay={150}>
              <p className="mb-5 font-mono text-xs uppercase tracking-widest text-[var(--orange)]">
                O que encontramos ao chegar
              </p>
              <ul className="space-y-4">
                {PROBLEMAS.map((p, i) => (
                  <li key={p} className="flex items-start gap-4">
                    <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-red-200 bg-red-50 text-xs font-bold text-red-500">
                      {i + 1}
                    </span>
                    <span className="text-[var(--body-text)]">{p}</span>
                  </li>
                ))}
              </ul>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ── A Solução ─────────────────────────────────────────────────── */}
      <section className="border-b border-[var(--border)] bg-[var(--surface)]">
        <div className="mx-auto max-w-6xl px-6 py-16 md:py-24">
          <Reveal>
            <p className="text-center font-mono text-xs uppercase tracking-widest text-[var(--orange)]">
              A Solução
            </p>
            <h2 className="mt-3 text-center text-2xl font-bold leading-snug text-[var(--ink)] md:text-3xl">
              Como a Manfac virou referência em 18 meses.
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-center text-[var(--body-text)]">
              Estruturamos a operação do zero: diagnóstico completo, equipe técnica dedicada, rotinas
              de controle e comunicação diária — até a operação estar funcionando de forma previsível
              e escalável.
            </p>
          </Reveal>

          <div className="mt-14 grid gap-12 md:grid-cols-2 md:items-center">
            <Reveal delay={0}>
              <div className="relative aspect-[4/3] overflow-hidden rounded-2xl">
                <Image
                  src="/media/resultados-solucao.jpg"
                  alt="Equipe Manfac em reunião de planejamento estratégico"
                  fill
                  className="object-cover object-center"
                  sizes="(max-width: 768px) 100vw, 50vw"
                />
              </div>
            </Reveal>
            <Reveal delay={140}>
              <ol className="space-y-5">
                {PASSOS.map((p, i) => (
                  <li key={p.n} className="flex items-start gap-4">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--orange)] text-xs font-bold text-white">
                      {p.n}
                    </span>
                    <div className="pt-1">
                      <p className="font-semibold text-[var(--ink)]">{p.title}</p>
                      <p className="mt-1 text-sm text-[var(--muted)]">{PASSOS_DETALHES[i]}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ── Os Números ────────────────────────────────────────────────── */}
      <section className="border-b border-[var(--border)]" style={{ backgroundColor: 'var(--ink)' }}>
        <div className="mx-auto max-w-6xl px-6 py-16 md:py-24">
          <Reveal>
            <p className="text-center font-mono text-xs uppercase tracking-widest text-[var(--orange)]">
              Resultado
            </p>
            <h2 className="mt-3 text-center text-2xl font-bold text-white md:text-3xl">
              Os números falam por si.
            </h2>
          </Reveal>

          <div className="mt-12 grid grid-cols-2 gap-px overflow-hidden rounded-2xl bg-white/[0.07] md:grid-cols-4">
            {STATS.map((s, i) => (
              <Reveal key={s.label} delay={i * 100}>
                <div
                  className="flex flex-col items-center justify-center px-6 py-10 text-center"
                  style={{ backgroundColor: 'var(--ink)' }}
                >
                  <p className="text-3xl font-bold text-[var(--orange)] md:text-4xl">
                    <Counter value={s.value} />
                  </p>
                  <p className="mt-3 text-sm leading-snug text-white/65">{s.label}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── Destaque ──────────────────────────────────────────────────── */}
      <section className="border-b border-[var(--border)]">
        <div className="mx-auto max-w-4xl px-6 py-16 text-center md:py-24">
          <Reveal>
            <div className="mx-auto mb-6 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--orange)]/10">
              <svg width="22" height="18" viewBox="0 0 22 18" fill="none">
                <path
                  d="M0 18V10.5C0 7.5 0.875 5 2.625 3C4.375 1 6.75 0 9.75 0L10.5 1.5C8.75 2 7.25 3 6 4.5C4.75 6 4.125 7.5 4.125 9H7.875V18H0ZM12 18V10.5C12 7.5 12.875 5 14.625 3C16.375 1 18.75 0 21.75 0L22.5 1.5C20.75 2 19.25 3 18 4.5C16.75 6 16.125 7.5 16.125 9H19.875V18H12Z"
                  fill="#f85e0b"
                  opacity="0.35"
                />
              </svg>
            </div>
            <p className="text-xl font-semibold leading-relaxed text-[var(--ink)] md:text-2xl">
              "A Manfac não só resolveu os problemas técnicos — estruturou uma operação que o cliente
              nunca havia tido: previsível, rastreável e escalável."
            </p>
            <div className="mt-6 flex items-center justify-center gap-3">
              <span className="h-px w-8 bg-[var(--orange)]" />
              <p className="font-mono text-xs uppercase tracking-widest text-[var(--muted)]">
                Resultado da parceria após 18 meses de operação
              </p>
              <span className="h-px w-8 bg-[var(--orange)]" />
            </div>
          </Reveal>
        </div>
      </section>
    </>
  )
}
