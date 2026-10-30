'use client'

/** Prévia: a gaveta "Atualizar status" aberta, sem gravar (os callbacks não fazem nada). */
import AtualizarStatus from '../obras/obras/[id]/cronograma/_atualizar-status'
import type { AtividadeStatus } from '../obras/obras/[id]/cronograma/_tipos'

export default function GavetaPrevia(p: {
  hoje: string
  atividades: AtividadeStatus[]
  cores: Record<string, string>
  atividadeTrava: number | null
}) {
  return <AtualizarStatus obraId="previa" {...p} onFechar={() => {}} onSalvo={() => {}} />
}
