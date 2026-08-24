// Espelha as 16 colunas de `site_leads` (ver sdd-sql-site-leads.sql, fonte
// única). `consentimento_texto` guarda o texto de TEXTO_CONSENTIMENTO no
// momento do aceite — não é usado nesta tela, mas faz parte da linha.
export type Lead = {
  id: string
  criado_em: string
  atualizado_em: string | null
  path: string
  nome: string
  email: string
  telefone: string
  consentimento: boolean
  consentido_em: string
  consentimento_texto: string
  empresa: string | null
  cargo: string | null
  localidade: string | null
  unidades: string | null
  resumo: string | null
  etapa2_em: string | null
}

export function formatarData(iso: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Sao_Paulo',
  })
    .format(new Date(iso))
    .replace(',', '')
}

export function linkWhatsApp(telefone: string): string {
  const digitos = telefone.replace(/\D/g, '')
  // O visitante escreve com ou sem o código do país; o wa.me só aceita com.
  const comPais = digitos.startsWith('55') ? digitos : `55${digitos}`
  return `https://wa.me/${comPais}`
}

export function estaCompleto(lead: Pick<Lead, 'etapa2_em'>): boolean {
  return lead.etapa2_em !== null
}
