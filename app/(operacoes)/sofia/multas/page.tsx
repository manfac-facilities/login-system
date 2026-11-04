import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { podeGerirFrotas } from '@/lib/sofia/permissoes'
import { hojeSP, ordemEtapa, type MultaComEtapa } from '@/lib/sofia/multaEtapas'
import MultasTable from './_table'

export type MultaComRelacoes = MultaComEtapa & {
  veiculos: { placa: string } | null
  motoristas: { nome: string } | null
}

export default async function MultasPage() {
  const supabase = await createClient()
  const [{ data: multas }, podeGerir] = await Promise.all([
    supabase.from('multas').select('*, veiculos(placa), motoristas!motorista_id(nome)').order('data', { ascending: false }),
    podeGerirFrotas(supabase),
  ])

  const lista = (multas ?? []) as MultaComRelacoes[]
  const soma = (f: (m: MultaComRelacoes) => boolean) =>
    lista.filter(f).reduce((s, m) => s + Number(m.valor), 0)

  // "a fazer" = ainda com o Frotas (registrada até cobrada); "em desconto" = solicitado/autorizado
  const totalAFazer = soma((m) => m.etapa !== 'contestada' && ordemEtapa(m.etapa) <= ordemEtapa('cobrada'))
  const totalEmDesconto = soma((m) => m.etapa === 'solicitado' || m.etapa === 'autorizado')

  return (
    <div className="p-4 md:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Multas</h1>
          <div className="flex flex-wrap gap-x-6 mt-2">
            <p className="text-[#4a6080] text-sm">R$ {totalAFazer.toFixed(2)} a fazer</p>
            <p className="text-[#4a6080] text-sm">R$ {totalEmDesconto.toFixed(2)} em desconto</p>
          </div>
        </div>
        <Link
          href="/sofia/multas/nova"
          className="px-4 py-2 rounded-lg bg-[#f05a28] text-white text-sm font-medium hover:bg-[#d94e22] transition-colors"
        >
          + Registrar Multa
        </Link>
      </div>

      <MultasTable multas={lista} podeGerir={podeGerir} hoje={hojeSP()} />
    </div>
  )
}
