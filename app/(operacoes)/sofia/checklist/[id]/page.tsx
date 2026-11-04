import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { badgeChecklist } from '@/lib/sofia/checklistBadge'
import GaleriaFotos, { type FotoItem } from '@/components/sofia/GaleriaFotos'
import { rotuloTamanho } from '@/lib/sofia/fotosChecklist'

const ITENS_LABELS: Record<string, string> = {
  lataria_ok: 'Lataria',
  vidros_ok: 'Vidros',
  pneus_ok: 'Pneus',
  combustivel_ok: 'Combustível',
  itens_internos_ok: 'Itens internos',
  estepe_ok: 'Estepe',
  macaco_ok: 'Macaco',
  triangulo_ok: 'Triângulo',
}

export default async function ChecklistDetalhePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const [{ data: checklist }, { data: fotos }, { data: avarias }] = await Promise.all([
    supabase.from('checklist').select('*, equipes!equipe_id(codigo), veiculos(placa, modelo), motoristas!motorista_id(nome)').eq('id', id).single(),
    supabase.from('checklist_fotos').select('*').eq('checklist_id', id).order('created_at'),
    supabase
      .from('checklist_avarias')
      .select('id, peca, tamanho, acao, descricao, status, reparada_em')
      .eq('checklist_id', id)
      .order('created_at'),
  ])

  if (!checklist) notFound()

  const paths = (fotos ?? []).map((f) => f.storage_path)
  const { data: signed } =
    paths.length > 0
      ? await supabase.storage.from('checklist-fotos').createSignedUrls(paths, 3600)
      : { data: [] }

  const item = (f: { id: string; storage_path: string; posicao: string | null }): FotoItem => ({
    id: f.id,
    url: (signed ?? []).find((s) => s.path === f.storage_path)?.signedUrl ?? '',
    label: f.posicao ?? undefined,
  })
  const tipoDe = (f: { tipo_foto?: string | null; posicao: string | null }) =>
    f.tipo_foto ?? (f.posicao === 'Interna' ? 'interna' : 'obrigatoria')
  const todas = fotos ?? []
  const fotoItems = todas.filter((f) => ['obrigatoria', 'interna'].includes(tipoDe(f))).map(item).filter((f) => f.url)
  const extrasItems = todas.filter((f) => tipoDe(f) === 'extra').map(item).filter((f) => f.url)
  const fotosDaAvaria = (avariaId: string, tipo: string) =>
    todas.filter((f) => f.avaria_id === avariaId && tipoDe(f) === tipo).map(item).filter((f) => f.url)

  const badge = badgeChecklist(checklist.tipo)
  const itemKeys = Object.keys(ITENS_LABELS)
  const problemas = (checklist.itens_problemas as Record<string, string> | null) ?? {}

  return (
    <div className="p-4 md:p-8 max-w-2xl">
      <div className="flex items-center gap-3 mb-2">
        <span className={`px-2.5 py-1 rounded text-xs font-bold ${badge.style}`}>{badge.label}</span>
        <h1 className="text-2xl font-bold text-white font-mono">{checklist.veiculos?.placa ?? 'Sem veículo'}</h1>
      </div>
      <p className="text-[#4a6080] text-sm mb-8">
        {checklist.equipes?.codigo ?? '—'} · {checklist.motoristas?.nome ?? 'Motorista não informado'} ·{' '}
        {new Date(checklist.created_at).toLocaleString('pt-BR')}
      </p>

      <h2 className="text-sm font-medium text-[#4a6080] uppercase tracking-wider mb-3">Fotos</h2>
      <div className="mb-8">
        <GaleriaFotos fotos={fotoItems} />
      </div>

      {extrasItems.length > 0 && (
        <>
          <h2 className="text-sm font-medium text-[#4a6080] uppercase tracking-wider mb-3">Mais fotos</h2>
          <div className="mb-8">
            <GaleriaFotos fotos={extrasItems} />
          </div>
        </>
      )}

      {(avarias ?? []).length > 0 && (
        <>
          <h2 className="text-sm font-medium text-[#4a6080] uppercase tracking-wider mb-3">Avarias</h2>
          <div className="flex flex-col gap-3 mb-8">
            {(avarias ?? []).map((a) => (
              <div key={a.id} className="rounded-xl border border-[#1e3a5f] p-4 flex flex-col gap-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-white font-bold text-sm">{a.peca}</span>
                  <span
                    className={`px-2 py-0.5 rounded text-xs font-medium ${
                      a.status === 'reparada' ? 'bg-green-900 text-green-300' : 'bg-amber-900 text-amber-300'
                    }`}
                  >
                    {a.status === 'reparada'
                      ? `reparada${a.reparada_em ? ` em ${new Date(a.reparada_em).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })}` : ''}`
                      : 'aberta'}
                  </span>
                </div>
                <p className="text-xs text-[#94a3b8]">
                  {rotuloTamanho(a.tamanho)} · {a.acao === 'reparo' ? 'Reparo' : a.acao === 'troca' ? 'Troca' : 'reparo ou troca: a definir'}
                </p>
                {a.descricao && <p className="text-sm text-[#94a3b8]">{a.descricao}</p>}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs text-[#4a6080] mb-1">Foto da peça</p>
                    <GaleriaFotos fotos={fotosDaAvaria(a.id, 'avaria_peca')} />
                  </div>
                  <div>
                    <p className="text-xs text-[#4a6080] mb-1">Foto da avaria</p>
                    <GaleriaFotos fotos={fotosDaAvaria(a.id, 'avaria_dano')} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <h2 className="text-sm font-medium text-[#4a6080] uppercase tracking-wider mb-3">Itens verificados</h2>
      <div className="flex flex-col gap-2 mb-8">
        {itemKeys.map((key) => {
          const status = checklist[key] as boolean | null
          const descricao = problemas[key]
          return (
            <div key={key} className="flex items-start justify-between gap-3 px-3 py-2.5 rounded-lg border border-[#1e3a5f]">
              <span className="text-sm text-[#94a3b8]">{ITENS_LABELS[key]}</span>
              <div className="text-right">
                <span
                  className={`text-xs font-bold ${
                    status === true ? 'text-green-400' : status === false ? 'text-amber-400' : 'text-[#4a6080]'
                  }`}
                >
                  {status === true ? '✓ OK' : status === false ? '⚠ Problema' : '— Não respondido'}
                </span>
                {descricao && <p className="text-[#4a6080] text-xs mt-1 max-w-xs">{descricao}</p>}
              </div>
            </div>
          )
        })}
      </div>

      <h2 className="text-sm font-medium text-[#4a6080] uppercase tracking-wider mb-3">Registro</h2>
      <div className="rounded-xl border border-[#1e3a5f] bg-[#0d2050] p-4 flex flex-col gap-1.5 text-sm">
        <p className="text-[#94a3b8]">Chave entregue: <span className="text-white">{checklist.chave_entregue ? 'Sim' : 'Não'}</span></p>
        <p className="text-[#94a3b8]">Cartão combustível entregue: <span className="text-white">{checklist.cartao_combustivel_entregue ? 'Sim' : 'Não'}</span></p>
        <p className="text-[#94a3b8]">Assinatura do motorista: <span className="text-white">{checklist.assinatura_motorista ? 'Confirmada' : 'Não confirmada'}</span></p>
        {checklist.avaria_identificada && (
          <p className="text-amber-400">Avaria identificada: {checklist.avaria_descricao ?? '—'}</p>
        )}
        {checklist.observacoes && (
          <p className="text-[#94a3b8]">Observações: <span className="text-white">{checklist.observacoes}</span></p>
        )}
      </div>
    </div>
  )
}
