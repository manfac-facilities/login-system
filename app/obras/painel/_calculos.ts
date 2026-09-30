/**
 * Painel gerencial — todas as contas, em funções puras.
 *
 * Fonte: docs/cliente/2026-08-31-sistema-controle-de-obras/spec-painel-gerencial-2026-09-29.md
 * e o mockup aprovado `mockup-dashboard-gerencial-2026-09-28.html` (mesma pasta).
 *
 * Entra: as linhas do banco (obras, diário, tarefas, remarcações) e "hoje" (dia
 * de São Paulo). Sai: o modelo pronto para a tela. Nada aqui lê banco, relógio
 * ou ambiente — é o que deixa cada número testável.
 *
 * Datas são sempre `AAAA-MM-DD`; comparar por string é comparar por data.
 *
 * POSIÇÃO DE HOJE (simplificação do coordenador, na spec): resumo por etapa,
 * paradas, atrasos e cronograma olham a etapa de HOJE — não há histórico diário
 * de etapa. O mês escolhido afeta metas, faturamento, SLAs, equipes e histórico.
 */

import {
  CICLO,
  SEM_BLOQUEIO,
  br,
  dataSP,
  derivar,
  diasDesde,
  estourou,
  faseDe,
  nomeDaEquipe,
  nomeEtapa,
  paradaNaEtapa,
  sitTarefa,
  somaDias,
  tarefaVisivelNaLista,
  type EtapaCiclo,
  type Etapa,
  type ObraRow,
  type RemarcacaoRow,
  type TarefaRow,
} from '../_lib/tipos'

// ============================================================
// Entradas
// ============================================================

/**
 * A coluna `cliente` vem da frente paralela `obras-cliente-da-obra` e pode ainda
 * não existir no banco: por isso é opcional e a página seleciona `*`.
 */
export type ObraPainel = ObraRow & { cliente?: string | null }

export type LinhaDiario = {
  obra_id: string
  data: string
  andou: boolean
  motivo: string | null
  foto_path: string | null
}

export type LinhaTarefa = Pick<TarefaRow, 'obra_id' | 'situacao' | 'prazo' | 'resposta_em'>

export type LinhaRemarcacao = Pick<RemarcacaoRow, 'obra_id' | 'data' | 'de' | 'para' | 'created_at'>

export type Entrada = {
  obras: ObraPainel[]
  diario: LinhaDiario[]
  tarefas: LinhaTarefa[]
  remarcacoes: LinhaRemarcacao[]
  hoje: string
}

export type Comparacao = 'prev' | 'yoy'

/** `cliente` null = Todos. `mes` = `AAAA-MM`. */
export type Filtro = { cliente: string | null; mes: string; cmp: Comparacao }

// ============================================================
// Datas
// ============================================================

function iso(ano: number, mes: number, dia: number): string {
  const d = new Date(Date.UTC(ano, mes - 1, dia))
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(d.getUTCDate()).padStart(2, '0')
  return `${d.getUTCFullYear()}-${mm}-${dd}`
}

const menor = (a: string, b: string) => (a < b ? a : b)

/** `AAAA-MM` → { ano, mes }. */
function partesMes(mes: string): { ano: number; mes: number } {
  const [a, m] = mes.split('-').map(Number)
  return { ano: a, mes: m }
}

/** `AAAA-MM` somado de `n` meses. */
export function somaMeses(mes: string, n: number): string {
  const p = partesMes(mes)
  return iso(p.ano, p.mes + n, 1).slice(0, 7)
}

export const MESES_CURTOS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
export const MESES_LONGOS = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
]

export type Periodo = {
  ano: number
  mes: number
  /** Primeiro dia do mês escolhido. */
  a: string
  /** Último dia considerado: o fim do mês, ou hoje no mês em curso. */
  b: string
  fim: string
  parcial: boolean
  /** Período de comparação, com o mesmo número de dias. */
  pa: string
  pb: string
  /** Acumulado do ano: 01/01 até `b`, e o mesmo trecho do ano anterior. */
  ya: string
  pya: string
  pyb: string
}

/**
 * O período do mês escolhido. Mês em curso compara com os MESMOS DIAS do mês
 * anterior (ou do mesmo mês do ano anterior) — `per()` do mockup.
 */
