import { createClient } from '@/lib/supabase/server'
import { getMotoristaDocumentos } from '@/lib/sofia/queries'
import { notFound } from 'next/navigation'
import { marcarTermoAssinadoAction } from './_actions'

export default async function MotoristaDetalhePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const [{ data: motorista }, documentos] = await Promise.all([
    supabase.from('motoristas').select('*, equipes(codigo)').eq('id', id).single(),
    getMotoristaDocumentos(id),
  ])

  if (!motorista) notFound()

  const termo = documentos.find(d => d.tipo === 'termo_uso')
  const autorizacoes = documentos.filter(d => d.tipo === 'autorizacao_desconto')

  return (
    <div className="p-8 max-w-2xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">{motorista.nome}</h1>
        <p className="text-[#4a6080] text-sm mt-1">CNH {motorista.cnh ?? '—'} · {motorista.equipes?.codigo ?? 'sem equipe'}</p>
      </div>

      <h2 className="text-sm font-medium text-[#4a6080] uppercase tracking-wider mb-3">Documentos assinados</h2>

      <div className="flex items-center justify-between p-4 rounded-xl border border-[#1e3a5f] bg-[#0d2050] mb-4">
        <div>
          <p className="text-white text-sm font-medium">Termo de Uso de Veículo</p>
          {termo?.assinado && <p className="text-[#4a6080] text-xs mt-1">Assinado em {new Date(termo.data_assinatura!).toLocaleDateString('pt-BR')}</p>}
        </div>
        <div className="flex items-center gap-3">
          <span className={`px-2 py-0.5 rounded text-xs font-medium ${termo?.assinado ? 'bg-green-900 text-green-300' : 'bg-red-900 text-red-300'}`}>
            {termo?.assinado ? 'Assinado' : 'Pendente'}
          </span>
          <form action={marcarTermoAssinadoAction.bind(null, id, !termo?.assinado)}>
            <button type="submit" className="text-xs text-[#f05a28] hover:underline">
              {termo?.assinado ? 'Marcar como pendente' : 'Marcar como assinado'}
            </button>
          </form>
        </div>
      </div>

      <h3 className="text-sm font-medium text-[#4a6080] uppercase tracking-wider mb-3 mt-6">Autorizações de desconto</h3>
      {autorizacoes.length === 0 ? (
        <p className="text-[#4a6080] text-sm">Nenhuma autorização registrada ainda — gerada ao validar uma multa ou sinistro.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {autorizacoes.map(a => (
            <div key={a.id} className="flex items-center justify-between px-4 py-3 rounded-lg border border-[#1e3a5f] bg-[#0d2050]">
              <span className="text-[#94a3b8] text-sm">{a.multa_id ? 'Multa' : 'Sinistro'} · {a.data_assinatura ? new Date(a.data_assinatura).toLocaleDateString('pt-BR') : '—'}</span>
              <span className={`px-2 py-0.5 rounded text-xs font-medium ${a.assinado ? 'bg-green-900 text-green-300' : 'bg-red-900 text-red-300'}`}>
                {a.assinado ? 'Assinada' : 'Pendente'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
