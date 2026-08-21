import type { DemandPath } from './whatsapp'

/**
 * Texto do consentimento LGPD, aprovado pelo João em 21/08/2026.
 *
 * Curto de propósito: cada promessa a mais aqui vira obrigação que a empresa
 * tem de cumprir. Alterar só com aprovação dele.
 */
export const TEXTO_CONSENTIMENTO =
  'Autorizo a Manfac Engenharia a usar meus dados de contato para responder a esta solicitação.'

export type LeadEtapa1 = {
  path: DemandPath
  nome: string
  email: string
  telefone: string
  consentimento: boolean
}

export type LeadEtapa2 = {
  empresa?: string
  cargo?: string
  localidade?: string
  unidades?: string
  resumo?: string
}

export type Validacao = { ok: true } | { ok: false; erro: string }

// Não é RFC 5322 e nem tenta ser: e-mail só se prova enviando. O que se barra
// aqui é erro de digitação óbvio, não endereço inexistente.
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export function validarEtapa1(d: LeadEtapa1): Validacao {
  if (!d.nome?.trim()) {
    return { ok: false, erro: 'Informe seu nome.' }
  }
  if (!EMAIL.test(d.email?.trim() ?? '')) {
    return { ok: false, erro: 'Informe um e-mail válido.' }
  }
  // Só dígitos: o visitante escreve com parênteses, espaço, traço ou +55.
  const digitos = (d.telefone ?? '').replace(/\D/g, '')
  if (digitos.length < 10) {
    return { ok: false, erro: 'Informe um telefone com DDD.' }
  }
  if (d.consentimento !== true) {
    return { ok: false, erro: 'É preciso autorizar o uso dos seus dados para continuar.' }
  }
  return { ok: true }
}
