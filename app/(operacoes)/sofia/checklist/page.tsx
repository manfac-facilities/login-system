import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { excluirChecklistAction } from './_actions'
import DeleteConfirmButton from '@/components/sofia/DeleteConfirmButton'

interface ChecklistRow {
  id: string
  tipo: string
  created_at: string
  equipes: { codigo: string } | null
  veiculos: { placa: string } | null
  motoristas: { nome: string } | null
}

const tipoBadge: Record<string, { label: string; style: string }> = {
  saida: { label: '↑ SAÍDA', style: 'bg-green-900 text-green-300' },
  retorno: { label: '↓ RETORNO', style: 'bg-blue-900 text-blue-300' },
  troca: { label: '⇄ TROCA', style: 'bg-amber-900 text-amber-300' },
}

export default async function ChecklistPage() {
  const supabase = await createClient()
  const { data: checklists } = await supabase
    .from('checklist')
    .select('*, equipes(codigo), veiculos(placa), motoristas(nome)')
    .order('created_at', { ascending: false })
    .limit(50)

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Checklist</h1>
          <p className="text-[#4a6080] text-sm mt-1">Histórico de saídas e retornos</p>
        </div>
        <Link
          href="/sofia/checklist/novo"
          className="px-4 py-2 rounded-lg bg-[#f05a28] text-white text-sm font-medium hover:bg-[#d94e22] transition-colors"
        >
          + Novo Checklist
        </Link>
      </div>

      <div className="flex flex-col gap-3">
        {(checklists ?? []).map((c: ChecklistRow) => (
          <div
            key={c.id}
            className="flex items-center gap-4 px-4 py-4 rounded-xl border border-[#1e3a5f] bg-[#0d2050]"
          >
            <span
              className={`px-2.5 py-1 rounded text-xs font-bold shrink-0 ${
                (tipoBadge[c.tipo] ?? tipoBadge.retorno).style
              }`}
            >
              {(tipoBadge[c.tipo] ?? tipoBadge.retorno).label}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-white font-medium">
                {c.equipes?.codigo} · {c.veiculos?.placa}
              </p>
              <p className="text-[#4a6080] text-xs truncate">
                {c.motoristas?.nome ?? 'Motorista não informado'}
              </p>
            </div>
            <p className="text-[#4a6080] text-xs shrink-0">
              {new Date(c.created_at).toLocaleDateString('pt-BR', {
                day: '2-digit',
                month: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </p>
            <div className="shrink-0">
              <DeleteConfirmButton action={excluirChecklistAction} id={c.id} />
            </div>
          </div>
        ))}
        {(checklists ?? []).length === 0 && (
          <p className="text-center text-[#4a6080] py-12">
            Nenhum checklist ainda.{' '}
            <Link href="/sofia/checklist/novo" className="text-[#f05a28] hover:underline">
              Criar primeiro →
            </Link>
          </p>
        )}
      </div>
    </div>
  )
}
