'use client'

/**
 * Enviar a ata por e-mail (Leva 2 §3.1, §6.1-3): escolhe entre os
 * destinatários cadastrados da obra (padrão: lado cliente com tipo diário),
 * confirma mostrando quem recebe e envia com o PDF anexo.
 */

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { enviarAtaAction } from './_actions'
import { botaoPrincipal, botaoSecundario } from './_registro-form'
import type { DestinatarioOpcao } from './_tipos'

export default function EnvioAta({
  obraId,
  registroId,
  resumo,
  destinatarios,
}: {
  obraId: string
  registroId: string
  /** Pauta (o texto que vai no e-mail), mostrado na confirmação. */
  resumo: string
  destinatarios: DestinatarioOpcao[]
}) {
  const router = useRouter()
  const padrao = () => new Set(destinatarios.filter((d) => d.lado === 'cliente' && d.tipos.includes('diario')).map((d) => d.email))
  const [passo, setPasso] = useState<'fechado' | 'escolher' | 'confirmar'>('fechado')
  const [escolhidos, setEscolhidos] = useState<Set<string>>(padrao)
  const [enviando, setEnviando] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null)

  const alternar = (e: string) =>
    setEscolhidos((s) => {
      const n = new Set(s)
      if (n.has(e)) n.delete(e)
      else n.add(e)
      return n
    })

  async function enviar() {
    setEnviando(true)
    setMsg(null)
    try {
      const r = await enviarAtaAction(obraId, registroId, [...escolhidos])
      setMsg(r.ok ? { ok: true, texto: `Ata enviada a ${r.enviados} destinatário(s).` } : { ok: false, texto: r.erro })
      setPasso('fechado')
      router.refresh()
    } finally {
      setEnviando(false)
    }
  }

  const lista = destinatarios.filter((d) => escolhidos.has(d.email))
  const nome = (d: DestinatarioOpcao) => (d.nome ? `${d.nome} <${d.email}>` : d.email)

  return (
    <div className="flex flex-col gap-2">
      {passo === 'fechado' ? (
        <button
          type="button"
          onClick={() => { setEscolhidos(padrao()); setPasso('escolher'); setMsg(null) }}
          className={`${botaoSecundario} self-start`}
        >
          Enviar por e-mail
        </button>
      ) : null}

      {passo === 'escolher' ? (
        <div className="flex flex-col gap-2 rounded-lg border border-[#dadad8] bg-[#f6f6f5] p-3">
          {destinatarios.length === 0 ? (
            <p className="text-sm text-[#5a7380]">Nenhum destinatário cadastrado (Configurações da obra).</p>
          ) : (
            (['cliente', 'interno'] as const).map((lado) => {
              const doLado = destinatarios.filter((d) => d.lado === lado)
              if (!doLado.length) return null
              return (
                <fieldset key={lado} className="flex flex-col gap-1">
                  <legend className="text-xs font-semibold text-[#5a7380]">{lado === 'cliente' ? 'Lado cliente' : 'Interno'}</legend>
                  {doLado.map((d) => (
                    <label key={d.email} className="flex min-h-11 items-center gap-2 text-sm text-[#333336]">
                      <input type="checkbox" checked={escolhidos.has(d.email)} onChange={() => alternar(d.email)} className="h-5 w-5" />
                      <span className="break-all">{nome(d)}</span>
                    </label>
                  ))}
                </fieldset>
              )
            })
          )}
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={!escolhidos.size} onClick={() => setPasso('confirmar')} className={botaoPrincipal}>
              Revisar envio
            </button>
            <button type="button" onClick={() => setPasso('fechado')} className={botaoSecundario}>
              Cancelar
            </button>
          </div>
        </div>
      ) : null}

      {passo === 'confirmar' ? (
        <div className="flex flex-col gap-2 rounded-lg border border-[#b94606] bg-[#ffffff] p-3 text-sm text-[#333336]">
          <p className="font-semibold text-[#00345e]">Confirmar envio da ata (PDF anexo)</p>
          <p className="text-xs text-[#5a7380]">Pauta: {resumo}</p>
          <p className="text-xs text-[#5a7380]">O texto da ata é de quem escreveu: confira antes de mandar ao cliente.</p>
          <ul className="list-disc pl-5">
            {lista.map((d) => (
              <li key={d.email} className="break-all">
                {nome(d)} · {d.lado === 'cliente' ? 'cliente' : 'interno'}
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={enviando} onClick={enviar} className={botaoPrincipal}>
              {enviando ? 'Enviando…' : `Enviar a ${lista.length}`}
            </button>
            <button type="button" disabled={enviando} onClick={() => setPasso('escolher')} className={botaoSecundario}>
              Voltar
            </button>
          </div>
        </div>
      ) : null}

      {msg ? (
        <p role={msg.ok ? 'status' : 'alert'} className={`text-sm ${msg.ok ? 'text-[#136c38]' : 'text-[#b23232]'}`}>
          {msg.texto}
        </p>
      ) : null}
    </div>
  )
}
