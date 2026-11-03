export type Resultado = { ok: true } | { ok: false; erro: string }

export type AcessoPortal = { id: string; email: string; nome: string | null; ativo: boolean }

export type DocumentoEntrada = { pasta: string; nome: string; tamanho: number; tipo: string | null; path: string }

export type DocumentoLinha = { id: string; pasta: string; nome: string; tamanho: number | null; criadoEm: string; criadoPor: string | null }
