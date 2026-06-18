'use client'
import { useActionState, useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { criarChecklistAction, uploadFotoAction } from '../_actions'
import CameraCapture from '@/components/sofia/CameraCapture'
import { createClient } from '@/lib/supabase/client'
import type { Equipe, Veiculo, Motorista } from '@/lib/sofia/types'

const ITENS_CHECKLIST = [
  { key: 'lataria_ok', label: 'Lataria' },
  { key: 'vidros_ok', label: 'Vidros' },
  { key: 'pneus_ok', label: 'Pneus' },
  { key: 'combustivel_ok', label: 'Combustível' },
  { key: 'itens_internos_ok', label: 'Itens internos' },
  { key: 'estepe_ok', label: 'Estepe' },
  { key: 'macaco_ok', label: 'Macaco' },
  { key: 'triangulo_ok', label: 'Triângulo' },
]

const POSICOES_FOTO = ['Frente', 'Traseira', 'Lateral Esq.', 'Lateral Dir.', 'Interna']

interface CapturedPhoto {
  blob: Blob
  posicao: string
  lat: number | null
  lng: number | null
}

interface Props {
  equipes: Equipe[]
  veiculos: Veiculo[]
  motoristas: Motorista[]
}

export default function ChecklistForm({ equipes, veiculos, motoristas }: Props) {
  const [state, action, isPending] = useActionState(criarChecklistAction, {})
  const router = useRouter()
  const [tipo, setTipo] = useState('')
  const [itens, setItens] = useState<Record<string, boolean>>({})
  const [fotos, setFotos] = useState<CapturedPhoto[]>([])
  const [uploading, setUploading] = useState(false)
  const [failedFotos, setFailedFotos] = useState<string[]>([])
  // True the instant the form is submitted, before isPending (set by
  // useActionState) or uploading (set by the effect below) flip on. Without
  // this, there's a window after the create-checklist action resolves and
  // before the upload effect runs where a fast double-click could submit a
  // second, duplicate checklist row. Cleared as soon as the action reports an
  // error (computed at render time, not in an effect) so the user can retry.
  const [submitting, setSubmitting] = useState(false)
  if (submitting && state.error) setSubmitting(false)
  const formInFlight = submitting || isPending || uploading

  const handleCapture = useCallback(
    (blob: Blob, posicao: string, lat: number | null, lng: number | null) => {
      setFotos((prev) => [
        ...prev.filter((f) => f.posicao !== posicao),
        { blob, posicao, lat, lng },
      ])
    },
    []
  )

  useEffect(() => {
    if (!state.success || !state.checklistId) return
    if (fotos.length === 0) {
      router.push('/sofia/checklist')
      return
    }
    setUploading(true)
    const supabase = createClient()
    Promise.all(
      fotos.map(async (foto) => {
        const path = `${state.checklistId}/${foto.posicao.replace(/\s/g, '-')}-${Date.now()}.jpg`
        const { error: uploadError } = await supabase.storage
          .from('checklist-fotos')
          .upload(path, foto.blob, { contentType: 'image/jpeg' })
        if (uploadError) return { posicao: foto.posicao, ok: false as const }

        const result = await uploadFotoAction(
          state.checklistId!,
          path,
          foto.posicao,
          foto.lat,
          foto.lng
        )
        if ('error' in result) return { posicao: foto.posicao, ok: false as const }
        return { posicao: foto.posicao, ok: true as const }
      })
    ).then((results) => {
      setUploading(false)
      const failed = results.filter((r) => !r.ok).map((r) => r.posicao)
      if (failed.length > 0) {
        setFailedFotos(failed)
        setSubmitting(false)
        return
      }
      router.push('/sofia/checklist')
    })
  }, [state.success, state.checklistId, fotos, router])

  return (
    <div className="p-8 max-w-2xl">
      <h1 className="text-2xl font-bold text-white mb-2">Novo Checklist</h1>
      <p className="text-[#4a6080] text-sm mb-8">
        Registre a condição do veículo com fotos
      </p>

      <form
        action={action}
        onSubmit={() => setSubmitting(true)}
        className="flex flex-col gap-6"
      >
        {state.error && (
          <div className="px-4 py-3 rounded-lg border border-red-600 bg-red-950 text-red-300 text-sm">
            {state.error}
          </div>
        )}

        {failedFotos.length > 0 && (
          <div className="px-4 py-3 rounded-lg border border-red-600 bg-red-950 text-red-300 text-sm">
            Checklist salvo, mas {failedFotos.length} foto
            {failedFotos.length > 1 ? 's' : ''} não {failedFotos.length > 1 ? 'foram salvas' : 'foi salva'}:{' '}
            {failedFotos.join(', ')}. Tente novamente ou contate o suporte.
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm text-[#94a3b8]">Tipo *</label>
            <select
              name="tipo"
              required
              value={tipo}
              onChange={(e) => setTipo(e.target.value)}
              className="px-3 py-2.5 rounded-lg bg-[#0f1f3d] border border-[#1e3a5f] text-white focus:outline-none focus:border-[#f05a28] text-sm"
            >
              <option value="">Selecione</option>
              <option value="saida">Saída</option>
              <option value="retorno">Retorno</option>
              <option value="troca">Troca de Responsável</option>
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm text-[#94a3b8]">Equipe *</label>
            <select
              name="equipe_id"
              required
              className="px-3 py-2.5 rounded-lg bg-[#0f1f3d] border border-[#1e3a5f] text-white focus:outline-none focus:border-[#f05a28] text-sm"
            >
              <option value="">Selecione</option>
              {equipes
                .filter((e) => e.ativo)
                .map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.codigo}
                  </option>
                ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm text-[#94a3b8]">Veículo *</label>
            <select
              name="veiculo_id"
              required
              className="px-3 py-2.5 rounded-lg bg-[#0f1f3d] border border-[#1e3a5f] text-white focus:outline-none focus:border-[#f05a28] text-sm"
            >
              <option value="">Selecione</option>
              {veiculos
                .filter((v) => v.status === 'ativo')
                .map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.placa}
                  </option>
                ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm text-[#94a3b8]">Motorista</label>
            <select
              name="motorista_id"
              className="px-3 py-2.5 rounded-lg bg-[#0f1f3d] border border-[#1e3a5f] text-white focus:outline-none focus:border-[#f05a28] text-sm"
            >
              <option value="">Selecione</option>
              {motoristas
                .filter((m) => m.ativo)
                .map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.nome}
                  </option>
                ))}
            </select>
          </div>
        </div>

        {tipo === 'troca' && (
          <div className="grid grid-cols-2 gap-3 p-3 rounded-lg border border-[#f05a28]/40 bg-[#0f1f3d]">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm text-[#94a3b8]">Equipe de destino *</label>
              <select
                name="equipe_destino_id"
                required
                className="px-3 py-2.5 rounded-lg bg-[#0a1628] border border-[#1e3a5f] text-white focus:outline-none focus:border-[#f05a28] text-sm"
              >
                <option value="">Selecione</option>
                {equipes
                  .filter((e) => e.ativo)
                  .map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.codigo}
                    </option>
                  ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm text-[#94a3b8]">Motorista de destino</label>
              <select
                name="motorista_destino_id"
                className="px-3 py-2.5 rounded-lg bg-[#0a1628] border border-[#1e3a5f] text-white focus:outline-none focus:border-[#f05a28] text-sm"
              >
                <option value="">Selecione</option>
                {motoristas
                  .filter((m) => m.ativo)
                  .map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.nome}
                    </option>
                  ))}
              </select>
            </div>
          </div>
        )}

        <div>
          <p className="text-sm text-[#94a3b8] mb-3">Itens de Verificação</p>
          <div className="grid grid-cols-2 gap-2">
            {ITENS_CHECKLIST.map((item) => (
              <label
                key={item.key}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-[#1e3a5f] cursor-pointer hover:border-[#f05a28] transition-colors"
              >
                <input
                  type="hidden"
                  name={item.key}
                  value={itens[item.key] ? 'true' : 'false'}
                />
                <button
                  type="button"
                  onClick={() =>
                    setItens((prev) => ({ ...prev, [item.key]: !prev[item.key] }))
                  }
                  className={`w-5 h-5 rounded border flex items-center justify-center text-xs transition-colors shrink-0 ${
                    itens[item.key]
                      ? 'bg-green-600 border-green-600 text-white'
                      : 'border-[#1e3a5f] text-transparent'
                  }`}
                >
                  ✓
                </button>
                <span className="text-sm text-[#94a3b8]">{item.label}</span>
              </label>
            ))}
          </div>
        </div>

        <div>
          <p className="text-sm text-[#94a3b8] mb-3">
            Fotos do Veículo{' '}
            <span className="text-[#4a6080]">(câmera ao vivo — sem galeria)</span>
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {POSICOES_FOTO.map((posicao) => (
              <CameraCapture key={posicao} posicao={posicao} onCapture={handleCapture} />
            ))}
          </div>
          {fotos.length > 0 && (
            <p className="text-xs text-green-400 mt-2">
              {fotos.length} foto{fotos.length > 1 ? 's' : ''} capturada
              {fotos.length > 1 ? 's' : ''}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2">
          <input type="checkbox" name="chave_entregue" value="true" id="chave" className="accent-[#f05a28]" />
          <label htmlFor="chave" className="text-sm text-[#94a3b8]">Chave entregue</label>
        </div>
        <div className="flex items-center gap-2">
          <input type="checkbox" name="cartao_combustivel_entregue" value="true" id="cartao" className="accent-[#f05a28]" />
          <label htmlFor="cartao" className="text-sm text-[#94a3b8]">Cartão combustível entregue</label>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm text-[#94a3b8]">Avaria identificada?</label>
          <select
            name="avaria_identificada"
            defaultValue="false"
            className="px-3 py-2.5 rounded-lg bg-[#0f1f3d] border border-[#1e3a5f] text-white focus:outline-none focus:border-[#f05a28] text-sm"
          >
            <option value="false">Não</option>
            <option value="true">Sim</option>
          </select>
          <textarea
            name="avaria_descricao"
            rows={2}
            placeholder="Descreva a avaria (se houver)"
            className="px-3 py-2.5 rounded-lg bg-[#0f1f3d] border border-[#1e3a5f] text-white placeholder-[#4a6080] focus:outline-none focus:border-[#f05a28] text-sm resize-none"
          />
        </div>
        <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg border border-[#1e3a5f]">
          <input type="checkbox" name="assinatura_motorista" value="true" id="assinatura" required className="accent-[#f05a28]" />
          <label htmlFor="assinatura" className="text-sm text-[#94a3b8]">
            Motorista confirma recebimento/devolução nas condições descritas *
          </label>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm text-[#94a3b8]">Observações</label>
          <textarea
            name="observacoes"
            rows={3}
            placeholder="Danos visíveis, comentários..."
            className="px-3 py-2.5 rounded-lg bg-[#0f1f3d] border border-[#1e3a5f] text-white placeholder-[#4a6080] focus:outline-none focus:border-[#f05a28] text-sm resize-none"
          />
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => router.back()}
            className="flex-1 py-3 rounded-lg border border-[#1e3a5f] text-[#94a3b8] text-sm hover:border-[#94a3b8] transition-colors"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={formInFlight}
            className="flex-1 py-3 rounded-lg bg-[#f05a28] text-white font-medium hover:bg-[#d94e22] disabled:opacity-50 transition-colors"
          >
            {uploading
              ? 'Enviando fotos...'
              : formInFlight
              ? 'Salvando...'
              : 'Finalizar Checklist'}
          </button>
        </div>
      </form>
    </div>
  )
}
