'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CHIPS_ENVIO, destinatarioAposChip, estadoChips, pendenteDoEmailAntigo, type ForaDoOrganograma, type PendenteEmailAntigo, type Pessoa } from '../../_lib/organograma'
import { emailInterno } from '../../_lib/portal-email'
// Fonte única do envio e do acesso ao portal: as actions das Configurações.
import { salvarDestinatarioAction } from '../configuracoes/_actions'
import { adicionarAcessoAction, alternarAcessoAction, removerAcessoAction } from '../configuracoes/_actions-portal'
import { FormDestinatario } from '../configuracoes/_destinatarios'
import type { Destinatario, TipoEnvio } from '../configuracoes/_tipos'
import type { AcessoPortal } from '../configuracoes/_tipos-portal'
import { moverPessoaAction, removerPessoaAction, salvarPessoaAction } from './_actions'
import type { PessoaEntrada } from './_tipos'

const campo = 'min-h-11 rounded-lg border border-(--obra-border) bg-white px-3 text-base text-(--obra-text)'
const botao = 'min-h-11 min-w-11 rounded-lg border border-(--obra-border) bg-white px-3 text-sm text-(--obra-ink) hover:border-(--obra-orange-texto) disabled:opacity-45'

type Chips = { destinatarios: Destinatario[]; acessos: AcessoPortal[] }
type Rodar = (fn: () => Promise<{ ok: boolean; erro?: string }>) => Promise<boolean>

function useRodar(): { rodar: Rodar; indo: boolean; erro: string | null } {
  const router = useRouter()
  const [indo, setIndo] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const rodar: Rodar = async (fn) => {
    setIndo(true)
    setErro(null)
    const r = await fn()
    setIndo(false)
    if (!r.ok) {
      setErro(r.erro ?? 'Não foi possível concluir.')
      return false
    }
    router.refresh()
    return true
  }
  return { rodar, indo, erro }
}

function FormPessoa({ obraId, inicial, onFim }: { obraId: string; inicial: PessoaEntrada; onFim: (salvo?: PessoaEntrada) => void }) {
  const [p, setP] = useState<PessoaEntrada>(inicial)
  const { rodar, indo, erro } = useRodar()
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-(--obra-border) bg-white p-3">
      <div className="grid gap-2 sm:grid-cols-3">
        <input aria-label="Nome" placeholder="Nome" className={campo} value={p.nome} onChange={(e) => setP({ ...p, nome: e.target.value })} />
        <input aria-label="Cargo" placeholder="Cargo" className={campo} value={p.cargo ?? ''} onChange={(e) => setP({ ...p, cargo: e.target.value })} />
        <input aria-label="E-mail (opcional)" placeholder="E-mail (opcional)" type="email" className={campo} value={p.email ?? ''} onChange={(e) => setP({ ...p, email: e.target.value })} />
      </div>
      {erro ? <p role="alert" className="text-xs text-(--obra-vermelho-texto)">{erro}</p> : null}
      <div className="flex gap-2">
        <button
          type="button"
          disabled={indo || !p.nome.trim()}
          onClick={async () => {
            if (await rodar(() => salvarPessoaAction(obraId, p))) onFim(p)
          }}
          className="min-h-11 rounded-lg bg-(--obra-orange-texto) px-4 text-sm font-semibold text-white disabled:opacity-45"
        >
          {indo ? 'salvando…' : 'Salvar'}
        </button>
        <button type="button" onClick={() => onFim()} className={botao}>
          Cancelar
        </button>
      </div>
    </div>
  )
}

