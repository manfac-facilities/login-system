/**
 * E-mail diário da OBRA (spec §5.4 e §7.1). Puro: monta assunto, HTML e texto
 * a partir da leitura consolidada (`lerObraGrande`) e do RDO validado.
 *
 * Lado cliente NUNCA mostra valor, peso, fornecedor, tipo interno de
 * impedimento da Manfac nem impedimento com `exibirAoCliente = false`.
 * Lado interno = o mesmo + os impedimentos que não foram ao cliente.
 *
 * HTML de e-mail: tabelas e estilos inline, largura 600 px.
 */
import { FUSO } from '../../_lib/tipos'
import { diasUteisEntre } from './calendario'
import { diasDeImpacto, type Responsavel, type Sinal } from './cronograma'
import { impedimentosCalcDe, type ImpedimentoRow, type ObraGrande } from './leitura'

export type ClimaRdo = 'sol' | 'nublado' | 'chuva' | 'impraticavel'

export type RdoCompleto = {
  id: string
  data: string
  semExecucao: boolean
  motivoSemExecucao: string | null
  programacaoAmanha: string | null
  /** Legado (antes dos turnos); só aparece quando não há clima por turno. */
  clima?: ClimaRdo | null
  climaManha?: ClimaRdo | null
  climaTarde?: ClimaRdo | null
  avancos: { numero: number; de: number; para: number; concluida: boolean; causa?: CausaRdo | null }[]
}

/** Causa de "não andou" do diário (mesmos valores de `CausaNaoAndou` em `[id]/diario/_tipos.ts`). */
export type CausaRdo = 'cliente' | 'material' | 'equipe' | 'clima' | 'projeto' | 'outro'

export type EmailDiario = { assunto: string; html: string; texto: string }

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')

