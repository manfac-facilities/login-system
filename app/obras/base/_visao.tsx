'use client'

/**
 * O corpo interativo da Base de obras: seletor Tabela/Kanban, filtros,
 * contador e a visão escolhida.
 *
 * Por que o filtro é no cliente e não na query: a base inteira são 187 linhas.
 * Trazer tudo uma vez e filtrar em memória dá troca de filtro instantânea, sem
 * ida ao servidor a cada `select` — e mantém a regra do mockup de os
 * indicadores olharem sempre a base inteira, porque quem os calcula é a página
 * (server), sobre `todas`, e nunca sobre o resultado de `filtrar()`.
 */

import { useMemo, useState } from 'react'
import { EstadoVazio } from '../_ui/primitivos'
import type { Obra } from '../_lib/tipos'
import FiltrosBase from './_filtros'
import TabelaBase from './_table'
import KanbanBase from './_kanban'
import {
  FILTROS_PADRAO,
  ORDEM_PADRAO,
  alternarOrdem,
  filtrar,
  ordenar,
  responsaveisDaBase,
  type Filtros,
  type Ordem,
} from './_regras'

export default function VisaoBase({ obras }: { obras: Obra[] }) {
  const [vis, setVis] = useState<'tabela' | 'kanban'>('tabela')
  const [filtros, setFiltros] = useState<Filtros>(FILTROS_PADRAO)
  const [ordem, setOrdem] = useState<Ordem>(ORDEM_PADRAO)

  const responsaveis = useMemo(() => responsaveisDaBase(obras), [obras])
  const lista = useMemo(() => filtrar(obras, filtros), [obras, filtros])
  const listaOrdenada = useMemo(() => ordenar(lista, ordem), [lista, ordem])

  const botao = (v: 'tabela' | 'kanban', rotulo: string) => (
    <button
      type="button"
      aria-pressed={vis === v}
      onClick={() => setVis(v)}
      className={
        'rounded-md px-3 py-1.5 text-sm font-medium transition ' +
        (vis === v
          ? 'bg-[#f05a28] text-white'
          : 'text-[#94a3b8] hover:text-[#e8eef7]')
      }
    >
      {rotulo}
    </button>
  )

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 rounded-lg border border-[#1e3a5f] bg-[#0d2050] p-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div
            role="group"
            aria-label="Formato de visualização"
            className="inline-flex rounded-md border border-[#1e3a5f] p-0.5"
          >
            {botao('tabela', 'Tabela')}
            {botao('kanban', 'Kanban')}
          </div>
          <span className="text-xs text-[#94a3b8]">
            <b className="text-[#e8eef7]">{lista.length}</b> obras nesta visão · base completa:{' '}
            <b className="text-[#e8eef7]">{obras.length}</b>
          </span>
        </div>
        <FiltrosBase filtros={filtros} responsaveis={responsaveis} onChange={setFiltros} />
      </div>

      {lista.length === 0 ? (
        <EstadoVazio>Nenhuma obra nesta visão. Troque os filtros acima.</EstadoVazio>
      ) : vis === 'tabela' ? (
        <TabelaBase
          obras={listaOrdenada}
          ordem={ordem}
          onOrdenar={(col) => setOrdem((a) => alternarOrdem(a, col))}
        />
      ) : (
        <KanbanBase obras={listaOrdenada} />
      )}
    </div>
  )
}
