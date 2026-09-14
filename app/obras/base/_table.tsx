'use client'

/**
 * Base de obras — visão Tabela.
 *
 * Colunas e rótulos são os do mockup (`COLS`, :3106), mais a coluna
 * **Prioridade** (decisão técnica 5 da spec). Ordenação por clique no
 * cabeçalho, default `dias` desc — a regra vive em `_regras.ts`, aqui só a
 * tela.
 *
 * NO CELULAR a tabela vira lista de cartões. Tabela de 14 colunas em tela de
 * 5 polegadas é tabela que ninguém lê, e esta gente abre o sistema em obra.
 */

import Link from 'next/link'
import {
  br,
  encalhada,
  encerrada,
  critico,
  posCampo,
  semCobertura,
  travado,
  SEM_BLOQUEIO,
  type Obra,
} from '../_lib/tipos'
import {
  BadgeDias,
  EtiquetaAusenciaField,
  EtiquetaCobertura,
  EtiquetaEtapa,
  EtiquetaMauUso,
  EtiquetaOS,
  EtiquetaPrioridade,
  PrazoBarra,
} from './_etiquetas'
import { COLS, temAlertaDeAusenciaField, type Ordem } from './_regras'

function seta(ordem: Ordem, col: string) {
  if (ordem.col !== col) return ''
  return ordem.dir > 0 ? '▲' : '▼'
}

function Bloqueio({ obra }: { obra: Obra }) {
  if (!obra.bloqueio || obra.bloqueio === SEM_BLOQUEIO || posCampo(obra)) {
    return <span className="text-[#64748b]">—</span>
  }
  return (
    <span className="text-[#e8eef7]">
      {obra.bloqueio}
      {travado(obra) ? (
        <span className="ml-1 text-[11px] text-[#f4b73f]">{obra.bloqueada_dias}d</span>
      ) : null}
    </span>
  )
}

function Parada({ obra }: { obra: Obra }) {
  if (obra.paradaEtapa === null || encerrada(obra)) return <span className="text-[#64748b]">—</span>
  return (
    <span
      className="whitespace-nowrap text-xs font-semibold"
      style={{ color: encalhada(obra) ? '#f4b73f' : '#94a3b8' }}
    >
      {obra.paradaEtapa} <span className="font-normal text-[10px]">dias</span>
    </span>
  )
}

export default function TabelaBase({
  obras,
  ordem,
  onOrdenar,
}: {
  obras: Obra[]
  ordem: Ordem
  onOrdenar: (col: string) => void
}) {
  return (
    <>
      {/* ---------- celular: cartões ---------- */}
      <ul className="flex flex-col gap-2 sm:hidden">
        {obras.map((o) => (
          <li
            key={o.id}
            className="rounded-lg border border-[#1e3a5f] bg-[#0d2050] p-3"
            style={
              critico(o) || semCobertura(o) || temAlertaDeAusenciaField(o)
                ? { borderLeftWidth: 3, borderLeftColor: '#ff4d6d' }
                : undefined
            }
          >
            <div className="flex items-start justify-between gap-2">
              <Link
                href={`/obras/obra/${o.id}`}
                className="text-sm font-semibold text-[#e8eef7] underline-offset-2 hover:underline"
              >
                {o.loja ?? '—'}
              </Link>
              <BadgeDias obra={o} curto />
            </div>
            <div className="mt-1 text-[11px] text-[#94a3b8]">
              OS {o.os ?? '—'} · {o.tipo ?? '—'}
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <EtiquetaEtapa obra={o} />
              <EtiquetaMauUso obra={o} />
              <EtiquetaPrioridade obra={o} />
              <EtiquetaOS obra={o} />
              <EtiquetaCobertura obra={o} />
              <EtiquetaAusenciaField obra={o} />
            </div>
            <div className="mt-2 text-[11px] text-[#94a3b8]">
              {o.pcm ? `Responsável ${o.pcm}` : (
                <span className="text-[#f05a28]">sem responsável</span>
              )}
              {o.equipe ? ` · ${o.equipe}` : ''}
            </div>
          </li>
        ))}
      </ul>

      {/* ---------- tela grande: a tabela do mockup ---------- */}
      <div className="hidden overflow-x-auto rounded-lg border border-[#1e3a5f] sm:block">
        <table className="w-full min-w-[1100px] border-collapse text-sm">
          <thead>
            <tr className="bg-[#0d2050]">
              {COLS.map((c) => (
                <th
                  key={c.k}
                  scope="col"
                  className="border-b border-[#1e3a5f] px-2 py-2 text-left align-bottom"
                >
                  <button
                    type="button"
                    onClick={() => onOrdenar(c.k)}
                    className="whitespace-nowrap text-[11px] font-semibold uppercase tracking-wide text-[#94a3b8] hover:text-[#f05a28]"
                  >
                    {c.t} <span className="text-[#f05a28]">{seta(ordem, c.k)}</span>
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {obras.map((o) => (
              <tr
                key={o.id}
                className="border-b border-[#1e3a5f] align-top hover:bg-[#132a52]"
                style={
                  critico(o) || semCobertura(o) || temAlertaDeAusenciaField(o)
                    ? { boxShadow: 'inset 3px 0 0 0 #ff4d6d' }
                    : undefined
                }
              >
                <td className="px-2 py-2 font-mono text-xs whitespace-nowrap text-[#94a3b8]">
                  {o.os ?? '—'}
                </td>
                <td className="px-2 py-2">
                  <Link
                    href={`/obras/obra/${o.id}`}
                    className="font-medium text-[#e8eef7] underline-offset-2 hover:text-[#f05a28] hover:underline"
                  >
                    {o.loja ?? '—'}
                  </Link>
                </td>
                <td className="px-2 py-2 text-[#94a3b8]">{o.tipo ?? '—'}</td>
                <td className="px-2 py-2">
                  {o.pcm ? (
                    <span className="text-[#e8eef7]">{o.pcm}</span>
                  ) : (
                    <span className="text-[#f05a28]">a definir</span>
                  )}
                </td>
                <td className="px-2 py-2 text-[#94a3b8]">{o.equipe ?? '—'}</td>
                <td className="px-2 py-2">
                  <div className="flex flex-wrap items-center gap-1">
                    <EtiquetaEtapa obra={o} />
                    <EtiquetaMauUso obra={o} />
                    <EtiquetaAusenciaField obra={o} />
                  </div>
                </td>
                <td className="px-2 py-2">
                  <EtiquetaPrioridade obra={o} /> {o.prioridade ? null : (
                    <span className="text-[#64748b]">—</span>
                  )}
                </td>
                <td className="px-2 py-2 text-[#94a3b8]">{o.dono}</td>
                <td className="px-2 py-2 text-right">
                  <Parada obra={o} />
                </td>
                <td className="px-2 py-2">
                  <div className="flex flex-wrap items-center gap-1">
                    <EtiquetaOS obra={o} />
                    <EtiquetaCobertura obra={o} />
                  </div>
                </td>
                <td className="px-2 py-2 text-xs">
                  <Bloqueio obra={o} />
                </td>
                <td className="px-2 py-2 text-right">
                  <BadgeDias obra={o} curto />
                </td>
                <td className="px-2 py-2">
                  <PrazoBarra obra={o} />
                </td>
                <td className="px-2 py-2 text-right font-mono text-xs whitespace-nowrap text-[#94a3b8]">
                  {br(o.atualizacao)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
