/**
 * Estado de carregamento genérico das telas de /obras (Base, Tarefas, Painel,
 * Ficha). Mesmo visual do esqueleto do Diário (`diario/loading.tsx`, que tem
 * o seu próprio e continua valendo para aquela aba), com texto neutro.
 */
export default function CarregandoObras() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
      <p className="text-sm text-[#94a3b8]">Carregando…</p>
      <div className="mt-4 flex flex-col gap-4">
        {[0, 1, 2].map((i) => (
          <div key={i} className="animate-pulse rounded-lg border border-[#1e3a5f] bg-[#0d2050] px-4 py-4">
            <div className="h-3 w-28 rounded bg-[#1e3a5f]" />
            <div className="mt-2 h-4 w-56 max-w-full rounded bg-[#1e3a5f]" />
            <div className="mt-3 h-3 w-full rounded bg-[#132a52]" />
            <div className="mt-4 h-10 w-40 rounded bg-[#132a52]" />
          </div>
        ))}
      </div>
    </div>
  )
}
