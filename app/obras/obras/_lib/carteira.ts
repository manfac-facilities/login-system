/**
 * Regras da Visão do CEO (carteira de obras da modalidade OBRA). Puro: sem banco, sem React.
 * Datas `AAAA-MM-DD`; percentuais em fração 0–1; dinheiro em centavos.
 * Spec: docs/superpowers/specs/2026-11-04-obras-visao-ceo-design.md (§5, §6b).
 */
import { diasUteisEntre, ehDiaUtil } from './calendario'
import { previstoDaEtapa, type ResultadoCronograma, type ResumoEtapa, type Sinal } from './cronograma'
import type { PontoHist } from './curvas'
import { causasNaoCumpridas, ppc, segundaDaSemana, type PlanoSemana, type Restricao } from './last-planner'
import type { ImpedimentoRow } from './leitura'
import type { ItemAgenda } from './agenda'
import type { LeituraFinanceiro } from './financeiro-ler'
import { situacaoExibida, type SituacaoExibida } from '../_ui/pilula-situacao'

export type Quem = 'cliente' | 'manfac' | 'terceiros'
export type Trava = { origem: 'restricao' | 'impedimento'; descricao: string; tipo: string; quem: Quem; desde: string; prazo: string | null; vencida: boolean }
export type Estado =
  | { tipo: 'sem_cronograma' } | { tipo: 'faturando' } | { tipo: 'parada'; diasUteis: number }
  | { tipo: 'frente_parada' } | { tipo: 'comecou'; em: string } | { tipo: 'comeca'; em: string }
  | { tipo: 'andando'; comAtraso: boolean }
export type SinalCliente = { chave: 'entrega' | 'pendencias' | 'mensagens' | 'semanal'; tom: 'ruim' | 'atencao' | 'ok' | 'indisponivel'; texto: string; curto: string | null }
export type EtapaCarteira = { nome: string; realizado: number; previsto: number; situacao: SituacaoExibida }
export type DinheiroCarteira =
  | {
      ok: true; valor: number | null
      /** Faturado das OS com valor receita (mesma base de `percentuais.faturado` da aba); sem nenhuma OS com valor, o total. */
      faturado: number
      /** Faturado de todas as OS — o mesmo R$ do KPI "Faturado" da aba Financeiro (total.receitaRealizada). */
      faturadoTotal: number
      /** % faturado da aba Financeiro (0–100), o mesmo número. */
      faturadoPct: number | null
      aFaturar: number | null; acimaDoValor: boolean
      /** OS não cancelada sem valor receita: o valor da obra está incompleto. */
      osSemValor: number
      /** Notas que contam na receita. */
      notas: number
      custoRealizado: number; custoComprometido: number; margemPct: number | null
    }
  | { ok: false; motivo: 'sem_permissao' | 'leitura' }
export type Mensagem = { autorTipo: 'cliente' | 'manfac'; criadoEm: string }
export type Diario = { data: string; texto: string }
/** `corrente`: plano desta semana; false = da semana anterior (a última fechada). */
export type Semana = { corrente: boolean; planejadas: number; cumpridas: number; ppc: number | null; causas: string; naoCumpridas: number } | null
export type ObraCarteira = {
  id: string; os: string | null; loja: string | null; engenheiro: string | null
  sinal: Sinal | null; estado: Estado; realizado: number | null; previsto: number | null
  terminoBase: string | null; terminoProjetado: string | null; desvioDiasUteis: number | null
  travas: Trava[]; travaPrincipal: Trava | null; sinais: SinalCliente[]
  etapas: EtapaCarteira[]; semana: Semana; diarios: Diario[]; dinheiro: DinheiroCarteira
}
export type FiltroCarteira = 'todas' | 'risco' | 'cliente' | 'manfac' | 'terceiros' | 'no_prazo' | 'faturando'
export type Excecao = { obraId: string; obra: string; texto: string; quem: Quem | null; gravidade: number }

const ROTULO_QUEM: Record<Quem, string> = { cliente: 'Cliente', manfac: 'Manfac', terceiros: 'Terceiros' }

/** Dias úteis decorridos de `a` até `b`, sem contar o dia de partida (seg → qua = 2). */
function diasUteisDecorridos(a: string, b: string, feriados: ReadonlySet<string>): number {
  return Math.max(0, diasUteisEntre(a, b, feriados) - (ehDiaUtil(a, feriados) ? 1 : 0))
}

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`
const diasUteisTexto = (n: number) => plural(n, 'dia útil', 'dias úteis')

/** dd/mm de uma data `AAAA-MM-DD`. */
const ddmm = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`

