'use client'

/**
 * Cronograma obra a obra — o Gantt do mockup (`renderGantt`), posição de hoje.
 * Planejado em cima (tracejado), realizado embaixo; linha laranja = hoje. A
 * caixa rola nos dois sentidos; a página não.
 */

import { useEffect, useRef, useState } from 'react'
import { diasDesde, somaDias } from '../_lib/tipos'
import { MESES_CURTOS, type LinhaGantt, type Painel } from './_calculos'
import { Card, Posicao, Secao, Seg, Tag, fd } from './_ui'

const PX = 13
const LARGURA_ROTULO = 'w-[150px] sm:w-[230px]'

const FILTROS = [
  { v: 'todas', nome: 'Todas' },
  { v: 'late', nome: 'Atrasadas' },
  { v: 'rem', nome: 'Remarcadas' },
  { v: 'campo', nome: 'Em campo' },
  { v: 'iniciar', nome: 'A iniciar' },
]

function passa(l: LinhaGantt, f: string): boolean {
  if (f === 'late') return l.atrasada
  if (f === 'rem') return l.remarcada
  if (f === 'campo') return l.grupo === 'campo'
  if (f === 'iniciar') return l.grupo === 'iniciar'
  return true
}

export default function Cronograma({ painel, comCliente }: { painel: Painel; comCliente: boolean }) {
  const [filtro, setFiltro] = useState('todas')
  const caixa = useRef<HTMLDivElement>(null)
  const { linhas, semDatas, janela } = painel.cronograma
  const hoje = painel.hoje
  const dias = (diasDesde(janela.de, janela.ate) ?? 0) + 1
  const largura = dias * PX
  const x = (iso: string) => Math.max(0, Math.min(dias, diasDesde(janela.de, iso) ?? 0)) * PX
  const xHoje = x(hoje)

  // Abre a caixa já com "hoje" à vista, como o mockup.
  useEffect(() => {
    const c = caixa.current
    if (c) c.scrollLeft = Math.max(0, xHoje - c.clientWidth * 0.45)
  }, [xHoje])

  const ticks: { left: number; texto: string; mes: boolean }[] = []
  for (let n = 0; n < dias; n++) {
    const iso = somaDias(janela.de, n)!
    const d = new Date(iso + 'T00:00:00Z')
    if (d.getUTCDate() === 1) ticks.push({ left: n * PX, texto: MESES_CURTOS[d.getUTCMonth()], mes: true })
    else if (d.getUTCDay() === 1) ticks.push({ left: n * PX, texto: fd(iso), mes: false })
  }
  const grade = (comTexto: boolean) =>
    ticks.map((t) => (
      <div
        key={t.left}
        className="absolute inset-y-0 border-l"
        style={{ left: t.left, borderColor: t.mes ? '#294b78' : 'rgba(30,58,95,.55)' }}
      >
        {comTexto ? (
          <span
            className={`absolute left-1 whitespace-nowrap font-mono text-[10px] ${t.mes ? 'top-[19px] font-bold text-[#e8eef7]' : 'top-1 text-[#94a3b8]'}`}
          >
            {t.texto}
          </span>
        ) : null}
      </div>
    ))

  const visiveis = linhas.filter((l) => passa(l, filtro))

  return (
    <Secao
      titulo="Cronograma obra a obra"
      sub="Obras a iniciar, em campo e as que terminaram nos últimos 14 dias. Planejado em cima, realizado embaixo; linha laranja = hoje. Role a caixa para ver mais obras e mais dias."
      extra={
        <div className="flex flex-wrap items-center gap-2">
          <Posicao>Posição de hoje, {fd(hoje)}</Posicao>
          <Seg pequeno rotulo="Filtro do cronograma" valor={filtro} aoEscolher={setFiltro} itens={FILTROS} />
        </div>
      }
    >
      <Card>
        <div className="px-4 py-3.5">
          <div ref={caixa} className="relative max-h-[520px] overflow-auto rounded-lg border border-[#1e3a5f]">
            <div className="relative w-max min-w-full">
              <div className="sticky top-0 z-[3] flex h-[38px] border-b border-[#1e3a5f] bg-[#0d2050]">
                <div
                  className={`${LARGURA_ROTULO} sticky left-0 z-[4] flex shrink-0 items-center border-r border-[#1e3a5f] bg-[#0d2050] px-2.5 text-[10px] uppercase tracking-wider text-[#94a3b8]`}
                >
                  Obra · {visiveis.length}
                </div>
                <div className="relative shrink-0" style={{ width: largura }}>
                  {grade(true)}
                  <div className="absolute inset-y-0 z-[1] w-0.5 bg-[#f05a28]" style={{ left: xHoje }}>
                    <span className="absolute top-0 -translate-x-1/2 whitespace-nowrap rounded bg-[#f05a28] px-1.5 py-0.5 text-[9.5px] font-bold text-white">
                      hoje {fd(hoje)}
                    </span>
                  </div>
                </div>
              </div>
              {visiveis.length === 0 ? (
                <div className="px-4 py-5 text-[12.5px] text-[#64748b]">Nenhuma obra neste filtro.</div>
              ) : null}
              {visiveis.map((l) => {
                const o = l.obra
                const corReal = l.parada
                  ? 'repeating-linear-gradient(45deg,#f4b73f 0 5px,#b4841f 5px 10px)'
                  : l.atrasada
                    ? '#ff4d6d'
                    : l.terminouComAtraso
                      ? '#8a4a5c'
                      : '#5aa9f0'
                const fimBarras = [l.planFim, l.realFim].filter((d): d is string => !!d).sort().at(-1)
                const xTexto = Math.min(largura - 150, (fimBarras ? x(fimBarras) : 0) + 6)
                return (
                  <div key={o.id} className="flex h-11 border-b border-[#1e3a5f99]">
                    <div
                      className={`${LARGURA_ROTULO} sticky left-0 z-[2] min-w-0 shrink-0 border-r border-[#1e3a5f] bg-[#0b1b36] px-2.5 py-1.5`}
                      style={l.atrasada ? { boxShadow: 'inset 3px 0 0 #ff4d6d' } : undefined}
                    >
                      <div className="truncate text-[12px] font-bold text-[#e8eef7]">{o.loja ?? 'sem loja'}</div>
                      <div className="truncate text-[10.5px] text-[#64748b]">
                        {o.os ?? 'sem OS'} · {o.equipe}
                        {comCliente ? ` · ${o.cliente}` : ''}
                      </div>
                    </div>
                    <div className="relative shrink-0" style={{ width: largura }}>
                      {grade(false)}
                      <div className="absolute inset-y-0 z-[1] w-0.5 bg-[#f05a28]" style={{ left: xHoje }} />
                      {l.planIni && l.planFim ? (
                        <div
                          className="absolute top-2 h-[11px] rounded border-[1.5px] border-dashed border-[#7f95b5] bg-[#7f95b514]"
                          style={{ left: x(l.planIni), width: Math.max(3, x(l.planFim) - x(l.planIni)) }}
                          title={`Planejado ${fd(l.planIni)}–${fd(somaDias(l.planFim, -1))}`}
                        />
                      ) : null}
                      {l.realIni && l.realFim ? (
                        <div
                          className="absolute top-[23px] h-3 rounded"
                          style={{
                            left: x(l.realIni),
                            width: Math.max(3, x(somaDias(l.realFim, 1)!) - x(l.realIni)),
                            background: corReal,
                          }}
                          title={`Realizado ${fd(l.realIni)}–${l.emCurso ? 'em curso' : fd(l.realFim)}`}
                        />
                      ) : null}
                      <div
                        className="absolute top-3.5 whitespace-nowrap text-[10px]"
                        style={{ left: Math.max(0, xTexto) }}
                      >
                        {l.atrasada ? <Tag cor="#ff4d6d">atrasada {l.diasAtraso}d</Tag> : null}
                        {!l.atrasada && l.terminouComAtraso ? (
                          <span className="font-mono text-[11px] text-[#64748b]">terminou +{l.terminouComAtraso}d · </span>
                        ) : null}{' '}
                        {l.remarcada ? <Tag cor="#f4b73f">remarcada</Tag> : null}{' '}
                        <span className="text-[#64748b]">{o.etapaNome}</span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
          <div className="mt-2.5 flex flex-wrap gap-3.5 text-[11px] text-[#94a3b8]">
            <span>
              <i className="mr-1.5 inline-block h-[9px] w-[18px] rounded-sm border-[1.5px] border-dashed border-[#7f95b5] align-[-1px]" />
              Planejado
            </span>
            <span>
              <i className="mr-1.5 inline-block h-[9px] w-[18px] rounded-sm bg-[#5aa9f0] align-[-1px]" />
              Realizado
            </span>
            <span>
              <i className="mr-1.5 inline-block h-[9px] w-[18px] rounded-sm bg-[#ff4d6d] align-[-1px]" />
              Atrasada agora
            </span>
            <span>
              <i className="mr-1.5 inline-block h-[9px] w-[18px] rounded-sm bg-[#8a4a5c] align-[-1px]" />
              Já terminou, com atraso
            </span>
            <span>
              <i
                className="mr-1.5 inline-block h-[9px] w-[18px] rounded-sm align-[-1px]"
                style={{ background: 'repeating-linear-gradient(45deg,#f4b73f 0 4px,#b4841f 4px 8px)' }}
              />
              Parada agora
            </span>
            <span>
              <i className="mr-1.5 inline-block h-[9px] w-[3px] rounded-sm bg-[#f05a28] align-[-1px]" />
              Hoje
            </span>
          </div>
          {semDatas ? (
            <p className="mt-2 text-[11px] text-[#64748b]">
              {semDatas} {semDatas === 1 ? 'obra ficou' : 'obras ficaram'} fora do cronograma por não ter início planejado
              nem início real na ficha.
            </p>
          ) : null}
        </div>
      </Card>
    </Secao>
  )
}
