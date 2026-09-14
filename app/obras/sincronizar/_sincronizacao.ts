/**
 * Decisão pura da sincronização: identidade, recarga e ausência no Field.
 * Rede e banco ficam em `_actions.ts`; aqui entram dois retratos completos e
 * sai um plano testável, sem efeito colateral.
 */

import { camposParaAtualizar } from '../_lib/importacao'
import type { OsNormalizada } from '../_lib/field'
import type { Etapa, FonteObra } from '../_lib/tipos'

export type ObraExistente = {
  id: string
  os: string | null
  loja: string | null
  descricao: string | null
  fonte: FonteObra | null
  field_id: string | null
  field_ausente_desde: string | null
  field_ausente_em: string | null
}

export type ObraNovaDoField = {
  os: string
  loja: string | null
  descricao: string | null
  fonte: FonteObra
  field_id: string
  etapa: Etapa
}

export type AtualizacaoDoField = {
  id: string
  os: string
  campos: Record<string, unknown>
  removeAlerta?: boolean
}

export type AtualizacaoDeAusencia = {
  id: string
  os: string | null
  idField: string
  acao: 'suspeita' | 'alerta'
  campos: Record<string, unknown>
}

export type NumeroDeOsAlterado = {
  obraId: string
  idField: string
  anterior: string
  atual: string
}

export type OsIgnorada = {
  os: string | null
  idField: string
  motivo: string
}

export type OpcoesDeSincronizacao = {
  /** Só uma leitura integral e bem-sucedida tem o direito de inferir ausência. */
  varreduraCompleta?: boolean
  agora?: string
}

export type PlanoDeSincronizacao = {
  totalDoField: number
  inserir: ObraNovaDoField[]
  atualizar: AtualizacaoDoField[]
  reconciliarAusencias: AtualizacaoDeAusencia[]
  numerosDeOsAlterados: NumeroDeOsAlterado[]
  alertasRemovidos: number
  inalteradas: number
  ignoradas: OsIgnorada[]
  avisos: string[]
}

const ETAPA_INICIAL: Etapa = 'definir'
const FONTE_FIELD: FonteObra = 'field'
const LIMITE_DE_AUSENCIA_EM_MASSA = 0.2
export const INTERVALO_MINIMO_PARA_ALERTA_MS = 24 * 60 * 60 * 1000

function texto(valor: string | null | undefined): string | null {
  if (typeof valor !== 'string') return null
  const limpo = valor.trim()
  return limpo === '' ? null : limpo
}

function vazio(valor: unknown): boolean {
  if (valor === null || valor === undefined) return true
  return typeof valor === 'string' ? valor.trim() === '' : false
}

/** Mantido para a leitura incremental da D3 e para inserts em lote. */
export function numerosDeOsDoField(doField: OsNormalizada[]): string[] {
  const vistos = new Set<string>()
  for (const os of doField) {
    const numero = texto(os.os)
    if (numero) vistos.add(numero)
  }
  return [...vistos]
}

export function emLotes<T>(lista: T[], tamanho: number): T[][] {
  const lotes: T[][] = []
  for (let i = 0; i < lista.length; i += tamanho) lotes.push(lista.slice(i, i + tamanho))
  return lotes
}

/**
 * Reconcilia pelo identificador imutável do Field. O número da OS é apenas um
 * atributo editável; ele só serve de fallback para vincular linhas anteriores
 * à migration de `field_id`.
 *
 * Ausência fica desligada por padrão. Assim, uma futura chamada incremental
 * precisa optar explicitamente pela leitura completa para poder marcá-la.
 */
