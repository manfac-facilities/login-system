/**
 * Controle de Obras — os campos da ficha editável: parse, formatação e
 * validação. J4, seção B do mockup-j4-v02.html.
 * Ver docs/cliente/2026-08-31-sistema-controle-de-obras/spec-ficha-editavel-2026-09-18.md §5.4
 *
 * ESTE ARQUIVO É PURO, e isso não é estilo: é o que permite a MESMA função
 * validar na tela e na Server Action. Sem React, sem Supabase, sem
 * `process.env`, sem `new Date()` implícito — `hoje` entra por parâmetro, como
 * em tipos.ts. Se as duas pontas validassem por conta própria, elas divergiriam
 * na primeira correção de regra, e a tela é a que NÃO é fronteira de
 * autorização (§4 da spec).
 *
 * As mensagens de erro são as da spec, ao pé da letra. Elas aparecem na tela e
 * voltam no `{ error }` da action — reescrever uma aqui muda o produto.
 *
 * CONVENÇÃO DE RETORNO DAS VALIDAÇÕES: `Record<campo, mensagem>` vazio quando
 * está tudo certo. Vazio = pode gravar. A tela usa as chaves para pintar a
 * caixa e mandar o foco; a action usa a primeira mensagem como `{ error }`.
 */

import { ORIGENS, PRIORIDADES, TIPOS_OBRA, BLOQUEIOS, SEM_BLOQUEIO, hojeISO } from './tipos'

/** Erros por campo do rascunho. Ausente = campo sem problema. */
export type Erros<T> = Partial<Record<keyof T, string>>

/** `AAAA-MM-DD`, o formato que `<input type="date">` entrega e o banco espera. */
const ISO = /^\d{4}-\d{2}-\d{2}$/

const MSG_DATA = 'Data inválida.'

/**
 * Ano plausível para qualquer data da ficha — nem século de dedo escorregado
 * (item 4 da revisão de 20/09: '0226' em vez de '2026' passava batido, e
 * deixava a obra "vermelha para sempre" porque a contagem de dias em aberto
 * explode), nem futuro longe demais.
 */
const ANO_MIN = 2000
const ANO_MAX = 2100

/**
 * `v` já bateu no formato ISO (`erroData` confere antes de chamar) — aqui é
 * só ano plausível e data de CALENDÁRIO real. `new Date` não estoura em `31
 * de fevereiro`, ela rola para março (2026-02-31 vira 2026-03-03): comparar os
 * três campos de volta é o jeito de pegar isso sem `new Date` mentir por nós.
 */
function dataDeCalendarioValida(v: string): boolean {
  const [ano, mes, dia] = v.split('-').map(Number)
  if (ano < ANO_MIN || ano > ANO_MAX) return false
  const d = new Date(Date.UTC(ano, mes - 1, dia))
  return d.getUTCFullYear() === ano && d.getUTCMonth() === mes - 1 && d.getUTCDate() === dia
}

// ============================================================
// 1. Valor em reais — o parser que aguenta o que o usuário digita
// ============================================================

/**
 * Texto em pt-BR → número. TRÊS RETORNOS DISTINTOS, de propósito (§5.4):
 *
 *   `null`      — campo vazio. O usuário não disse nada; a action grava `null`
 *                 (R5: string vazia nunca é gravada).
 *   `undefined` — inválido. O usuário digitou algo que não é valor; a tela
 *                 acusa e NADA vai ao servidor.
 *   `number`    — o valor, finito e ≥ 0.
 *
 * Vazio e inválido não são a mesma coisa: confundi-los apagaria o valor de uma
 * obra por causa de um erro de digitação.
 *
 * O que entra, e o que sai:
 *   '18.450,00'    → 18450        '1.234,56'  → 1234.56
 *   'R$ 1.234,56'  → 1234.56      '1234,5'    → 1234.5
 *   '1234'         → 1234         '0,50'      → 0.5
 *   ''  '   '  'R$'  null  undefined          → null
 *   'abc'  '-1'  '12,34,56'  '12 34'  '1e3'   → undefined
 *
 * O PONTO É AMBÍGUO e a decisão está aqui: em pt-BR ele é separador de milhar
 * ('18.450' = dezoito mil), mas quem tem o dedo viciado em teclado numérico
 * digita '1234.56' querendo mil duzentos e trinta e quatro reais e cinquenta e
 * seis centavos. Sem vírgula no texto, o ponto só vale como milhar quando o
 * agrupamento é VÁLIDO (1 a 3 dígitos, depois grupos de exatamente 3);
 * qualquer outro arranjo é lido como decimal. Assim '18.450' → 18450 e
 * '1234.56' → 1234.56, que é o que cada um dos dois quis dizer. Errar isso é
 * errar por 100x num campo de dinheiro.
 */
