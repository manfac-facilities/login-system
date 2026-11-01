/**
 * Texto da regra de trava impresso na prancha (Leva 6b §2 item 6): grava, na
 * emissão, o status da atividade de trava e das atividades bloqueadas por ela.
 */

export type TravaSnapshot = {
  atividade: { numero: number; nome: string; status: string }
  bloqueadas: { numero: number; nome: string }[]
  liberada: boolean
}

const STATUS: Record<string, string> = {
  nao_iniciado: 'NÃO INICIADO',
  em_andamento: 'EM ANDAMENTO',
  concluido: 'CONCLUÍDO',
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

export function textoDaTrava(snapshot: TravaSnapshot | null, dataEmissao: string): string | null {
  if (!snapshot) return null
  const { atividade, bloqueadas, liberada } = snapshot
  const status = STATUS[atividade.status] ?? atividade.status.replace(/_/g, ' ').toUpperCase()
  const base = `Status na geração (${dataBR(dataEmissao)}): atividade nº ${atividade.numero} ${atividade.nome} ${status}.`
  if (liberada) return `${base} Condição de liberação atendida.`
  if (bloqueadas.length === 0) return base
  if (bloqueadas.length <= 3) {
    const lista = bloqueadas.map((b) => `nº ${b.numero} ${b.nome}`).join(', ')
    const um = bloqueadas.length === 1
    return `${base} ${um ? 'Atividade' : 'Atividades'} ${lista} ${um ? 'BLOQUEADA' : 'BLOQUEADAS'}.`
  }
  return `${base} Atividades nº ${faixas(bloqueadas.map((b) => b.numero))} BLOQUEADAS.`
}
