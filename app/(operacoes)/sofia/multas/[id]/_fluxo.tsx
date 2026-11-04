'use client'

import { useActionState, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { comprimirImagem } from '@/lib/sofia/comprimirImagem'
import { editarPrazoMultaAction, registrarDobroAction, registrarEtapaMultaAction } from '../_actions'
import type { AcaoMulta } from '@/lib/sofia/multaEtapas'

type State = { error?: string; success?: boolean }

const CAMPO =
  'px-3 py-2 rounded-lg bg-[#0f1f3d] border border-[#1e3a5f] text-white placeholder-[#4a6080] focus:outline-none focus:border-[#f05a28] text-sm [color-scheme:dark]'
const ROTULO = 'text-xs text-[#94a3b8]'

function Mensagem({ state }: { state: State }) {
  if (state.error) return <p className="text-xs text-red-400">{state.error}</p>
  if (state.success) return <p className="text-xs text-green-400">Registrado.</p>
  return null
}

function Botao({ acao, pendente }: { acao: AcaoMulta; pendente: boolean }) {
  const primario = acao.tipo === 'avancar'
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="submit"
        disabled={!acao.permitida || pendente}
        className={`px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 transition-transform ${
          primario ? 'bg-[#f05a28] text-white hover:bg-[#d94e22]' : 'border border-[#1e3a5f] text-[#94a3b8] hover:border-[#94a3b8]'
        }`}
      >
        {pendente ? 'Salvando...' : acao.rotulo}
      </button>
      {!acao.permitida && acao.motivo && <span className="text-xs text-red-400">{acao.motivo}</span>}
    </div>
  )
}

export interface OpcaoMotorista {
  id: string
  nome: string
}

/** Formulário de uma ação de etapa (avançar ou voltar). Os campos dependem do destino. */
export function FormEtapa({
  multaId,
  acao,
  motoristas,
  condutorSugeridoId,
  valorMulta,
}: {
  multaId: string
  acao: AcaoMulta
  motoristas: OpcaoMotorista[]
  condutorSugeridoId: string | null
  valorMulta: number
}) {
  const [arquivoErro, setArquivoErro] = useState<string | null>(null)
  const [state, action, pendente] = useActionState(async (_prev: State, fd: FormData): Promise<State> => {
    setArquivoErro(null)
    if (acao.destino === 'termo' && acao.tipo === 'avancar') {
      const arquivo = fd.get('arquivo') as File | null
      if (!arquivo || arquivo.size === 0) return { error: 'Anexe o termo assinado (PDF ou foto).' }
      const ehPdf = arquivo.type === 'application/pdf'
      const ehImagem = arquivo.type.startsWith('image/')
      if (!ehPdf && !ehImagem) return { error: 'O termo precisa ser PDF ou imagem.' }
      let corpo: Blob = arquivo
      if (ehImagem) {
        try {
          corpo = await comprimirImagem(arquivo)
        } catch {
          corpo = arquivo
        }
      }
      const ext = ehPdf ? 'pdf' : 'jpg'
      const path = `multas/${multaId}/termo-${Date.now()}.${ext}`
      const { error } = await createClient()
        .storage.from('sofia-anexos')
        .upload(path, corpo, { contentType: ehPdf ? 'application/pdf' : 'image/jpeg' })
      if (error) {
        setArquivoErro('Falha ao enviar o termo. Tente novamente.')
        return {}
      }
      fd.delete('arquivo')
      fd.set('storage_path', path)
    }
    return registrarEtapaMultaAction(multaId, acao.destino, fd)
  }, {})

  const d = acao.tipo === 'avancar' ? acao.destino : null

  return (
    <form action={action} className="flex flex-col gap-3 mt-3">
      {d === 'condutor' && (
        <label className="flex flex-col gap-1">
          <span className={ROTULO}>Condutor</span>
          <select name="motorista_id" defaultValue={condutorSugeridoId ?? ''} required className={CAMPO}>
            <option value="">Selecione</option>
            {motoristas.map((m) => (
              <option key={m.id} value={m.id}>
                {m.nome}
                {m.id === condutorSugeridoId ? ' (sugerido)' : ''}
              </option>
            ))}
          </select>
        </label>
      )}
      {d === 'termo' && (
        <label className="flex flex-col gap-1">
          <span className={ROTULO}>Termo assinado (PDF ou foto)</span>
          <input name="arquivo" type="file" accept="application/pdf,image/*" required className="text-sm text-[#94a3b8]" />
        </label>
      )}
      {d === 'indicado' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="flex flex-col gap-1">
            <span className={ROTULO}>Indicado em</span>
            <input name="indicado_em" type="date" required className={CAMPO} />
          </label>
          <label className="flex flex-col gap-1">
            <span className={ROTULO}>Protocolo</span>
            <input name="protocolo" className={CAMPO} />
          </label>
        </div>
      )}
      {(d === 'validada' || d === 'contestada') && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="flex flex-col gap-1">
            <span className={ROTULO}>Em nome de (gestor da equipe)</span>
            <input name="em_nome_de" required className={CAMPO} />
          </label>
          <label className="flex flex-col gap-1">
            <span className={ROTULO}>Canal</span>
            <select name="canal" required defaultValue="" className={CAMPO}>
              <option value="">Selecione</option>
              <option value="email">E-mail</option>
              <option value="whatsapp">WhatsApp</option>
              <option value="telefone">Telefone</option>
              <option value="presencial">Presencial</option>
            </select>
          </label>
        </div>
      )}
      {d === 'cobrada' && (
        <label className="flex flex-col gap-1">
          <span className={ROTULO}>Boleto lançado em</span>
          <input name="boleto_lancado_em" type="date" required className={CAMPO} />
        </label>
      )}
      {d === 'descontada' && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <label className="flex flex-col gap-1">
            <span className={ROTULO}>Valor descontado (R$)</span>
            <input
              name="valor_descontado"
              type="number"
              step="0.01"
              min="0"
              max={valorMulta}
              defaultValue={valorMulta}
              required
              className={CAMPO}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className={ROTULO}>Tipo</span>
            <select name="tipo_desconto" required defaultValue="total" className={CAMPO}>
              <option value="total">Total</option>
              <option value="parcial">Parcial</option>
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className={ROTULO}>Competência (mês do contracheque)</span>
            <input name="competencia" type="month" required className={CAMPO} />
          </label>
        </div>
      )}
      {acao.permitida && (
        <label className="flex flex-col gap-1">
          <span className={ROTULO}>{d === 'contestada' ? 'Motivo da contestação' : 'Observação (opcional)'}</span>
          <textarea name="observacao" rows={2} required={d === 'contestada'} className={`${CAMPO} resize-none`} />
        </label>
      )}
      <Botao acao={acao} pendente={pendente} />
      {arquivoErro && <p className="text-xs text-red-400">{arquivoErro}</p>}
      <Mensagem state={state} />
    </form>
  )
}

