import type { ReactNode } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { hasSystemAccess } from '@/lib/auth/systemAccess'
import { isAdmin } from '@/lib/auth/roles'
import { hojeISO, type ObraRow } from '../_lib/tipos'
import { lerObraGrande, type ObraGrande } from './_lib/leitura'
import { ultimosDiariosEnviados } from './_lib/ultimo-diario'
import AnelProgresso from './_ui/anel-progresso'
import { IconeAlerta, IconeCirculoTracejado } from './_ui/icones'
import Kpi from './_ui/kpi'
import { PilulaSinal } from './_ui/pilula-situacao'
import SimboloManfac from './_ui/simbolo-manfac'

export const dynamic = 'force-dynamic'

const pct = (f: number) => `${Math.round(f * 100)}%`
const dataBR = (iso: string) => iso.split('-').reverse().join('/')

function Vazio({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-(--obra-border) bg-(--obra-card) px-6 py-10 text-center text-[15px] text-(--obra-muted-texto)">
      {children}
    </div>
  )
}

/** Barra mini Base × Previsto × Realizado. Base é sempre contorno tracejado (a "foto"). */
function Barra({ rotulo, valor, tipo }: { rotulo: string; valor: number | null; tipo: 'base' | 'previsto' | 'realizado' }) {
  const largura = valor === null ? 0 : Math.min(100, Math.max(0, valor * 100))
  const preenchimento =
    tipo === 'base'
      ? 'border border-dashed border-(--obra-base) bg-transparent'
      : tipo === 'previsto'
        ? 'bg-(--obra-ink)'
        : 'bg-(--obra-orange)'
  return (
    <div className="grid grid-cols-[64px_1fr_40px] items-center gap-2">
      <span className="text-[12px] text-(--obra-muted-texto)">{rotulo}</span>
      <span className="relative h-2 overflow-hidden rounded-full bg-(--obra-trilho)">
        {largura > 0 ? (
          <span className={`absolute inset-y-0 left-0 rounded-full ${preenchimento}`} style={{ width: `${largura}%` }} />
        ) : null}
      </span>
      <span className="obra-num text-right text-[12px] text-(--obra-text)">{valor === null ? '—' : pct(valor)}</span>
    </div>
  )
}