export function numeroBR(texto: string | null | undefined): number | null | undefined {
  if (texto === null || texto === undefined) return null

  // Fora o dinheiro e o espaço (inclusive o NBSP que o toLocaleString produz).
  const limpo = String(texto)
    .replace(/ /g, ' ')
    .replace(/R\$/gi, '')
    .trim()
  if (limpo === '') return null

  // Daqui em diante só dígito, ponto e vírgula. Sinal, letra, espaço interno e
  // notação científica são recusados — inclusive '-1', porque valor é ≥ 0.
  if (!/^[\d.,]+$/.test(limpo)) return undefined
  if (!/\d/.test(limpo)) return undefined

  const virgulas = (limpo.match(/,/g) ?? []).length
  if (virgulas > 1) return undefined

  let normalizado: string
  if (virgulas === 1) {
    // Com vírgula não há dúvida: ela é o decimal e todo ponto é milhar.
    normalizado = limpo.replace(/\./g, '').replace(',', '.')
  } else if (limpo.includes('.')) {
    const milharValido = /^\d{1,3}(\.\d{3})+$/.test(limpo)
    normalizado = milharValido ? limpo.replace(/\./g, '') : limpo
  } else {
    normalizado = limpo
  }

  // Sobrou mais de um ponto depois de decidir? Então não era nem milhar nem
  // decimal — é lixo ('1.2.3').
  if ((normalizado.match(/\./g) ?? []).length > 1) return undefined

  const n = Number(normalizado)
  if (!Number.isFinite(n) || n < 0) return undefined
  return n
}

/**
 * Número → texto do input de edição: `18450` → `'18.450,00'`. Sem o `R$`,
 * porque o prefixo fica fora da caixa (quem edita digita só o número).
 * Vazio, nulo ou não finito viram `''` — input nasce em branco, nunca com
 * "null" escrito dentro. `moeda()` de tipos.ts continua sendo o da LEITURA.
 */