export function FormPrazo({ multaId, prazo }: { multaId: string; prazo: string | null }) {
  const [state, action, pendente] = useActionState(
    (_prev: State, fd: FormData) => editarPrazoMultaAction(multaId, fd),
    {}
  )
  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <label className="flex flex-col gap-1">
        <span className={ROTULO}>Prazo de indicação</span>
        <input name="prazo_indicacao" type="date" defaultValue={prazo ?? ''} required className={CAMPO} />
      </label>
      <button
        type="submit"
        disabled={pendente}
        className="px-3 py-2 rounded-lg border border-[#1e3a5f] text-[#94a3b8] text-sm hover:border-[#94a3b8] disabled:opacity-50"
      >
        Alterar prazo
      </button>
      <Mensagem state={state} />
    </form>
  )
}

export function FormDobro({ multaId }: { multaId: string }) {
  const [state, action, pendente] = useActionState(
    (_prev: State, fd: FormData) => registrarDobroAction(multaId, fd),
    {}
  )
  return (
    <form action={action} className="flex flex-wrap items-end gap-2 mt-2">
      <label className="flex flex-col gap-1">
        <span className={ROTULO}>Responsável pela perda do prazo</span>
        <select name="responsavel_dobro" required defaultValue="" className={CAMPO}>
          <option value="">Selecione</option>
          <option value="empresa">Empresa</option>
          <option value="motorista">Motorista</option>
        </select>
      </label>
      <button
        type="submit"
        disabled={pendente}
        className="px-3 py-2 rounded-lg border border-[#1e3a5f] text-[#94a3b8] text-sm hover:border-[#94a3b8] disabled:opacity-50"
      >
        Registrar multa em dobro
      </button>
      <Mensagem state={state} />
    </form>
  )
}