export function periodoDo(mes: string, cmp: Comparacao, hoje: string): Periodo {
  const { ano, mes: m } = partesMes(mes)
  const a = iso(ano, m, 1)
  const fim = iso(ano, m + 1, 0)
  const b = menor(fim, hoje)
  const pa = cmp === 'prev' ? iso(ano, m - 1, 1) : iso(ano - 1, m, 1)
  const pfim = cmp === 'prev' ? somaDias(a, -1)! : iso(ano - 1, m + 1, 0)
  const pb = menor(somaDias(pa, diasDesde(a, b) ?? 0)!, pfim)
  const diaB = Number(b.slice(8, 10))
  const pyb = menor(iso(ano - 1, m, diaB), iso(ano - 1, m + 1, 0))
  return { ano, mes: m, a, b, fim, parcial: b < fim, pa, pb, ya: iso(ano, 1, 1), pya: iso(ano - 1, 1, 1), pyb }
}

// ============================================================
// Cliente e metas
// ============================================================

/** Chave de obra sem cliente (coluna nula, vazia ou ainda inexistente). */
export const SEM_CLIENTE = '-'
const NOME_SEM_CLIENTE = 'Sem cliente'

/** O cliente sem diferenciar caixa nem espaço — é assim que se casa com a meta. */
export function chaveCliente(o: { cliente?: string | null }): string {
  return (o.cliente ?? '').trim().toLowerCase() || SEM_CLIENTE
}

type Meta = { carteira: number; faturamento: number }

/** Metas mensais por cliente (pedido do João, 28/09). Os demais clientes não têm meta. */
export const METAS: Record<string, Meta> = {
  dpsp: { carteira: 600000, faturamento: 350000 },
  d1000: { carteira: 80000, faturamento: 60000 },
}

/** Soma das metas das chaves dadas; null quando nenhuma tem meta. */
export function metasDe(chaves: string[]): { carteira: number | null; faturamento: number | null } {
  let c = 0
  let f = 0
  for (const k of chaves) {
    const m = METAS[k]
    if (m) {
      c += m.carteira
      f += m.faturamento
    }
  }
  return { carteira: c || null, faturamento: f || null }
}

export type Cliente = { chave: string; nome: string }

/** Os clientes cadastrados nas obras, dos que têm mais obras para os que têm menos. */
export function clientesDas(obras: ObraPainel[]): Cliente[] {
  const mapa = new Map<string, { nome: string; n: number }>()
  for (const o of obras) {
    const k = chaveCliente(o)
    const atual = mapa.get(k)
    if (atual) atual.n++
    else mapa.set(k, { nome: k === SEM_CLIENTE ? NOME_SEM_CLIENTE : (o.cliente ?? '').trim(), n: 1 })
  }
  return Array.from(mapa, ([chave, v]) => ({ chave, ...v }))
    .sort(
      (x, y) =>
        Number(x.chave === SEM_CLIENTE) - Number(y.chave === SEM_CLIENTE) ||
        y.n - x.n ||
        x.nome.localeCompare(y.nome)
    )
    .map(({ chave, nome }) => ({ chave, nome }))
}

// ============================================================
// Valor
// ============================================================

/** Valor nulo conta R$ 0 (e a obra conta como "sem valor"). */
export function valorDe(o: Pick<ObraRow, 'valor'>): number {
  const v = Number(o.valor ?? 0)
  return Number.isFinite(v) ? v : 0
}

const soma = <T,>(l: T[], f: (x: T) => number) => l.reduce((s, x) => s + f(x), 0)
const somaValor = (l: Pick<ObraRow, 'valor'>[]) => soma(l, valorDe)

/** O mínimo de uma obra que as listas da tela precisam. */
export type ObraResumo = {
  id: string
  os: string | null
  loja: string | null
  cliente: string
  equipe: string
  etapa: Etapa
  etapaNome: string
  valor: number
  semValor: boolean
}

function resumo(o: ObraPainel, nomes: Map<string, string>): ObraResumo {
  const k = chaveCliente(o)
  return {
    id: o.id,
    os: o.os,
    loja: o.loja,
    cliente: nomes.get(k) ?? NOME_SEM_CLIENTE,
    equipe: nomeDaEquipe(o),
    etapa: o.etapa,
    etapaNome: nomeEtapa(o.etapa),
    valor: valorDe(o),
    semValor: o.valor === null || o.valor === undefined,
  }
}

// ============================================================
// Carteira e faturamento
// ============================================================

/**
 * Está na carteira no dia D? Hoje: não cancelada e não faturada. Num dia
 * passado, reconstruída: entrou até D, não tinha sido faturada até D e não
 * tinha sido cancelada até D.
 */
export function naCarteiraEm(o: ObraPainel, D: string, hoje: string): boolean {
  if (D >= hoje) return o.etapa !== 'cancelado' && o.etapa !== 'faturado'
  const entrou = dataSP(o.created_at)
  if (!entrou || entrou > D) return false
  if (o.etapa === 'faturado' && o.marco_faturou && o.marco_faturou <= D) return false
  if (o.etapa === 'cancelado') {
    const c = dataSP(o.cancelado_em ?? null)
    if (c === null || c <= D) return false
  }
  return true
}

