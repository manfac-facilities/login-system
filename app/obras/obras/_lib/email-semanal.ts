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
import { curvaRealizada } from './curvas'
import { dataBr, pct, previsaoEntrega, sinalVisual, textoDesvio, type ItemDiario, type SinalVisual } from './email-diario'
import { diasDaSemana, ppc, type PlanoSemana, type Restricao } from './last-planner'
import type { ImpedimentoRow, ObraGrande } from './leitura'
import { codigosDeAtividades, type Responsavel } from './cronograma'
import { rotuloTipo } from '../[id]/lookahead/_tipos'

export type Lado = 'cliente' | 'interno'

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
const FORA_DA_VERSAO = 'Atividade fora da versão vigente'
const ddmm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`

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
  const { obra, plano } = og
  const sexta = diasDaSemana(segunda)[4]
  const loja = obra.loja?.trim() || obra.descricao?.trim() || obra.os || 'Obra'
  const descricao = (n: number) => plano.find((a) => a.numero === n)?.descricao || FORA_DA_VERSAO
  // Código exibido ("2.3"), nunca o numero interno — a mesma fonte do lookahead e do cronograma.
  const codigos = codigosDeAtividades(og.calc?.atividades ?? [], og.feriados)
  const atividadeCom = (n: number) => {
    const c = codigos.get(n)
    return c ? `${c} — ${descricao(n)}` : 'fora da versão vigente'
  }
  const interno = lado === 'interno'

  const assunto = `Relatório semanal · ${loja} · ${ddmm(segunda)} a ${dataBr(sexta)}${interno ? ' · interno' : ''}`
  const titulo = `${loja} — semana de ${ddmm(segunda)} a ${ddmm(sexta)}`
  const subtitulo = `Segunda ${dataBr(segunda)} a sexta ${dataBr(sexta)}${ref < sexta ? ` · dados até ${dataBr(ref)}` : ''}`

  // Avanço planejado até a sexta × realizado (semana passada: o realizado vem do histórico até a data).
  const calc = og.calc
  const previsto = calc?.previsto ?? 0
  const realizado =
    calc && ref < p.hoje && og.hist.length ? (curvaRealizada(calc.atividades, og.hist, [ref])[0]?.valor ?? 0) : (calc?.realizado ?? 0)
  const desvioPP = Math.round((realizado - previsto) * 1000) / 10 || 0
  const avanco = { previsto: pct(previsto), realizado: pct(realizado), desvio: textoDesvio(desvioPP), ate: ref < sexta ? dataBr(ref) : 'a sexta' }

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

  const atividades = calc?.atividades ?? []
  const concluidas = atividades
    .filter((a) => a.status === 'concluido' && a.fimReal && a.fimReal >= segunda && a.fimReal <= sexta)
    .sort((a, b) => a.fimReal!.localeCompare(b.fimReal!) || a.numero - b.numero)
    .map((a) => ({ descricao: a.descricao, fim: dataBr(a.fimReal!) }))
  const emAndamento = atividades
    .filter((a) => a.status !== 'concluido' && a.percentual > 0)
    .sort((a, b) => a.fimProjetado.localeCompare(b.fimProjetado) || a.numero - b.numero)
    .map((a) => ({ descricao: a.descricao, percentual: pct(a.percentual), termino: dataBr(a.fimProjetado) }))

  const proximaSemana = p.planoProximo
    ? [...p.planoProximo.itens].sort((a, b) => a.numero - b.numero).map((i) => ({ descricao: descricao(i.numero), meta: pct(i.metaPercentual) }))
    : null

  // Decisões/restrições que dependem do cliente: só as em aberto (liberada some).
  const doCliente = p.restricoes
    .filter((r) => r.responsavel === 'cliente' && r.situacao !== 'liberada')
    .sort((a, b) => (a.prazo ?? '9999').localeCompare(b.prazo ?? '9999'))
    .map((r) => ({
      descricao: r.descricao,
      atividade: atividadeCom(r.atividadeNumero),
      tipo: rotuloTipo(r.tipo),
      prazo: r.prazo ? dataBr(r.prazo) : null,
      vencida: !!r.prazo && r.prazo < ref,
    }))

  // Impedimentos que estiveram abertos em algum dia da semana.
  const daSemana = og.impedimentos.filter(
    (i) => i.categoria === 'impedimento' && i.abertoEm <= sexta && (i.encerradoEm === null || i.encerradoEm >= segunda),
  )
  const itemDe = (i: ImpedimentoRow): ItemDiario => {
    const resp = i.responsavel ? RESP[i.responsavel] : '—'
    // Ao cliente, o tipo só aparece quando é do cliente ou do clima: o da Manfac/terceiro é área interna.
    const mostraTipo = interno || i.responsavel === 'cliente' || i.responsavel === 'clima'
    const quando = i.encerradoEm ? `${ddmm(i.abertoEm)} a ${ddmm(i.encerradoEm)}` : `aberto desde ${ddmm(i.abertoEm)}`
    const extras = [
      mostraTipo && i.tipo ? i.tipo : null,
      i.atividadeNumero === null
        ? null
        : codigos.has(i.atividadeNumero)
          ? `atividade ${codigos.get(i.atividadeNumero)} (${descricao(i.atividadeNumero)})`
          : 'atividade fora da versão vigente',
    ].filter(Boolean)
    return { rotulo: `${resp.toUpperCase()} · ${quando}`, corpo: `${i.descricao}${extras.length ? ` — ${extras.join(' · ')}` : ''}` }
  }
  const impedimentos = daSemana.filter((i) => i.exibirAoCliente).map(itemDe)
  const ocultos = interno ? daSemana.filter((i) => !i.exibirAoCliente).map(itemDe) : []

  return {
    lado, loja, assunto, titulo, subtitulo, segunda, sexta,
    sinal: sinalVisual(og.sinal),
    avanco,
    previsao: previsaoEntrega(lado, og, ref),
    ppc: ppcSemana, naoCumpridos, concluidas, emAndamento, proximaSemana, doCliente, impedimentos, ocultos,
    observacoes: p.observacoes?.trim() || null,
  }
}

// ---- Conteúdo congelado (obras_semanal.conteudo) --------------------------
// O engenheiro pode gravar o jsonb direto pela API na validação: o congelado é
// entrada não confiável. Só é usado se tiver exatamente o formato abaixo e o
// sinal for um dos três visuais canônicos; senão, quem chama monta na hora.

const ISO = /^\d{4}-\d{2}-\d{2}$/
const SINAIS = (['verde', 'amarelo', 'vermelho'] as const).map((s) => sinalVisual(s))
type Campos = Record<string, unknown>
const obj = (v: unknown): v is Campos => typeof v === 'object' && v !== null && !Array.isArray(v)
const str = (v: unknown): v is string => typeof v === 'string'
const strOuNull = (v: unknown) => v === null || str(v)
const nums = (v: unknown) => typeof v === 'number' && Number.isFinite(v)
const lista = (v: unknown, item: (x: Campos) => boolean) => Array.isArray(v) && v.every((x) => obj(x) && item(x))
const strs = (x: Campos, ...k: string[]) => k.every((c) => str(x[c]))
const itemValido = (x: Campos) => strs(x, 'rotulo', 'corpo') && (x.tecnico === undefined || typeof x.tecnico === 'boolean')

/** true só se `v` tem o formato de ConteudoSemanal do `lado` (sinal canônico; cliente sem ocultos). */
export function conteudoSemanalValido(v: unknown, lado: Lado): v is ConteudoSemanal {
  if (!obj(v) || v.lado !== lado) return false
  if (!strs(v, 'loja', 'assunto', 'titulo', 'subtitulo', 'previsao') || !ISO.test(String(v.segunda)) || !ISO.test(String(v.sexta))) return false
  const s = v.sinal
  if (!obj(s) || !SINAIS.some((c) => (Object.keys(c) as (keyof SinalVisual)[]).every((k) => s[k] === c[k]) && Object.keys(s).length === Object.keys(c).length)) return false
  if (!obj(v.avanco) || !strs(v.avanco, 'previsto', 'realizado', 'desvio', 'ate')) return false
  const p = v.ppc
  if (p !== null && !(obj(p) && str(p.valor) && nums(p.cumpridos) && nums(p.avaliados) && nums(p.planejados))) return false
  if (!lista(v.naoCumpridos, (x) => strs(x, 'descricao', 'meta', 'final') && strOuNull(x.causa) && strOuNull(x.responsavel))) return false
  if (!lista(v.concluidas, (x) => strs(x, 'descricao', 'fim'))) return false
  if (!lista(v.emAndamento, (x) => strs(x, 'descricao', 'percentual', 'termino'))) return false
  if (v.proximaSemana !== null && !lista(v.proximaSemana, (x) => strs(x, 'descricao', 'meta'))) return false
  if (!lista(v.doCliente, (x) => strs(x, 'descricao', 'atividade', 'tipo') && strOuNull(x.prazo) && typeof x.vencida === 'boolean')) return false
  if (!lista(v.impedimentos, itemValido) || !lista(v.ocultos, itemValido)) return false
  if (lado === 'cliente' && (v.ocultos as unknown[]).length) return false
  return strOuNull(v.observacoes)
}

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')

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
