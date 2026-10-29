'use client'

/**
 * "Validar e enviar" do diário (Task 9b). Só aparece para o engenheiro da obra
 * ou admin (a action confere de novo no servidor). "Ver prévia" mostra o e-mail
 * do lado cliente num iframe isolado, montado com o que está salvo.
 */
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { validarEEnviarAction } from './_actions'
import type { EstadoRdo } from './_tipos'

export default function ValidarDiario({
  obraId,
  data,
  estado,
  previaHtml,
}: {
  obraId: string
  data: string
  estado: EstadoRdo
  previaHtml: string
}) {
  const router = useRouter()
  const [previa, setPrevia] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)

  async function enviar() {
    setEnviando(true)
    setErro(null)
    setAviso(null)
    try {
      const r = await validarEEnviarAction(obraId, data)
      if (r.ok) setAviso(`Diário enviado para ${r.enviados ?? 0} destinatário(s).`)
      else setErro(r.erro)
      router.refresh()
    } catch {
      setErro('Não deu para validar e enviar. Confira a conexão e tente de novo.')
    } finally {
      setEnviando(false)
    }
  }

  const botao =
    'flex min-h-11 items-center justify-center rounded-lg px-4 text-sm font-semibold disabled:opacity-50'

  return (
    <section className="mx-auto flex w-full max-w-xl flex-col gap-3 rounded-xl border border-[#1e3a5f] bg-[#0d2050] p-3">
      <div>
        <h3 className="font-bold text-white">Validar e enviar</h3>
        <p className="text-sm text-[#94a3b8]">
          {estado === 'validado'
            ? 'Diário já validado, mas o e-mail não saiu. Você pode tentar enviar de novo.'
            : 'Ao validar, o avanço do dia vai para o cronograma e o diário não pode mais ser alterado. Salve o rascunho antes.'}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setPrevia((v) => !v)}
          className={`${botao} border border-[#1e3a5f] text-[#e8eef7] hover:border-[#f05a28]`}
        >
          {previa ? 'Fechar prévia' : 'Ver prévia'}
        </button>
        <button type="button" onClick={enviar} disabled={enviando} className={`${botao} bg-[#f05a28] text-white`}>
          {enviando ? 'Enviando…' : estado === 'validado' ? 'Enviar de novo' : 'Validar e enviar'}
        </button>
      </div>
      {erro ? (
        <p role="alert" className="rounded-lg border border-[#dc2626] bg-[#dc26261a] px-3 py-2 text-sm text-[#fecaca]">
          {erro}
        </p>
      ) : null}
      {aviso ? (
        <p className="rounded-lg border border-[#16a34a] bg-[#16a34a1a] px-3 py-2 text-sm text-[#e8eef7]">{aviso}</p>
      ) : null}
      {previa ? (
        <div className="flex flex-col gap-1">
          <p className="text-xs text-[#94a3b8]">
            Prévia do e-mail do cliente com o que está salvo. Os percentuais ainda não incluem o avanço de hoje — ele
            entra no cronograma na validação.
          </p>
          <iframe
            title="Prévia do e-mail do cliente"
            srcDoc={previaHtml}
            sandbox=""
            className="h-[640px] w-full rounded-lg border border-[#1e3a5f] bg-white"
          />
        </div>
      ) : null}
    </section>
  )
}
