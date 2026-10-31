import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { hasSystemAccess } from '@/lib/auth/systemAccess'
import { isAdmin } from '@/lib/auth/roles'
import { EstadoVazio } from '../../../../_ui/primitivos'
import { hojeISO } from '../../../../_lib/tipos'
import { montarEmailSemanal } from '../../../_lib/email-semanal'
import { iaDisponivel } from '../../../_lib/ia-semanal'
import { dataEnvioSemanal, segundaDaSemana } from '../../../_lib/last-planner'
import { conteudoSemanalDe, lerDadosSemanal, semanaDoRelatorio } from '../../../_pdf/carregar-semanal'
import { segundaValida, somarDias } from '../../lookahead/_plano-tipos'
import { lerObraDaRequisicao } from '../../_obra-da-requisicao'
import { botaoSecundario } from '../_registro-form'
import FormSemanal, { type EstadoTela } from './_form'

export const dynamic = 'force-dynamic'

const dm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`
const ROTULO: Record<EstadoTela, string> = {
  nao_iniciado: 'Não iniciado',
  rascunho: 'Rascunho',
  validado: 'Validado',
  enviado: 'Enviado',
}

/**
 * Relatório semanal (Leva 3 §2.3): rascunho das observações, prévia do e-mail
 * (versão cliente ou interna), validar e enviar (engenheiro/admin) e PDF.
 */
export default async function SemanalPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ semana?: string; versao?: string }>
}) {
  const { id } = await params
  const sp = await searchParams
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const email = user?.email?.trim().toLowerCase() ?? ''
  const admin = !!email && (await isAdmin(supabase, email))
  const permitido = !!email && (admin || (await hasSystemAccess(supabase, email, 'obras')))
  if (!permitido) return <EstadoVazio>Esta tela é de quem é responsável pelas obras</EstadoVazio>

  const hoje = hojeISO()
  const atual = segundaDaSemana(hoje)
  const pedida = segundaValida(sp.semana)
  const segunda = pedida && pedida <= atual ? pedida : atual
  const s = semanaDoRelatorio(segunda, hoje)
  // Semana corrente: aproveita a leitura já feita pelo layout no mesmo render.
  let og
  if (s.ok && s.ref === hoje) {
    const r = await lerObraDaRequisicao(id, hoje)
    if (!r.ok) return <EstadoVazio>{r.erro}</EstadoVazio>
    og = r.dados
  }
  const l = await lerDadosSemanal(supabase, id, segunda, hoje, og)
  if (!l.ok) return <EstadoVazio>{l.erro}</EstadoVazio>
  const d = l.dados
  const engenheiro = d.og.obra.engenheiro_email?.trim().toLowerCase() ?? ''
  const podeEnviar = admin || (engenheiro !== '' && engenheiro === email)

  const { data: dest, error: errD } = await supabase
    .from('obras_destinatario')
    .select('email, lado')
    .eq('obra_id', id)
    .eq('ativo', true)
    .contains('tipos', ['semanal'])
  if (errD) return <EstadoVazio>Não foi possível carregar os destinatários desta obra</EstadoVazio>
  const nCliente = (dest ?? []).filter((x) => x.lado === 'cliente').length
  const nInterno = (dest ?? []).filter((x) => x.lado === 'interno').length

  const interna = sp.versao === 'interna'
  const previa = montarEmailSemanal(conteudoSemanalDe(d, interna ? 'interno' : 'cliente'), { fotos: 0 })
  const estado: EstadoTela = d.semanal?.estado ?? 'nao_iniciado'
  const envio = dataEnvioSemanal(segunda, d.og.feriados)
  const base = `/obras/obras/${id}/comunicacao/semanal`
  const url = (semana: string, versao?: string) =>
    `${base}?${new URLSearchParams({ semana, ...(versao ? { versao } : {}) }).toString()}`
  const chip = (ativo: boolean) =>
    `flex min-h-11 items-center rounded-full border px-3 text-sm ${
      ativo ? 'border-[#b94606] bg-[#b94606] font-semibold text-white' : 'border-[#dadad8] text-[#333336]'
    }`

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <Link href={`/obras/obras/${id}/comunicacao`} className="text-sm text-[#00345e] underline underline-offset-2">
            Comunicação
          </Link>
          <h2 className="text-lg font-bold text-[#00345e]">
            Relatório semanal · <span className="obra-num">{dm(segunda)} a {dm(d.sexta)}</span>
          </h2>
        </div>
        <nav aria-label="Semana" className="flex gap-2">
          <Link href={url(somarDias(segunda, -7))} className={botaoSecundario}>
            Semana anterior
          </Link>
          {segunda < atual ? (
            <Link href={url(somarDias(segunda, 7))} className={botaoSecundario}>
              Próxima semana
            </Link>
          ) : null}
        </nav>
      </div>

      <div className="grid gap-4 lg:grid-cols-[24rem_1fr]">
        <section className="flex flex-col gap-3 rounded-xl border border-[#dadad8] bg-[#ffffff] p-3 text-sm text-[#333336]">
          <dl className="grid grid-cols-2 gap-2">
            <div>
              <dt className="text-xs text-[#5a7380]">Situação</dt>
              <dd className="font-semibold text-[#00345e]">{ROTULO[estado]}</dd>
            </div>
            <div>
              <dt className="text-xs text-[#5a7380]">Envio previsto</dt>
              <dd className="obra-num font-semibold text-[#00345e]">{dm(envio)}</dd>
            </div>
            <div className="col-span-2">
              <dt className="text-xs text-[#5a7380]">Destinatários (tipo Semanal)</dt>
              <dd>
                {nCliente} do cliente · {nInterno} {nInterno === 1 ? 'interno' : 'internos'}
              </dd>
            </div>
            {d.semanal?.validadoEm ? (
              <div className="col-span-2">
                <dt className="text-xs text-[#5a7380]">Validado</dt>
                <dd>
                  {new Date(d.semanal.validadoEm).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' })}
                  {d.semanal.validadoPor ? ` por ${d.semanal.validadoPor}` : ''}
                </dd>
              </div>
            ) : null}
          </dl>
          <FormSemanal
            key={`${segunda}-${estado}`}
            obraId={id}
            segunda={segunda}
            estado={estado}
            observacoes={d.semanal?.observacoes ?? ''}
            podeEnviar={podeEnviar}
            ia={podeEnviar && iaDisponivel()}
            temClienteSemanal={nCliente > 0}
          />
          {estado === 'validado' || estado === 'enviado' ? (
            <a href={`${base}/pdf/${segunda}`} target="_blank" rel="noopener" className={botaoSecundario}>
              Abrir PDF
            </a>
          ) : null}
        </section>

        <section className="flex min-w-0 flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold text-[#00345e]">Prévia do e-mail</h3>
            <Link href={url(segunda)} aria-current={!interna ? 'page' : undefined} className={chip(!interna)}>
              Cliente
            </Link>
            <Link href={url(segunda, 'interna')} aria-current={interna ? 'page' : undefined} className={chip(interna)}>
              Interna
            </Link>
          </div>
          <p className="text-xs text-[#5a7380]">Com as observações salvas. As fotos da semana vão no PDF anexo.</p>
          <iframe
            title={`Prévia do relatório semanal (${interna ? 'versão interna' : 'versão do cliente'})`}
            srcDoc={previa.html}
            sandbox=""
            className="h-[70vh] min-h-[32rem] w-full rounded-xl border border-[#dadad8] bg-[#f1f5f9]"
          />
        </section>
      </div>
    </div>
  )
}
