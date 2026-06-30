import { getEquipes, getVeiculos, getMotoristas, getKmDiarioHistorico, getKmResumoMensal } from '@/lib/sofia/queries'
import KmForm from './_form'
import { deletarKmAction, upsertKmExcedidoStatusAction } from './_actions'
import DeleteConfirmButton from '@/components/sofia/DeleteConfirmButton'
import { createClient } from '@/lib/supabase/server'
import type { KmExcedidoDesconto, AutorizacaoStatus } from '@/lib/sofia/types'
import { formatAutorizacaoLabel, autorizacaoBadgeClass } from '@/lib/sofia/autorizacao'

export default async function KmPage() {
  const supabase = await createClient()
  const [equipes, veiculos, motoristas, historico, resumoMensal, { data: excedidosData }] = await Promise.all([
    getEquipes(),
    getVeiculos(),
    getMotoristas(),
    getKmDiarioHistorico(),
    getKmResumoMensal(),
    supabase.from('km_excedido_desconto').select('*'),
  ])

  const excedidos = (excedidosData ?? []) as KmExcedidoDesconto[]
  const excedidoMap = new Map(excedidos.map(e => (`${e.veiculo_id}::${e.mes}`))
    .map((k, i) => [k, excedidos[i]]))

  const hoje = new Date().toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">KM Diário</h1>
        <p className="text-[#4a6080] text-sm mt-1 capitalize">{hoje}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        <KmForm equipes={equipes} veiculos={veiculos} motoristas={motoristas} />

        <div>
          <h2 className="text-sm font-medium text-[#4a6080] uppercase tracking-wider mb-3">
            Histórico de lançamentos
          </h2>
          {historico.length === 0 ? (
            <p className="text-[#4a6080] text-sm">Nenhum lançamento ainda.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {historico.map((k) => (
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
                      </p>
                      {k.motoristas?.nome && (
                        <p className="text-[#4a6080] text-xs">{k.motoristas.nome}</p>
                      )}
                    </div>
                    <DeleteConfirmButton action={deletarKmAction} id={k.id} />
                  </div>
                </div>
              ))}
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
                            <div className="flex flex-col gap-1">
                              <span className={`px-2 py-0.5 rounded text-xs font-medium w-fit ${autorizacaoBadgeClass(authSt)}`}>
                                {formatAutorizacaoLabel(authSt, excEntry?.autorizacao_solicitado_em ?? null)}
                              </span>
                              {excedido && (
                                <div className="flex gap-2">
                                  {authSt === 'sem_solicitacao' && (
                                    <form action={upsertKmExcedidoStatusAction}>
                                      <input type="hidden" name="veiculo_id" value={r.veiculo_id} />
                                      <input type="hidden" name="mes" value={r.mes + '-01'} />
                                      <input type="hidden" name="km_contratual" value={contratado ?? 0} />
                                      <input type="hidden" name="km_realizado" value={r.km_rodados} />
                                      <button name="status" value="solicitado" type="submit" className="text-xs text-amber-400 hover:underline active:scale-95 transition-transform">Solicitar</button>
                                    </form>
                                  )}
                                  {authSt === 'solicitado' && (
                                    <>
                                      <form action={upsertKmExcedidoStatusAction}>
                                        <input type="hidden" name="veiculo_id" value={r.veiculo_id} />
                                        <input type="hidden" name="mes" value={r.mes + '-01'} />
                                        <input type="hidden" name="km_contratual" value={contratado ?? 0} />
                                        <input type="hidden" name="km_realizado" value={r.km_rodados} />
                                        <button name="status" value="autorizado" type="submit" className="text-xs text-green-400 hover:underline active:scale-95 transition-transform">Autorizar</button>
                                      </form>
                                      <form action={upsertKmExcedidoStatusAction}>
                                        <input type="hidden" name="veiculo_id" value={r.veiculo_id} />
                                        <input type="hidden" name="mes" value={r.mes + '-01'} />
                                        <input type="hidden" name="km_contratual" value={contratado ?? 0} />
                                        <input type="hidden" name="km_realizado" value={r.km_rodados} />
                                        <button name="status" value="sem_solicitacao" type="submit" className="text-xs text-[#4a6080] hover:underline active:scale-95 transition-transform">← Cancelar</button>
                                      </form>
                                    </>
                                  )}
                                  {authSt === 'autorizado' && (
                                    <form action={upsertKmExcedidoStatusAction}>
                                      <input type="hidden" name="veiculo_id" value={r.veiculo_id} />
                                      <input type="hidden" name="mes" value={r.mes + '-01'} />
                                      <input type="hidden" name="km_contratual" value={contratado ?? 0} />
                                      <input type="hidden" name="km_realizado" value={r.km_rodados} />
                                      <button name="status" value="solicitado" type="submit" className="text-xs text-[#4a6080] hover:underline active:scale-95 transition-transform">← Revogar</button>
                                    </form>
                                  )}
                                </div>
                              )}
                            </div>
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