/** Dia (AAAA-MM-DD) em Brasília de um timestamp; data pura passa como está. */
function diaBrt(ts: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(ts)) return ts
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date(ts))
}

/** Maior `dataStatus` em que o % de alguma atividade subiu (a primeira linha conta se > 0). */
export function ultimoAvanco(hist: PontoHist[]): string | null {
  const ordem = [...hist].sort((a, b) =>
    a.dataStatus.localeCompare(b.dataStatus) || (a.registradoEm ?? '').localeCompare(b.registradoEm ?? ''))
  const anterior = new Map<number, number>()
  let ultimo: string | null = null
  for (const p of ordem) {
    if (p.percentual > (anterior.get(p.numero) ?? 0) && (ultimo === null || p.dataStatus > ultimo)) ultimo = p.dataStatus
    anterior.set(p.numero, Math.max(anterior.get(p.numero) ?? 0, p.percentual))
  }
  return ultimo
}

export function estadoDaObra(p: {
  calc: ResultadoCronograma | null; sinal: Sinal | null; hist: PontoHist[]; impedimentosAbertos: number
  dataBase: string | null; hoje: string; feriados: ReadonlySet<string>
}): Estado {
  // Versão sem atividades não prova nada: sem isto o `every` vazio daria 'faturando'.
  if (!p.calc || p.calc.atividades.length === 0) return { tipo: 'sem_cronograma' }
  if (p.calc.atividades.every((a) => a.situacao === 'concluida')) return { tipo: 'faturando' }
  const desde = ultimoAvanco(p.hist) ?? p.dataBase
  if (desde) {
    const dias = diasUteisDecorridos(desde, p.hoje, p.feriados)
    if (dias >= 3) return { tipo: 'parada', diasUteis: dias }
  }
  if (p.impedimentosAbertos > 0) return { tipo: 'frente_parada' }
  if (p.dataBase && p.dataBase > p.hoje) return { tipo: 'comeca', em: p.dataBase }
  if (p.dataBase && diasUteisEntre(p.dataBase, p.hoje, p.feriados) < 10) return { tipo: 'comecou', em: p.dataBase }
  return { tipo: 'andando', comAtraso: p.sinal !== 'verde' }
}

const quemDe = (r: string | null): Quem => (r === 'cliente' ? 'cliente' : r === 'manfac' ? 'manfac' : 'terceiros')

export function travasDaObra(restricoes: Restricao[], impedimentos: ImpedimentoRow[], hoje: string): Trava[] {
  const rs: Trava[] = restricoes
    .filter((r) => r.situacao !== 'liberada')
    .map((r) => ({
      origem: 'restricao', descricao: r.descricao, tipo: r.tipo, quem: quemDe(r.responsavel),
      desde: diaBrt(r.criadoEm), prazo: r.prazo, vencida: r.prazo !== null && r.prazo < hoje,
    }))
  const is: Trava[] = impedimentos
    .filter((i) => i.categoria === 'impedimento' && i.encerradoEm === null)
    .map((i) => ({
      // Impedimento sem responsável: Manfac (é ela quem precisa classificar).
      origem: 'impedimento', descricao: i.descricao, tipo: i.tipo ?? 'impedimento',
      quem: i.responsavel === null ? 'manfac' : quemDe(i.responsavel),
      desde: diaBrt(i.abertoEm), prazo: null, vencida: false,
    }))
  return [...rs, ...is]
}

const menor = <T>(xs: T[], chave: (x: T) => string): T | null =>
  xs.reduce<T | null>((m, x) => (m === null || chave(x) < chave(m) ? x : m), null)

export function travaPrincipal(travas: Trava[]): Trava | null {
  const vencidas = travas.filter((t) => t.origem === 'restricao' && t.vencida)
  if (vencidas.length) return menor(vencidas, (t) => t.prazo ?? '')
  const imps = travas.filter((t) => t.origem === 'impedimento')
  if (imps.length) return menor(imps, (t) => t.desde)
  return menor(travas.filter((t) => t.origem === 'restricao'), (t) => t.prazo ?? '9999-99-99')
}

const PIOR: SituacaoExibida[] = ['aguardando_cliente', 'atrasada', 'travada', 'inicio_atrasado', 'em_andamento', 'nao_iniciada', 'concluida']

