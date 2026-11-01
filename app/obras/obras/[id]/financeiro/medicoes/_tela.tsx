'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  aoDigitarPercentual,
  centavosDeTexto,
  pctPorValor,
  restanteDaOs,
  centesimosDeTexto,
  LIMITE_DIAS_AGUARDANDO,
  textoDeCentavos,
  textoDeCentesimos,
} from '../../../_lib/medicao'
import { apagarMedicaoAction, mudarSituacaoMedicaoAction, salvarMedicaoAction } from './_actions'
import type { MedicaoLinha, OsMedicao, Situacao } from './_tipos'

const th = 'px-3 py-2 text-left text-[12px] font-semibold uppercase tracking-[0.04em] text-(--obra-muted-texto) whitespace-nowrap'
const td = 'px-3 py-2 align-top text-[14px] text-(--obra-text)'
const num = td + ' obra-num text-right whitespace-nowrap'
const campo = 'obra-num min-h-11 rounded-lg border border-(--obra-border) bg-white px-3 text-base text-(--obra-text) disabled:bg-(--obra-surface)'
const botao = 'min-h-11 rounded-lg border border-(--obra-border) bg-white px-3 text-sm text-(--obra-ink) hover:border-(--obra-orange-texto) disabled:opacity-45'
const ddmm = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`
const ddmmaa = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`
const pct = (c: number | null) => (c === null ? '—' : `${textoDeCentesimos(c)}%`)
const rotuloOs = (o: OsMedicao) => `${o.os ?? 'OS sem número'}${o.papel === 'mae' ? ' · mãe' : o.papel === 'aditivo' ? ' · aditivo' : ''}`

function Pilula({ m }: { m: MedicaoLinha }) {
  const base = 'inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-[12px] font-semibold'
  if (m.notas.length) return <span className={base + ' bg-[#e7f5ec] text-(--obra-verde-texto)'}>faturada</span>
  if (m.situacao === 'aprovada') return <span className={base + ' bg-[#fdeeee] text-(--obra-vermelho-texto)'}>aprovada · falta nota</span>
  if (m.situacao === 'recusada') return <span className={base + ' bg-(--obra-surface) text-(--obra-muted-texto)'}>recusada · renegociar</span>
  const dias = m.diasAguardando ?? 0
  return (
    <span className={base + (m.atrasada ? ' bg-[#fdeeee] text-(--obra-vermelho-texto)' : ' bg-[#fdf6d8] text-(--obra-yellow-texto)')}>
      aguardando cliente · {dias} {dias === 1 ? 'dia' : 'dias'}
    </span>
  )
}

type Form = { id?: string; osId: string; inicio: string; fim: string; pct: string; valor: string }

