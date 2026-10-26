'use client'
import { useActionState, useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { corrigirKmAction } from './_actions'
import Dialogo, { Consequencias } from '@/components/sofia/Dialogo'
import { erroCorrecaoKm, kmVeiculoDepois, fmtKm, dataBR, diaMes, type ContextoKm } from '@/lib/sofia/correcoes'

export interface LancamentoParaCorrigir {
  id: string
  data: string
  km_atual: number
  equipe: string
  placa: string
  motorista: string | null
}

interface Props {
  lancamento: LancamentoParaCorrigir
  contexto: ContextoKm
  /** veiculos.km_atual hoje (null se o veículo não veio na lista) */
  kmVeiculoAtual: number | null
}

export default function CorrigirKmButton(props: Props) {
  const [aberto, setAberto] = useState(false)
  const [vez, setVez] = useState(0)
  const fechar = useCallback(() => setAberto(false), [])
  return (
    <>
      <button
        type="button"
        onClick={() => { setVez((v) => v + 1); setAberto(true) }}
        className="text-xs text-[#f05a28] hover:underline active:scale-95 transition-transform"
      >
        Corrigir
      </button>
      {/* key: cada abertura começa limpa (sem erro/valor da vez anterior) */}
      {aberto && <DialogoCorrigirKm key={vez} {...props} onFechar={fechar} />}
    </>
  )
}

function DialogoCorrigirKm({ lancamento: k, contexto, kmVeiculoAtual, onFechar }: Props & { onFechar: () => void }) {
  const router = useRouter()
  const [state, formAction, isPending] = useActionState(corrigirKmAction, {})
  const [valor, setValor] = useState(String(k.km_atual))
  const [motivo, setMotivo] = useState('')

  useEffect(() => {
    if (state.success && state.placa != null && state.kmVeiculo != null) {
      const q = new URLSearchParams({ corrigido: state.placa, km: String(state.kmVeiculo) })
      if (state.aviso) q.set('aviso', state.aviso)
      onFechar()
      router.push(`/sofia/km?${q.toString()}`)
    }
  }, [state, onFechar, router])

  const erro = erroCorrecaoKm(contexto, k.km_atual, valor)
  const novo = Number(valor)
  const atualA = kmVeiculoAtual ?? k.km_atual
  const atualB = erro ? null : kmVeiculoDepois(contexto, novo)

  const { anterior: ant, seguinte: prox } = contexto

  return (
    <Dialogo
      titulo="Corrigir lançamento de KM"
      subtitulo={
        <>
          {k.equipe} · <span className="font-mono">{k.placa}</span> · {dataBR(k.data)}
          {k.motorista ? ` · ${k.motorista}` : ''}
        </>
      }
      onFechar={onFechar}
    >
      <form action={formAction} className="flex flex-col gap-3">
        <input type="hidden" name="id" value={k.id} />
        {state.error && (
          <div className="px-3 py-2 rounded-lg border border-red-600 bg-red-950 text-red-300 text-sm">{state.error}</div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm text-[#94a3b8]">KM lançado</label>
            <input
              disabled
              value={`${fmtKm(k.km_atual)} km`}
              className="px-3 py-2.5 rounded-lg bg-[#0f1f3d] border border-[#1e3a5f] text-white text-sm opacity-70"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm text-[#94a3b8]">KM correto *</label>
            <input
              name="km_novo"
              type="number"
              step="1"
              autoFocus
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              className={`px-3 py-2.5 rounded-lg bg-[#0f1f3d] border text-white text-sm focus:outline-none focus:border-[#f05a28] ${
                erro && valor !== '' && novo !== k.km_atual ? 'border-red-600' : 'border-[#1e3a5f]'
              }`}
            />
          </div>
        </div>
        <p className="text-[#4a6080] text-xs">
          Precisa ficar entre {ant ? `${fmtKm(ant.km)} km (lançamento de ${diaMes(ant.data)})` : '0'} e{' '}
          {prox
            ? `${fmtKm(prox.km)} km (lançamento de ${diaMes(prox.data)})`
            : 'qualquer valor maior (não há lançamento depois deste)'}
          .
        </p>
        {erro && <p className="text-red-400 text-xs">{erro}</p>}

        <div className="flex flex-col gap-1.5">
          <label className="text-sm text-[#94a3b8]">Motivo (opcional)</label>
          <input
            name="motivo"
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Ex.: digitou 9 no lugar de 8"
            className="px-3 py-2.5 rounded-lg bg-[#0f1f3d] border border-[#1e3a5f] text-white placeholder-[#4a6080] text-sm focus:outline-none focus:border-[#f05a28]"
          />
        </div>

        <Consequencias titulo="O que acontece ao salvar">
          {erro || atualB == null ? (
            <p className="text-[#4a6080]">Corrija o valor para ver as consequências.</p>
          ) : (
            <ul className="list-disc pl-5 flex flex-col gap-1">
              <li>
                Lançamento de {diaMes(k.data)}: <s>{fmtKm(k.km_atual)} km</s> → <b className="text-white">{fmtKm(novo)} km</b>
              </li>
              <li>
                KM atual do veículo {k.placa}:{' '}
                {atualB !== atualA ? (
                  <>
                    <s>{fmtKm(atualA)} km</s> → <b className="text-white">{fmtKm(atualB)} km</b>
                  </>
                ) : (
                  <>
                    continua <b className="text-white">{fmtKm(atualA)} km</b>
                  </>
                )}
              </li>
              <li>Os próximos lançamentos passam a ser comparados com {fmtKm(atualB)} km.</li>
              <li>
                O valor anterior ({fmtKm(k.km_atual)} km) fica no histórico de correções, com seu nome, a data e a hora.
              </li>
            </ul>
          )}
        </Consequencias>

        <div className="flex gap-3 mt-2">
          <button
            type="button"
            onClick={onFechar}
            className="flex-1 py-2.5 rounded-lg border border-[#1e3a5f] text-[#94a3b8] text-sm hover:border-[#94a3b8]"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={!!erro || isPending}
            className="flex-1 py-2.5 rounded-lg bg-[#f05a28] text-white text-sm font-medium hover:bg-[#d94e22] disabled:opacity-50"
          >
            {isPending ? 'Salvando...' : 'Salvar correção'}
          </button>
        </div>
      </form>
    </Dialogo>
  )
}