/** Chips Portal / Diário / Semanal / Mensal / Imediato de um e-mail (grava pelas actions das Configurações). */
function ChipsDaPessoa({ obraId, pessoa, chips }: { obraId: string; pessoa: { nome: string; cargo: string | null; email: string }; chips: Chips }) {
  const { rodar, indo, erro } = useRodar()
  const [editandoEnvio, setEditandoEnvio] = useState(false)
  const est = estadoChips(pessoa.email, chips.destinatarios, chips.acessos)
  const interno = emailInterno(pessoa.email)
  if (interno) {
    return (
      <p className="text-[13px] text-(--obra-muted-texto)">
        E-mail da Manfac: não é do cliente. Envios internos ficam nas Configurações; o portal é só do cliente.
      </p>
    )
  }
  const chip = (ligado: boolean) =>
    `min-h-11 rounded-full border px-3 text-[13px] disabled:opacity-45 ${
      ligado ? 'border-(--obra-ink) bg-(--obra-ink) font-semibold text-white' : 'border-(--obra-border) bg-white text-(--obra-muted-texto)'
    }`
  const portal = () =>
    rodar(() =>
      est.acesso
        ? alternarAcessoAction(obraId, est.acesso.id, !est.portal)
        : adicionarAcessoAction(obraId, { email: pessoa.email, nome: pessoa.nome }),
    )
  const envio = (tipo: TipoEnvio) => {
    const entrada = destinatarioAposChip(pessoa, est.destinatario, tipo, !est.envio[tipo])
    if (entrada) void rodar(() => salvarDestinatarioAction(obraId, entrada))
  }
  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap gap-1.5" role="group" aria-label={`Envios e portal de ${pessoa.email}`}>
        <button
          type="button"
          aria-pressed={est.portal}
          disabled={indo}
          onClick={() => void portal()}
          className={chip(est.portal)}
        >
          Portal
        </button>
        {CHIPS_ENVIO.map((c) => (
          <button key={c.tipo} type="button" aria-pressed={est.envio[c.tipo]} disabled={indo} onClick={() => envio(c.tipo)} className={chip(est.envio[c.tipo])}>
            {c.rotulo}
          </button>
        ))}
      </div>
      {est.destinatario || est.acesso ? (
        <div className="flex flex-wrap gap-1.5">
          {est.destinatario ? (
            <button type="button" className={botao} disabled={indo} onClick={() => setEditandoEnvio((x) => !x)}>
              {editandoEnvio ? 'Fechar envio' : 'Editar envio'}
            </button>
          ) : null}
          {est.acesso ? (
            <button
              type="button"
              className={botao}
              disabled={indo}
              onClick={() => {
                if (window.confirm(`Remover o acesso de ${pessoa.email} à página do cliente?`)) void rodar(() => removerAcessoAction(obraId, est.acesso!.id))
              }}
            >
              Remover acesso
            </button>
          ) : null}
        </div>
      ) : null}
      {editandoEnvio && est.destinatario ? (
        <FormDestinatario obraId={obraId} inicial={est.destinatario} onFim={() => setEditandoEnvio(false)} />
      ) : null}
      {erro ? <p role="alert" className="text-xs text-(--obra-vermelho-texto)">{erro}</p> : null}
    </div>
  )
}

/**
 * Depois de trocar o e-mail: o acesso ao portal e o envio do e-mail antigo continuam ativos.
 * Pergunta (não desativa sozinho): um clique desativa os dois, ou "Manter".
 */
function AvisoEmailAntigo({ obraId, pendente, onFim }: { obraId: string; pendente: PendenteEmailAntigo; onFim: () => void }) {
  const { rodar, indo, erro } = useRodar()
  const itens = [pendente.acesso ? 'acesso ao portal ativo' : null, pendente.destinatario ? 'recebe os envios' : null].filter(Boolean).join(' e ')
  const desativar = async () => {
    if (pendente.acesso && !(await rodar(() => alternarAcessoAction(obraId, pendente.acesso!.id, false)))) return
    if (pendente.destinatario && !(await rodar(() => salvarDestinatarioAction(obraId, { ...pendente.destinatario!, ativo: false })))) return
    onFim()
  }
  return (
    <li role="status" className="flex flex-col gap-2 rounded-xl border border-[#efd77a] bg-[#fdf6d8] p-3 text-[14px] text-(--obra-text)">
      <span>
        O e-mail antigo <strong className="obra-num break-all">{pendente.email}</strong> continua com {itens}.
      </span>
      <span className="flex flex-wrap gap-1.5">
        <button type="button" className={botao} disabled={indo} onClick={() => void desativar()}>
          Desativar acesso antigo
        </button>
        <button type="button" className={botao} disabled={indo} onClick={onFim}>
          Manter
        </button>
      </span>
      {erro ? <span role="alert" className="text-xs text-(--obra-vermelho-texto)">{erro}</span> : null}
    </li>
  )
}

