/**
 * Extratos Ticketlog (.xlsx) e Veloe (.csv) — Etapa 3 do Gestão de Frotas.
 * Design: docs/superpowers/specs/2026-10-28-frotas-extratos-cadastros-design.md
 *
 * Uma LinhaExtrato é exatamente o que a RPC sofia_registrar_extrato recebe.
 * Valores decimais vão como TEXTO ("69.99") para não passar por float no
 * caminho até o numeric(12,2) do banco. Nome de motorista, CPF/CNPJ e
 * matrícula nunca entram aqui (dado pessoal).
 */

export type Plataforma = 'ticketlog' | 'veloe'

export type LinhaExtrato = {
  codigo_transacao: string
  /** AAAA-MM-DD — data de USO (Veloe: utilização, nunca processamento) */
  data_uso: string
  /** HH:MM:SS */
  hora_uso: string | null
  /** Ticketlog: NUMERO CARTAO · Veloe: VeloeTag */
  identificador: string
  /** Só Veloe, só informação (na Ticketlog a placa vem errada) */
  placa: string | null
  /** decimal com 2 casas, ponto: "69.99" */
  valor: string
  /** Ticketlog: SERVICO · Veloe: Tipo de Transacao */
  servico: string | null
  /** Veloe: Tipo do Movimento */
  tipo_movimento: string | null
  litros: string | null
  valor_litro: string | null
  hodometro: string | null
  estabelecimento: string | null
  cidade: string | null
}

/** Erro de leitura com mensagem pronta para a pessoa que enviou o arquivo. */
export class ErroExtrato extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ErroExtrato'
  }
}

export type ResumoLinhas = {
  total: number
  identificadores: number
  inicio: string | null
  fim: string | null
}

export function resumirLinhas(linhas: LinhaExtrato[]): ResumoLinhas {
  const datas = linhas.map((l) => l.data_uso).sort()
  return {
    total: linhas.length,
    identificadores: new Set(linhas.map((l) => l.identificador)).size,
    inicio: datas[0] ?? null,
    fim: datas[datas.length - 1] ?? null,
  }
}
