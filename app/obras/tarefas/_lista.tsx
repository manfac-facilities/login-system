'use client'

/**
 * A lista de tarefas: quem está com a bola, há quantos dias, e o que fecha.
 *
 * Regras que vieram do mockup e não se reabrem:
 *  - agrupado por dono, na ordem de quem tem mais tarefa (`porDono`, :2242);
 *  - dentro do grupo, VENCIDA primeiro, depois quem está há mais tempo com a
 *    bola (`:4302`);
 *  - "vencida" é vermelho na lista e MAIS NADA acontece — nada escala, porque
 *    escalar depende do agendador, que está fora da v0 (decisão técnica 2).
 */

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ITEM_FOTO,
  ITENS,
  ROTA_FALTA,
  br,
  diasDesde,
  sitTarefa,
  type TarefaRow,
} from '../_lib/tipos'
import { Box, BoxB, BoxH, EstadoVazio, KPI, Pill } from '../_ui/primitivos'
import { responderTarefaAction } from './_actions'

export type ObraDaTarefa = { id: string; os: string | null; loja: string | null; equipe: string }
export type PessoaDaTarefa = { nome: string; area: string | null }

/** Há quantos dias a pessoa está com a bola. `diasNaMao(mockup:2220)`. */
export function diasNaMao(t: Pick<TarefaRow, 'aberta'>, hoje: string): number {
  return Math.max(0, diasDesde(t.aberta, hoje) ?? 0)
}

/** Há quantos dias passou do prazo. `diasVencida(mockup:2221)`. */
export function diasVencida(t: Pick<TarefaRow, 'prazo'>, hoje: string): number {
  return Math.max(0, diasDesde(t.prazo, hoje) ?? 0)
}

/**
 * Agrupa as tarefas ainda em aberto por dono, na ordem de quem tem mais.
 * `porDono(mockup:2242)`.
 */
export function porDono(
  tarefas: TarefaRow[],
  hoje: string
): { chave: string; lista: TarefaRow[] }[] {
  const mapa = new Map<string, TarefaRow[]>()
  for (const t of tarefas) {
    if (sitTarefa(t, hoje) === 'respondida') continue
    const chave = t.dono ?? ''
    const lista = mapa.get(chave)
    if (lista) lista.push(t)
    else mapa.set(chave, [t])
  }
  return Array.from(mapa, ([chave, lista]) => ({ chave, lista })).sort(
    (a, b) => b.lista.length - a.lista.length
  )
}

/** Vencida primeiro, depois quem está há mais tempo com a bola (`:4302`). */
export function ordenarTarefas(lista: TarefaRow[], hoje: string): TarefaRow[] {
  return lista.slice().sort((a, b) => {
    const va = sitTarefa(a, hoje) === 'vencida' ? 1 : 0
    const vb = sitTarefa(b, hoje) === 'vencida' ? 1 : 0
    return vb - va || diasNaMao(b, hoje) - diasNaMao(a, hoje)
  })
}

/** Rótulo de quem tem a bola. Equipe de campo não está em `obras_pessoa`. */
function rotuloDono(
  chave: string,
  pessoas: Record<string, PessoaDaTarefa>,
  equipe?: string
): { nome: string; area: string } {
  const p = pessoas[chave]
  if (p) return { nome: p.nome, area: p.area ?? 'Obras' }
  if (chave.startsWith('EQ_')) return { nome: equipe ?? 'a equipe da obra', area: 'Equipe em campo' }
  return { nome: chave || 'sem dono', area: 'Obras' }
}

const COR: Record<'aberta' | 'vencida' | 'respondida', string> = {
  aberta: '#f05a28',
  vencida: '#ff4d6d',
  respondida: '#35c98a',
}