export function carteiraEm(obras: ObraPainel[], D: string, hoje: string): ObraPainel[] {
  return obras.filter((o) => naCarteiraEm(o, D, hoje))
}

type GrupoCarteira = 'iniciar' | 'andamento' | 'pendFat'

/**
 * Em que parte da carteira a obra estava no dia D. Hoje é a etapa; num dia
 * passado, os marcos: liberada para faturar até D = pendente; começou (ou
 * terminou a execução) até D = andamento; senão, a iniciar.
 */
function grupoEm(o: ObraPainel, D: string, hoje: string): GrupoCarteira {
  if (D >= hoje) {
    if (o.etapa === 'pendFat') return 'pendFat'
    return faseDe(o) === 'antes' ? 'iniciar' : 'andamento'
  }
  if (o.marco_liberou_fat && o.marco_liberou_fat <= D) return 'pendFat'
  if ((o.inicio_real && o.inicio_real <= D) || (o.marco_exec_fim && o.marco_exec_fim <= D)) return 'andamento'
  return 'iniciar'
}

/** Faturado = etapa Faturado, na data em que a obra chegou lá (`marco_faturou`). */
function faturadasEntre(obras: ObraPainel[], a: string, b: string): ObraPainel[] {
  return obras.filter((o) => o.etapa === 'faturado' && !!o.marco_faturou && o.marco_faturou >= a && o.marco_faturou <= b)
}

export function faturadoEntre(obras: ObraPainel[], a: string, b: string): number {
  return somaValor(faturadasEntre(obras, a, b))
}

// ============================================================
// Seções
// ============================================================

export type Kpis = {
  carteira: {
    valor: number
    qtd: number
    semValor: number
    anterior: number
    iniciar: number
    andamento: number
    pendFat: number
  }
  faturamentoMes: { valor: number; anterior: number }
  faturadoAno: { valor: number; anterior: number; metaAcumulada: number | null }
  pendente: { valor: number; qtd: number; anterior: number }
}

function kpisDe(obras: ObraPainel[], P: Periodo, hoje: string, metaFat: number | null): Kpis {
  const cart = carteiraEm(obras, P.b, hoje)
  const cartAnt = carteiraEm(obras, P.pb, hoje)
  const grupo = (l: ObraPainel[], D: string, g: GrupoCarteira) => l.filter((o) => grupoEm(o, D, hoje) === g)
  const pend = grupo(cart, P.b, 'pendFat')
  return {
    carteira: {
      valor: somaValor(cart),
      qtd: cart.length,
      semValor: cart.filter((o) => o.valor === null || o.valor === undefined).length,
      anterior: somaValor(cartAnt),
      iniciar: somaValor(grupo(cart, P.b, 'iniciar')),
      andamento: somaValor(grupo(cart, P.b, 'andamento')),
      pendFat: somaValor(pend),
    },
    faturamentoMes: { valor: faturadoEntre(obras, P.a, P.b), anterior: faturadoEntre(obras, P.pa, P.pb) },
    faturadoAno: {
      valor: faturadoEntre(obras, P.ya, P.b),
      anterior: faturadoEntre(obras, P.pya, P.pyb),
      metaAcumulada: metaFat ? metaFat * P.mes : null,
    },
    pendente: { valor: somaValor(pend), qtd: pend.length, anterior: somaValor(grupo(cartAnt, P.pb, 'pendFat')) },
  }
}

export type LinhaCliente = {
  chave: string
  nome: string
  carteira: number
  metaCarteira: number | null
  faturadoMes: number
  metaFaturamento: number | null
  faturadoAno: number
  pendente: number
  pendenteQtd: number
}

function linhaCliente(chave: string, nome: string, obras: ObraPainel[], P: Periodo, hoje: string, metas: ReturnType<typeof metasDe>): LinhaCliente {
  const cart = carteiraEm(obras, P.b, hoje)
  const pend = cart.filter((o) => grupoEm(o, P.b, hoje) === 'pendFat')
  return {
    chave,
    nome,
    carteira: somaValor(cart),
    metaCarteira: metas.carteira,
    faturadoMes: faturadoEntre(obras, P.a, P.b),
    metaFaturamento: metas.faturamento,
    faturadoAno: faturadoEntre(obras, P.ya, P.b),
    pendente: somaValor(pend),
    pendenteQtd: pend.length,
  }
}

/** As etapas da carteira, na ordem da esteira (Faturado fica fora). */
const ETAPAS_CARTEIRA: EtapaCiclo[] = CICLO.map((c) => c.k).filter((k) => k !== 'faturado')