/** Por etapa, os mesmos números do painel: realizado de `ResumoEtapa.percentual`, previsto de `previstoDaEtapa`. */
export function etapasDaCarteira(calc: ResultadoCronograma | null, etapas: ResumoEtapa[]): EtapaCarteira[] {
  if (!calc) return []
  return etapas.map((e) => {
    const nums = new Set(e.numeros)
    const as = calc.atividades.filter((a) => nums.has(a.numero))
    const rank = Math.min(...as.map((a) => PIOR.indexOf(situacaoExibida(a.situacao, a.status, a.travada))))
    return { nome: e.etapa, realizado: e.percentual, previsto: previstoDaEtapa(as), situacao: PIOR[rank] }
  })
}

/** Plano desta semana ou, sem ele, o da semana anterior (a última fechada); mais antigo não conta. */
export function semanaDe(planos: PlanoSemana[], hoje: string): Semana {
  const esta = segundaDaSemana(hoje)
  const anterior = new Date(Date.parse(`${esta}T00:00:00Z`) - 7 * 86_400_000).toISOString().slice(0, 10)
  const plano = planos
    .filter((p) => p.semanaInicio >= anterior && p.semanaInicio <= hoje)
    .reduce<PlanoSemana | null>((m, p) => (m === null || p.semanaInicio > m.semanaInicio ? p : m), null)
  if (!plano) return null
  const causas = causasNaoCumpridas(plano.itens)
  return {
    corrente: plano.semanaInicio >= esta,
    planejadas: plano.itens.length,
    cumpridas: plano.itens.filter((i) => i.cumprido === true).length,
    ppc: ppc(plano.itens),
    causas: causas.map((c) => `${c.n} por ${c.causa}`).join(', '),
    naoCumpridas: causas.reduce((s, c) => s + c.n, 0),
  }
}

export function sinaisDoCliente(p: {
  terminoBase: string | null; terminoProjetado: string | null; desvioDiasUteis: number | null
  restricoes: Restricao[] | null; mensagens: Mensagem[] | null; agenda: ItemAgenda[] | null
  hoje: string; feriados: ReadonlySet<string>
}): SinalCliente[] {
  const du = (desde: string) => diasUteisDecorridos(desde, p.hoje, p.feriados)

  let entrega: SinalCliente
  if (!p.terminoBase) entrega = { chave: 'entrega', tom: 'ok', texto: 'sem data base', curto: null }
  else if (p.desvioDiasUteis !== null && p.desvioDiasUteis > 0 && p.terminoProjetado)
    entrega = {
      chave: 'entrega', tom: p.desvioDiasUteis >= 5 ? 'ruim' : 'atencao',
      texto: `entrega mudou de ${ddmm(p.terminoBase)} para ${ddmm(p.terminoProjetado)}`,
      curto: `entrega +${p.desvioDiasUteis} d.u.`,
    }
  else entrega = { chave: 'entrega', tom: 'ok', texto: `entrega mantida em ${ddmm(p.terminoBase)}`, curto: null }

  let pendencias: SinalCliente
  if (p.restricoes === null)
    pendencias = { chave: 'pendencias', tom: 'indisponivel', texto: 'não foi possível ler as pendências', curto: 'pendências: sem leitura' }
  else {
    const abertas = p.restricoes.filter((r) => r.situacao !== 'liberada' && r.responsavel === 'cliente')
    if (abertas.length === 0) pendencias = { chave: 'pendencias', tom: 'ok', texto: 'nenhuma pendência com o cliente', curto: null }
    else {
      const idade = Math.max(...abertas.map((r) => du(diaBrt(r.criadoEm))))
      const vencida = abertas.some((r) => r.prazo !== null && r.prazo < p.hoje)
      pendencias = {
        chave: 'pendencias', tom: vencida || idade >= 5 ? 'ruim' : 'atencao',
        texto: `${plural(abertas.length, 'pendência', 'pendências')} com o cliente, a mais antiga há ${diasUteisTexto(idade)}`,
        curto: `${plural(abertas.length, 'pendência', 'pendências')} do cliente`,
      }
    }
  }

  let mensagens: SinalCliente
  if (p.mensagens === null)
    mensagens = { chave: 'mensagens', tom: 'indisponivel', texto: 'não foi possível ler as mensagens', curto: 'mensagens: sem leitura' }
  else {
    const ordem = [...p.mensagens].sort((a, b) => new Date(a.criadoEm).getTime() - new Date(b.criadoEm).getTime())
    const ultima = ordem[ordem.length - 1]
    if (ultima && ultima.autorTipo === 'cliente' && du(diaBrt(ultima.criadoEm)) > 1) {
      let i = ordem.length
      while (i > 0 && ordem[i - 1].autorTipo === 'cliente') i--
      const semResposta = ordem.slice(i)
      mensagens = {
        chave: 'mensagens', tom: 'ruim',
        texto: `${plural(semResposta.length, 'mensagem', 'mensagens')} do cliente sem resposta desde ${ddmm(diaBrt(semResposta[0].criadoEm))}`,
        curto: `${plural(semResposta.length, 'mensagem', 'mensagens')} sem resposta`,
      }
    } else mensagens = { chave: 'mensagens', tom: 'ok', texto: ordem.length ? 'mensagens respondidas' : 'sem mensagens no portal', curto: null }
  }

  let semanal: SinalCliente
  if (p.agenda === null)
    semanal = { chave: 'semanal', tom: 'indisponivel', texto: 'não foi possível ler os envios do relatório semanal', curto: 'semanal: sem leitura' }
  else {
    const semanais = p.agenda.filter((i) => i.tipo === 'semanal')
    const atrasado = menor(semanais.filter((i) => i.situacao === 'atrasado'), (i) => i.dataPrevista)
    if (atrasado)
      semanal = { chave: 'semanal', tom: 'atencao', texto: `relatório semanal de ${ddmm(atrasado.dataPrevista)} não foi enviado`, curto: 'semanal atrasado' }
    else {
      const enviados = semanais.filter((i) => i.dataReal !== null)
      const ultimo = enviados.reduce<ItemAgenda | null>((m, i) => (m === null || i.dataReal! > m.dataReal! ? i : m), null)
      semanal = {
        chave: 'semanal', tom: 'ok', curto: null,
        texto: ultimo
          ? `último relatório semanal enviado em ${ddmm(ultimo.dataReal!)}${ultimo.dataReal! <= ultimo.dataPrevista ? ', no dia' : ''}`
          : 'nenhum relatório semanal enviado ainda',
      }
    }
  }

  return [entrega, pendencias, mensagens, semanal]
}

