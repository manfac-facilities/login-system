import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { hasSystemAccess } from '@/lib/auth/systemAccess'
import { isAdmin } from '@/lib/auth/roles'
import { EstadoVazio } from '../../../_ui/primitivos'
import { hojeISO } from '../../../_lib/tipos'
import { lerObraDaRequisicao } from '../_obra-da-requisicao'
import { montarDiario } from './_preenchimento'
import PassosDiario from './_passos'
import SeletorDataDiario from './_seletor-data'
import { montarEmailDiario } from '../../_lib/email-diario'
import { diasUteisEntre } from '../../_lib/calendario'
import FormImpedimento from '../impedimentos/_form'
import ListaImpedimentos from '../impedimentos/_lista'
import type { AvancoRdo, CausaNaoAndou, Clima, EstadoRdo, FotoRdo } from './_tipos'

export const dynamic = 'force-dynamic'

type Linha = Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any

const ISO = /^\d{4}-\d{2}-\d{2}$/
const DIA_SEMANA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']

function deslocar(data: string, dias: number): string {
  const [a, m, d] = data.split('-').map(Number)
  return new Date(Date.UTC(a, m - 1, d + dias)).toISOString().slice(0, 10)
}

const rotuloDia = (data: string) => {
  const [a, m, d] = data.split('-').map(Number)
  return `${DIA_SEMANA[new Date(Date.UTC(a, m - 1, d)).getUTCDay()]}, ${data.slice(8, 10)}/${data.slice(5, 7)}`
}

