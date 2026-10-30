import { createClient } from '@/lib/supabase/server'
import { podeGerirFrotas } from '@/lib/sofia/permissoes'
import { getGastos, getOpcoesEquipe } from '@/lib/sofia/extratos/leituras'
import { agruparSemCentroCusto, brl, dataBR, mascararCartao } from '@/lib/sofia/extratos/agrupar'
import { BotaoCentroCusto, BotaoLigacao } from '../_form'

export default async function SemCentroCustoPage() {
  const supabase = await createClient()
  const [podeGerir, gastos, equipes] = await Promise.all([
    podeGerirFrotas(supabase),
    getGastos({ soSemCentroCusto: true }),
    getOpcoesEquipe(),
  ])
  const grupos = agruparSemCentroCusto(gastos)
  const totalCentavos = grupos.reduce((a, g) => a + g.totalCentavos, 0)

  return (
    <div className="p-4 md:p-8">
      <h1 className="text-2xl font-bold text-white mb-1">Sem centro de custo</h1>
      <p className="text-[#94a3b8] text-sm mb-6">
        Gastos que entraram mas não têm centro de custo. Ao resolver a ligação, as linhas somem daqui sozinhas (o centro
        de custo é calculado na leitura).
      </p>

      {grupos.length === 0 ? (
        <p className="rounded-xl border border-green-800 bg-green-900/20 text-green-300 px-4 py-10 text-center">
          Tudo resolvido. Nenhum gasto está sem centro de custo.
        </p>
      ) : (
        <>
          <div className="flex flex-wrap gap-3 mb-4 text-sm">
            <span className="px-3 py-1 rounded-full bg-amber-900/60 text-amber-300">{gastos.length} gastos</span>
            <span className="px-3 py-1 rounded-full bg-[#1e3a5f] text-white">{grupos.length} grupos</span>
            <span className="px-3 py-1 rounded-full bg-[#1e3a5f] text-white tabular-nums">{brl(totalCentavos / 100)}</span>
          </div>
          <div className="space-y-3">
            {grupos.map((g) => {
              const equipe = g.equipeId ? equipes.find((e) => e.id === g.equipeId) : undefined
              const ehCartao = g.plataforma === 'ticketlog'
              return (
                <div key={`${g.plataforma}|${g.identificador}|${g.motivo}|${g.equipeId}`} className="rounded-xl border border-[#1e3a5f] bg-[#0d2050] p-4 flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs px-2 py-0.5 rounded-full bg-[#1e3a5f] text-white">{ehCartao ? 'Ticketlog' : 'Veloe'}</span>
                      <span className="text-white tabular-nums">{ehCartao ? mascararCartao(g.identificador) : g.identificador}</span>
                    </div>
                    <div className="text-xs text-[#94a3b8]">
                      {g.gastos} gasto(s) · {brl(g.totalCentavos / 100)} · de {dataBR(g.primeiraData)} a {dataBR(g.ultimaData)}
                    </div>
                    <div className={`mt-2 text-xs ${g.motivo === 'sem_equipe' ? 'text-amber-300' : 'text-orange-300'}`}>
                      {g.motivo === 'sem_equipe' ? (
                        <>Motivo: <b>cartão/tag sem equipe nessa data</b>.</>
                      ) : (
                        <>Motivo: <b>equipe sem centro de custo nessa data</b> ({equipe?.codigo ?? '—'}).</>
                      )}
                    </div>
                  </div>
                  {podeGerir &&
                    (g.motivo === 'sem_equipe' ? (
                      <BotaoLigacao
                        primario
                        rotulo="Ligar a uma equipe"
                        plataforma={ehCartao ? 'ticketlog' : 'veloe'}
                        identificador={g.identificador}
                        mascara={ehCartao ? mascararCartao(g.identificador) : g.identificador}
                        equipes={equipes}
                        desdeSugerida={g.primeiraData}
                      />
                    ) : (
                      equipe && (
                        <BotaoCentroCusto
                          primario
                          rotulo={`Definir centro de custo de ${equipe.codigo}`}
                          equipe={{ id: equipe.id, codigo: equipe.codigo }}
                          atual={equipe.centroCusto}
                          desdeSugerida={g.primeiraData}
                        />
                      )
                    ))}
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
