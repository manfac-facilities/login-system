'use client'

/**
 * Um cartão do diário — uma obra, as três perguntas, um botão.
 *
 * As perguntas são as do mockup aprovado, literalmente: "Andou hoje?",
 * "Faltou algum item?", "Por que não andou?". Não reescrever rótulo aprovado.
 *
 * ÚNICA TRAVA DE SALVAMENTO (decisão C, fechada com o cliente): "não andou"
 * exige motivo. Nada mais barra — nem item, nem observação, nem foto. Toda
 * validação nova que aparecer aqui é regressão de produto, não melhoria.
 *
 * DESENHADO PARA O CELULAR, porque é onde vai ser usado: um cartão por vez,
 * chips de toque grande (44px de altura mínima), nada de tabela lateral, e o
 * botão de salvar sempre visível no fim do cartão.
 */

import { useState, useTransition } from 'react'
import Link from 'next/link'
import {
  BLOQUEIOS,
  COR_SEV,
  ITENS,
  NAO_FALTOU,
  br,
  critico,
  destinoDe,
  encerrada,
  estourou,
  pedeFoto,
  posCampo,
  prazoTxt,
  sev,
  travado,
  type Obra,
} from '../_lib/tipos'
import { Pill, PillEtapa, Botao } from '../_ui/primitivos'
import BotaoFoto from './_foto'
import { salvarDiarioAction } from './_actions'

export type Pessoa = { nome: string; area: string | null }

type Resposta = { andou: 'Sim' | 'Não' | null; item: string; motivo: string | null }

/** `validar(mockup:2714)`. As duas únicas mensagens que barram o salvamento. */
export function validar(d: Resposta): string | null {
  if (!d.andou) return 'Responda se a obra andou hoje.'
  if (d.andou === 'Não' && !d.motivo) return 'Diga por que não andou.'
  return null
}

/**
 * O texto ao lado do botão descreve SEMPRE o que o botão vai fazer de verdade.
 * Quando faltou alguma coisa, ele diz para quem a tarefa vai ANTES de ela ir —
 * quem responde não pode ser surpreendido por uma cobrança que ele disparou sem
 * saber. `textoAcao(mockup:2722)`.
 */
export function textoAcao(d: Resposta, hoje: string, pessoas: Record<string, Pessoa>): string {
  const rota = d.item && d.item !== NAO_FALTOU ? destinoDe(d.item) : null
  let extra = ''
  if (rota) {
    const p = pessoas[rota.chave]
    const quem = p ? `${p.area ?? 'Obras'} · ${p.nome.split(' ')[0]}` : rota.chave
    extra = ` Abre tarefa para ${quem}.`
  }
  const dia = br(hoje).slice(0, 5)
  if (d.andou === 'Sim') {
    return `Ao salvar: a obra sai da fila e hoje (${dia}) entra na ficha dela como dia que andou.${extra}`
  }
  if (d.andou === 'Não') {
    return `Ao salvar: a obra sai da fila e hoje (${dia}) entra na ficha dela como dia parado por ${String(
      d.motivo
    ).toLowerCase()}.${extra}`
  }
  return ''
}

/** `notaAlerta(mockup:1908)` — UMA nota por obra, nunca duas. */
function notaAlerta(o: Obra): string | null {
  if (encerrada(o) || posCampo(o)) return null
  if (o.etapa === 'definir') return 'Sem responsável, sem equipe e sem cronograma'
  if (critico(o)) {
    let t = o.duracao ? `Planejada para ${o.duracao} dias` : 'Aberta sem duração planejada'
    if (travado(o)) t += ` · ${o.bloqueada_dias} dias no mesmo bloqueio`
    return t
  }
  if (estourou(o) && travado(o)) {
    return `Planejada para ${o.duracao} dias · ${o.bloqueada_dias} dias no mesmo bloqueio`
  }
  if (estourou(o)) return `Planejada para ${o.duracao} dias e ainda em aberto`
  if (travado(o)) return `Mesmo bloqueio há ${o.bloqueada_dias} dias · ${o.bloqueio}`
  return null
}

