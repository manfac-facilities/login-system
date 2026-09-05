'use client'

/**
 * A barra de filtros da Base de obras.
 *
 * Os rótulos e as opções são os do mockup aprovado (modelo-mockup.md §5) e não
 * se reabrem: "Responsável da obra", "Etapa da obra", "Autorização",
 * "Classificação". O componente é controlado — quem guarda o estado é
 * `_visao.tsx`, para que a mesma seleção sirva à Tabela e ao Kanban.
 */

import {
  OPCOES_MAU,
  OPCOES_OS,
  opcoesEtapa,
  type Filtros,
  type FiltroMau,
  type FiltroOs,
} from './_regras'

const SELECT =
  'w-full rounded-md border border-[#1e3a5f] bg-[#0a1628] px-2 py-1.5 text-sm text-[#e8eef7] outline-none focus:border-[#f05a28]'

export default function FiltrosBase({
  filtros,
  responsaveis,
  onChange,
}: {
  filtros: Filtros
  responsaveis: string[]
  onChange: (f: Filtros) => void
}) {
  const etapas = opcoesEtapa()

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <label className="min-w-0">
        <span className="mb-1 block text-[11px] uppercase tracking-wide text-[#94a3b8]">
          Responsável da obra
        </span>
        <select
          className={SELECT}
          value={filtros.pcm}
          onChange={(e) => onChange({ ...filtros, pcm: e.target.value })}
        >
          <option value="todos">Todos</option>
          {responsaveis.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
          <option value="__sem">Ainda sem responsável</option>
        </select>
      </label>

      <label className="min-w-0">
        <span className="mb-1 block text-[11px] uppercase tracking-wide text-[#94a3b8]">
          Etapa da obra
        </span>
        <select
          className={SELECT}
          value={filtros.etapa}
          onChange={(e) => onChange({ ...filtros, etapa: e.target.value })}
        >
          {etapas.soltas.map((o) => (
            <option key={o.v} value={o.v}>
              {o.t}
            </option>
          ))}
          {etapas.grupos.map((g) => (
            <optgroup key={g.fase} label={g.fase}>
              {g.opcoes.map((o) => (
                <option key={o.v} value={o.v}>
                  {o.t}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </label>

      <label className="min-w-0">
        <span className="mb-1 block text-[11px] uppercase tracking-wide text-[#94a3b8]">
          Autorização
        </span>
        <select
          className={SELECT}
          value={filtros.os}
          onChange={(e) => onChange({ ...filtros, os: e.target.value as FiltroOs })}
        >
          {OPCOES_OS.map((o) => (
            <option key={o.v} value={o.v}>
              {o.t}
            </option>
          ))}
        </select>
      </label>

      <label className="min-w-0">
        <span className="mb-1 block text-[11px] uppercase tracking-wide text-[#94a3b8]">
          Classificação
        </span>
        <select
          className={SELECT}
          value={filtros.mau}
          onChange={(e) => onChange({ ...filtros, mau: e.target.value as FiltroMau })}
        >
          {OPCOES_MAU.map((o) => (
            <option key={o.v} value={o.v}>
              {o.t}
            </option>
          ))}
        </select>
      </label>
    </div>
  )
}
