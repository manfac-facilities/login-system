import { createClient } from '@/lib/supabase/server'
import { hasSystemAccess } from '@/lib/auth/systemAccess'
import { isAdmin } from '@/lib/auth/roles'
import { EstadoVazio } from '../../../_ui/primitivos'
import type { Envio } from './_tipos'

export const dynamic = 'force-dynamic'

const dataBR = (iso: string | null) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : '—')

/** Comunicação: por ora só o histórico de envios (a Task 5 a reconstrói). Destinatários e config moram em /configuracoes. */
export default async function ComunicacaoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const email = user?.email
  const permitido = !!email && ((await isAdmin(supabase, email)) || (await hasSystemAccess(supabase, email, 'obras')))
  if (!permitido) return <EstadoVazio>Esta tela é de quem é responsável pelas obras</EstadoVazio>

  const envR = await supabase
    .from('obras_envio')
    .select('id, tipo, referencia, lado, enviado_por, enviado_em, destinatarios, resultado, detalhe')
    .eq('obra_id', id)
    .order('enviado_em', { ascending: false })
    .limit(50)
  if (envR.error) return <EstadoVazio>Não foi possível carregar a comunicação desta obra</EstadoVazio>

  const envios: Envio[] = (envR.data ?? []).map((e) => ({
    id: e.id as string,
    tipo: e.tipo,
    referencia: e.referencia,
    lado: e.lado,
    enviadoPor: e.enviado_por,
    enviadoEm: e.enviado_em,
    destinatarios: e.destinatarios ?? [],
    resultado: e.resultado,
    detalhe: e.detalhe,
  }))

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-bold text-[#00345e]">Histórico de envios</h2>
      {envios.length === 0 ? (
        <EstadoVazio>Nenhum envio ainda</EstadoVazio>
      ) : (
        <ul className="flex flex-col gap-2">
          {envios.map((e) => (
            <li key={e.id} className="rounded-xl border border-[#dadad8] p-3 text-sm text-[#333336]">
              <div className="flex flex-wrap justify-between gap-2">
                <strong>{e.tipo ?? 'envio'} · ref. {dataBR(e.referencia)} · {e.lado ?? '—'}</strong>
                <span className={e.resultado === 'ok' ? 'text-[#5a7380]' : 'text-[#b23232]'}>
                  {e.resultado === 'ok' ? 'enviado' : e.resultado === 'falha' ? 'falhou' : '—'}
                </span>
              </div>
              <p className="text-xs text-[#5a7380]">
                {new Date(e.enviadoEm).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}
                {e.enviadoPor ? ` · por ${e.enviadoPor}` : ''}
              </p>
              <p className="break-words text-xs text-[#5a7380]">Para: {e.destinatarios.join(', ') || '—'}</p>
              {e.detalhe ? <p className="text-xs text-[#5a7380]">{e.detalhe}</p> : null}
              {/* Slot: link "Abrir PDF" (agente do PDF) */}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
