/**
 * Relatório semanal da OBRA (Leva 3 §2.3). Puro: monta o conteúdo da semana
 * (segunda a sexta) por lado — fonte única do e-mail, do PDF (`_pdf/semanal.tsx`)
 * e do resumo que vai para a IA (`resumoParaIa`, só lado cliente).
 *
 * Lado cliente NUNCA mostra valor/peso (R$), impedimento com
 * `exibirAoCliente = false` nem a área interna da Manfac (causa material/equipe
 * aparece só como "Manfac"). Restrição liberada não aparece.
 */
import { CAUSA } from './causas'
import { dataBr, pct, type ItemDiario, type SinalVisual } from './email-diario'
import { diasDaSemana, ppc, type PlanoSemana, type Restricao } from './last-planner'
import type { ObraGrande } from './leitura'
import type { Responsavel } from './cronograma'
import { blocosDoPeriodo, blocosValidos, ddmm, esc, ISO, lista, obj, str, strOuNull, nums, strs, type Lado } from './relatorio-periodo'

export type { Lado } from './relatorio-periodo'

export type NaoCumpridoSemanal = { descricao: string; meta: string; final: string; causa: string | null; responsavel: string | null }

export type ConteudoSemanal = {
  lado: Lado
  loja: string
  assunto: string
  titulo: string
  subtitulo: string
  segunda: string
  sexta: string
  sinal: SinalVisual
  /** `ate`: "a sexta", ou "dd/mm/aaaa" quando a semana ainda não acabou. */
  avanco: { previsto: string; realizado: string; desvio: string; ate: string }
  previsao: string
  /** null = sem plano fechado para a semana. `valor` "—" = plano sem avaliação. */
  ppc: { valor: string; cumpridos: number; avaliados: number; planejados: number } | null
  naoCumpridos: NaoCumpridoSemanal[]
  concluidas: { descricao: string; fim: string }[]
  emAndamento: { descricao: string; percentual: string; termino: string }[]
  /** Plano da próxima semana (só se já fechado). */
  proximaSemana: { descricao: string; meta: string }[] | null
  doCliente: { descricao: string; atividade: string; tipo: string; prazo: string | null; vencida: boolean }[]
  impedimentos: ItemDiario[]
  /** Só no interno: impedimentos da semana com `exibirAoCliente = false`. */
  ocultos: ItemDiario[]
  observacoes: string | null
}

const RESP: Record<Responsavel, string> = { cliente: 'Cliente', manfac: 'Manfac', terceiro: 'Terceiro', clima: 'Clima' }

export function montarConteudoSemanal(p: {
  lado: Lado
  obra: ObraGrande
  segunda: string
  /** Data de referência: a sexta, ou hoje se a semana ainda não acabou. */
  ref: string
  hoje: string
  plano: PlanoSemana | null
  planoProximo: PlanoSemana | null
  restricoes: Restricao[]
  observacoes: string | null
}): ConteudoSemanal {
  const { lado, obra: og, segunda, ref } = p
  const sexta = diasDaSemana(segunda)[4]
  const b = blocosDoPeriodo({ lado, obra: og, inicio: segunda, fim: sexta, ref, hoje: p.hoje, restricoes: p.restricoes })
  const { loja, descricao } = b
  const interno = lado === 'interno'

  const assunto = `Relatório semanal · ${loja} · ${ddmm(segunda)} a ${dataBr(sexta)}${interno ? ' · interno' : ''}`
  const titulo = `${loja} — semana de ${ddmm(segunda)} a ${ddmm(sexta)}`
  const subtitulo = `Segunda ${dataBr(segunda)} a sexta ${dataBr(sexta)}${ref < sexta ? ` · dados até ${dataBr(ref)}` : ''}`
  const avanco = { ...b.avanco, ate: ref < sexta ? dataBr(ref) : 'a sexta' }

  // PPC e não cumpridos. Ao cliente, causa da Manfac aparece só como "Manfac".
  const itens = p.plano?.itens ?? []
  const avaliados = itens.filter((i) => i.cumprido !== null)
  const v = ppc(itens)
  const ppcSemana = p.plano
    ? { valor: v === null ? '—' : pct(v), cumpridos: avaliados.filter((i) => i.cumprido).length, avaliados: avaliados.length, planejados: itens.length }
    : null
  const naoCumpridos = itens
    .filter((i) => i.cumprido === false)
    .sort((a, b) => a.numero - b.numero)
    .map((i): NaoCumpridoSemanal => {
      const c = i.causa ? CAUSA[i.causa] : null
      return {
        descricao: descricao(i.numero),
        meta: pct(i.metaPercentual),
        final: i.percentualFinal === null ? '—' : pct(i.percentualFinal),
        causa: !c ? null : !interno && c.resp === 'manfac' ? null : c.rotulo,
        responsavel: c?.resp ? RESP[c.resp] : null,
      }
    })

  const proximaSemana = p.planoProximo
    ? [...p.planoProximo.itens].sort((a, b) => a.numero - b.numero).map((i) => ({ descricao: descricao(i.numero), meta: pct(i.metaPercentual) }))
    : null

  return {
    lado, loja, assunto, titulo, subtitulo, segunda, sexta,
    sinal: b.sinal,
    avanco,
    previsao: b.previsao,
    ppc: ppcSemana, naoCumpridos, concluidas: b.concluidas, emAndamento: b.emAndamento, proximaSemana,
    doCliente: b.doCliente, impedimentos: b.impedimentos, ocultos: b.ocultos,
    observacoes: p.observacoes?.trim() || null,
  }
}

