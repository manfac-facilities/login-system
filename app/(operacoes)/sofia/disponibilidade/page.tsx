import { getVeiculos } from '@/lib/sofia/queries'

export default async function DisponibilidadePage() {
  const veiculos = await getVeiculos()
  const disponiveis = veiculos.filter(v => v.status === 'ativo')
  const parados = veiculos.filter(v => v.status !== 'ativo')
  const pct = veiculos.length ? Math.round((disponiveis.length / veiculos.length) * 100) : 0

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Disponibilidade da Frota</h1>
        <p className="text-[#4a6080] text-sm mt-1">{disponiveis.length} de {veiculos.length} veículos disponíveis</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="rounded-xl border border-[#1e3a5f] bg-[#0d2050] p-8 flex flex-col items-center justify-center">
          <p className="text-5xl font-bold text-[#f05a28]">{pct}%</p>
          <p className="text-[#4a6080] text-sm mt-2">disponibilidade</p>
        </div>

        <div className="lg:col-span-2">
          <h2 className="text-sm font-medium text-[#4a6080] uppercase tracking-wider mb-3">Veículos parados</h2>
          {parados.length === 0 ? (
            <p className="text-[#4a6080] text-sm">Nenhum veículo parado.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {parados.map(v => (
                <div key={v.id} className="flex items-center justify-between px-4 py-3 rounded-lg border border-[#1e3a5f] bg-[#0d2050]">
                  <span className="text-white text-sm font-mono">{v.placa}</span>
                  <span className="px-2 py-0.5 rounded text-xs font-medium bg-amber-900 text-amber-300">
                    {v.status === 'manutencao' ? 'Em manutenção' : 'Inativo'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
