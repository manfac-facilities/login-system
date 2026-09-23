'use client'

/**
 * "corrigir data" do passo Fechar OS concluído (ajuste 2 de 23/09,
 * spec-ajustes-ficha-2026-09-23.md §5.7). Edição inline, sem janela (mockup).
 *
 * A action entra por prop, padrão da ficha: o tipo é declarado AQUI, não
 * importado de `_actions.ts` (arquivo `'use server'` não exporta tipo).
 * A validação é a mesma função pura da action; quem recusa de verdade é
 * `corrigirDataFechamentoAction`.
 */

import { useState, useTransition } from 'react'
import { br } from '../../_lib/tipos'
import { validarDataFechamentoOS } from '../../_lib/ficha-campos'
import { ERRO_DE_REDE } from './_bloco-editavel'

export type CorrigirDataFechamento = (
  obraId: string,
  data: string
) => Promise<{ error?: string; success?: boolean }>

export default function CorrigirFechamento({
  obraId,
  data,
  hoje,
  referencia,
  corrigir,
}: {
  obraId: string
  /** `marco_fechou_os` gravado, `AAAA-MM-DD`. */
  data: string
  hoje: string
  referencia: { relatorio: string | null; aprovacao: string | null }
  corrigir: CorrigirDataFechamento
}) {
  const [aberto, setAberto] = useState(false)
  const [valor, setValor] = useState(data)
  const [erro, setErro] = useState<string | null>(null)
  const [corrigido, setCorrigido] = useState<{ de: string; para: string } | null>(null)
  const [salvando, iniciar] = useTransition()

  const atual = corrigido?.para ?? data
  const erroData = validarDataFechamentoOS(valor, { hoje, ...referencia })

  function salvar() {
    setErro(null)
    iniciar(async () => {
      try {
        const r = await corrigir(obraId, valor)
        if (r?.error) {
          setErro(r.error)
          return
        }
        setCorrigido({ de: atual, para: valor })
        setAberto(false)
      } catch {
        setErro(ERRO_DE_REDE)
      }
    })
  }

  if (!aberto) {
    return (
      <div className="text-[#94a3b8]">
        Fechada no sistema do cliente em <b className="text-[#e8eef7]">{br(atual)}</b>.{' '}
        <button
          type="button"
          className="text-[#f05a28] underline underline-offset-2 hover:text-[#d94d20]"
          onClick={() => {
            setValor(atual)
            setErro(null)
            setCorrigido(null)
            setAberto(true)
          }}
        >
          corrigir data
        </button>
        {corrigido ? (
          <span className="mt-1 block text-[#35c98a]">
            Corrigido: de {br(corrigido.de)} para {br(corrigido.para)}. Fica no histórico.
          </span>
        ) : null}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[#94a3b8]" htmlFor={`corrigir-fechamento-${obraId}`}>
        Data de fechamento da OS
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <input
          id={`corrigir-fechamento-${obraId}`}
          type="date"
          value={valor}
          max={hoje}
          disabled={salvando}
          aria-invalid={erroData ? true : undefined}
          onChange={(e) => {
            setValor(e.target.value)
            setErro(null)
          }}
          className={`rounded-md border bg-[#0a1628] px-2 py-1.5 text-sm text-[#e8eef7] outline-none focus:border-[#f05a28] ${erroData ? 'border-[#ff4d6d]' : 'border-[#1e3a5f]'}`}
        />
        <button
          type="button"
          disabled={salvando || !!erroData}
          onClick={salvar}
          className="rounded-md bg-[#f05a28] px-2.5 py-1.5 text-xs font-medium text-white hover:bg-[#d94d20] disabled:cursor-not-allowed disabled:opacity-45"
        >
          {salvando ? 'Salvando…' : 'Salvar correção'}
        </button>
        <button
          type="button"
          disabled={salvando}
          onClick={() => {
            setAberto(false)
            setErro(null)
          }}
          className="rounded-md border border-[#1e3a5f] px-2.5 py-1.5 text-xs text-[#e8eef7] hover:bg-[#132a52] disabled:opacity-45"
        >
          Cancelar
        </button>
      </div>
      {erroData ? (
        <span role="alert" className="font-semibold text-[#ff4d6d]">
          {erroData}
        </span>
      ) : null}
      {erro ? (
        <div
          role="alert"
          className="rounded-md border border-[#ff4d6d66] bg-[#ff4d6d14] px-3 py-2 text-[12px] text-[#cbd5e1]"
        >
          {erro}
        </div>
      ) : null}
      <p className="text-[#64748b]">
        A correção entra no Histórico de alterações: quem corrigiu, quando, de{' '}
        <b className="text-[#94a3b8]">{br(atual)}</b> para a nova data.
      </p>
    </div>
  )
}
