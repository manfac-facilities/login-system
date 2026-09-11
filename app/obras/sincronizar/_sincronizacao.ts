/**
 * A DECISÃO da sincronização com o Field Control — funções puras.
 *
 * Aqui não há rede nem banco: entra o que o Field devolveu e o que o banco já
 * tem, sai um plano de "insere isto, atualiza aquilo, ignora aqueles". Quem
 * executa o plano é `_actions.ts`. Separar assim é o que permite testar a regra
 * de recarga sem subir Supabase nem chamar a API real.
 *
 * A REGRA DE RECARGA, que é decisão do João e não se reabre:
 * **o Field só preenche o que está vazio no banco.** Campo com valor fica como
 * está, mesmo que o Field traga outro. O motivo é operacional: a loja e a
 * descrição são justamente o que a equipe corrige na mão quando o cadastro do
 * Field vem pobre — deixar a varredura noturna reescrever isso seria apagar
 * trabalho humano em silêncio, que é o mesmo risco que `camposParaAtualizar`
 * resolveu na importação da planilha.
 *
 * POR QUE LER-E-DECIDIR EM VEZ DE `upsert`: o índice único de `os` é PARCIAL
 * (`... where os is not null`, `sdd-sql-obras-v0.sql:242`) e o `onConflict` do
 * supabase-js não funciona com índice parcial. Além disso, o upsert não saberia
 * a regra acima — ele sobrescreveria tudo.
 */

import { camposParaAtualizar } from '../_lib/importacao'
import type { OsNormalizada } from '../_lib/field'
import type { Etapa, FonteObra } from '../_lib/tipos'

/** O que precisamos saber de uma obra que já está no banco. */
export type ObraExistente = {
  id: string
  os: string | null
  loja: string | null
  descricao: string | null
  fonte: FonteObra | null
}

/** Obra nova, pronta para o insert. Só os campos que o Field conhece. */
export type ObraNovaDoField = {
  os: string
  loja: string | null
  descricao: string | null
  fonte: FonteObra
  etapa: Etapa
}

export type AtualizacaoDoField = {
  id: string
  os: string
  /** Só as colunas que estavam vazias no banco e que o Field sabe preencher. */
  campos: Record<string, unknown>
}

/** OS que veio do Field e não entrou. Toda uma tem motivo — nada some calado. */
export type OsIgnorada = {
  os: string | null
  idField: string
  motivo: string
}

export type PlanoDeSincronizacao = {
  totalDoField: number
  inserir: ObraNovaDoField[]
  atualizar: AtualizacaoDoField[]
  /** Já existiam e o Field não tinha nada de novo para elas. */
  inalteradas: number
  ignoradas: OsIgnorada[]
}

/**
 * A etapa de toda obra criada pela sincronização.
 *
 * `definir` é a fila da triagem: a obra aparece esperando que alguém diga de
 * quem ela é. O Field não tem essa informação, e chutar qualquer outra etapa
 * faria a obra nascer no meio da esteira sem ninguém responsável.
 */
const ETAPA_INICIAL: Etapa = 'definir'

/** A única porta de criação de obras ativa hoje é o Field Control. */
const FONTE_FIELD: FonteObra = 'field'

/** Texto só conta como preenchido se tiver conteúdo — `''` e `'  '` são vazio. */
function vazio(valor: unknown): boolean {
  if (valor === null || valor === undefined) return true
  if (typeof valor === 'string') return valor.trim() === ''
  return false
}

/** O número da OS, limpo, ou `null` quando não dá para usar como chave. */
function numeroDaOs(os: string | null | undefined): string | null {
  if (typeof os !== 'string') return null
  const limpo = os.trim()
  return limpo === '' ? null : limpo
}

/** Os números de OS que vale procurar no banco: sem repetição e sem vazios. */
export function numerosDeOsDoField(doField: OsNormalizada[]): string[] {
  const vistos = new Set<string>()
  for (const os of doField) {
    const numero = numeroDaOs(os.os)
    if (numero) vistos.add(numero)
  }
  return [...vistos]
}