export function dinheiroDaCarteira(l: LeituraFinanceiro): DinheiroCarteira {
  if (!l.ok) return { ok: false, motivo: l.motivo === 'sem_permissao' ? 'sem_permissao' : 'leitura' }
  if (!l.fin.resumo.ok) return { ok: false, motivo: 'leitura' }
  const r = l.fin.resumo.dados
  const t = r.total
  const valor = t.receitaEsperada
  // Mesma base de `percentuais.faturado` (consolidarMargem): só as OS com valor receita.
  const faturado = valor === null
    ? t.receitaRealizada
    : r.porOS.filter((o) => o.receitaEsperada !== null).reduce((s, o) => s + o.receitaRealizada, 0)
  return {
    ok: true,
    valor,
    faturado,
    faturadoTotal: t.receitaRealizada,
    faturadoPct: r.percentuais.faturado,
    aFaturar: valor === null ? null : Math.max(0, valor - faturado),
    acimaDoValor: valor !== null && faturado > valor,
    osSemValor: r.osSemReceita,
    notas: l.fin.faturamento.ok ? l.fin.faturamento.dados.filter((n) => n.contaNaReceita).length : 0,
    custoRealizado: t.custoRealizado,
    custoComprometido: t.custoComprometido,
    margemPct: t.margemPct,
  }
}

export function ficaNaCarteira(o: Pick<ObraCarteira, 'estado' | 'dinheiro'>): boolean {
  // OS sem valor: o valor da obra não está provado (spec §5.1), então a obra fica.
  return !(o.estado.tipo === 'faturando' && o.dinheiro.ok && o.dinheiro.valor !== null && o.dinheiro.osSemValor === 0 && o.dinheiro.aFaturar === 0)
}

export function grupoDe(o: Pick<ObraCarteira, 'sinal' | 'estado'>): 0 | 1 | 2 | 3 | 4 {
  if (o.estado.tipo === 'faturando') return 4
  if (o.estado.tipo === 'sem_cronograma' || o.sinal === null) return 3
  return o.sinal === 'vermelho' ? 0 : o.sinal === 'amarelo' ? 1 : 2
}

const diasParada = (o: ObraCarteira) => (o.estado.tipo === 'parada' ? o.estado.diasUteis : 0)

export function ordenarCarteira(obras: ObraCarteira[]): ObraCarteira[] {
  return [...obras].sort((a, b) =>
    grupoDe(a) - grupoDe(b)
    || diasParada(b) - diasParada(a)
    || (b.desvioDiasUteis ?? 0) - (a.desvioDiasUteis ?? 0)
    || (a.loja ?? '').localeCompare(b.loja ?? '', 'pt-BR'))
}

