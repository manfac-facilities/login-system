'use client'

/**
 * Diário de obra no celular — os 5 passos do mockup `celular-supervisor.html`
 * (spec §5.3): 1 Equipe · 2 Fotos · 3 O que andou · 4 Impedimentos · 5 Amanhã.
 *
 * Tudo grava como rascunho (`salvarRascunhoAction`). Validar e enviar é da
 * Task 9b. O passo 4 é um slot: a Task 9a passa o formulário de impedimento em
 * `impedimentos`; sem ele aparece `PassoImpedimentosPendente`.
 *
 * "Sem execução hoje" esconde equipe e avanço e exige o motivo; o passo de
 * impedimento continua.
 */

import { useState, type ReactNode } from 'react'
import { salvarRascunhoAction } from './_actions'
import FotosDiario from './_fotos'
import type {
  AtividadeDiario,
  AvancoRdo,
  CausaNaoAndou,
  Clima,
  EstadoRdo,
  FotoRdo,
  RascunhoRdo,
} from './_tipos'

const CAUSAS: { valor: CausaNaoAndou; rotulo: string }[] = [
  { valor: 'cliente', rotulo: 'Cliente / loja' },
  { valor: 'material', rotulo: 'Material' },
  { valor: 'equipe', rotulo: 'Equipe' },
  { valor: 'clima', rotulo: 'Clima' },
  { valor: 'projeto', rotulo: 'Projeto' },
  { valor: 'outro', rotulo: 'Outro' },
]

const CLIMAS: { valor: Clima; rotulo: string }[] = [
  { valor: 'sol', rotulo: '☀ Sol' },
  { valor: 'nublado', rotulo: '☁ Nublado' },
  { valor: 'chuva', rotulo: '🌧 Chuva' },
  { valor: 'impraticavel', rotulo: '⛈ Impraticável' },
]

const pct = (x: number) => Math.round(x * 100)

/** Placeholder do passo 4 até a Task 9a entregar o formulário. */
export function PassoImpedimentosPendente() {
  return (
    <p className="text-sm text-[#94a3b8]">
      O registro de impedimentos e orientações entra aqui em breve. Por enquanto, avise o engenheiro da obra.
    </p>
  )
}

function Chip({
  ativo,
  onClick,
  disabled,
  children,
}: {
  ativo: boolean
  onClick: () => void
  disabled?: boolean
  children: ReactNode
}) {
  return (
    <button
      type="button"
      aria-pressed={ativo}
      disabled={disabled}
      onClick={onClick}
      className={
        'min-h-10 rounded-full border px-3 text-sm transition disabled:opacity-45 ' +
        (ativo ? 'border-[#f05a28] bg-[#f05a28] text-white' : 'border-[#1e3a5f] text-[#e8eef7] hover:border-[#f05a28]')
      }
    >
      {children}
    </button>
  )
}

