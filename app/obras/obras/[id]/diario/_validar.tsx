'use client'

/**
 * "Validar e enviar" do diário (Task 9b). Só aparece para o engenheiro da obra
 * ou admin (a action confere de novo no servidor). "Ver prévia" mostra o e-mail
 * do lado cliente num iframe isolado, montado com o que está salvo.
 *
 * Item 10 da reunião de 31/10: em rascunho, "Validar e enviar" primeiro grava o
 * que está na tela (`salvarAntes`, a mesma action do rascunho, com a mesma
 * validação) e só então valida e envia — nunca manda dado velho.
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
  pendentes = null,
  salvarAntes,
}: {
  obraId: string
  data: string
  estado: EstadoRdo
  /** Sem RDO gravado ainda não há prévia. */
  previaHtml: string | null
  /** Grava o formulário atual; `false` = não gravou (o erro já aparece no formulário). */
  salvarAntes?: () => Promise<boolean>
  /** Já enviado: quantos destinatários ainda não receberam. */
  pendentes?: number | null
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
      if (estado === 'rascunho' && salvarAntes && !(await salvarAntes())) {
        setErro('O diário não foi salvo — corrija o que aparece acima e tente de novo. Nada foi enviado.')
        return
      }
      const r = await validarEEnviarAction(obraId, data)
      if (r.ok) {
        setAviso(r.enviados ? `Diário enviado para ${r.enviados} destinatário(s).` : 'Nada pendente: todos os destinatários já receberam.')
      } else setErro(r.erro)
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
    <section className="mx-auto flex w-full max-w-xl flex-col gap-3 rounded-xl border border-[#dadad8] bg-[#f6f6f5] p-3">
      <div>
        <h3 className="font-bold text-[#00345e]">Validar e enviar</h3>
        <p className="text-sm text-[#5a7380]">
          {estado === 'enviado'
            ? `Diário enviado, mas ${pendentes ?? 0} destinatário(s) ainda não receberam. Enviar de novo manda só para eles.`
            : estado === 'validado'
            ? 'Diário já validado, mas o e-mail não saiu. Enviar de novo manda só para quem ainda não recebeu.'
            : 'Ao validar, o avanço do dia vai para o cronograma e o diário não pode mais ser alterado. O que está na tela é salvo antes de enviar.'}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {previaHtml !== null ? (
          <button
            type="button"
            onClick={() => setPrevia((v) => !v)}
            className={`${botao} border border-[#dadad8] text-[#333336] hover:border-[#b94606]`}
          >
            {previa ? 'Fechar prévia' : 'Ver prévia'}
          </button>
        ) : null}
        <button type="button" onClick={enviar} disabled={enviando} className={`${botao} bg-[#b94606] text-white`}>
          {enviando ? 'Enviando…' : estado === 'rascunho' ? 'Validar e enviar' : 'Enviar de novo'}
        </button>
      </div>
      {erro ? (
        <p role="alert" className="rounded-lg border border-[#b23232] bg-[#b232321a] px-3 py-2 text-sm text-[#b23232]">
          {erro}
        </p>
      ) : null}
      {aviso ? (
        <p className="rounded-lg border border-[#136c38] bg-[#1f9d551a] px-3 py-2 text-sm text-[#333336]">{aviso}</p>
      ) : null}
      {previa && previaHtml !== null ? (
        <div className="flex flex-col gap-1">
          <p className="text-xs text-[#5a7380]">
            Prévia do e-mail do cliente com o que está salvo. Os percentuais ainda não incluem o avanço de hoje — ele
            entra no cronograma na validação.
          </p>
          <iframe
            title="Prévia do e-mail do cliente"
            srcDoc={previaHtml}
            sandbox=""
            className="h-[640px] w-full rounded-lg border border-[#dadad8] bg-white"
          />
        </div>
      ) : null}
    </section>
  )
}
