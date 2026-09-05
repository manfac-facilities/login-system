/**
 * Controle de Obras — importação da planilha do cliente (carga inicial).
 *
 * Funções PURAS de parse e normalização — nenhuma delas toca Supabase, nem
 * ExcelJS além de ler valores de célula já carregadas em memória. Quem lê o
 * arquivo .xlsx e grava no banco é `app/obras/importar/_actions.ts`.
 *
 * Origem de tudo que está aqui:
 *   scratchpad/dicionario-planilha.md (dicionário coluna a coluna + as 5 armadilhas)
 *   docs/cliente/2026-08-31-sistema-controle-de-obras/spec-v0-treinamento.md §6
 *   docs/cliente/2026-08-31-sistema-controle-de-obras/planilha-dpsp-rev02-dump.txt (dado real)
 *
 * A PLANILHA TEM DUAS ABAS E AS DUAS ENTRAM:
 *   - Pipeline DPSP (187 chamados) — é A BASE de obras do sistema.
 *   - Planejamento DPSP (19 obras ativas) — enriquece as 19 que estão em campo
 *     com o detalhe operacional (bloqueio, pendência, próxima ação, cronograma).
 * Casam por `os`. Importar só a Planejamento deixaria a base sem nenhuma obra
 * em fechamento/faturamento — as 89 executadas-e-não-faturadas que motivaram
 * o projeto.
 *
 * AS 5 ARMADILHAS (ver dicionario-planilha.md para a contagem completa):
 *   1. Remarcações (colunas U/V/W da Planejamento) dependem de uma pasta
 *      externa ausente ('[1]REMARCACOES DPSP'). NÃO SÃO LIDAS por este
 *      módulo — nem a função de extração toca essas colunas.
 *   2. "Avanço físico" mistura escala 0–1 e 0–100. `normalizarAvancoFisico`
 *      existe e está testada, mas NÃO é chamada pelo import — a v0 usa prazo
 *      consumido, não percentual (spec §6).
 *   3. `MAU USO - APROVAR OS` é etapa + causa fundidas — `etapaDeStatusManfac`
 *      separa em `etapa: 'aprovarOS'` + `mauUso: true`.
 *   4. Nº OS não serve como chave sozinho — `normalizarOs` anula os literais
 *      que colidem ou não são número (`SEM OS`, `GARANTIA`); o resto
 *      (truncados, com dígito a mais) é mantido como texto, porque não colide.
 *   5. Datas de época do Excel (`Fri Dec 29 1899...`, resultado de fórmula
 *      sobre célula vazia) — `paraDataIso` remove qualquer data com ano
 *      <= 1901 e devolve `null`, nunca a data suja.
 */

import { BLOQUEIOS, PRIORIDADES, br, diasDesde, type Bloqueio, type Etapa, type Prioridade } from './tipos'

// ============================================================
// 1. Formas de valor de célula
//
// O valor "cru" de uma célula pode chegar de duas formas:
//   - um primitivo (string, number, boolean, Date, null/undefined) — é o que
//     `ExcelJS` devolve para célula sem fórmula;
//   - um objeto de fórmula `{ formula, result }` (ou `{ sharedFormula, result }`,
//     ou só `{ formula }` sem `result` quando o cache nunca foi calculado, ou
//     `{ error }` quando a fórmula quebrou) — é o que `ExcelJS` devolve para
//     célula COM fórmula. É exatamente essa forma que carrega o bug de 1899 e
//     os buracos das remarcações (armadilhas 1 e 5).
// ============================================================

type ValorFormula = {
  formula?: string
  sharedFormula?: string
  result?: unknown
  error?: unknown
}

/** O tipo aceito por todo parser de célula deste módulo. */
export type CelulaBruta = string | number | boolean | Date | ValorFormula | null | undefined

function ehObjetoFormula(v: unknown): v is ValorFormula {
  return typeof v === 'object' && v !== null && !(v instanceof Date)
}

// ============================================================
// 2. Parsers de célula — a base de tudo
// ============================================================

/** Texto limpo. `''`, `null`, `undefined` e objeto sem resultado viram `null`. */
export function paraTexto(valor: CelulaBruta): string | null {
  if (valor === null || valor === undefined) return null
  if (valor instanceof Date) return null // texto não representa data
  if (ehObjetoFormula(valor)) {
    if ('error' in valor && valor.error !== undefined) return null
    if ('result' in valor) return paraTexto(valor.result as CelulaBruta)
    return null // `{"formula":"..."}` sem cache — nada para aproveitar
  }
  const texto = String(valor).trim()
  return texto === '' ? null : texto
}

