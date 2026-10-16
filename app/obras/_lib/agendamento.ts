/**
 * "Agendar e tirar do diário" — regra única da fila do Diário e validação.
 * Spec: docs/superpowers/specs/2026-10-16-obras-agendar-tirar-do-diario-design.md (§2.1, §5, §6.4).
 *
 * A fila do Diário tem quatro consumidores (tela, Painel, e-mail das 8h, Tarefas):
 * todos importam daqui, para o e-mail nunca dizer um número e a tela outro.
 * Datas são `AAAA-MM-DD` e se comparam como string. "Hoje" vem de `hojeISO()`.
 */

import type { Etapa } from './tipos'

export const ETAPAS_FILA_DIARIO: Etapa[] = ['levantamento', 'andamento', 'paralisado']

export const SUGESTOES_AGENDAMENTO = ['Levantamento de material', 'Levantamento de medidas', 'Visita técnica'] as const
/** Têm de bater, letra por letra, com o CHECK de `sdd-sql-obras-agendamento-diario.sql`. */
export const MOTIVOS_AGENDAMENTO = [
  'Aguardando levantamento de material',
  'Aguardando material',
  'Aguardando cliente / liberação da loja',
] as const
export const MOTIVO_OUTRO = 'Outro'
export const LIMITE_DIAS_AGENDAMENTO = 30
export const MAX_OQUE = 80
export const MAX_OUTRO = 100

export type EntradaAgendamento = { obraId: string; oque: string; motivo: string; outro: string; ate: string }

type ComAgendamento = { etapa: Etapa; diario_agendado_ate?: string | null }

/** Agendada e ainda fora do diário. */
export function agendadaForaDoDiario(o: ComAgendamento, hoje: string): boolean {
  return ETAPAS_FILA_DIARIO.includes(o.etapa) && !!o.diario_agendado_ate && hoje < o.diario_agendado_ate
}

/** Entra na fila do diário (no dia marcado a obra já está de volta). */
export function naFilaDoDiario(o: ComAgendamento, hoje: string): boolean {
  return ETAPAS_FILA_DIARIO.includes(o.etapa) && !agendadaForaDoDiario(o, hoje)
}

/** A data do agendamento chegou e ninguém marcou como feito. */
export function agendamentoVoltou(o: ComAgendamento, hoje: string): boolean {
  return ETAPAS_FILA_DIARIO.includes(o.etapa) && !!o.diario_agendado_ate && hoje >= o.diario_agendado_ate
}

/** Soma dias a uma data `AAAA-MM-DD` (UTC ao meio-dia, sem surpresa de fuso). */
export function somarDiasISO(iso: string, n: number): string {
  const [a, m, d] = iso.split('-').map(Number)
  const dt = new Date(Date.UTC(a, m - 1, d, 12))
  dt.setUTCDate(dt.getUTCDate() + n)
  return dt.toISOString().slice(0, 10)
}

export function limitesAgendamento(hoje: string): { min: string; max: string } {
  return { min: somarDiasISO(hoje, 1), max: somarDiasISO(hoje, LIMITE_DIAS_AGENDAMENTO) }
}

const MSG_DATA = 'Escolha uma data entre amanhã e 30 dias.'

export function validarAgendamento(
  e: EntradaAgendamento,
  hoje: string
): { error: string } | { campos: { ate: string; oque: string; motivo: string } } {
  const oque = (e.oque ?? '').trim()
  if (!oque) return { error: 'Diga o que vai acontecer.' }
  if (oque.length > MAX_OQUE) return { error: `O que vai acontecer: no máximo ${MAX_OQUE} letras.` }

  let motivo: string
  if (e.motivo === MOTIVO_OUTRO) {
    const outro = (e.outro ?? '').trim()
    if (!outro) return { error: 'Escreva o motivo.' }
    if (outro.length > MAX_OUTRO) return { error: `O motivo: no máximo ${MAX_OUTRO} letras.` }
    motivo = `${MOTIVO_OUTRO}: ${outro}`
  } else if ((MOTIVOS_AGENDAMENTO as readonly string[]).includes(e.motivo)) {
    motivo = e.motivo
  } else {
    return { error: 'Escolha o motivo da parada.' }
  }

  const ate = e.ate ?? ''
  const { min, max } = limitesAgendamento(hoje)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ate) || ate < min || ate > max) return { error: MSG_DATA }

  return { campos: { ate, oque, motivo } }
}

export function nomeDeQuemAgendou(email: string, pessoas: { email?: string | null; nome: string }[]): string {
  const p = pessoas.find((x) => x.email && x.email.toLowerCase() === email.toLowerCase())
  const base = p ? p.nome.trim().split(/\s+/)[0] : email.split('@')[0].split('.')[0]
  return base.charAt(0).toUpperCase() + base.slice(1)
}

export function textoAgendadas(n: number): string {
  return n === 1 ? '1 agendada' : `${n} agendadas`
}
