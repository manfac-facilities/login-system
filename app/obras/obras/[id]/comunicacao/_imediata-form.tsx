'use client'

/**
 * Comunicação imediata (Leva 2 §3.5): assunto, texto, nível e vínculo opcional
 * a impedimento ou atividade. Confirmação mostra quem recebe (tipo Imediato)
 * e o texto antes de enviar (§6.1-3). Só engenheiro/admin vê este formulário.
 */

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { enviarImediataAction } from './_actions'
import { Chip, botaoPrincipal, botaoSecundario, campoCls, rotuloCls } from './_registro-form'
import { NIVEIS, type DestinatarioOpcao, type NivelImediata } from './_tipos'

export default function FormImediata({
  obraId,
  destinatarios,
  impedimentos,
  atividades,
}: {
  obraId: string
  /** Já filtrados: ativos com tipo `imediato`. */
  destinatarios: DestinatarioOpcao[]
  impedimentos: { id: string; descricao: string }[]
  atividades: { numero: number; descricao: string }[]
}) {
  const router = useRouter()
  const [assunto, setAssunto] = useState('')
  const [texto, setTexto] = useState('')
  const [nivel, setNivel] = useState<NivelImediata | null>(null)
  const [impedimentoId, setImpedimentoId] = useState('')
  const [atividade, setAtividade] = useState('')
  const [confirmar, setConfirmar] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null)

  const pronto = assunto.trim().length >= 3 && texto.trim() && nivel && destinatarios.length > 0

  async function enviar() {
    if (!nivel) return
    setEnviando(true)
    setMsg(null)
    try {
      const r = await enviarImediataAction(obraId, {
        assunto,
        texto,
        nivel,
        impedimentoId: impedimentoId || null,
        atividadeNumero: atividade ? Number(atividade) : null,
      })
      setConfirmar(false)
      if (r.ok) {
        setMsg({ ok: true, texto: `Enviada a ${r.enviados} destinatário(s).` })
        setAssunto(''); setTexto(''); setNivel(null); setImpedimentoId(''); setAtividade('')
      } else {
        setMsg({ ok: false, texto: r.erro })
      }
      router.refresh()
    } finally {
      setEnviando(false)
    }
  }

  const nome = (d: DestinatarioOpcao) => (d.nome ? `${d.nome} <${d.email}>` : d.email)

  if (confirmar) {
    return (
      <div className="flex flex-col gap-2 rounded-lg border border-[#b94606] bg-[#ffffff] p-3 text-sm text-[#333336]">
        <p className="font-semibold text-[#00345e]">Confirmar comunicação imediata</p>
        <p>
          <strong>{nivel === 'urgente' ? 'URGENTE' : 'ATENÇÃO'}</strong> — {assunto}
        </p>
        <p className="whitespace-pre-wrap break-words rounded-lg bg-[#f6f6f5] p-2">{texto}</p>
        <p className="text-xs text-[#5a7380]">
          O cliente recebe a versão cliente (impedimento oculto fica de fora); os internos recebem a versão interna.
        </p>
        <ul className="list-disc pl-5">
          {destinatarios.map((d) => (
            <li key={d.email} className="break-all">
              {nome(d)} · {d.lado === 'cliente' ? 'cliente' : 'interno'}
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={enviando} onClick={enviar} className={botaoPrincipal}>
            {enviando ? 'Enviando…' : `Enviar a ${destinatarios.length}`}
          </button>
          <button type="button" disabled={enviando} onClick={() => setConfirmar(false)} className={botaoSecundario}>
            Voltar
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <label className={rotuloCls}>
        Assunto
        <input value={assunto} onChange={(e) => setAssunto(e.target.value)} maxLength={150} className={campoCls} />
      </label>
      <label className={rotuloCls}>
        Texto
        <textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={4} className={`${campoCls} py-2`} />
      </label>
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Nível">
        <span className="text-xs text-[#5a7380]">Nível</span>
        {NIVEIS.map((n) => (
          <Chip key={n.valor} ativo={nivel === n.valor} onClick={() => setNivel(n.valor)}>
            {n.rotulo}
          </Chip>
        ))}
      </div>
      <label className={rotuloCls}>
        Impedimento (opcional)
        <select value={impedimentoId} onChange={(e) => setImpedimentoId(e.target.value)} className={campoCls}>
          <option value="">—</option>
          {impedimentos.map((i) => (
            <option key={i.id} value={i.id}>{i.descricao.slice(0, 70)}</option>
          ))}
        </select>
      </label>
      <label className={rotuloCls}>
        Atividade (opcional)
        <select value={atividade} onChange={(e) => setAtividade(e.target.value)} className={campoCls}>
          <option value="">—</option>
          {atividades.map((a) => (
            <option key={a.numero} value={a.numero}>{a.numero} · {a.descricao}</option>
          ))}
        </select>
      </label>
      {destinatarios.length === 0 ? (
        <p className="text-sm text-[#5a7380]">Nenhum destinatário com o tipo Imediato (Configurações da obra).</p>
      ) : null}
      {msg ? (
        <p role={msg.ok ? 'status' : 'alert'} className={`text-sm ${msg.ok ? 'text-[#136c38]' : 'text-[#b23232]'}`}>
          {msg.texto}
        </p>
      ) : null}
      <button type="button" disabled={!pronto} onClick={() => setConfirmar(true)} className={`${botaoPrincipal} self-start`}>
        Revisar e enviar
      </button>
    </div>
  )
}