/**
 * Número tolerante a formato BR (`1.205,50`) e US (`68134.9`) convivendo na
 * mesma coluna — sujeira menor real da Pipeline (linha 175 do dump).
 */
export function paraNumero(valor: CelulaBruta): number | null {
  if (valor === null || valor === undefined) return null
  if (typeof valor === 'number') return Number.isFinite(valor) ? valor : null
  if (valor instanceof Date) return null
  if (ehObjetoFormula(valor)) {
    if ('error' in valor && valor.error !== undefined) return null
    if ('result' in valor) return paraNumero(valor.result as CelulaBruta)
    return null
  }
  const texto = String(valor).trim()
  if (texto === '') return null
  const pareceBr = /^-?\d{1,3}(\.\d{3})*,\d+$/.test(texto)
  const normalizado = pareceBr ? texto.replace(/\./g, '').replace(',', '.') : texto.replace(',', '.')
  const numero = Number(normalizado)
  return Number.isFinite(numero) ? numero : null
}

const ANO_MINIMO_VALIDO = 1901 // abaixo disso é o bug de época do Excel (armadilha 5)

/**
 * Data em ISO `AAAA-MM-DD`, ou `null` — nunca uma data de época do Excel.
 *
 * Cobre três formas de entrada real, todas vistas no dump:
 *   - `Date` (o que ExcelJS devolve para célula de data e para o `.result`
 *     de uma fórmula de data já calculada);
 *   - string ISO direta (`"2026-07-06"`);
 *   - string no formato `Date#toString()` do JS (`"Fri Dec 29 1899 20:53:32
 *     GMT-0306 ..."`, `"Tue Aug 18 2026 21:00:00 GMT-0300 ..."`) — é assim que
 *     o dump grava o `.result` de uma fórmula quando alguém fez `String(data)`
 *     nele. `new Date(texto)` entende esse formato nativamente.
 * Lixo puro (`"Invalid Date"`, objeto sem `result`, `{"formula":"..."}` sem
 * cache) cai em `null` pelos mesmos caminhos.
 */
export function paraDataIso(valor: CelulaBruta): string | null {
  if (valor === null || valor === undefined) return null
  if (valor instanceof Date) {
    if (Number.isNaN(valor.getTime())) return null
    if (valor.getUTCFullYear() <= ANO_MINIMO_VALIDO) return null
    return formatarIso(valor)
  }
  if (ehObjetoFormula(valor)) {
    if ('error' in valor && valor.error !== undefined) return null
    if ('result' in valor) return paraDataIso(valor.result as CelulaBruta)
    return null
  }
  if (typeof valor === 'number') return null // serial de data cru não aparece nesta planilha
  const texto = String(valor).trim()
  if (texto === '') return null
  const isoDireto = /^(\d{4})-(\d{2})-(\d{2})/.exec(texto)
  if (isoDireto) {
    const ano = Number(isoDireto[1])
    if (ano <= ANO_MINIMO_VALIDO) return null
    return `${isoDireto[1]}-${isoDireto[2]}-${isoDireto[3]}`
  }
  const data = new Date(texto)
  if (Number.isNaN(data.getTime())) return null
  if (data.getUTCFullYear() <= ANO_MINIMO_VALIDO) return null
  return formatarIso(data)
}