// ---- Conteúdo congelado (obras_semanal.conteudo) --------------------------
// O engenheiro pode gravar o jsonb direto pela API na validação: o congelado é
// entrada não confiável. Só é usado se tiver exatamente o formato abaixo e o
// sinal for um dos três visuais canônicos; senão, quem chama monta na hora.

/** true só se `v` tem o formato de ConteudoSemanal do `lado` (sinal canônico; cliente sem ocultos). */
export function conteudoSemanalValido(v: unknown, lado: Lado): v is ConteudoSemanal {
  if (!obj(v) || !blocosValidos(v, lado)) return false
  if (!ISO.test(String(v.segunda)) || !ISO.test(String(v.sexta))) return false
  const p = v.ppc
  if (p !== null && !(obj(p) && str(p.valor) && nums(p.cumpridos) && nums(p.avaliados) && nums(p.planejados))) return false
  if (!lista(v.naoCumpridos, (x) => strs(x, 'descricao', 'meta', 'final') && strOuNull(x.causa) && strOuNull(x.responsavel))) return false
  return v.proximaSemana === null || lista(v.proximaSemana, (x) => strs(x, 'descricao', 'meta'))
}

/** Linhas de texto das seções de dados (sem as observações) — e-mail em texto e resumo da IA. */
function linhasDeDados(c: ConteudoSemanal): string[] {
  const ppcTxt = c.ppc
    ? `PPC da semana: ${c.ppc.valor} (${c.ppc.cumpridos} de ${c.ppc.avaliados} itens avaliados cumpridos; ${c.ppc.planejados} planejados)`
    : 'PPC da semana: sem plano fechado'
  return [
    `${c.sinal.rotulo} — ${c.avanco.desvio}.`,
    `Avanço até ${c.avanco.ate}: previsto ${c.avanco.previsto} · realizado ${c.avanco.realizado}`,
    c.previsao,
    '',
    ppcTxt,
    ...(c.naoCumpridos.length
      ? ['NÃO CUMPRIDOS NO PLANO', ...c.naoCumpridos.map((n) => `- ${n.descricao} (meta ${n.meta}, chegou a ${n.final})${causaTxt(n)}`)]
      : []),
    '',
    'CONCLUÍDAS NA SEMANA',
    ...(c.concluidas.length ? c.concluidas.map((a) => `- ${a.descricao} — ${a.fim}`) : ['Nenhuma.']),
    '',
    'EM ANDAMENTO',
    ...(c.emAndamento.length ? c.emAndamento.map((a) => `- ${a.descricao}: ${a.percentual}, término previsto ${a.termino}`) : ['Nenhuma.']),
    '',
    'PROGRAMAÇÃO DA PRÓXIMA SEMANA',
    ...(c.proximaSemana === null
      ? ['Plano da próxima semana ainda não fechado.']
      : c.proximaSemana.length
        ? c.proximaSemana.map((i) => `- ${i.descricao} — meta ${i.meta}`)
        : ['Nenhuma atividade no plano.']),
    '',
    'DEPENDEM DO CLIENTE',
    ...(c.doCliente.length
      ? c.doCliente.map((r) => `- ${r.descricao} (${r.tipo}; atividade ${r.atividade})${r.prazo ? ` — prazo ${r.prazo}${r.vencida ? ', vencido' : ''}` : ''}`)
      : ['Nada pendente com o cliente.']),
    '',
    'IMPEDIMENTOS DA SEMANA',
    ...(c.impedimentos.length ? c.impedimentos.map((i) => `- ${i.rotulo}: ${i.corpo}`) : ['Nenhum.']),
    ...(c.ocultos.length ? ['', 'SÓ INTERNO · NÃO FOI AO CLIENTE', ...c.ocultos.map((i) => `- ${i.rotulo}: ${i.corpo}`)] : []),
  ]
}

