// Número do WhatsApp comercial da Manfac.
// TODO: trocar pelo número real quando o cliente informar (formato: 55 + DDD + número, só dígitos).
export const WHATSAPP_COMERCIAL = '5521999999999'

export type DemandPath = 'Manutenção recorrente' | 'Obra ou reforma' | 'Avaliação técnica'

export type ContactFormData = {
  path: DemandPath
  nome: string
  empresa: string
  email: string
  telefone: string
  cargo?: string
  localidade: string
  unidades?: string
  resumo?: string
}

export function buildWhatsAppMessage(d: ContactFormData): string {
  const linhas = [
    'Olá! Vim pelo site da Manfac.',
    `Tipo de demanda: ${d.path}`,
    `Nome: ${d.nome}${d.cargo ? ` (${d.cargo})` : ''}`,
    `Empresa: ${d.empresa}`,
    `E-mail: ${d.email}`,
    `Telefone: ${d.telefone}`,
    `Localidade: ${d.localidade}`,
  ]
  if (d.path === 'Manutenção recorrente' && d.unidades) linhas.push(`Unidades: ${d.unidades}`)
  if (d.resumo) linhas.push(`Resumo: ${d.resumo}`)
  return linhas.join('\n')
}

export function buildWhatsAppUrl(d: ContactFormData): string {
  return `https://wa.me/${WHATSAPP_COMERCIAL}?text=${encodeURIComponent(buildWhatsAppMessage(d))}`
}
