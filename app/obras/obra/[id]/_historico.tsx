'use client'

/**
 * Histórico de alterações da obra — J4, seção D (aprovada).
 * Só exibe: não busca nada sozinho. Quem monta a página busca as linhas em
 * `obras_historico` e a data/fonte de entrada da obra, e passa como props.
 * Ver spec §4 para por que a linha "Entrada" é sintética, não uma linha real
 * de `obras_historico` (a sincronização do Field nunca grava histórico).
 */

import { useState } from 'react'
import { br, FUSO } from '../../_lib/tipos'
import { ROTULO_CAMPO, type BlocoHistorico, type LinhaHistorico } from '../../_lib/historico'
import { Box, BoxB, BoxH, EstadoVazio } from '../../_ui/primitivos'

const FILTROS: ('Todos' | BlocoHistorico)[] = [
  'Todos', 'Triagem', 'Autorização', 'Identificação', 'Cronograma', 'Esteira', 'Cancelamento',
]

export default function Historico({
  linhas,
  entrada,
}: {
  linhas: LinhaHistorico[]
  entrada: { data: string; fonte: string | null }
}) {
  const [filtro, setFiltro] = useState<'Todos' | BlocoHistorico>('Todos')
  const filtradas = linhas.filter((l) => filtro === 'Todos' || l.bloco === filtro)

  return (
    <Box>
      <BoxH extra={String(filtradas.length)}>Histórico de alterações</BoxH>
      <BoxB className="flex flex-col gap-2.5">
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filtrar por bloco">
          {FILTROS.map((f) => (
            <button
              key={f}
              type="button"
              aria-pressed={filtro === f}
              onClick={() => setFiltro(f)}
              className={`rounded-full border px-2.5 py-1 text-[11px] ${
                filtro === f
                  ? 'border-[#f05a28] bg-[#f05a28]/15 text-[#f05a28]'
                  : 'border-[#1e3a5f] text-[#94a3b8]'
              }`}
            >
              {f}
            </button>
          ))}
        </div>

        {filtradas.length === 0 ? (
          <EstadoVazio>
            {entrada.fonte === 'field'
              ? 'Nenhuma alteração desde a entrada pelo Field.'
              : 'Nenhuma alteração registrada.'}
          </EstadoVazio>
        ) : (
          <ul className="flex flex-col gap-2">
            {filtradas.map((l) => (
              <li key={l.id} className="border-b border-[#1e3a5f] pb-2 text-xs last:border-0">
                <div className="flex flex-wrap items-center gap-2 text-[11px] text-[#94a3b8]">
                  <span>
                    {new Intl.DateTimeFormat('pt-BR', {
                      dateStyle: 'short',
                      timeStyle: 'short',
                      timeZone: FUSO,
                    }).format(new Date(l.created_at))}
                  </span>
                  <span>{l.quem}</span>
                  <span className="rounded border border-[#1e3a5f] px-1.5 py-px">{l.bloco}</span>
                </div>
                <div className="mt-0.5 text-[#e8eef7]">
                  {ROTULO_CAMPO[l.campo] ?? l.campo}: <span className="text-[#64748b]">{l.de ?? '—'}</span> →{' '}
                  <b>{l.para ?? '—'}</b>
                </div>
                {l.motivo ? (
                  <div className="mt-0.5 text-[#f4b73f]">Motivo: {l.motivo}</div>
                ) : null}
              </li>
            ))}
          </ul>
        )}

        {filtro === 'Todos' ? (
          <p className="border-t border-[#1e3a5f] pt-2 text-[11px] text-[#64748b]">
            {br(entrada.data)}
            {entrada.fonte === 'field' ? ' · Field' : ''} — Obra criada pela sincronização,
            com Nº OS, loja e chamado.
          </p>
        ) : null}
      </BoxB>
    </Box>
  )
}
