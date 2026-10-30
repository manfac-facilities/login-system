import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getEquipes, getVeiculos, getMotoristas } from '@/lib/sofia/queries'
import { podeGerirFrotas } from '@/lib/sofia/permissoes'
import KmForm from '../_form'

export default async function NovoKmPage() {
  const podeGerir = await podeGerirFrotas(await createClient())
  const [equipes, veiculos, motoristas] = await Promise.all([getEquipes(), getVeiculos(), getMotoristas()])
  return (
    <div className="p-8 max-w-xl">
      <Link href="/sofia/km" className="text-sm text-[#94a3b8] hover:text-white">← Voltar para KM diário</Link>
      <h1 className="text-2xl font-bold text-white mt-3 mb-6">Lançar KM do dia</h1>
      <KmForm equipes={equipes} veiculos={veiculos} motoristas={motoristas} podeGerir={podeGerir} />
    </div>
  )
}