function Chips({
  rotulo,
  opcoes,
  valor,
  onEscolher,
  cores,
}: {
  rotulo: string
  opcoes: readonly string[]
  valor: string | null
  onEscolher: (v: string) => void
  cores?: boolean
}) {
  return (
    <div className="mt-3">
      <span className="block text-[13px] font-medium text-[#94a3b8]">{rotulo}</span>
      <div className="mt-1.5 flex flex-wrap gap-2" role="group" aria-label={rotulo}>
        {opcoes.map((v) => {
          const ativo = valor === v
          let cor = 'border-[#1e3a5f] text-[#94a3b8]'
          if (ativo) cor = 'border-[#f05a28] bg-[#f05a28] text-white'
          if (ativo && cores && v === 'Sim') cor = 'border-[#35c98a] bg-[#35c98a] text-[#06231a]'
          if (ativo && cores && v === 'Não') cor = 'border-[#f4b73f] bg-[#f4b73f] text-[#2b1d02]'
          return (
            <button
              key={v}
              type="button"
              aria-pressed={ativo}
              onClick={() => onEscolher(v)}
              className={`min-h-11 rounded-full border px-3.5 py-2 text-sm font-medium transition hover:border-[#f05a28] ${cor}`}
            >
              {v}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default function Cartao({
  obra,
  hoje,
  pessoas,
  mostrarResponsavel,
  aoSalvar,
}: {
  obra: Obra
  hoje: string
  pessoas: Record<string, Pessoa>
  mostrarResponsavel?: boolean
  aoSalvar: () => void
}) {
  const [andou, setAndou] = useState<'Sim' | 'Não' | null>(null)
  const [item, setItem] = useState<string>(NAO_FALTOU)
  const [motivo, setMotivo] = useState<string | null>(null)
  const [obs, setObs] = useState('')
  const [obsAberta, setObsAberta] = useState(false)
  const [fotoPath, setFotoPath] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [saindo, setSaindo] = useState(false)
  const [pendente, iniciar] = useTransition()

  const d: Resposta = { andou, item, motivo }
  const problema = validar(d)
  const hint = erro ?? problema ?? textoAcao(d, hoje, pessoas)
  const nota = notaAlerta(obra)
  const corSev = COR_SEV[sev(obra)]

  function salvar() {
    if (problema) return
    setErro(null)
    iniciar(async () => {
      const r = await salvarDiarioAction({
        obraId: obra.id,
        andou: andou === 'Sim',
        item,
        motivo: andou === 'Não' ? motivo : null,
        obs,
        fotoPath,
      })
      if (r.error) {
        setErro(r.error)
        return
      }
      setSaindo(true)
      aoSalvar()
    })
  }

  return (
    <article
      className={`overflow-hidden rounded-lg border border-[#1e3a5f] bg-[#0d2050] transition-opacity ${
        saindo ? 'opacity-40' : 'opacity-100'
      }`}
      style={{ borderLeft: `3px solid ${corSev}` }}
    >
      <div className="px-4 py-3.5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="text-[11px] uppercase tracking-wide text-[#94a3b8]">
              OS {obra.os ?? '—'} · {obra.tipo ?? '—'}
            </div>
            <Link
              href={`/obras/obra/${obra.id}`}
              className="mt-0.5 block text-base font-semibold text-[#e8eef7] underline-offset-4 hover:text-[#f05a28] hover:underline"
            >
              {obra.loja ?? 'Obra sem loja'}
            </Link>
            {obra.descricao ? (
              <p className="mt-1 text-sm text-[#94a3b8]">{obra.descricao}</p>
            ) : null}
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-[#94a3b8]">
              <span>
                Equipe <b className="text-[#e8eef7]">{obra.equipe || 'sem equipe'}</b>
              </span>
              <span>
                Analista <b className="text-[#e8eef7]">{obra.analista_cliente || '—'}</b>
              </span>
              {mostrarResponsavel ? (
                <span>
                  Responsável <b className="text-[#e8eef7]">{obra.pcm || 'a definir'}</b>
                </span>
              ) : null}
              <span>
                Prazo <b className="text-[#e8eef7]">{prazoTxt(obra)}</b>
              </span>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <PillEtapa etapa={obra.etapa} cor={corSev} />
            {obra.mau_uso ? <Pill>Mau uso</Pill> : null}
            <span className="text-[12px] text-[#94a3b8]">
              <b className="text-[#e8eef7]">{obra.diasAlerta ?? '—'}</b> dias em aberto
            </span>
          </div>
        </div>

        {nota ? <p className="mt-2 text-[12px] text-[#f4b73f]">{nota}</p> : null}

        {obra.pendencia ? (
          <p className="mt-2 rounded border border-[#1e3a5f] bg-[#0a1628] px-3 py-2 text-[12px] text-[#94a3b8]">
            <b className="text-[#e8eef7]">Pendência:</b> {obra.pendencia}
            {obra.pend_resp ? (
              <>
                {' '}
                · responsável <b className="text-[#e8eef7]">{obra.pend_resp}</b>
              </>
            ) : null}
          </p>
        ) : null}

        <Contador obra={obra} />

        <Chips
          rotulo="Andou hoje?"
          opcoes={['Sim', 'Não']}
          valor={andou}
          cores
          onEscolher={(v) => {
            setAndou(v as 'Sim' | 'Não')
            if (v === 'Sim') setMotivo(null)
          }}
        />
        <Chips rotulo="Faltou algum item?" opcoes={ITENS} valor={item} onEscolher={setItem} />
        {andou === 'Não' ? (
          <Chips
            rotulo="Por que não andou?"
            opcoes={BLOQUEIOS}
            valor={motivo}
            onEscolher={setMotivo}
          />
        ) : null}

        <div className="mt-3 flex flex-wrap items-start gap-2">
          {obsAberta ? null : (
            <button
              type="button"
              onClick={() => setObsAberta(true)}
              className="min-h-11 rounded-md border border-[#1e3a5f] px-3 py-2 text-sm text-[#94a3b8] hover:border-[#f05a28] hover:text-[#e8eef7]"
            >
              + observação
            </button>
          )}
          {pedeFoto(obra) ? (
            <BotaoFoto
              obraId={obra.id}
              data={hoje}
              valor={fotoPath}
              onChange={setFotoPath}
              desabilitado={pendente}
            />
          ) : null}
        </div>
        {obsAberta ? (
          <input
            type="text"
            maxLength={120}
            value={obs}
            autoFocus
            onChange={(e) => setObs(e.target.value)}
            placeholder="Uma linha, se quiser"
            aria-label="Observação"
            className="mt-2 w-full rounded-md border border-[#1e3a5f] bg-[#0f1f3d] px-3 py-2.5 text-sm text-[#e8eef7] placeholder:text-[#4a6080] focus:border-[#f05a28] focus:outline-none"
          />
        ) : null}

        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
          <Botao onClick={salvar} disabled={!!problema || pendente || saindo}>
            {pendente ? 'salvando…' : 'Salvar e sair da fila'}
          </Botao>
          <span className={`text-[12px] ${erro || (problema && andou) ? 'text-[#f4b73f]' : 'text-[#94a3b8]'}`}>
            {hint}
          </span>
        </div>
      </div>
    </article>
  )
}

/**
 * `contadorHTML(mockup:2661)`. DECISÃO C: o contador aparece, mas não trava
 * nada. Ele existe para o número não sumir da vista de quem responde.
 */
function Contador({ obra }: { obra: Obra }) {
  const partes: string[] = []
  if (obra.nao_andou_seguidos >= 2) partes.push(`${obra.nao_andou_seguidos} dias seguidos sem andar`)
  if (travado(obra)) partes.push(`${obra.bloqueada_dias} dias no mesmo bloqueio · ${obra.bloqueio}`)
  if (!partes.length) return null
  return (
    <div className="mt-2 rounded border border-[#f4b73f66] bg-[#f4b73f14] px-3 py-2 text-[12px] text-[#f4b73f]">
      {partes.map((p) => (
        <div key={p}>{p}</div>
      ))}
      <div className="mt-1 text-[#94a3b8]">
        Registre e siga: o contador continua correndo até a obra andar.
      </div>
    </div>
  )
}
