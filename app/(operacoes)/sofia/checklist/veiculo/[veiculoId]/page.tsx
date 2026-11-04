import type { ReactNode } from 'react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { podeGerirFrotas } from '@/lib/sofia/permissoes'
import { badgeChecklist } from '@/lib/sofia/checklistBadge'
import { hojeSP } from '@/lib/sofia/multaEtapas'
import { rotuloTamanho } from '@/lib/sofia/fotosChecklist'
import {
  baseDoVeiculo,
  diffChecklists,
  escolhaPadrao,
  ordenarAntesDepois,
  type AvariaHist,
  type ChecklistHist,
} from '@/lib/sofia/checklistHistorico'
import CompararFotos, { type ParFotos } from '@/components/sofia/CompararFotos'
import GaleriaFotos, { type FotoItem } from '@/components/sofia/GaleriaFotos'
import { FOTO_POSICOES_OBRIGATORIAS } from '../../_validation'
import { AcaoAvaria, BaixaAvaria } from './_avarias'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

type Linha = ChecklistHist & { tipo: string; motoristas: { nome: string } | null }
interface AvariaLinha {
  id: string
  checklist_id: string
  peca: string
  tamanho: string
  acao: string | null
  descricao: string | null
  status: string
  reparada_em: string | null
}
interface FotoLinha {
  id: string
  checklist_id: string
  storage_path: string
  posicao: string | null
  tipo_foto: string | null
}

const fmt = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })
const DIFF_COR: Record<string, string> = {
  item_piorou: 'text-red-300',
  avaria_nova: 'text-red-300',
  item_melhorou: 'text-green-300',
  avaria_resolvida: 'text-green-300',
  avaria_continua: 'text-[#94a3b8]',
}

