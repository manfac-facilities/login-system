import { getKmResumoMensal, getKmExcedidoDescontos } from '@/lib/sofia/queries'
import { carregarBase } from '@/lib/sofia/bases/leitura'
import { filtrosDaUrl } from '@/lib/sofia/bases/filtro'
import { bannersCorrecaoKm } from '@/lib/sofia/correcoes'
import { upsertKmExcedidoStatusAction } from './_actions'
import type { AutorizacaoStatus } from '@/lib/sofia/types'
import AutorizacaoActions from '@/components/sofia/AutorizacaoActions'
import BaseTabela from '../_base/BaseTabela'

export default async function KmPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  const um = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)
  const base = await carregarBase('km')
  const [resumoMensal, excedidos] = await Promise.all([getKmResumoMensal(), getKmExcedidoDescontos()])
  const podeGerir = base.podeGerir
  // URL só traz id do veículo + código do aviso; textos e números vêm do banco
  const banners = bannersCorrecaoKm({ corrigido: um(params.corrigido), aviso: um(params.aviso) }, base.veiculos)

  const excedidoMap = new Map(excedidos.map((e) => [`${e.veiculo_id}::${e.mes}`, e]))

  return (
    <>
      {banners && (
        <div className="mx-4 mt-4 sm:mx-8 sm:mt-8 px-4 py-3 rounded-lg border border-green-600 bg-green-950 text-green-300 text-sm">
          {banners.sucesso}
        </div>
      )}
      {banners?.aviso && (
        <div className="mx-4 mt-4 sm:mx-8 px-4 py-3 rounded-lg border border-amber-600 bg-amber-950 text-amber-300 text-sm">
          {banners.aviso}
        </div>
      )}
      <BaseTabela
        base="km"
        nome="KM diário"
        linhas={base.linhas}
        filtrosIniciais={filtrosDaUrl('km', params, base.hoje)}
        hoje={base.hoje}
        podeGerir={podeGerir}
        equipes={base.equipes}
        placas={base.placas}
        motoristas={base.motoristas}
        novoHref="/sofia/km/novo"
        novoLabel="Lançar KM do dia"
        vazio="Nenhum KM lançado ainda."
        placeholderBusca="Placa, motorista, observação…"
        subtitulo={new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'America/Sao_Paulo' })}
      />

      {resumoMensal.length > 0 && (
        <div className="px-4 pb-8 sm:px-8">
          <h2 className="text-sm font-medium text-[#4a6080] uppercase tracking-wider mb-3">Resumo por mês</h2>
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
    </>
  )
}
