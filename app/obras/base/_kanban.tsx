'use client'

/**
 * Base de obras — visão Kanban.
 *
 * O QUADRO AGRUPA POR **FASE**, NÃO POR ETAPA, e isso é decisão registrada no
 * mockup (:3247): o ciclo tem nove etapas, e nove colunas viram uma parede que
 * ninguém lê. Dentro de cada coluna a etapa exata continua escrita, como
 * subtítulo com a contagem, e o detalhe fino fica na ficha da obra.
 *
 * `cardKanban(mockup:3260)` e `renderKanban(mockup:3277)`.
 */

import Link from 'next/link'
import {
  CICLO,
  COR_SEV,
  FASES,
  critico,
  encalhada,
  encerrada,
  faseDe,
  posCampo,
  sev,
  type Obra,
} from '../_lib/tipos'
import {
  BadgeDias,
  EtiquetaAusenciaField,
  EtiquetaCobertura,
  EtiquetaMauUso,
  EtiquetaOS,
  EtiquetaPrioridade,
} from './_etiquetas'
import { COR_ETAPA, COR_FASE, temAlertaDeAusenciaField } from './_regras'

function Cartao({ obra }: { obra: Obra }) {
  const corCom = critico(obra) ? '#ff4d6d' : encalhada(obra) ? '#f4b73f' : '#94a3b8'
  return (
    <Link
      href={`/obras/obra/${obra.id}`}
      className="block rounded-lg border border-[#1e3a5f] bg-[#0d2050] p-2.5 transition hover:border-[#f05a28]"
      style={{
        borderLeftWidth: 3,
        borderLeftColor: temAlertaDeAusenciaField(obra) ? '#ff4d6d' : COR_SEV[sev(obra)],
      }}
    >
      <div className="font-mono text-[10px] text-[#64748b]">OS {obra.os ?? '—'}</div>
      <div className="mt-0.5 text-sm font-semibold text-[#e8eef7]">{obra.loja ?? '—'}</div>
      <div className="mt-1 flex flex-wrap gap-x-2 gap-y-0.5 text-[11px] text-[#94a3b8]">
        <span>{obra.tipo ?? '—'}</span>
        <span>
          {obra.pcm ? (
            `Responsável ${obra.pcm}`
          ) : (
            <span className="text-[#f05a28]">sem responsável</span>
          )}
        </span>
        {obra.equipe ? <span>{obra.equipe}</span> : null}
      </div>

      {posCampo(obra) && !encerrada(obra) ? (
        <div className="mt-1.5 text-[11px]" style={{ color: corCom }}>
          Com <b>{obra.dono}</b>
          {obra.paradaEtapa === null ? null : (
            <>
              {' '}
              há <b>{obra.paradaEtapa}</b> dias
            </>
          )}
        </div>
      ) : null}

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <BadgeDias obra={obra} curto />
        {obra.os_aprovada ? null : <EtiquetaOS obra={obra} />}
        <EtiquetaCobertura obra={obra} />
        <EtiquetaMauUso obra={obra} />
        <EtiquetaPrioridade obra={obra} />
        <EtiquetaAusenciaField obra={obra} />
      </div>
    </Link>
  )
}

export default function KanbanBase({ obras }: { obras: Obra[] }) {
  return (
    <div className="flex gap-3 overflow-x-auto pb-2">
      {FASES.map((f) => {
        const daFase = obras.filter((o) => faseDe(o) === f.k)
        return (
          <div
            key={f.k}
            className="flex w-[280px] flex-none flex-col rounded-lg border border-[#1e3a5f] bg-[#0a1628]"
          >
            <div className="flex items-center justify-between border-b border-[#1e3a5f] px-3 py-2">
              <span className="text-sm font-semibold" style={{ color: COR_FASE[f.k] }}>
                {f.nome}
              </span>
              <span className="text-xs text-[#94a3b8]">{daFase.length}</span>
            </div>
            <div className="flex flex-col gap-2 px-2 py-2">
              {daFase.length === 0 ? (
                <div className="px-1 py-4 text-center text-xs text-[#64748b]">nenhuma obra</div>
              ) : (
                CICLO.filter((c) => c.fase === f.k).map((c) => {
                  const dela = daFase
                    .filter((o) => o.etapa === c.k)
                    .sort((a, b) => {
                      const x = a.paradaEtapa ?? a.dias ?? 0
                      const y = b.paradaEtapa ?? b.dias ?? 0
                      return y - x
                    })
                  if (dela.length === 0) return null
                  return (
                    <div key={c.k} className="flex flex-col gap-2">
                      <div className="flex items-center justify-between px-1 pt-1 text-[11px]">
                        <span style={{ color: COR_ETAPA[c.k] }}>{c.nome}</span>
                        <b className="text-[#94a3b8]">{dela.length}</b>
                      </div>
                      {dela.map((o) => (
                        <Cartao key={o.id} obra={o} />
                      ))}
                    </div>
                  )
                })
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