export function moedaParaTexto(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return ''
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

// ============================================================
// 2. Motivo de remarcação
// ============================================================

/**
 * A lista de referência dos motivos, derivada de `BLOQUEIOS` — o vocabulário
 * que o Diário já usa para responder por que a obra não andou no dia —
 * trocando `Sem bloqueio` por `Outro` (decisão do João, 18/09; seção G do
 * mockup v02 e D2 da spec).
 *
 * "Sem bloqueio" não é motivo de remarcação, é a ausência de um. "Outro" entra,
 * e é o único que pede descrição.
 *
 * DERIVADA, NÃO COPIADA: duas grafias para a mesma coisa ("Cliente / loja" e
 * "Cliente/loja") quebrariam o cruzamento entre o bloqueio do dia e o motivo da
 * remarcação, que é justamente por que as duas listas são a mesma.
 *
 * A FONTE DE VERDADE EM PRODUÇÃO É A TABELA `obras_motivo_remarcacao`, porque o
 * cliente pode cadastrar motivo novo sem deploy. Esta constante é o seed da
 * migration e a lista de referência de quem normaliza motivo aqui.
 */
export const MOTIVO_OUTRO = 'Outro'

export const MOTIVOS_REMARCACAO: readonly string[] = [
  ...BLOQUEIOS.filter((b) => b !== SEM_BLOQUEIO),
  MOTIVO_OUTRO,
]

/**
 * Forma de comparação de um motivo: sem espaço sobrando, sem espaço duplo, sem
 * acento, minúsculo. SÓ PARA COMPARAR — nunca para gravar. O que se grava é o
 * nome como o usuário o vê, senão a remarcação antiga passa a dizer
 * "contratacao de prestador".
 *
 * É a pré-checagem do lado do app do índice único `chave` da tabela: lá a
 * normalização é `lower(btrim(nome))`, sem tirar acento, porque tirar exigiria
 * a extensão `unaccent` em produção (§3.3). Aqui tiramos — daí "Contratação" e
 * "contratacao" serem o mesmo motivo para quem cadastra (R15).
 */
export function normalizarMotivo(s: string | null | undefined): string {
  if (s === null || s === undefined) return ''
  return String(s)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

/** O único motivo que exige descrição. */
export function ehMotivoOutro(motivo: string | null | undefined): boolean {
  return normalizarMotivo(motivo) === normalizarMotivo(MOTIVO_OUTRO)
}

/**
 * Mudar o início É remarcação quando JÁ HAVIA um início (R9). Preencher um
 * início que estava vazio não é — não há nada para remarcar, e pedir motivo ali
 * seria cobrar explicação de quem está só completando o cadastro.
 *
 * APAGAR um início que existia também é remarcação: a data combinada deixou de
 * valer, e é exatamente isso que a remarcação registra.
 */
export function precisaRemarcar(
  inicioAtual: string | null | undefined,
  inicioNovo: string | null | undefined
): boolean {
  const antes = (inicioAtual ?? '').trim()
  const depois = (inicioNovo ?? '').trim()
  if (!antes) return false
  return antes !== depois
}

// ============================================================
// 3. Os três rascunhos e suas validações
//
// Os tipos moram aqui, e não em _actions.ts, porque a tela e a action precisam
// dos DOIS lados do mesmo contrato. A action os reexporta.
// ============================================================

export type DadosAutorizacao = {
  /** '' = não definido. Nunca gravar '' — a action traduz para `null` (R5). */
  origem: string
  libPor: string
  /** `AAAA-MM-DD`. */
  libEm: string
  /** `AAAA-MM-DD`; '' = OS ainda não aprovada. */
  aprovadaEm: string
}

export type ContextoAutorizacao = {
  /** `AAAA-MM-DD`. Explícito para o teste não depender do relógio da máquina. */
  hoje?: string
  /** O que já está gravado na obra. Valor fora de `ORIGENS` é preservado. */
  origemAtual?: string | null
}

/** `dt` é vazio, uma ISO válida, ou erro. */
function erroData(valor: string, hoje: string, mensagemFuturo: string): string | undefined {
  const v = valor.trim()
  if (!v) return undefined
  if (!ISO.test(v) || !dataDeCalendarioValida(v)) return MSG_DATA
  if (v > hoje) return mensagemFuturo
  return undefined
}

/**
 * Bloco **Autorização** da ficha (e a parte de autorização da Triagem).
 *
 * R8: `liberado_em` só existe junto de `liberado_por`. Nome sem data NÃO é
 * erro — a action grava hoje, como `liberarObraAction` já faz. Data sem nome é
 * erro, porque data de liberação sem quem liberou não significa nada, e é assim
 * que `ancoraDias` já a trata (`tipos.ts:481`).
 */
export function validarAutorizacao(
  d: DadosAutorizacao,
  ctx: ContextoAutorizacao = {}
): Erros<DadosAutorizacao> {
  const hoje = ctx.hoje ?? hojeISO()
  const e: Erros<DadosAutorizacao> = {}

  const origem = d.origem.trim()
  const atual = (ctx.origemAtual ?? '').trim()
  if (origem && !(ORIGENS as readonly string[]).includes(origem) && origem !== atual) {
    e.origem = 'Origem inválida'
  }

  const libEm = d.libEm.trim()
  const erroLib = erroData(libEm, hoje, 'A data da liberação não pode ser depois de hoje.')
  if (erroLib) {
    e.libEm = erroLib
  } else if (libEm && !d.libPor.trim()) {
    e.libEm = 'Tem data da liberação sem nome. Escolha quem liberou ou apague a data.'
  }

  const erroAprov = erroData(
    d.aprovadaEm.trim(),
    hoje,
    'A data de aprovação não pode ser depois de hoje.'
  )
  if (erroAprov) e.aprovadaEm = erroAprov

  return e
}

export type DadosIdentificacao = {
  tipo: string
  /** Texto pt-BR: '18.450,00'. Convertido por `numeroBR` na hora de gravar. */
  valor: string
  analista: string
  mauUso: boolean
}

export type ContextoIdentificacao = {
  /** O que já está gravado. Tipo antigo fora de `TIPOS_OBRA` é preservado. */
  tipoAtual?: string | null
}

/**
 * Bloco **Identificação**. Nº OS, loja e chamado NÃO entram aqui: são do Field
 * e não são editáveis (R19) — se a ficha deixasse digitar uma loja, a recarga
 * de 5 minutos nunca mais a corrigiria.
 */
export function validarIdentificacao(
  d: DadosIdentificacao,
  ctx: ContextoIdentificacao = {}
): Erros<DadosIdentificacao> {
  const e: Erros<DadosIdentificacao> = {}

  const tipo = d.tipo.trim()
  const atual = (ctx.tipoAtual ?? '').trim()
  if (tipo && !(TIPOS_OBRA as readonly string[]).includes(tipo) && tipo !== atual) {
    e.tipo = 'Tipo inválido'
  }

  if (numeroBR(d.valor) === undefined) {
    e.valor = 'Valor precisa ser um número em reais, como 18.450,00.'
  }

  return e
}

export type DadosCronograma = {
  resp: string
  equipe: string
  prioridade: string
  /** `AAAA-MM-DD`. */
  inicio: string
  duracao: string
  /** Obrigatório quando o início MUDA e já havia início (R9). */
  motivo?: string
  /** Obrigatório quando `motivo` é "Outro" (R10). */
  detalhe?: string
}

export type ContextoCronograma = {
  /** O `inicio_plan` gravado hoje na obra. É ele que define se há remarcação. */
  inicioAtual?: string | null
}

export const DURACAO_MIN = 1
export const DURACAO_MAX = 180

/**
 * Bloco **Cronograma**. Mudar duração, responsável, equipe ou prioridade não
 * abre janela nenhuma e não pede motivo (R12) — só o início é remarcação.
 *
 * O motivo NÃO é conferido contra a lista aqui: a lista vive na tabela
 * `obras_motivo_remarcacao`, que este arquivo não pode ler sem deixar de ser
 * puro. Quem confere é a action (§4.3) e, por último, a RPC.
 */
export function validarCronograma(
  d: DadosCronograma,
  ctx: ContextoCronograma = {}
): Erros<DadosCronograma> {
  const e: Erros<DadosCronograma> = {}

  const inicio = d.inicio.trim()
  // Mesma checagem do item 4 (ano plausível + data de calendário real): o
  // início planejado é `date` no banco que nem `liberado_em`/`aprovadaEm`.
  if (inicio && (!ISO.test(inicio) || !dataDeCalendarioValida(inicio))) e.inicio = MSG_DATA

  const duracao = d.duracao.trim()
  if (duracao) {
    const n = /^\d+$/.test(duracao) ? Number(duracao) : Number.NaN
    if (!Number.isFinite(n) || n < DURACAO_MIN || n > DURACAO_MAX) {
      e.duracao = `A duração precisa ficar entre ${DURACAO_MIN} e ${DURACAO_MAX} dias`
    }
  }

  const prioridade = d.prioridade.trim()
  if (prioridade && !(PRIORIDADES as readonly string[]).includes(prioridade)) {
    e.prioridade = 'Prioridade inválida'
  }

  const motivo = (d.motivo ?? '').trim()
  if (!e.inicio && precisaRemarcar(ctx.inicioAtual, inicio) && !motivo) {
    e.motivo = 'Escolha um motivo para remarcar.'
  }

  // Descrição só existe com "Outro", e com "Outro" ela é obrigatória. Três
  // caracteres ÚTEIS, e espaço NÃO é útil: a mensagem pede três letras, então
  // '  a b  ' não passa — senão a trava viraria enfeite.
  if (motivo && ehMotivoOutro(motivo)) {
    const detalhe = (d.detalhe ?? '').replace(/\s/g, '')
    if (detalhe.length < 3) e.detalhe = 'Descreva o outro motivo (pelo menos 3 letras).'
  }

  return e
}

/** A primeira mensagem de um mapa de erros — o `{ error }` que a action devolve. */
export function primeiroErro<T>(erros: Erros<T>): string | null {
  const chaves = Object.keys(erros) as (keyof T)[]
  for (const k of chaves) {
    const m = erros[k]
    if (m) return m
  }
  return null
}
