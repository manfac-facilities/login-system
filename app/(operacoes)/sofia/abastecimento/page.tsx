import { createClient } from '@/lib/supabase/server'
import { getVeiculos, getAbastecimentos } from '@/lib/sofia/queries'
import type { Abastecimento } from '@/lib/sofia/types'
import AbastecimentoForm from './_form'

type AbastecimentoComVeiculo = Abastecimento & { veiculos: { placa: string } | null }

export default async function AbastecimentoPage() {
  const [veiculos, abastecimentos] = await Promise.all([getVeiculos(), getAbastecimentos()])

  const hoje = new Date()
  const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString().split('T')[0]

  const supabase = await createClient()
  const { data: kmMes } = await supabase
    .from('km_diario')
    .select('veiculo_id, km_inicial, km_final')
    .gte('data', inicioMes)

  const kmPorVeiculo = new Map<string, number>()
  for (const k of kmMes ?? []) {
    if (k.km_final == null) continue
    kmPorVeiculo.set(k.veiculo_id, (kmPorVeiculo.get(k.veiculo_id) ?? 0) + (k.km_final - k.km_inicial))
  }

  const doMes = (abastecimentos as AbastecimentoComVeiculo[]).filter((a) => a.data >= inicioMes)
  const porVeiculo = new Map<string, { placa: string; litros: number; valor: number }>()
  for (const a of doMes) {
    const atual = porVeiculo.get(a.veiculo_id) ?? { placa: a.veiculos?.placa ?? '—', litros: 0, valor: 0 }
    atual.litros += Number(a.litros)
    atual.valor += Number(a.valor)
    porVeiculo.set(a.veiculo_id, atual)
  }

  const relatorio = Array.from(porVeiculo.entries()).map(([veiculoId, r]) => {
    const km = kmPorVeiculo.get(veiculoId) ?? 0
    return {
      ...r,
      valorPorKm: km > 0 ? r.valor / km : null,
      kmPorLitro: r.litros > 0 ? km / r.litros : null,
    }
  })

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Abastecimento</h1>
        <p className="text-[#4a6080] text-sm mt-1">Lançamento manual + consumo do mês</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        <AbastecimentoForm veiculos={veiculos} />

        <div>
          <h2 className="text-sm font-medium text-[#4a6080] uppercase tracking-wider mb-3">
            Consumo do mês
          </h2>
          {relatorio.length === 0 ? (
            <p className="text-[#4a6080] text-sm">Nenhum abastecimento lançado neste mês.</p>
          ) : (
            <div className="rounded-xl border border-[#1e3a5f] overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#1e3a5f] bg-[#0d2050]">
                    <th className="text-left px-4 py-3 text-[#4a6080] font-medium">Placa</th>
                    <th className="text-right px-4 py-3 text-[#4a6080] font-medium">Litros</th>
                    <th className="text-right px-4 py-3 text-[#4a6080] font-medium">Valor</th>
                    <th className="text-right px-4 py-3 text-[#4a6080] font-medium">R$/km</th>
                    <th className="text-right px-4 py-3 text-[#4a6080] font-medium">Km/litro</th>
                  </tr>
                </thead>
                <tbody>
                  {relatorio.map((r) => (
                    <tr key={r.placa} className="border-b border-[#1e3a5f] hover:bg-[#0d2050] transition-colors">
                      <td className="px-4 py-3 text-white font-mono">{r.placa}</td>
                      <td className="px-4 py-3 text-[#94a3b8] text-right">{r.litros.toFixed(1)}</td>
                      <td className="px-4 py-3 text-white text-right font-medium">R$ {r.valor.toFixed(2)}</td>
                      <td className="px-4 py-3 text-[#94a3b8] text-right">{r.valorPorKm != null ? `R$ ${r.valorPorKm.toFixed(2)}` : '—'}</td>
                      <td className="px-4 py-3 text-[#94a3b8] text-right">{r.kmPorLitro != null ? r.kmPorLitro.toFixed(1) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
