'use client'
import { useActionState, useCallback, useEffect, useState } from 'react'
import Dialogo from '@/components/sofia/Dialogo'
import { criarLigacaoAction, encerrarLigacaoAction, novaVigenciaCentroCustoAction } from './_actions'

export interface EquipeOpcao {
  id: string
  codigo: string
  centroCusto: string | null
}

const fld =
  'w-full px-3 py-2.5 rounded-lg bg-[#0f1f3d] border border-[#1e3a5f] text-white placeholder-[#4a6080] focus:outline-none focus:border-[#f05a28] text-sm'
const lbl = 'block text-xs text-[#94a3b8] mb-1'
const btnP = 'px-4 py-2 rounded-lg bg-[#f05a28] text-white text-sm font-medium hover:bg-[#d94e22] transition-colors disabled:opacity-50'
const btnS = 'px-4 py-2 rounded-lg border border-[#1e3a5f] text-[#94a3b8] text-sm font-medium hover:border-[#94a3b8] transition-colors'

function Botao({
  rotulo,
  classe,
  children,
}: {
  rotulo: string
  classe: string
  children: (fechar: () => void) => React.ReactNode
}) {
  const [aberto, setAberto] = useState(false)
  const [vez, setVez] = useState(0)
  const fechar = useCallback(() => setAberto(false), [])
  return (
    <>
      <button
        type="button"
        onClick={() => {
          setVez((v) => v + 1)
          setAberto(true)
        }}
        className={classe}
      >
        {rotulo}
      </button>
      {aberto && <div key={vez}>{children(fechar)}</div>}
    </>
  )
}

function Rodape({
  erro,
  pendente,
  onFechar,
  rotuloSalvar = 'Salvar',
}: {
  erro?: string
  pendente: boolean
  onFechar: () => void
  rotuloSalvar?: string
}) {
  return (
    <>
      {erro && (
        <p role="alert" className="text-red-400 text-xs mt-3">
          {erro}
        </p>
      )}
      <div className="flex justify-end gap-2 mt-5">
        <button type="button" onClick={onFechar} className={btnS}>
          Cancelar
        </button>
        <button type="submit" disabled={pendente} className={btnP}>
          {pendente ? 'Salvando...' : rotuloSalvar}
        </button>
      </div>
    </>
  )
}

type PropsLigacao = {
  plataforma: 'ticketlog' | 'veloe'
  identificador: string | null
  mascara?: string
  equipes: EquipeOpcao[]
  equipeAtualId?: string
  desdeSugerida: string
}

