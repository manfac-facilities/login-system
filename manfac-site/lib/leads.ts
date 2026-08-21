import { DEMAND_PATHS, type DemandPath } from './whatsapp'

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

// Tetos de tamanho. `registrarLeadAction` é endpoint público não autenticado:
// sem limite, uma única requisição pode inserir ~1 MB num campo de texto.
const NOME_MAX = 120
const EMAIL_MAX = 254
const TELEFONE_MAX = 30

export function validarEtapa1(d: LeadEtapa1): Validacao {
  if (!DEMAND_PATHS.includes(d.path)) {
    return { ok: false, erro: 'Escolha um tipo de demanda válido.' }
  }
  if (!d.nome?.trim()) {
    return { ok: false, erro: 'Informe seu nome.' }
  }
  if (d.nome.trim().length > NOME_MAX) {
    return { ok: false, erro: 'Nome muito longo.' }
  }
  const email = d.email?.trim() ?? ''
  if (!EMAIL.test(email)) {
    return { ok: false, erro: 'Informe um e-mail válido.' }
  }
  if (email.length > EMAIL_MAX) {
    return { ok: false, erro: 'E-mail muito longo.' }
  }
  const telefone = (d.telefone ?? '').trim()
  if (telefone.length > TELEFONE_MAX) {
    return { ok: false, erro: 'Telefone muito longo.' }
  }
  // Só dígitos: o visitante escreve com parênteses, espaço, traço ou +55.
  const digitos = telefone.replace(/\D/g, '')
  if (digitos.length < 10) {
    return { ok: false, erro: 'Informe um telefone com DDD.' }
  }
  if (d.consentimento !== true) {
    return { ok: false, erro: 'É preciso autorizar o uso dos seus dados para continuar.' }
  }
  return { ok: true }
}

// Etapa 2 é opcional — mas mesma lógica do endpoint público: sem teto,
// qualquer campo vira vetor de payload gigante.
const CAMPO_CURTO_MAX = 200
const RESUMO_MAX = 2000

export function validarEtapa2(d: LeadEtapa2): Validacao {
  const camposCurtos: (keyof LeadEtapa2)[] = ['empresa', 'cargo', 'localidade', 'unidades']
  for (const campo of camposCurtos) {
    const valor = d[campo]
    if (valor && valor.length > CAMPO_CURTO_MAX) {
      return { ok: false, erro: `Campo "${campo}" muito longo.` }
    }
  }
  if (d.resumo && d.resumo.length > RESUMO_MAX) {
    return { ok: false, erro: 'Resumo muito longo.' }
  }
  return { ok: true }
}