export function planejarSincronizacao(
  doField: OsNormalizada[],
  existentes: ObraExistente[],
  opcoes: OpcoesDeSincronizacao = {},
): PlanoDeSincronizacao {
  const agora = opcoes.agora ?? new Date().toISOString()
  const porFieldId = new Map<string, ObraExistente>()
  const porOs = new Map<string, ObraExistente>()
  for (const obra of existentes) {
    const idField = texto(obra.field_id)
    const numero = texto(obra.os)
    if (idField) porFieldId.set(idField, obra)
    if (numero) porOs.set(numero, obra)
  }

  const inserir: ObraNovaDoField[] = []
  const atualizar: AtualizacaoDoField[] = []
  const reconciliarAusencias: AtualizacaoDeAusencia[] = []
  const numerosDeOsAlterados: NumeroDeOsAlterado[] = []
  const ignoradas: OsIgnorada[] = []
  const avisos: string[] = []
  const idsEncontrados = new Set<string>()
  const idsFieldTratados = new Set<string>()
  const numerosTratados = new Set<string>()
  let alertasRemovidos = 0
  let inalteradas = 0

  for (const vinda of doField) {
    const numero = texto(vinda.os)
    const idField = texto(vinda.idField)

    if (!idField) {
      const peloNumero = numero ? porOs.get(numero) : undefined
      if (peloNumero?.fonte === FONTE_FIELD) idsEncontrados.add(peloNumero.id)
      ignoradas.push({
        os: numero,
        idField: vinda.idField,
        motivo: 'OS sem identificador no Field Control — não é possível reconciliar com segurança',
      })
      continue
    }
    const obraPeloId = porFieldId.get(idField)
    if (obraPeloId) idsEncontrados.add(obraPeloId.id)
    if (!numero) {
      ignoradas.push({
        os: vinda.os ?? null,
        idField,
        motivo: 'OS sem número no Field Control — precisa de número para virar obra',
      })
      continue
    }
    if (idsFieldTratados.has(idField) || numerosTratados.has(numero)) {
      ignoradas.push({
        os: numero,
        idField,
        motivo: `OS ${numero} veio repetida na mesma varredura — só a primeira foi considerada`,
      })
      continue
    }
    idsFieldTratados.add(idField)
    numerosTratados.add(numero)

    const peloId = obraPeloId
    const peloNumero = porOs.get(numero)
    if (peloId && peloNumero && peloId.id !== peloNumero.id) {
      ignoradas.push({
        os: numero,
        idField,
        motivo: 'conflito de identidade: o id do Field e o número da OS apontam para obras diferentes',
      })
      continue
    }
    if (!peloId && peloNumero && texto(peloNumero.field_id) !== null) {
      ignoradas.push({
        os: numero,
        idField,
        motivo: `conflito de identidade: a OS ${numero} já pertence a outro id do Field`,
      })
      continue
    }

    const existente = peloId ?? peloNumero
    if (!existente) {
      inserir.push({
        os: numero,
        loja: vinda.loja,
        descricao: vinda.descricao,
        fonte: FONTE_FIELD,
        field_id: idField,
        etapa: ETAPA_INICIAL,
      })
      continue
    }

    idsEncontrados.add(existente.id)
    const candidatos = camposParaAtualizar({
      loja: vinda.loja,
      descricao: vinda.descricao,
      fonte: FONTE_FIELD,
      field_id: idField,
    })
    const campos: Record<string, unknown> = {}
    for (const [coluna, valor] of Object.entries(candidatos)) {
      if (vazio(existente[coluna as keyof ObraExistente])) campos[coluna] = valor
    }

    const numeroAnterior = texto(existente.os)
    if (peloId && numeroAnterior !== numero) {
      campos.os = numero
      numerosDeOsAlterados.push({
        obraId: existente.id,
        idField,
        anterior: numeroAnterior ?? '—',
        atual: numero,
      })
    }

    // Reaparecer é evidência positiva até em varredura incremental. Limpa a
    // suspeita e o alerta, sem depender da inferência negativa de ausência.
    const suspeitaExistente = texto(existente.field_ausente_desde)
    const alertaExistente = texto(existente.field_ausente_em)
    if (suspeitaExistente || alertaExistente) {
      campos.field_ausente_desde = null
      campos.field_ausente_em = null
      if (alertaExistente) alertasRemovidos++
    }

    if (Object.keys(campos).length === 0) inalteradas++
    else {
      const atualizacao: AtualizacaoDoField = { id: existente.id, os: numero, campos }
      if (alertaExistente) atualizacao.removeAlerta = true
      atualizar.push(atualizacao)
    }
  }

  if (opcoes.varreduraCompleta) {
    const obrasDoField = existentes.filter(
      (obra) => obra.fonte === FONTE_FIELD && texto(obra.field_id) !== null,
    )
    const ausentes = obrasDoField.filter((obra) => !idsEncontrados.has(obra.id))
    const proporcaoAusente = obrasDoField.length ? ausentes.length / obrasDoField.length : 0

    if (doField.length === 0) {
      avisos.push(
        'Varredura suspeita: o Field devolveu 0 OS. Nenhuma ausência foi registrada.',
      )
    } else if (proporcaoAusente > LIMITE_DE_AUSENCIA_EM_MASSA) {
      avisos.push(
        `Varredura suspeita: ${ausentes.length} de ${obrasDoField.length} obras do Field ficariam ausentes (mais de 20%). Nenhuma ausência foi registrada.`,
      )
    } else {
      for (const obra of ausentes) {
        const idField = texto(obra.field_id) as string
        if (texto(obra.field_ausente_em)) continue

        const suspeitaExistente = texto(obra.field_ausente_desde)
        if (!suspeitaExistente) {
          reconciliarAusencias.push({
            id: obra.id,
            os: obra.os,
            idField,
            acao: 'suspeita',
            campos: { field_ausente_desde: agora },
          })
          continue
        }

        const suspeitaEm = Date.parse(suspeitaExistente)
        const instanteAtual = Date.parse(agora)
        if (
          Number.isFinite(suspeitaEm) &&
          Number.isFinite(instanteAtual) &&
          instanteAtual - suspeitaEm >= INTERVALO_MINIMO_PARA_ALERTA_MS
        ) {
          reconciliarAusencias.push({
            id: obra.id,
            os: obra.os,
            idField,
            acao: 'alerta',
            campos: { field_ausente_em: agora },
          })
        }
      }
    }
  }

  return {
    totalDoField: doField.length,
    inserir,
    atualizar,
    reconciliarAusencias,
    numerosDeOsAlterados,
    alertasRemovidos,
    inalteradas,
    ignoradas,
    avisos,
  }
}
