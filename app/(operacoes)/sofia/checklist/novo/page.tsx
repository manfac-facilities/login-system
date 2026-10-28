import { getEquipes, getVeiculos, getMotoristas } from '@/lib/sofia/queries'
import ChecklistForm from './_form'

export default async function NovoChecklistPage({
  searchParams,
}: {
  searchParams: Promise<{ tipo?: string; equipe_destino?: string }>
}) {
  const { tipo, equipe_destino } = await searchParams
  const [equipes, veiculos, motoristas] = await Promise.all([
    getEquipes(),
    getVeiculos(),
    getMotoristas(),
  ])
  // Vindo de "Trocar carro" (editar equipe): só tipo "troca" e uma equipe
  // ATIVA existente chegam preenchidos; qualquer outra coisa é ignorada.
  const tipoInicial = tipo === 'troca' ? 'troca' : undefined
  const destino = tipoInicial
    ? equipes.find((e) => e.id === equipe_destino && e.ativo)
    : undefined
  return (
    <ChecklistForm
      equipes={equipes}
      veiculos={veiculos}
      motoristas={motoristas}
      tipoInicial={tipoInicial}
      equipeDestinoInicial={destino ? { id: destino.id, codigo: destino.codigo } : undefined}
    />
  )
}