function CartaoObra({
  obra,
  leitura,
  ultimoDiario,
}: {
  obra: Pick<ObraRow, 'id' | 'os' | 'loja' | 'cliente'>
  leitura: { ok: true; dados: ObraGrande } | { ok: false; erro: string }
  ultimoDiario: string | undefined
}) {
  const d = leitura.ok ? leitura.dados : null
  const calc = d?.calc ?? null
  const mudouEntrega = !!(calc && d?.terminoBase && d.terminoBase !== calc.terminoProjetado)
  return (
    <li>
      <Link
        href={`/obras/obras/${obra.id}`}
        className="group flex h-full flex-col gap-4 rounded-xl border border-(--obra-border) bg-(--obra-card) p-5 transition-[border-color,box-shadow] duration-200 hover:border-[#9db3c6] hover:shadow-[0_6px_20px_rgba(0,52,94,0.08)]"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="obra-num text-[12px] text-(--obra-muted-texto)">OS {obra.os ?? '—'}</p>
            <h2 className="mt-0.5 truncate text-[17px] leading-6 font-semibold text-(--obra-ink) group-hover:underline group-hover:decoration-(--obra-orange) group-hover:underline-offset-4">
              {obra.loja ?? '—'}
            </h2>
            <p className="truncate text-[13px] text-(--obra-muted-texto)">{obra.cliente ?? 'Cliente não informado'}</p>
          </div>
          {calc ? <PilulaSinal sinal={d!.sinal} /> : null}
        </div>

        {calc ? (
          <div className="flex items-center gap-4">
            <AnelProgresso valor={calc.realizado} tamanho={60} espessura={6} />
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <Barra rotulo="Base" valor={d!.calcBase ? d!.calcBase.previsto : null} tipo="base" />
              <Barra rotulo="Previsto" valor={calc.previsto} tipo="previsto" />
              <Barra rotulo="Realizado" valor={calc.realizado} tipo="realizado" />
            </div>
          </div>
        ) : (
          <div
            className={
              'flex min-h-[76px] items-center justify-center gap-2 rounded-lg border border-dashed px-3 text-[12px] font-semibold tracking-[0.06em] uppercase ' +
              (leitura.ok
                ? 'border-(--obra-border) text-(--obra-muted-texto)'
                : 'border-[#efc2c2] bg-[#fdf3f3] text-(--obra-vermelho-texto)')
            }
          >
            {leitura.ok ? <IconeCirculoTracejado tamanho={16} /> : <IconeAlerta tamanho={16} />}
            <span>{leitura.ok ? 'sem cronograma' : 'erro ao ler o cronograma'}</span>
          </div>
        )}

        <dl className="mt-auto grid grid-cols-2 gap-3 border-t border-(--obra-border) pt-3">
          <div className="min-w-0">
            <dt className="text-[11px] font-medium tracking-[0.06em] text-(--obra-muted-texto) uppercase">Entrega prevista</dt>
            <dd className="obra-num mt-0.5 text-[14px] text-(--obra-text)">
              {calc ? dataBR(calc.terminoProjetado) : '—'}
              {mudouEntrega ? (
                <span className="ml-1.5 text-[12px] text-(--obra-muted-texto) line-through" title="Entrega na base">
                  <span className="sr-only">base </span>
                  {dataBR(d!.terminoBase!)}
                </span>
              ) : null}
            </dd>
          </div>
          <div className="min-w-0">
            <dt className="text-[11px] font-medium tracking-[0.06em] text-(--obra-muted-texto) uppercase">Último diário</dt>
            <dd className="obra-num mt-0.5 text-[14px] text-(--obra-text)">{ultimoDiario ? dataBR(ultimoDiario) : '—'}</dd>
          </div>
        </dl>
      </Link>
    </li>
  )
}

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
        <Vazio>Esta tela é de quem é responsável pelas obras</Vazio>
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

  const sinais = leituras.map((l) => (l.ok && l.dados?.calc ? l.dados.sinal : null))
  const conta = (s: string) => sinais.filter((x) => x === s).length

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:py-8">
      <header className="flex items-center gap-4">
        <SimboloManfac tamanho={40} />
        <div className="min-w-0">
          <p className="text-[11px] font-semibold tracking-[0.1em] text-(--obra-orange-texto) uppercase">Gestão de Obras</p>
          <h1 className="text-[26px] leading-tight font-semibold tracking-tight text-(--obra-ink)">OBRAS</h1>
          <p className="text-[13px] text-(--obra-muted-texto)">Obras grandes com cronograma, diário e comunicação ao cliente</p>
        </div>
      </header>

      {error ? (
        <Vazio>Não deu para carregar as obras. Recarregue a página em alguns instantes.</Vazio>
      ) : obras.length === 0 ? (
        <Vazio>Nenhuma obra classificada como OBRA ainda.</Vazio>
      ) : (
        <>
          <section aria-label="Resumo das obras" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Kpi rotulo="Obras" valor={obras.length} sub={`${sinais.filter((s) => s === null).length} sem cronograma`} />
            <Kpi rotulo="No prazo" valor={conta('verde')} tom="positivo" />
            <Kpi rotulo="Atenção" valor={conta('amarelo')} tom="atencao" />
            <Kpi rotulo="Atrasadas" valor={conta('vermelho')} tom="negativo" />
          </section>
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {obras.map((o, i) => (
              <CartaoObra key={o.id} obra={o} leitura={leituras[i]} ultimoDiario={ultimo.get(o.id)} />
            ))}
          </ul>
        </>
      )}
    </div>
  )
}
