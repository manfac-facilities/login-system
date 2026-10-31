'use client'

/**
 * Rascunho do relatório de período (Leva 4 §2.1/§2.3): destaques automáticos
 * marcáveis + um destaque livre, observações da engenharia (IA opcional),
 * Salvar / Validar e enviar. Validar exige o rascunho SALVO (botão desabilitado
 * com alteração pendente; a action relê do banco). Os ids dos destaques só
 * servem para marcar/desmarcar aqui — nunca vão ao conteúdo do cliente.
 */

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { salvarRascunhoRelatorioAction, sugerirObservacoesRelatorioIaAction, validarEEnviarRelatorioAction } from './_actions'
import { botaoPrincipal, botaoSecundario, campoCls, rotuloCls } from '../../../_registro-form'
import { MAX_HIGHLIGHT_LIVRE, MAX_OBSERVACOES, type EstadoTela } from './_tipos'

export default function FormRelatorio({
  obraId,
  tipo,
  referencia,
  estado,
  observacoes,
  destaques,
  marcados,
  livre,
  congelados,
  podeEnviar,
  ia,
  temCliente,
  rotuloDestinatarios,
  validarAPartirDe,
}: {
  obraId: string
  tipo: string
  referencia: string
  estado: EstadoTela
  observacoes: string
  /** Automáticos do período (rascunho). */
  destaques: { id: string; texto: string }[]
  marcados: string[]
  livre: string
  /** Validado/enviado: os textos que foram ao cliente. */
  congelados: string[]
  podeEnviar: boolean
  ia: boolean
  temCliente: boolean
  rotuloDestinatarios: string
  /** Mensal antes do último dia útil do mês: "dd/mm/aaaa" a partir de quando valida (o servidor confere). */
  validarAPartirDe?: string | null
}) {
  const router = useRouter()
  const inicial = JSON.stringify({ o: observacoes.trim(), m: [...marcados].sort(), l: livre.trim() })
  const [texto, setTexto] = useState(observacoes)
  const [sel, setSel] = useState<Set<string>>(new Set(marcados))
  const [livreTxt, setLivreTxt] = useState(livre)
  const [salvo, setSalvo] = useState(inicial)
  const [ocupado, setOcupado] = useState<null | 'salvar' | 'ia' | 'enviar'>(null)
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null)

  const editavel = podeEnviar && (estado === 'nao_iniciado' || estado === 'rascunho')
  const atual = JSON.stringify({ o: texto.trim(), m: [...sel].sort(), l: livreTxt.trim() })
  const sujo = atual !== salvo
  const existe = estado !== 'nao_iniciado'

  function alternar(id: string) {
    setSel((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  }

  async function salvar() {
    setOcupado('salvar')
    setMsg(null)
    try {
      const r = await salvarRascunhoRelatorioAction(obraId, tipo, referencia, { observacoes: texto, marcados: [...sel], livre: livreTxt })
      if (r.ok) {
        setSalvo(atual)
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
      const r = await sugerirObservacoesRelatorioIaAction(obraId, tipo, referencia)
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
        ? 'Validar e enviar o relatório? Depois de validado o conteúdo não muda mais.'
        : 'Enviar o relatório a quem ainda não recebeu?'
    if (!window.confirm(aviso)) return
    setOcupado('enviar')
    setMsg(null)
    try {
      const r = await validarEEnviarRelatorioAction(obraId, tipo, referencia)
      if (r.ok) setMsg({ ok: true, texto: r.enviados ? `Enviado a ${r.enviados} destinatário(s).` : 'Todos já tinham recebido.' })
      else setMsg({ ok: false, texto: r.erro })
      router.refresh()
    } finally {
      setOcupado(null)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <fieldset className="flex flex-col gap-1">
        <legend className={rotuloCls}>Destaques do período</legend>
        {editavel ? (
          <>
            {destaques.length ? (
              destaques.map((h) => (
                <label key={h.id} className="flex min-h-11 cursor-pointer items-start gap-2 rounded-lg px-1 py-2 hover:bg-[#f6f6f5]">
                  <input
                    type="checkbox"
                    checked={sel.has(h.id)}
                    onChange={() => alternar(h.id)}
                    className="mt-0.5 h-5 w-5 shrink-0 accent-[#b94606]"
                  />
                  <span>{h.texto}</span>
                </label>
              ))
            ) : (
              <p className="text-xs text-[#5a7380]">Nenhum destaque automático neste período.</p>
            )}
            <label className={`${rotuloCls} mt-1`}>
              Destaque livre (opcional)
              <input
                type="text"
                value={livreTxt}
                onChange={(e) => setLivreTxt(e.target.value)}
                maxLength={MAX_HIGHLIGHT_LIVRE}
                className={campoCls}
                placeholder="Ex.: liberação antecipada da área de vendas"
              />
            </label>
          </>
        ) : (congelados.length || (!existe && destaques.length)) ? (
          <ul className="list-disc pl-5">
            {(existe ? congelados : destaques.map((h) => h.texto)).map((t, i) => (
              <li key={i}>{t}</li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-[#5a7380]">Sem destaques.</p>
        )}
      </fieldset>

      <label className={rotuloCls}>
        Observações da engenharia
        <textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          readOnly={!editavel}
          maxLength={MAX_OBSERVACOES}
          rows={8}
          className={`${campoCls} py-2 ${editavel ? '' : 'bg-[#f6f6f5]'}`}
          placeholder={editavel ? 'Avanço, marcos, gargalos e próximos passos do período' : 'Sem observações.'}
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
          <button type="button" onClick={enviar} disabled={!!ocupado || sujo || !temCliente || !!validarAPartirDe} className={botaoPrincipal}>
            {ocupado === 'enviar' ? 'Enviando…' : estado === 'rascunho' ? 'Validar e enviar' : 'Enviar a quem falta'}
          </button>
          {sujo ? <p className="text-xs text-[#5a7380]">Salve o rascunho antes de validar.</p> : null}
          {validarAPartirDe ? (
            <p className="text-xs text-[#5a7380]">O mensal só pode ser validado a partir de {validarAPartirDe} (último dia útil do mês).</p>
          ) : null}
          {!temCliente ? (
            <p className="text-xs text-[#b23232]">Nenhum destinatário do cliente com o tipo {rotuloDestinatarios} em Configurações da obra.</p>
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
