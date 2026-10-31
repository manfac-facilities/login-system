'use client'

/**
 * Observações da engenharia + Salvar / Sugerir com IA / Validar e enviar
 * (Leva 3 §2.3). A IA só preenche o campo; validar exige o texto SALVO
 * (o botão fica desabilitado com alteração não salva, e a action relê do banco).
 */

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { salvarObservacoesSemanalAction, sugerirObservacoesIaAction, validarEEnviarSemanalAction } from './_actions'
import { botaoPrincipal, botaoSecundario, campoCls, rotuloCls } from '../_registro-form'
import { MAX_OBSERVACOES } from './_tipos'

export type EstadoTela = 'nao_iniciado' | 'rascunho' | 'validado' | 'enviado'

export default function FormSemanal({
  obraId,
  segunda,
  estado,
  observacoes,
  podeEnviar,
  ia,
  temClienteSemanal,
}: {
  obraId: string
  segunda: string
  estado: EstadoTela
  observacoes: string
  /** Engenheiro da obra ou admin. */
  podeEnviar: boolean
  /** ANTHROPIC_API_KEY configurada no servidor. */
  ia: boolean
  temClienteSemanal: boolean
}) {
  const router = useRouter()
  const [texto, setTexto] = useState(observacoes)
  const [salvo, setSalvo] = useState(observacoes)
  const [ocupado, setOcupado] = useState<null | 'salvar' | 'ia' | 'enviar'>(null)
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null)

  const editavel = podeEnviar && (estado === 'nao_iniciado' || estado === 'rascunho')
  const sujo = texto.trim() !== salvo.trim()
  const existe = estado !== 'nao_iniciado'

  async function salvar() {
    setOcupado('salvar')
    setMsg(null)
    try {
      const r = await salvarObservacoesSemanalAction(obraId, segunda, texto)
      if (r.ok) {
        setSalvo(texto)
        setMsg({ ok: true, texto: 'Rascunho salvo.' })
        router.refresh()
      } else setMsg({ ok: false, texto: r.erro })
    } finally {
      setOcupado(null)
    }
  }

  async function sugerir() {
    if (texto.trim() && !window.confirm('Substituir o texto do campo pela sugestão da IA?')) return
    setOcupado('ia')
    setMsg(null)
    try {
      const r = await sugerirObservacoesIaAction(obraId, segunda)
      if (r.ok) {
        setTexto(r.texto)
        setMsg({ ok: true, texto: 'Sugestão da IA no campo. Revise, ajuste e salve antes de enviar.' })
      } else setMsg({ ok: false, texto: r.erro })
    } finally {
      setOcupado(null)
    }
  }

  async function enviar() {
    const aviso =
      estado === 'rascunho'
        ? 'Validar e enviar o relatório semanal? Depois de validado as observações não mudam mais.'
        : 'Enviar o relatório a quem ainda não recebeu?'
    if (!window.confirm(aviso)) return
    setOcupado('enviar')
    setMsg(null)
    try {
      const r = await validarEEnviarSemanalAction(obraId, segunda)
      if (r.ok) setMsg({ ok: true, texto: r.enviados ? `Enviado a ${r.enviados} destinatário(s).` : 'Todos já tinham recebido.' })
      else setMsg({ ok: false, texto: r.erro })
      router.refresh()
    } finally {
      setOcupado(null)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <label className={rotuloCls}>
        Observações da engenharia
        <textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          readOnly={!editavel}
          maxLength={MAX_OBSERVACOES}
          rows={8}
          className={`${campoCls} py-2 ${editavel ? '' : 'bg-[#f6f6f5]'}`}
          placeholder={editavel ? 'Desvios, gargalos e ações de recuperação da semana' : 'Sem observações.'}
        />
      </label>
      {editavel ? (
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={salvar} disabled={!!ocupado || (!sujo && existe)} className={botaoSecundario}>
            {ocupado === 'salvar' ? 'Salvando…' : 'Salvar rascunho'}
          </button>
          {ia ? (
            <button type="button" onClick={sugerir} disabled={!!ocupado} className={botaoSecundario}>
              {ocupado === 'ia' ? 'Escrevendo…' : 'Sugerir texto com IA'}
            </button>
          ) : null}
        </div>
      ) : null}
      {podeEnviar && estado !== 'enviado' && estado !== 'nao_iniciado' ? (
        <div className="flex flex-col gap-1">
          <button
            type="button"
            onClick={enviar}
            disabled={!!ocupado || sujo || !temClienteSemanal}
            className={botaoPrincipal}
          >
            {ocupado === 'enviar' ? 'Enviando…' : estado === 'rascunho' ? 'Validar e enviar' : 'Enviar a quem falta'}
          </button>
          {sujo ? <p className="text-xs text-[#5a7380]">Salve as observações antes de validar.</p> : null}
          {!temClienteSemanal ? (
            <p className="text-xs text-[#b23232]">
              Nenhum destinatário do cliente com o tipo Semanal em Configurações da obra.
            </p>
          ) : null}
        </div>
      ) : null}
      {podeEnviar && estado === 'enviado' ? (
        <button type="button" onClick={enviar} disabled={!!ocupado} className={botaoSecundario}>
          Enviar a quem falta
        </button>
      ) : null}
      {msg ? (
        <p role={msg.ok ? 'status' : 'alert'} className={`text-sm ${msg.ok ? 'text-[#136c38]' : 'text-[#b23232]'}`}>
          {msg.texto}
        </p>
      ) : null}
    </div>
  )
}
