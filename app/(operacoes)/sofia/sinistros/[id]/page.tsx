import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import TratativaForm from './_form'

export default async function SinistroDetalhePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const [{ data: sinistro }, { data: fotos }] = await Promise.all([
    supabase.from('sinistros').select('*, veiculos(placa, modelo), motoristas(nome)').eq('id', id).single(),
    supabase.from('sinistro_fotos').select('*').eq('sinistro_id', id),
  ])

  if (!sinistro) notFound()

  return (
    <div className="p-8 max-w-2xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">{sinistro.veiculos?.placa ?? 'Sem veículo'}</h1>
        <p className="text-[#4a6080] text-sm mt-1">
          {new Date(sinistro.data).toLocaleDateString('pt-BR')} · {sinistro.motoristas?.nome ?? 'sem motorista'}
        </p>
      </div>

      <p className="text-white text-sm mb-6">{sinistro.descricao}</p>

      {(fotos ?? []).length > 0 && (
        <div className="mb-8">
          <h2 className="text-sm font-medium text-[#4a6080] uppercase tracking-wider mb-3">Fotos</h2>
          <p className="text-[#4a6080] text-xs">{(fotos ?? []).length} foto(s) anexada(s)</p>
        </div>
      )}

      <h2 className="text-sm font-medium text-[#4a6080] uppercase tracking-wider mb-3">Tratativa</h2>
      <TratativaForm sinistro={sinistro} />
    </div>
  )
}