export function filtrarCarteira(obras: ObraCarteira[], f: FiltroCarteira): ObraCarteira[] {
  switch (f) {
    case 'todas': return obras
    case 'risco': return obras.filter((o) => grupoDe(o) <= 1)
    case 'no_prazo': return obras.filter((o) => grupoDe(o) === 2)
    case 'faturando': return obras.filter((o) => grupoDe(o) === 4)
    default: return obras.filter((o) => o.travas.some((t) => t.quem === f))
  }
}

export function contarTravas(obras: ObraCarteira[]): Record<Quem, { travas: number; obras: number }> {
  const r: Record<Quem, { travas: number; obras: number }> = {
    cliente: { travas: 0, obras: 0 }, manfac: { travas: 0, obras: 0 }, terceiros: { travas: 0, obras: 0 },
  }
  for (const o of obras) {
    for (const q of Object.keys(r) as Quem[]) {
      const n = o.travas.filter((t) => t.quem === q).length
      r[q].travas += n
      if (n > 0) r[q].obras++
    }
  }
  return r
}

const nomeDaObra = (o: ObraCarteira) => [o.os, o.loja].filter(Boolean).join(' · ') || o.id
const comTrava = (t: Trava | null) => (t ? `; trava: ${t.descricao} (${ROTULO_QUEM[t.quem]})` : '; nada travando registrado')

export function excecoesDoDia(obras: ObraCarteira[]): Excecao[] {
  const ex: Excecao[] = []
  const loja = new Map(obras.map((o) => [o.id, o.loja ?? '']))
  for (const o of obras) {
    const add = (gravidade: number, texto: string, quem: Quem | null) =>
      ex.push({ obraId: o.id, obra: nomeDaObra(o), texto, quem, gravidade })
    const tp = o.travaPrincipal
    // Concluída que terminou atrasada: não há o que destravar, não vira exceção todo dia.
    if (o.sinal === 'vermelho' && o.estado.tipo !== 'faturando') {
      const desvio = o.desvioDiasUteis !== null && o.desvioDiasUteis > 0 ? ` (entrega +${diasUteisTexto(o.desvioDiasUteis)})` : ''
      add(0, `atrasada${desvio}${comTrava(tp)}`, tp?.quem ?? null)
    }
    if (o.estado.tipo === 'parada') add(1, `parada há ${diasUteisTexto(o.estado.diasUteis)}${comTrava(tp)}`, tp?.quem ?? null)
    for (const t of o.travas.filter((x) => x.vencida))
      add(2, `restrição vencida em ${ddmm(t.prazo!)}: ${t.descricao} (${ROTULO_QUEM[t.quem]})`, t.quem)
    const msg = o.sinais.find((s) => s.chave === 'mensagens')
    if (msg?.tom === 'ruim') add(3, `${msg.texto}; quem responde: Manfac`, 'manfac')
    const sem = o.sinais.find((s) => s.chave === 'semanal')
    if (sem?.tom === 'atencao') add(4, `${sem.texto}; quem envia: Manfac`, 'manfac')
  }
  return ex.sort((a, b) => a.gravidade - b.gravidade || loja.get(a.obraId)!.localeCompare(loja.get(b.obraId)!, 'pt-BR'))
}

export function resumoCarteira(obras: ObraCarteira[]): {
  porSinal: Record<'vermelho' | 'amarelo' | 'verde' | 'sem', number>; faturando: number
  faturado: number; aFaturar: number; valor: number; custoRealizado: number; foraDasSomas: number; semValor: number; valorIncompleto: number
} {
  const r = { porSinal: { vermelho: 0, amarelo: 0, verde: 0, sem: 0 }, faturando: 0, faturado: 0, aFaturar: 0, valor: 0, custoRealizado: 0, foraDasSomas: 0, semValor: 0, valorIncompleto: 0 }
  for (const o of obras) {
    // O quadro "Como estão as obras" conta as em andamento; as faturando têm contagem própria.
    if (o.estado.tipo === 'faturando') r.faturando++
    else r.porSinal[o.estado.tipo === 'sem_cronograma' ? 'sem' : (o.sinal ?? 'sem')]++
    if (!o.dinheiro.ok) { r.foraDasSomas++; continue }
    r.custoRealizado += o.dinheiro.custoRealizado
    // Sem valor informado, ou incompleto (com OS sem valor), não dá para comparar faturado × valor: fica fora das três somas.
    if (o.dinheiro.valor === null) { r.semValor++; continue }
    if (o.dinheiro.osSemValor > 0) { r.valorIncompleto++; continue }
    r.faturado += o.dinheiro.faturado
    r.aFaturar += o.dinheiro.aFaturar ?? 0
    r.valor += o.dinheiro.valor
  }
  return r
}