/**
 * Quebra uma lista em lotes. O `in (...)` do Postgres aguenta muito, mas uma
 * varredura futura pode trazer milhares de OS e a URL do PostgREST tem limite —
 * lote é mais barato que descobrir esse limite em produção.
 */
export function emLotes<T>(lista: T[], tamanho: number): T[][] {
  const lotes: T[][] = []
  for (let i = 0; i < lista.length; i += tamanho) lotes.push(lista.slice(i, i + tamanho))
  return lotes
}

/**
 * Decide, OS por OS, o que fazer.
 *
 * `existentes` é o resultado do `select ... in (...)` — só as obras cujo número
 * apareceu na varredura. Obra do banco que o Field não mencionou não é tocada e
 * nem precisa ser lida.
 */
export function planejarSincronizacao(
  doField: OsNormalizada[],
  existentes: ObraExistente[],
): PlanoDeSincronizacao {
  const porOs = new Map<string, ObraExistente>()
  for (const obra of existentes) {
    const numero = numeroDaOs(obra.os)
    if (numero) porOs.set(numero, obra)
  }

  const inserir: ObraNovaDoField[] = []
  const atualizar: AtualizacaoDoField[] = []
  const ignoradas: OsIgnorada[] = []
  let inalteradas = 0

  /** Números já resolvidos NESTA passada — pega repetição dentro do próprio lote. */
  const jaTratados = new Set<string>()

  for (const vinda of doField) {
    const numero = numeroDaOs(vinda.os)

    // A OS sem número é ignorada de propósito. Inserir com `os` nulo criaria uma
    // obra que nenhuma varredura futura consegue reencontrar — e ainda ficaria
    // ao lado da GARANTIA, a obra legítima sem número, sem ninguém distinguir as
    // duas. O índice único de `os` é parcial e não barra esse caso.
    if (!numero) {
      ignoradas.push({
        os: vinda.os ?? null,
        idField: vinda.idField,
        motivo: 'OS sem número no Field Control — precisa de número para virar obra',
      })
      continue
    }

    if (jaTratados.has(numero)) {
      ignoradas.push({
        os: numero,
        idField: vinda.idField,
        motivo: `OS ${numero} veio repetida na mesma varredura — só a primeira foi considerada`,
      })
      continue
    }
    jaTratados.add(numero)

    // O que o Field sabe sobre esta OS, no vocabulário das colunas do banco.
    const doFieldEmColunas: Record<string, unknown> = {
      loja: vinda.loja,
      descricao: vinda.descricao,
      fonte: FONTE_FIELD,
    }

    const existente = porOs.get(numero)

    if (!existente) {
      inserir.push({
        os: numero,
        loja: vinda.loja,
        descricao: vinda.descricao,
        fonte: FONTE_FIELD,
        etapa: ETAPA_INICIAL,
      })
      continue
    }

    // DOIS FILTROS, nesta ordem, e os dois são necessários:
    //   1. `camposParaAtualizar` (reusada da importação da planilha) derruba o
    //      que o Field não sabe — null nunca apaga — e protege `etapa`/`mau_uso`,
    //      que são do app e nunca de fonte externa.
    //   2. o filtro daqui de baixo derruba o que o banco JÁ TEM. É este que
    //      implementa a regra do João: só preenche vazio.
    //
    // `fonte` segue deliberadamente o mesmo caminho. Uma obra antiga sem
    // procedência passa a receber `field` quando o Field a mencionar: nesse
    // instante temos evidência da origem. Uma fonte já preenchida nunca é
    // sobrescrita, preservando a regra de recarga e preparando o D2 para agir
    // somente sobre obras cuja procedência é conhecida.
    const candidatos = camposParaAtualizar(doFieldEmColunas)
    const campos: Record<string, unknown> = {}
    for (const [coluna, valor] of Object.entries(candidatos)) {
      if (vazio(existente[coluna as keyof ObraExistente])) campos[coluna] = valor
    }

    if (Object.keys(campos).length === 0) {
      inalteradas++
      continue
    }

    atualizar.push({ id: existente.id, os: numero, campos })
  }

  return { totalDoField: doField.length, inserir, atualizar, inalteradas, ignoradas }
}
