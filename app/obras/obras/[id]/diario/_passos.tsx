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
import ValidarDiario from './_validar'
import { ClimaTurnos } from './_clima'
import { IconeCadeado, IconeCheck } from '../../_ui/icones'
import { Chevron } from '../cronograma/_barra-ferramentas'
import type {
  AtividadeDiario,
  AvancoRdo,
  CausaNaoAndou,
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

const pct = (x: number) => Math.round(x * 100)

/** Placeholder do passo 4 até a Task 9a entregar o formulário. */
export function PassoImpedimentosPendente() {
  return (
    <p className="text-sm text-[#5a7380]">
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
        'min-h-11 rounded-full border px-3 text-sm transition disabled:opacity-45 ' +
        (ativo ? 'border-[#b94606] bg-[#b94606] text-white' : 'border-[#dadad8] text-[#333336] hover:border-[#b94606]')
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
    <section className="rounded-xl border border-[#dadad8] bg-[#ffffff]">
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
              ? 'border-[#136c38] bg-[#136c38] text-white'
              : aberto
                ? 'border-[#b94606] text-[#b94606]'
                : 'border-[#dadad8] text-[#5a7380]')
          }
        >
          {feito ? <IconeCheck tamanho={16} /> : n}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-semibold text-[#333336]">
            {titulo}
            {feito ? <span className="sr-only"> — preenchido</span> : null}
          </span>
          <span className="block truncate text-xs text-[#5a7380]">{resumo}</span>
        </span>
        <span aria-hidden className="text-[#5a7380]">
          <Chevron aberto={aberto} tamanho={18} />
        </span>
      </button>
      {aberto ? <div className="border-t border-[#dadad8] px-3 py-3">{children}</div> : null}
    </section>
  )
}

