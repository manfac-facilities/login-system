import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { hasSystemAccess } from '@/lib/auth/systemAccess'
import { isAdmin } from '@/lib/auth/roles'
import { EstadoVazio } from '../_ui/primitivos'
import { hojeISO, type ObraRow } from '../_lib/tipos'
import { lerObraGrande } from './_lib/leitura'
import { ultimosDiariosEnviados } from './_lib/ultimo-diario'
import SeloSinal from './_ui/sinal'

export const dynamic = 'force-dynamic'

const pct = (f: number) => `${Math.round(f * 100)}%`
const dataBR = (iso: string) => iso.split('-').reverse().join('/')

export default async function ListaObrasPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const permitido =
    !!user?.email &&
    ((await hasSystemAccess(supabase, user.email, 'obras')) || (await isAdmin(supabase, user.email)))
  if (!permitido) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        <EstadoVazio>Esta tela é de quem é responsável pelas obras</EstadoVazio>
      </div>
    )
  }

  const { data, error } = await supabase
    .from('obras_obra')
    .select('id, os, loja, cliente')
    .eq('modalidade', 'obra')
    .order('loja', { ascending: true })
  const obras = (data ?? []) as Pick<ObraRow, 'id' | 'os' | 'loja' | 'cliente'>[]

  const hoje = hojeISO()
  const ids = obras.map((o) => o.id)
  const [leituras, enviosR] = await Promise.all([
    Promise.all(obras.map((o) => lerObraGrande(supabase, o.id, hoje))),
    ultimosDiariosEnviados(supabase, ids),
  ])
  const ultimo = enviosR.ultimo

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-6 sm:px-6">
      <header>
        <h1 className="text-xl font-semibold text-[#e8eef7]">OBRAS</h1>
        <p className="mt-0.5 text-xs text-[#94a3b8]">Obras grandes com cronograma, diário e comunicação ao cliente</p>
      </header>

      {error ? (
        <EstadoVazio>Não deu para carregar as obras. Recarregue a página em alguns instantes.</EstadoVazio>
      ) : obras.length === 0 ? (
        <EstadoVazio>Nenhuma obra classificada como OBRA ainda.</EstadoVazio>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-[#1e3a5f] bg-[#0d2050]">
          <table className="w-full text-left text-sm">
            <thead className="text-[11px] uppercase tracking-wide text-[#94a3b8]">
              <tr className="border-b border-[#1e3a5f]">
                <th className="px-3 py-2">Loja</th>
                <th className="px-3 py-2">OS</th>
                <th className="px-3 py-2">Cliente</th>
                <th className="px-3 py-2">Sinal</th>
                <th className="px-3 py-2">Previsto × realizado</th>
                <th className="px-3 py-2">Previsão de entrega</th>
                <th className="px-3 py-2">Último diário</th>
              </tr>
            </thead>
            <tbody className="text-[#e8eef7]">
              {obras.map((o, i) => {
                const l = leituras[i]
                const d = l.ok ? l.dados : null
                const u = ultimo.get(o.id)
                return (
                  <tr key={o.id} className="border-b border-[#1e3a5f] last:border-0 hover:bg-[#132a52]">
                    <td className="px-3 py-2">
                      <Link href={`/obras/obras/${o.id}`} className="font-medium text-[#f05a28] hover:underline">
                        {o.loja ?? '—'}
                      </Link>
                    </td>
                    <td className="px-3 py-2">{o.os ?? '—'}</td>
                    <td className="px-3 py-2">{o.cliente ?? '—'}</td>
                    <td className="px-3 py-2">
                      {d?.calc ? (
                        <SeloSinal sinal={d.sinal} />
                      ) : (
                        <span className={l.ok ? 'text-[#94a3b8]' : 'text-red-400'}>
                          {l.ok ? 'sem cronograma' : 'erro ao ler o cronograma'}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2">{d?.calc ? `${pct(d.calc.previsto)} × ${pct(d.calc.realizado)}` : '—'}</td>
                    <td className="px-3 py-2">{d?.calc ? dataBR(d.calc.terminoProjetado) : '—'}</td>
                    <td className="px-3 py-2">{u ? dataBR(u) : '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