export default async function HistoricoVeiculoPage({
  params,
  searchParams,
}: {
  params: Promise<{ veiculoId: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { veiculoId } = await params
  const sp = await searchParams
  if (!UUID_RE.test(veiculoId)) notFound()
  const supabase = await createClient()

  const [{ data: veiculo }, { data: checklistsRaw }, podeGerir] = await Promise.all([
    supabase.from('veiculos').select('id, placa, modelo').eq('id', veiculoId).single(),
    supabase
      .from('checklist')
      .select(
        'id, data, tipo, lataria_ok, vidros_ok, pneus_ok, combustivel_ok, itens_internos_ok, estepe_ok, macaco_ok, triangulo_ok, motoristas!motorista_id(nome)'
      )
      .eq('veiculo_id', veiculoId)
      .order('data', { ascending: false }),
    podeGerirFrotas(supabase),
  ])
  if (!veiculo) notFound()

  const checklists = (checklistsRaw ?? []) as unknown as Linha[]
  const ids = checklists.map((c) => c.id)
  const { data: avariasRaw } =
    ids.length > 0
      ? await supabase
          .from('checklist_avarias')
          .select('id, checklist_id, peca, tamanho, acao, descricao, status, reparada_em')
          .in('checklist_id', ids)
          .order('created_at')
      : { data: [] }
  const avarias = (avariasRaw ?? []) as AvariaLinha[]
  const dataDoChecklist = new Map(checklists.map((c) => [c.id, c.data]))
  const avariasHist: (AvariaHist & AvariaLinha)[] = avarias.map((a) => ({
    ...a,
    registrada_em: dataDoChecklist.get(a.checklist_id) ?? a.reparada_em ?? '',
  }))
  const qtdAvarias = (id: string) => avarias.filter((a) => a.checklist_id === id).length

  const base = baseDoVeiculo(checklists)
  const padrao = escolhaPadrao(checklists)
  // parâmetros de URL: só uuid de checklist DESTE veículo; senão, o padrão
  const doVeiculo = (v: unknown) => (typeof v === 'string' && UUID_RE.test(v) ? checklists.find((c) => c.id === v) : undefined)
  const a = doVeiculo(sp.a) ?? padrao?.a
  const b = doVeiculo(sp.b) ?? padrao?.b
  const modo = sp.modo === 'sobre' ? 'sobre' : 'lado'

  let comparacao: ReactNode = null
  if (a && b) {
    if (a.id === b.id) {
      comparacao = <p className="text-sm text-amber-300 mt-3">Escolha dois checklists diferentes.</p>
    } else {
      const { antes, depois, reordenado } = ordenarAntesDepois(a, b)
      const { data: fotosRaw } = await supabase
        .from('checklist_fotos')
        .select('id, checklist_id, storage_path, posicao, tipo_foto')
        .in('checklist_id', [antes.id, depois.id])
      const fotos = (fotosRaw ?? []) as FotoLinha[]
      const { data: assinadas } =
        fotos.length > 0
          ? await supabase.storage.from('checklist-fotos').createSignedUrls(fotos.map((f) => f.storage_path), 3600)
          : { data: [] }
      const url = (f: FotoLinha) => (assinadas ?? []).find((s) => s.path === f.storage_path)?.signedUrl ?? null
      const daPosicao = (cid: string, p: string) => {
        const f = fotos.find((x) => x.checklist_id === cid && x.posicao === p)
        return f ? url(f) : null
      }
      const pares: ParFotos[] = FOTO_POSICOES_OBRIGATORIAS.map((p) => ({
        posicao: p,
        antes: daPosicao(antes.id, p),
        depois: daPosicao(depois.id, p),
      }))
      const obrig = new Set<string>(FOTO_POSICOES_OBRIGATORIAS)
      const outras = (cid: string): FotoItem[] =>
        fotos
          .filter((f) => f.checklist_id === cid && !obrig.has(f.posicao ?? ''))
          .map((f) => ({ id: f.id, url: url(f) ?? '', label: f.posicao ?? undefined }))
          .filter((f) => f.url)
      const diff = diffChecklists(antes, depois, avariasHist)

      comparacao = (
        <>
          {reordenado && (
            <p className="text-xs text-[#94a3b8] mt-3">As datas foram ordenadas: &quot;antes&quot; é sempre o mais antigo.</p>
          )}
          <div className="grid grid-cols-1 lg:grid-cols-[3fr_2fr] gap-4 mt-3">
            <CompararFotos
              key={`${antes.id}-${depois.id}`}
              pares={pares}
              rotuloAntes={fmt(antes.data)}
              rotuloDepois={fmt(depois.data)}
              modoInicial={modo}
            />
            <div className="rounded-xl border border-[#1e3a5f] bg-[#0d2050] p-4 h-fit">
              <p className="text-sm text-white font-bold">O que mudou (automático, só dos dados)</p>
              <p className="text-xs text-[#4a6080]">Compara os itens e as avarias cadastradas; não compara imagens.</p>
              {diff.length === 0 ? (
                <p className="text-sm text-[#94a3b8] mt-2">Nenhuma diferença nos itens e nas avarias.</p>
              ) : (
                <ul className="mt-2 flex flex-col gap-1 list-disc pl-4">
                  {diff.map((d, i) => (
                    <li key={i} className={`text-sm ${DIFF_COR[d.tipo]}`}>
                      {d.texto}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
            <div>
              <p className="text-xs text-[#4a6080] mb-1">Outras fotos · {fmt(antes.data)}</p>
              <GaleriaFotos fotos={outras(antes.id)} />
            </div>
            <div>
              <p className="text-xs text-[#4a6080] mb-1">Outras fotos · {fmt(depois.data)}</p>
              <GaleriaFotos fotos={outras(depois.id)} />
            </div>
          </div>
        </>
      )
    }
  }

  const abertas = avarias.filter((x) => x.status === 'aberta')
  const hoje = hojeSP()
  const opcao = (c: Linha) => (
    <option key={c.id} value={c.id}>
      {fmt(c.data)} · {badgeChecklist(c.tipo).label}
    </option>
  )

  return (
    <div className="p-4 md:p-8 max-w-5xl">
      <Link href="/sofia/checklist" className="text-sm text-[#94a3b8] hover:underline">
        ← Checklists
      </Link>
      <h1 className="text-2xl font-bold text-white mt-3">
        Histórico do checklist · <span className="font-mono">{veiculo.placa}</span>
      </h1>
      <p className="text-[#4a6080] text-sm mb-6">{veiculo.modelo}</p>

      <div className="rounded-xl border border-[#1e3a5f] overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#1e3a5f] bg-[#0d2050]">
              <th className="text-left px-4 py-3 text-[#4a6080] font-medium">Data</th>
              <th className="text-left px-4 py-3 text-[#4a6080] font-medium">Tipo</th>
              <th className="text-left px-4 py-3 text-[#4a6080] font-medium">Motorista</th>
              <th className="text-left px-4 py-3 text-[#4a6080] font-medium">Avarias</th>
            </tr>
          </thead>
          <tbody>
            {checklists.map((c) => (
              <tr key={c.id} className="border-b border-[#1e3a5f]">
                <td className="px-4 py-3 text-[#94a3b8] whitespace-nowrap">
                  <Link href={`/sofia/checklist/${c.id}`} className="hover:underline">
                    {fmt(c.data)}
                  </Link>
                </td>
                <td className="px-4 py-3 text-white">
                  {badgeChecklist(c.tipo).label}
                  {base?.id === c.id && (
                    <span className="ml-2 px-1.5 py-0.5 rounded text-[10px] bg-[#1e3a5f] text-[#94a3b8]">base</span>
                  )}
                </td>
                <td className="px-4 py-3 text-[#94a3b8]">{c.motoristas?.nome ?? '—'}</td>
                <td className="px-4 py-3 text-[#94a3b8]">{qtdAvarias(c.id) || '—'}</td>
              </tr>
            ))}
            {checklists.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-[#4a6080]">
                  Nenhum checklist deste veículo.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {checklists.length >= 2 && (
        <>
          <h2 className="text-lg font-bold text-white mt-8">Comparar dois checklists do mesmo veículo</h2>
          <form method="get" className="flex flex-wrap items-end gap-3 mt-3">
            <label className="flex flex-col gap-1 min-w-[150px] flex-1">
              <span className="text-xs text-[#94a3b8]">Antes</span>
              <select name="a" defaultValue={a?.id} className="px-3 py-2 rounded-lg bg-[#0f1f3d] border border-[#1e3a5f] text-white text-sm">
                {checklists.map(opcao)}
              </select>
            </label>
            <label className="flex flex-col gap-1 min-w-[150px] flex-1">
              <span className="text-xs text-[#94a3b8]">Depois</span>
              <select name="b" defaultValue={b?.id} className="px-3 py-2 rounded-lg bg-[#0f1f3d] border border-[#1e3a5f] text-white text-sm">
                {checklists.map(opcao)}
              </select>
            </label>
            <input type="hidden" name="modo" value={modo} />
            <button type="submit" className="px-4 py-2 rounded-lg bg-[#f05a28] text-white text-sm font-medium hover:bg-[#d94e22]">
              Comparar
            </button>
            {base && b && (
              <Link
                href={`/sofia/checklist/veiculo/${veiculoId}?a=${base.id}&b=${b.id}&modo=${modo}`}
                className="px-4 py-2 rounded-lg border border-[#1e3a5f] text-[#94a3b8] text-sm hover:border-[#94a3b8]"
              >
                Comparar com a entrada (base)
              </Link>
            )}
          </form>
          {comparacao}
        </>
      )}

      <h2 className="text-lg font-bold text-white mt-8">Avarias abertas</h2>
      {abertas.length === 0 ? (
        <p className="text-sm text-[#94a3b8] mt-2">Nenhuma avaria aberta neste veículo.</p>
      ) : (
        <div className="flex flex-col gap-3 mt-3">
          {abertas.map((x) => (
            <div key={x.id} className="rounded-xl border border-[#1e3a5f] p-4 flex flex-col gap-2">
              <div className="flex flex-wrap justify-between gap-2">
                <span className="text-white font-bold text-sm">{x.peca}</span>
                <span className="text-xs text-[#94a3b8]">
                  registrada em {fmt(dataDoChecklist.get(x.checklist_id) ?? '')}
                </span>
              </div>
              <p className="text-xs text-[#94a3b8]">
                {rotuloTamanho(x.tamanho)} · {x.acao === 'reparo' ? 'Reparo' : x.acao === 'troca' ? 'Troca' : 'reparo ou troca: a definir'}
              </p>
              {x.descricao && <p className="text-sm text-[#94a3b8]">{x.descricao}</p>}
              <AcaoAvaria id={x.id} acao={x.acao} podeGerir={podeGerir} />
              <BaixaAvaria id={x.id} hoje={hoje} podeGerir={podeGerir} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
