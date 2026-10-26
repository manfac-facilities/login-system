import { getEquipes, getVeiculos, getMotoristas, getKmDiarioHistorico, getKmResumoMensal, getKmExcedidoDescontos, getCorrecoes } from '@/lib/sofia/queries'
import { createClient } from '@/lib/supabase/server'
import { podeGerirFrotas } from '@/lib/sofia/permissoes'
import { contextosCorrecaoKm, valorOriginalKm, fmtKm, type CorrecaoAudit } from '@/lib/sofia/correcoes'
import KmForm from './_form'
import CorrigirKmButton from './_corrigir'
import { deletarKmAction, upsertKmExcedidoStatusAction } from './_actions'
import DeleteConfirmButton from '@/components/sofia/DeleteConfirmButton'
import type { AutorizacaoStatus } from '@/lib/sofia/types'
import AutorizacaoActions from '@/components/sofia/AutorizacaoActions'

export default async function KmPage({
  searchParams,
}: {
  searchParams: Promise<{ corrigido?: string; km?: string; aviso?: string }>
}) {
  const { corrigido, km: kmCorrigido, aviso } = await searchParams
  const supabase = await createClient()
  const podeGerir = await podeGerirFrotas(supabase)
  const [equipes, veiculos, motoristas, historico, resumoMensal, excedidos] = await Promise.all([
    getEquipes(),
    getVeiculos(),
    getMotoristas(),
    getKmDiarioHistorico(),
    getKmResumoMensal(),
    getKmExcedidoDescontos(),
  ])
  const correcoes = (await getCorrecoes('km_diario', historico.map((k) => k.id))) as CorrecaoAudit[]
  const contextos = contextosCorrecaoKm(historico)
  const kmVeiculo = new Map(veiculos.map((v) => [v.id, v.km_atual]))

  const excedidoMap = new Map(excedidos.map(e => (`${e.veiculo_id}::${e.mes}`))
    .map((k, i) => [k, excedidos[i]]))

  const hoje = new Date().toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })

  return (
    <div className="p-8">
      {corrigido && kmCorrigido && (
        <div className="mb-6 px-4 py-3 rounded-lg border border-green-600 bg-green-950 text-green-300 text-sm">
          KM corrigido. O KM atual do {corrigido} agora é {fmtKm(Number(kmCorrigido))} km. A correção foi para o histórico.
        </div>
      )}
      {corrigido && aviso && (
        <div className="mb-6 px-4 py-3 rounded-lg border border-amber-600 bg-amber-950 text-amber-300 text-sm">
          {aviso}
        </div>
      )}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">KM Diário</h1>
        <p className="text-[#4a6080] text-sm mt-1 capitalize">{hoje}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        <KmForm equipes={equipes} veiculos={veiculos} motoristas={motoristas} podeGerir={podeGerir} />

        <div>
          <h2 className="text-sm font-medium text-[#4a6080] uppercase tracking-wider mb-3">
            Histórico de lançamentos
          </h2>
          {!podeGerir && historico.length > 0 && (
            <div className="mb-3 px-4 py-3 rounded-lg border border-[#1e3a5f] bg-[#0d2050] text-[#94a3b8] text-sm">
              Somente administrador ou gestor de frotas pode corrigir.
            </div>
          )}
          {historico.length === 0 ? (
            <p className="text-[#4a6080] text-sm">Nenhum lançamento ainda.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {historico.map((k) => {
                const era = valorOriginalKm(correcoes, k.id, k.km_atual)
                const ctx = contextos.get(k.id)
                return (
                <div
                  key={k.id}
                  className="flex items-start justify-between px-4 py-3 rounded-lg border border-[#1e3a5f] bg-[#0d2050] gap-3"
                >
                  <div>
                    <p className="text-white text-sm font-medium">{k.equipes?.codigo}</p>
                    <p className="text-[#4a6080] text-xs font-mono">{k.veiculos?.placa}</p>
                    <p className="text-[#4a6080] text-xs">
                      {new Date(k.data + 'T00:00:00').toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="text-right">
                      <p className="text-white text-sm font-mono">
                        {k.km_atual.toLocaleString('pt-BR')} km
                        {era != null && (
                          <span className="ml-2 px-1.5 py-0.5 rounded bg-blue-900 text-blue-300 text-[10px] font-sans align-middle">
                            corrigido
                          </span>
                        )}
                      </p>
                      {era != null && (
                        <p className="text-[#4a6080] text-xs">era {fmtKm(era)} km</p>
                      )}
                      {k.motoristas?.nome && (
                        <p className="text-[#4a6080] text-xs">{k.motoristas.nome}</p>
                      )}
                    </div>
                    {podeGerir && ctx && (
                      <CorrigirKmButton
                        lancamento={{
                          id: k.id,
                          data: k.data,
                          km_atual: k.km_atual,
                          equipe: k.equipes?.codigo ?? '—',
                          placa: k.veiculos?.placa ?? '—',
                          motorista: k.motoristas?.nome ?? null,
                        }}
                        contexto={ctx}
                        kmVeiculoAtual={kmVeiculo.get(k.veiculo_id) ?? null}
                      />
                    )}
                    <DeleteConfirmButton action={deletarKmAction} id={k.id} itemLabel={`lançamento de KM de ${new Date(k.data + 'T00:00:00').toLocaleDateString('pt-BR')} — ${k.km_atual.toLocaleString('pt-BR')} km`} />
                  </div>
                </div>
                )
              })}
            </div>
          )}
        </div>

        {resumoMensal.length > 0 && (
          <div className="mt-10 col-span-full">
            <h2 className="text-sm font-medium text-[#4a6080] uppercase tracking-wider mb-3">
              Resumo por mês
            </h2>
            <div className="rounded-xl border border-[#1e3a5f] overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#1e3a5f] bg-[#0d2050]">
                    <th className="text-left px-4 py-3 text-[#4a6080] font-medium">Mês</th>
                    <th className="text-left px-4 py-3 text-[#4a6080] font-medium">Equipe</th>
                    <th className="text-left px-4 py-3 text-[#4a6080] font-medium">Placa</th>
                    <th className="text-right px-4 py-3 text-[#4a6080] font-medium">Contratado</th>
                    <th className="text-right px-4 py-3 text-[#4a6080] font-medium">Rodados</th>
                    <th className="text-right px-4 py-3 text-[#4a6080] font-medium">Saldo</th>
                    <th className="text-left px-4 py-3 text-[#4a6080] font-medium">Autorização</th>
                  </tr>
                </thead>
                <tbody>
                  {resumoMensal.map((r) => {
                    const contratado = r.km_contratual_mensal
                    const excedido = contratado != null && r.km_rodados > contratado
                    const saldo = contratado != null ? r.km_rodados - contratado : null
                    const excEntry = excedidoMap.get(`${r.veiculo_id}::${r.mes + '-01'}`)
                    const authSt = (excEntry?.autorizacao_status ?? (excedido ? 'sem_solicitacao' : null)) as AutorizacaoStatus | null
                    return (
                      <tr
                        key={`${r.veiculo_id}::${r.mes}`}
                        className={`border-b border-[#1e3a5f] transition-colors ${excedido ? 'bg-red-950/20' : 'hover:bg-[#0d2050]'}`}
                      >
                        <td className="px-4 py-3 text-[#94a3b8]">
                          {new Date(r.mes + '-01').toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
                        </td>
                        <td className="px-4 py-3 text-[#94a3b8]">{r.equipe_codigo}</td>
                        <td className="px-4 py-3 text-white font-mono">{r.veiculo_placa}</td>
                        <td className="px-4 py-3 text-[#94a3b8] text-right font-mono">
                          {contratado != null ? `${contratado.toLocaleString('pt-BR')} km` : '—'}
                        </td>
                        <td className="px-4 py-3 text-white text-right font-mono font-medium">
                          {r.km_rodados.toLocaleString('pt-BR')} km
                        </td>
                        <td className={`px-4 py-3 text-right font-mono font-medium ${saldo == null ? 'text-[#4a6080]' : saldo > 0 ? 'text-red-400' : 'text-green-400'}`}>
                          {saldo == null ? '—' : saldo > 0 ? `+${saldo.toLocaleString('pt-BR')} km EXCEDIDO` : `${Math.abs(saldo).toLocaleString('pt-BR')} km disponível`}
                        </td>
                        <td className="px-4 py-3">
                          {authSt != null && (
                            <AutorizacaoActions
                              status={authSt}
                              solicitadoEm={excEntry?.autorizacao_solicitado_em ?? null}
                              action={upsertKmExcedidoStatusAction}
                              showActions={excedido && podeGerir}
                              hiddenFields={{
                                veiculo_id: r.veiculo_id,
                                mes: r.mes + '-01',
                                km_contratual: contratado ?? 0,
                                km_realizado: r.km_rodados,
                              }}
                            />
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <p className="text-[#4a6080] text-xs mt-2">
              Contratado = km_contratual_mensal do veículo. Saldo = contratado − rodados (negativo = excedido).
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
