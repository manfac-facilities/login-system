/**
 * Tipos das Server Actions do cronograma. Ficam aqui porque `export type` num
 * arquivo `'use server'` derruba a tela em runtime (rules/obras.md, armadilha 1).
 */
import type { AtividadeCalculada, Situacao, StatusAtividade } from '../../_lib/cronograma'

export type Resultado = { ok: true } | { ok: false; erro: string }

/** O que o engenheiro edita numa linha do rascunho. `numero` identifica a linha. */
export type LinhaPlano = {
  numero: number
  etapa: string
  descricao: string
  pred1: number | null
  pred2: number | null
  duracao: number
  bloqueiaPorTrava: boolean
}

export type CamposExecucao = {
  status?: StatusAtividade
  percentual?: number
  inicioReal?: string | null
  fimReal?: string | null
}

/* ── Tela do cronograma (árvore + Gantt) ─────────────────────────────── */

/** Atividade como a árvore/Gantt recebem: sem peso (dado interno) e com a base ao lado. */
export type LinhaAtividade = Omit<AtividadeCalculada, 'pesoValor' | 'peso'> & {
  inicioBase: string | null
  fimBase: string | null
  /** Dias úteis entre o fim da base e o fim projetado; null sem base. */
  delta: number | null
}

/** Linha-resumo de uma etapa. `chave` é o nome cru (pode ser ''). */
export type LinhaEtapa = {
  chave: string
  nome: string
  cor: string
  inicio: string
  fim: string
  diasUteis: number
  percentual: number
  inicioProjetado: string
  fimProjetado: string
  inicioBase: string | null
  fimBase: string | null
  delta: number | null
  situacao: Situacao
  status: StatusAtividade
  numeros: number[]
}

export type VersaoOpcao = { numero: number; rotulo: string }

export type DadosCronograma = {
  obraId: string
  /** Versão exibida (a do seletor). */
  versao: { id: string; numero: number; salva: boolean }
  versoes: VersaoOpcao[]
  /** Engenheiro da obra ou admin. */
  podeEditar: boolean
  /** Versão exibida em rascunho e quem vê pode editar. */
  editavel: boolean
  rascunho: { id: string; numero: number } | null
  temVigente: boolean
  temBase: boolean
  etapas: LinhaEtapa[]
  atividades: LinhaAtividade[]
  feriados: string[]
  hoje: string
  termino: { base: string | null; previsto: string; projetado: string }
}
