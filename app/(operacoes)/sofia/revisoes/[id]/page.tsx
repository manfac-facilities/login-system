import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import type { Revisao } from '@/lib/sofia/types'
import { situacaoRevisaoView, formatarKm, formatarDataIso, type RevisaoTom } from '@/lib/sofia/revisaoStatus'

type RevisaoDetalhe = Revisao & {
  veiculos: { placa: string; modelo: string | null; km_atual: number | null } | null
  motoristas: { nome: string } | null
}

const tomStyle: Record<RevisaoTom, string> = {
  verde: 'bg-green-900 text-green-300',
  ambar: 'bg-amber-900 text-amber-300',
  vermelho: 'bg-red-900 text-red-300',
  neutro: 'text-[#4a6080]',
}

const tomTexto: Record<RevisaoTom, string> = {
  verde: 'text-green-300',
  ambar: 'text-amber-300',
  vermelho: 'text-red-300',
  neutro: 'text-[#4a6080]',
}

const voltar = (
  <Link href="/sofia/revisoes" className="text-[#4a6080] text-sm hover:text-white transition-colors">
    ← Voltar para revisões
  </Link>
)

export default async function RevisaoDetalhePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('revisoes')
    .select('*, veiculos(placa, modelo, km_atual), motoristas(nome)')
    .eq('id', id)
    .maybeSingle()
  // Erro de consulta vai para o error boundary do módulo; "não encontrada" é só quando a consulta deu certo e veio vazia.
  if (error) throw new Error('Não foi possível carregar a revisão')

  if (!data) {
    return (
      <div className="p-8 max-w-2xl">
        {voltar}
        <div className="mt-6 flex items-start gap-4 p-5 rounded-xl border border-[#1e3a5f] bg-[#0d2050]">
          <span className="text-2xl">🔍</span>
          <div>
            <h1 className="text-white font-semibold">Revisão não encontrada</h1>
            <p className="text-[#94a3b8] text-sm mt-1">
              Ela pode ter sido excluída por um administrador. Volte para a lista de revisões.
            </p>
          </div>
        </div>
      </div>
    )
  }

  const r = data as RevisaoDetalhe
  const hoje = new Date().toISOString().split('T')[0]
  const sit = situacaoRevisaoView(r, r.veiculos?.km_atual, hoje)
  const temPrevisao = r.proxima_km != null || r.proxima_data != null
  const previsao = [
    r.proxima_km != null ? `${formatarKm(r.proxima_km)} km` : null,
    r.proxima_data ? formatarDataIso(r.proxima_data) : null,
  ].filter(Boolean)
  const tipo = r.tipo === 'preventiva' ? 'Preventiva' : 'Corretiva'
  const placa = r.veiculos?.placa ?? 'Sem veículo'

  return (
    <div className="p-8 max-w-2xl">
      {voltar}
      <div className="mb-8 mt-4">
        <h1 className="text-2xl font-bold text-white font-mono">{placa}</h1>
        <p className="text-[#4a6080] text-sm mt-1">
          {[r.veiculos?.modelo, tipo, r.data_realizada ? formatarDataIso(r.data_realizada) : null, r.motoristas?.nome ?? 'sem motorista']
            .filter(Boolean)
            .join(' · ')}
        </p>
      </div>

      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-5 mb-8">
        <div>
          <dt className="text-xs text-[#4a6080] uppercase tracking-wider">Veículo</dt>
          <dd className="text-white text-sm mt-1">
            <span className="font-mono">{placa}</span>
            {r.veiculos?.modelo && <span className="text-[#4a6080]"> · {r.veiculos.modelo}</span>}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-[#4a6080] uppercase tracking-wider">Tipo</dt>
          <dd className="text-white text-sm mt-1">{tipo}</dd>
        </div>
        <div>
          <dt className="text-xs text-[#4a6080] uppercase tracking-wider">Realizada em</dt>
          <dd className="text-white text-sm mt-1">{r.data_realizada ? formatarDataIso(r.data_realizada) : '—'}</dd>
        </div>
        <div>
          <dt className="text-xs text-[#4a6080] uppercase tracking-wider">KM na revisão</dt>
          <dd className="text-white text-sm mt-1">{r.km_realizada != null ? `${formatarKm(r.km_realizada)} km` : '—'}</dd>
        </div>
        <div>
          <dt className="text-xs text-[#4a6080] uppercase tracking-wider">Fornecedor</dt>
          <dd className="text-white text-sm mt-1">{r.fornecedor ?? '—'}</dd>
        </div>
        <div>
          <dt className="text-xs text-[#4a6080] uppercase tracking-wider">Valor</dt>
          <dd className="text-white text-sm mt-1">
            {r.valor != null
              ? `R$ ${Number(r.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
              : '—'}
          </dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-xs text-[#4a6080] uppercase tracking-wider">Peças trocadas</dt>
          {r.pecas_trocadas ? (
            <dd className="text-white text-sm mt-1 whitespace-pre-line">{r.pecas_trocadas}</dd>
          ) : (
            <dd className="text-[#4a6080] text-sm mt-1">
              Nenhuma peça registrada nesta revisão.
              <span className="block text-xs">Revisão lançada antes de existir o campo &quot;Peças trocadas&quot;.</span>
            </dd>
          )}
        </div>
        <div className="sm:col-span-2">
          <dt className="text-xs text-[#4a6080] uppercase tracking-wider">Observações</dt>
          <dd className={`text-sm mt-1 whitespace-pre-line ${r.observacoes ? 'text-white' : 'text-[#4a6080]'}`}>
            {r.observacoes || 'Sem observações.'}
          </dd>
        </div>
      </dl>

      <h2 className="text-sm font-medium text-[#4a6080] uppercase tracking-wider mb-3">Próxima revisão</h2>
      <div className="flex items-center justify-between gap-3 flex-wrap p-4 rounded-xl border border-[#1e3a5f] bg-[#0d2050]">
        <div className="text-sm">
          {temPrevisao ? (
            <>
              <div className="text-white">{previsao.join(' ou ')}</div>
              {sit.dicas.map((d) => (
                <span key={d.texto} className={`block text-xs ${tomTexto[d.tom]}`}>{d.texto}</span>
              ))}
              {r.proxima_km != null && r.veiculos?.km_atual != null && (
                <span className="block text-xs text-[#4a6080]">KM atual do veículo: {formatarKm(r.veiculos.km_atual)} km</span>
              )}
            </>
          ) : (
            <span className="text-xs text-[#4a6080]">Sem próxima revisão prevista.</span>
          )}
        </div>
        {temPrevisao && (
          <span className={`px-2 py-0.5 rounded text-xs font-medium ${tomStyle[sit.tom]}`}>{sit.label}</span>
        )}
      </div>
    </div>
  )
}