function formatarIso(data: Date): string {
  const mm = String(data.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(data.getUTCDate()).padStart(2, '0')
  return `${data.getUTCFullYear()}-${mm}-${dd}`
}

// ============================================================
// 3. Normalizadores de domínio — a sujeira menor do dicionário
// ============================================================

/**
 * Armadilha 4 — Nº OS não serve como chave sozinho.
 * `SEM OS` colide entre 4 chamados; `GARANTIA` é nome no lugar de número.
 * Os dois viram `null` (a PK real é o uuid da linha). Truncados
 * (`1142`, `17769`) e o de dígito a mais (`0826-0011526`) são mantidos como
 * texto — não colidem entre si, só fogem do padrão `NNNN-NNNNNN`.
 */
export function normalizarOs(raw: string | null): string | null {
  if (!raw) return null
  const chave = raw.trim().toUpperCase()
  if (chave === 'SEM OS' || chave === 'GARANTIA') return null
  return raw.trim()
}

/** `DPA` é a mesma grafia de `DP` para o cliente — sujeira menor do dicionário. */
export function normalizarLoja(raw: string | null): string | null {
  const texto = raw?.trim()
  if (!texto) return null
  if (/^DPA\s/i.test(texto)) return 'DP ' + texto.slice(4)
  return texto
}

/** `DEFINIR` é placeholder, não equipe (5 das 19 obras ativas). */
export function normalizarEquipe(raw: string | null): string | null {
  const texto = raw?.trim()
  if (!texto) return null
  if (texto.toUpperCase() === 'DEFINIR') return null
  return texto
}

export function normalizarBloqueio(raw: string | null): Bloqueio | null {
  if (!raw) return null
  const alvo = raw.trim().toUpperCase()
  return BLOQUEIOS.find((b) => b.toUpperCase() === alvo) ?? null
}

export function normalizarPrioridade(raw: string | null): Prioridade | null {
  if (!raw) return null
  const alvo = raw.trim().toUpperCase()
  return PRIORIDADES.find((p) => p.toUpperCase() === alvo) ?? null
}

const ENTIDADES_HTML: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  aacute: 'á',
  Aacute: 'Á',
  agrave: 'à',
  acirc: 'â',
  atilde: 'ã',
  Atilde: 'Ã',
  eacute: 'é',
  Eacute: 'É',
  ecirc: 'ê',
  egrave: 'è',
  iacute: 'í',
  Iacute: 'Í',
  icirc: 'î',
  oacute: 'ó',
  Oacute: 'Ó',
  ocirc: 'ô',
  otilde: 'õ',
  Otilde: 'Õ',
  ograve: 'ò',
  uacute: 'ú',
  Uacute: 'Ú',
  ucirc: 'û',
  ugrave: 'ù',
  ccedil: 'ç',
  Ccedil: 'Ç',
  ntilde: 'ñ',
  Ntilde: 'Ñ',
}

/** Descrições vindas da planilha trazem entidades HTML cruas (`&ccedil;&atilde;o`). */
export function decodificarEntidadesHtml(texto: string | null): string | null {
  if (!texto) return texto ?? null
  return texto.replace(/&([a-zA-Z]+);/g, (match, nome: string) => ENTIDADES_HTML[nome] ?? match)
}

/**
 * Armadilha 2 — "Avanço físico" mistura escala 0–1 (12 valores) e 0–100
 * (1 valor, `95`). Regra: `valor > 1 → dividir por 100`.
 *
 * NÃO CHAMADA PELO IMPORT — a v0 não grava este campo (spec §6: o mockup usa
 * prazo consumido, não percentual; a pergunta 03 ao cliente segue aberta).
 * Existe e está testada porque a resposta pode mudar isso depois.
 */
export function normalizarAvancoFisico(valor: number | null): number | null {
  if (valor === null) return null
  return valor > 1 ? valor / 100 : valor
}

/**
 * Junta "Próxima ação" e seu prazo num texto só — o schema (`obras_obra.prox_acao`)
 * não tem coluna própria para o prazo (mapeamento do dicionário: "Próxima ação
 * / Prazo → prox_acao").
 */
export function combinarAcaoEPrazo(acao: string | null, prazoIso: string | null): string | null {
  if (!acao) return null
  if (!prazoIso) return acao
  return `${acao} (prazo: ${br(prazoIso)})`
}

// ============================================================
// 4. Etapa — armadilha 3 (MAU USO) e o mapeamento STATUS → Etapa
// ============================================================

/**
 * STATUS MANFAC (Pipeline) → Etapa. Cobre os 7 valores reais do dump (187/187).
 *
 * `EXECUTAR` vira `levantamento`: é o default pré-campo mais conservador —
 * sozinho o Pipeline não distingue levantamento/andamento/paralisado (só a
 * Planejamento sabe, via "Etapa da obra", e ela sobrescreve nas 19 ativas).
 *
 * `EXECUTAR - APROVAR OS` (9 chamados) é DIFERENTE de `EXECUTADO - APROVAR OS`
 * (31 chamados) — não é erro de digitação irrelevante: os 3 chamados
 * 0826-004428/0826-004429/0726-010193 com esse status batem, pelo Nº OS, com
 * as obras da Planejamento cuja "Etapa da obra" é "Em andamento". Os outros 6
 * têm STATUS OBRA "NÃO INICIADO"/"EM ANDAMENTO" — nunca "FINALIZADO", o que
 * `EXECUTADO - APROVAR OS` sempre tem. Por isso mapeia para `andamento`, não
 * para `aprovarOS`. Decisão tomada aqui, sem confirmação do cliente — ver
 * relatório final da Frente D.
 */