export type ObraNaEtapa = { obra: ObraResumo; diasNaEtapa: number | null }
export type LinhaEtapa = { etapa: EtapaCiclo; nome: string; qtd: number; valor: number; obras: ObraNaEtapa[] }

function resumoPorEtapa(obras: ObraPainel[], hoje: string, nomes: Map<string, string>) {
  const cart = carteiraEm(obras, hoje, hoje)
  const linhas: LinhaEtapa[] = ETAPAS_CARTEIRA.map((k) => {
    const g = cart.filter((o) => o.etapa === k)
    return {
      etapa: k,
      nome: nomeEtapa(k),
      qtd: g.length,
      valor: somaValor(g),
      obras: g
        .map((o) => ({ obra: resumo(o, nomes), diasNaEtapa: paradaNaEtapa(o, hoje) }))
        .sort((x, y) => (y.diasNaEtapa ?? -1) - (x.diasNaEtapa ?? -1)),
    }
  })
  return {
    linhas,
    total: {
      qtd: cart.length,
      valor: somaValor(cart),
      semValor: cart.filter((o) => o.valor === null || o.valor === undefined).length,
    },
  }
}

export type ItemSla = { obra: ObraResumo; dias: number }
export type Sla = {
  media: number | null
  mediaAnterior: number | null
  pior: ItemSla | null
  /** Da mais lenta para a mais rápida. */
  concluidas: ItemSla[]
  faixas: { rotulo: string; qtd: number; cor: string }[]
  esperando: { qtd: number; valor: number; maisAntiga: ItemSla | null }
}

const FAIXAS_SLA: [string, number, number, string][] = [
  ['até 7 dias', 0, 7, '#35c98a'],
  ['8 a 15', 8, 15, '#5aa9f0'],
  ['16 a 30', 16, 30, '#f4b73f'],
  ['mais de 30', 31, Infinity, '#ff4d6d'],
]

function montarSla(
  concluidas: ItemSla[],
  anteriores: number[],
  esperando: { o: ObraPainel; item: ItemSla }[]
): Sla {
  const ord = concluidas.slice().sort((x, y) => y.dias - x.dias)
  const media = ord.length ? soma(ord, (i) => i.dias) / ord.length : null
  const esp = esperando.map((e) => e.item).sort((x, y) => y.dias - x.dias)
  return {
    media,
    mediaAnterior: anteriores.length ? soma(anteriores, (d) => d) / anteriores.length : null,
    pior: ord[0] ?? null,
    concluidas: ord,
    faixas: FAIXAS_SLA.map(([rotulo, de, ate, cor]) => ({
      rotulo,
      qtd: ord.filter((i) => i.dias >= de && i.dias <= ate).length,
      cor,
    })),
    esperando: { qtd: esp.length, valor: somaValor(esperando.map((e) => e.o)), maisAntiga: esp[0] ?? null },
  }
}

/** Pendente faturamento → NF: `marco_liberou_fat` → `marco_faturou`, das faturadas no mês. */
function slaPendFat(obras: ObraPainel[], P: Periodo, hoje: string, nomes: Map<string, string>): Sla {
  const dias = (o: ObraPainel) => diasDesde(o.marco_liberou_fat, o.marco_faturou ?? '')
  const feitas = (a: string, b: string) => faturadasEntre(obras, a, b).filter((o) => dias(o) !== null)
  return montarSla(
    feitas(P.a, P.b).map((o) => ({ obra: resumo(o, nomes), dias: dias(o)! })),
    feitas(P.pa, P.pb).map((o) => dias(o)!),
    obras
      .filter((o) => o.etapa === 'pendFat')
      .map((o) => ({
        o,
        item: { obra: resumo(o, nomes), dias: Math.max(0, diasDesde(o.marco_liberou_fat || o.desde_etapa, hoje) ?? 0) },
      }))
  )
}

/**
 * Liberação → OS aprovada: `liberado_em` → `aprovacao`, das aprovadas no mês.
 * OS aprovada ANTES da liberação (dias negativos) não é espera por aprovação e
 * fica fora da média.
 */
function slaAprovacaoOS(obras: ObraPainel[], P: Periodo, hoje: string, nomes: Map<string, string>): Sla {
  const dias = (o: ObraPainel) => diasDesde(o.liberado_em, o.aprovacao ?? '')
  const feitas = (a: string, b: string) =>
    obras.filter((o) => !!o.aprovacao && o.aprovacao >= a && o.aprovacao <= b && (dias(o) ?? -1) >= 0)
  return montarSla(
    feitas(P.a, P.b).map((o) => ({ obra: resumo(o, nomes), dias: dias(o)! })),
    feitas(P.pa, P.pb).map((o) => dias(o)!),
    obras
      .filter((o) => !!o.liberado_em && !o.aprovacao && !o.os_aprovada && o.etapa !== 'cancelado' && o.etapa !== 'faturado')
      .map((o) => ({ o, item: { obra: resumo(o, nomes), dias: Math.max(0, diasDesde(o.liberado_em, hoje) ?? 0) } }))
  )
}