function DialogoLigacao({
  plataforma,
  identificador,
  mascara,
  equipes,
  equipeAtualId,
  desdeSugerida,
  onFechar,
}: PropsLigacao & { onFechar: () => void }) {
  const [state, formAction, pendente] = useActionState(criarLigacaoAction, {})
  useEffect(() => {
    if (state.success) onFechar()
  }, [state, onFechar])
  const ehCartao = plataforma === 'ticketlog'
  const titulo = identificador
    ? `${equipeAtualId ? 'Trocar equipe' : 'Ligar a uma equipe'}: ${ehCartao ? 'cartão' : 'tag'}`
    : ehCartao
      ? 'Novo cartão Ticketlog'
      : 'Nova tag Veloe'
  return (
    <Dialogo titulo={titulo} subtitulo={mascara} onFechar={onFechar}>
      <form action={formAction}>
        <input type="hidden" name="plataforma" value={plataforma} />
        {identificador ? (
          <input type="hidden" name="identificador" value={identificador} />
        ) : (
          <div className="mb-3">
            <label className={lbl} htmlFor="lig-id">
              {ehCartao ? 'Número do cartão' : 'Número da tag (VeloeTag)'}
            </label>
            <input id="lig-id" name="identificador" inputMode="numeric" className={fld} required />
          </div>
        )}
        <div className="mb-3">
          <label className={lbl} htmlFor="lig-eq">
            Equipe
          </label>
          <select id="lig-eq" name="equipe_id" defaultValue={equipeAtualId ?? ''} className={fld} required>
            <option value="" disabled>
              Escolha...
            </option>
            {equipes.map((e) => (
              <option key={e.id} value={e.id}>
                {e.codigo} — {e.centroCusto ?? 'sem centro de custo'}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={lbl} htmlFor="lig-desde">
            A partir de
          </label>
          <input id="lig-desde" name="vigente_desde" type="date" defaultValue={desdeSugerida} className={fld} required />
        </div>
        <p className="text-xs text-[#94a3b8] mt-3">
          Cria uma linha nova a partir desta data. Gastos anteriores continuam na equipe que valia na época; a linha
          antiga fica no histórico.
        </p>
        <Rodape erro={state.error} pendente={pendente} onFechar={onFechar} />
      </form>
    </Dialogo>
  )
}

export function BotaoLigacao({
  rotulo,
  primario,
  ...resto
}: PropsLigacao & { rotulo: string; primario?: boolean }) {
  return (
    <Botao rotulo={rotulo} classe={primario ? btnP : 'text-xs text-[#94a3b8] hover:text-white'}>
      {(fechar) => <DialogoLigacao {...resto} onFechar={fechar} />}
    </Botao>
  )
}

type PropsEncerrar = {
  plataforma: 'ticketlog' | 'veloe'
  identificador: string
  mascara: string
  equipe: string
  desdeSugerida: string
}

function DialogoEncerrar({ plataforma, identificador, mascara, equipe, desdeSugerida, onFechar }: PropsEncerrar & { onFechar: () => void }) {
  const [state, formAction, pendente] = useActionState(encerrarLigacaoAction, {})
  useEffect(() => {
    if (state.success) onFechar()
  }, [state, onFechar])
  return (
    <Dialogo titulo={plataforma === 'ticketlog' ? 'Encerrar ligação: cartão' : 'Encerrar ligação: tag'} subtitulo={mascara} onFechar={onFechar}>
      <form action={formAction}>
        <input type="hidden" name="plataforma" value={plataforma} />
        <input type="hidden" name="identificador" value={identificador} />
        <p className="text-sm text-[#cbd5e1] mb-3">
          Hoje ligado à equipe <strong className="text-white">{equipe}</strong>. Depois de encerrar, os gastos dessa data
          em diante ficam em “Sem centro de custo” até você ligar a uma equipe de novo.
        </p>
        <label className={lbl} htmlFor="enc-em">
          Encerrar em
        </label>
        <input id="enc-em" name="encerrada_em" type="date" defaultValue={desdeSugerida} className={fld} required />
        <p className="text-xs text-[#94a3b8] mt-3">
          Nada é apagado: fica uma linha de encerramento no histórico, e gastos anteriores continuam na equipe de antes.
        </p>
        <Rodape erro={state.error} pendente={pendente} onFechar={onFechar} rotuloSalvar="Encerrar ligação" />
      </form>
    </Dialogo>
  )
}

export function BotaoEncerrar(props: PropsEncerrar) {
  return (
    <Botao rotulo="Encerrar ligação" classe="text-xs text-red-400 hover:text-red-300">
      {(fechar) => <DialogoEncerrar {...props} onFechar={fechar} />}
    </Botao>
  )
}

type PropsCC = {
  equipe: { id: string; codigo: string }
  atual: string | null
  desdeSugerida: string
}

function DialogoCentroCusto({ equipe, atual, desdeSugerida, onFechar }: PropsCC & { onFechar: () => void }) {
  const [state, formAction, pendente] = useActionState(novaVigenciaCentroCustoAction, {})
  useEffect(() => {
    if (state.success) onFechar()
  }, [state, onFechar])
  return (
    <Dialogo
      titulo={`${atual ? 'Trocar' : 'Definir'} centro de custo — ${equipe.codigo}`}
      subtitulo={atual ? `Hoje: ${atual}. Esta linha continua no histórico.` : undefined}
      onFechar={onFechar}
    >
      <form action={formAction}>
        <input type="hidden" name="equipe_id" value={equipe.id} />
        <div className="grid grid-cols-3 gap-3 mb-3">
          <div>
            <label className={lbl} htmlFor="cc-cod">
              Código no Omie
            </label>
            <input id="cc-cod" name="codigo" className={fld} required />
          </div>
          <div className="col-span-2">
            <label className={lbl} htmlFor="cc-nome">
              Nome
            </label>
            <input id="cc-nome" name="nome" className={fld} required />
          </div>
        </div>
        <label className={lbl} htmlFor="cc-desde">
          Vigente desde
        </label>
        <input id="cc-desde" name="vigente_desde" type="date" defaultValue={desdeSugerida} className={fld} required />
        <p className="text-xs text-[#94a3b8] mt-2">
          Gastos com data de uso a partir desta data usam o novo centro de custo.
        </p>
        <Rodape erro={state.error} pendente={pendente} onFechar={onFechar} />
      </form>
    </Dialogo>
  )
}

export function BotaoCentroCusto({
  rotulo,
  primario,
  ...resto
}: PropsCC & { rotulo: string; primario?: boolean }) {
  return (
    <Botao
      rotulo={rotulo}
      classe={
        primario
          ? btnP
          : 'px-3 py-1 rounded-lg border border-[#1e3a5f] text-[#94a3b8] text-xs hover:border-[#94a3b8] transition-colors'
      }
    >
      {(fechar) => <DialogoCentroCusto {...resto} onFechar={fechar} />}
    </Botao>
  )
}
