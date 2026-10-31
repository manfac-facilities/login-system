'use client'

/**
 * Documentos da obra (Leva 5 §3.1). O navegador sobe o arquivo direto para o
 * bucket privado `obras-docs` com a sessão do usuário (as policies do storage
 * exigem engenheiro/admin) e só depois registra a linha, como nas fotos do diário.
 */

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ACCEPT_DOC, BUCKET_DOCS, PASTAS, montarPathDoc, validarArquivoDoc } from '../../_lib/documentos'
import { apagarDocumentoAction, registrarDocumentoAction, urlDocumentoAction } from './_actions-portal'
import type { DocumentoLinha } from './_tipos-portal'

const botao = 'min-h-11 rounded-lg border border-[#dadad8] px-3 text-sm text-[#333336] hover:border-[#b94606] disabled:opacity-45'
const tamanhoBR = (n: number | null) => (n == null ? '' : n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`)

export default function DocumentosObra({ obraId, itens, pode }: { obraId: string; itens: DocumentoLinha[]; pode: boolean }) {
  const router = useRouter()
  const input = useRef<HTMLInputElement>(null)
  const [pasta, setPasta] = useState<string>(PASTAS[0].valor)
  const [erro, setErro] = useState<string | null>(null)
  const [indo, setIndo] = useState(false)

  async function subir(lista: FileList | null) {
    const arquivo = lista?.[0]
    if (input.current) input.current.value = ''
    if (!arquivo) return
    setErro(null)
    const invalido = validarArquivoDoc({ nome: arquivo.name, tamanho: arquivo.size })
    if (invalido) return setErro(invalido)
    setIndo(true)
    try {
      const path = montarPathDoc(obraId, crypto.randomUUID(), arquivo.name)
      const { error } = await createClient().storage.from(BUCKET_DOCS).upload(path, arquivo, { contentType: arquivo.type || undefined })
      if (error) return setErro('Não deu para enviar o arquivo. Tente de novo.')
      const r = await registrarDocumentoAction(obraId, { pasta, nome: arquivo.name, tamanho: arquivo.size, tipo: arquivo.type || null, path })
      if (!r.ok) return setErro(r.erro)
      router.refresh()
    } finally {
      setIndo(false)
    }
  }

  async function baixar(id: string) {
    setErro(null)
    const r = await urlDocumentoAction(obraId, id)
    if (!r.ok || !r.url) return setErro(r.ok ? 'Não foi possível gerar o link.' : r.erro)
    window.open(r.url, '_blank', 'noopener')
  }

  async function apagar(d: DocumentoLinha) {
    if (!window.confirm(`Apagar "${d.nome}"? O arquivo sai também da página do cliente.`)) return
    setErro(null)
    const r = await apagarDocumentoAction(obraId, d.id)
    if (!r.ok) return setErro(r.erro)
    router.refresh()
  }

  return (
    <section className="flex flex-col gap-3" aria-labelledby="docs-obra">
      <h2 id="docs-obra" className="text-lg font-bold text-[#00345e]">Documentos</h2>
      {PASTAS.map((p) => {
        const da = itens.filter((d) => d.pasta === p.valor)
        if (!da.length) return null
        return (
          <div key={p.valor} className="flex flex-col gap-2">
            <h3 className="text-sm font-semibold text-[#5a7380]">{p.rotulo}</h3>
            <ul className="flex flex-col gap-2">
              {da.map((d) => (
                <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#dadad8] p-3 text-sm text-[#333336]">
                  <span className="min-w-0 break-words">
                    <strong>{d.nome}</strong>
                    <br />
                    <span className="text-xs text-[#5a7380]">{tamanhoBR(d.tamanho)}{d.criadoPor ? ` · ${d.criadoPor}` : ''}</span>
                  </span>
                  <span className="flex gap-2">
                    <button type="button" className={botao} onClick={() => baixar(d.id)}>Baixar</button>
                    {pode ? <button type="button" className={botao} onClick={() => apagar(d)}>Apagar</button> : null}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )
      })}
      {itens.length === 0 ? <p className="text-sm text-[#5a7380]">Nenhum documento ainda.</p> : null}
      {pode ? (
        <div className="flex flex-col gap-2 rounded-xl border border-[#dadad8] p-3">
          <select aria-label="Pasta" className="min-h-11 rounded-lg border border-[#dadad8] bg-[#ffffff] px-3 text-base text-[#333336]" value={pasta} onChange={(e) => setPasta(e.target.value)}>
            {PASTAS.map((p) => <option key={p.valor} value={p.valor}>{p.rotulo}</option>)}
          </select>
          <input ref={input} type="file" accept={ACCEPT_DOC} aria-label="Arquivo" disabled={indo} onChange={(e) => subir(e.target.files)} className="min-h-11 text-sm text-[#333336]" />
          <p className="text-xs text-[#5a7380]">PDF, JPG, PNG, DWG, XLSX ou DOCX, até 25 MB.</p>
          {indo ? <p role="status" className="text-xs text-[#5a7380]">enviando…</p> : null}
        </div>
      ) : null}
      {erro ? <p role="alert" className="text-xs text-[#b23232]">{erro}</p> : null}
    </section>
  )
}