function Formulario({ obraId, oss, medicoes, inicial, onFim }: { obraId: string; oss: OsMedicao[]; medicoes: MedicaoLinha[]; inicial: Form; onFim: () => void }) {
  const router = useRouter()
  const [f, setF] = useState<Form>(inicial)
  const [erro, setErro] = useState<string | null>(null)
  const [indo, setIndo] = useState(false)
  const os = oss.find((o) => o.id === f.osId) ?? oss[0]
  const receita = os?.receitaCentavos ?? null
  const restante = receita === null ? null : restanteDaOs(receita, medicoes.filter((m) => m.osId === f.osId), f.id)
  /** Valor digitado → % (2 casas), nunca acima do % restante; valor = restante leva o % restante exato. */
  const pctDoValor = (texto: string, rec: number | null, r: typeof restante) => {
    const v = centavosDeTexto(texto)
    if (rec === null) return ''
    if (v === null) return ''
    return textoDeCentesimos(pctPorValor(rec, v, r))
  }

  async function salvar() {
    const p = centesimosDeTexto(f.pct)
    const v = centavosDeTexto(f.valor)
    if (p === null || v === null) return setErro('Digite o % ou o valor liberado')
    setIndo(true)
    setErro(null)
    const r = await salvarMedicaoAction(obraId, { id: f.id, osId: f.osId, inicio: f.inicio, fim: f.fim, percentualCentesimos: p, valorCentavos: v })
    setIndo(false)
    if (!r.ok) return setErro(r.erro)
    router.refresh()
    onFim()
  }

  return (
    <section aria-labelledby="form-medicao" className="flex flex-col gap-3 rounded-xl border border-(--obra-border) bg-(--obra-card) p-4">
      <h2 id="form-medicao" className="text-lg font-bold text-(--obra-ink)">{f.id ? 'Editar medição' : 'Nova medição'}</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-[13px] text-(--obra-muted-texto)">
          OS
          <select
            className={campo}
            value={f.osId}
            disabled={!!f.id}
            onChange={(e) => {
              const nova = oss.find((o) => o.id === e.target.value)
              setF({ ...f, osId: e.target.value, valor: nova?.receitaCentavos ? aoDigitarPercentual(f.pct, nova.receitaCentavos) : f.valor, pct: nova?.receitaCentavos ? f.pct : '' })
            }}
          >
            {oss.map((o) => (
              <option key={o.id} value={o.id}>{rotuloOs(o)}</option>
            ))}
          </select>
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label className="flex flex-col gap-1 text-[13px] text-(--obra-muted-texto)">
            Período: início
            <input type="date" className={campo} value={f.inicio} onChange={(e) => setF({ ...f, inicio: e.target.value })} />
          </label>
          <label className="flex flex-col gap-1 text-[13px] text-(--obra-muted-texto)">
            fim
            <input type="date" className={campo} value={f.fim} onChange={(e) => setF({ ...f, fim: e.target.value })} />
          </label>
        </div>
        <label className="flex flex-col gap-1 text-[13px] text-(--obra-muted-texto)">
          Avanço físico na data
          <input className={campo} readOnly value={f.id ? 'gravado no registro' : os?.avancoCentesimos !== null && os?.avancoCentesimos !== undefined ? pct(os.avancoCentesimos) : 'calculado ao salvar'} />
        </label>
        <span />
        <label className="flex flex-col gap-1 text-[13px] text-(--obra-muted-texto)">
          % liberado nesta medição
          <input
            inputMode="decimal"
            className={campo}
            disabled={receita === null}
            value={receita === null ? '—' : f.pct}
            onChange={(e) => {
              // % igual ao restante leva o valor restante exato (a soma em R$ fecha na receita).
              const p = centesimosDeTexto(e.target.value)
              const valor = restante && p === restante.pct && restante.valor > 0 ? textoDeCentavos(restante.valor) : aoDigitarPercentual(e.target.value, receita)
              setF({ ...f, pct: e.target.value, valor })
            }}
          />
        </label>
        <label className="flex flex-col gap-1 text-[13px] text-(--obra-muted-texto)">
          Valor liberado (R$)
          <input
            inputMode="decimal"
            className={campo}
            value={f.valor}
            onChange={(e) => setF({ ...f, valor: e.target.value, pct: pctDoValor(e.target.value, receita, restante) })}
          />
        </label>
      </div>
      {restante ? (
        <div className="flex flex-wrap items-center gap-2 text-[13px] text-(--obra-text)">
          <span>
            Restante da OS:{' '}
            <b className="obra-num">
              R$ {textoDeCentavos(Math.max(0, restante.valor))} · {textoDeCentesimos(Math.max(0, restante.pct))}%
            </b>
          </span>
          {restante.pct > 0 && restante.valor > 0 ? (
            <button
              type="button"
              className={botao}
              onClick={() => setF({ ...f, pct: textoDeCentesimos(restante.pct), valor: textoDeCentavos(restante.valor) })}
            >
              Usar o restante
            </button>
          ) : null}
        </div>
      ) : null}
      {receita === null ? (
        <p role="status" className="rounded-lg border border-[#efd77a] bg-[#fdf6d8] px-3 py-2 text-[13px] text-(--obra-text)">
          Esta OS não tem valor receita: o % não se calcula. Informe o valor receita em Dados da obra para registrar a medição.
        </p>
      ) : (
        <p className="text-[13px] text-(--obra-muted-texto)">
          Digite o % <b>ou</b> o valor: um atualiza o outro, sobre o valor receita da OS escolhida (R$ {textoDeCentavos(receita)}). A soma das liberações da OS não passa de 100%.
        </p>
      )}
      {!f.id ? <p className="text-[13px] text-(--obra-muted-texto)">A medição nasce como enviada ao cliente; a aprovação ou recusa se marca na lista.</p> : null}
      {erro ? <p role="alert" className="text-sm text-(--obra-vermelho-texto)">{erro}</p> : null}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={indo || receita === null}
          onClick={salvar}
          className="min-h-11 rounded-lg bg-(--obra-orange-texto) px-4 text-sm font-semibold text-white disabled:opacity-45"
        >
          {indo ? 'salvando…' : f.id ? 'Salvar alterações' : 'Registrar medição'}
        </button>
        <button type="button" className={botao} onClick={onFim}>
          Cancelar
        </button>
      </div>
    </section>
  )
}

