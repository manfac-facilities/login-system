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
  OPCOES_FIELD,
  OPCOES_OS,
  opcoesEtapa,
  type Filtros,
  type FiltroMau,
  type FiltroField,
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
    <div className="flex flex-col gap-3">
      <label htmlFor="obras-busca-q" className="block w-full">
        <span className="mb-1 block text-[11px] uppercase tracking-wide text-[#94a3b8]">
          Buscar loja ou OS
        </span>
        <span className="relative block">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden="true"
            className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[#94a3b8]"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <input
            id="obras-busca-q"
            type="search"
            value={filtros.q}
            onChange={(e) => onChange({ ...filtros, q: e.target.value })}
            placeholder="Ex.: DP Ipanema 3, 0926-010550"
            autoComplete="off"
            className={SELECT + ' pl-8 pr-8'}
          />
          {filtros.q ? (
            <button
              type="button"
              aria-label="Limpar busca"
              onClick={() => onChange({ ...filtros, q: '' })}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-base leading-none text-[#94a3b8] hover:text-[#e8eef7]"
            >
              ×
            </button>
          ) : null}
        </span>
      </label>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
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

        <label className="min-w-0">
          <span className="mb-1 block text-[11px] uppercase tracking-wide text-[#94a3b8]">
            Field Control
          </span>
          <select
            className={SELECT}
            value={filtros.field}
            onChange={(e) => onChange({ ...filtros, field: e.target.value as FiltroField })}
          >
            {OPCOES_FIELD.map((o) => (
              <option key={o.v} value={o.v}>
                {o.t}
              </option>
            ))}
          </select>
        </label>
      </div>
    </div>
  )
}
