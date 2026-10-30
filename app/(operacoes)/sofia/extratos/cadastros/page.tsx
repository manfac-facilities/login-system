import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { podeGerirFrotas } from '@/lib/sofia/permissoes'
import {
  centroCustoVigente,
  getCentrosCusto,
  getEquipesExtrato,
  getGastos,
  getLigacoes,
  getOpcoesEquipe,
  hojeSP,
  rotuloCentroCusto,
} from '@/lib/sofia/extratos/leituras'
import { agruparSemCentroCusto, brl, dataBR, ligacaoVigente, mascararCartao, type Ligacao } from '@/lib/sofia/extratos/agrupar'
import { BotaoCentroCusto, BotaoEncerrar, BotaoLigacao } from '../_form'

const ABAS = [
  ['cartoes', 'Cartões Ticketlog'],
  ['tags', 'Tags Veloe'],
  ['cc', 'Equipe → centro de custo'],
] as const

const busca =
  'w-full max-w-md px-4 py-2.5 rounded-lg bg-[#0f1f3d] border border-[#1e3a5f] text-white placeholder-[#4a6080] focus:outline-none focus:border-[#f05a28] text-sm'

export default async function CadastrosPage({
  searchParams,
}: {
  searchParams: Promise<{ aba?: string; q?: string }>
}) {
  const { aba: abaParam, q } = await searchParams
  const aba = ABAS.find(([k]) => k === abaParam)?.[0] ?? 'cartoes'
  const termo = (q ?? '').trim().toLowerCase()
  const supabase = await createClient()
  const podeGerir = await podeGerirFrotas(supabase)

  return (
    <div className="p-4 md:p-8">
      <h1 className="text-2xl font-bold text-white mb-1">Cadastros</h1>
      <p className="text-[#94a3b8] text-sm mb-6">
        Ligações que dizem de qual equipe e de qual centro de custo do Omie é cada gasto. Trocar uma ligação vale a
        partir da data escolhida; o passado continua como estava.
      </p>
      {!podeGerir && (
        <p className="rounded-xl border border-[#1e3a5f] bg-[#0d2050] p-3 mb-4 text-sm text-[#94a3b8]">
          Você pode consultar os cadastros. Mexer neles é só para o gestor de frotas e para o admin.
        </p>
      )}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-4">
        {ABAS.map(([k, t]) => (
          <Link
            key={k}
            href={`/sofia/extratos/cadastros?aba=${k}`}
            className={`px-3.5 py-2 rounded-lg text-sm whitespace-nowrap border ${aba === k ? 'bg-[#f05a28] border-[#f05a28] text-white' : 'border-[#1e3a5f] text-[#94a3b8] hover:text-white'}`}
          >
            {t}
          </Link>
        ))}
      </div>
      <form action="/sofia/extratos/cadastros" className="mb-4">
        <input type="hidden" name="aba" value={aba} />
        <input type="text" name="q" defaultValue={q} placeholder="Buscar..." className={busca} />
      </form>
      {aba === 'cc' ? (
        <AbaCentroCusto termo={termo} podeGerir={podeGerir} />
      ) : (
        <AbaLigacoes plataforma={aba === 'cartoes' ? 'ticketlog' : 'veloe'} termo={termo} podeGerir={podeGerir} />
      )}
    </div>
  )
}