export default function Lista({
  tarefas,
  obras,
  pessoas,
  hoje,
}: {
  tarefas: TarefaRow[]
  obras: Record<string, ObraDaTarefa>
  pessoas: Record<string, PessoaDaTarefa>
  hoje: string
}) {
  const abertas = tarefas.filter((t) => sitTarefa(t, hoje) !== 'respondida')
  const vencidas = tarefas.filter((t) => sitTarefa(t, hoje) === 'vencida')
  const deHoje = tarefas.filter((t) => t.aberta === hoje)
  const respondidas = tarefas.filter((t) => sitTarefa(t, hoje) === 'respondida')
  const grupos = porDono(tarefas, hoje)

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
      <h1 className="text-xl font-semibold text-[#e8eef7]">Tarefas</h1>
      <p className="mt-1 text-sm text-[#94a3b8]">
        Toda falta registrada no diário vira tarefa com dono e prazo. Ninguém digita tarefa aqui: ela
        nasce no instante em que o analista salva a resposta do dia.
      </p>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <KPI
          rotulo={`${abertas.length === 1 ? 'tarefa aberta' : 'tarefas abertas'} agora`}
          valor={abertas.length}
          cor="#f05a28"
        />
        <KPI
          rotulo={vencidas.length === 1 ? 'passou do prazo' : 'passaram do prazo'}
          valor={vencidas.length}
          cor="#f4b73f"
        />
        <KPI
          rotulo={deHoje.length === 1 ? 'falta virou tarefa hoje' : 'faltas viraram tarefa hoje'}
          valor={deHoje.length}
        />
      </div>

      <div className="mt-5">
        <Box>
          <BoxH extra="o tipo da falta decide o dono">A tarefa vai para</BoxH>
          <BoxB className="px-0 py-0">
            <TabelaRota pessoas={pessoas} />
          </BoxB>
        </Box>
        <p className="mt-2 text-[12px] text-[#94a3b8]">
          <b className="text-[#e8eef7]">Prazo padrão: até o fim do dia.</b> Falta registrada depois
          das 18h fica com o dia seguinte — se o prazo fosse sempre &quot;hoje&quot;, a tarefa das
          18h26 nasceria vencida no mesmo minuto.{' '}
          <b className="text-[#e8eef7]">
            Ferramenta e equipe vão para o Yuri mesmo quando a obra é de outro analista
          </b>
          , porque quem remaneja equipe e ferramenta entre obras é ele.
        </p>
      </div>

      <h2 className="mt-6 text-sm font-semibold text-[#e8eef7]">Na mão de quem, e há quantos dias</h2>
      <p className="mt-1 text-[12px] text-[#94a3b8]">
        Agrupadas por quem tem que resolver. Vencida aparece em vermelho e em primeiro lugar — na v0
        ela não escala sozinha para ninguém.
      </p>

      {grupos.length === 0 ? (
        <div className="mt-3">
          <EstadoVazio>
            Nenhuma tarefa aberta. Toda falta registrada já foi respondida.
          </EstadoVazio>
        </div>
      ) : (
        <div className="mt-3 flex flex-col gap-4">
          {grupos.map((g) => {
            const primeira = g.lista[0]
            const equipe = obras[primeira.obra_id]?.equipe
            const dono = rotuloDono(g.chave, pessoas, equipe)
            return (
              <Box key={g.chave}>
                <BoxH extra={`${g.lista.length} ${g.lista.length === 1 ? 'tarefa' : 'tarefas'}`}>
                  {dono.area} · {dono.nome}
                </BoxH>
                <BoxB className="flex flex-col gap-2">
                  {ordenarTarefas(g.lista, hoje).map((t) => (
                    <Linha key={t.id} tarefa={t} obra={obras[t.obra_id]} hoje={hoje} />
                  ))}
                </BoxB>
              </Box>
            )
          })}
        </div>
      )}

      {respondidas.length ? (
        <>
          <h2 className="mt-6 text-sm font-semibold text-[#e8eef7]">
            Respondidas — a volta que fecha o ciclo
          </h2>
          <div className="mt-3 flex flex-col gap-2">
            {respondidas.map((t) => (
              <Linha key={t.id} tarefa={t} obra={obras[t.obra_id]} hoje={hoje} />
            ))}
          </div>
        </>
      ) : null}
    </div>
  )
}

/** `rotaHTML(mockup:4205)` — a tabela que explica o roteamento. */
function TabelaRota({ pessoas }: { pessoas: Record<string, PessoaDaTarefa> }) {
  const linhas = ITENS.slice(1)
    .map((it) => ({ it: it as string, rota: ROTA_FALTA[it] }))
    .filter((l) => !!l.rota)
  const foto = ROTA_FALTA[ITEM_FOTO]

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[34rem] text-left text-[12px]">
        <thead>
          <tr className="border-b border-[#1e3a5f] text-[11px] uppercase tracking-wide text-[#94a3b8]">
            <th scope="col" className="px-4 py-2 font-medium">
              Faltou
            </th>
            <th scope="col" className="px-4 py-2 font-medium">
              A tarefa vai para
            </th>
            <th scope="col" className="px-4 py-2 font-medium">
              E a cobrança pede
            </th>
          </tr>
        </thead>
        <tbody>
          {linhas.map(({ it, rota }) => {
            const d = rotuloDono(rota.chave, pessoas)
            return (
              <tr key={it} className="border-b border-[#1e3a5f]/60 last:border-0">
                <td className="px-4 py-2 text-[#e8eef7]">{it}</td>
                <td className="px-4 py-2 text-[#e8eef7]">
                  <b>
                    {d.area} — {d.nome.split(' ')[0]}
                  </b>
                  {rota.nosso ? (
                    <span className="ml-2 align-middle">
                      <Pill>padrão nosso</Pill>
                    </span>
                  ) : null}
                </td>
                <td className="px-4 py-2 text-[#94a3b8]">{rota.acao}</td>
              </tr>
            )
          })}
          <tr>
            <td className="px-4 py-2 text-[#e8eef7]">Foto do dia</td>
            <td className="px-4 py-2 text-[#e8eef7]">
              <b>Equipe em campo — a equipe definida na obra</b>
              <span className="ml-2 align-middle">
                <Pill>padrão nosso</Pill>
              </span>
            </td>
            <td className="px-4 py-2 text-[#94a3b8]">{foto?.acao ?? ''}</td>
          </tr>
        </tbody>
      </table>
      <p className="px-4 py-2 text-[11px] text-[#64748b]">
        A foto é a única falta cuja cobrança sai da Manfac e vai para a ponta — por isso ela não é
        uma opção do diário: é o anexo que não veio.
      </p>
    </div>
  )
}