function LinhaPessoa({ obraId, p, admin, chips, primeira, ultima }: { obraId: string; p: Pessoa; admin: boolean; chips: Chips | null; primeira: boolean; ultima: boolean }) {
  const [editando, setEditando] = useState(false)
  const [pendente, setPendente] = useState<PendenteEmailAntigo | null>(null)
  const { rodar, indo, erro } = useRodar()
  if (editando) {
    return (
      <FormPessoa
        obraId={obraId}
        inicial={{ id: p.id, nome: p.nome, cargo: p.cargo, email: p.email }}
        onFim={(salvo) => {
          setEditando(false)
          if (salvo && chips) setPendente(pendenteDoEmailAntigo(p.email, salvo.email, chips.destinatarios, chips.acessos))
        }}
      />
    )
  }
  return (
    <>
    {pendente ? <AvisoEmailAntigo obraId={obraId} pendente={pendente} onFim={() => setPendente(null)} /> : null}
    <li className="grid gap-2 rounded-xl border border-(--obra-border) bg-white p-3 text-[14px] text-(--obra-text) lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1.4fr)_auto] lg:items-center">
      <span className="font-semibold text-(--obra-ink)">{p.nome}</span>
      <span>{p.cargo ?? <span className="text-(--obra-muted-texto)">sem cargo</span>}</span>
      <span className="obra-num text-[13px] break-all">{p.email ?? <span className="text-(--obra-muted-texto)">sem e-mail</span>}</span>
      <div className="flex flex-col gap-2 lg:items-end">
        {p.email && chips ? (
          <ChipsDaPessoa obraId={obraId} pessoa={{ nome: p.nome, cargo: p.cargo, email: p.email }} chips={chips} />
        ) : !p.email ? (
          <span className="text-[13px] text-(--obra-muted-texto)">só no organograma</span>
        ) : null}
        {admin ? (
          <div className="flex flex-wrap gap-1.5">
            <button type="button" className={botao} disabled={indo || primeira} aria-label={`Subir ${p.nome}`} onClick={() => void rodar(() => moverPessoaAction(obraId, p.id, 'cima'))}>
              ↑
            </button>
            <button type="button" className={botao} disabled={indo || ultima} aria-label={`Descer ${p.nome}`} onClick={() => void rodar(() => moverPessoaAction(obraId, p.id, 'baixo'))}>
              ↓
            </button>
            <button type="button" className={botao} disabled={indo} onClick={() => setEditando(true)}>
              Editar
            </button>
            <button
              type="button"
              className={botao}
              disabled={indo}
              onClick={() => {
                if (window.confirm(`Tirar ${p.nome} do organograma? Os envios e o acesso ao portal desse e-mail continuam.`)) {
                  void rodar(() => removerPessoaAction(obraId, p.id))
                }
              }}
            >
              Remover
            </button>
          </div>
        ) : null}
        {erro ? <p role="alert" className="text-xs text-(--obra-vermelho-texto)">{erro}</p> : null}
      </div>
    </li>
    </>
  )
}