function Passo({
  n,
  titulo,
  resumo,
  feito,
  aberto,
  onToggle,
  children,
}: {
  n: number
  titulo: string
  resumo: string
  feito: boolean
  aberto: boolean
  onToggle: () => void
  children: ReactNode
}) {
  return (
    <section className="rounded-xl border border-[#1e3a5f] bg-[#0a1628]">
      <button
        type="button"
        aria-expanded={aberto}
        onClick={onToggle}
        className="flex min-h-14 w-full items-center gap-3 px-3 py-2 text-left"
      >
        <span
          aria-hidden
          className={
            'flex h-7 w-7 flex-none items-center justify-center rounded-full border-2 text-sm font-semibold ' +
            (feito
              ? 'border-[#16a34a] bg-[#16a34a] text-white'
              : aberto
                ? 'border-[#f05a28] text-[#f05a28]'
                : 'border-[#1e3a5f] text-[#94a3b8]')
          }
        >
          {feito ? '✓' : n}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-semibold text-[#e8eef7]">{titulo}</span>
          <span className="block truncate text-xs text-[#94a3b8]">{resumo}</span>
        </span>
        <span aria-hidden className="text-[#94a3b8]">{aberto ? '▴' : '▾'}</span>
      </button>
      {aberto ? <div className="border-t border-[#1e3a5f] px-3 py-3">{children}</div> : null}
    </section>
  )
}

function CartaoAtividade({
  a,
  av,
  bloqueado,
  onChange,
}: {
  a: AtividadeDiario
  av: AvancoRdo
  bloqueado: boolean
  onChange: (av: AvancoRdo) => void
}) {
  const desabilitado = bloqueado || a.travada
  const naoAndou = !a.travada && !av.concluida && av.para <= av.de
  const mudarPara = (v: number) => onChange({ ...av, para: Math.min(100, Math.max(0, v)) / 100 })
  const valor = av.concluida ? 100 : pct(av.para)
  return (
    <div
      data-testid={`atividade-${a.numero}`}
      className={'rounded-lg border border-[#1e3a5f] bg-[#0d2050] p-3 ' + (a.travada ? 'opacity-60' : '')}
    >
      <p className="font-semibold text-[#e8eef7]">
        {a.travada ? <span aria-label="Travada" className="mr-1">🔒</span> : null}
        {a.numero} · {a.descricao}
      </p>
      {a.travada ? <p className="text-xs text-[#94a3b8]">{a.motivoTrava}</p> : null}

      <div className="mt-2 flex items-center gap-3">
        <input
          type="range"
          min={0}
          max={100}
          step={5}
          value={valor}
          disabled={desabilitado || av.concluida}
          aria-label={`Percentual da atividade ${a.numero}`}
          onChange={(e) => mudarPara(Number(e.target.value))}
          className="h-8 flex-1 accent-[#f05a28]"
        />
        <input
          type="number"
          inputMode="numeric"
          min={0}
          max={100}
          value={valor}
          disabled={desabilitado || av.concluida}
          aria-label={`Percentual digitado da atividade ${a.numero}`}
          onChange={(e) => mudarPara(Number(e.target.value) || 0)}
          className="min-h-11 w-20 rounded-lg border border-[#1e3a5f] bg-[#0a1628] px-2 text-right text-base text-[#e8eef7]"
        />
        <span className="text-sm text-[#94a3b8]">%</span>
      </div>
      <p className="mt-1 text-xs text-[#94a3b8]">
        antes {pct(av.de)}% → <b className="text-[#e8eef7]">hoje {valor}%</b>
      </p>

      <label className="mt-2 flex min-h-11 items-center gap-2 text-sm text-[#e8eef7]">
        <input
          type="checkbox"
          checked={av.concluida}
          disabled={desabilitado}
          onChange={(e) => onChange({ ...av, concluida: e.target.checked, causa: e.target.checked ? null : av.causa })}
          className="h-5 w-5 accent-[#16a34a]"
        />
        Concluída hoje
      </label>

      {naoAndou ? (
        <div className="mt-1">
          <p className="text-xs text-[#fca5a5]">
            {av.para < av.de ? 'o percentual caiu → por quê? (obrigatório)' : 'não andou → por quê?'}
          </p>
          <div className="mt-1 flex flex-wrap gap-2">
            {CAUSAS.map((c) => (
              <Chip
                key={c.valor}
                ativo={av.causa === c.valor}
                disabled={bloqueado}
                onClick={() => onChange({ ...av, causa: av.causa === c.valor ? null : c.valor })}
              >
                {c.rotulo}
              </Chip>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}

export default function PassosDiario({
  obraId,
  data,
  rdoId: rdoInicial,
  estado,
  inicial,
  atividades,
  fotos,
  impedimentos,
}: {
  obraId: string
  data: string
  rdoId: string | null
  estado: EstadoRdo | null
  inicial: RascunhoRdo
  atividades: AtividadeDiario[]
  fotos: FotoRdo[]
  /** Passo 4 (Task 9a). */
  impedimentos?: ReactNode
}) {
  const [corpo, setCorpo] = useState<RascunhoRdo>(inicial)
  const [rdoId, setRdoId] = useState<string | null>(rdoInicial)
  const [aberto, setAberto] = useState<number | null>(null)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [qtdFotos, setQtdFotos] = useState(fotos.length)

  const somenteLeitura = estado !== null && estado !== 'rascunho'
  const mudar = (p: Partial<RascunhoRdo>) => setCorpo((c) => ({ ...c, ...p }))
  const mudarAvanco = (av: AvancoRdo) =>
    setCorpo((c) => ({ ...c, avancos: c.avancos.map((x) => (x.numero === av.numero ? av : x)) }))
  const alternar = (n: number) => setAberto((a) => (a === n ? null : n))

  function validar(): string | null {
    if (corpo.semExecucao && !corpo.motivoSemExecucao?.trim()) return 'Diga o motivo de não ter tido execução hoje'
    if (!corpo.semExecucao) {
      const caiu = corpo.avancos.find((a) => !a.concluida && a.para < a.de && !a.causa)
      if (caiu) return `Atividade ${caiu.numero}: o percentual caiu — diga por quê`
    }
    return null
  }

  async function salvar(): Promise<string | null> {
    const problema = validar()
    if (problema) {
      setErro(problema)
      return null
    }
    setSalvando(true)
    setErro(null)
    setAviso(null)
    try {
      const r = await salvarRascunhoAction(obraId, data, corpo)
      if (!r.ok) {
        setErro(r.erro)
        return null
      }
      setRdoId(r.rdoId ?? null)
      setAviso(`Rascunho salvo às ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`)
      return r.rdoId ?? null
    } catch {
      setErro('Não deu para salvar. Confira a conexão e tente de novo.')
      return null
    } finally {
      setSalvando(false)
    }
  }

  const porNumero = new Map(corpo.avancos.map((a) => [a.numero, a]))
  const livres = atividades.filter((a) => !a.travada)
  const mexidas = livres.filter((a) => {
    const av = porNumero.get(a.numero)
    return av && (av.concluida || av.para !== av.de || av.causa)
  }).length

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-3 pb-24">
      {somenteLeitura ? (
        <p className="rounded-lg border border-[#16a34a] bg-[#16a34a1a] px-3 py-2 text-sm text-[#e8eef7]">
          {estado === 'enviado' ? 'Diário já enviado' : 'Diário já validado'} — não dá mais para alterar.
        </p>
      ) : null}

      <div className="rounded-xl border border-[#1e3a5f] bg-[#0a1628] px-3 py-2">
        <label className="flex min-h-11 items-center gap-3 text-[#e8eef7]">
          <input
            type="checkbox"
            checked={corpo.semExecucao}
            disabled={somenteLeitura}
            onChange={(e) => mudar({ semExecucao: e.target.checked })}
            className="h-5 w-5 accent-[#f05a28]"
          />
          <span className="font-semibold">Sem execução hoje</span>
        </label>
        {corpo.semExecucao ? (
          <div className="flex flex-col gap-2 pb-2">
            <label className="flex flex-col gap-1 text-xs text-[#94a3b8]">
              Motivo (obrigatório)
              <textarea
                value={corpo.motivoSemExecucao ?? ''}
                disabled={somenteLeitura}
                onChange={(e) => mudar({ motivoSemExecucao: e.target.value })}
                rows={2}
                placeholder="ex.: área não liberada pela loja"
                className="rounded-lg border border-[#1e3a5f] bg-[#0d2050] px-3 py-2 text-base text-[#e8eef7]"
              />
            </label>
            <div className="flex flex-wrap gap-2">
              {CLIMAS.map((c) => (
                <Chip
                  key={c.valor}
                  ativo={corpo.clima === c.valor}
                  disabled={somenteLeitura}
                  onClick={() => mudar({ clima: corpo.clima === c.valor ? null : c.valor })}
                >
                  {c.rotulo}
                </Chip>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      {!corpo.semExecucao ? (
        <Passo
          n={1}
          titulo="Equipe"
          resumo={corpo.efetivo !== null ? `${corpo.efetivo} pessoa(s)` : 'quantas pessoas, qual equipe, clima'}
          feito={corpo.efetivo !== null}
          aberto={aberto === 1}
          onToggle={() => alternar(1)}
        >
          <div className="flex flex-col gap-3">
            <label className="flex flex-col gap-1 text-xs text-[#94a3b8]">
              Efetivo (nº de pessoas)
              <input
                type="number"
                inputMode="numeric"
                min={0}
                value={corpo.efetivo ?? ''}
                disabled={somenteLeitura}
                onChange={(e) => mudar({ efetivo: e.target.value === '' ? null : Math.max(0, Math.trunc(Number(e.target.value))) })}
                className="min-h-11 rounded-lg border border-[#1e3a5f] bg-[#0d2050] px-3 text-base text-[#e8eef7]"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-[#94a3b8]">
              Empresa / equipe
              <input
                value={corpo.equipeTexto ?? ''}
                disabled={somenteLeitura}
                onChange={(e) => mudar({ equipeTexto: e.target.value })}
                placeholder="ex.: equipe própria + 2 da elétrica"
                className="min-h-11 rounded-lg border border-[#1e3a5f] bg-[#0d2050] px-3 text-base text-[#e8eef7]"
              />
            </label>
            <div>
              <p className="mb-1 text-xs text-[#94a3b8]">Clima</p>
              <div className="flex flex-wrap gap-2">
                {CLIMAS.map((c) => (
                  <Chip
                    key={c.valor}
                    ativo={corpo.clima === c.valor}
                    disabled={somenteLeitura}
                    onClick={() => mudar({ clima: corpo.clima === c.valor ? null : c.valor })}
                  >
                    {c.rotulo}
                  </Chip>
                ))}
              </div>
            </div>
          </div>
        </Passo>
      ) : null}

      <Passo
        n={2}
        titulo="Fotos"
        resumo={qtdFotos ? `${qtdFotos} foto(s)` : 'várias por dia, com legenda'}
        feito={qtdFotos > 0}
        aberto={aberto === 2}
        onToggle={() => alternar(2)}
      >
        <FotosDiario
          obraId={obraId}
          data={data}
          fotos={fotos}
          desabilitado={somenteLeitura}
          garantirRdo={async () => rdoId ?? (await salvar())}
          onQuantidade={setQtdFotos}
        />
      </Passo>

      {!corpo.semExecucao ? (
        <Passo
          n={3}
          titulo="O que andou"
          resumo={atividades.length ? `${mexidas} de ${livres.length} atividade(s) atualizada(s)` : 'nenhuma atividade prevista até hoje'}
          feito={livres.length > 0 && mexidas === livres.length}
          aberto={aberto === 3}
          onToggle={() => alternar(3)}
        >
          {atividades.length ? (
            <div className="flex flex-col gap-2">
              {atividades.map((a) => {
                const av = porNumero.get(a.numero)
                return av ? (
                  <CartaoAtividade key={a.numero} a={a} av={av} bloqueado={somenteLeitura} onChange={mudarAvanco} />
                ) : null
              })}
            </div>
          ) : (
            <p className="text-sm text-[#94a3b8]">Nenhuma atividade em andamento ou prevista até hoje.</p>
          )}
        </Passo>
      ) : null}

      <Passo
        n={4}
        titulo="Impedimentos"
        resumo="loja, clima, material…"
        feito={false}
        aberto={aberto === 4}
        onToggle={() => alternar(4)}
      >
        {impedimentos ?? <PassoImpedimentosPendente />}
      </Passo>

      <Passo
        n={5}
        titulo="Amanhã"
        resumo={corpo.programacaoAmanha ? 'programação preenchida' : 'sugerido pelo cronograma'}
        feito={!!corpo.programacaoAmanha?.trim()}
        aberto={aberto === 5}
        onToggle={() => alternar(5)}
      >
        <label className="flex flex-col gap-1 text-xs text-[#94a3b8]">
          Programação de amanhã
          <textarea
            value={corpo.programacaoAmanha ?? ''}
            disabled={somenteLeitura}
            onChange={(e) => mudar({ programacaoAmanha: e.target.value })}
            rows={4}
            className="rounded-lg border border-[#1e3a5f] bg-[#0d2050] px-3 py-2 text-base text-[#e8eef7]"
          />
        </label>
      </Passo>

      {erro ? (
        <p role="alert" className="rounded-lg border border-[#ff4d6d] bg-[#ff4d6d1a] px-3 py-2 text-sm text-[#ff4d6d]">
          {erro}
        </p>
      ) : null}
      {aviso ? <p className="text-center text-xs text-[#94a3b8]">{aviso}</p> : null}

      {!somenteLeitura ? (
        <div className="fixed inset-x-0 bottom-0 z-10 border-t border-[#1e3a5f] bg-[#0a1628]/95 px-4 py-3">
          <div className="mx-auto max-w-xl">
            <button
              type="button"
              disabled={salvando}
              onClick={() => void salvar()}
              className="min-h-12 w-full rounded-xl bg-[#f05a28] text-base font-bold text-white disabled:opacity-45"
            >
              {salvando ? 'Salvando…' : 'Salvar rascunho'}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