const num = (x: number) => new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(x)
const pct = (x: number) => `${Math.round(x * 100)}%`
const dataBr = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`
const DIA_SEMANA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']
const diaSemana = (iso: string) => {
  const [a, m, d] = iso.split('-').map(Number)
  return DIA_SEMANA[new Date(Date.UTC(a, m - 1, d)).getUTCDay()]
}
const hora = (ts: string) =>
  new Intl.DateTimeFormat('pt-BR', { timeZone: FUSO, hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(ts))

const diaLocal = (ts: string) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: FUSO, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(ts))

const RESP: Record<Responsavel, string> = { cliente: 'Cliente', manfac: 'Manfac', terceiro: 'Terceiro', clima: 'Clima' }
const ATRASO_DE: Record<Responsavel, string> = {
  cliente: 'do cliente', manfac: 'da Manfac', terceiro: 'de terceiros', clima: 'do clima',
}
const SINAL: Record<Sinal, { rotulo: string; fundo: string; borda: string; ponto: string; texto: string }> = {
  verde: { rotulo: 'No prazo', fundo: '#dcfce7', borda: '#bbf7d0', ponto: '#16a34a', texto: '#166534' },
  amarelo: { rotulo: 'Atenção', fundo: '#fef3c7', borda: '#fde68a', ponto: '#f59e0b', texto: '#92400e' },
  vermelho: { rotulo: 'Atrasado', fundo: '#fee2e2', borda: '#fecaca', ponto: '#dc2626', texto: '#991b1b' },
}

const CLIMA: Record<ClimaRdo, { rotulo: string; cor: string }> = {
  sol: { rotulo: 'Sol', cor: '#f7cb15' },
  nublado: { rotulo: 'Nublado', cor: '#9aa9b2' },
  chuva: { rotulo: 'Chuva', cor: '#00345e' },
  impraticavel: { rotulo: 'Impraticável', cor: '#d64545' },
}

/** Rótulo da causa e responsável (spec §5.3: cada causa mapeada para um responsável; projeto/outro sem responsável fixo). */
const CAUSA: Record<CausaRdo, { rotulo: string; resp: Responsavel | null }> = {
  cliente: { rotulo: 'Cliente / loja', resp: 'cliente' },
  material: { rotulo: 'Material', resp: 'manfac' },
  equipe: { rotulo: 'Equipe', resp: 'manfac' },
  clima: { rotulo: 'Clima', resp: 'clima' },
  projeto: { rotulo: 'Projeto', resp: null },
  outro: { rotulo: 'Outro', resp: null },
}

type Item = { rotulo: string; corpo: string; tecnico?: boolean }

export function montarEmailDiario(p: {
  lado: 'cliente' | 'interno'
  obra: ObraGrande
  rdo: RdoCompleto
  validadoPor: string
  validadoEm: string
  diaN: number
  fotosCid: { cid: string; legenda: string | null }[]
  /** Fotos que não foram anexadas (grandes demais ou falha ao baixar). */
  fotosOmitidas?: number
}): EmailDiario {
  const { lado, obra: og, rdo } = p
  const { obra, plano, exec, feriados } = og
  const loja = obra.loja?.trim() || obra.descricao?.trim() || obra.os || 'Obra'
  const descricao = (n: number) => plano.find((a) => a.numero === n)?.descricao || `Atividade ${n}`

  // 1. Cabeçalho
  const assunto = `Diário de obra · ${loja} · dia ${p.diaN} · ${dataBr(rdo.data)}${lado === 'interno' ? ' · interno' : ''}`
  const titulo = `${loja} — dia ${p.diaN}`
  const subtitulo = `${diaSemana(rdo.data)}, ${dataBr(rdo.data)} · validado por ${p.validadoPor} às ${hora(p.validadoEm)}`

  // 2. Sinal + previsão
  const calc = og.calc ?? { previsto: 0, realizado: 0, desvioPP: 0, terminoProjetado: rdo.data }
  const sinal = SINAL[og.sinal ?? 'verde']
  const desvio =
    calc.desvioPP < 0
      ? `${num(-calc.desvioPP)} p.p. abaixo do previsto`
      : calc.desvioPP > 0
        ? `${num(calc.desvioPP)} p.p. acima do previsto`
        : 'em linha com o previsto'
  // Ao cliente, só contam os impedimentos que ele vê (`exibirAoCliente`); o interno vê tudo.
  const visiveis = lado === 'interno' ? og.impedimentos : og.impedimentos.filter((i) => i.exibirAoCliente)
  type Quebra = { total: number; outros: number } & Record<Responsavel, number>
  let atraso: Quebra | null = og.atraso ? { ...og.atraso, outros: 0 } : null
  if (lado === 'cliente' && og.atraso) {
    // Dias de impedimento oculto que não são da Manfac vão para "outros fatores", nunca para "da Manfac".
    const vis = diasDeImpacto(impedimentosCalcDe(visiveis), rdo.data, feriados)
    const ocultosNaoManfac = og.impedimentos.filter((i) => !i.exibirAoCliente && i.responsavel !== 'manfac')
    const oc = diasDeImpacto(impedimentosCalcDe(ocultosNaoManfac), rdo.data, feriados)
    let restante = og.atraso.total
    const parte = (v: number) => {
      const x = Math.min(restante, Math.max(v, 0))
      restante -= x
      return x
    }
    const cliente = parte(vis.cliente)
    const clima = parte(vis.clima)
    const terceiro = parte(vis.terceiro)
    const outros = parte(oc.cliente + oc.clima + oc.terceiro)
    atraso = { total: og.atraso.total, cliente, clima, terceiro, outros, manfac: restante }
  }
  let quebra = ''
  if (atraso && atraso.total > 0) {
    const a = atraso
    const partes = [
      ...(['cliente', 'manfac', 'terceiro', 'clima'] as Responsavel[])
        .filter((r) => a[r] > 0)
        .map((r) => `${num(a[r])} ${ATRASO_DE[r]}`),
      ...(a.outros > 0 ? [`${num(a.outros)} em outros fatores`] : []),
    ]
    quebra = ` (+${num(a.total)} ${a.total === 1 ? 'dia' : 'dias'}${partes.length ? `: ${partes.join(', ')}` : ''})`
  }
  const previsao = `Entrega prevista: ${dataBr(calc.terminoProjetado)}${quebra}`

  // 3. Três números
  const impactoCliente = diasDeImpacto(impedimentosCalcDe(visiveis), rdo.data, feriados).cliente
  const numeros: [string, string][] = [
    [pct(calc.previsto), 'previsto'],
    [pct(calc.realizado), 'realizado'],
    [`${num(impactoCliente)} d`, 'impacto do cliente'],
  ]

  // 4. Onde está travado
  const abertos = og.impedimentos.filter(
    (i) => i.categoria === 'impedimento' && i.abertoEm <= rdo.data && (i.encerradoEm === null || i.encerradoEm > rdo.data),
  )
  const itemDe = (i: ImpedimentoRow): Item => {
    const n = diasUteisEntre(i.abertoEm, rdo.data, feriados)
    const tempo =
      i.abertoEm === rdo.data
        ? 'hoje'
        : `${i.responsavel === 'cliente' ? 'aguardando ' : ''}há ${n} ${n === 1 ? 'dia útil' : 'dias úteis'}`
    const resp = i.responsavel ? RESP[i.responsavel] : '—'
    // Ao cliente, o tipo só aparece quando é do cliente ou do clima: o da Manfac/terceiro é área interna.
    const mostraTipo = lado === 'interno' || i.responsavel === 'cliente' || i.responsavel === 'clima'
    const extras = [
      mostraTipo && i.tipo ? i.tipo : null,
      i.atividadeNumero !== null
        ? `${i.travaAtividade ? 'trava' : 'afeta'} a atividade ${i.atividadeNumero} (${descricao(i.atividadeNumero)})`
        : null,
      !i.travaAtividade && i.impactoDias ? `~${num(i.impactoDias)} ${i.impactoDias === 1 ? 'dia' : 'dias'}` : null,
    ].filter(Boolean)
    return {
      rotulo: `${resp.toUpperCase()} · ${tempo}`,
      corpo: `${i.descricao}${extras.length ? ` — ${extras.join(' · ')}` : ''}`,
    }
  }
  const travados: Item[] = abertos.filter((i) => i.exibirAoCliente).map(itemDe)
  const trava = obra.atividade_trava
  if (trava !== null && trava !== undefined) {
    const e = exec.find((x) => x.numero === trava)
    if (e?.status !== 'concluido' && plano.some((a) => a.numero === trava)) {
      travados.push({
        rotulo: 'TÉCNICO · trava de segurança',
        corpo: `${descricao(trava)} (${pct(e?.percentual ?? 0)}) — as atividades que dependem dela só começam depois`,
        tecnico: true,
      })
    }
  }
  const ocultos: Item[] = lado === 'interno' ? abertos.filter((i) => !i.exibirAoCliente).map(itemDe) : []

  // 4b. Orientações à loja registradas no dia (spec §5.3 item 4: saem no diário daquele dia).
  const orientacoes: string[] = og.impedimentos
    .filter((i) => i.categoria === 'orientacao' && i.abertoEm === rdo.data && (lado === 'interno' || i.exibirAoCliente))
    .map((o) => {
      const quando = o.criadoEm && diaLocal(o.criadoEm) === rdo.data ? ' às ' + hora(o.criadoEm) : ''
      const quem = o.pessoaCliente?.trim() ? ' — recebida por ' + o.pessoaCliente.trim() : ''
      const oculta = lado === 'interno' && !o.exibirAoCliente ? ' (não foi ao cliente)' : ''
      return o.descricao + quem + quando + oculta
    })

  // 5. O que a Manfac fez hoje
  const feitos = rdo.semExecucao
    ? []
    : rdo.avancos
        .filter((a) => a.concluida || a.para > a.de)
        .sort((a, b) => a.numero - b.numero)
        .map((a) =>
          a.concluida ? `✓ ${descricao(a.numero)} — concluída` : `▲ ${descricao(a.numero)}: ${pct(a.de)} → ${pct(a.para)}`,
        )
  // 5b. Não avançou hoje (item 12 da reunião de 31/10): atividade sem avanço com causa informada.
  // Ao cliente, causa da Manfac (material/equipe) aparece só como "Manfac", sem detalhar a área interna.
  const naoAvancou = rdo.semExecucao
    ? []
    : rdo.avancos
        .filter((a) => !a.concluida && a.para <= a.de && a.causa && a.causa in CAUSA)
        .sort((a, b) => a.numero - b.numero)
        .map((a) => {
          const c = CAUSA[a.causa!]
          const partes = [
            lado === 'cliente' && c.resp === 'manfac' ? null : `causa: ${c.rotulo}`,
            c.resp ? `responsável: ${RESP[c.resp]}` : null,
          ].filter(Boolean)
          return `${descricao(a.numero)} (${pct(a.de)}) — ${partes.join(' · ')}`
        })
  const semExecucao = rdo.semExecucao ? `Sem execução hoje — ${rdo.motivoSemExecucao ?? ''}`.trim() : null
  const omitidas = p.fotosOmitidas ?? 0
  const notaOmitidas = omitidas
    ? `${omitidas} ${omitidas === 1 ? 'foto omitida' : 'fotos omitidas'} (grande demais ou indisponível)`
    : null

  // Clima: por turno; o legado (`clima`) só entra quando não há turno.
  const climaTurnos = [
    ['Manhã', rdo.climaManha],
    ['Tarde', rdo.climaTarde],
  ].filter((t): t is [string, ClimaRdo] => !!t[1] && t[1] in CLIMA)
  const climaPartes: [string, ClimaRdo][] =
    climaTurnos.length ? climaTurnos : rdo.clima && rdo.clima in CLIMA ? [['Clima', rdo.clima]] : []
  const climaTexto = climaPartes.map(([t, c]) => `${t}: ${CLIMA[c].rotulo}`).join(' · ')
  // Bolinha colorida (span estilizado) + rótulo em texto: não depende de emoji nem de imagem.
  const climaHtml = climaPartes
    .map(
      ([t, c]) =>
        `<span style="display:inline-block;width:10px;height:10px;border-radius:5px;background:${CLIMA[c].cor};border:1px solid #6e8894;vertical-align:middle"></span> <b>${esc(t)}:</b> ${esc(CLIMA[c].rotulo)}`,
    )
    .join('&nbsp;&nbsp;·&nbsp;&nbsp;')

  // 6. Amanhã
  const amanha = rdo.programacaoAmanha?.trim() || 'Sem programação informada.'

  // ---------- HTML ----------
  const secao = (tituloSecao: string, corpo: string) =>
    `<tr><td style="padding:12px 20px;border-top:1px solid #e2e8f0">
