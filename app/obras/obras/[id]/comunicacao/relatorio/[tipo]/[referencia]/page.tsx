import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { hasSystemAccess } from '@/lib/auth/systemAccess'
import { isAdmin } from '@/lib/auth/roles'
import { EstadoVazio } from '../../../../../../_ui/primitivos'
import { hojeISO } from '../../../../../../_lib/tipos'
import { ultimoDiaUtilDoMes } from '../../../../../_lib/agenda'
import { montarEmailPeriodo } from '../../../../../_lib/email-periodo'
import { iaDisponivel } from '../../../../../_lib/ia-semanal'
import { etapasDaObra } from '../../../../../_lib/relatorio-periodo'
import { conteudoPeriodoDe, lerDadosPeriodo, relatorioValido, ultimoMesDoMensal, validacaoLiberadaEm } from '../../../../../_pdf/carregar-periodo'
import { lerObraDaRequisicao } from '../../../../_obra-da-requisicao'
import { botaoSecundario } from '../../../_registro-form'
import FormRelatorio from './_form'
import { ROTULO_TIPO, type EstadoTela } from './_tipos'

export const dynamic = 'force-dynamic'

const dm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`
const ROTULO: Record<EstadoTela, string> = {
  nao_iniciado: 'Não iniciado',
  rascunho: 'Rascunho',
  validado: 'Validado',
  enviado: 'Enviado',
}
const mesVizinho = (anoMes: string, delta: number) => {
  const [a, m] = anoMes.split('-').map(Number)
  const t = new Date(Date.UTC(a, m - 1 + delta, 1))
  return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, '0')}`
}

/**
 * Relatório de período (Leva 4 §2.1: mensal, fase, entrega): destaques
 * marcáveis + livre, observações (IA opcional), prévia do e-mail (cliente ou
 * interna), validar e enviar (engenheiro/admin) e PDF. Fase só com a etapa
 * concluída; entrega só com a obra concluída.
 */