/** Dias em que o diário marcou "andou", por obra e por mês (`AAAA-MM`). */
export function diasTrabalhados(diario: LinhaDiario[]): Map<string, Map<string, number>> {
  const m = new Map<string, Map<string, number>>()
  for (const d of diario) {
    if (!d.andou) continue
    const porMes = m.get(d.obra_id) ?? new Map<string, number>()
    const k = d.data.slice(0, 7)
    porMes.set(k, (porMes.get(k) ?? 0) + 1)
    m.set(d.obra_id, porMes)
  }
  return m
}

export type ObraDaEquipe = {
  obra: ObraResumo
  situacao: 'concluida' | 'antes' | 'execucao'
  diasNoMes: number
  diasTotal: number
}
export type LinhaEquipe = {
  chave: string
  nome: string
  receita: number
  receitaAnterior: number
  obrasConcluidas: number
  diasNessasObras: number
  produtividade: number | null
  diasNoMes: number
  obras: ObraDaEquipe[]
}

/**
 * Receita = valor das obras cuja execução terminou (`marco_exec_fim`) no mês,
 * pela equipe gravada na obra (texto livre; trim e caixa só para agrupar).
 * Dias = dias com "andou" no diário. Produtividade = receita ÷ dias nessas obras.
 */
function equipesDoMes(obras: ObraPainel[], diario: LinhaDiario[], P: Periodo, nomes: Map<string, string>) {
  const dias = diasTrabalhados(diario)
  const mes = P.a.slice(0, 7)
  const noMes = (id: string) => dias.get(id)?.get(mes) ?? 0
  const total = (id: string) => soma(Array.from(dias.get(id)?.values() ?? []), (n) => n)
  const chaveEq = (o: ObraPainel) => nomeDaEquipe(o).trim().toLowerCase()
  const entre = (d: string | null, a: string, b: string) => !!d && d >= a && d <= b

  const mapa = new Map<string, LinhaEquipe>()
  const linha = (o: ObraPainel) => {
    const k = chaveEq(o)
    let l = mapa.get(k)
    if (!l) {
      l = {
        chave: k,
        nome: nomeDaEquipe(o).trim(),
        receita: 0,
        receitaAnterior: 0,
        obrasConcluidas: 0,
        diasNessasObras: 0,
        produtividade: null,
        diasNoMes: 0,
        obras: [],
      }
      mapa.set(k, l)
    }
    return l
  }

  for (const o of obras) {
    const dm = noMes(o.id)
    const concl = entre(o.marco_exec_fim, P.a, P.b)
    if (dm || concl) {
      const l = linha(o)
      l.diasNoMes += dm
      if (concl) {
        l.receita += valorDe(o)
        l.obrasConcluidas++
        l.diasNessasObras += total(o.id)
      }
      l.obras.push({
        obra: resumo(o, nomes),
        situacao: concl ? 'concluida' : o.marco_exec_fim && o.marco_exec_fim < P.a ? 'antes' : 'execucao',
        diasNoMes: dm,
        diasTotal: total(o.id),
      })
    }
  }
  // A comparação só vale para equipe que aparece no mês.
  for (const o of obras) {
    const l = mapa.get(chaveEq(o))
    if (l && entre(o.marco_exec_fim, P.pa, P.pb)) l.receitaAnterior += valorDe(o)
  }

  const linhas = Array.from(mapa.values())
  for (const l of linhas) {
    l.produtividade = l.diasNessasObras ? l.receita / l.diasNessasObras : null
    l.obras.sort((x, y) => y.diasNoMes - x.diasNoMes)
  }
  linhas.sort((x, y) => y.receita - x.receita || x.nome.localeCompare(y.nome))
  const t = {
    receita: soma(linhas, (l) => l.receita),
    obrasConcluidas: soma(linhas, (l) => l.obrasConcluidas),
    diasNessasObras: soma(linhas, (l) => l.diasNessasObras),
    diasNoMes: soma(linhas, (l) => l.diasNoMes),
  }
  return { linhas, total: { ...t, produtividade: t.diasNessasObras ? t.receita / t.diasNessasObras : null } }
}

