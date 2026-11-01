/**
 * Texto da regra de trava impresso na prancha (Leva 6b §2 item 6): grava, na
 * emissão, o status da atividade de trava e das atividades bloqueadas por ela.
 */

export type StatusTrava = 'nao_iniciado' | 'em_andamento' | 'concluido' | 'bloqueado'

/** Formato gravado pelo banco em `obras_fase_revisao.trava_snapshot` (Task 1). */
export type TravaSnapshot = {
  /** AAAA-MM-DD (America/Sao_Paulo) do dia da emissão. */
  data: string
  gerado_em?: string
  versao?: number | null
  atividade: { numero: number; descricao: string | null; status: StatusTrava; percentual?: number }
  bloqueadas: { numero: number; descricao: string | null; status?: string }[]
}

const STATUS: Record<string, string> = {
  nao_iniciado: 'NÃO INICIADA',
  em_andamento: 'EM ANDAMENTO',
  concluido: 'CONCLUÍDA',
  bloqueado: 'BLOQUEADA',
}

/** `dd/mm/aaaa` de uma data `AAAA-MM-DD` ou de um instante ISO (fuso de São Paulo). */
export function dataBR(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  if (m) return `${m[3]}/${m[2]}/${m[1]}`
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric' }).format(d)
}

/** "11–14 e 21": faixas consecutivas com travessão, vírgulas e " e " antes da última. */
function faixas(numeros: number[]): string {
  const ns = [...new Set(numeros)].sort((a, b) => a - b)
  const partes: string[] = []
  for (let i = 0; i < ns.length; ) {
    let j = i
    while (j + 1 < ns.length && ns[j + 1] === ns[j] + 1) j++
    partes.push(j > i ? `${ns[i]}–${ns[j]}` : `${ns[i]}`)
    i = j + 1
  }
  return partes.length <= 1 ? partes.join('') : `${partes.slice(0, -1).join(', ')} e ${partes[partes.length - 1]}`
}

const nomeDe = (n: { numero: number; descricao: string | null }) => `nº ${n.numero}${n.descricao ? ` ${n.descricao}` : ''}`

/** Texto impresso na prancha; a data é a do próprio snapshot. Liberada = atividade de trava concluída. */
export function textoDaTrava(snapshot: TravaSnapshot | null): string | null {
  if (!snapshot) return null
  const { atividade, bloqueadas } = snapshot
  const status = STATUS[atividade.status] ?? String(atividade.status).replace(/_/g, ' ').toUpperCase()
  const base = `Status na geração (${dataBR(snapshot.data)}): atividade ${nomeDe(atividade)} ${status}.`
  if (atividade.status === 'concluido') return `${base} Condição de liberação atendida.`
  if (bloqueadas.length === 0) return base
  if (bloqueadas.length <= 3) {
    const um = bloqueadas.length === 1
    return `${base} ${um ? 'Atividade' : 'Atividades'} ${bloqueadas.map(nomeDe).join(', ')} ${um ? 'BLOQUEADA' : 'BLOQUEADAS'}.`
  }
  return `${base} Atividades nº ${faixas(bloqueadas.map((b) => b.numero))} BLOQUEADAS.`
}
