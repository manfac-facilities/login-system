'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Restricao } from '../../_lib/last-planner'
import { apagarRestricaoAction, moverRestricaoAction } from './_actions'
import { SITUACOES, rotuloResponsavelRestricao, rotuloTipo, vizinha, type SituacaoRestricao } from './_tipos'

export type CartaoRestricao = Restricao & { atividade: string; podeApagar: boolean; atrasada: boolean }

const btn = 'min-h-11 rounded-lg border border-[#dadad8] px-3 text-sm text-[#333336] hover:border-[#b94606] disabled:opacity-45'

function Cartao({ r }: { r: CartaoRestricao }) {
  const router = useRouter()
  const [erro, setErro] = useState<string | null>(null)
  const [indo, setIndo] = useState(false)
  async function rodar(f: () => ReturnType<typeof moverRestricaoAction>) {
    setIndo(true)
    setErro(null)
    try {
      const res = await f()
      if (!res.ok) return setErro(res.erro)
      router.refresh()
    } catch {
      setErro('Não deu certo. Confira a conexão e tente de novo.')
    } finally {
      setIndo(false)
    }
  }
  const mover = (s: SituacaoRestricao) => rodar(() => moverRestricaoAction(r.id, s))
  const volta = vizinha(r.situacao, -1)
  const avanca = vizinha(r.situacao, 1)
  return (
    <li className="flex flex-col gap-2 rounded-xl border border-[#dadad8] bg-white p-3 text-sm text-[#333336]">
      <span className="text-xs font-semibold text-[#00345e]">{r.atividade}</span>
      <span className="text-xs text-[#5a7380]">
        {rotuloTipo(r.tipo)} · {rotuloResponsavelRestricao(r.responsavel)}
      </span>
      <p>{r.descricao}</p>
      {r.prazo ? (
        <span className={`text-xs ${r.atrasada ? 'font-semibold text-[#b23232]' : 'text-[#5a7380]'}`}>
          Prazo {r.prazo.slice(8, 10)}/{r.prazo.slice(5, 7)}
          {r.atrasada ? ' · atrasada' : ''}
        </span>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {volta ? <button type="button" disabled={indo} className={btn} onClick={() => mover(volta)} aria-label="Voltar">← Voltar</button> : null}
        {avanca ? <button type="button" disabled={indo} className={btn} onClick={() => mover(avanca)} aria-label="Avançar">Avançar →</button> : null}
        {r.podeApagar ? (
          <button
            type="button"
            disabled={indo}
            className={btn}
            onClick={() => window.confirm('Apagar esta restrição?') && rodar(() => apagarRestricaoAction(r.id))}
          >
            Apagar
          </button>
        ) : null}
      </div>
      {erro ? <span role="alert" className="text-xs text-[#b23232]">{erro}</span> : null}
    </li>
  )
}

export default function Quadro({ colunas }: { colunas: Record<SituacaoRestricao, CartaoRestricao[]> }) {
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {SITUACOES.map((s) => (
        <section key={s.valor} aria-label={s.rotulo} className="flex flex-col gap-2 rounded-xl bg-[#f6f6f5] p-3">
          <h3 className="text-sm font-semibold text-[#00345e]">
            {s.rotulo} <span className="text-[#5a7380]">({colunas[s.valor].length})</span>
          </h3>
          <ul className="flex flex-col gap-2">
            {colunas[s.valor].map((r) => (
              <Cartao key={r.id} r={r} />
            ))}
          </ul>
          {colunas[s.valor].length === 0 ? <p className="text-xs text-[#5a7380]">Nenhuma restrição aqui.</p> : null}
        </section>
      ))}
    </div>
  )
}