function Linha({
  tarefa,
  obra,
  hoje,
}: {
  tarefa: TarefaRow
  obra?: ObraDaTarefa
  hoje: string
}) {
  const s = sitTarefa(tarefa, hoje)
  const [abrindo, setAbrindo] = useState(false)
  const [resumo, setResumo] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [pendente, iniciar] = useTransition()
  const router = useRouter()

  let fim: string
  if (s === 'respondida') {
    fim = `respondida em ${br(tarefa.resposta_em).slice(0, 5)}${
      tarefa.resposta_hora ? ` às ${tarefa.resposta_hora.slice(0, 5)}` : ''
    }${tarefa.resumo ? ` — ${tarefa.resumo}` : ''}`
  } else if (s === 'vencida') {
    const d = diasVencida(tarefa, hoje)
    fim = `sem resposta há ${d} ${d === 1 ? 'dia' : 'dias'}`
  } else {
    fim = 'esperando resposta'
  }

  function responder() {
    setErro(null)
    iniciar(async () => {
      const r = await responderTarefaAction(tarefa.id, resumo)
      if (r.error) {
        setErro(r.error)
        return
      }
      setAbrindo(false)
      setResumo('')
      router.refresh()
    })
  }

  return (
    <div
      className="rounded-md border border-[#1e3a5f] bg-[#0a1628] px-3 py-2.5"
      style={{ borderLeft: `3px solid ${COR[s]}` }}
    >
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="text-sm font-medium text-[#e8eef7]">
          {tarefa.item === ITEM_FOTO ? 'Foto do dia' : `Faltou ${tarefa.item.toLowerCase()}`}
        </span>
        {obra ? (
          <Link
            href={`/obras/obra/${obra.id}`}
            className="text-[12px] text-[#94a3b8] underline-offset-4 hover:text-[#f05a28] hover:underline"
          >
            OS {obra.os ?? '—'} · {obra.loja ?? 'obra sem loja'}
          </Link>
        ) : null}
        <span className="ml-auto text-[11px]" style={{ color: COR[s] }}>
          {s === 'vencida' ? 'vencida' : s}
        </span>
      </div>
      <p className="mt-1 text-[12px] text-[#94a3b8]">
        aberta em {br(tarefa.aberta).slice(0, 5)}
        {tarefa.hora_aberta ? ` às ${tarefa.hora_aberta.slice(0, 5)}` : ''} · prazo fim do dia{' '}
        {tarefa.prazo ? br(tarefa.prazo).slice(0, 5) : '—'} ·{' '}
        {s === 'respondida' ? '' : `há ${diasNaMao(tarefa, hoje)} dia(s) na mão · `}
        {fim}
      </p>

      {s === 'respondida' ? null : abrindo ? (
        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
          <input
            type="text"
            value={resumo}
            autoFocus
            maxLength={160}
            onChange={(e) => setResumo(e.target.value)}
            placeholder="Em uma linha: o que foi resolvido"
            aria-label="Resumo da resposta"
            className="min-h-11 w-full rounded-md border border-[#1e3a5f] bg-[#0f1f3d] px-3 py-2 text-sm text-[#e8eef7] placeholder:text-[#4a6080] focus:border-[#f05a28] focus:outline-none"
          />
          <button
            type="button"
            onClick={responder}
            disabled={pendente}
            className="min-h-11 shrink-0 rounded-md bg-[#f05a28] px-3 py-2 text-sm font-medium text-white hover:bg-[#d94d20] disabled:opacity-45"
          >
            {pendente ? 'salvando…' : 'Marcar como respondida'}
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setAbrindo(true)}
          className="mt-2 min-h-9 rounded-md border border-[#1e3a5f] px-2.5 py-1.5 text-[12px] text-[#94a3b8] hover:border-[#f05a28] hover:text-[#e8eef7]"
        >
          Marcar como respondida
        </button>
      )}
      {erro ? <p className="mt-1 text-[12px] text-[#ff4d6d]">{erro}</p> : null}
    </div>
  )
}