<div style="margin:0 0 8px;font-size:12px;text-transform:uppercase;letter-spacing:.05em;color:#64748b;font-weight:700">${esc(tituloSecao)}</div>
${corpo}</td></tr>`
  const caixa = (it: Item) => {
    const [borda, fundo, cor] = it.tecnico ? ['#f59e0b', '#fffbeb', '#92400e'] : ['#dc2626', '#fef2f2', '#991b1b']
    return `<div style="border-left:3px solid ${borda};background:${fundo};padding:8px 10px;border-radius:4px;margin-bottom:6px;font-size:14px;color:#0f172a">
<div style="font-size:12px;font-weight:700;color:${cor}">${esc(it.rotulo)}</div>${esc(it.corpo)}</div>`
  }
  const linhaFeito = (t: string) =>
    `<div style="border-left:3px solid #16a34a;padding:3px 10px;margin-bottom:5px;font-size:14px;color:#0f172a">${esc(t)}</div>`

  const fotos: string[] = []
  for (let i = 0; i < p.fotosCid.length; i += 3) {
    const celulas = p.fotosCid.slice(i, i + 3).map(
      (f) => `<td width="186" valign="top" style="padding:3px">
<img src="cid:${esc(f.cid)}" width="180" alt="${esc(f.legenda ?? 'foto do dia')}" style="display:block;width:180px;max-width:100%;height:auto;border-radius:6px;border:0">
${f.legenda ? `<div style="font-size:11px;color:#64748b;padding-top:2px">${esc(f.legenda)}</div>` : ''}</td>`,
    )
    fotos.push(`<tr>${celulas.join('')}</tr>`)
  }
  const blocoFotos =
    (fotos.length ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:6px">${fotos.join('')}</table>` : '') +
    (notaOmitidas ? `<div style="font-size:12px;color:#64748b;margin-top:4px">${esc(notaOmitidas)}</div>` : '')

  const corpoFeito = semExecucao
    ? `<div style="font-size:14px;color:#0f172a">${esc(semExecucao)}</div>`
    : feitos.length
      ? feitos.map(linhaFeito).join('')
      : `<div style="font-size:14px;color:#64748b">Nenhuma atividade avançou hoje.</div>`

  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(assunto)}</title></head>
