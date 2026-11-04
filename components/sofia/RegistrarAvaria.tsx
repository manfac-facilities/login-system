'use client'
import { useState } from 'react'
import FotosAdicionais, { novoIdLocal } from './FotosAdicionais'
import {
  PECAS_AVARIA,
  TAMANHOS_AVARIA,
  contarFotos,
  rotuloTamanho,
  validarAvariaRascunho,
  type AvariaRascunho,
} from '@/lib/sofia/fotosChecklist'

const CAMPO =
  'px-3 py-2.5 rounded-lg bg-[#0f1f3d] border border-[#1e3a5f] text-white placeholder-[#4a6080] focus:outline-none focus:border-[#f05a28] text-sm'

function vazia(): AvariaRascunho {
  return { id: novoIdLocal('av'), peca: '', tamanho: '', acao: '', descricao: '', fotosPeca: [], fotosDano: [] }
}

/**
 * Aba de avarias do checklist (mockup aba 3): "Avarias do checklist (n)" e
 * "+ Registrar avaria". Exige peça, tamanho, ≥1 foto da peça e ≥1 foto da avaria.
 * `totalOutras` = fotos do formulário fora das avarias (para o teto de 30).
 */
export default function RegistrarAvaria({
  avarias,
  onChange,
  totalOutras,
  permitirGaleria = false,
}: {
  avarias: AvariaRascunho[]
  onChange: (a: AvariaRascunho[]) => void
  totalOutras: number
  permitirGaleria?: boolean
}) {
  const [aba, setAba] = useState<'lista' | 'nova'>('lista')
  const [rascunho, setRascunho] = useState<AvariaRascunho>(vazia)
  const [msg, setMsg] = useState<string | null>(null)

  const totalGeral =
    totalOutras + contarFotos({ obrigatorias: 0, interna: 0, extras: 0, avarias: [...avarias, rascunho] })

  function adicionar() {
    const falta = validarAvariaRascunho(rascunho)
    if (falta) {
      setMsg(falta)
      return
    }
    onChange([...avarias, rascunho])
    setRascunho(vazia())
    setMsg(null)
    setAba('lista')
  }

  function remover(id: string) {
    onChange(avarias.filter((a) => a.id !== id))
  }

  const botaoAba = (k: 'lista' | 'nova', rotulo: string) => (
    <button
      type="button"
      onClick={() => setAba(k)}
      className={`flex-1 px-3 py-2 text-sm rounded-lg ${aba === k ? 'bg-[#f05a28] text-white' : 'text-[#94a3b8]'}`}
    >
      {rotulo}
    </button>
  )

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-1 p-1 rounded-lg border border-[#1e3a5f]">
        {botaoAba('lista', `Avarias do checklist (${avarias.length})`)}
        {botaoAba('nova', '+ Registrar avaria')}
      </div>

      {aba === 'lista' ? (
        avarias.length === 0 ? (
          <p className="text-xs text-[#4a6080]">Nenhuma avaria registrada neste checklist. Use &quot;Registrar avaria&quot;.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {avarias.map((a) => (
              <div key={a.id} className="rounded-lg border border-[#1e3a5f] p-3 flex flex-col gap-1">
                <div className="flex justify-between gap-2">
                  <span className="text-sm text-white font-bold">{a.peca}</span>
                  <button type="button" onClick={() => remover(a.id)} className="text-xs text-red-400 hover:underline">
                    Remover
                  </button>
                </div>
                <span className="text-xs text-[#94a3b8]">
                  {rotuloTamanho(a.tamanho)} · {a.acao === 'reparo' ? 'Reparo' : a.acao === 'troca' ? 'Troca' : 'reparo ou troca: a definir'}
                </span>
                {a.descricao && <span className="text-sm text-[#94a3b8]">{a.descricao}</span>}
                <span className="text-xs text-[#4a6080]">
                  {a.fotosPeca.length} foto(s) da peça · {a.fotosDano.length} foto(s) da avaria
                </span>
              </div>
            ))}
          </div>
        )
      ) : (
        <div className="rounded-lg border border-[#1e3a5f] p-3 flex flex-col gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm text-[#94a3b8]">Peça *</span>
            <select value={rascunho.peca} onChange={(e) => setRascunho({ ...rascunho, peca: e.target.value })} className={CAMPO}>
              <option value="">Selecione</option>
              {PECAS_AVARIA.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm text-[#94a3b8]">Tamanho *</span>
            <select
              value={rascunho.tamanho}
              onChange={(e) => setRascunho({ ...rascunho, tamanho: e.target.value as AvariaRascunho['tamanho'] })}
              className={CAMPO}
            >
              <option value="">Selecione</option>
              {TAMANHOS_AVARIA.map((t) => (
                <option key={t.valor} value={t.valor}>
                  {t.rotulo}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm text-[#94a3b8]">
              Precisa de reparo ou troca? <span className="text-[#4a6080]">(opcional: o motorista pode não saber)</span>
            </span>
            <select
              value={rascunho.acao}
              onChange={(e) => setRascunho({ ...rascunho, acao: e.target.value as AvariaRascunho['acao'] })}
              className={CAMPO}
            >
              <option value="">A definir por Frotas</option>
              <option value="reparo">Reparo</option>
              <option value="troca">Troca</option>
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm text-[#94a3b8]">Descrição</span>
            <textarea
              rows={2}
              value={rascunho.descricao}
              onChange={(e) => setRascunho({ ...rascunho, descricao: e.target.value })}
              placeholder="Ex.: risco horizontal na parte inferior, lado direito"
              className={`${CAMPO} resize-none`}
            />
          </label>
          <div className="flex flex-col gap-1.5">
            <span className="text-sm text-[#94a3b8]">
              Foto da peça inteira * <span className="text-[#4a6080]">(mostra onde fica)</span>
            </span>
            <FotosAdicionais
              fotos={rascunho.fotosPeca}
              onChange={(f) => setRascunho((r) => ({ ...r, fotosPeca: f }))}
              totalAtual={totalGeral}
              rotuloBotao="+ foto da peça"
              permitirGaleria={permitirGaleria}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-sm text-[#94a3b8]">
              Foto(s) da avaria * <span className="text-[#4a6080]">(close, centralizada no dano)</span>
            </span>
            <FotosAdicionais
              fotos={rascunho.fotosDano}
              onChange={(f) => setRascunho((r) => ({ ...r, fotosDano: f }))}
              totalAtual={totalGeral}
              rotuloBotao="+ foto da avaria"
              permitirGaleria={permitirGaleria}
            />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={adicionar}
              className="px-4 py-2 rounded-lg bg-[#f05a28] text-white text-sm font-medium hover:bg-[#d94e22] active:scale-95"
            >
              Adicionar avaria ao checklist
            </button>
            {msg && <span className="text-xs text-red-400">{msg}</span>}
          </div>
        </div>
      )}
    </div>
  )
}