export type ObraParada = { obra: ObraResumo; desde: string | null; dias: number | null }
export type MotivoParada = { motivo: string; valor: number; obras: ObraParada[] }

const SEM_MOTIVO = 'Sem motivo registrado'

/** Paradas hoje (etapa Paralisado); motivo = bloqueio da obra ou o do último "não andou". */
function paradasDe(obras: ObraPainel[], diario: LinhaDiario[], hoje: string, nomes: Map<string, string>) {
  const ultimoNaoAndou = new Map<string, { data: string; motivo: string | null }>()
  for (const d of diario) {
    if (d.andou) continue
    const u = ultimoNaoAndou.get(d.obra_id)
    if (!u || d.data > u.data) ultimoNaoAndou.set(d.obra_id, { data: d.data, motivo: d.motivo })
  }
  const par = obras.filter((o) => o.etapa === 'paralisado')
  const grupos = new Map<string, ObraPainel[]>()
  for (const o of par) {
    const b = o.bloqueio && o.bloqueio !== SEM_BLOQUEIO ? o.bloqueio : null
    const m = b ?? ultimoNaoAndou.get(o.id)?.motivo ?? SEM_MOTIVO
    grupos.set(m, [...(grupos.get(m) ?? []), o])
  }
  const motivos: MotivoParada[] = Array.from(grupos, ([motivo, l]) => ({
    motivo,
    valor: somaValor(l),
    obras: l
      .map((o) => ({ obra: resumo(o, nomes), desde: o.desde_etapa || o.atualizacao, dias: paradaNaEtapa(o, hoje) }))
      .sort((x, y) => (y.dias ?? -1) - (x.dias ?? -1)),
  })).sort((x, y) => y.valor - x.valor || y.obras.length - x.obras.length || x.motivo.localeCompare(y.motivo))
  return { qtd: par.length, valor: somaValor(par), motivos }
}

export type ObraAtrasada = {
  obra: ObraResumo
  fimPrevisto: string | null
  diasAtraso: number
  remarcacao: string | null
}
export type CategoriaAtraso = { k: 'ok' | 'rem' | 'late' | 'both'; nome: string; cor: string; obras: ObraAtrasada[] }

/** Última remarcação de cada obra, já no texto da tela ("de → para"). */
function remarcacoesPorObra(remarcacoes: LinhaRemarcacao[]): Map<string, string> {
  const ult = new Map<string, LinhaRemarcacao>()
  for (const r of remarcacoes) {
    const u = ult.get(r.obra_id)
    if (!u || r.created_at > u.created_at) ult.set(r.obra_id, r)
  }
  return new Map(Array.from(ult, ([id, r]) => [id, `${br(r.de)} → ${br(r.para)}`]))
}

/**
 * Em campo = em andamento ou paralisado, hoje. Atrasada = a regra de atraso de
 * `tipos.ts`: passou do fim previsto (`derivar().atraso > 0`) ou estourou a
 * duração (`estourou`). Remarcada = tem linha em `obras_remarcacao`.
 */
function atrasosDe(obras: ObraPainel[], remarcacoes: Map<string, string>, hoje: string, nomes: Map<string, string>) {
  const campo = obras
    .filter((o) => o.etapa === 'andamento' || o.etapa === 'paralisado')
    .map((o) => {
      const d = derivar(o, hoje)
      const late = (d.atraso ?? 0) > 0 || estourou(d)
      const rem = remarcacoes.has(o.id)
      return {
        late,
        rem,
        item: {
          obra: resumo(o, nomes),
          fimPrevisto: d.fimCalc,
          diasAtraso: Math.max(0, d.atraso ?? 0),
          remarcacao: remarcacoes.get(o.id) ?? null,
        } as ObraAtrasada,
      }
    })
  const cat = (k: CategoriaAtraso['k'], nome: string, cor: string, f: (x: (typeof campo)[number]) => boolean): CategoriaAtraso => ({
    k,
    nome,
    cor,
    obras: campo
      .filter(f)
      .map((x) => x.item)
      .sort((x, y) => y.diasAtraso - x.diasAtraso),
  })
  const n = campo.length
  const atrasadas = campo.filter((x) => x.late).length
  const remarcadas = campo.filter((x) => x.rem).length
  return {
    emCampo: n,
    atrasadas,
    remarcadas,
    pctAtrasadas: n ? (atrasadas / n) * 100 : 0,
    pctRemarcadas: n ? (remarcadas / n) * 100 : 0,
    categorias: [
      cat('ok', 'No prazo', '#35c98a', (x) => !x.late && !x.rem),
      cat('rem', 'Remarcada, no prazo', '#f4b73f', (x) => !x.late && x.rem),
      cat('late', 'Atrasada', '#ff4d6d', (x) => x.late && !x.rem),
      cat('both', 'Remarcada e atrasada', '#b83b6e', (x) => x.late && x.rem),
    ],
  }
}