function Acoes({ obraId, m, pode, admin, onEditar }: { obraId: string; m: MedicaoLinha; pode: boolean; admin: boolean; onEditar: () => void }) {
  const router = useRouter()
  const [erro, setErro] = useState<string | null>(null)
  const [indo, setIndo] = useState(false)
  if (m.notas.length) {
    return <span className="text-[13px] text-(--obra-muted-texto)">travada pela nota</span>
  }
  if (!pode) return null
  const rodar = async (fn: () => Promise<{ ok: boolean; erro?: string }>) => {
    setIndo(true)
    setErro(null)
    const r = await fn()
    setIndo(false)
    if (!r.ok) return setErro(r.erro ?? 'Não foi possível concluir.')
    router.refresh()
  }
  const situacao = (s: Situacao) => () => rodar(() => mudarSituacaoMedicaoAction(obraId, m.osId, m.id, s))
  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap gap-1.5">
        {m.situacao === 'enviada' ? (
          <>
            <button type="button" className={botao} disabled={indo} onClick={situacao('aprovada')}>Cliente aprovou</button>
            <button type="button" className={botao} disabled={indo} onClick={situacao('recusada')}>Cliente recusou</button>
          </>
        ) : null}
        {m.situacao === 'recusada' ? <button type="button" className={botao} disabled={indo} onClick={situacao('enviada')}>Reenviar</button> : null}
        {m.situacao === 'aprovada' && admin ? <button type="button" className={botao} disabled={indo} onClick={situacao('enviada')}>Voltar para enviada</button> : null}
        {m.situacao !== 'aprovada' ? <button type="button" className={botao} disabled={indo} onClick={onEditar}>Editar</button> : null}
        {admin ? (
          <button
            type="button"
            className={botao}
            disabled={indo}
            onClick={() => {
              if (window.confirm(`Apagar a medição ${m.numero}?`)) void rodar(() => apagarMedicaoAction(obraId, m.osId, m.id))
            }}
          >
            Apagar
          </button>
        ) : null}
      </div>
      {erro ? <p role="alert" className="text-xs text-(--obra-vermelho-texto)">{erro}</p> : null}
    </div>
  )
}

