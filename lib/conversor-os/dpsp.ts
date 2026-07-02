import type { ConversorRow } from './types'

export function mapearLinhaDPSP(
  valores: unknown[],
  numeroLinha: number
): { row: ConversorRow } | { erro: string } {
  const colA = String(valores[0] ?? '').trim()
  const colF = String(valores[5] ?? '').trim()
  const colH = String(valores[7] ?? '').trim()

  if (!colA) return { erro: `linha ${numeroLinha}: falta Nº Chamado` }
  if (!colH) return { erro: `linha ${numeroLinha}: falta Sobrenome do Solicitante` }
  if (!colF) return { erro: `linha ${numeroLinha}: falta Descrição` }

  return {
    row: {
      identificador: colA,
      tipoOs: 'Manutenção Corretiva',
      documentoCliente: '',
      nomeCliente: 'DPSP',
      nomeLocalizacao: colH,
      numeroSerie: '',
      nomeColaborador: '',
      colaboradoresSecundarios: '',
      dataAgendamento: '',
      horaAgendamento: '',
      descricao: colF,
      descricaoTarefa: '',
      etiquetas: '',
    },
  }
}