const causaTxt = (n: NaoCumpridoSemanal) => {
  const partes = [n.causa ? `causa: ${n.causa}` : null, n.responsavel ? `responsável: ${n.responsavel}` : null].filter(Boolean)
  return partes.length ? ` — ${partes.join(' · ')}` : ''
}

/**
 * Resumo da semana para a IA: SÓ o conteúdo do lado cliente (sem R$, sem
 * oculto, sem área interna) e sem as observações atuais.
 */
export function resumoParaIa(c: ConteudoSemanal): string {
  if (c.lado !== 'cliente') throw new Error('Resumo da IA só sai do conteúdo do cliente')
  return [`Obra: ${c.loja}`, `Semana: ${dataBr(c.segunda)} a ${dataBr(c.sexta)}`, '', ...linhasDeDados(c)].join('\n')
}

export function montarEmailSemanal(c: ConteudoSemanal, p: { fotos: number }): { assunto: string; html: string; texto: string } {
  const interno = c.lado === 'interno'
  const notaFotos = p.fotos ? `${p.fotos} ${p.fotos === 1 ? 'foto da semana' : 'fotos da semana'} no PDF anexo.` : null

  const secao = (t: string, corpo: string) =>
    `<tr><td style="padding:12px 20px;border-top:1px solid #e2e8f0">
<div style="margin:0 0 8px;font-size:12px;text-transform:uppercase;letter-spacing:.05em;color:#64748b;font-weight:700">${esc(t)}</div>
${corpo}</td></tr>`
  const vazio = (t: string) => `<div style="font-size:14px;color:#64748b">${esc(t)}</div>`
  const linha = (t: string, cor = '#16a34a') =>
    `<div style="border-left:3px solid ${cor};padding:3px 10px;margin-bottom:5px;font-size:14px;color:#0f172a">${esc(t)}</div>`
  const caixa = (it: ItemDiario, cor: string, fundo: string) =>
    `<div style="border-left:3px solid ${cor};background:${fundo};padding:8px 10px;border-radius:4px;margin-bottom:6px;font-size:14px;color:#0f172a">
<div style="font-size:12px;font-weight:700;color:#334155">${esc(it.rotulo)}</div>${esc(it.corpo)}</div>`
  const numeros: [string, string][] = [
    [c.avanco.previsto, `previsto até ${c.avanco.ate}`],
    [c.avanco.realizado, 'realizado'],
    [c.ppc?.valor ?? '—', 'PPC da semana'],
  ]

  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(c.assunto)}</title></head>
<body style="margin:0;padding:0;background:#f1f5f9">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9"><tr><td align="center" style="padding:16px 8px">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:100%;background:#ffffff;border-radius:12px;overflow:hidden;font-family:Arial,Helvetica,sans-serif;color:#0f172a">
<tr><td style="background:#0d2050;padding:16px 20px">
<div style="color:#f05a28;font-weight:700;font-size:12px;letter-spacing:.05em">MANFAC · RELATÓRIO SEMANAL${interno ? ' · INTERNO' : ''}</div>
<div style="color:#ffffff;font-size:19px;font-weight:700;margin-top:3px">${esc(c.titulo)}</div>
<div style="color:#94a3b8;font-size:13px;margin-top:2px">${esc(c.subtitulo)}</div>
</td></tr>
<tr><td style="background:${esc(c.sinal.fundo)};border-bottom:1px solid ${esc(c.sinal.borda)};padding:12px 20px">
<table role="presentation" cellpadding="0" cellspacing="0"><tr>
<td valign="top" style="padding-right:10px"><div style="width:14px;height:14px;border-radius:7px;background:${esc(c.sinal.ponto)}"></div></td>
<td style="font-size:14px;color:#0f172a"><b>${esc(c.sinal.rotulo)}</b> — ${esc(c.avanco.desvio)}.<br><span style="color:${esc(c.sinal.texto)}">${esc(c.previsao)}</span></td>
</tr></table></td></tr>
<tr><td style="padding:12px 16px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
${numeros
  .map(
    ([v, r]) =>
      `<td width="33%" style="padding:4px"><div style="background:#f1f5f9;border-radius:8px;padding:10px;text-align:center"><b style="display:block;font-size:20px;color:#0f172a">${esc(v)}</b><span style="font-size:12px;color:#64748b">${esc(r)}</span></div></td>`,
  )
  .join('')}