<body style="margin:0;padding:0;background:#f1f5f9">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9"><tr><td align="center" style="padding:16px 8px">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:100%;background:#ffffff;border-radius:12px;overflow:hidden;font-family:Arial,Helvetica,sans-serif;color:#0f172a">
<tr><td style="background:#0d2050;padding:16px 20px">
<div style="color:#f05a28;font-weight:700;font-size:12px;letter-spacing:.05em">MANFAC · DIÁRIO DE OBRA${lado === 'interno' ? ' · INTERNO' : ''}</div>
<div style="color:#ffffff;font-size:19px;font-weight:700;margin-top:3px">${esc(titulo)}</div>
<div style="color:#94a3b8;font-size:13px;margin-top:2px">${esc(subtitulo)}</div>
</td></tr>
<tr><td style="background:${sinal.fundo};border-bottom:1px solid ${sinal.borda};padding:12px 20px">
<table role="presentation" cellpadding="0" cellspacing="0"><tr>
<td valign="top" style="padding-right:10px"><div style="width:14px;height:14px;border-radius:7px;background:${sinal.ponto}"></div></td>
<td style="font-size:14px;color:#0f172a"><b>${sinal.rotulo}</b> — ${esc(desvio)}.<br><span style="color:${sinal.texto}">${esc(previsao)}</span></td>
</tr></table></td></tr>
<tr><td style="padding:12px 16px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
${numeros
  .map(
    ([v, r]) =>
      `<td width="33%" style="padding:4px"><div style="background:#f1f5f9;border-radius:8px;padding:10px;text-align:center"><b style="display:block;font-size:20px;color:#0f172a">${esc(v)}</b><span style="font-size:12px;color:#64748b">${esc(r)}</span></div></td>`,
  )
  .join('')}