const STATUS_MANFAC_PARA_ETAPA: Record<string, Etapa> = {
  EXECUTAR: 'levantamento',
  'EXECUTAR - APROVAR OS': 'andamento',
  'EXECUTADO - APROVAR OS': 'aprovarOS',
  'FECHAR OS': 'fecharOS',
  'PENDENTE FATURAMENTO': 'pendFat',
  FATURADO: 'faturado',
}

/**
 * Armadilha 3 — `MAU USO - APROVAR OS` (22 de 187) é etapa + causa fundidas.
 * Separa em `etapa: 'aprovarOS'` (mesma esteira normal) + `mauUso: true`
 * (classificação, nunca etapa — decisão J do cliente).
 */
export function etapaDeStatusManfac(statusManfac: string | null): { etapa: Etapa; mauUso: boolean } {
  const chave = statusManfac?.trim().toUpperCase() ?? ''
  if (chave === 'MAU USO - APROVAR OS') return { etapa: 'aprovarOS', mauUso: true }
  const encontrada = Object.entries(STATUS_MANFAC_PARA_ETAPA).find(([k]) => k.toUpperCase() === chave)
  return { etapa: encontrada ? encontrada[1] : 'definir', mauUso: false }
}

const ETAPA_DA_OBRA_PARA_ETAPA: Record<string, Etapa> = {
  PARALISADO: 'paralisado',
  'EM ANDAMENTO': 'andamento',
  'LEVANTAMENTO / PLANEJAMENTO': 'levantamento',
}

/** "Etapa da obra" (Planejamento) → Etapa. Cobre os 3 valores reais (19/19). */
export function etapaDePlanejamento(etapaObra: string | null): Etapa | null {
  const chave = etapaObra?.trim().toUpperCase() ?? ''
  const encontrada = Object.entries(ETAPA_DA_OBRA_PARA_ETAPA).find(([k]) => k === chave)
  return encontrada ? encontrada[1] : null
}

// ============================================================
// 5. Extração de linhas de uma planilha ExcelJS
// ============================================================

/** Uma interface mínima da worksheet do ExcelJS — evita acoplar este módulo
 * puro ao pacote inteiro; `app/obras/importar/_actions.ts` passa a worksheet
 * real, que satisfaz esta forma. */
export interface PlanilhaLinha {
  getCell(coluna: number): { value: unknown }
}
export interface PlanilhaAba {
  name: string
  getRow(numero: number): PlanilhaLinha
  eachRow(opcoes: { includeEmpty: boolean }, callback: (linha: PlanilhaLinha, numeroLinha: number) => void): void
}
export interface PlanilhaWorkbook {
  worksheets: PlanilhaAba[]
}

export function localizarAba(workbook: PlanilhaWorkbook, nomeExato: string): PlanilhaAba | null {
  return workbook.worksheets.find((ws) => ws.name.trim() === nomeExato) ?? null
}

export function localizarLinhaCabecalho(
  aba: PlanilhaAba,
  coluna: number,
  textoBusca: string,
  maxLinhas = 10
): number | null {
  for (let i = 1; i <= maxLinhas; i++) {
    if (paraTexto(aba.getRow(i).getCell(coluna).value as CelulaBruta) === textoBusca) return i
  }
  return null
}

export type LinhaBrutaObras = { numeroLinha: number; valores: CelulaBruta[] }

export function extrairLinhas(aba: PlanilhaAba, primeiraLinhaDados: number, ultimaColuna: number): LinhaBrutaObras[] {
  const linhas: LinhaBrutaObras[] = []
  aba.eachRow({ includeEmpty: false }, (linha, numeroLinha) => {
    if (numeroLinha < primeiraLinhaDados) return
    const valores: CelulaBruta[] = []
    for (let col = 1; col <= ultimaColuna; col++) valores[col - 1] = linha.getCell(col).value as CelulaBruta
    linhas.push({ numeroLinha, valores })
  })
  return linhas
}

