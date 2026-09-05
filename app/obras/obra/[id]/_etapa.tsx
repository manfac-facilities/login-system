'use client'

/**
 * Troca de etapa manual — decisão técnica 6 da spec.
 *
 * A lacuna mais grave do mockup: nenhuma função muda `etapa` entre
 * `levantamento`, `andamento` e `paralisado`, e as etapas pós-campo dependem de
 * marcos que a integração com o Field ainda não devolve. Sem este seletor o
 * quadro trava no primeiro dia de uso real.
 *
 * Confirmação em dois passos de propósito: mudar de etapa reposiciona a obra no
 * Kanban e zera o contador de "parada há N dias". Não é coisa para acontecer
 * por esbarrão no `select` do celular.
 */

import { useState, useTransition } from 'react'
import { Botao } from '../../_ui/primitivos'
import { CICLO, nomeEtapa, type Etapa } from '../../_lib/tipos'
import { mudarEtapaAction } from './_actions'

export default function SeletorEtapa({
  obraId,
  etapa,
}: {
  obraId: string
  etapa: Etapa
}) {
  const [escolhida, setEscolhida] = useState<string>(etapa)
  const [erro, setErro] = useState<string | null>(null)
  const [ok, setOk] = useState(false)
  const [pendente, iniciar] = useTransition()

  const mudou = escolhida !== etapa

  function salvar() {
    setErro(null)
    setOk(false)
    iniciar(async () => {
      const r = await mudarEtapaAction(obraId, escolhida)
      if (r.error) setErro(r.error)
      else setOk(true)
    })
  }

  return (
    <div className="flex flex-col gap-2 border-t border-[#1e3a5f] px-4 py-3">
      <label className="text-[11px] uppercase tracking-wide text-[#94a3b8]" htmlFor="troca-etapa">
        Mudar a etapa desta obra
      </label>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <select
          id="troca-etapa"
          value={escolhida}
          disabled={pendente}
          onChange={(e) => {
            setEscolhida(e.target.value)
            setOk(false)
            setErro(null)
          }}
          className="w-full rounded-md border border-[#1e3a5f] bg-[#0a1628] px-2 py-2 text-sm text-[#e8eef7] outline-none focus:border-[#f05a28] sm:w-auto sm:min-w-[240px]"
        >
          {CICLO.map((c) => (
            <option key={c.k} value={c.k}>
              {c.nome}
            </option>
          ))}
        </select>
        <Botao type="button" onClick={salvar} disabled={!mudou || pendente}>
          {pendente ? 'Salvando…' : 'Confirmar mudança'}
        </Botao>
      </div>
      <p className="text-[11px] leading-relaxed text-[#64748b]">
        {mudou
          ? `A obra passa de "${nomeEtapa(etapa)}" para "${nomeEtapa(escolhida as Etapa)}" e o contador de dias parada nesta etapa recomeça hoje.`
          : 'Qualquer pessoa com acesso ao Controle de Obras pode mudar a etapa. Fica registrado quem mudou e quando.'}
      </p>
      {erro ? <p className="text-xs font-semibold text-[#ff4d6d]">{erro}</p> : null}
      {ok ? <p className="text-xs font-semibold text-[#35c98a]">Etapa atualizada.</p> : null}
    </div>
  )
}
