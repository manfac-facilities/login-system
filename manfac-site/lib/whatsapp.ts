// Número do WhatsApp comercial da Manfac, informado pelo cliente em 19/08/2026.
// Formato exigido pelo wa.me: 55 + DDD + número, só dígitos.
// (21) 98428-0058
export const WHATSAPP_COMERCIAL = '5521984280058'

// O mesmo número, no formato que a pessoa lê. Existe para o texto exibido no
// rodapé não divergir do número que o link disca — duas fontes de verdade aqui
// significa exibir um e ligar para outro no dia em que o comercial trocar.
export const WHATSAPP_COMERCIAL_DISPLAY = '(21) 98428-0058'

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

/**
 * URL do WhatsApp para os CTAs que levam direto à conversa, sem passar pelo
 * formulário. `origem` identifica de onde a pessoa veio (página ou serviço),
 * para que o atendimento já saiba o contexto na primeira mensagem.
 */
export function buildDirectWhatsAppUrl(origem: string): string {
  const texto = `Olá! Vim pelo site da Manfac (${origem}) e gostaria de solicitar atendimento.`
  return `https://wa.me/${WHATSAPP_COMERCIAL}?text=${encodeURIComponent(texto)}`
}
