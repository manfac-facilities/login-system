'use client'
import { useActionState, useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { criarSinistroAction } from '../_actions'
import CameraCapture from '@/components/sofia/CameraCapture'
import { createClient } from '@/lib/supabase/client'
import { uploadFotos, type CapturedPhoto } from '@/lib/sofia/uploadFotos'
import { useVeiculoMotoristaCascade } from '@/lib/sofia/useVeiculoMotoristaCascade'
import type { Veiculo, Motorista } from '@/lib/sofia/types'

export default function NovoSinistroForm({
  veiculos,
  motoristas,
}: {
  veiculos: Veiculo[]
  motoristas: Motorista[]
}) {
  const [state, formAction, isPending] = useActionState(criarSinistroAction, {})
  const [, startTransition] = useTransition()
  const router = useRouter()
  const [sinistroId] = useState(() => crypto.randomUUID())
  const [fotos, setFotos] = useState<CapturedPhoto[]>([])
  const [uploadingFotos, setUploadingFotos] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const { veiculoId, motoristaId, onVeiculoChange, onMotoristaChange } = useVeiculoMotoristaCascade()
  const [submitting, setSubmitting] = useState(false)
  if (submitting && (state.error || uploadError)) setSubmitting(false)
  const formInFlight = submitting || isPending || uploadingFotos
  const jaSalvou = !!state.error && !!state.sinistroId

  useEffect(() => {
    if (state.success && state.sinistroId) {
      router.push('/sofia/sinistros')
    }
  }, [state.success, state.sinistroId, router])

  const handleCapture = (blob: Blob, posicao: string) => {
    setFotos((prev) => [...prev.filter((f) => f.posicao !== posicao), { blob, posicao, lat: null, lng: null }])
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setUploadError(null)
    setSubmitting(true)

    const fd = new FormData(e.currentTarget)
    fd.set('id', sinistroId)

    if (fotos.length > 0) {
      setUploadingFotos(true)
      const supabase = createClient()
      const resultado = await uploadFotos(supabase, 'sofia-anexos', `sinistros/${sinistroId}`, fotos)
      setUploadingFotos(false)

      if (!resultado.ok) {
        setUploadError(resultado.error)
        setSubmitting(false)
        return
      }
      const paths: Record<string, string> = {}
      for (const [posicao, info] of Object.entries(resultado.fotos)) paths[posicao] = info.path
      fd.set('fotos', JSON.stringify(paths))
    } else {
      fd.set('fotos', '{}')
    }

    startTransition(() => {
      formAction(fd)
    })
  }

  return (
    <div className="p-8 max-w-2xl">
      <h1 className="text-2xl font-bold text-white mb-2">Registrar Sinistro</h1>
      <p className="text-[#4a6080] text-sm mb-8">Batida, furto ou avaria — com fotos do dano</p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {jaSalvou ? (
          <div className="px-4 py-3 rounded-lg border border-amber-600 bg-amber-950 text-amber-300 text-sm">
            O sinistro já foi registrado, mas houve um erro em uma etapa seguinte: {state.error} Não reenvie este
            formulário — o registro já existe.{' '}
            <Link href="/sofia/sinistros" className="underline font-medium">
              Ver sinistros
            </Link>
          </div>
        ) : (
          state.error && (
            <div className="px-4 py-3 rounded-lg border border-red-600 bg-red-950 text-red-300 text-sm">
              {state.error}
            </div>
          )
        )}
        {uploadError && (
          <div className="px-4 py-3 rounded-lg border border-red-600 bg-red-950 text-red-300 text-sm">
            {uploadError}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm text-[#94a3b8]">Veículo</label>
            <select
              name="veiculo_id"
              value={veiculoId}
              onChange={(e) => onVeiculoChange(e.target.value)}
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
              onChange={(e) => onMotoristaChange(e.target.value)}
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
          <button type="button" onClick={() => router.back()} className="flex-1 py-2.5 rounded-lg border border-[#1e3a5f] text-[#94a3b8] text-sm hover:border-[#94a3b8] active:scale-95 transition-[border-color,transform]">
            Cancelar
          </button>
          <button type="submit" disabled={jaSalvou || formInFlight} className="flex-1 py-2.5 rounded-lg bg-[#f05a28] text-white text-sm font-medium hover:bg-[#d94e22] disabled:opacity-50 transition-colors active:scale-95">
            {uploadingFotos ? 'Enviando fotos...' : formInFlight ? 'Salvando...' : 'Registrar Sinistro'}
          </button>
        </div>
      </form>
    </div>
  )
}
