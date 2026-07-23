import { createClient } from '@/lib/supabase/server'
import { getVeiculos, getEquipes, getAbastecimentoHistorico } from '@/lib/sofia/queries'
import type { Abastecimento } from '@/lib/sofia/types'
import AbastecimentoForm from './_form'
import { deletarAbastecimentoAction } from './_actions'
import DeleteConfirmButton from '@/components/sofia/DeleteConfirmButton'

type AbastecimentoComVeiculo = Abastecimento & { veiculos: { placa: string } | null }

export default async function AbastecimentoPage() {
  const [veiculos, equipes, historico] = await Promise.all([
    getVeiculos(),
    getEquipes(),
    getAbastecimentoHistorico(),
  ])

  const hoje = new Date()
  const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString().split('T')[0]

  const supabase = await createClient()
  const { data: kmMes } = await supabase
    .from('km_diario')
    .select('veiculo_id, km_atual')
    .gte('data', inicioMes)

  // km rodados no mês = MAX(km_atual) - MIN(km_atual) por veículo
  const kmRangePorVeiculo = new Map<string, { min: number; max: number }>()
  for (const k of kmMes ?? []) {
    const curr = kmRangePorVeiculo.get(k.veiculo_id)
    if (!curr) {
      kmRangePorVeiculo.set(k.veiculo_id, { min: k.km_atual, max: k.km_atual })
    } else {
      kmRangePorVeiculo.set(k.veiculo_id, {
        min: Math.min(curr.min, k.km_atual),
        max: Math.max(curr.max, k.km_atual),
      })
    }
  }

  const doMes = (historico as AbastecimentoComVeiculo[]).filter((a) => a.data >= inicioMes)
  const porVeiculo = new Map<string, { placa: string; litros: number; valor: number }>()
  for (const a of doMes) {
    const atual = porVeiculo.get(a.veiculo_id) ?? {
      placa: a.veiculos?.placa ?? '—',
      litros: 0,
      valor: 0,
    }
    atual.litros += Number(a.litros ?? 0)
    atual.valor += Number(a.valor)
    porVeiculo.set(a.veiculo_id, atual)
  }

  const relatorio = Array.from(porVeiculo.entries()).map(([veiculoId, r]) => {
    const range = kmRangePorVeiculo.get(veiculoId)
    const km = range ? range.max - range.min : 0
    return {
      ...r,
      valorPorKm: km > 0 ? r.valor / km : null,
      kmPorLitro: r.litros > 0 && km > 0 ? km / r.litros : null,
    }
  })

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Abastecimento</h1>
        <p className="text-[#4a6080] text-sm mt-1">Lançamento manual + consumo do mês</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 mb-10">
        <AbastecimentoForm veiculos={veiculos} equipes={equipes} />

        <div>
          <h2 className="text-sm font-medium text-[#4a6080] uppercase tracking-wider mb-3">
            Consumo do mês
          </h2>
          {relatorio.length === 0 ? (
            <p className="text-[#4a6080] text-sm">Nenhum abastecimento lançado neste mês.</p>
          ) : (
            <div className="rounded-xl border border-[#1e3a5f] overflow-x-auto">
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
                      <td className="px-4 py-3 text-[#94a3b8] text-right">{r.litros > 0 ? r.litros.toFixed(1) : '—'}</td>
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

      <div>
        <h2 className="text-sm font-medium text-[#4a6080] uppercase tracking-wider mb-3">
          Histórico de lançamentos
        </h2>
        {historico.length === 0 ? (
          <p className="text-[#4a6080] text-sm">Nenhum abastecimento registrado ainda.</p>
        ) : (
          <div className="rounded-xl border border-[#1e3a5f] overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#1e3a5f] bg-[#0d2050]">
                  <th className="text-left px-4 py-3 text-[#4a6080] font-medium">Data</th>
                  <th className="text-left px-4 py-3 text-[#4a6080] font-medium">Placa</th>
                  <th className="text-right px-4 py-3 text-[#4a6080] font-medium">Litros</th>
                  <th className="text-right px-4 py-3 text-[#4a6080] font-medium">Valor</th>
                  <th className="text-right px-4 py-3 text-[#4a6080] font-medium">Posto</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {(historico as AbastecimentoComVeiculo[]).map((a) => (
                  <tr key={a.id} className="border-b border-[#1e3a5f] hover:bg-[#0d2050] transition-colors">
                    <td className="px-4 py-3 text-[#94a3b8]">
                      {new Date(a.data + 'T00:00:00').toLocaleDateString('pt-BR')}
                    </td>
                    <td className="px-4 py-3 text-white font-mono">{a.veiculos?.placa ?? '—'}</td>
                    <td className="px-4 py-3 text-[#94a3b8] text-right">
                      {a.litros != null ? Number(a.litros).toFixed(1) : '—'}
                    </td>
                    <td className="px-4 py-3 text-white text-right font-medium">
                      R$ {Number(a.valor).toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-[#94a3b8] text-right">{a.posto ?? '—'}</td>
                    <td className="px-4 py-3 text-right">
                      <DeleteConfirmButton action={deletarAbastecimentoAction} id={a.id} itemLabel={`abastecimento de ${a.veiculos?.placa ?? 'veículo sem placa'} — R$ ${Number(a.valor).toFixed(2)}`} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