export default function TelaMedicoes({ obraId, oss, medicoes, admin, notasOk }: { obraId: string; oss: OsMedicao[]; medicoes: MedicaoLinha[]; admin: boolean; notasOk: boolean }) {
  const [form, setForm] = useState<Form | null>(null)
  const gravaveis = oss.filter((o) => o.podeGravar)
  const podePorOs = new Map(oss.map((o) => [o.id, o.podeGravar]))
  const receitaPorOs = new Map(oss.map((o) => [o.id, o.receitaCentavos]))
  const atrasadas = medicoes.filter((m) => m.atrasada && !m.notas.length)
  const varias = oss.length > 1

  const novo = () =>
    setForm({ osId: gravaveis[0]?.id ?? '', inicio: '', fim: '', pct: '', valor: '' })
  // Ao abrir a edição, o % é recalculado do valor sobre o valor receita ATUAL (que pode ter mudado).
  const editar = (m: MedicaoLinha) => {
    const rec = receitaPorOs.get(m.osId) ?? null
    const r = rec === null ? null : restanteDaOs(rec, medicoes.filter((x) => x.osId === m.osId), m.id)
    setForm({
      id: m.id,
      osId: m.osId,
      inicio: m.inicio,
      fim: m.fim,
      pct: rec === null ? '' : textoDeCentesimos(pctPorValor(rec, m.valorCentavos, r)),
      valor: textoDeCentavos(m.valorCentavos),
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-lg font-bold text-(--obra-ink)">Medições ao cliente</h2>
          <p className="text-[13px] text-(--obra-muted-texto)">
            O engenheiro registra cada liberação de faturamento negociada. O Financeiro emite as notas e liga à medição.
          </p>
        </div>
        {gravaveis.length && !form ? (
          <button type="button" onClick={novo} className="min-h-11 rounded-lg bg-(--obra-orange-texto) px-4 text-sm font-semibold text-white">
            + Nova medição
          </button>
        ) : null}
      </div>

      {atrasadas.length ? (
        <div role="status" className="rounded-r-lg border-l-4 border-(--obra-orange) bg-[#fff7f2] px-3 py-2 text-[14px] text-(--obra-text)">
          {atrasadas.map((m) => (
            <p key={m.id}>
              <b>
                Medição {m.numero}{varias && m.os ? ` (OS ${m.os})` : ''} há {m.diasAguardando} dias aguardando o cliente.
              </b>
            </p>
          ))}
          <p className="text-[13px]">Passou de {LIMITE_DIAS_AGUARDANDO} dias em aprovação: cobre o retorno do cliente.</p>
        </div>
      ) : null}
      {!notasOk ? (
        <p role="alert" className="text-sm text-(--obra-vermelho-texto)">Não deu para ler as notas do Financeiro agora: a coluna Notas pode estar incompleta.</p>
      ) : null}

      <section aria-label="Lista de medições" className="rounded-xl border border-(--obra-border) bg-(--obra-card) p-4">
        {medicoes.length === 0 ? (
          <p className="text-sm text-(--obra-muted-texto)">Nenhuma medição registrada ainda.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] border-collapse">
              <thead>
                <tr className="border-b border-(--obra-border)">
                  <th className={th}>#</th>
                  <th className={th}>OS</th>
                  <th className={th}>Período</th>
                  <th className={th + ' text-right'}>Avanço na data</th>
                  <th className={th + ' text-right'}>% liberado</th>
                  <th className={th + ' text-right'}>Valor liberado</th>
                  <th className={th}>Situação</th>
                  <th className={th}>Notas</th>
                  <th className={th}><span className="sr-only">Ações</span></th>
                </tr>
              </thead>
              <tbody>
                {medicoes.map((m) => (
                  <tr key={m.id} className="border-b border-(--obra-border)">
                    <td className={td + ' obra-num'}>{m.numero}</td>
                    <td className={td + ' obra-num whitespace-nowrap'}>{m.os ?? '—'}</td>
                    <td className={td + ' obra-num whitespace-nowrap'} title={`${ddmmaa(m.inicio)} – ${ddmmaa(m.fim)}`}>
                      {ddmm(m.inicio)} – {ddmm(m.fim)}
                    </td>
                    <td className={num}>{pct(m.avancoCentesimos)}</td>
                    <td className={num}>{pct(m.percentualCentesimos)}</td>
                    <td className={num}>{textoDeCentavos(m.valorCentavos)}</td>
                    <td className={td}><Pilula m={m} /></td>
                    <td className={td + ' obra-num'}>{m.notas.length ? m.notas.map((n) => `NFS-e ${n}`).join(', ') : '—'}</td>
                    <td className={td}>
                      <Acoes obraId={obraId} m={m} pode={podePorOs.get(m.osId) === true} admin={admin} onEditar={() => editar(m)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {form ? (
        <Formulario key={form.id ?? 'nova'} obraId={obraId} medicoes={medicoes} oss={form.id ? oss.filter((o) => o.id === form.osId) : gravaveis} inicial={form} onFim={() => setForm(null)} />
      ) : null}
      {gravaveis.length === 0 ? (
        <p className="text-[13px] text-(--obra-muted-texto)">Só o engenheiro da obra (ou da obra mãe) ou um administrador registra medição. Você vê a lista.</p>
      ) : null}
      <p className="text-[13px] text-(--obra-muted-texto)">
        Ao marcar &quot;Cliente aprovou&quot;, o Financeiro vê a medição na fila de faturamento e liga a(s) nota(s) emitida(s). Medição com nota fica travada.
      </p>
    </div>
  )
}
