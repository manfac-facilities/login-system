import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { podeGerirFrotas } from '@/lib/sofia/permissoes'
import { getEquipes, getVeiculos } from '@/lib/sofia/queries'
import { hojeSP } from '@/lib/sofia/bases/leitura'
import NovaManutencaoForm from './_form'

export default async function NovaManutencaoPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const supabase = await createClient()
  if (!(await podeGerirFrotas(supabase))) redirect('/sofia/manutencoes')

  const params = await searchParams
  const pedido = Array.isArray(params.veiculo) ? params.veiculo[0] : params.veiculo
  const [veiculos, equipes] = await Promise.all([getVeiculos(), getEquipes()])
  const cod = new Map(equipes.map((e) => [e.id, e.codigo]))
  const opcoes = veiculos
    .filter((v) => v.status !== 'inativo')
    .map((v) => ({
      id: v.id, placa: v.placa, modelo: v.modelo, naOficina: v.status === 'manutencao',
      equipe: v.equipe_id ? cod.get(v.equipe_id) ?? null : null,
    }))
  const inicial = opcoes.some((v) => v.id === pedido) ? (pedido as string) : ''
  return <NovaManutencaoForm veiculos={opcoes} veiculoInicial={inicial} hoje={hojeSP()} />
}
