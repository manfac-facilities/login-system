'use client'
import { useActionState, useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { corrigirAbastecimentoAction } from './_actions'
import Dialogo, { Consequencias } from '@/components/sofia/Dialogo'
import {
  validarCorrecaoAbastecimento,
  fmtKm,
  fmtLitros,
  fmtBrl,
  dataBR,
  diaMes,
  type ContextoAbastecimento,
} from '@/lib/sofia/correcoes'

export interface AbastecimentoParaCorrigir {
  id: string
  data: string
  placa: string
  posto: string | null
  litros: number | null
  valor: number
  km: number | null
}

interface Props {
  abastecimento: AbastecimentoParaCorrigir
  contexto: ContextoAbastecimento
}

export default function CorrigirAbastecimentoButton(props: Props) {
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
      {aberto && <DialogoCorrigirAbastecimento key={vez} {...props} onFechar={fechar} />}
    </>
  )
}

function DialogoCorrigirAbastecimento({
  abastecimento: a,
  contexto: ctx,
  onFechar,
}: Props & { onFechar: () => void }) {
  const router = useRouter()
  const [state, formAction, isPending] = useActionState(corrigirAbastecimentoAction, {})
  const litrosLanc = a.litros == null ? null : Number(a.litros)
  const valorLanc = Number(a.valor)
  const kmLanc = a.km == null ? null : Number(a.km)
  const [litros, setLitros] = useState(litrosLanc == null ? '' : String(litrosLanc))
  const [valor, setValor] = useState(valorLanc.toFixed(2))
  const [km, setKm] = useState(kmLanc == null ? '' : String(kmLanc))
  const [motivo, setMotivo] = useState('')

  useEffect(() => {
    if (state.success) {
      onFechar()
      router.push('/sofia/abastecimento?corrigido=1')
    }
  }, [state, onFechar, router])

  const r = validarCorrecaoAbastecimento(ctx, { litros: litrosLanc, valor: valorLanc, km: kmLanc }, { litros, valor, km })
  const erro = 'erro' in r ? r.erro : null

  const { anterior: ant, seguinte: prox } = ctx
  const hoje = new Date()
  const mesCorrente = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`
  const rotuloConsumo =
    ctx.mes === mesCorrente
      ? `Consumo do mês do ${a.placa}`
      : `Consumo de ${ctx.mes.slice(5, 7)}/${ctx.mes.slice(0, 4)} do ${a.placa}`

  return (
    <Dialogo
      titulo="Corrigir abastecimento"
      subtitulo={
        <>
          <span className="font-mono">{a.placa}</span> · {dataBR(a.data)}
          {a.posto ? ` · ${a.posto}` : ''}
        </>
      }
      onFechar={onFechar}
    >
      <form action={formAction} className="flex flex-col gap-3">
        <input type="hidden" name="id" value={a.id} />
        {state.error && (
          <div className="px-3 py-2 rounded-lg border border-red-600 bg-red-950 text-red-300 text-sm">{state.error}</div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm text-[#94a3b8]">Litros *</label>
            <input
              name="litros"
              type="number"
              step="0.1"
              autoFocus
              value={litros}
              onChange={(e) => setLitros(e.target.value)}
              className="px-3 py-2.5 rounded-lg bg-[#0f1f3d] border border-[#1e3a5f] text-white text-sm focus:outline-none focus:border-[#f05a28]"
            />
            <span className="text-[#4a6080] text-xs">Lançado: {litrosLanc == null ? '—' : fmtLitros(litrosLanc)}</span>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm text-[#94a3b8]">Valor (R$) *</label>
            <input
              name="valor"
              type="number"
              step="0.01"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              className="px-3 py-2.5 rounded-lg bg-[#0f1f3d] border border-[#1e3a5f] text-white text-sm focus:outline-none focus:border-[#f05a28]"
            />
            <span className="text-[#4a6080] text-xs">Lançado: {fmtBrl(valorLanc)}</span>
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm text-[#94a3b8]">KM no momento</label>
          <input
            name="km"
            type="number"
            step="1"
            value={km}
            onChange={(e) => setKm(e.target.value)}
            className="px-3 py-2.5 rounded-lg bg-[#0f1f3d] border border-[#1e3a5f] text-white text-sm focus:outline-none focus:border-[#f05a28]"
          />
          <span className="text-[#4a6080] text-xs">
            Lançado: {kmLanc == null ? '—' : `${fmtKm(kmLanc)} km`}. Precisa ficar entre{' '}
            {ant ? `${fmtKm(ant.km)} km (abastecimento de ${diaMes(ant.data)})` : '0'} e{' '}
            {prox ? `${fmtKm(prox.km)} km (abastecimento de ${diaMes(prox.data)})` : 'qualquer valor maior'}.
          </span>
        </div>
        {erro && <p className="text-red-400 text-xs">{erro}</p>}

        <div className="flex flex-col gap-1.5">
          <label className="text-sm text-[#94a3b8]">Motivo (opcional)</label>
          <input
            name="motivo"
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Ex.: vírgula no lugar errado"
            className="px-3 py-2.5 rounded-lg bg-[#0f1f3d] border border-[#1e3a5f] text-white placeholder-[#4a6080] text-sm focus:outline-none focus:border-[#f05a28]"
          />
        </div>

        <Consequencias titulo="O que acontece ao salvar">
          {'erro' in r ? (
            <p className="text-[#4a6080]">Corrija os valores para ver as consequências.</p>
          ) : (
            (() => {
              const { litros: L, valor: V, km: K } = r.valores
              const mudouL = L !== (litrosLanc == null ? null : Math.round(litrosLanc * 100) / 100)
              const mudouV = V !== Math.round(valorLanc * 100) / 100
              const mudouK = K !== kmLanc
              const litrosMesDepois = ctx.mesLitros - (litrosLanc ?? 0) + L
              const valorMesDepois = ctx.mesValor - valorLanc + V
              return (
                <ul className="list-disc pl-5 flex flex-col gap-1">
                  {mudouL && (
                    <li>
                      Litros: <s>{litrosLanc == null ? '—' : fmtLitros(litrosLanc)}</s> →{' '}
                      <b className="text-white">{fmtLitros(L)}</b>
                    </li>
                  )}
                  {mudouV && (
                    <li>
                      Valor: <s>{fmtBrl(valorLanc)}</s> → <b className="text-white">{fmtBrl(V)}</b>
                    </li>
                  )}
                  {mudouK && (
                    <li>
                      KM: <s>{kmLanc == null ? '—' : fmtKm(kmLanc)}</s> →{' '}
                      <b className="text-white">{K == null ? '—' : fmtKm(K)}</b>
                    </li>
                  )}
                  {(mudouL || mudouV) && (
                    <li>
                      {rotuloConsumo}:{' '}
                      {mudouL ? (
                        <>
                          <s>{fmtLitros(ctx.mesLitros)} L</s> → <b className="text-white">{fmtLitros(litrosMesDepois)} L</b>
                        </>
                      ) : (
                        <>{fmtLitros(litrosMesDepois)} L</>
                      )}
                      {mudouV && (
                        <>
                          {' · '}
                          <s>{fmtBrl(ctx.mesValor)}</s> → <b className="text-white">{fmtBrl(valorMesDepois)}</b>
                        </>
                      )}
                    </li>
                  )}
                  <li>
                    O KM atual do veículo <b className="text-white">não muda</b>: quem define o KM atual é o KM diário.
                  </li>
                  <li>Os valores anteriores ficam no histórico de correções, com seu nome, a data e a hora.</li>
                </ul>
              )
            })()
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
