const passos = [
  { n: '01', title: 'Diagnóstico e priorização' },
  { n: '02', title: 'Estruturação da operação' },
  { n: '03', title: 'Execução com alto padrão técnico' },
  { n: '04', title: 'Comunicação e visibilidade contínua' },
  { n: '05', title: 'Evolução constante da operação' },
]

const banners = ['Simples na execução', 'Forte na gestão', 'Consistente no resultado']

export default function Abordagem() {
  return (
    <section id="abordagem" className="mx-auto max-w-6xl px-6 py-20">
      <h2 className="text-sm font-semibold uppercase tracking-widest text-[var(--orange)]">
        Nossa abordagem
      </h2>
      <p className="mt-4 max-w-3xl text-2xl font-semibold leading-snug md:text-3xl">
        Estruturamos a operação como um sistema integrado, conectando pessoas, processos e
        informações. Executamos com excelência técnica e gerenciamos com inteligência,
        transparência e foco em resultado.
      </p>

      <h3 className="mt-14 text-lg font-semibold text-white">Como atuamos</h3>
      <div className="mt-6 grid gap-6 md:grid-cols-5">
        {passos.map((passo) => (
          <div key={passo.n} className="rounded-lg border border-[var(--border)] p-5">
            <span className="text-2xl font-bold text-[var(--orange)]">{passo.n}</span>
            <p className="mt-3 text-sm text-[var(--muted)]">{passo.title}</p>
          </div>
        ))}
      </div>

      <div className="mt-10 flex flex-wrap justify-center gap-3 text-center">
        {banners.map((b) => (
          <span
            key={b}
            className="rounded-full border border-[var(--border)] bg-[var(--navy)]/30 px-5 py-2 text-sm text-[var(--muted)]"
          >
            {b}
          </span>
        ))}
      </div>
    </section>
  )
}