// ============================================================
// 6. Mapeamento linha → campos da obra
// ============================================================

/** Campos que o import é capaz de preencher. Um subconjunto de `ObraRow`
 * (tipos.ts) — o resto (id, os_aprovada, liberado_*, marcos, criado_por, ...)
 * fica com o default da tabela; não vem da planilha. */
export type ObraCampos = {
  os: string | null
  loja: string | null
  descricao: string | null
  tipo: string | null
  valor: number | null
  origem: string | null
  analista_cliente: string | null
  pcm: string | null
  equipe: string | null
  etapa: Etapa | null
  bloqueio: Bloqueio | null
  mau_uso: boolean
  prioridade: Prioridade | null
  aprovacao: string | null
  inicio_plan: string | null
  duracao: number | null
  inicio_real: string | null
  fim_real: string | null
  pendencia: string | null
  pend_resp: string | null
  pend_prazo: string | null
  prox_acao: string | null
  atualizacao: string | null
}

/** Uma obra pronta para gravar: `etapa` nunca é `null` aqui (vira `'definir'`). */
export type ObraParaImportar = Omit<ObraCampos, 'etapa'> & { etapa: Etapa; linha: number }

export type LinhaDescartada = { origem: 'pipeline' | 'planejamento'; linha: number; motivo: string }

// Colunas da aba "Pipeline DPSP" (cabeçalho na linha 3, dados a partir da 4).
const COL_PIPELINE = {
  os: 0,
  loja: 1,
  descricao: 2,
  tipo: 3,
  valor: 4,
  analista: 5,
  statusManfac: 6,
  // statusObra: 7 e statusDesk: 8 não são migrados (não há coluna no schema).
  autorizacao: 9,
  // farol: 10 é derivado — nunca importado (recalculado sempre).
} as const

export function mapearLinhaPipeline(linha: LinhaBrutaObras): ObraCampos & { linha: number } {
  const v = linha.valores
  const { etapa, mauUso } = etapaDeStatusManfac(paraTexto(v[COL_PIPELINE.statusManfac]))
  return {
    os: normalizarOs(paraTexto(v[COL_PIPELINE.os])),
    loja: normalizarLoja(paraTexto(v[COL_PIPELINE.loja])),
    descricao: decodificarEntidadesHtml(paraTexto(v[COL_PIPELINE.descricao])),
    tipo: paraTexto(v[COL_PIPELINE.tipo]),
    valor: paraNumero(v[COL_PIPELINE.valor]),
    origem: null,
    analista_cliente: paraTexto(v[COL_PIPELINE.analista]),
    pcm: null,
    equipe: null,
    etapa,
    bloqueio: null,
    mau_uso: mauUso,
    prioridade: null,
    aprovacao: paraDataIso(v[COL_PIPELINE.autorizacao]),
    inicio_plan: null,
    duracao: null,
    inicio_real: null,
    fim_real: null,
    pendencia: null,
    pend_resp: null,
    pend_prazo: null,
    prox_acao: null,
    atualizacao: null,
    linha: linha.numeroLinha,
  }
}

// Colunas da aba "Planejamento DPSP" (cabeçalho na linha 4, dados 5–23; a 24 é molde vazio).
const COL_PLANEJAMENTO = {
  prioridade: 0,
  os: 1,
  loja: 2,
  descricao: 3,
  tipo: 4,
  valor: 5,
  analista: 6,
  pcm: 7,
  equipe: 8,
  origem: 9,
  // statusPipeline: 10 é constante ("Executar" em 100%) — não migrado.
  etapaObra: 11,
  bloqueio: 12,
  // avancoFisico: 13 — não importado na v0 (armadilha 2).
  inicioOriginal: 14,
  finalOriginal: 15,
  inicioAtual: 16,
  finalAtual: 17,
  inicioReal: 18,
  finalReal: 19,
  // 20, 21, 22 = Nº/Última remarcação, Último motivo — armadilha 1, NUNCA lidas.
  pendencia: 23,
  pendResp: 24,
  pendPrazo: 25,
  proxAcao: 26,
  prazoProxAcao: 27,
  ultimaAtualizacao: 28,
  // chaveAutomatica: 29 é artefato de VLOOKUP — não migrado.
} as const