export default async function DiarioObraPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ data?: string }>
}) {
  const { id } = await params
  const { data: dataParam } = await searchParams
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const email = user?.email?.trim().toLowerCase() ?? ''
  const admin = !!email && (await isAdmin(supabase, email))
  const permitido = admin || (!!email && (await hasSystemAccess(supabase, email, 'obras')))
  if (!permitido) return <EstadoVazio>Esta tela é de quem é responsável pelas obras</EstadoVazio>

  const hoje = hojeISO()
  const data = dataParam && ISO.test(dataParam) ? dataParam : hoje

  const r = await lerObraDaRequisicao(id, hoje)
  if (!r.ok) return <EstadoVazio>{r.erro}</EstadoVazio>
  const { obra, calc, versaoBase, plano, exec, feriados } = r.dados
  if (!versaoBase?.salvaEm || !calc) {
    return <EstadoVazio>Sem cronograma — o diário começa quando a base for salva</EstadoVazio>
  }

  const { data: rdo, error: errR } = await supabase
    .from('obras_rdo')
    .select('*')
    .eq('obra_id', id)
    .eq('data', data)
    .maybeSingle()
  if (errR) return <EstadoVazio>Não deu para carregar o diário. Recarregue a página.</EstadoVazio>

  let avancosSalvos: AvancoRdo[] = []
  let fotos: FotoRdo[] = []
  let ultimo: { efetivo: number | null; equipeTexto: string | null } | null = null
  if (rdo) {
    const [avR, foR] = await Promise.all([
      supabase.from('obras_rdo_avanco').select('*').eq('rdo_id', rdo.id),
      supabase.from('obras_rdo_foto').select('*').eq('rdo_id', rdo.id).order('ordem'),
    ])
    if (avR.error || foR.error) return <EstadoVazio>Não deu para carregar o diário. Recarregue a página.</EstadoVazio>
    avancosSalvos = ((avR.data ?? []) as Linha[]).map((a) => ({
      numero: a.numero,
      de: Number(a.de ?? 0),
      para: Number(a.para ?? 0),
      concluida: !!a.concluida,
      causa: (a.causa ?? null) as CausaNaoAndou | null,
    }))
    const linhasFoto = (foR.data ?? []) as Linha[]
    const urls = new Map<string, string>()
    if (linhasFoto.length) {
      const { data: assinadas } = await supabase.storage
        .from('obras-fotos')
        .createSignedUrls(linhasFoto.map((f) => f.path as string), 600)
      for (const s of assinadas ?? []) if (s.path && s.signedUrl) urls.set(s.path, s.signedUrl)
    }
    fotos = linhasFoto.map((f) => ({ id: f.id, path: f.path, legenda: f.legenda ?? null, url: urls.get(f.path) ?? null }))
  } else {
    const { data: u } = await supabase
      .from('obras_rdo')
      .select('efetivo, equipe_texto')
      .eq('obra_id', id)
      .eq('sem_execucao', false)
      .lt('data', data)
      .order('data', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (u) ultimo = { efetivo: u.efetivo ?? null, equipeTexto: u.equipe_texto ?? null }
  }

  const { inicial, atividades, outras } = montarDiario({
    calc,
    plano,
    exec,
    atividadeTrava: obra.atividade_trava ?? null,
    feriados,
    data,
    rdo: rdo
      ? {
          semExecucao: !!rdo.sem_execucao,
          motivoSemExecucao: rdo.motivo_sem_execucao ?? null,
          efetivo: rdo.efetivo ?? null,
          equipeTexto: rdo.equipe_texto ?? null,
          clima: (rdo.clima ?? null) as Clima | null,
          climaManha: (rdo.clima_manha ?? null) as Clima | null,
          climaTarde: (rdo.clima_tarde ?? null) as Clima | null,
          programacaoAmanha: rdo.programacao_amanha ?? null,
          semImpedimento: !!rdo.sem_impedimento,
        }
      : null,
    avancosSalvos,
    ultimo,
  })

  // Validar e enviar: engenheiro da obra ou admin (a action confere de novo).
  const podeValidar =
    admin || (!!obra.engenheiro_email && obra.engenheiro_email.trim().toLowerCase() === email)
  // Já enviado: o botão só volta se algum destinatário ainda não recebeu.
  let pendentes: number | null = null
  if (rdo && podeValidar && rdo.estado === 'enviado') {
    const [dR, eR] = await Promise.all([
      supabase.from('obras_destinatario').select('email, lado').eq('obra_id', id).eq('ativo', true).contains('tipos', ['diario']),
      supabase.from('obras_envio').select('lado, destinatarios').eq('rdo_id', rdo.id),
    ])
    const recebeu = new Set(
      ((eR.data ?? []) as Linha[]).flatMap((e) => ((e.destinatarios ?? []) as string[]).map((x) => e.lado + ':' + x.trim().toLowerCase())),
    )
    pendentes = ((dR.data ?? []) as Linha[]).filter((d) => !recebeu.has(d.lado + ':' + String(d.email).trim().toLowerCase())).length
  }
  let previaHtml: string | null = null
  if (rdo && podeValidar && (rdo.estado === 'rascunho' || rdo.estado === 'validado' || (pendentes ?? 0) > 0)) {
    const comUrl = fotos.slice(0, 6).filter((f) => f.url)
    let html = montarEmailDiario({
      lado: 'cliente',
      obra: r.dados,
      rdo: {
        id: rdo.id,
        data,
        semExecucao: !!rdo.sem_execucao,
        motivoSemExecucao: rdo.motivo_sem_execucao ?? null,
        programacaoAmanha: rdo.programacao_amanha ?? null,
        clima: rdo.clima ?? null,
        climaManha: rdo.clima_manha ?? null,
        climaTarde: rdo.clima_tarde ?? null,
        avancos: avancosSalvos,
      },
      validadoPor: rdo.validado_por ?? email,
      validadoEm: rdo.validado_em ?? new Date().toISOString(),
      diaN: diasUteisEntre(obra.data_base ?? data, data, feriados),
      fotosCid: comUrl.map((f) => ({ cid: f.id, legenda: f.legenda })),
    }).html
    // Na prévia, a foto vem pela URL assinada no lugar do CID.
    for (const f of comUrl) html = html.split(`cid:${f.id}`).join(f.url!.replace(/&/g, '&amp;'))
    previaHtml = html
  }

  // Sem RDO gravado também valida: o botão salva o que está na tela antes (item 10).
  const mostraValidar =
    podeValidar && (!rdo || rdo.estado === 'rascunho' || rdo.estado === 'validado' || (pendentes ?? 0) > 0)
  const base = `/obras/obras/${id}/diario`
  const navLink =
    'flex min-h-11 items-center rounded-lg border border-[#dadad8] px-3 text-sm text-[#333336] hover:border-[#b94606]'

  return (
    <div className="flex flex-col gap-3">
      <header className="mx-auto flex w-full max-w-xl flex-col gap-2">
        <div>
          <h2 className="text-lg font-bold text-[#00345e]">{data === hoje ? 'Diário de hoje' : 'Diário de obra'}</h2>
          <p className="text-sm text-[#5a7380]">
            {rotuloDia(data)}
            {rdo ? ` · ${rdo.estado === 'rascunho' ? 'rascunho' : rdo.estado}` : ' · ainda não iniciado'}
          </p>
        </div>
        {rdo && (rdo.estado === 'validado' || rdo.estado === 'enviado') ? (
          // Rota GET (não página): <a> comum, abre o PDF da versão cliente em outra aba.
          <a
            href={`${base}/pdf/${data}`}
            target="_blank"
            rel="noopener"
            className="flex min-h-11 w-fit items-center rounded-lg bg-[#00345e] px-4 text-sm font-semibold text-white hover:bg-[#0d2050]"
          >
            Gerar PDF
          </a>
        ) : null}
        <nav aria-label="Escolher o dia" className="flex flex-wrap items-center gap-2">
          <Link href={`${base}?data=${deslocar(data, -1)}`} className={navLink}>
            ← dia anterior
          </Link>
          {data !== hoje ? (
            <Link href={base} className={navLink}>
              hoje
            </Link>
          ) : null}
          {data < hoje ? (
            <Link href={`${base}?data=${deslocar(data, 1)}`} className={navLink}>
              próximo dia →
            </Link>
          ) : null}
          <SeletorDataDiario key={data} base={base} data={data} />
        </nav>
      </header>

      <PassosDiario
        key={data}
        obraId={id}
        data={data}
        rdoId={rdo?.id ?? null}
        estado={(rdo?.estado ?? null) as EstadoRdo | null}
        inicial={inicial}
        atividades={atividades}
        outras={outras}
        fotos={fotos}
        validacao={mostraValidar ? { previaHtml, pendentes } : undefined}
        impedimentosHoje={
          r.dados.impedimentos.filter(
            (i) => i.categoria === 'impedimento' && (i.abertoEm === data || (!!rdo && i.rdoId === rdo.id)),
          ).length
        }
        impedimentos={
          <div className="flex flex-col gap-4">
            <ListaImpedimentos itens={r.dados.impedimentos} hoje={hoje} dataReferencia={data} feriados={feriados} somenteAbertos />
            <FormImpedimento
              obraId={id}
              rdoId={rdo?.id ?? null}
              dataDiario={data}
              atividades={plano.map((p) => ({ numero: p.numero, descricao: p.descricao }))}
              orientacoes={r.dados.impedimentos
                .filter((i) => i.categoria === 'orientacao')
                .map((o) => ({ id: o.id, descricao: o.descricao, abertoEm: o.abertoEm }))}
            />
          </div>
        }
      />

    </div>
  )
}
