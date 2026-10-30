import Link from 'next/link'
import { getVeiculos, getEquipes } from '@/lib/sofia/queries'
import AbastecimentoForm from '../_form'

export default async function NovoAbastecimentoPage() {
  const [veiculos, equipes] = await Promise.all([getVeiculos(), getEquipes()])
  return (
    <div className="p-8 max-w-xl">
      <Link href="/sofia/abastecimento" className="text-sm text-[#94a3b8] hover:text-white">← Voltar para Abastecimentos</Link>
      <h1 className="text-2xl font-bold text-white mt-3 mb-1">Registrar abastecimento</h1>
      <p className="text-[#4a6080] text-sm mb-6">Lançamento manual</p>
      <AbastecimentoForm veiculos={veiculos} equipes={equipes} />
    </div>
  )
}
