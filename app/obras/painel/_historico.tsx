'use client'

/**
 * Histórico de faturamento — 12 meses até o mês escolhido, com a linha da
 * meta (`renderHist` do mockup). Clicar numa barra leva o painel àquele mês.
 */

import { useState } from 'react'
import { INICIO_DOS_DADOS, MESES_CURTOS, MESES_LONGOS, type Painel } from './_calculos'
import { Card, Delta, K, Mini, N0, R, Secao, Seg, mesCurto } from './_ui'

const kCurto = (v: number) => K(v).replace(' mil', 'k')

export default function Historico({
  painel,
  aoEscolherMes,
}: {
  painel: Painel
  aoEscolherMes: (mes: string) => void
}) {
  const [visao, setVisao] = useState<'mes' | 'acum'>('mes')
  const { historico: h, metas, periodo: P, kpis } = painel
  const acum = visao === 'acum'
  const meses = h.meses
  const vals = meses.map((m) => (acum ? m.acumulado : m.valor))
  const metaV = meses.map((m) => (acum ? m.metaAcumulada : metas.faturamento))
  const topo = Math.max(...vals, ...metaV.map((v) => v ?? 0)) * 1.12 || 1
  const passoBruto = topo / 4
  const mag = Math.pow(10, Math.floor(Math.log10(passoBruto)))
  const passo = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10].map((s) => s * mag).find((s) => s >= passoBruto) ?? passoBruto
  const ymax = passo * 4
  const selecionado = P.a.slice(0, 7)
  const n = meses.length
  const pontosMeta = meses.map((_, i) => `${((i + 0.5) / n) * 100},${100 - ((metaV[i] ?? 0) / ymax) * 100}`)

  return (
    <Secao
      titulo="Histórico de faturamento"
      sub="Faturado (NF emitida) mês a mês nos últimos 12 meses, com a linha da meta. Clique numa barra para ir àquele mês."
      extra={
        <Seg
          pequeno
          rotulo="Visão do histórico"
          valor={visao}
          aoEscolher={(v) => setVisao(v as 'mes' | 'acum')}
          itens={[
            { v: 'mes', nome: 'Mês a mês' },
            { v: 'acum', nome: 'Acumulado do ano' },
          ]}
        />
      }
    >
      <Card>
        <div className="px-4 py-3.5">
          <div className="relative ml-[38px] mt-1.5 h-[220px] sm:ml-11 sm:h-[250px]">
            {[0, 1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="absolute inset-x-0 border-t border-dashed border-[#1e3a5fcc]"
                style={{ bottom: `${i * 25}%` }}
              >
                <span className="absolute -left-[46px] -top-2 w-10 text-right font-mono text-[10px] text-[#64748b]">
                  {kCurto(passo * i)}
                </span>
              </div>
            ))}
            <div className="absolute inset-0 flex items-end gap-[3px] sm:gap-1.5">
              {meses.map((m, i) => {
                const v = vals[i]
                const sel = m.mes === selecionado
                const abaixo = metaV[i] && v < (metaV[i] ?? 0) && !m.parcial
                const [ano, mm] = m.mes.split('-').map(Number)
                const fundo = m.parcial
                  ? 'repeating-linear-gradient(45deg,#f05a28 0 6px,#c4461d 6px 12px)'
                  : abaixo
                    ? 'linear-gradient(180deg,#8a9bb5,#5c6f8d)'
                    : 'linear-gradient(180deg,#ff7849,#f05a28)'
                // Antes do sistema não há faturamento gravado: barra vazia
                // tracejada e "sem dado", nunca R$ 0.
                if (m.semDado) {
                  return (
                    <div
                      key={m.mes}
                      title={`${MESES_CURTOS[mm - 1]}/${ano}: sem dado — antes do sistema`}
                      className="relative flex h-full min-w-0 flex-1 flex-col items-center justify-end"
                    >
                      <span className="mb-1 hidden whitespace-nowrap text-[9.5px] text-[#64748b] sm:block">sem dado</span>
                      <i className="block h-[18%] w-[78%] max-w-[34px] rounded-t-[5px] border border-b-0 border-dashed border-[#294b78]" />
                    </div>
                  )
                }
                return (
                  <button
                    key={m.mes}
                    type="button"
                    onClick={() => aoEscolherMes(m.mes)}
                    title={`${MESES_CURTOS[mm - 1]}/${ano}: ${R(v)}${metaV[i] ? ' · meta ' + R(metaV[i]!) : ''}`}
                    className="relative flex h-full min-w-0 flex-1 flex-col items-center justify-end"
                  >
                    <span className="mb-1 hidden whitespace-nowrap font-mono text-[10px] text-[#94a3b8] sm:block">
                      {kCurto(v)}
                    </span>
                    <i
                      className="block w-[78%] max-w-[34px] rounded-t-[5px]"
                      style={{
                        height: `${(v / ymax) * 100}%`,
                        background: fundo,
                        outline: sel ? '2px solid #fff' : undefined,
                        outlineOffset: sel ? 2 : undefined,
                      }}
                    />
                  </button>
                )
              })}
            </div>
            {metas.faturamento ? (
              <svg
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
                className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
              >
                {acum ? (
                  <polyline
                    points={pontosMeta.join(' ')}
                    fill="none"
                    stroke="#fff"
                    strokeWidth={2}
                    strokeDasharray="6 4"
                    vectorEffect="non-scaling-stroke"
                  />
                ) : (
                  <line
                    x1={0}
                    x2={100}
                    y1={100 - (metas.faturamento / ymax) * 100}
                    y2={100 - (metas.faturamento / ymax) * 100}
                    stroke="#fff"
                    strokeWidth={2}
                    strokeDasharray="6 4"
                    vectorEffect="non-scaling-stroke"
                  />
                )}
              </svg>
            ) : null}
          </div>
          <div className="ml-[38px] mt-1.5 flex gap-[3px] sm:ml-11 sm:gap-1.5">
            {meses.map((m) => {
              const [ano, mm] = m.mes.split('-').map(Number)
              return (
                <span key={m.mes} className="min-w-0 flex-1 text-center text-[9px] text-[#94a3b8] sm:text-[10.5px]">
                  {MESES_CURTOS[mm - 1]}
                  {mm === 1 ? '/' + String(ano).slice(2) : ''}
                </span>
              )
            })}
          </div>
          <div className="mt-2.5 flex flex-wrap gap-3.5 text-[11px] text-[#94a3b8]">
            <span>
              <i className="mr-1.5 inline-block h-[9px] w-[18px] rounded-sm bg-[#f05a28] align-[-1px]" />
              {acum ? 'Acumulado no ano até o mês' : 'Faturado no mês'}
            </span>
            <span>
              <i className="mr-1.5 inline-block h-[9px] w-[18px] rounded-sm bg-[#6f82a0] align-[-1px]" />
              Mês fechado abaixo da meta
            </span>
            <span>
              <i
                className="mr-1.5 inline-block h-[9px] w-[18px] rounded-sm align-[-1px]"
                style={{ background: 'repeating-linear-gradient(45deg,#f05a28 0 4px,#c4461d 4px 8px)' }}
              />
              Mês em curso (parcial)
            </span>
            {metas.faturamento ? (
              <span>
                <i className="mr-1.5 inline-block w-[18px] border-t-2 border-dashed border-white align-middle" />
                {acum ? 'Meta acumulada' : `Meta mensal ${R(metas.faturamento)}`}
              </span>
            ) : (
              <span>Sem meta para este filtro — obras pontuais</span>
            )}
            {acum ? <span>Janeiro recomeça do zero</span> : null}
            {meses.some((m) => m.semDado) ? (
              <span>
                <i className="mr-1.5 inline-block h-[9px] w-[18px] rounded-sm border border-dashed border-[#294b78] align-[-1px]" />
                Sem dado: antes do sistema (começou em {mesCurto(INICIO_DOS_DADOS)})
              </span>
            ) : null}
          </div>
          <div className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
            <Mini rotulo={`Acumulado ${P.ano} até ${MESES_CURTOS[P.mes - 1]}`} valor={R(kpis.faturadoAno.valor)}>
              <div className="text-[11.5px] text-[#94a3b8]">
                {kpis.faturadoAno.metaAcumulada && kpis.faturadoAno.metaDesde
                  ? `meta acumulada desde ${mesCurto(kpis.faturadoAno.metaDesde)}: ${R(kpis.faturadoAno.metaAcumulada)} · ${N0((kpis.faturadoAno.valor / kpis.faturadoAno.metaAcumulada) * 100)}%`
                  : 'sem meta'}
              </div>
              <Delta
                atual={kpis.faturadoAno.valor}
                anterior={kpis.faturadoAno.anterior}
                maiorMelhor
                rotulo={`vs mesmo período de ${P.ano - 1}`}
              />
            </Mini>
            <Mini rotulo="Média mensal (meses fechados)" valor={R(h.mediaFechados)}>
              <div className="text-[11.5px] text-[#94a3b8]">
                {h.fechados === 1
                  ? 'último mês fechado'
                  : h.fechados
                    ? `últimos ${h.fechados} meses fechados`
                    : 'nenhum mês fechado desde o início do sistema'}
              </div>
            </Mini>
            <Mini rotulo="Melhor mês" valor={R(h.melhor.valor)}>
              <div className="text-[11.5px] text-[#94a3b8]">
                {MESES_LONGOS[Number(h.melhor.mes.slice(5, 7)) - 1]} {h.melhor.mes.slice(0, 4)}
              </div>
            </Mini>
          </div>
        </div>
      </Card>
    </Secao>
  )
}