/** As etapas em que a obra entra na fila do Diário (`ETAPAS_FILA` de `diario/page.tsx`). */
const ETAPAS_FILA_DIARIO: Etapa[] = ['levantamento', 'andamento', 'paralisado']

export type Ritmo = {
  esperados: number
  responderam: number
  naoAndou: number
  comFoto: number
  abertas: number
  vencidas: number
  respondidas7: number
}

/**
 * As contas das telas Diário e Tarefas, para as obras do filtro. Tarefas:
 * "abertas" inclui as vencidas (como na tela Tarefas); aberta de obra cancelada
 * sai (`tarefaVisivelNaLista`).
 */
function ritmoDe(obras: ObraPainel[], diario: LinhaDiario[], tarefas: LinhaTarefa[], hoje: string): Ritmo {
  const fila = new Set(obras.filter((o) => ETAPAS_FILA_DIARIO.includes(o.etapa)).map((o) => o.id))
  const deHoje = diario.filter((d) => d.data === hoje && fila.has(d.obra_id))
  const etapa = new Map(obras.map((o) => [o.id, o.etapa]))
  const ts = tarefas.filter((t) => etapa.has(t.obra_id) && tarefaVisivelNaLista(t, etapa.get(t.obra_id)))
  const sit = (t: LinhaTarefa) => sitTarefa(t, hoje)
  return {
    esperados: fila.size,
    responderam: deHoje.length,
    naoAndou: deHoje.filter((d) => !d.andou).length,
    comFoto: deHoje.filter((d) => !!d.foto_path).length,
    abertas: ts.filter((t) => sit(t) !== 'respondida').length,
    vencidas: ts.filter((t) => sit(t) === 'vencida').length,
    respondidas7: ts.filter((t) => {
      if (sit(t) !== 'respondida') return false
      const d = diasDesde(t.resposta_em, hoje)
      return d !== null && d >= 0 && d < 7
    }).length,
  }
}

export type LinhaGantt = {
  obra: ObraResumo
  grupo: 'iniciar' | 'campo' | 'terminou'
  /** Planejado: do início planejado até início + duração (fim exclusivo). */
  planIni: string | null
  planFim: string | null
  /** Realizado: do início real até o fim real, ou hoje se ainda está em campo. */
  realIni: string | null
  realFim: string | null
  emCurso: boolean
  parada: boolean
  atrasada: boolean
  diasAtraso: number
  terminouComAtraso: number | null
  remarcada: boolean
}

/** Janela do cronograma, em dias antes e depois de hoje (a do mockup). */
export const JANELA_GANTT = { antes: 28, depois: 42 }

/**
 * Obras a iniciar, em campo e as que terminaram nos últimos 14 dias, posição de
 * hoje. Obra sem início planejado nem real não tem o que desenhar: sai da lista
 * e entra na contagem `semDatas`.
 */
function cronogramaDe(obras: ObraPainel[], remarcacoes: Map<string, string>, hoje: string, nomes: Map<string, string>) {
  const j0 = somaDias(hoje, -JANELA_GANTT.antes)!
  const j1 = somaDias(hoje, JANELA_GANTT.depois)!
  const limiteTerminou = somaDias(hoje, -14)!
  let semDatas = 0
  const linhas: LinhaGantt[] = []
  for (const o of obras) {
    if (o.etapa === 'cancelado' || o.etapa === 'faturado') continue
    const fase = faseDe(o)
    const fimReal = o.fim_real || o.marco_exec_fim
    const grupo = fase === 'antes' ? 'iniciar' : fase === 'campo' ? 'campo' : fimReal && fimReal >= limiteTerminou ? 'terminou' : null
    if (!grupo) continue
    if (!o.inicio_plan && !o.inicio_real) {
      semDatas++
      continue
    }
    const d = derivar(o, hoje)
    const planIni = o.inicio_plan
    const planFim = planIni ? somaDias(planIni, o.duracao || 1) : null
    const realIni = o.inicio_real
    const realFim = realIni ? (grupo === 'terminou' ? fimReal : hoje) : null
    const ini = [planIni, realIni].filter(Boolean).sort()[0]!
    const fim = [planFim, realFim, ini].filter(Boolean).sort().at(-1)!
    if (fim < j0 || ini > j1) continue

    let atrasada = false
    let diasAtraso = 0
    if (grupo === 'campo') {
      atrasada = (d.atraso ?? 0) > 0 || estourou(d)
      diasAtraso = Math.max(0, d.atraso ?? 0)
    } else if (grupo === 'iniciar' && planIni && !realIni && planIni < hoje) {
      atrasada = true
      diasAtraso = diasDesde(planIni, hoje) ?? 0
    }
    const fimPlanejado = d.fimCalc
    const atrasoFinal = grupo === 'terminou' && fimReal && fimPlanejado ? diasDesde(fimPlanejado, fimReal) : null
    linhas.push({
      obra: resumo(o, nomes),
      grupo,
      planIni,
      planFim,
      realIni,
      realFim,
      emCurso: grupo === 'campo' && !!realIni,
      parada: o.etapa === 'paralisado',
      atrasada,
      diasAtraso,
      terminouComAtraso: atrasoFinal !== null && atrasoFinal > 0 ? atrasoFinal : null,
      remarcada: remarcacoes.has(o.id),
    })
  }
  const inicio = (l: LinhaGantt) => l.planIni ?? l.realIni ?? ''
  linhas.sort((x, y) => (inicio(x) < inicio(y) ? -1 : inicio(x) > inicio(y) ? 1 : 0))
  return { linhas, semDatas, janela: { de: j0, ate: j1 } }
}

