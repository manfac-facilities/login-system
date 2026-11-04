'use client'
import { useActionState, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { criarRevisaoAction } from '../_actions'
import { useVeiculoMotoristaCascade } from '@/lib/sofia/useVeiculoMotoristaCascade'
import { fmtKm } from '@/lib/sofia/correcoes'
import { intervaloDoVeiculo } from '@/lib/sofia/revisaoPrevisao'
import type { Veiculo, Motorista } from '@/lib/sofia/types'

type Modo = 'auto' | 'manual' | 'nao'
const CAMPO = 'px-3 py-2.5 rounded-lg bg-[#0f1f3d] border border-[#1e3a5f] text-white placeholder-[#4a6080] focus:outline-none focus:border-[#f05a28] text-sm'

export default function NovaRevisaoForm({
  veiculos,
  motoristas,
  medias,
  veiculoInicial,
  hoje,
}: {
  veiculos: Veiculo[]
  motoristas: Motorista[]
  /** média km/dia dos últimos 30 dias por veículo (null = sem lançamentos suficientes) */
  medias: Record<string, number | null>
  veiculoInicial: string
  hoje: string
}) {
  const [state, action, isPending] = useActionState(criarRevisaoAction, {})
  const router = useRouter()
  const { veiculoId, motoristaId, setMotoristaId, onVeiculoChange } = useVeiculoMotoristaCascade()
  const inicial = veiculos.find((v) => v.id === veiculoInicial)
  const [km, setKm] = useState(inicial ? String(inicial.km_atual) : '')
  const [tipo, setTipo] = useState('preventiva')
  const [modo, setModo] = useState<Modo>('auto')
  const [proxManual, setProxManual] = useState('')

  useEffect(() => {
    if (veiculoInicial) onVeiculoChange(veiculoInicial)
    // só na montagem: pré-seleção vinda de ?veiculo=
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (state.success) router.push('/sofia/revisoes')
  }, [state.success, router])

  const id = veiculoId || veiculoInicial
  const v = veiculos.find((x) => x.id === id)
  const intervalo = intervaloDoVeiculo((v ?? {}) as { intervalo_revisao_km?: number | null })
  const media = v ? medias[v.id] ?? null : null
  const kmNum = km.trim() === '' ? NaN : Number(km)

  let previa: React.ReactNode
  if (modo === 'nao') {
    previa = <>A próxima <b className="text-white">não será prevista</b>: o carro sai da lista de alertas por KM até uma nova revisão.</>
  } else {
    const pk = modo === 'manual' ? (proxManual.trim() === '' ? NaN : Number(proxManual)) : kmNum + intervalo
    if (Number.isNaN(pk)) previa = modo === 'manual' ? 'Informe o KM da próxima revisão.' : 'Informe o KM da revisão para ver a próxima.'
    else {
      previa = (
        <>
          Próxima revisão em <b className="text-white">{fmtKm(pk)} km</b>
          {v && media != null
            ? <> — o carro está em {fmtKm(v.km_atual)} km e roda ~{fmtKm(media)} km/dia, então chega em <b className="text-white">~{Math.max(0, Math.ceil((pk - v.km_atual) / media))} dias</b>.</>
            : '.'}
        </>
      )
    }
  }

  const radio = (m: Modo, titulo: string, sub: React.ReactNode, extra?: React.ReactNode) => (
    <label className={`flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2.5 ${modo === m ? 'border-[#f05a28] bg-[#0d2050]' : 'border-[#1e3a5f]'}`}>
      <input type="radio" name="modo_proxima" value={m} checked={modo === m} onChange={() => setModo(m)} className="mt-1" />
      <span className="min-w-0 text-sm">
        <b className="text-white">{titulo}</b>{extra}
        {sub && <span className="block text-xs text-[#4a6080]">{sub}</span>}
      </span>
    </label>
  )

  return (
    <div className="p-4 sm:p-8 max-w-md">
      <h1 className="text-2xl font-bold text-white mb-2">Registrar Revisão</h1>
      <p className="text-[#4a6080] text-sm mb-8">Manutenção preventiva ou corretiva</p>

      <form action={action} className="flex flex-col gap-4">
        {state.error && (
          <div className="px-4 py-3 rounded-lg border border-red-600 bg-red-950 text-red-300 text-sm">
            {state.error}
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <label className="text-sm text-[#94a3b8]">Veículo *</label>
          <select
            name="veiculo_id"
            required
            defaultValue={veiculoInicial}
            onChange={(e) => {
              onVeiculoChange(e.target.value)
              const novo = veiculos.find((x) => x.id === e.target.value)
              if (novo) setKm(String(novo.km_atual))
            }}
            className={CAMPO}
          >
            <option value="">Selecione</option>
            {veiculos.map((x) => (
              <option key={x.id} value={x.id}>{x.placa} · {x.modelo}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm text-[#94a3b8]">Motorista responsável</label>
          <select name="motorista_id" value={motoristaId} onChange={(e) => setMotoristaId(e.target.value)} className={CAMPO}>
            <option value="">Selecione ou auto-preenchido</option>
            {motoristas.map((m) => (
              <option key={m.id} value={m.id}>{m.nome}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm text-[#94a3b8]">Tipo *</label>
          <select
            name="tipo"
            required
            value={tipo}
            onChange={(e) => {
              setTipo(e.target.value)
              if (e.target.value === 'corretiva') setModo('nao')
            }}
            className={CAMPO}
          >
            <option value="preventiva">Preventiva</option>
            <option value="corretiva">Corretiva</option>
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm text-[#94a3b8]">Fornecedor</label>
          <input name="fornecedor" placeholder="Nome da oficina/fornecedor" className={CAMPO} />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm text-[#94a3b8]">Valor (R$)</label>
          <input name="valor" type="number" step="0.01" placeholder="0.00" className={CAMPO} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm text-[#94a3b8]">Data realizada</label>
            <input name="data_realizada" type="date" defaultValue={hoje} max={hoje} className={`${CAMPO} [color-scheme:dark]`} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm text-[#94a3b8]">KM realizada *</label>
            <input name="km_realizada" type="number" min={0} required value={km} onChange={(e) => setKm(e.target.value)} placeholder="0" className={CAMPO} />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm text-[#94a3b8]">Próxima data prevista</label>
          <input name="proxima_data" type="date" disabled={modo === 'nao'} className={`${CAMPO} [color-scheme:dark] disabled:opacity-40`} />
        </div>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1.5 text-sm text-[#94a3b8]">Próxima revisão (KM)</legend>
          {radio('auto', 'Calcular sozinha', `KM realizada + intervalo do carro (${fmtKm(intervalo)})`)}
          {radio('manual', 'Informar à mão', null,
            <input
              name="proxima_km"
              type="number"
              min={0}
              value={proxManual}
              onChange={(e) => { setProxManual(e.target.value); setModo('manual') }}
              placeholder="KM"
              className={`${CAMPO} ml-2 inline-block w-32 py-1.5`}
            />
          )}
          {radio('nao', 'Não prever a próxima', 'Use após uma corretiva (ex.: embreagem).')}
          <p className="rounded-lg border border-[#1e3a5f] bg-[#0d2050] px-3 py-2 text-sm text-[#94a3b8]">{previa}</p>
        </fieldset>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm text-[#94a3b8]">Peças trocadas</label>
          <textarea name="pecas_trocadas" rows={4} placeholder="Ex.: óleo 5W30 (4 litros), filtro de óleo, filtro de ar" className={`${CAMPO} resize-none`} />
          <span className="text-xs text-[#4a6080]">Opcional. Escreva do jeito que vier na nota da oficina, uma peça por linha.</span>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm text-[#94a3b8]">Observações</label>
          <textarea name="observacoes" rows={2} className={`${CAMPO} resize-none`} />
        </div>

        <div className="flex gap-3 mt-2">
          <button type="button" onClick={() => router.back()} className="flex-1 py-2.5 rounded-lg border border-[#1e3a5f] text-[#94a3b8] text-sm hover:border-[#94a3b8] active:scale-95 transition-[border-color,transform]">
            Cancelar
          </button>
          <button type="submit" disabled={isPending} className="flex-1 py-2.5 rounded-lg bg-[#f05a28] text-white text-sm font-medium hover:bg-[#d94e22] disabled:opacity-50 transition-colors active:scale-95">
            {isPending ? 'Salvando...' : 'Registrar Revisão'}
          </button>
        </div>
      </form>
    </div>
  )
}
