'use client'
import { useActionState, useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { criarChecklistAction } from '../_actions'
import { FOTO_POSICOES_OBRIGATORIAS, FOTO_POSICAO_OPCIONAL } from '../_validation'
import CameraCapture from '@/components/sofia/CameraCapture'
import { createClient } from '@/lib/supabase/client'
import { uploadFotos, type CapturedPhoto } from '@/lib/sofia/uploadFotos'
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

const POSICOES_FOTO = [...FOTO_POSICOES_OBRIGATORIAS, FOTO_POSICAO_OPCIONAL]

interface Props {
  equipes: Equipe[]
  veiculos: Veiculo[]
  motoristas: Motorista[]
}

export default function ChecklistForm({ equipes, veiculos, motoristas }: Props) {
  const [state, formAction, isPending] = useActionState(criarChecklistAction, {})
  const [, startTransition] = useTransition()
  const router = useRouter()
  const [checklistId] = useState(() => crypto.randomUUID())
  const [tipo, setTipo] = useState('')
  const [equipeId, setEquipeId] = useState('')
  const [veiculoIdManual, setVeiculoIdManual] = useState('')
  const veiculoExplicito = tipo === 'troca' || tipo === 'recebimento' || tipo === 'finalizacao_contrato'
  const exigeEquipe = tipo === 'saida' || tipo === 'retorno' || tipo === 'devolucao'
  const veiculoDaEquipe = veiculos.find((v) => v.equipe_id === equipeId && v.status === 'ativo')
  const motoristaDaEquipe = motoristas.find((m) => m.equipe_id === equipeId && m.ativo)

  const [itens, setItens] = useState<Record<string, boolean | null>>({})
  const [fotos, setFotos] = useState<CapturedPhoto[]>([])
  const [uploadingFotos, setUploadingFotos] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  if (submitting && (state.error || uploadError)) setSubmitting(false)
  const formInFlight = submitting || isPending || uploadingFotos

  useEffect(() => {
    if (state.success && state.checklistId) {
      router.push('/sofia/checklist')
    }
  }, [state.success, state.checklistId, router])

  const itensRespondidos = ITENS_CHECKLIST.filter((i) => itens[i.key] !== undefined && itens[i.key] !== null).length
  const fotosObrigatoriasCapturadas = FOTO_POSICOES_OBRIGATORIAS.filter((p) =>
    fotos.some((f) => f.posicao === p)
  ).length
  const anyProblema = Object.values(itens).some((v) => v === false)

  const handleCapture = (blob: Blob, posicao: string, lat: number | null, lng: number | null) => {
    setFotos((prev) => [...prev.filter((f) => f.posicao !== posicao), { blob, posicao, lat, lng }])
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setUploadError(null)
    setSubmitting(true)

    const fd = new FormData(e.currentTarget)

    setUploadingFotos(true)
    const supabase = createClient()
    const resultado = await uploadFotos(supabase, 'checklist-fotos', checklistId, fotos)
    setUploadingFotos(false)

    if (!resultado.ok) {
      setUploadError(resultado.error)
      setSubmitting(false)
      return
    }

    fd.set('id', checklistId)
    fd.set('fotos', JSON.stringify(resultado.fotos))
    fd.set('avaria_identificada', String(anyProblema || fd.get('avaria_identificada') === 'true'))

    const itensProblemas: Record<string, string> = {}
    for (const item of ITENS_CHECKLIST) {
      if (itens[item.key] === false) {
        itensProblemas[item.key] = ((fd.get(`desc_${item.key}`) as string) || '').trim()
      }
    }
    fd.set('itens_problemas', JSON.stringify(itensProblemas))

    startTransition(() => {
      formAction(fd)
    })
  }

  return (
    <div className="p-8 max-w-2xl">
      <h1 className="text-2xl font-bold text-white mb-2">Novo Checklist</h1>
      <p className="text-[#4a6080] text-sm mb-8">
        Registre a condição do veículo com fotos
      </p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        {state.error && (
          <div className="px-4 py-3 rounded-lg border border-red-600 bg-red-950 text-red-300 text-sm">
            {state.error}
          </div>
        )}
        {uploadError && (
          <div className="px-4 py-3 rounded-lg border border-red-600 bg-red-950 text-red-300 text-sm">
            {uploadError}
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
              <option value="recebimento">Recebimento (retirada da locadora)</option>
              <option value="saida">Saída</option>
              <option value="retorno">Retorno</option>
              <option value="devolucao">Devolução (fica na empresa)</option>
              <option value="troca">Troca de Responsável</option>
              <option value="finalizacao_contrato">Finalização de Contrato</option>
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm text-[#94a3b8]">{exigeEquipe ? 'Equipe *' : 'Equipe (opcional)'}</label>
            <select
              name="equipe_id"
              required={exigeEquipe}
              value={equipeId}
              onChange={(e) => setEquipeId(e.target.value)}
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

        {veiculoExplicito ? (
          <div className="flex flex-col gap-1.5">
            <label className="text-sm text-[#94a3b8]">Veículo *</label>
            <select
              name="veiculo_id"
              required
              value={veiculoIdManual}
              onChange={(e) => setVeiculoIdManual(e.target.value)}
              className="px-3 py-2.5 rounded-lg bg-[#0f1f3d] border border-[#1e3a5f] text-white focus:outline-none focus:border-[#f05a28] text-sm"
            >
              <option value="">Selecione</option>
              {veiculos
                .filter((v) => v.status !== 'inativo')
                .map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.placa} · {v.modelo}
                  </option>
                ))}
            </select>
          </div>
        ) : (
          <input type="hidden" name="veiculo_id" value={veiculoDaEquipe?.id ?? ''} />
        )}
        <input type="hidden" name="motorista_id" value={motoristaDaEquipe?.id ?? ''} />

        {!veiculoExplicito && equipeId && (
          <div className="px-3 py-2.5 rounded-lg bg-[#0d2050] border border-[#1e3a5f] text-sm">
            {veiculoDaEquipe ? (
              <>
                <p className="text-[#94a3b8]">
                  Veículo: <span className="text-white font-mono">{veiculoDaEquipe.placa}</span>
                  {' · '}{veiculoDaEquipe.modelo}
                </p>
                <p className="text-[#4a6080] text-xs mt-0.5">
                  Última KM: <span className="text-amber-400 font-mono">{veiculoDaEquipe.km_atual.toLocaleString('pt-BR')} km</span>
                </p>
              </>
            ) : (
              <p className="text-amber-400 text-xs">Nenhum veículo ativo vinculado a esta equipe</p>
            )}
            {motoristaDaEquipe && (
              <p className="text-[#94a3b8] text-xs mt-1">
                Motorista: <span className="text-white">{motoristaDaEquipe.nome}</span>
              </p>
            )}
          </div>
        )}

        {veiculoExplicito && veiculoIdManual && (() => {
          const v = veiculos.find((vv) => vv.id === veiculoIdManual)
          if (!v) return null
          return (
            <div className="px-3 py-2.5 rounded-lg bg-[#0d2050] border border-[#1e3a5f] text-sm">
              <p className="text-[#94a3b8]">
                Veículo: <span className="text-white font-mono">{v.placa}</span>{' · '}{v.modelo}
              </p>
              <p className="text-[#4a6080] text-xs mt-0.5">
                Última KM: <span className="text-amber-400 font-mono">{v.km_atual.toLocaleString('pt-BR')} km</span>
              </p>
            </div>
          )
        })()}

        {(tipo === 'troca' || tipo === 'recebimento') && (
          <div className="grid grid-cols-2 gap-3 p-3 rounded-lg border border-[#f05a28]/40 bg-[#0f1f3d]">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm text-[#94a3b8]">
                {tipo === 'troca' ? 'Equipe de destino *' : 'Equipe de destino (opcional)'}
              </label>
              <select
                name="equipe_destino_id"
                required={tipo === 'troca'}
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
          <p className="text-sm text-[#94a3b8] mb-3">
            Itens de Verificação <span className="text-[#4a6080]">({itensRespondidos} de {ITENS_CHECKLIST.length})</span>
          </p>
          <div className="flex flex-col gap-2">
            {ITENS_CHECKLIST.map((item) => (
              <div key={item.key} className="rounded-lg border border-[#1e3a5f] px-3 py-2.5">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm text-[#94a3b8]">{item.label}</span>
                  <div className="flex gap-2 shrink-0">
                    <input type="hidden" name={item.key} value={itens[item.key] === true ? 'true' : itens[item.key] === false ? 'false' : ''} />
                    <button
                      type="button"
                      onClick={() => setItens((prev) => ({ ...prev, [item.key]: true }))}
                      className={`px-3 py-1.5 rounded text-xs font-medium border active:scale-95 transition-[color,background-color,border-color,transform] ${
                        itens[item.key] === true
                          ? 'bg-green-600 border-green-600 text-white'
                          : 'border-[#1e3a5f] text-[#4a6080] hover:border-green-600 hover:text-green-400'
                      }`}
                    >
                      ✓ OK
                    </button>
                    <button
                      type="button"
                      onClick={() => setItens((prev) => ({ ...prev, [item.key]: false }))}
                      className={`px-3 py-1.5 rounded text-xs font-medium border active:scale-95 transition-[color,background-color,border-color,transform] ${
                        itens[item.key] === false
                          ? 'bg-amber-600 border-amber-600 text-white'
                          : 'border-[#1e3a5f] text-[#4a6080] hover:border-amber-600 hover:text-amber-400'
                      }`}
                    >
                      ⚠ Problema
                    </button>
                  </div>
                </div>
                {itens[item.key] === false && (
                  <textarea
                    name={`desc_${item.key}`}
                    rows={2}
                    required
                    placeholder={`Descreva o problema em ${item.label.toLowerCase()}`}
                    className="mt-2 w-full px-3 py-2 rounded-lg bg-[#0f1f3d] border border-amber-800 text-white placeholder-[#4a6080] focus:outline-none focus:border-amber-500 text-sm resize-none"
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        <div>
          <p className="text-sm text-[#94a3b8] mb-3">
            Fotos do Veículo <span className="text-[#4a6080]">({fotosObrigatoriasCapturadas} de {FOTO_POSICOES_OBRIGATORIAS.length} obrigatórias)</span>
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {POSICOES_FOTO.map((posicao) => (
              <CameraCapture key={posicao} posicao={posicao} onCapture={handleCapture} />
            ))}
          </div>
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
          <label className="text-sm text-[#94a3b8]">Avaria identificada (fora dos itens acima)?</label>
          <select
            name="avaria_identificada"
            defaultValue="false"
            disabled={anyProblema}
            className="px-3 py-2.5 rounded-lg bg-[#0f1f3d] border border-[#1e3a5f] text-white focus:outline-none focus:border-[#f05a28] text-sm disabled:opacity-60"
          >
            <option value="false">Não</option>
            <option value="true">Sim</option>
          </select>
          {anyProblema && (
            <p className="text-amber-400 text-xs">Marcado automaticamente — pelo menos um item foi sinalizado como Problema acima.</p>
          )}
          <textarea
            name="avaria_descricao"
            rows={2}
            placeholder="Descreva avaria fora dos itens de verificação (se houver)"
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
            className="flex-1 py-3 rounded-lg border border-[#1e3a5f] text-[#94a3b8] text-sm hover:border-[#94a3b8] active:scale-95 transition-[border-color,transform]"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={formInFlight || itensRespondidos < ITENS_CHECKLIST.length || fotosObrigatoriasCapturadas < FOTO_POSICOES_OBRIGATORIAS.length}
            className="flex-1 py-3 rounded-lg bg-[#f05a28] text-white font-medium hover:bg-[#d94e22] disabled:opacity-50 transition-colors active:scale-95"
          >
            {uploadingFotos
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