</tr></table></td></tr>
${secao(
  'Plano da semana',
  (c.ppc
    ? `<div style="font-size:14px;color:#0f172a;margin-bottom:6px">${esc(`${c.ppc.cumpridos} de ${c.ppc.avaliados} itens avaliados cumpridos (${c.ppc.planejados} planejados)`)}</div>`
    : vazio('Sem plano fechado para esta semana.')) +
    c.naoCumpridos.map((n) => linha(`Não cumprido: ${n.descricao} (meta ${n.meta}, chegou a ${n.final})${causaTxt(n)}`, '#f59e0b')).join(''),
)}
${secao('Concluídas na semana', c.concluidas.length ? c.concluidas.map((a) => linha(`${a.descricao} — ${a.fim}`)).join('') : vazio('Nenhuma atividade concluída na semana.'))}
${secao('Em andamento', c.emAndamento.length ? c.emAndamento.map((a) => linha(`${a.descricao}: ${a.percentual} · término previsto ${a.termino}`, '#2563eb')).join('') : vazio('Nenhuma atividade em andamento.'))}
${secao(
  'Programação da próxima semana',
  c.proximaSemana === null
    ? vazio('Plano da próxima semana ainda não fechado.')
    : c.proximaSemana.length
      ? c.proximaSemana.map((i) => linha(`${i.descricao} — meta ${i.meta}`, '#00345e')).join('')
      : vazio('Nenhuma atividade no plano.'),
)}
${secao(
  'Dependem do cliente',
  c.doCliente.length
    ? c.doCliente
        .map((r) =>
          caixa(
            { rotulo: `${r.tipo.toUpperCase()}${r.prazo ? ` · prazo ${r.prazo}${r.vencida ? ' (vencido)' : ''}` : ''}`, corpo: `${r.descricao} — atividade ${r.atividade}` },
            r.vencida ? '#dc2626' : '#f59e0b',
            r.vencida ? '#fef2f2' : '#fffbeb',
          ),
        )
        .join('')
    : vazio('Nada pendente com o cliente.'),
)}
${secao('Impedimentos da semana', c.impedimentos.length ? c.impedimentos.map((i) => caixa(i, '#dc2626', '#fef2f2')).join('') : vazio('Nenhum impedimento na semana.'))}
${c.ocultos.length ? secao('Só interno · Não foi ao cliente', c.ocultos.map((i) => caixa(i, '#dc2626', '#fef2f2')).join('')) : ''}
${secao('Observações da engenharia', c.observacoes ? `<div style="font-size:14px;color:#0f172a;white-space:pre-wrap">${esc(c.observacoes)}</div>` : vazio('Sem observações.'))}
${notaFotos ? secao('Fotos', vazio(notaFotos)) : ''}
<tr><td style="padding:12px 20px;border-top:1px solid #e2e8f0;font-size:11px;color:#94a3b8">Manfac Facilities · relatório semanal da obra.</td></tr>
</table></td></tr></table></body></html>`

  const texto = [
    `MANFAC · RELATÓRIO SEMANAL${interno ? ' · INTERNO' : ''}`,
    c.titulo,
    c.subtitulo,
    '',
    ...linhasDeDados(c),
    '',
    'OBSERVAÇÕES DA ENGENHARIA',
    c.observacoes ?? 'Sem observações.',
    ...(notaFotos ? ['', notaFotos] : []),
  ].join('\n')
  return { assunto: c.assunto, html, texto }
}