</tr></table></td></tr>
${secao('Onde está travado', travados.length ? travados.map(caixa).join('') : '<div style="font-size:14px;color:#64748b">Nada travado hoje.</div>')}
${ocultos.length ? secao('Só interno · Não foi ao cliente', ocultos.map(caixa).join('')) : ''}
${orientacoes.length ? secao('Orientações à loja', orientacoes.map((t) => '<div style="border-left:3px solid #2563eb;background:#eff6ff;padding:6px 10px;border-radius:4px;margin-bottom:6px;font-size:14px;color:#0f172a">' + esc(t) + '</div>').join('')) : ''}
${climaPartes.length ? secao('Clima', `<div style="font-size:14px;color:#0f172a">${climaHtml}</div>`) : ''}
${secao('O que a Manfac fez hoje', corpoFeito + blocoFotos)}
${naoAvancou.length ? secao('Não avançou hoje', naoAvancou.map((t) => `<div style="border-left:3px solid #f59e0b;padding:3px 10px;margin-bottom:5px;font-size:14px;color:#0f172a">${esc(t)}</div>`).join('')) : ''}
${secao('Amanhã', `<div style="font-size:14px;color:#0f172a">${esc(amanha)}</div>`)}
<tr><td style="padding:12px 20px;border-top:1px solid #e2e8f0;font-size:11px;color:#94a3b8">Manfac Facilities · e-mail automático do diário de obra.</td></tr>
</table></td></tr></table></body></html>`

  // ---------- Texto ----------
  const linhas = [
    `MANFAC · DIÁRIO DE OBRA${lado === 'interno' ? ' · INTERNO' : ''}`,
    titulo,
    subtitulo,
    '',
    `${sinal.rotulo} — ${desvio}.`,
    previsao,
    '',
    numeros.map(([v, r]) => `${r}: ${v}`).join(' · '),
    '',
    'ONDE ESTÁ TRAVADO',
    ...(travados.length ? travados.map((it) => `- ${it.rotulo}: ${it.corpo}`) : ['Nada travado hoje.']),
    ...(ocultos.length ? ['', 'SÓ INTERNO · NÃO FOI AO CLIENTE', ...ocultos.map((it) => `- ${it.rotulo}: ${it.corpo}`)] : []),
    ...(orientacoes.length ? ['', 'ORIENTAÇÕES À LOJA', ...orientacoes.map((t) => `- ${t}`)] : []),
    '',
    ...(climaTexto ? [climaTexto, ''] : []),
    'O QUE A MANFAC FEZ HOJE',
    ...(semExecucao ? [semExecucao] : feitos.length ? feitos : ['Nenhuma atividade avançou hoje.']),
    ...(p.fotosCid.length ? [`${p.fotosCid.length} ${p.fotosCid.length === 1 ? 'foto' : 'fotos'} no e-mail`] : []),
    ...(notaOmitidas ? [notaOmitidas] : []),
    ...(naoAvancou.length ? ['', 'NÃO AVANÇOU HOJE', ...naoAvancou.map((t) => `- ${t}`)] : []),
    '',
    'AMANHÃ',
    amanha,
  ]
  return { assunto, html, texto: linhas.join('\n') }
}
