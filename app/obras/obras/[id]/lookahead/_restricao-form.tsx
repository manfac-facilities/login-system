'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { criarRestricaoAction } from './_actions'
import { RESPONSAVEIS_RESTRICAO, TIPOS_RESTRICAO } from './_tipos'

const campo = 'min-h-11 w-full rounded-lg border border-[#dadad8] bg-white px-3 text-sm text-[#333336]'

/** Botão "Restrição" na atividade; abre o formulário embaixo. */
export default function RestricaoForm({ obraId, numero, codigo }: { obraId: string; numero: number; codigo: string }) {
  const router = useRouter()
  const [aberto, setAberto] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [indo, setIndo] = useState(false)

  async function enviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    setIndo(true)
    setErro(null)
    try {
      const r = await criarRestricaoAction(obraId, {
        atividadeNumero: numero,
        tipo: String(f.get('tipo')),
        descricao: String(f.get('descricao') ?? ''),
        responsavel: String(f.get('responsavel')),
        prazo: String(f.get('prazo') ?? '') || null,
      })
      if (!r.ok) return setErro(r.erro)
      setAberto(false)
      router.refresh()
    } catch {
      setErro('Não deu para salvar. Confira a conexão e tente de novo.')
    } finally {
      setIndo(false)
    }
  }

  if (!aberto) {
    return (
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="min-h-11 rounded-lg border border-[#dadad8] px-3 text-sm text-[#333336] hover:border-[#b94606]"
      >
        + Restrição
      </button>
    )
  }
  return (
    <form onSubmit={enviar} className="flex w-full flex-col gap-2 rounded-xl border border-[#dadad8] bg-[#f6f6f5] p-3">
      <p className="text-sm font-semibold text-[#00345e]">Nova restrição em {codigo}</p>
      <select name="tipo" aria-label="Tipo" className={campo} defaultValue="acesso">
        {TIPOS_RESTRICAO.map((t) => (
          <option key={t.valor} value={t.valor}>{t.rotulo}</option>
        ))}
      </select>
      <textarea name="descricao" aria-label="Descrição" required rows={2} placeholder="O que impede de começar?" className={campo + ' py-2'} />
      <select name="responsavel" aria-label="Responsável" className={campo} defaultValue="manfac">
        {RESPONSAVEIS_RESTRICAO.map((r) => (
          <option key={r.valor} value={r.valor}>{r.rotulo}</option>
        ))}
      </select>
      <label className="text-xs text-[#5a7380]">
        Prazo para liberar
        <input type="date" name="prazo" className={campo} />
      </label>
      {erro ? <p role="alert" className="text-xs text-[#b23232]">{erro}</p> : null}
      <div className="flex gap-2">
        <button type="submit" disabled={indo} className="min-h-11 rounded-lg bg-[#b94606] px-4 text-sm font-semibold text-white disabled:opacity-45">
          {indo ? 'salvando…' : 'Salvar'}
        </button>
        <button type="button" onClick={() => setAberto(false)} className="min-h-11 rounded-lg border border-[#dadad8] px-4 text-sm text-[#333336]">
          Cancelar
        </button>
      </div>
    </form>
  )
}
