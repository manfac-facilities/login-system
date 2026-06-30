import Link from 'next/link'
import { getVeiculos, getCentroCustoHistorico, getKmResumoMensal } from '@/lib/sofia/queries'
import { createClient } from '@/lib/supabase/server'
import CentroCustoForm from './_form'

export default async function CustosPage() {
  const veiculos = await getVeiculos()
  const hoje = new Date()
  const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString().split('T')[0]

  const supabase = await createClient()

  const mesAtual = hoje.toISOString().slice(0, 7)
  const kmResumo = await getKmResumoMensal()
  const kmMesAtual = new Map(
    kmResumo.filter((r) => r.mes === mesAtual).map((r) => [r.veiculo_id, r])
  )

  const linhas = await Promise.all(
    veiculos.map(async (v) => {
      const [{ data: multas }, { data: sinistros }, { data: revisoes }, { data: abastecimentos }, centroCusto] = await Promise.all([
        supabase.from('multas').select('valor, valor_descontado').eq('veiculo_id', v.id).gte('data', inicioMes),
        supabase.from('sinistros').select('valor_dano, valor_descontado').eq('veiculo_id', v.id).gte('data', inicioMes),
        supabase.from('revisoes').select('valor').eq('veiculo_id', v.id).gte('data_realizada', inicioMes),
        supabase.from('abastecimentos').select('valor').eq('veiculo_id', v.id).gte('data', inicioMes),
        getCentroCustoHistorico(v.id),
      ])

      const somaMultas = (multas ?? []).reduce((s, m) => s + Number(m.valor ?? 0) - Number(m.valor_descontado ?? 0), 0)
      const somaSinistros = (sinistros ?? []).reduce((s, x) => s + Number(x.valor_dano ?? 0) - Number(x.valor_descontado ?? 0), 0)
      const somaRevisoes = (revisoes ?? []).reduce((s, r) => s + Number(r.valor ?? 0), 0)
      const somaAbastecimento = (abastecimentos ?? []).reduce((s, a) => s + Number(a.valor ?? 0), 0)
      const locacao = v.valor_locacao_mensal ?? 0
      const total = locacao + somaRevisoes + somaMultas + somaSinistros + somaAbastecimento

      return {
        veiculo: v,
        centroCusto: centroCusto[0]?.centro_custo ?? '',
        locacao,
        manutencao: somaRevisoes,
        multas: somaMultas,
        sinistros: somaSinistros,
        abastecimento: somaAbastecimento,
        total,
      }
    })
  )

  const totalGeral = linhas.reduce(
    (acc, l) => ({
      locacao: acc.locacao + l.locacao,
      manutencao: acc.manutencao + l.manutencao,
      multas: acc.multas + l.multas,
      sinistros: acc.sinistros + l.sinistros,
      abastecimento: acc.abastecimento + l.abastecimento,
      total: acc.total + l.total,
    }),
    { locacao: 0, manutencao: 0, multas: 0, sinistros: 0, abastecimento: 0, total: 0 }
  )

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Custos</h1>
        <p className="text-[#4a6080] text-sm mt-1">
          Consolidado do mês — {hoje.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
        </p>
      </div>

      <div className="rounded-xl border border-[#1e3a5f] overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#1e3a5f] bg-[#0d2050]">
              <th className="text-left px-4 py-3 text-[#4a6080] font-medium">Placa</th>
              <th className="text-left px-4 py-3 text-[#4a6080] font-medium">Centro de custo</th>
              <th className="text-right px-4 py-3 text-[#4a6080] font-medium">KM mês</th>
              <th className="text-right px-4 py-3 text-[#4a6080] font-medium">Locação</th>
              <th className="text-right px-4 py-3 text-[#4a6080] font-medium">Manutenção</th>
              <th className="text-right px-4 py-3 text-[#4a6080] font-medium">Multas</th>
              <th className="text-right px-4 py-3 text-[#4a6080] font-medium">Sinistros</th>
              <th className="text-right px-4 py-3 text-[#4a6080] font-medium">Abastecimento</th>
              <th className="text-right px-4 py-3 text-[#4a6080] font-medium">Total</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {linhas.map((l) => (
              <tr key={l.veiculo.id} className="border-b border-[#1e3a5f] hover:bg-[#0d2050] transition-colors">
                <td className="px-4 py-3 font-medium font-mono">
                  <Link
                    href={`/sofia/veiculos/${l.veiculo.id}`}
                    className="text-white hover:text-[#f05a28] transition-colors hover:underline"
                  >
                    {l.veiculo.placa}
                  </Link>
                </td>
                <td className="px-4 py-3 text-[#94a3b8]">{l.centroCusto || '—'}</td>
                {(() => {
                  const km = kmMesAtual.get(l.veiculo.id)
                  if (!km) return <td className="px-4 py-3 text-[#4a6080] text-right text-sm">—</td>
                  const excedido = km.km_rodados > (km.km_contratual_mensal ?? Infinity)
                  return (
                    <td className={`px-4 py-3 text-right text-sm font-mono ${excedido ? 'text-red-400' : 'text-[#94a3b8]'}`}>
                      {km.km_contratual_mensal != null
                        ? `${km.km_contratual_mensal.toLocaleString('pt-BR')} / ${km.km_rodados.toLocaleString('pt-BR')} km${excedido ? ' ⚠' : ''}`
                        : `${km.km_rodados.toLocaleString('pt-BR')} km`}
                    </td>
                  )
                })()}
                <td className="px-4 py-3 text-[#94a3b8] text-right">R$ {l.locacao.toFixed(2)}</td>
                <td className="px-4 py-3 text-[#94a3b8] text-right">R$ {l.manutencao.toFixed(2)}</td>
                <td className="px-4 py-3 text-[#94a3b8] text-right">R$ {l.multas.toFixed(2)}</td>
                <td className="px-4 py-3 text-[#94a3b8] text-right">R$ {l.sinistros.toFixed(2)}</td>
                <td className="px-4 py-3 text-[#94a3b8] text-right">R$ {l.abastecimento.toFixed(2)}</td>
                <td className="px-4 py-3 text-white text-right font-medium">R$ {l.total.toFixed(2)}</td>
                <td className="px-4 py-3 text-right">
                  <CentroCustoForm veiculoId={l.veiculo.id} atual={l.centroCusto} />
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-[#0d2050] font-medium">
              <td className="px-4 py-3 text-white" colSpan={2}>Total geral</td>
              <td className="px-4 py-3"></td>
              <td className="px-4 py-3 text-white text-right">R$ {totalGeral.locacao.toFixed(2)}</td>
              <td className="px-4 py-3 text-white text-right">R$ {totalGeral.manutencao.toFixed(2)}</td>
              <td className="px-4 py-3 text-white text-right">R$ {totalGeral.multas.toFixed(2)}</td>
              <td className="px-4 py-3 text-white text-right">R$ {totalGeral.sinistros.toFixed(2)}</td>
              <td className="px-4 py-3 text-white text-right">R$ {totalGeral.abastecimento.toFixed(2)}</td>
              <td className="px-4 py-3 text-white text-right">R$ {totalGeral.total.toFixed(2)}</td>
              <td className="px-4 py-3"></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}