async function AbaLigacoes({
  plataforma,
  termo,
  podeGerir,
}: {
  plataforma: 'ticketlog' | 'veloe'
  termo: string
  podeGerir: boolean
}) {
  const ehCartao = plataforma === 'ticketlog'
  const hoje = hojeSP()
  const [ligacoes, gastos, equipes, opcoes] = await Promise.all([
    getLigacoes(plataforma),
    getGastos({ plataforma }),
    getEquipesExtrato(),
    getOpcoesEquipe(),
  ])
  const nomeEquipe = (id: string | null) => (id ? (equipes.find((e) => e.id === id)?.codigo ?? '—') : '—')
  const mostra = (id: string) => (ehCartao ? mascararCartao(id) : id)

  // Identificadores vistos nos extratos sem equipe na data de uso
  const semEquipe = agruparSemCentroCusto(gastos).filter((g) => g.motivo === 'sem_equipe')
  const placa = new Map<string, string>() // gastos vêm do mais recente: a primeira placa vista é a última
  for (const g of gastos) if (g.placa && !placa.has(g.identificador)) placa.set(g.identificador, g.placa)

  const historico = new Map<string, Ligacao[]>()
  for (const l of ligacoes) historico.set(l.identificador, [...(historico.get(l.identificador) ?? []), l])
  const itens = [...historico.entries()]
    .map(([id, h]) => ({
      id,
      historico: [...h].sort((a, b) => (a.vigente_desde + a.criado_em).localeCompare(b.vigente_desde + b.criado_em)),
      atual: ligacaoVigente(h, hoje),
    }))
    .filter((i) => {
      if (!termo) return true
      const eq = i.atual ? nomeEquipe(i.atual.equipe_id) : ''
      return `${i.id} ${eq} ${placa.get(i.id) ?? ''}`.toLowerCase().includes(termo)
    })
    .sort((a, b) => a.id.localeCompare(b.id))

  return (
    <>
      {semEquipe.length === 0 ? (
        <p className="rounded-xl border border-green-800 bg-green-900/20 text-green-300 text-sm px-4 py-3 mb-4">
          {ehCartao ? 'Todos os cartões' : 'Todas as tags'} que aparecem nos extratos já têm equipe.
        </p>
      ) : (
        <div className="rounded-xl border border-amber-700 bg-amber-900/20 p-4 mb-4">
          <p className="text-amber-300 text-sm font-semibold mb-1">
            {semEquipe.length} {ehCartao ? 'cartão(ões)' : 'tag(s)'} apareceram nos extratos e ainda não têm equipe
          </p>
          <p className="text-[#94a3b8] text-xs mb-3">
            Os gastos deles ficam em “Sem centro de custo” até você ligar a uma equipe.
          </p>
          <div className="flex flex-col gap-2">
            {semEquipe.map((g) => (
              <div key={g.identificador} className="flex flex-wrap items-center justify-between gap-2 bg-[#0a1628]/60 rounded-lg px-3 py-2">
                <div>
                  <span className="text-white text-sm tabular-nums">{mostra(g.identificador)}</span>
                  {!ehCartao && placa.get(g.identificador) && (
                    <span className="text-[#94a3b8] text-xs ml-2">placa no extrato: {placa.get(g.identificador)}</span>
                  )}
                  <div className="text-[#94a3b8] text-xs">
                    {g.gastos} gastos · {brl(g.totalCentavos / 100)} · último em {dataBR(g.ultimaData)}
                  </div>
                </div>
                {podeGerir && (
                  <BotaoLigacao
                    primario
                    rotulo="Ligar a uma equipe"
                    plataforma={plataforma}
                    identificador={g.identificador}
                    mascara={mostra(g.identificador)}
                    equipes={opcoes}
                    desdeSugerida={g.primeiraData}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <h2 className="text-white font-semibold">
          {ehCartao ? 'Cartões' : 'Tags'} ligados ({historico.size})
        </h2>
        {podeGerir && (
          <BotaoLigacao
            primario
            rotulo={ehCartao ? '+ Novo cartão' : '+ Nova tag'}
            plataforma={plataforma}
            identificador={null}
            equipes={opcoes}
            desdeSugerida="2026-08-01"
          />
        )}
      </div>
      {itens.length === 0 ? (
        <p className="px-4 py-12 text-center text-[#94a3b8] rounded-xl border border-dashed border-[#1e3a5f]">
          {termo ? 'Nada encontrado.' : `Nenhum ${ehCartao ? 'cartão' : 'tag'} cadastrado ainda.`}
        </p>
      ) : (
        <div className="rounded-xl border border-[#1e3a5f] bg-[#0d2050] divide-y divide-[#12294d]">
          {itens.map((i) => (
            <div key={i.id} className="px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="text-white tabular-nums">{mostra(i.id)}</div>
                  {!ehCartao && (
                    <div className="text-xs text-[#94a3b8]">Placa (só informativa): {placa.get(i.id) ?? '—'}</div>
                  )}
                </div>
                <div className="flex items-center gap-3 flex-wrap text-sm">
                  {i.atual && i.atual.equipe_id === null ? (
                    <span className="px-2.5 py-0.5 rounded-full bg-[#1e3a5f] text-[#94a3b8] text-xs">
                      Encerrada em {dataBR(i.atual.vigente_desde)}
                    </span>
                  ) : i.atual ? (
                    <>
                      <span className="px-2.5 py-0.5 rounded-full bg-[#1e3a5f] text-white text-xs">{nomeEquipe(i.atual.equipe_id)}</span>
                      <span className="text-xs text-[#94a3b8]">desde {dataBR(i.atual.vigente_desde)}</span>
                    </>
                  ) : (
                    <span className="text-xs text-amber-300">ainda não vigente</span>
                  )}
                  {podeGerir && i.atual && i.atual.equipe_id !== null && (
                    <BotaoEncerrar
                      plataforma={plataforma}
                      identificador={i.id}
                      mascara={mostra(i.id)}
                      equipe={nomeEquipe(i.atual.equipe_id)}
                      desdeSugerida={hoje}
                    />
                  )}
                  {podeGerir && (
                    <BotaoLigacao
                      rotulo={i.atual && i.atual.equipe_id === null ? 'Religar a uma equipe' : 'Trocar equipe'}
                      plataforma={plataforma}
                      identificador={i.id}
                      mascara={mostra(i.id)}
                      equipes={opcoes}
                      equipeAtualId={i.atual?.equipe_id ?? undefined}
                      desdeSugerida={hoje}
                    />
                  )}
                </div>
              </div>
              {i.historico.length > 1 && (
                <details className="mt-2 text-xs text-[#94a3b8]">
                  <summary className="cursor-pointer hover:text-white">Ver histórico ({i.historico.length})</summary>
                  <ul className="mt-1 ml-1 border-l-2 border-[#1e3a5f] pl-3 space-y-1">
                    {[...i.historico].reverse().map((l) => (
                      <li key={l.vigente_desde + l.criado_em}>
                        a partir de {dataBR(l.vigente_desde)}:{' '}
                        <span className="text-[#cbd5e1]">{l.equipe_id === null ? 'ligação encerrada' : nomeEquipe(l.equipe_id)}</span>
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          ))}
        </div>
      )}
      {!ehCartao && (
        <p className="text-xs text-[#4a6080] mt-3">A placa é só para o gestor reconhecer o veículo. Quem manda é a tag.</p>
      )}
    </>
  )
}

async function AbaCentroCusto({ termo, podeGerir }: { termo: string; podeGerir: boolean }) {
  const [equipes, centros] = await Promise.all([getEquipesExtrato(), getCentrosCusto()])
  const hoje = hojeSP()
  const linhas = equipes
    .map((e) => {
      const hist = centros
        .filter((c) => c.equipe_id === e.id)
        .sort((a, b) => (a.vigente_desde + a.criado_em).localeCompare(b.vigente_desde + b.criado_em))
      return { equipe: e, hist, atual: centroCustoVigente(centros, e.id, hoje) }
    })
    .filter((l) => !termo || `${l.equipe.codigo} ${rotuloCentroCusto(l.atual) ?? ''}`.toLowerCase().includes(termo))
  const semCC = equipes.filter((e) => !centroCustoVigente(centros, e.id, hoje))

  return (
    <>
      {semCC.length > 0 && (
        <p className="rounded-xl border border-amber-700 bg-amber-900/20 p-4 mb-4 text-sm text-amber-300">
          {semCC.length} equipe(s) sem centro de custo: {semCC.map((e) => e.codigo).join(', ')}. Os gastos delas ficam em
          “Sem centro de custo”.
        </p>
      )}
      <h2 className="text-white font-semibold mb-1">Centro de custo do Omie por equipe</h2>
      <p className="text-xs text-[#94a3b8] mb-3">
        Trocar o centro de custo cria uma linha nova com a data de início. A linha anterior não é apagada, e os gastos
        antigos continuam no centro de custo que valia na data de uso.
      </p>
      <div className="rounded-xl border border-[#1e3a5f] bg-[#0d2050] divide-y divide-[#12294d]">
        {linhas.map(({ equipe, hist, atual }) => (
          <div key={equipe.id} className="px-4 py-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="text-white font-semibold">{equipe.codigo}</div>
                <div className="text-sm text-[#cbd5e1]">
                  {atual ? (
                    <>
                      {rotuloCentroCusto(atual)}
                      <span className="text-[#94a3b8] text-xs"> · vigente desde {dataBR(atual.vigente_desde)}</span>
                    </>
                  ) : (
                    <span className="text-amber-400">sem centro de custo</span>
                  )}
                </div>
              </div>
              {podeGerir && (
                <BotaoCentroCusto
                  rotulo={atual ? 'Trocar' : 'Definir'}
                  equipe={{ id: equipe.id, codigo: equipe.codigo }}
                  atual={rotuloCentroCusto(atual)}
                  desdeSugerida={hoje}
                />
              )}
            </div>
            {hist.length > 1 && (
              <details className="mt-2 text-xs text-[#94a3b8]">
                <summary className="cursor-pointer hover:text-white">Ver histórico ({hist.length})</summary>
                <ul className="mt-1 ml-1 border-l-2 border-[#1e3a5f] pl-3 space-y-1">
                  {[...hist].reverse().map((c) => (
                    <li key={c.vigente_desde + c.criado_em}>
                      a partir de {dataBR(c.vigente_desde)}: <span className="text-[#cbd5e1]">{c.codigo} - {c.nome}</span>
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        ))}
        {linhas.length === 0 && <p className="p-4 text-sm text-[#94a3b8]">Nada encontrado.</p>}
      </div>
    </>
  )
}
