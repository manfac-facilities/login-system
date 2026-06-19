const problemas = [
  'Falta de visibilidade sobre o andamento das demandas',
  'Dificuldade de controle de prazos e custos',
  'Comunicação descentralizada',
  'Atuação reativa e sem padronização',
]

export default function Problema() {
  return (
    <section className="border-y border-[var(--border)] bg-[var(--navy)]/20">
      <div className="mx-auto max-w-6xl px-6 py-20">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-[var(--orange)]">
          O problema
        </h2>
        <p className="mt-4 max-w-2xl text-2xl font-semibold leading-snug md:text-3xl">
          Sem gestão estruturada, obras e manutenção predial geram mais custo do que deveriam.
        </p>
        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          {problemas.map((problema) => (
            <div key={problema} className="flex items-start gap-3 rounded-lg border border-[var(--border)] p-4">
              <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[var(--orange)]" />
              <p className="text-[var(--muted)]">{problema}</p>
            </div>
          ))}
        </div>
        <p className="mt-8 text-[var(--muted)]">
          Com o tempo, isso gera perda de eficiência, aumento de custos e desgaste com as
          unidades operacionais.
        </p>
      </div>
    </section>
  )
}
