import Reveal from './Reveal'

export default function Contato() {
  return (
    <section className="border-t border-[var(--border)] bg-[var(--background)]">
      <div className="mx-auto max-w-3xl px-6 py-28 text-center">
        <Reveal>
          <span className="inline-block rounded-full border border-[var(--border)] px-4 py-1.5 font-mono text-xs tracking-widest text-[var(--muted)]">
            ENTRE EM CONTATO
          </span>
        </Reveal>
        <Reveal delay={120}>
          <h2 className="mt-6 text-3xl font-bold leading-tight text-[var(--ink)] md:text-4xl">
            Vamos entender
            <br />
            <span className="text-[var(--orange)]">sua operação?</span>
          </h2>
        </Reveal>
        <Reveal delay={240}>
          <p className="mx-auto mt-4 max-w-xl text-[var(--muted)]">
            Conte como funciona sua operação hoje — unidades, volume de demandas e principais
            dores. Retornamos com uma leitura técnica.
          </p>
        </Reveal>
        <Reveal delay={360}>
          <a
            href="/contato"
            className="mt-8 inline-flex items-center gap-3 rounded-full bg-[var(--orange)] px-8 py-4 font-semibold uppercase tracking-wider text-white transition-colors hover:bg-[var(--orange-hover)]"
          >
            AGENDAR CONVERSA TÉCNICA
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <circle cx="10" cy="10" r="9" stroke="white" strokeWidth="1.5" opacity="0.5"/>
              <path d="M7.5 10h5M10 7.5l2.5 2.5-2.5 2.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </a>
        </Reveal>
      </div>
    </section>
  )
}
