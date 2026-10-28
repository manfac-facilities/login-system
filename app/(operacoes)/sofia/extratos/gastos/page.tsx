import Link from 'next/link'
import { getCentrosCusto, getEquipesExtrato, getGastos } from '@/lib/sofia/extratos/leituras'
import { brl, dataBR } from '@/lib/sofia/extratos/agrupar'

const PAGE_SIZE = 25
const DATA = /^\d{4}-\d{2}-\d{2}$/
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

type SP = { plataforma?: string; equipe?: string; cc?: string; de?: string; ate?: string; limit?: string }

const fld =
  'w-full px-3 py-2 rounded-lg bg-[#0f1f3d] border border-[#1e3a5f] text-white focus:outline-none focus:border-[#f05a28] text-sm'

export default async function GastosPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams
  const plataforma = sp.plataforma === 'ticketlog' || sp.plataforma === 'veloe' ? sp.plataforma : undefined
  const equipeId = sp.equipe && UUID.test(sp.equipe) ? sp.equipe : undefined
  const de = sp.de && DATA.test(sp.de) ? sp.de : undefined
  const ate = sp.ate && DATA.test(sp.ate) ? sp.ate : undefined
  const centroCusto = sp.cc || undefined

  const [gastos, equipes, centros] = await Promise.all([
    getGastos({ plataforma, equipeId, centroCusto, de, ate }),
    getEquipesExtrato(),
    getCentrosCusto(),
  ])
  const opcoesCC = [...new Map(centros.map((c) => [c.codigo, c.nome])).entries()].sort(([a], [b]) => a.localeCompare(b))
  const totalCentavos = gastos.reduce((a, g) => a + Math.round(Number(g.valor) * 100), 0)
  const limite = Math.max(PAGE_SIZE, Number(sp.limit) || PAGE_SIZE)
  const visiveis = gastos.slice(0, limite)
  const filtrado = Boolean(plataforma || equipeId || de || ate || centroCusto)
  const base = new URLSearchParams(
    Object.entries({ plataforma, equipe: equipeId, cc: centroCusto, de, ate }).filter(([, v]) => v) as [string, string][]
  )

  return (
    <div className="p-4 md:p-8">
      <h1 className="text-2xl font-bold text-white mb-1">Lista de gastos</h1>
      <p className="text-[#94a3b8] text-sm mb-6">
        Combustível (Ticketlog) e pedágio/estacionamento (Veloe), com a equipe e o centro de custo que valiam na data de uso.
      </p>

      <form action="/sofia/extratos/gastos" className="rounded-xl border border-[#1e3a5f] bg-[#0d2050] p-4 mb-4 grid grid-cols-2 lg:grid-cols-5 gap-3">
        <div>
          <label className="block text-xs text-[#94a3b8] mb-1" htmlFor="f-p">Plataforma</label>
          <select id="f-p" name="plataforma" defaultValue={plataforma ?? ''} className={fld}>
            <option value="">Todas</option>
            <option value="ticketlog">Ticketlog</option>
            <option value="veloe">Veloe</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-[#94a3b8] mb-1" htmlFor="f-e">Equipe</label>
          <select id="f-e" name="equipe" defaultValue={equipeId ?? ''} className={fld}>
            <option value="">Todas</option>
            {equipes.map((e) => (
              <option key={e.id} value={e.id}>{e.codigo}</option>
            ))}
          </select>
        </div>
        <div className="col-span-2 lg:col-span-1">
          <label className="block text-xs text-[#94a3b8] mb-1" htmlFor="f-c">Centro de custo</label>
          <select id="f-c" name="cc" defaultValue={centroCusto ?? ''} className={fld}>
            <option value="">Todos</option>
            <option value="__none">Sem centro de custo</option>
            {opcoesCC.map(([cod, nome]) => (
              <option key={cod} value={cod}>{cod} - {nome}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-[#94a3b8] mb-1" htmlFor="f-d">De</label>
          <input id="f-d" type="date" name="de" defaultValue={de ?? ''} className={fld} />
        </div>
        <div>
          <label className="block text-xs text-[#94a3b8] mb-1" htmlFor="f-a">Até</label>
          <input id="f-a" type="date" name="ate" defaultValue={ate ?? ''} className={fld} />
        </div>
        <div className="col-span-2 lg:col-span-5 flex gap-3 items-center">
          <button type="submit" className="px-4 py-2 rounded-lg bg-[#f05a28] text-white text-sm font-medium hover:bg-[#d94e22] transition-colors">
            Filtrar
          </button>
          {filtrado && (
            <Link href="/sofia/extratos/gastos" className="text-xs text-[#f05a28] hover:underline">Limpar filtros</Link>
          )}
        </div>
      </form>

      <p className="text-sm text-[#94a3b8] mb-3">
        {gastos.length} gastos · total <b className="text-white tabular-nums">{brl(totalCentavos / 100)}</b>
      </p>

      {gastos.length === 0 ? (
        <p className="px-4 py-12 text-center text-[#94a3b8] rounded-xl border border-dashed border-[#1e3a5f]">
          {filtrado ? 'Nenhum gasto com esses filtros.' : (
            <>
              Nenhum extrato foi enviado ainda.{' '}
              <Link href="/sofia/extratos/enviar" className="text-[#f05a28] hover:underline">Enviar o primeiro extrato →</Link>
            </>
          )}
        </p>
      ) : (
        <>
          <div className="rounded-xl border border-[#1e3a5f] bg-[#0d2050] overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wide text-[#4a6080] border-b border-[#1e3a5f]">
                  <th className="px-3 py-2">Data de uso</th>
                  <th className="px-3 py-2">Plataforma</th>
                  <th className="px-3 py-2 text-right">Valor</th>
                  <th className="px-3 py-2">Equipe</th>
                  <th className="px-3 py-2">Centro de custo</th>
                  <th className="px-3 py-2">Estabelecimento / cidade</th>
                  <th className="px-3 py-2">Litros / tipo</th>
                </tr>
              </thead>
              <tbody>
                {visiveis.map((g) => (
                  <tr key={g.id} className="border-b border-[#12294d] text-[#cbd5e1] align-top">
                    <td className="px-3 py-2 whitespace-nowrap tabular-nums">
                      {dataBR(g.data_uso)} {g.hora_uso?.slice(0, 5) ?? ''}
                    </td>
                    <td className="px-3 py-2">{g.plataforma === 'ticketlog' ? 'Ticketlog' : 'Veloe'}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-white">{brl(g.valor)}</td>
                    <td className="px-3 py-2">{g.equipe_codigo ?? <span className="text-amber-400">sem equipe</span>}</td>
                    <td className="px-3 py-2">
                      {g.centro_custo_codigo ? `${g.centro_custo_codigo} - ${g.centro_custo_nome}` : <span className="text-amber-400">sem centro de custo</span>}
                    </td>
                    <td className="px-3 py-2">
                      {g.estabelecimento ?? '—'}
                      {g.cidade && <div className="text-xs text-[#4a6080]">{g.cidade}</div>}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {g.plataforma === 'ticketlog'
                        ? g.litros === null ? '—' : `${Number(g.litros).toLocaleString('pt-BR')} L`
                        : g.servico ?? '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {visiveis.length < gastos.length && (
            <div className="flex justify-center mt-5">
              <Link
                href={`/sofia/extratos/gastos?${new URLSearchParams({ ...Object.fromEntries(base), limit: String(limite + PAGE_SIZE) })}`}
                className="px-4 py-2 rounded-lg border border-[#1e3a5f] text-[#94a3b8] text-sm font-medium hover:border-[#94a3b8] transition-colors"
              >
                Carregar mais ({gastos.length - visiveis.length} restantes)
              </Link>
            </div>
          )}
        </>
      )}
      <p className="text-xs text-[#4a6080] mt-4">Esta tela não mostra nome de motorista.</p>
    </div>
  )
}
