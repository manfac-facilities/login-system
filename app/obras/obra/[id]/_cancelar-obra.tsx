'use client'

/**
 * Cancelar obra — a faixa e a janela (spec-cancelamento-obra-2026-09-23 §6.1,
 * mockup aprovado em 23/09, seções 1 e 2).
 *
 * ESTADOS NA FAIXA, NÃO NA JANELA (divergência 1 da spec, §10): o `Dialogo` do
 * módulo fecha ao clicar em qualquer botão e só depois roda o `onClick`. Por
 * isso "Cancelando…" e o erro com "Tentar de novo" aparecem aqui na faixa, e o
 * sucesso é a própria ficha re-renderizando já cancelada (a action revalida).
 *
 * A escolha e a observação ficam no estado DESTE componente, não da janela: é o
 * que o "Tentar de novo" reenvia ("Sua escolha foi mantida").
 *
 * A action entra por PROP (padrão da ficha): o tipo mínimo é declarado aqui,
 * nunca importado de `_actions.ts` (armadilha 1 de `.claude/rules/obras.md`).
 */

import { useState, useTransition } from 'react'
import Dialogo, { type BotaoDialogo } from '../../_ui/dialogo'
import { Botao } from '../../_ui/primitivos'

type CancelarObra = (
  obraId: string,
  dados: { por: string; obs?: string }
) => Promise<{ error?: string; success?: boolean }>

const TEXTO = {
  ficha: {
    titulo: 'Encerrar sem executar',
    texto: (
      <>
        O cliente desistiu, a Manfac não vai executar ou a OS foi aberta por engano? Cancele aqui.{' '}
        <b className="text-[#e8eef7]">Nada é apagado e dá para desfazer.</b>
      </>
    ),
  },
  triagem: {
    titulo: 'Esta OS não vai virar obra?',
    texto: (
      <>
        Aberta por engano no Field, duplicada, ou o cliente desistiu antes de começar. Cancele em vez de
        deixar parada em &quot;Aguardando definição&quot;.
      </>
    ),
  },
} as const

const OPCOES = [
  { v: 'cliente', t: 'Cancelado pelo Cliente', d: 'a DPSP desistiu ou suspendeu' },
  { v: 'manfac', t: 'Cancelado pela Manfac', d: 'não vamos executar, ou OS aberta por engano' },
] as const

