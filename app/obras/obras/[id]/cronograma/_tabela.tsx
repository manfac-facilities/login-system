'use client'

/**
 * Tabela do cronograma da OBRA. Plano (etapa, descrição, pred., duração, trava)
 * só se edita no rascunho; execução (status, %, datas reais) é da obra e se
 * edita sempre — quem pode é o engenheiro da obra ou o admin (o servidor confere).
 */
import { Fragment, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Box, BoxH, Botao, Pill } from '../../../_ui/primitivos'
import type { AtividadeCalculada, Situacao, StatusAtividade } from '../../_lib/cronograma'
import {
  atualizarExecucaoAction,
  criarRevisaoAction,
  salvarLinhaRascunhoAction,
  salvarVersaoAction,
} from './_actions'
import type { Resultado } from './_tipos'

export type LinhaTabela = Omit<AtividadeCalculada, 'pesoValor' | 'peso'>

const SITUACAO: Record<Situacao, { rotulo: string; cor: string }> = {
  concluida: { rotulo: 'Concluída', cor: '#22c55e' },
  bloqueada: { rotulo: 'BLOQUEADA', cor: '#ef4444' },
  aguardando_cliente: { rotulo: 'AGUARDANDO CLIENTE', cor: '#a855f7' },
  atrasada: { rotulo: 'ATRASADA', cor: '#ef4444' },
  inicio_atrasado: { rotulo: 'INÍCIO ATRASADO', cor: '#eab308' },
  no_prazo: { rotulo: 'No prazo', cor: '#38bdf8' },
}
const STATUS: { v: StatusAtividade; rotulo: string }[] = [
  { v: 'nao_iniciado', rotulo: 'Não iniciado' },
  { v: 'em_andamento', rotulo: 'Em andamento' },
  { v: 'concluido', rotulo: 'Concluído' },
  { v: 'bloqueado', rotulo: 'Bloqueado' },
]
const rotuloStatus = (s: StatusAtividade) => STATUS.find((x) => x.v === s)?.rotulo ?? s
const dataBR = (iso: string | null) => (iso ? iso.split('-').reverse().join('/') : '—')
const pct = (f: number) => `${Math.round(f * 100)}%`
const preds = (a: LinhaTabela) => [a.pred1, a.pred2].filter((p) => p !== null).join(', ') || '—'

const INPUT =
  'w-full rounded-md border border-[#1e3a5f] bg-[#0a1628] px-2 py-1.5 text-sm text-[#e8eef7] focus:border-[#f05a28] focus:outline-none'

type Edicao = {
  etapa: string
  descricao: string
  pred1: string
  pred2: string
  duracao: string
  bloqueiaPorTrava: boolean
  status: StatusAtividade
  percentual: string
  inicioReal: string
  fimReal: string
}

const edicaoDe = (a: LinhaTabela): Edicao => ({
  etapa: a.etapa,
  descricao: a.descricao,
  pred1: a.pred1?.toString() ?? '',
  pred2: a.pred2?.toString() ?? '',
  duracao: String(a.duracao),
  bloqueiaPorTrava: a.bloqueiaPorTrava,
  status: a.status,
  percentual: String(Math.round(a.percentual * 100)),
  inicioReal: a.inicioReal ?? '',
  fimReal: a.fimReal ?? '',
})

const numOuNulo = (s: string) => (s.trim() === '' ? null : Number(s))

