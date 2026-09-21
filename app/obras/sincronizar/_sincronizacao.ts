/**
 * Decisão pura da sincronização: identidade, recarga e ausência no Field.
 * Rede e banco ficam em `_actions.ts`; aqui entram dois retratos completos e
 * sai um plano testável, sem efeito colateral.
 */

import { camposParaAtualizar } from '../_lib/importacao'
import type { OsNormalizada, SituacaoDaOrdemField } from '../_lib/field'
import type { Etapa, FonteObra } from '../_lib/tipos'
import { entraNaCarga, motivoDaRecusa } from "./_criterio-de-entrada"

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
  historicoHerdado?: HistoricoHerdado
}

export type HistoricoHerdado = {
  obraId: string
  os: string
  idFieldAnterior: string
  idFieldAtual: string
}

export type ConsultaDeReabertura = Omit<HistoricoHerdado, 'obraId'>

export type VerificacaoDeReabertura = ConsultaDeReabertura & {
  situacao: SituacaoDaOrdemField
  motivo?: string
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
  verificacoesDeReabertura?: VerificacaoDeReabertura[]
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
const PISO_DE_AUSENCIAS_EM_MASSA = 3
export const INTERVALO_MINIMO_PARA_ALERTA_MS = 20 * 60 * 60 * 1000

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

/** Conflitos que precisam consultar a ordem antiga antes de qualquer escrita. */
export function encontrarConsultasDeReabertura(
  doField: OsNormalizada[],
  existentes: ObraExistente[],
): ConsultaDeReabertura[] {
  const porFieldId = new Map(
    existentes.flatMap((obra) => {
      const idField = texto(obra.field_id)
      return idField ? [[idField, obra] as const] : []
    }),
  )
  const porOs = new Map(
    existentes.flatMap((obra) => {
      const numero = texto(obra.os)
      return numero ? [[numero, obra] as const] : []
    }),
  )
  const consultas = new Map<string, ConsultaDeReabertura>()
  const idsPresentesNaVarredura = new Set(
    doField.map((ordem) => texto(ordem.idField)).filter((id): id is string => id !== null),
  )

  for (const vinda of doField) {
    const os = texto(vinda.os)
    const idFieldAtual = texto(vinda.idField)
    if (!os || !idFieldAtual || porFieldId.has(idFieldAtual)) continue
    const ocupante = porOs.get(os)
    const idFieldAnterior = texto(ocupante?.field_id)
    if (
      !ocupante ||
      !idFieldAnterior ||
      idFieldAnterior === idFieldAtual ||
      idsPresentesNaVarredura.has(idFieldAnterior)
    ) continue
    const consulta = { os, idFieldAnterior, idFieldAtual }
    consultas.set(`${idFieldAnterior}\u0000${idFieldAtual}`, consulta)
  }

  return [...consultas.values()]
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
  const vindasPorFieldId = new Map<string, OsNormalizada>()
  for (const obra of existentes) {
    const idField = texto(obra.field_id)
    const numero = texto(obra.os)
    if (idField) porFieldId.set(idField, obra)
    if (numero) porOs.set(numero, obra)
  }
  for (const vinda of doField) {
    const idField = texto(vinda.idField)
    if (idField) vindasPorFieldId.set(idField, vinda)
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
    // Não sabemos ainda se o filtro service_id inclui arquivadas. Se incluir,
    // archived:true é sinal direto de inatividade e nunca pode contar como
    // presença ativa, limpar alerta ou alterar a obra pelo número antigo.
    if (vinda.archived === true) continue
    const obraPeloId = porFieldId.get(idField)
    if (obraPeloId) idsEncontrados.add(obraPeloId.id)

    // CRITERIO DE ENTRADA (feedback 20, 15/09/2026): so entra OS cuja ULTIMA
    // atividade esteja pendente, agendada ou em andamento. A recusa acontece
    // DEPOIS de marcar a OS como encontrada, de proposito: a OS recusada esta
    // presente no Field, entao nao pode virar suspeita de ausencia. E acontece
    // ANTES de recarregar campos, mas a presença confirmada precisa limpar
    // uma ausência anterior mesmo quando a situação já não entra na carga.
    if (!entraNaCarga(vinda.situacao)) {
      if (obraPeloId && (texto(obraPeloId.field_ausente_desde) || texto(obraPeloId.field_ausente_em))) {
        const removeAlerta = texto(obraPeloId.field_ausente_em) !== null
        atualizar.push({
          id: obraPeloId.id,
          os: texto(obraPeloId.os) ?? numero ?? '—',
          campos: { field_ausente_desde: null, field_ausente_em: null },
          ...(removeAlerta ? { removeAlerta: true } : {}),
        })
        if (removeAlerta) alertasRemovidos++
      }
      ignoradas.push({ os: numero, idField, motivo: motivoDaRecusa(vinda.situacao) })
      continue
    }
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
    const idFieldAnterior = texto(peloNumero?.field_id)
    let historicoHerdado: HistoricoHerdado | undefined
    if (!peloId && peloNumero && idFieldAnterior !== null) {
      const antigaNaVarredura = vindasPorFieldId.get(idFieldAnterior)
      if (antigaNaVarredura) {
        ignoradas.push({
          os: numero,
          idField,
          motivo: `conflito de identidade: a OS antiga ${idFieldAnterior} veio na mesma varredura do Field`,
        })
        continue
      }
      const verificacao = opcoes.verificacoesDeReabertura?.find(
        (item) =>
          item.os === numero &&
          item.idFieldAnterior === idFieldAnterior &&
          item.idFieldAtual === idField,
      )
      if (verificacao?.situacao === 'arquivada') {
        historicoHerdado = {
          obraId: peloNumero.id,
          os: numero,
          idFieldAnterior,
          idFieldAtual: idField,
        }
      } else {
        const motivoDaConsulta = texto(verificacao?.motivo)
        const motivo = motivoDaConsulta
          ? motivoDaConsulta
          : verificacao?.situacao === 'ativa'
            ? `conflito de identidade: a OS antiga ${idFieldAnterior} ainda está ativa no Field`
            : `conflito de identidade: não foi possível confirmar se a OS antiga ${idFieldAnterior} está arquivada`
        ignoradas.push({ os: numero, idField, motivo })
        continue
      }
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
    if (historicoHerdado) campos.field_id = idField

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
      if (historicoHerdado) atualizacao.historicoHerdado = historicoHerdado
      atualizar.push(atualizacao)
    }
  }

  if (opcoes.varreduraCompleta) {
    const obrasDoField = existentes.filter(
      (obra) => obra.fonte === FONTE_FIELD && texto(obra.field_id) !== null,
    )
    const ausentes = obrasDoField.filter((obra) => !idsEncontrados.has(obra.id))
    const ausenciasAindaNaoAlertadas = ausentes.filter(
      (obra) => !texto(obra.field_ausente_em),
    )
    const limiteDeSeguranca = Math.max(
      PISO_DE_AUSENCIAS_EM_MASSA,
      obrasDoField.length * LIMITE_DE_AUSENCIA_EM_MASSA,
    )

    if (doField.length === 0 && obrasDoField.length > 0) {
      avisos.push(
        'Varredura suspeita: o Field devolveu 0 OS. Nenhuma ausência foi registrada.',
      )
    } else if (ausenciasAindaNaoAlertadas.length > limiteDeSeguranca) {
      avisos.push(
        `Varredura suspeita: ${ausenciasAindaNaoAlertadas.length} ausências ainda não alertadas ultrapassam o limite de segurança (${Math.floor(limiteDeSeguranca)}). Nenhuma ausência foi registrada.`,
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