export type MesHistorico = {
  mes: string
  valor: number
  acumulado: number
  parcial: boolean
  metaAcumulada: number | null
}

/** Faturado mês a mês, 12 meses até o mês escolhido; o acumulado recomeça em janeiro. */
function historicoDe(obras: ObraPainel[], P: Periodo, hoje: string, metaFat: number | null) {
  const ultimo = P.a.slice(0, 7)
  const meses: MesHistorico[] = []
  for (let i = 11; i >= 0; i--) {
    const mes = somaMeses(ultimo, -i)
    const { ano, mes: m } = partesMes(mes)
    const fim = iso(ano, m + 1, 0)
    const b = menor(fim, hoje)
    meses.push({
      mes,
      valor: faturadoEntre(obras, iso(ano, m, 1), b),
      acumulado: faturadoEntre(obras, iso(ano, 1, 1), b),
      parcial: b < fim,
      metaAcumulada: metaFat ? metaFat * m : null,
    })
  }
  const fechados = meses.filter((m) => !m.parcial)
  const melhor = meses.reduce((x, y) => (y.valor > x.valor ? y : x))
  return {
    meses,
    mediaFechados: fechados.length ? soma(fechados, (m) => m.valor) / fechados.length : 0,
    fechados: fechados.length,
    melhor,
  }
}

// ============================================================
// O painel inteiro
// ============================================================

export type Painel = ReturnType<typeof montarPainel>

export function montarPainel(e: Entrada, f: Filtro) {
  const { hoje } = e
  const P = periodoDo(f.mes, f.cmp, hoje)
  const clientes = clientesDas(e.obras)
  const nomes = new Map(clientes.map((c) => [c.chave, c.nome]))
  const cliente = f.cliente && nomes.has(f.cliente) ? f.cliente : null
  const obras = cliente ? e.obras.filter((o) => chaveCliente(o) === cliente) : e.obras
  const metas = metasDe(cliente ? [cliente] : clientes.map((c) => c.chave))
  const remarcacoes = remarcacoesPorObra(e.remarcacoes)

  const linhasCliente = clientes.map((c) =>
    linhaCliente(c.chave, c.nome, e.obras.filter((o) => chaveCliente(o) === c.chave), P, hoje, metasDe([c.chave]))
  )
  const metasTodos = metasDe(clientes.map((c) => c.chave))

  return {
    hoje,
    periodo: P,
    filtro: { cliente, mes: f.mes, cmp: f.cmp },
    clientes,
    clienteNome: cliente ? nomes.get(cliente)! : null,
    metas,
    kpis: kpisDe(obras, P, hoje, metas.faturamento),
    porCliente: {
      linhas: linhasCliente,
      total: linhaCliente('', 'Todos (soma)', e.obras, P, hoje, metasTodos),
    },
    resumo: resumoPorEtapa(obras, hoje, nomes),
    slaPendFat: slaPendFat(obras, P, hoje, nomes),
    slaOS: slaAprovacaoOS(obras, P, hoje, nomes),
    equipes: equipesDoMes(obras, e.diario, P, nomes),
    paradas: paradasDe(obras, e.diario, hoje, nomes),
    atrasos: atrasosDe(obras, remarcacoes, hoje, nomes),
    ritmo: ritmoDe(obras, e.diario, e.tarefas, hoje),
    cronograma: cronogramaDe(obras, remarcacoes, hoje, nomes),
    historico: historicoDe(obras, P, hoje, metas.faturamento),
  }
}
