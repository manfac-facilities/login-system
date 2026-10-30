import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { podeGerirFrotas } from '@/lib/sofia/permissoes'
import { getEquipes, getVeiculos, getMotoristas } from '@/lib/sofia/queries'
import EditarEquipeForm from './_form'

export default async function EditarEquipePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const podeGerir = await podeGerirFrotas(supabase)

  const voltar = (
    <Link href="/sofia/equipes" className="text-sm text-[#94a3b8] hover:text-white">
      ← Voltar para equipes
    </Link>
  )

  if (!podeGerir) {
    return (
      <div className="p-8 max-w-2xl">
        {voltar}
        <div className="mt-6 px-4 py-3 rounded-lg border border-[#1e3a5f] bg-[#0d2050] text-[#94a3b8] text-sm">
          Somente administrador ou gestor de frotas pode editar equipes.
        </div>
      </div>
    )
  }

  const [equipes, veiculos, motoristas] = await Promise.all([getEquipes(), getVeiculos(), getMotoristas()])
  const equipe = equipes.find((e) => e.id === id)
  if (!equipe) notFound()

  const codigoPorId = new Map(equipes.map((e) => [e.id, e.codigo]))
  const veiculo = veiculos.find((v) => v.equipe_id === id && v.status !== 'inativo') ?? null
  const ativos = motoristas
    .filter((m) => m.ativo)
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
    .map((m) => ({
      id: m.id,
      nome: m.nome,
      equipeId: m.equipe_id,
      equipeCodigo: m.equipe_id ? codigoPorId.get(m.equipe_id) ?? null : null,
    }))

  return (
    <div className="p-8 max-w-2xl">
      {voltar}
      <h1 className="text-2xl font-bold text-white mt-4 mb-1">Editar equipe {equipe.codigo}</h1>
      <p className="text-[#4a6080] text-sm mb-8">Código e motorista mudam na hora. O carro só muda pelo checklist.</p>
      <EditarEquipeForm
        equipe={{ id: equipe.id, codigo: equipe.codigo }}
        veiculo={veiculo ? { placa: veiculo.placa, modelo: veiculo.modelo } : null}
        motoristas={ativos}
        outrosCodigos={equipes.filter((e) => e.id !== id).map((e) => e.codigo)}
      />
    </div>
  )
}
