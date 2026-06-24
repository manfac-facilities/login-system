import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { isAdminEmail } from '@/lib/auth/admins'
import MultasTable from './_table'
import type { Multa } from '@/lib/sofia/types'

export type MultaComRelacoes = Multa & {
  veiculos: { placa: string } | null
  motoristas: { nome: string } | null
}

export default async function MultasPage() {
  const supabase = await createClient()
  const [{ data: multas }, { data: userData }] = await Promise.all([
    supabase.from('multas').select('*, veiculos(placa), motoristas(nome)').order('data', { ascending: false }),
    supabase.auth.getUser(),
  ])

  const isAdmin = isAdminEmail(userData.user?.email ?? '')

  const totalPendente = (multas ?? [])
    .filter((m: MultaComRelacoes) => m.status === 'pendente')
    .reduce((sum: number, m: MultaComRelacoes) => sum + Number(m.valor), 0)

  const totalValidada = (multas ?? [])
    .filter((m: MultaComRelacoes) => m.status === 'validada')
    .reduce((sum: number, m: MultaComRelacoes) => sum + Number(m.valor), 0)

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Multas</h1>
          <div className="flex gap-6 mt-2">
            <p className="text-[#4a6080] text-sm">R$ {totalPendente.toFixed(2)} pendente de validação</p>
            <p className="text-[#4a6080] text-sm">R$ {totalValidada.toFixed(2)} validada, não descontada</p>
          </div>
        </div>
        <Link
          href="/sofia/multas/nova"
          className="px-4 py-2 rounded-lg bg-[#f05a28] text-white text-sm font-medium hover:bg-[#d94e22] transition-colors"
        >
          + Registrar Multa
        </Link>
      </div>

      <MultasTable multas={multas ?? []} isAdmin={isAdmin} />
    </div>
  )
}
