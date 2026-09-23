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
 *
 * DATA DE FECHAMENTO DA OS (ajuste 2 de 23/09, spec-ajustes-ficha §5.1/§5.5):
 * só na troca Fechar OS → Pendente faturamento aparece o campo, pré-preenchido
 * com hoje. A validação é a MESMA função do servidor (`validarDataFechamentoOS`);
 * a tela só avisa antes — quem recusa de verdade é `mudarEtapaAction`.
 */

import { useState, useTransition } from 'react'
import { Botao } from '../../_ui/primitivos'
import { CICLO, br, nomeEtapa, type Etapa } from '../../_lib/tipos'
import { validarDataFechamentoOS } from '../../_lib/ficha-campos'
import { mudarEtapaAction } from './_actions'

export default function SeletorEtapa({
  obraId,
  etapa,
  hoje,
  referenciaFechamento,
}: {
  obraId: string
  etapa: Etapa
  /** `AAAA-MM-DD` vindo do servidor — a tela não inventa "hoje". */
  hoje: string
  referenciaFechamento: { relatorio: string | null; aprovacao: string | null }
}) {
  const [escolhida, setEscolhida] = useState<string>(etapa)
  const [data, setData] = useState(hoje)
  const [erro, setErro] = useState<string | null>(null)
  /** A última troca COM data que falhou — é o que "Tentar de novo" reenvia. */
  const [falhou, setFalhou] = useState<{ etapa: string; data: string } | null>(null)
  const [ok, setOk] = useState<{ data?: string } | null>(null)
  const [pendente, iniciar] = useTransition()

  const mudou = escolhida !== etapa
  const comData = etapa === 'fecharOS' && escolhida === 'pendFat'
  const erroData = comData
    ? validarDataFechamentoOS(data, { hoje, ...referenciaFechamento })
    : undefined

  function enviar(alvo: string, dataFechamento?: string) {
    setErro(null)
    setFalhou(null)
    setOk(null)
    iniciar(async () => {
      const r =
        dataFechamento === undefined
          ? await mudarEtapaAction(obraId, alvo)
          : await mudarEtapaAction(obraId, alvo, dataFechamento)
      if (r.error) {
        setErro(r.error)
        if (dataFechamento !== undefined) setFalhou({ etapa: alvo, data: dataFechamento })
      } else setOk({ data: dataFechamento })
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
            setData(hoje)
            setOk(null)
            setErro(null)
            setFalhou(null)
          }}
          className="w-full rounded-md border border-[#1e3a5f] bg-[#0a1628] px-2 py-2 text-sm text-[#e8eef7] outline-none focus:border-[#f05a28] sm:w-auto sm:min-w-[240px]"
        >
          {CICLO.map((c) => (
            <option key={c.k} value={c.k}>
              {c.nome}
            </option>
          ))}
        </select>
        <Botao
          type="button"
          onClick={() => enviar(escolhida, comData ? data : undefined)}
          disabled={!mudou || pendente || !!erroData}
        >
          {pendente ? 'Salvando…' : 'Confirmar mudança'}
        </Botao>
        {pendente ? <span className="text-[11px] text-[#64748b]">Não feche a página.</span> : null}
      </div>

      {comData ? (
        <div className="flex flex-col gap-1">
          <label className="text-[11px] text-[#94a3b8]" htmlFor="data-fechamento-os">
            Data de fechamento da OS
          </label>
          <input
            id="data-fechamento-os"
            type="date"
            value={data}
            max={hoje}
            disabled={pendente}
            aria-invalid={erroData ? true : undefined}
            onChange={(e) => {
              setData(e.target.value)
              setErro(null)
              setFalhou(null)
            }}
            className={`w-full rounded-md border bg-[#0a1628] px-2 py-2 text-sm text-[#e8eef7] outline-none focus:border-[#f05a28] sm:w-auto sm:min-w-[240px] ${erroData ? 'border-[#ff4d6d]' : 'border-[#1e3a5f]'}`}
          />
          {erroData ? (
            <span role="alert" className="text-[11px] font-semibold text-[#ff4d6d]">
              {erroData}
            </span>
          ) : null}
          <span className="text-[11px] text-[#64748b]">
            Vem preenchida com hoje. Edite se a OS foi fechada no sistema do cliente em outro dia. É
            essa data que inicia os dias esperando o faturamento.
          </span>
        </div>
      ) : null}

      <p className="text-[11px] leading-relaxed text-[#64748b]">
        {mudou
          ? `A obra passa de "${nomeEtapa(etapa)}" para "${nomeEtapa(escolhida as Etapa)}" e o contador de dias parada nesta etapa ${comData && data ? `começa em ${br(data)}` : 'recomeça hoje'}.`
          : 'Qualquer pessoa com acesso ao Controle de Obras pode mudar a etapa. Fica registrado quem mudou e quando.'}
      </p>

      {falhou ? (
        <div
          role="alert"
          className="rounded-md border border-[#ff4d6d66] bg-[#ff4d6d14] px-3 py-2 text-[12px] leading-relaxed text-[#cbd5e1]"
        >
          <strong className="block text-[#ff4d6d]">Não concluiu &quot;Fechar OS&quot;</strong>
          <span>{erro}</span>
          <div className="mt-2">
            <Botao
              type="button"
              tipo="secundario"
              disabled={pendente}
              onClick={() => enviar(falhou.etapa, falhou.data)}
            >
              Tentar de novo
            </Botao>
          </div>
        </div>
      ) : erro ? (
        <p className="text-xs font-semibold text-[#ff4d6d]">{erro}</p>
      ) : null}

      {ok?.data ? (
        <p className="rounded-md border border-[#35c98a66] bg-[#35c98a14] px-3 py-2 text-xs text-[#35c98a]">
          ✓ Etapa atualizada para &quot;{nomeEtapa('pendFat')}&quot;, com o fechamento da OS gravado
          em <b>{br(ok.data)}</b>.
        </p>
      ) : ok ? (
        <p className="text-xs font-semibold text-[#35c98a]">Etapa atualizada.</p>
      ) : null}
    </div>
  )
}
