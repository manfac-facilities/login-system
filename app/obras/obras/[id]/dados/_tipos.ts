export type Resultado = { ok: true } | { ok: false; erro: string }

export type PessoaEntrada = { id?: string; nome: string; cargo: string | null; email: string | null }

/** OS da obra (mãe + aditivos) com o valor receita em centavos (null = não informado). */
export type OsReceita = { id: string; os: string | null; descricao: string; papel: 'mae' | 'aditivo' | 'obra'; receitaCentavos: number | null }