/**
 * Mapeia uma linha da Planejamento. Retorna `null` quando não há Nº OS nem
 * Loja — inclui a linha 24, o molde vazio da aba (dictionary: "linha 24 é
 * molde vazio, descartar").
 *
 * Cronograma: "Início/Final planejado atual" (cache de fórmula) sobrescreve
 * "Início/Final original" quando é uma data válida — é o replanejamento mais
 * recente. Quando o cache cai no bug de 1899 (armadilha 5) ou está vazio,
 * cai de volta no valor original. Decisão tomada aqui — o dicionário mapeia
 * "Início/Final original" para `inicio_plan` e trata "planejado atual" como
 * não tendo destino próprio no schema (que só tem uma coluna `inicio_plan` e
 * `duracao`, sem "atual" separado); usar o cache como override é a leitura
 * mais fiel de "a Planejamento carrega o cronograma mais atualizado".
 */
export function mapearLinhaPlanejamento(linha: LinhaBrutaObras): (ObraCampos & { linha: number }) | null {
  const v = linha.valores
  const os = normalizarOs(paraTexto(v[COL_PLANEJAMENTO.os]))
  const loja = normalizarLoja(paraTexto(v[COL_PLANEJAMENTO.loja]))
  if (!os && !loja) return null

  const inicioOriginal = paraDataIso(v[COL_PLANEJAMENTO.inicioOriginal])
  const finalOriginal = paraDataIso(v[COL_PLANEJAMENTO.finalOriginal])
  const inicioAtual = paraDataIso(v[COL_PLANEJAMENTO.inicioAtual])
  const finalAtual = paraDataIso(v[COL_PLANEJAMENTO.finalAtual])
  const inicioPlan = inicioAtual ?? inicioOriginal
  const fimPlan = finalAtual ?? finalOriginal
  const duracao = inicioPlan && fimPlan ? diasDesde(inicioPlan, fimPlan) : null

  const proxAcao = combinarAcaoEPrazo(paraTexto(v[COL_PLANEJAMENTO.proxAcao]), paraDataIso(v[COL_PLANEJAMENTO.prazoProxAcao]))

  return {
    os,
    loja,
    descricao: decodificarEntidadesHtml(paraTexto(v[COL_PLANEJAMENTO.descricao])),
    tipo: paraTexto(v[COL_PLANEJAMENTO.tipo]),
    valor: paraNumero(v[COL_PLANEJAMENTO.valor]),
    origem: paraTexto(v[COL_PLANEJAMENTO.origem]),
    analista_cliente: paraTexto(v[COL_PLANEJAMENTO.analista]),
    pcm: paraTexto(v[COL_PLANEJAMENTO.pcm]),
    equipe: normalizarEquipe(paraTexto(v[COL_PLANEJAMENTO.equipe])),
    etapa: etapaDePlanejamento(paraTexto(v[COL_PLANEJAMENTO.etapaObra])),
    bloqueio: normalizarBloqueio(paraTexto(v[COL_PLANEJAMENTO.bloqueio])),
    mau_uso: false, // a origem da armadilha 3 é o STATUS MANFAC da Pipeline, não esta aba
    prioridade: normalizarPrioridade(paraTexto(v[COL_PLANEJAMENTO.prioridade])),
    aprovacao: null, // esta aba não tem AUTORIZAÇÃO — só a Pipeline
    inicio_plan: inicioPlan,
    duracao,
    inicio_real: paraDataIso(v[COL_PLANEJAMENTO.inicioReal]),
    fim_real: paraDataIso(v[COL_PLANEJAMENTO.finalReal]),
    pendencia: paraTexto(v[COL_PLANEJAMENTO.pendencia]),
    pend_resp: paraTexto(v[COL_PLANEJAMENTO.pendResp]),
    pend_prazo: paraDataIso(v[COL_PLANEJAMENTO.pendPrazo]),
    prox_acao: proxAcao,
    atualizacao: paraDataIso(v[COL_PLANEJAMENTO.ultimaAtualizacao]),
    linha: linha.numeroLinha,
  }
}

// ============================================================
// 7. Orquestração — casar as duas abas por Nº OS
// ============================================================

function escolher<T>(base: T | null, enriquecido: T | null): T | null {
  return enriquecido !== null && enriquecido !== undefined ? enriquecido : base
}