function CartaoAtividade({
  a,
  av,
  bloqueado,
  noPlano = false,
  onChange,
}: {
  a: AtividadeDiario
  av: AvancoRdo
  bloqueado: boolean
  noPlano?: boolean
  onChange: (av: AvancoRdo) => void
}) {
  const desabilitado = bloqueado || a.travada
  const naoAndou = !a.travada && !av.concluida && av.para <= av.de
  const mudarPara = (v: number) => onChange({ ...av, para: Math.min(100, Math.max(0, v)) / 100 })
  const valor = av.concluida ? 100 : pct(av.para)
  return (
    <div
      data-testid={`atividade-${a.numero}`}
      className={'rounded-lg border border-[#dadad8] bg-[#f6f6f5] p-3 ' + (a.travada ? 'opacity-60' : '')}
    >
      <p className="font-semibold text-[#333336]">
        {a.travada ? (
          <span role="img" aria-label="Travada" className="mr-1 inline-block align-[-2px] text-[#5a7380]">
            <IconeCadeado tamanho={15} />
          </span>
        ) : null}
        {a.numero} · {a.descricao}
        {noPlano ? (
          <span className="ml-2 inline-block rounded-full border border-[#00345e] px-2 py-0.5 align-middle text-xs font-semibold text-[#00345e]">
            no plano
          </span>
        ) : null}
      </p>
      {a.travada ? <p className="text-xs text-[#5a7380]">{a.motivoTrava}</p> : null}

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
          className="h-8 flex-1 accent-[#b94606]"
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
          className="min-h-11 w-20 rounded-lg border border-[#dadad8] bg-[#ffffff] px-2 text-right text-base text-[#333336]"
        />
        <span className="text-sm text-[#5a7380]">%</span>
      </div>
      <p className="mt-1 text-xs text-[#5a7380]">
        antes {pct(av.de)}% → <b className="text-[#333336]">hoje {valor}%</b>
      </p>

      <label className="mt-2 flex min-h-11 items-center gap-2 text-sm text-[#333336]">
        <input
          type="checkbox"
          checked={av.concluida}
          disabled={desabilitado}
          onChange={(e) => onChange({ ...av, concluida: e.target.checked, causa: e.target.checked ? null : av.causa })}
          className="h-5 w-5 accent-[#136c38]"
        />
        Concluída hoje
      </label>

      {naoAndou ? (
        <div className="mt-1">
          <p className="text-xs text-[#b23232]">
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

const normal = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

/**
 * "Incluir outra atividade" (itens 6/11 da reunião de 31/10): qualquer atividade
 * não concluída da versão vigente, agrupada por etapa, com busca. A trava vale
 * igual (a travada entra com cadeado; o servidor confere de novo).
 */
function IncluirAtividade({ opcoes, onIncluir }: { opcoes: AtividadeDiario[]; onIncluir: (a: AtividadeDiario) => void }) {
  const [aberto, setAberto] = useState(false)
  const [busca, setBusca] = useState('')
  const termo = normal(busca.trim())
  const filtradas = termo
    ? opcoes.filter((a) => normal(`${a.numero} ${a.descricao} ${a.etapa}`).includes(termo))
    : opcoes
  const etapas: [string, AtividadeDiario[]][] = []
  for (const a of filtradas) {
    const g = etapas.find(([e]) => e === a.etapa)
    if (g) g[1].push(a)
    else etapas.push([a.etapa, [a]])
  }
  return (
    <div className="mt-3 flex flex-col gap-2">
      <button
        type="button"
        aria-expanded={aberto}
        onClick={() => setAberto((v) => !v)}
        className="min-h-11 rounded-lg border border-dashed border-[#b94606] px-3 text-sm font-semibold text-[#b94606]"
      >
        Incluir outra atividade
      </button>
      {aberto ? (
        <section aria-label="Incluir outra atividade" className="flex flex-col gap-2 rounded-lg border border-[#dadad8] p-2">
          <input
            type="search"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            aria-label="Buscar atividade"
            placeholder="buscar por nome, número ou etapa"
            className="min-h-11 rounded-lg border border-[#dadad8] bg-[#f6f6f5] px-3 text-base text-[#333336]"
          />
          {etapas.length ? (
            <div className="flex max-h-80 flex-col gap-2 overflow-y-auto">
              {etapas.map(([etapa, itens]) => (
                <div key={etapa} role="group" aria-label={etapa}>
                  <p className="px-1 text-xs font-semibold uppercase text-[#5a7380]">{etapa}</p>
                  {itens.map((a) => (
                    <button
                      key={a.numero}
                      type="button"
                      onClick={() => {
                        onIncluir(a)
                        setAberto(false)
                        setBusca('')
                      }}
                      className="flex min-h-11 w-full items-center gap-2 rounded-lg px-2 text-left text-sm text-[#333336] hover:bg-[#f6f6f5]"
                    >
                      {a.travada ? (
                        <span role="img" aria-label="Travada" className="text-[#5a7380]">
                          <IconeCadeado tamanho={14} />
                        </span>
                      ) : null}
                      <span className="flex-1">
                        {a.numero} · {a.descricao}
                      </span>
                      <span className="text-xs text-[#5a7380]">{pct(a.atual)}%</span>
                    </button>
                  ))}
                </div>
              ))}
            </div>
          ) : (
            <p className="px-1 text-sm text-[#5a7380]">
              {opcoes.length ? 'Nenhuma atividade encontrada.' : 'Todas as atividades em aberto já estão na lista.'}
            </p>
          )}
        </section>
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
  outras = [],
  noPlano = [],
  fotos,
  impedimentos,
  impedimentosHoje = 0,
  validacao,
}: {
  obraId: string
  data: string
  rdoId: string | null
  estado: EstadoRdo | null
  inicial: RascunhoRdo
  atividades: AtividadeDiario[]
  /** Demais atividades não concluídas da versão, para incluir à mão. */
  outras?: AtividadeDiario[]
  /** Números das atividades do plano da semana (vêm primeiro, com selo). */
  noPlano?: number[]
  fotos: FotoRdo[]
  /** Passo 4 (Task 9a). */
  impedimentos?: ReactNode
  /** Impedimentos registrados para o dia do diário: com algum, o passo 4 está preenchido. */
  impedimentosHoje?: number
  /** "Validar e enviar" (engenheiro/admin); ausente = não mostra. */
  validacao?: { previaHtml: string | null; pendentes: number | null }
}) {
  const [corpo, setCorpo] = useState<RascunhoRdo>(inicial)
  const [rdoId, setRdoId] = useState<string | null>(rdoInicial)
  const [aberto, setAberto] = useState<number | null>(null)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [qtdFotos, setQtdFotos] = useState(fotos.length)
  const [incluidas, setIncluidas] = useState<AtividadeDiario[]>([])

  const somenteLeitura = estado !== null && estado !== 'rascunho'
  const mudar = (p: Partial<RascunhoRdo>) => setCorpo((c) => ({ ...c, ...p }))
  const mudarAvanco = (av: AvancoRdo) =>
    setCorpo((c) => ({ ...c, avancos: c.avancos.map((x) => (x.numero === av.numero ? av : x)) }))
  const incluir = (a: AtividadeDiario) => {
    setIncluidas((l) => [...l, a])
    // Entra com "de" = % atual da execução (o servidor confirma).
    setCorpo((c) =>
      c.avancos.some((x) => x.numero === a.numero)
        ? c
        : { ...c, avancos: [...c.avancos, { numero: a.numero, de: a.atual, para: a.atual, concluida: false, causa: null }] },
    )
  }
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
      // Com impedimento registrado no dia, o "sem impedimentos" não vale mais.
      const r = await salvarRascunhoAction(obraId, data, { ...corpo, semImpedimento })
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

  const semImpedimento = corpo.semImpedimento && impedimentosHoje === 0
  const porNumero = new Map(corpo.avancos.map((a) => [a.numero, a]))
  const doPlano = new Set(noPlano)
  const juntas = [...atividades, ...incluidas]
  const lista = [...juntas.filter((a) => doPlano.has(a.numero)), ...juntas.filter((a) => !doPlano.has(a.numero))]
  const naLista = new Set(lista.map((a) => a.numero))
  const livres = lista.filter((a) => !a.travada)
  const mexidas = livres.filter((a) => {
    const av = porNumero.get(a.numero)
    return av && (av.concluida || av.para !== av.de || av.causa)
  }).length

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-3 pb-24">
      {somenteLeitura ? (
        <p className="rounded-lg border border-[#136c38] bg-[#1f9d551a] px-3 py-2 text-sm text-[#333336]">
          {estado === 'enviado' ? 'Diário já enviado' : 'Diário já validado'} — não dá mais para alterar.
        </p>
      ) : null}

      <div className="rounded-xl border border-[#dadad8] bg-[#ffffff] px-3 py-2">
        <label className="flex min-h-11 items-center gap-3 text-[#333336]">
          <input
            type="checkbox"
            checked={corpo.semExecucao}
            disabled={somenteLeitura}
            onChange={(e) => mudar({ semExecucao: e.target.checked })}
            className="h-5 w-5 accent-[#b94606]"
          />
          <span className="font-semibold">Sem execução hoje</span>
        </label>
        {corpo.semExecucao ? (
          <div className="flex flex-col gap-2 pb-2">
            <label className="flex flex-col gap-1 text-xs text-[#5a7380]">
              Motivo (obrigatório)
              <textarea
                value={corpo.motivoSemExecucao ?? ''}
                disabled={somenteLeitura}
                onChange={(e) => mudar({ motivoSemExecucao: e.target.value })}
                rows={2}
                placeholder="ex.: área não liberada pela loja"
                className="rounded-lg border border-[#dadad8] bg-[#f6f6f5] px-3 py-2 text-base text-[#333336]"
              />
            </label>
            <ClimaTurnos corpo={corpo} mudar={mudar} somenteLeitura={somenteLeitura} />
          </div>
        ) : null}
      </div>

      {!corpo.semExecucao ? (
        <Passo
          n={1}
          titulo="Equipe"
          resumo={corpo.efetivo !== null ? `${corpo.efetivo} pessoa(s)` : 'quantas pessoas, qual equipe, clima do dia'}
          feito={corpo.efetivo !== null}
          aberto={aberto === 1}
          onToggle={() => alternar(1)}
        >
          <div className="flex flex-col gap-3">
            <label className="flex flex-col gap-1 text-xs text-[#5a7380]">
              Efetivo (nº de pessoas)
              <input
                type="number"
                inputMode="numeric"
                min={0}
                value={corpo.efetivo ?? ''}
                disabled={somenteLeitura}
                onChange={(e) => mudar({ efetivo: e.target.value === '' ? null : Math.max(0, Math.trunc(Number(e.target.value))) })}
                className="min-h-11 rounded-lg border border-[#dadad8] bg-[#f6f6f5] px-3 text-base text-[#333336]"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-[#5a7380]">
              Empresa / equipe
              <input
                value={corpo.equipeTexto ?? ''}
                disabled={somenteLeitura}
                onChange={(e) => mudar({ equipeTexto: e.target.value })}
                placeholder="ex.: equipe própria + 2 da elétrica"
                className="min-h-11 rounded-lg border border-[#dadad8] bg-[#f6f6f5] px-3 text-base text-[#333336]"
              />
            </label>
            <ClimaTurnos corpo={corpo} mudar={mudar} somenteLeitura={somenteLeitura} />
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
          resumo={lista.length ? `${mexidas} de ${livres.length} atividade(s) atualizada(s)` : 'nenhuma atividade prevista até hoje'}
          feito={livres.length > 0 && mexidas === livres.length}
          aberto={aberto === 3}
          onToggle={() => alternar(3)}
        >
          {lista.length ? (
            <div className="flex flex-col gap-2">
              {lista.map((a) => {
                const av = porNumero.get(a.numero)
                return av ? (
                  <CartaoAtividade key={a.numero} a={a} av={av} bloqueado={somenteLeitura} noPlano={doPlano.has(a.numero)} onChange={mudarAvanco} />
                ) : null
              })}
            </div>
          ) : (
            <p className="text-sm text-[#5a7380]">Nenhuma atividade em andamento ou prevista até hoje.</p>
          )}
          {!somenteLeitura ? (
            <IncluirAtividade opcoes={outras.filter((a) => !naLista.has(a.numero))} onIncluir={incluir} />
          ) : null}
        </Passo>
      ) : null}

      <Passo
        n={4}
        titulo="Impedimentos"
        resumo={
          impedimentosHoje > 0
            ? `${impedimentosHoje} registrado(s) hoje`
            : semImpedimento
              ? 'sem impedimentos hoje'
              : 'loja, clima, material…'
        }
        feito={impedimentosHoje > 0 || semImpedimento}
        aberto={aberto === 4}
        onToggle={() => alternar(4)}
      >
        {impedimentosHoje === 0 ? (
          <label className="mb-3 flex min-h-11 items-center gap-3 rounded-lg border border-[#dadad8] bg-[#f6f6f5] px-3 text-[#333336]">
            <input
              type="checkbox"
              checked={corpo.semImpedimento}
              disabled={somenteLeitura}
              onChange={(e) => mudar({ semImpedimento: e.target.checked })}
              className="h-5 w-5 accent-[#136c38]"
            />
            <span className="font-semibold">Sem impedimentos hoje</span>
          </label>
        ) : null}
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
        <label className="flex flex-col gap-1 text-xs text-[#5a7380]">
          Programação de amanhã
          <textarea
            value={corpo.programacaoAmanha ?? ''}
            disabled={somenteLeitura}
            onChange={(e) => mudar({ programacaoAmanha: e.target.value })}
            rows={4}
            className="rounded-lg border border-[#dadad8] bg-[#f6f6f5] px-3 py-2 text-base text-[#333336]"
          />
        </label>
      </Passo>

      {erro ? (
        <p role="alert" className="rounded-lg border border-[#b23232] bg-[#d645451a] px-3 py-2 text-sm text-[#b23232]">
          {erro}
        </p>
      ) : null}
      {aviso ? <p className="text-center text-xs text-[#5a7380]">{aviso}</p> : null}

      {validacao ? (
        <ValidarDiario
          obraId={obraId}
          data={data}
          estado={estado ?? 'rascunho'}
          previaHtml={validacao.previaHtml}
          pendentes={validacao.pendentes}
          salvarAntes={async () => (await salvar()) !== null}
        />
      ) : null}

      {!somenteLeitura ? (
        // No celular fica acima do menu inferior do ShellObra (56px + borda); no computador, à direita da sidebar.
        <div className="fixed inset-x-0 bottom-[calc(57px+env(safe-area-inset-bottom))] z-30 border-t border-[#dadad8] bg-[#ffffff]/95 px-4 py-3 lg:bottom-0 lg:left-[240px]">
          <div className="mx-auto max-w-xl">
            <button
              type="button"
              disabled={salvando}
              onClick={() => void salvar()}
              className="min-h-12 w-full rounded-xl bg-[#b94606] text-base font-bold text-white disabled:opacity-45"
            >
              {salvando ? 'Salvando…' : 'Salvar rascunho'}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