export default function FaixaCancelar({
  obraId,
  loja,
  os,
  etapaNome,
  variante,
  cancelar,
}: {
  obraId: string
  loja: string | null
  os: string | null
  /** O nome de tela da etapa atual: é para onde o "Desfazer" devolve a obra. */
  etapaNome: string
  /** `obra.pcm`. Hoje só compõe o contexto; a janela não o exibe. */
  responsavel?: string | null
  variante: 'ficha' | 'triagem'
  cancelar: CancelarObra
}) {
  const [aberto, setAberto] = useState(false)
  const [escolha, setEscolha] = useState<string | null>(null)
  const [obs, setObs] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [pendente, iniciar] = useTransition()

  function enviar() {
    if (!escolha) return
    setErro(null)
    iniciar(async () => {
      const r = await cancelar(obraId, { por: escolha, obs })
      if (r.error) setErro(r.error)
    })
  }

  const botoes: BotaoDialogo[] = [
    { id: 'd-cancelar-voltar', texto: 'Voltar sem cancelar', ghost: true },
    { id: 'd-cancelar-confirmar', texto: 'Cancelar obra', desabilitado: !escolha, onClick: enviar },
  ]

  const { titulo, texto } = TEXTO[variante]

  return (
    <div className="border-t border-[#1e3a5f] bg-[#ff4d6d0a] px-4 py-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-[220px] flex-1 text-[12px] text-[#94a3b8]">
          <span className="mb-0.5 block text-[11px] font-semibold uppercase tracking-wide text-[#64748b]">
            {titulo}
          </span>
          {texto}
        </div>
        <button
          id={`b-cancelar-obra-${variante}`}
          type="button"
          disabled={pendente}
          onClick={() => setAberto(true)}
          className="inline-flex items-center justify-center rounded-md border border-[#ff4d6d88] px-3 py-2 text-sm font-medium text-[#ff4d6d] transition hover:bg-[#ff4d6d14] disabled:cursor-not-allowed disabled:opacity-45"
        >
          {pendente ? 'Cancelando…' : 'Cancelar obra'}
        </button>
      </div>

      {erro && !pendente ? (
        <div
          role="alert"
          className="mt-3 rounded-md border border-[#ff4d6d66] bg-[#ff4d6d14] px-3 py-2 text-[12px] leading-relaxed text-[#cbd5e1]"
        >
          <strong className="block text-[#ff4d6d]">Não deu para cancelar.</strong>
          <span>{erro}</span> Sua escolha foi mantida: é só tentar de novo.
          <div className="mt-2">
            <Botao type="button" tipo="secundario" onClick={enviar}>
              Tentar de novo
            </Botao>
          </div>
        </div>
      ) : null}

      <Dialogo
        aberto={aberto}
        titulo={`Cancelar a obra ${loja ?? ''}`.trim()}
        botoes={botoes}
        onFechar={() => setAberto(false)}
      >
        <div className="flex flex-col gap-3">
          <p className="text-[12px] text-[#64748b]">
            OS {os ?? '—'} · hoje em &quot;{etapaNome}&quot;
          </p>

          <fieldset className="flex flex-col gap-1.5">
            <legend className="mb-1 text-[12px] font-semibold text-[#e8eef7]">
              Quem cancelou? <span className="text-[#ff4d6d]">*</span>
            </legend>
            {OPCOES.map((o) => (
              <label
                key={o.v}
                className={`flex cursor-pointer items-start gap-2.5 rounded-md border px-3 py-2.5 ${escolha === o.v ? 'border-[#f05a28] bg-[#f05a2814]' : 'border-[#1e3a5f]'}`}
              >
                <input
                  type="radio"
                  name={`quem-cancelou-${obraId}`}
                  value={o.v}
                  checked={escolha === o.v}
                  onChange={() => setEscolha(o.v)}
                  className="mt-1 h-4 w-4 accent-[#f05a28]"
                />
                <span>
                  <span className="text-[13px] font-medium text-[#e8eef7]">{o.t}</span>
                  <br />
                  <span className="text-[12px] text-[#94a3b8]">{o.d}</span>
                </span>
              </label>
            ))}
          </fieldset>

          <div className="flex flex-col gap-1">
            <label htmlFor={`obs-cancelar-${obraId}`} className="text-[12px] font-semibold text-[#e8eef7]">
              O que aconteceu <span className="font-normal text-[#64748b]">(opcional)</span>
            </label>
            <textarea
              id={`obs-cancelar-${obraId}`}
              value={obs}
              onChange={(e) => setObs(e.target.value)}
              placeholder="ex.: loja desistiu da reforma; OS duplicada no Field"
              rows={3}
              className="w-full rounded-md border border-[#1e3a5f] bg-[#0a1628] px-2 py-2 text-sm text-[#e8eef7] outline-none focus:border-[#f05a28]"
            />
          </div>

          <div className="rounded-md border border-[#1e3a5f] bg-[#00000033] px-3 py-2.5 text-[12.5px] text-[#94a3b8]">
            <b className="text-[#e8eef7]">O que acontece ao cancelar</b>
            <ul className="mt-1 flex list-disc flex-col gap-0.5 pl-[18px]">
              <li>A obra sai do diário do dia e das cobranças na hora.</li>
              <li>Nada é apagado: diário, fotos, tarefas e histórico continuam na ficha.</li>
              <li>Dá para desfazer na própria ficha, e ela volta para &quot;{etapaNome}&quot;.</li>
              <li>No Field nada muda: se a OS também foi cancelada lá, é outro passo.</li>
            </ul>
          </div>

          {!escolha ? (
            <p className="text-[12px] font-semibold text-[#ff4d6d]">Escolha quem cancelou para continuar.</p>
          ) : null}
        </div>
      </Dialogo>
    </div>
  )
}
