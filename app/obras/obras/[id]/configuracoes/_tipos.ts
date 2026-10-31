export type Resultado = { ok: true } | { ok: false; erro: string }

export const TIPOS_ENVIO = [
  { valor: 'diario', rotulo: 'Diário' },
  { valor: 'semanal', rotulo: 'Semanal' },
  { valor: 'mensal', rotulo: 'Mensal' },
  { valor: 'imediato', rotulo: 'Imediato' },
] as const

export type TipoEnvio = (typeof TIPOS_ENVIO)[number]['valor']
export type Lado = 'cliente' | 'interno'

export type DestinatarioEntrada = {
  id?: string
  email: string
  nome: string | null
  funcao: string | null
  lado: Lado
  tipos: TipoEnvio[]
  ativo: boolean
}

export type Destinatario = DestinatarioEntrada & { id: string }

export type ConfigObra = {
  engenheiroEmail: string | null
  dataBase: string | null
  atividadeTrava: number | null
}

export type PesoAvanco = 'valor' | 'duracao' | null

export const ABRANGENCIAS_FERIADO = [
  { valor: 'municipal', rotulo: 'Municipal' },
  { valor: 'facultativo', rotulo: 'Facultativo' },
  { valor: 'estadual', rotulo: 'Estadual' },
] as const

export type AbrangenciaFeriado = (typeof ABRANGENCIAS_FERIADO)[number]['valor']

export type FeriadoEntrada = { data: string; descricao: string; abrangencia: AbrangenciaFeriado }

export type FeriadoObra = FeriadoEntrada & { global: boolean }

/** Obra (modalidade obra) para o "Esta obra é aditivo de…". */
export type ObraParaMae = { id: string; os: string | null; loja: string | null; paiId: string | null }

/**
 * Opções de obra mãe (um nível só, sem ciclo — o banco confere de novo):
 * não a própria obra, nem obra que já é aditivo de outra. Obra que tem aditivos não pode
 * virar aditivo: sem opções e com o motivo.
 */
export function opcoesObraMae(obras: ObraParaMae[], atualId: string): { opcoes: ObraParaMae[]; bloqueio: string | null } {
  if (obras.some((o) => o.paiId === atualId)) {
    return { opcoes: [], bloqueio: 'Esta obra tem aditivos; por isso não pode ser aditivo de outra (um nível só).' }
  }
  const opcoes = obras
    .filter((o) => o.id !== atualId && !o.paiId)
    .sort((a, b) => (a.os ?? '').localeCompare(b.os ?? ''))
  return { opcoes, bloqueio: null }
}

export const rotuloObra = (o: ObraParaMae) => [o.os ? `OS ${o.os}` : null, o.loja].filter(Boolean).join(' · ') || 'Obra sem OS'