function Fora({ obraId, itens, chips, podeAdicionar }: { obraId: string; itens: ForaDoOrganograma[]; chips: Chips; podeAdicionar: boolean }) {
  const [adicionando, setAdicionando] = useState<string | null>(null)
  if (!itens.length) return null
  return (
    <section aria-labelledby="fora-titulo" className="flex flex-col gap-2 rounded-xl border border-[#efd77a] bg-[#fdf6d8] p-3">
      <h3 id="fora-titulo" className="text-[15px] font-semibold text-(--obra-ink)">Sem cadastro no organograma</h3>
      <p className="text-[13px] text-(--obra-text)">
        Estes e-mails já recebem envios ou entram no portal, mas ainda não estão no organograma. Continuam valendo; adicione a pessoa para completar o cadastro.
      </p>
      <ul className="flex flex-col gap-2">
        {itens.map((f) =>
          adicionando === f.email ? (
            <li key={f.email}>
              <FormPessoa obraId={obraId} inicial={{ nome: f.nome ?? '', cargo: f.funcao, email: f.email }} onFim={() => setAdicionando(null)} />
            </li>
          ) : (
            <li key={f.email} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-(--obra-border) bg-white p-3 text-[14px] text-(--obra-text)">
              <span className="min-w-0">
                <strong className="text-(--obra-ink)">{f.nome ?? f.email}</strong>
                {f.funcao ? ` · ${f.funcao}` : ''}
                <br />
                <span className="obra-num text-[13px] break-all text-(--obra-muted-texto)">{f.email}</span>
              </span>
              <span className="flex flex-col items-end gap-2">
                <ChipsDaPessoa obraId={obraId} pessoa={{ nome: f.nome ?? f.email, cargo: f.funcao, email: f.email }} chips={chips} />
                {podeAdicionar ? (
                  <button type="button" className={botao} onClick={() => setAdicionando(f.email)}>
                    Adicionar ao organograma
                  </button>
                ) : null}
              </span>
            </li>
          ),
        )}
      </ul>
    </section>
  )
}

export default function Organograma({
  obraId,
  admin,
  pessoas,
  chips,
  fora,
  erroChips,
  indisponivel = false,
}: {
  obraId: string
  admin: boolean
  pessoas: Pessoa[]
  /** Destinatários e acessos (só admin); null = sem chips. */
  chips: Chips | null
  fora: ForaDoOrganograma[]
  erroChips: boolean
  /**
   * A tabela do organograma não pôde ser lida (SQL B/C ainda não aplicado ou falha): mostra
   * o aviso e mantém "sem cadastro" com os botões de acesso e envio (tabelas da Leva 5).
   */
  indisponivel?: boolean
}) {
  const [novo, setNovo] = useState(false)
  return (
    <section aria-labelledby="org-titulo" className="flex flex-col gap-3 rounded-xl border border-(--obra-border) bg-(--obra-card) p-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 id="org-titulo" className="text-lg font-bold text-(--obra-ink)">Organograma do cliente</h2>
          <p className="text-[13px] text-(--obra-muted-texto)">
            Nome e cargo. E-mail opcional; quem tem e-mail pode ser marcado para receber os envios e entrar no portal.
          </p>
        </div>
        {admin && !novo && !indisponivel ? (
          <button type="button" className={botao} onClick={() => setNovo(true)}>
            + Adicionar pessoa
          </button>
        ) : null}
      </div>
      {novo ? <FormPessoa obraId={obraId} inicial={{ nome: '', cargo: null, email: null }} onFim={() => setNovo(false)} /> : null}
      {indisponivel ? (
        <p role="status" className="rounded-lg border border-dashed border-(--obra-border) px-3 py-2 text-sm text-(--obra-muted-texto)">
          Não deu para ler o organograma agora. Os e-mails que já recebem envios ou entram no portal continuam abaixo, com os botões de acesso e envio.
        </p>
      ) : pessoas.length === 0 ? (
        <p className="text-sm text-(--obra-muted-texto)">Ninguém no organograma ainda.</p>
      ) : null}
      <ul className="flex flex-col gap-2">
        {pessoas.map((p, i) => (
          <LinhaPessoa key={p.id} obraId={obraId} p={p} admin={admin} chips={chips} primeira={i === 0} ultima={i === pessoas.length - 1} />
        ))}
      </ul>
      {erroChips ? (
        <p role="alert" className="text-sm text-(--obra-vermelho-texto)">Não deu para ler os envios e o acesso ao portal agora. Recarregue em instantes.</p>
      ) : null}
      {chips ? <Fora obraId={obraId} itens={fora} chips={chips} podeAdicionar={admin && !indisponivel} /> : null}
      <p className="text-[13px] text-(--obra-muted-texto)">
        Esta lista é o cadastro de e-mails do cliente: os destinatários dos envios e o acesso ao portal saem daqui. Os destinatários internos (Manfac) ficam nas Configurações.
      </p>
    </section>
  )
}
