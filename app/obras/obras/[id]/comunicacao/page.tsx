import { createClient } from '@/lib/supabase/server'
import { hasSystemAccess } from '@/lib/auth/systemAccess'
import { isAdmin } from '@/lib/auth/roles'
import { EstadoVazio } from '../../../_ui/primitivos'
import Destinatarios from './_destinatarios'
import ConfigObraForm from './_config'
import type { Destinatario, Envio, Lado, TipoEnvio } from './_tipos'

export const dynamic = 'force-dynamic'

const dataBR = (iso: string | null) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : '—')

export default async function ComunicacaoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const email = user?.email
  const admin = !!email && (await isAdmin(supabase, email))
  const permitido = !!email && (admin || (await hasSystemAccess(supabase, email, 'obras')))
  if (!permitido) return <EstadoVazio>Esta tela é de quem é responsável pelas obras</EstadoVazio>

  const [obraR, destR, envR, v1R] = await Promise.all([
    supabase.from('obras_obra').select('engenheiro_email, data_base, atividade_trava').eq('id', id).maybeSingle(),
    supabase.from('obras_destinatario').select('id, email, nome, funcao, lado, tipos, ativo').eq('obra_id', id).order('email'),
    supabase
      .from('obras_envio')
      .select('id, tipo, referencia, lado, enviado_por, enviado_em, destinatarios, resultado, detalhe')
      .eq('obra_id', id)
      .order('enviado_em', { ascending: false })
      .limit(50),
    supabase.from('obras_cronograma_versao').select('salva_em').eq('obra_id', id).eq('numero', 1).maybeSingle(),
  ])
  if (obraR.error || destR.error || envR.error) {
    return <EstadoVazio>Não foi possível carregar a comunicação desta obra</EstadoVazio>
  }

  const obra = obraR.data
  const destinatarios: Destinatario[] = (destR.data ?? []).map((d) => ({
    id: d.id as string,
    email: d.email as string,
    nome: (d.nome as string | null) ?? null,
    funcao: (d.funcao as string | null) ?? null,
    lado: ((d.lado as Lado | null) ?? 'cliente') as Lado,
    tipos: (d.tipos ?? []) as TipoEnvio[],
    ativo: d.ativo !== false,
  }))
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
    <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
      <div className="flex flex-col gap-6">
        <Destinatarios obraId={id} itens={destinatarios} admin={admin} />
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-bold text-white">Histórico de envios</h2>
          {envios.length === 0 ? (
            <EstadoVazio>Nenhum envio ainda</EstadoVazio>
          ) : (
            <ul className="flex flex-col gap-2">
              {envios.map((e) => (
                <li key={e.id} className="rounded-xl border border-[#1e3a5f] p-3 text-sm text-[#e8eef7]">
                  <div className="flex flex-wrap justify-between gap-2">
                    <strong>{e.tipo ?? 'envio'} · ref. {dataBR(e.referencia)} · {e.lado ?? '—'}</strong>
                    <span className={e.resultado === 'ok' ? 'text-[#94a3b8]' : 'text-[#ff4d6d]'}>
                      {e.resultado === 'ok' ? 'enviado' : e.resultado === 'falha' ? 'falhou' : '—'}
                    </span>
                  </div>
                  <p className="text-xs text-[#94a3b8]">
                    {new Date(e.enviadoEm).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}
                    {e.enviadoPor ? ` · por ${e.enviadoPor}` : ''}
                  </p>
                  <p className="break-words text-xs text-[#94a3b8]">Para: {e.destinatarios.join(', ') || '—'}</p>
                  {e.detalhe ? <p className="text-xs text-[#94a3b8]">{e.detalhe}</p> : null}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
      <ConfigObraForm
        obraId={id}
        admin={admin}
        baseSalva={!!v1R.data?.salva_em}
        inicial={{
          engenheiroEmail: obra?.engenheiro_email ?? null,
          dataBase: obra?.data_base ?? null,
          atividadeTrava: obra?.atividade_trava ?? null,
        }}
      />
    </div>
  )
}