export default async function RelatorioPeriodoPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; tipo: string; referencia: string }>
  searchParams: Promise<{ versao?: string }>
}) {
  const { id, tipo, referencia } = await params
  const sp = await searchParams
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const email = user?.email?.trim().toLowerCase() ?? ''
  const admin = !!email && (await isAdmin(supabase, email))
  const permitido = !!email && (admin || (await hasSystemAccess(supabase, email, 'obras')))
  if (!permitido) return <EstadoVazio>Esta tela é de quem é responsável pelas obras</EstadoVazio>
  if (!relatorioValido(tipo, referencia)) return <EstadoVazio>Relatório inválido</EstadoVazio>

  const hoje = hojeISO()
  const lida = await lerObraDaRequisicao(id, hoje)
  if (!lida.ok) return <EstadoVazio>{lida.erro}</EstadoVazio>
  const og = lida.dados
  const voltar = (
    <Link href={`/obras/obras/${id}/comunicacao`} className="text-sm text-[#00345e] underline underline-offset-2">
      Comunicação
    </Link>
  )
  const l = await lerDadosPeriodo(supabase, id, tipo, referencia, hoje, og)
  if (!l.ok) {
    return (
      <div className="flex flex-col gap-3">
        {voltar}
        <EstadoVazio>{l.erro}</EstadoVazio>
      </div>
    )
  }
  const d = l.dados
  const engenheiro = og.obra.engenheiro_email?.trim().toLowerCase() ?? ''
  const podeEnviar = admin || (engenheiro !== '' && engenheiro === email)

  const tiposDest = tipo === 'mensal' ? ['mensal'] : ['semanal', 'mensal']
  const { data: dest, error: errD } = await supabase
    .from('obras_destinatario')
    .select('email, lado')
    .eq('obra_id', id)
    .eq('ativo', true)
    .overlaps('tipos', tiposDest)
  if (errD) return <EstadoVazio>Não foi possível carregar os destinatários desta obra</EstadoVazio>
  const nCliente = (dest ?? []).filter((x) => x.lado === 'cliente').length
  const nInterno = (dest ?? []).filter((x) => x.lado === 'interno').length
  const rotuloDestinatarios = tipo === 'mensal' ? 'Mensal' : 'Semanal ou Mensal'

  const interna = sp.versao === 'interna'
  const conteudoCliente = conteudoPeriodoDe(d, 'cliente')
  const previa = montarEmailPeriodo(interna ? conteudoPeriodoDe(d, 'interno') : conteudoCliente, { fotos: 0 })
  const estado: EstadoTela = d.relatorio?.estado ?? 'nao_iniciado'
  const congelado = estado === 'validado' || estado === 'enviado'
  const sel = d.relatorio?.highlights ?? null
  const marcados = d.automaticos.map((h) => h.id).filter((h) => !sel?.desmarcados.includes(h))
  const liberaEm = validacaoLiberadaEm(og, tipo, referencia)

  const etapas = etapasDaObra(og)
  const envio =
    tipo === 'mensal'
      ? ultimoDiaUtilDoMes(referencia, og.feriados)
      : tipo === 'fase'
        ? (etapas.find((e) => e.referencia === referencia)?.fimPrevisto ?? null)
        : (og.calc?.terminoProjetado ?? null)

  const base = `/obras/obras/${id}/comunicacao/relatorio/${tipo}/${referencia}`
  const url = (versao?: string) => (versao ? `${base}?versao=${versao}` : base)
  const chip = (ativo: boolean) =>
    `flex min-h-11 items-center rounded-full border px-3 text-sm ${
      ativo ? 'border-[#b94606] bg-[#b94606] font-semibold text-white' : 'border-[#dadad8] text-[#333336]'
    }`
  const dataBase = (og.obra.data_base as string | null | undefined) ?? null
  const mesAtual = hoje.slice(0, 7)
  const fasesConcluidas = etapas.filter((e) => e.concluida)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          {voltar}
          <h2 className="text-lg font-bold text-[#00345e]">
            {ROTULO_TIPO[tipo]} · <span className="obra-num">{dm(d.inicio)} a {dm(d.fim)}</span>
          </h2>
          <p className="text-sm text-[#5a7380]">{conteudoCliente.titulo}</p>
        </div>
        {tipo === 'mensal' ? (
          <nav aria-label="Mês" className="flex gap-2">
            {dataBase && mesVizinho(referencia, -1) >= dataBase.slice(0, 7) ? (
              <Link href={`/obras/obras/${id}/comunicacao/relatorio/mensal/${mesVizinho(referencia, -1)}`} className={botaoSecundario}>
                Mês anterior
              </Link>
            ) : null}
            {referencia < mesAtual && referencia < (ultimoMesDoMensal(og) ?? '9999-12') ? (
              <Link href={`/obras/obras/${id}/comunicacao/relatorio/mensal/${mesVizinho(referencia, 1)}`} className={botaoSecundario}>
                Próximo mês
              </Link>
            ) : null}
          </nav>
        ) : null}
        {tipo === 'fase' && fasesConcluidas.length > 1 ? (
          <nav aria-label="Etapa concluída" className="flex flex-wrap gap-2">
            {fasesConcluidas.map((e) => (
              <Link
                key={e.referencia}
                href={`/obras/obras/${id}/comunicacao/relatorio/fase/${e.referencia}`}
                aria-current={e.referencia === referencia ? 'page' : undefined}
                className={chip(e.referencia === referencia)}
              >
                {e.ordem} — {e.nome}
              </Link>
            ))}
          </nav>
        ) : null}
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
              <dd className="obra-num font-semibold text-[#00345e]">{envio ? dm(envio) : '—'}</dd>
            </div>
            <div className="col-span-2">
              <dt className="text-xs text-[#5a7380]">Destinatários (tipo {rotuloDestinatarios})</dt>
              <dd>
                {nCliente} do cliente · {nInterno} {nInterno === 1 ? 'interno' : 'internos'}
              </dd>
            </div>
            {d.relatorio?.validadoEm ? (
              <div className="col-span-2">
                <dt className="text-xs text-[#5a7380]">Validado</dt>
                <dd>
                  {new Date(d.relatorio.validadoEm).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' })}
                  {d.relatorio.validadoPor ? ` por ${d.relatorio.validadoPor}` : ''}
                </dd>
              </div>
            ) : null}
          </dl>
          <FormRelatorio
            key={`${tipo}-${referencia}-${estado}`}
            obraId={id}
            tipo={tipo}
            referencia={referencia}
            estado={estado}
            observacoes={d.relatorio?.observacoes ?? ''}
            destaques={congelado ? [] : d.automaticos}
            marcados={congelado ? [] : marcados}
            livre={sel?.livre ?? ''}
            congelados={congelado ? conteudoCliente.highlights : []}
            podeEnviar={podeEnviar}
            ia={podeEnviar && iaDisponivel()}
            temCliente={nCliente > 0}
            rotuloDestinatarios={rotuloDestinatarios}
            validarAPartirDe={estado === 'rascunho' && liberaEm && hoje < liberaEm ? `${dm(liberaEm)}/${liberaEm.slice(0, 4)}` : null}
          />
          {congelado ? (
            <a href={`${base}/pdf`} target="_blank" rel="noopener" className={botaoSecundario}>
              Abrir PDF
            </a>
          ) : null}
        </section>

        <section className="flex min-w-0 flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold text-[#00345e]">Prévia do e-mail</h3>
            <Link href={url()} aria-current={!interna ? 'page' : undefined} className={chip(!interna)}>
              Cliente
            </Link>
            <Link href={url('interna')} aria-current={interna ? 'page' : undefined} className={chip(interna)}>
              Interna
            </Link>
          </div>
          <p className="text-xs text-[#5a7380]">
            {congelado
              ? 'Conteúdo congelado na validação. Curva S e fotos do período vão no PDF anexo.'
              : 'Com o rascunho salvo. Curva S e fotos do período vão no PDF anexo.'}
          </p>
          <iframe
            title={`Prévia do ${ROTULO_TIPO[tipo].toLowerCase()} (${interna ? 'versão interna' : 'versão do cliente'})`}
            srcDoc={previa.html}
            sandbox=""
            className="h-[70vh] min-h-[32rem] w-full rounded-xl border border-[#dadad8] bg-[#f1f5f9]"
          />
        </section>
      </div>
    </div>
  )
}
