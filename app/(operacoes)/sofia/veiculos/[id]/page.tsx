import { createClient } from '@/lib/supabase/server'
import { getResponsabilidadeHistorico, getCentroCustoHistorico } from '@/lib/sofia/queries'
import type { VeiculoResponsabilidadeHistorico } from '@/lib/sofia/types'
import { notFound } from 'next/navigation'

type HistoricoComRelacoes = VeiculoResponsabilidadeHistorico & {
  equipes: { codigo: string } | null
  motoristas: { nome: string } | null
}

export default async function VeiculoDetalhePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const [{ data: veiculo }, historico, centroCusto] = await Promise.all([
    supabase.from('veiculos').select('*, equipes(codigo)').eq('id', id).single(),
    getResponsabilidadeHistorico(id),
    getCentroCustoHistorico(id),
  ])

  if (!veiculo) notFound()

  const [{ data: multas }, { data: sinistros }, { data: revisoes }, { data: abastecimentos }] = await Promise.all([
    supabase.from('multas').select('valor, valor_descontado').eq('veiculo_id', id),
    supabase.from('sinistros').select('valor_dano, valor_descontado').eq('veiculo_id', id),
    supabase.from('revisoes').select('valor').eq('veiculo_id', id),
    supabase.from('abastecimentos').select('valor').eq('veiculo_id', id),
  ])

  const somaMultas = (multas ?? []).reduce((s, m) => s + (m.valor ?? 0) - (m.valor_descontado ?? 0), 0)
  const somaSinistros = (sinistros ?? []).reduce((s, sn) => s + (sn.valor_dano ?? 0) - (sn.valor_descontado ?? 0), 0)
  const somaRevisoes = (revisoes ?? []).reduce((s, r) => s + (r.valor ?? 0), 0)
  const somaAbastecimento = (abastecimentos ?? []).reduce((s, a) => s + (a.valor ?? 0), 0)
  const locacao = veiculo.valor_locacao_mensal ?? 0
  const totalAcumulado = somaMultas + somaSinistros + somaRevisoes + somaAbastecimento + locacao

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white font-mono">{veiculo.placa}</h1>
        <p className="text-[#4a6080] text-sm mt-1">{veiculo.modelo}{veiculo.ano != null ? ` · ${veiculo.ano}` : ''}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div>
          <h2 className="text-sm font-medium text-[#4a6080] uppercase tracking-wider mb-3">Responsável atual</h2>
          <div className="p-4 rounded-xl border border-[#1e3a5f] bg-[#0d2050] mb-6">
            <p className="text-white font-medium">{veiculo.equipes?.codigo ?? 'Sem equipe vinculada'}</p>
            <p className="text-[#4a6080] text-xs mt-1">Centro de custo vigente: {centroCusto[0]?.centro_custo ?? '—'}</p>
          </div>

          <h2 className="text-sm font-medium text-[#4a6080] uppercase tracking-wider mb-3">Histórico de responsabilidade</h2>
          <div className="flex flex-col gap-3 border-l-2 border-[#1e3a5f] pl-4">
            {historico.length === 0 && <p className="text-[#4a6080] text-sm">Sem histórico de troca ainda.</p>}
            {(historico as HistoricoComRelacoes[]).map((h) => (
              <div key={h.id} className="relative">
                <span className="absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full bg-[#f05a28]" />
                <p className="text-white text-sm">{h.equipes?.codigo ?? '—'} {h.motoristas?.nome ? `· ${h.motoristas.nome}` : ''}</p>
                <p className="text-[#4a6080] text-xs">
                  {new Date(h.inicio).toLocaleDateString('pt-BR')} → {h.fim ? new Date(h.fim).toLocaleDateString('pt-BR') : 'atual'}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h2 className="text-sm font-medium text-[#4a6080] uppercase tracking-wider mb-3">Custo acumulado</h2>
          <div className="rounded-xl border border-[#1e3a5f] overflow-hidden">
            {[
              ['Locação (mensal)', locacao],
              ['Manutenção', somaRevisoes],
              ['Multas', somaMultas],
              ['Sinistros', somaSinistros],
              ['Abastecimento', somaAbastecimento],
            ].map(([label, value]) => (
              <div key={label as string} className="flex justify-between px-4 py-3 border-b border-[#1e3a5f] last:border-0">
                <span className="text-[#94a3b8] text-sm">{label}</span>
                <span className="text-white text-sm">R$ {(value as number).toFixed(2)}</span>
              </div>
            ))}
            <div className="flex justify-between px-4 py-3 bg-[#0d2050]">
              <span className="text-white text-sm font-medium">Total</span>
              <span className="text-[#f05a28] text-sm font-bold">R$ {totalAcumulado.toFixed(2)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
