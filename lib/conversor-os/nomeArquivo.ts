import type { Cliente } from './types'

export function gerarNomeArquivo(cliente: Cliente, agora: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  const data = `${agora.getFullYear()}${pad(agora.getMonth() + 1)}${pad(agora.getDate())}`
  const hora = `${pad(agora.getHours())}${pad(agora.getMinutes())}`
  return `${cliente}-convertido-${data}-${hora}.xlsx`
}
