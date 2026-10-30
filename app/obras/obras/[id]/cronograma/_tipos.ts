/**
 * Tipos das Server Actions do cronograma. Ficam aqui porque `export type` num
 * arquivo `'use server'` derruba a tela em runtime (rules/obras.md, armadilha 1).
 */
import type { AtividadeCalculada, Situacao, StatusAtividade } from '../../_lib/cronograma'

export type Resultado = { ok: true } | { ok: false; erro: string }
/** Resultado de quem cria atividade: devolve o `numero` gerado. */
export type ResultadoNumero = { ok: true; numero: number } | { ok: false; erro: string }

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

/** Edição parcial de uma linha: só os campos presentes são gravados (a tabela salva célula a célula). */
export type EdicaoLinha = Pick<LinhaPlano, 'numero'> &
  Partial<Omit<LinhaPlano, 'numero'>> & {
    /** Valor (R$) da atividade = obras_atividade.peso_valor (pesa o % físico). Interno: nunca vai ao cliente. */
    pesoValor?: number
  }

/** Direção de ↑/↓ de etapa e de atividade. */
export type Direcao = 'cima' | 'baixo'

/** Atividade nova numa etapa do rascunho (Leva 1b). */
export type NovaAtividade = {
  descricao: string
  duracao: number
  pred1: number | null
  pred2: number | null
  inicioFixo?: string | null
  /** Valor (R$) = peso_valor; ausente = 0. */
  pesoValor?: number
}

/** Uma linha da gaveta "Atualizar status" (spec Leva 1 §5 A5). */
export type LinhaStatus = {
  numero: number
  percentual: number
  /** Dias úteis restantes; null = projeta pelo %. */
  diasRestantes: number | null
  concluir: boolean
  /** Ausente = automático (data de status ao sair de 0% / ao concluir). */
  inicioReal?: string | null
  fimReal?: string | null
}

/** Atividade como a gaveta recebe: plano vigente + execução atual (sem peso). */
export type AtividadeStatus = {
  numero: number
  etapa: string
  descricao: string
  status: StatusAtividade
  percentual: number
  inicioPrevisto: string
  inicioReal: string | null
  fimReal: string | null
  diasRestantes: number | null
  travada: boolean
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
  /** Gaveta "Atualizar status": plano que vale para a execução (vigente; sem base, o rascunho). */
  statusAtividades: AtividadeStatus[]
  /**
   * Valor (R$) por numero (peso_valor) — só no rascunho editável (engenheiro/admin); null nas demais.
   * Dado interno: a tela do cliente e o e-mail nunca recebem.
   */
  valores: Record<number, number> | null
  atividadeTrava: number | null
}