export default function TabelaCronograma({
  obraId,
  atividades,
  rascunho,
  temVigente,
  podeEditar,
}: {
  obraId: string
  atividades: LinhaTabela[]
  rascunho: { id: string; numero: number } | null
  temVigente: boolean
  podeEditar: boolean
}) {
  const router = useRouter()
  const [pendente, iniciar] = useTransition()
  const [erro, setErro] = useState<string | null>(null)
  const [aberta, setAberta] = useState<number | null>(null)
  const [ed, setEd] = useState<Edicao | null>(null)
  const [motivo, setMotivo] = useState('')

  const executar = (fn: () => Promise<Resultado>, depois?: () => void) =>
    iniciar(async () => {
      setErro(null)
      const r = await fn()
      if (!r.ok) {
        setErro(r.erro)
        return
      }
      depois?.()
      router.refresh()
    })

  const abrir = (a: LinhaTabela) => {
    setErro(null)
    setAberta(a.numero)
    setEd(edicaoDe(a))
  }
  const fechar = () => {
    setAberta(null)
    setEd(null)
  }

  const salvarLinha = (a: LinhaTabela) => {
    if (!ed) return
    executar(async () => {
      const original = edicaoDe(a)
      const planoMudou =
        !!rascunho &&
        (['etapa', 'descricao', 'pred1', 'pred2', 'duracao', 'bloqueiaPorTrava'] as const).some(
          (k) => ed[k] !== original[k],
        )
      if (planoMudou) {
        const r = await salvarLinhaRascunhoAction(obraId, rascunho!.id, {
          numero: a.numero,
          etapa: ed.etapa,
          descricao: ed.descricao,
          pred1: numOuNulo(ed.pred1),
          pred2: numOuNulo(ed.pred2),
          duracao: Number(ed.duracao),
          bloqueiaPorTrava: ed.bloqueiaPorTrava,
        })
        if (!r.ok) return r
      }
      const execMudou = (['status', 'percentual', 'inicioReal', 'fimReal'] as const).some((k) => ed[k] !== original[k])
      if (execMudou) {
        const p = Number(ed.percentual.replace(',', '.'))
        return atualizarExecucaoAction(obraId, a.numero, {
          status: ed.status,
          percentual: Number.isFinite(p) ? p / 100 : NaN,
          inicioReal: ed.inicioReal || null,
          fimReal: ed.fimReal || null,
        })
      }
      return { ok: true }
    }, fechar)
  }

  const editaPlano = !!rascunho
  const titulo = rascunho ? `Rascunho v${rascunho.numero}` : 'Cronograma vigente'

  const acoes = podeEditar ? (
    <div className="flex flex-wrap items-center gap-2">
      {rascunho && rascunho.numero === 1 ? (
        <Botao disabled={pendente} onClick={() => executar(() => salvarVersaoAction(obraId, rascunho.id, null))}>
          Salvar base
        </Botao>
      ) : null}
      {rascunho && rascunho.numero > 1 ? (
        <>
          <input
            className={`${INPUT} w-64`}
            placeholder="Motivo da revisão"
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            aria-label="Motivo da revisão"
          />
          <Botao
            disabled={pendente}
            onClick={() => executar(() => salvarVersaoAction(obraId, rascunho.id, motivo), () => setMotivo(''))}
          >
            Salvar revisão
          </Botao>
        </>
      ) : null}
      {!rascunho && temVigente ? (
        <Botao tipo="secundario" disabled={pendente} onClick={() => executar(() => criarRevisaoAction(obraId))}>
          Nova revisão
        </Botao>
      ) : null}
    </div>
  ) : null

  return (
    <Box>
      <BoxH extra={acoes}>{titulo}</BoxH>
      {erro ? (
        <div role="alert" className="border-b border-[#ef4444] bg-[#ef444420] px-4 py-2 text-sm text-[#e8eef7]">
          {erro}
        </div>
      ) : null}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1100px] text-sm">
          <thead className="bg-[#0a1628] text-left text-[11px] uppercase tracking-wide text-[#94a3b8]">
            <tr>
              <th className="px-3 py-2">Nº</th>
              <th className="px-3 py-2">Etapa</th>
              <th className="px-3 py-2">Atividade</th>
              <th className="px-3 py-2">Pred.</th>
              <th className="px-3 py-2">Dias úteis</th>
              <th className="px-3 py-2">Início prev.</th>
              <th className="px-3 py-2">Fim prev.</th>
              <th className="px-3 py-2">Início proj.</th>
              <th className="px-3 py-2">Fim proj.</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">%</th>
              <th className="px-3 py-2">Situação</th>
              {podeEditar ? <th className="px-3 py-2" /> : null}
            </tr>
          </thead>
          <tbody>
            {atividades.map((a) => {
              const s = SITUACAO[a.situacao]
              return (
                <Fragment key={a.numero}>
                  <tr className="border-t border-[#1e3a5f] text-[#e8eef7]">
                    <td className="px-3 py-2 tabular-nums">{a.numero}</td>
                    <td className="px-3 py-2 text-[#94a3b8]">{a.etapa || '—'}</td>
                    <td className="px-3 py-2">
                      {a.travada ? (
                        <span title="Travada pela atividade-trava" aria-label="Travada" className="mr-1">
                          🔒
                        </span>
                      ) : null}
                      {a.descricao}
                    </td>
                    <td className="px-3 py-2 tabular-nums">{preds(a)}</td>
                    <td className="px-3 py-2 tabular-nums">{a.duracao}</td>
                    <td className="px-3 py-2 tabular-nums">{dataBR(a.inicioPrevisto)}</td>
                    <td className="px-3 py-2 tabular-nums">{dataBR(a.fimPrevisto)}</td>
                    <td className="px-3 py-2 tabular-nums">{dataBR(a.inicioProjetado)}</td>
                    <td className="px-3 py-2 tabular-nums">{dataBR(a.fimProjetado)}</td>
                    <td className="px-3 py-2">{rotuloStatus(a.status)}</td>
                    <td className="px-3 py-2 tabular-nums">{pct(a.percentual)}</td>
                    <td className="px-3 py-2">
                      <Pill cor={s.cor}>{s.rotulo}</Pill>
                    </td>
                    {podeEditar ? (
                      <td className="px-3 py-2 text-right">
                        <button
                          type="button"
                          className="text-xs text-[#f05a28] underline disabled:opacity-45"
                          disabled={pendente}
                          onClick={() => (aberta === a.numero ? fechar() : abrir(a))}
                        >
                          {aberta === a.numero ? 'Fechar' : 'Editar'}
                        </button>
                      </td>
                    ) : null}
                  </tr>
                  {aberta === a.numero && ed ? (
                    <tr className="bg-[#0a1628]">
                      <td colSpan={podeEditar ? 13 : 12} className="px-3 py-3">
                        <div className="grid gap-3 sm:grid-cols-4">
                          {editaPlano ? (
                            <>
                              <Rotulo texto="Etapa">
                                <input className={INPUT} value={ed.etapa} onChange={(e) => setEd({ ...ed, etapa: e.target.value })} />
                              </Rotulo>
                              <Rotulo texto="Atividade">
                                <input className={INPUT} value={ed.descricao} onChange={(e) => setEd({ ...ed, descricao: e.target.value })} />
                              </Rotulo>
                              <Rotulo texto="Predecessora 1">
                                <input className={INPUT} inputMode="numeric" value={ed.pred1} onChange={(e) => setEd({ ...ed, pred1: e.target.value })} />
                              </Rotulo>
                              <Rotulo texto="Predecessora 2">
                                <input className={INPUT} inputMode="numeric" value={ed.pred2} onChange={(e) => setEd({ ...ed, pred2: e.target.value })} />
                              </Rotulo>
                              <Rotulo texto="Dias úteis">
                                <input className={INPUT} inputMode="numeric" value={ed.duracao} onChange={(e) => setEd({ ...ed, duracao: e.target.value })} />
                              </Rotulo>
                              <label className="flex items-center gap-2 self-end text-sm text-[#e8eef7]">
                                <input
                                  type="checkbox"
                                  checked={ed.bloqueiaPorTrava}
                                  onChange={(e) => setEd({ ...ed, bloqueiaPorTrava: e.target.checked })}
                                />
                                Bloqueia pela trava
                              </label>
                            </>
                          ) : null}
                          <Rotulo texto="Status">
                            <select
                              className={INPUT}
                              value={ed.status}
                              onChange={(e) => setEd({ ...ed, status: e.target.value as StatusAtividade })}
                            >
                              {STATUS.map((o) => (
                                <option key={o.v} value={o.v}>
                                  {o.rotulo}
                                </option>
                              ))}
                            </select>
                          </Rotulo>
                          <Rotulo texto="% realizado">
                            <input className={INPUT} inputMode="decimal" value={ed.percentual} onChange={(e) => setEd({ ...ed, percentual: e.target.value })} />
                          </Rotulo>
                          <Rotulo texto="Início real">
                            <input type="date" className={INPUT} value={ed.inicioReal} onChange={(e) => setEd({ ...ed, inicioReal: e.target.value })} />
                          </Rotulo>
                          <Rotulo texto="Fim real">
                            <input type="date" className={INPUT} value={ed.fimReal} onChange={(e) => setEd({ ...ed, fimReal: e.target.value })} />
                          </Rotulo>
                        </div>
                        <div className="mt-3 flex gap-2">
                          <Botao disabled={pendente} onClick={() => salvarLinha(a)}>
                            {pendente ? 'Salvando…' : 'Salvar'}
                          </Botao>
                          <Botao tipo="secundario" disabled={pendente} onClick={fechar}>
                            Cancelar
                          </Botao>
                        </div>
                        {!editaPlano ? (
                          <p className="mt-2 text-xs text-[#94a3b8]">
                            Versão salva: para mudar etapa, predecessoras ou duração, crie uma nova revisão.
                          </p>
                        ) : null}
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              )
            })}
          </tbody>
        </table>
      </div>
    </Box>
  )
}

function Rotulo({ texto, children }: { texto: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-[11px] uppercase tracking-wide text-[#94a3b8]">
      {texto}
      {children}
    </label>
  )
}
