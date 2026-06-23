export type ClasseCnh = 'sem_cnh' | 'vencidas' | 'urgente' | 'atencao' | 'regulares'

export function classificarCnh(vencimento: string | null, hoje: Date = new Date()): ClasseCnh {
  if (!vencimento) return 'sem_cnh'
  const dias = Math.ceil((new Date(vencimento).getTime() - hoje.getTime()) / 86400000)
  if (dias < 0) return 'vencidas'
  if (dias <= 30) return 'urgente'
  if (dias <= 60) return 'atencao'
  return 'regulares'
}

export function cnhStatus(vencimento: string | null, hoje: Date = new Date()): { label: string; style: string } {
  if (!vencimento) return { label: 'Sem CNH', style: 'bg-[#1e3a5f] text-[#4a6080]' }
  const dias = Math.ceil((new Date(vencimento).getTime() - hoje.getTime()) / 86400000)
  if (dias < 0) return { label: 'VENCIDA', style: 'bg-red-900 text-red-300' }
  if (dias <= 30) return { label: `Vence em ${dias}d`, style: 'bg-red-900 text-red-300' }
  if (dias <= 60) return { label: `Vence em ${dias}d`, style: 'bg-amber-900 text-amber-300' }
  return { label: new Date(vencimento).toLocaleDateString('pt-BR'), style: 'bg-green-900 text-green-300' }
}
