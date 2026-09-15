'use client'

/**
 * O botão "Puxar do Field" e o relatório do que aconteceu.
 *
 * Mesma forma do painel da importação da planilha (`importar/_form.tsx`): o
 * estado inteiro vem da Server Action, os números aparecem como KPI e TODA OS
 * que não entrou é listada com o motivo. Sincronizar em silêncio esconderia OS
 * que o cliente cadastrou no Field e acha que está no sistema — que é
 * exatamente o problema que esta tela existe para resolver.
 */

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Box, BoxB, BoxH, Botao, EstadoVazio, KPI } from '../_ui/primitivos'
import { sincronizarComFieldAction, type EstadoSincronizacao } from './_actions'

export default function PainelSincronizacao() {
  const router = useRouter()
  const [estado, setEstado] = useState<EstadoSincronizacao | null>(null)
  const [rodando, setRodando] = useState(false)

  async function puxar() {
    setRodando(true)
    setEstado(null)
    try {
      setEstado(await sincronizarComFieldAction())
      router.refresh()
    } catch {
      setEstado({ error: 'Não deu para falar com o servidor. Tente de novo.' })
    } finally {
      setRodando(false)
    }
  }

  const rel = estado?.relatorio

  return (
    <div className="space-y-4">
      <Box>
        <BoxH>Puxar as OS do Field Control</BoxH>
        <BoxB>
          <div className="space-y-3">
            <p className="text-sm text-[#94a3b8]">
              Lê as OS do tipo <strong className="text-[#e8eef7]">Atividade Spot</strong> no Field
              Control e traz para a base de obras. Pode rodar quantas vezes quiser: OS que já existe
              não é duplicada, e o que foi digitado aqui no hub nunca é sobrescrito. Uma OS só
              recebe o alerta de ausência depois de faltar em duas leituras completas seguidas.
            </p>

            <div className="flex flex-wrap items-center gap-3">
              <Botao type="button" onClick={puxar} disabled={rodando}>
                {rodando ? 'Puxando…' : 'Puxar do Field'}
              </Botao>
              {rodando ? (
                <span className="text-xs text-[#94a3b8]">
                  O Field aceita uma consulta por segundo, então isso leva alguns instantes. Não
                  feche a página.
                </span>
              ) : null}
            </div>
          </div>
        </BoxB>
      </Box>

      {estado?.error ? (
        <Box>
          <BoxB>
            <p className="text-sm text-[#ff4d6d]">{estado.error}</p>
          </BoxB>
        </Box>
      ) : null}

      {rel ? (
        <Box>
          <BoxH extra="sincronização concluída">Relatório</BoxH>
          <BoxB className="space-y-4">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">
              <KPI rotulo="OS vindas do Field" valor={rel.totalDoField} />
              <KPI rotulo="Obras criadas" valor={rel.novas} cor="#35c98a" />
              <KPI rotulo="Obras completadas" valor={rel.atualizadas} cor="#5aa9f0" />
              <KPI rotulo="Sem novidade" valor={rel.inalteradas} />
              <KPI
                rotulo="OS ignoradas"
                valor={rel.ignoradas.length}
                cor={rel.ignoradas.length ? '#f4b73f' : undefined}
              />
              <KPI rotulo="Primeiras ausências" valor={rel.suspeitasDeAusencia} cor="#f4b73f" />
              <KPI
                rotulo="Novos alertas de ausência"
                valor={rel.novosAlertasDeAusencia}
                cor="#ff4d6d"
              />
              <KPI rotulo="Alertas removidos" valor={rel.alertasRemovidos} cor="#35c98a" />
            </div>

            {rel.numerosDeOsAlterados.length ? (
              <div>
                <h3 className="mb-2 text-sm font-semibold text-[#e8eef7]">
                  Número da OS alterado no Field
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[32rem] text-left text-sm">
                    <thead>
                      <tr className="border-b border-[#1e3a5f] text-[11px] uppercase tracking-wide text-[#94a3b8]">
                        <th className="py-1.5 pr-3 font-medium">Id no Field</th>
                        <th className="py-1.5 pr-3 font-medium">Número anterior</th>
                        <th className="py-1.5 font-medium">Número atual</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rel.numerosDeOsAlterados.map((item) => (
                        <tr key={item.idField} className="border-b border-[#1e3a5f]/50">
                          <td className="py-1.5 pr-3 text-[#94a3b8]">{item.idField}</td>
                          <td className="py-1.5 pr-3 text-[#e8eef7]">{item.anterior}</td>
                          <td className="py-1.5 text-[#e8eef7]">{item.atual}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}

            {rel.historicosHerdados.length ? (
              <div>
                <h3 className="mb-2 text-sm font-semibold text-[#35c98a]">
                  OS reaberta: histórico herdado
                </h3>
                <div className="space-y-1 text-sm text-[#e8eef7]">
                  {rel.historicosHerdados.map((item) => (
                    <p key={`${item.idFieldAnterior}-${item.idFieldAtual}`}>
                      OS {item.os}: {item.idFieldAnterior} → {item.idFieldAtual}
                    </p>
                  ))}
                </div>
              </div>
            ) : null}

            {rel.avisos.length ? (
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-[#f4b73f]">Atenção</h3>
                {rel.avisos.map((aviso) => (
                  <p
                    key={aviso}
                    className="rounded-md border border-[#f4b73f]/40 bg-[#f4b73f]/10 px-3 py-2 text-sm text-[#e8eef7]"
                  >
                    {aviso}
                  </p>
                ))}
              </div>
            ) : null}

            <div>
              <h3 className="mb-2 text-sm font-semibold text-[#e8eef7]">O que ficou de fora</h3>
              {rel.ignoradas.length === 0 ? (
                <EstadoVazio>Nenhuma OS ficou de fora.</EstadoVazio>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[32rem] text-left text-sm">
                    <thead>
                      <tr className="border-b border-[#1e3a5f] text-[11px] uppercase tracking-wide text-[#94a3b8]">
                        <th className="py-1.5 pr-3 font-medium">Nº OS</th>
                        <th className="py-1.5 pr-3 font-medium">Id no Field</th>
                        <th className="py-1.5 font-medium">Por quê</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rel.ignoradas.map((i, idx) => (
                        <tr key={`${i.idField}-${idx}`} className="border-b border-[#1e3a5f]/50">
                          <td className="py-1.5 pr-3 whitespace-nowrap text-[#e8eef7]">
                            {i.os ?? '—'}
                          </td>
                          <td className="py-1.5 pr-3 whitespace-nowrap text-[#94a3b8]">
                            {i.idField}
                          </td>
                          <td className="py-1.5 text-[#e8eef7]">{i.motivo}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <p className="mt-2 text-xs text-[#64748b]">
                O id do Field está aí para achar a OS no painel do cliente sem depender do número,
                que o gestor pode editar.
              </p>
            </div>
          </BoxB>
        </Box>
      ) : null}
    </div>
  )
}
