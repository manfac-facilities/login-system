'use client'
import { useActionState, useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { criarSinistroAction, uploadFotoSinistroAction } from '../_actions'
import CameraCapture from '@/components/sofia/CameraCapture'
import { createClient } from '@/lib/supabase/client'
import type { Veiculo, Motorista } from '@/lib/sofia/types'

interface CapturedPhoto {
  blob: Blob
  posicao: string
}

export default function NovoSinistroForm({
  veiculos,
  motoristas,
}: {
  veiculos: Veiculo[]
  motoristas: Motorista[]
}) {
  const [state, action, isPending] = useActionState(criarSinistroAction, {})
  const router = useRouter()
  const [fotos, setFotos] = useState<CapturedPhoto[]>([])
  const [uploadFinished, setUploadFinished] = useState(false)
  const [failedFotos, setFailedFotos] = useState<string[]>([])
  const [veiculoId, setVeiculoId] = useState('')
  const [motoristaId, setMotoristaId] = useState('')
  const uploading = !!state.success && fotos.length > 0 && !uploadFinished
  // True the instant the form is submitted, before isPending (set by
  // useActionState) or uploading (derived below) flip on. Without this,
  // there's a window after the create-sinistro action resolves and before
  // the upload effect/redirect runs where a fast double-click could submit
  // a second, duplicate sinistro row. Cleared as soon as the action reports
  // an error (computed at render time, not in an effect) so the user can retry.
  const [submitting, setSubmitting] = useState(false)
  if (submitting && state.error) setSubmitting(false)
  const formInFlight = submitting || isPending || uploading

  const handleCapture = useCallback((blob: Blob, posicao: string) => {
    setFotos((prev) => [...prev.filter((f) => f.posicao !== posicao), { blob, posicao }])
  }, [])

  async function handleVeiculoChange(id: string) {
    setVeiculoId(id)
    if (!id) { setMotoristaId(''); return }
    const res = await fetch(`/api/sofia/veiculo-motorista?veiculo_id=${id}`)
    const data = await res.json()
    if (data?.motoristas?.id) setMotoristaId(data.motoristas.id)
  }

  async function handleMotoristaChange(id: string) {
    setMotoristaId(id)
    if (!id) return
    const res = await fetch(`/api/sofia/veiculo-motorista?motorista_id=${id}`)
    const data = await res.json()
    if (data?.veiculo?.id) setVeiculoId(data.veiculo.id)
  }

  useEffect(() => {
    if (!state.success || !state.sinistroId) return
    if (fotos.length === 0) {
      router.push('/sofia/sinistros')
      return
    }
    const supabase = createClient()
    Promise.all(
      fotos.map(async (foto, i) => {
        const path = `sinistros/${state.sinistroId}/${i}-${Date.now()}.jpg`
        const { error: uploadError } = await supabase.storage
          .from('sofia-anexos')
          .upload(path, foto.blob, { contentType: 'image/jpeg' })
        if (uploadError) return { posicao: foto.posicao, ok: false as const }

        try {
          await uploadFotoSinistroAction(state.sinistroId!, path)
        } catch {
          return { posicao: foto.posicao, ok: false as const }
        }
        return { posicao: foto.posicao, ok: true as const }
      })
    ).then((results) => {
      setUploadFinished(true)
      const failed = results.filter((r) => !r.ok).map((r) => r.posicao)
      if (failed.length > 0) {
        setFailedFotos(failed)
        setSubmitting(false)
        return
      }
      router.push('/sofia/sinistros')
    })
  }, [state.success, state.sinistroId, fotos, router])

  return (
    <div className="p-8 max-w-2xl">
      <h1 className="text-2xl font-bold text-white mb-2">Registrar Sinistro</h1>
      <p className="text-[#4a6080] text-sm mb-8">Batida, furto ou avaria — com fotos do dano</p>

      <form action={action} onSubmit={() => setSubmitting(true)} className="flex flex-col gap-4">
        {state.error && (
          <div className="px-4 py-3 rounded-lg border border-red-600 bg-red-950 text-red-300 text-sm">
            {state.error}
          </div>
        )}

        {failedFotos.length > 0 && (
          <div className="px-4 py-3 rounded-lg border border-red-600 bg-red-950 text-red-300 text-sm">
            Sinistro salvo, mas {failedFotos.length} foto
            {failedFotos.length > 1 ? 's' : ''} não {failedFotos.length > 1 ? 'foram salvas' : 'foi salva'}.
            Tente novamente ou contate o suporte.
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm text-[#94a3b8]">Veículo</label>
            <select
              name="veiculo_id"
              value={veiculoId}
              onChange={(e) => handleVeiculoChange(e.target.value)}
              className="px-3 py-2.5 rounded-lg bg-[#0f1f3d] border border-[#1e3a5f] text-white focus:outline-none focus:border-[#f05a28] text-sm"
            >
              <option value="">Selecione</option>
              {veiculos.map((v) => (
                <option key={v.id} value={v.id}>{v.placa} · {v.modelo}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm text-[#94a3b8]">Motorista</label>
            <select
              name="motorista_id"
              value={motoristaId}
              onChange={(e) => handleMotoristaChange(e.target.value)}
              className="px-3 py-2.5 rounded-lg bg-[#0f1f3d] border border-[#1e3a5f] text-white focus:outline-none focus:border-[#f05a28] text-sm"
            >
              <option value="">Selecione</option>
              {motoristas.map((m) => (
                <option key={m.id} value={m.id}>{m.nome}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm text-[#94a3b8]">Data *</label>
            <input name="data" type="date" required className="px-3 py-2.5 rounded-lg bg-[#0f1f3d] border border-[#1e3a5f] text-white focus:outline-none focus:border-[#f05a28] text-sm [color-scheme:dark]" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm text-[#94a3b8]">Tipo *</label>
            <select name="tipo" required defaultValue="avaria" className="px-3 py-2.5 rounded-lg bg-[#0f1f3d] border border-[#1e3a5f] text-white focus:outline-none focus:border-[#f05a28] text-sm">
              <option value="colisao">Colisão</option>
              <option value="furto">Furto</option>
              <option value="avaria">Avaria</option>
              <option value="outro">Outro</option>
            </select>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm text-[#94a3b8]">Descrição *</label>
          <textarea name="descricao" required rows={3} placeholder="O que aconteceu" className="px-3 py-2.5 rounded-lg bg-[#0f1f3d] border border-[#1e3a5f] text-white placeholder-[#4a6080] focus:outline-none focus:border-[#f05a28] text-sm resize-none" />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm text-[#94a3b8]">Valor estimado do dano (R$)</label>
          <input name="valor_dano" type="number" step="0.01" placeholder="0.00" className="px-3 py-2.5 rounded-lg bg-[#0f1f3d] border border-[#1e3a5f] text-white placeholder-[#4a6080] focus:outline-none focus:border-[#f05a28] text-sm" />
        </div>

        <div>
          <p className="text-sm text-[#94a3b8] mb-3">Fotos do dano <span className="text-[#4a6080]">(câmera ao vivo)</span></p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <CameraCapture posicao="Dano 1" onCapture={handleCapture} />
            <CameraCapture posicao="Dano 2" onCapture={handleCapture} />
          </div>
          {fotos.length > 0 && (
            <p className="text-xs text-green-400 mt-2">{fotos.length} foto{fotos.length > 1 ? 's' : ''} capturada{fotos.length > 1 ? 's' : ''}</p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm text-[#94a3b8]">Observações</label>
          <textarea name="observacoes" rows={2} className="px-3 py-2.5 rounded-lg bg-[#0f1f3d] border border-[#1e3a5f] text-white placeholder-[#4a6080] focus:outline-none focus:border-[#f05a28] text-sm resize-none" />
        </div>

        <div className="flex gap-3 mt-2">
          <button type="button" onClick={() => router.back()} className="flex-1 py-2.5 rounded-lg border border-[#1e3a5f] text-[#94a3b8] text-sm hover:border-[#94a3b8] transition-colors active:scale-95 transition-transform">
            Cancelar
          </button>
          <button type="submit" disabled={formInFlight} className="flex-1 py-2.5 rounded-lg bg-[#f05a28] text-white text-sm font-medium hover:bg-[#d94e22] disabled:opacity-50 transition-colors active:scale-95">
            {uploading ? 'Enviando fotos...' : formInFlight ? 'Salvando...' : 'Registrar Sinistro'}
          </button>
        </div>
      </form>
    </div>
  )
}