/** Planejamento enriquece o que já veio da Pipeline: prefere o valor dela,
 * cai para o da Pipeline quando ela não tiver o campo. */
function mesclar(
  base: ObraCampos & { linha: number },
  enr: ObraCampos & { linha: number }
): ObraCampos & { linha: number } {
  return {
    os: escolher(base.os, enr.os),
    loja: escolher(base.loja, enr.loja),
    descricao: escolher(base.descricao, enr.descricao),
    tipo: escolher(base.tipo, enr.tipo),
    valor: escolher(base.valor, enr.valor),
    origem: escolher(base.origem, enr.origem),
    analista_cliente: escolher(base.analista_cliente, enr.analista_cliente),
    pcm: escolher(base.pcm, enr.pcm),
    equipe: escolher(base.equipe, enr.equipe),
    etapa: escolher(base.etapa, enr.etapa),
    bloqueio: escolher(base.bloqueio, enr.bloqueio),
    mau_uso: base.mau_uso || enr.mau_uso,
    prioridade: escolher(base.prioridade, enr.prioridade),
    aprovacao: escolher(base.aprovacao, enr.aprovacao),
    inicio_plan: escolher(base.inicio_plan, enr.inicio_plan),
    duracao: escolher(base.duracao, enr.duracao),
    inicio_real: escolher(base.inicio_real, enr.inicio_real),
    fim_real: escolher(base.fim_real, enr.fim_real),
    pendencia: escolher(base.pendencia, enr.pendencia),
    pend_resp: escolher(base.pend_resp, enr.pend_resp),
    pend_prazo: escolher(base.pend_prazo, enr.pend_prazo),
    prox_acao: escolher(base.prox_acao, enr.prox_acao),
    atualizacao: escolher(base.atualizacao, enr.atualizacao),
    linha: enr.linha, // referência para o relatório: a linha que enriqueceu por último
  }
}

export type ResultadoImportacao = {
  linhasLidasPipeline: number
  linhasLidasPlanejamento: number
  obras: ObraParaImportar[]
  descartadas: LinhaDescartada[]
}

/**
 * Casa Pipeline (187) e Planejamento (19) por `os` e devolve a lista final de
 * obras + o relatório do que foi descartado. Idempotência por `os` (quando
 * existir) é responsabilidade de quem grava no banco (`_actions.ts`) — esta
 * função só decide QUAIS obras existem e com quais campos, não faz upsert.
 */
export function montarImportacao(linhasPipeline: LinhaBrutaObras[], linhasPlanejamento: LinhaBrutaObras[]): ResultadoImportacao {
  const descartadas: LinhaDescartada[] = []
  const porOs = new Map<string, ObraCampos & { linha: number }>()
  const semChave: (ObraCampos & { linha: number })[] = []

  for (const linhaBruta of linhasPipeline) {
    const obra = mapearLinhaPipeline(linhaBruta)
    if (!obra.os && !obra.loja) {
      descartadas.push({ origem: 'pipeline', linha: obra.linha, motivo: 'sem Nº OS e sem Loja' })
      continue
    }
    if (obra.os) porOs.set(obra.os, obra)
    else semChave.push(obra)
  }

  for (const linhaBruta of linhasPlanejamento) {
    const obra = mapearLinhaPlanejamento(linhaBruta)
    if (!obra) {
      descartadas.push({ origem: 'planejamento', linha: linhaBruta.numeroLinha, motivo: 'sem Nº OS e sem Loja' })
      continue
    }
    if (obra.os && porOs.has(obra.os)) {
      porOs.set(obra.os, mesclar(porOs.get(obra.os)!, obra))
    } else if (obra.os) {
      // OS que só existe na Planejamento — não deveria acontecer no dado real
      // (as 18 obras ativas com OS numérica batem com a Pipeline), mas o
      // código não assume isso: se acontecer, a obra nasce mesmo assim.
      porOs.set(obra.os, obra)
    } else {
      // Ex.: a obra GARANTIA — ativa, sem OS numérica, só existe aqui.
      semChave.push(obra)
    }
  }

  const obras: ObraParaImportar[] = [...porOs.values(), ...semChave].map((o) => ({
    ...o,
    etapa: o.etapa ?? 'definir',
  }))

  return {
    linhasLidasPipeline: linhasPipeline.length,
    linhasLidasPlanejamento: linhasPlanejamento.length,
    obras,
    descartadas,
  }
}
