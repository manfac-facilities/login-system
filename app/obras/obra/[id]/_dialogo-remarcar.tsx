'use client'

/**
 * A JANELA DE REMARCAÇÃO — o motivo obrigatório de mudar o início da obra.
 * J4, seção B do `mockup-j4-v03.html` (`dialogoRemarcar()`, :987-1046).
 * Ver spec-ficha-editavel-2026-09-18.md §5.1, R9, R10, R15 e o teste §7.5.
 *
 * POR QUE ELA EXISTE: mudar a data de início é a única alteração da ficha que
 * exige explicação. O cliente pediu o motivo **padronizado**, e pediu também
 * poder cadastrar um motivo que não esteja na lista (feedback 14 B, citado no
 * mockup :316). As duas coisas convivem aqui:
 *   • **"Outro"** pede uma descrição e vale SÓ para esta remarcação.
 *   • **"+ Cadastrar novo motivo"** põe o motivo na lista, para todas as obras,
 *     e já o deixa escolhido nesta janela.
 *
 * A LISTA VEM DO BANCO, por prop (`motivos`), não de uma constante: é tabela
 * justamente para o cliente ampliá-la sem deploy. `MOTIVOS_REMARCACAO` de
 * `_lib/ficha-campos.ts` é só o seed e a referência de comparação.
 *
 * ELA É SÓ A COLETA DO MOTIVO. Quem grava é o bloco do cronograma: esta janela
 * devolve `{ motivo, detalhe }` em `onConfirmar` e fecha. É consequência direta
 * do contrato de `_ui/dialogo.tsx` — clicar em qualquer botão FECHA a janela e
 * só depois roda o `onClick`, então o "Salvando…" aparece no bloco, nunca aqui.
 *
 * NO TESTE, o `<dialog>` roda pelo caminho de reserva de `_ui/dialogo.tsx`: o
 * jsdom desta versão implementa `open` (reflexo do atributo) mas NÃO
 * `showModal`/`close`, e por isso o Esc é tratado por `keydown`. Testar contra o
 * comportamento do componente, nunca contra a API nativa.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import Dialogo, { type BotaoDialogo } from '../../_ui/dialogo'
import { br, somaDias } from '../../_lib/tipos'
import { ehMotivoOutro, normalizarMotivo } from '../../_lib/ficha-campos'

/**
 * O tipo MÍNIMO que esta janela usa de `cadastrarMotivoRemarcacaoAction`
 * (§4.5). Recebido por prop, e não importado de `_actions.ts`, para a tela
 * compilar e ser testada sem depender do arquivo da outra frente.
 */
export type CadastrarMotivo = (nome: string) => Promise<{
  error?: string
  motivo?: { id: string; nome: string }
  jaExistia?: boolean
}>

export type Remarcacao = { motivo: string; detalhe: string }

type ItemMotivo = { nome: string; novo: boolean }

/** Primeira letra maiúscula e espaços internos colapsados, como o mockup. */
function arrumarNome(s: string): string {
  const t = s.trim().replace(/\s+/g, ' ')
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : t
}

/**
 * Os motivos cadastrados agora entram ANTES de "Outro" — "Outro" é o fundo da
 * lista por natureza, e empurrá-lo para o meio faria o vocabulário parecer
 * desordenado a cada cadastro (`MOTIVOS.splice(MOTIVOS.length - 1, 0, …)` do
 * mockup).
 */
function montarLista(base: readonly string[], extras: readonly string[]): ItemMotivo[] {
  const itens: ItemMotivo[] = base.map((nome) => ({ nome, novo: false }))
  // Item 5b da revisão de 20/09: um motivo cadastrado nesta sessão do diálogo
  // (`extras`) pode reaparecer em `base` depois que o servidor revalida a
  // página — o diálogo continua montado, com o `extras` antigo, e o mesmo
  // nome entrava duas vezes: um de `base`, um de `extras`. Com `motivo`
  // (o estado escolhido) igual à mesma string, OS DOIS `<input>` ficavam
  // `checked`. Filtrar aqui é mais barato que sincronizar os dois estados.
  const novos: ItemMotivo[] = extras
    .filter((nome) => !base.some((b) => normalizarMotivo(b) === normalizarMotivo(nome)))
    .map((nome) => ({ nome, novo: true }))
  const iOutro = itens.findIndex((i) => ehMotivoOutro(i.nome))
  if (iOutro < 0) return [...itens, ...novos]
  return [...itens.slice(0, iOutro), ...novos, ...itens.slice(iOutro)]
}

export default function DialogoRemarcar({
  aberto,
  de,
  para,
  duracao,
  motivos,
  cadastrarMotivo,
  onConfirmar,
  onFechar,
}: {
  aberto: boolean
  /** O início gravado hoje, `AAAA-MM-DD`. */
  de: string
  /** O início novo, `AAAA-MM-DD`. Vazio = a data foi APAGADA, e isso também é remarcação (R9). */
  para: string
  /** Duração em dias, para o "final calculado" do texto. Vazia: o final some. */
  duracao: string
  /** A lista padronizada, como veio de `obras_motivo_remarcacao`. */
  motivos: readonly string[]
  /** Ausente: o "+ Cadastrar novo motivo" não aparece. */
  cadastrarMotivo?: CadastrarMotivo
  onConfirmar: (r: Remarcacao) => void
  onFechar: () => void
}) {
  const [motivo, setMotivo] = useState('')
  const [detalhe, setDetalhe] = useState('')
  /** Motivos criados nesta sessão da janela; somem quando a página recarrega. */
  const [extras, setExtras] = useState<string[]>([])
  const [novoAberto, setNovoAberto] = useState(false)
  const [novoNome, setNovoNome] = useState('')
  const [novoMsg, setNovoMsg] = useState('')
  const [cadastrando, setCadastrando] = useState(false)
  /** Sobe a cada cadastro para devolver o foco ao rádio que ficou marcado. */
  const [focoLista, setFocoLista] = useState(0)

  const lista = useRef<HTMLFieldSetElement>(null)
  const estavaAberto = useRef(false)

  // Abrir a janela recomeça a escolha. O motivo de uma remarcação não se herda
  // da anterior — seria a forma mais fácil de gravar a explicação errada.
  useEffect(() => {
    if (aberto && !estavaAberto.current) {
      setMotivo('')
      setDetalhe('')
      setNovoAberto(false)
      setNovoNome('')
      setNovoMsg('')
    }
    estavaAberto.current = aberto
  }, [aberto])

  useEffect(() => {
    if (focoLista === 0) return
    lista.current?.querySelector<HTMLElement>('input:checked')?.focus()
  }, [focoLista])

  const itens = useMemo(() => montarLista(motivos, extras), [motivos, extras])

  const precisaDetalhe = ehMotivoOutro(motivo)
  const detalheOk = detalhe.replace(/\s/g, '').length >= 3
  const pronto = !!motivo && (!precisaDetalhe || detalheOk)

  const falta = !motivo
    ? 'Escolha um motivo para remarcar.'
    : !pronto
      ? 'Descreva o outro motivo (pelo menos 3 letras).'
      : 'Pronto para salvar.'

  const dias = /^\d+$/.test(duracao.trim()) ? Number(duracao.trim()) : null
  const fimAntes = somaDias(de, dias)
  const fimDepois = somaDias(para, dias)

  function escolher(nome: string) {
    setMotivo(nome)
    if (!ehMotivoOutro(nome)) setDetalhe('')
  }

  async function cadastrar() {
    const nome = arrumarNome(novoNome)
    if (nome.length < 3) {
      setNovoMsg('Escreva o motivo com pelo menos 3 letras.')
      return
    }

    // Pré-checagem local, igual à do mockup: sem acento e sem caixa (R15). Ela
    // evita a ida ao servidor no caso comum e é a mesma regra que a action
    // aplica, porque as duas chamam `normalizarMotivo`.
    const igual = itens.find((i) => normalizarMotivo(i.nome) === normalizarMotivo(nome))
    if (igual) {
      escolher(igual.nome)
      setNovoMsg(`"${igual.nome}" já está na lista: foi escolhido para você.`)
      setFocoLista((n) => n + 1)
      return
    }

    if (!cadastrarMotivo) return

    setCadastrando(true)
    const r = await cadastrarMotivo(nome)
    setCadastrando(false)

    if (r.error) {
      setNovoMsg(r.error)
      return
    }

    const criado = r.motivo?.nome ?? nome
    if (!itens.some((i) => normalizarMotivo(i.nome) === normalizarMotivo(criado))) {
      setExtras((e) => [...e, criado])
    }
    escolher(criado)

    if (r.jaExistia) {
      // Outra pessoa cadastrou o mesmo motivo antes; não é erro (R15).
      setNovoMsg(`"${criado}" já está na lista: foi escolhido para você.`)
    } else {
      setNovoMsg('')
      setNovoAberto(false)
      setNovoNome('')
    }
    setFocoLista((n) => n + 1)
  }

  const botoes: BotaoDialogo[] = [
    {
      id: 'dlg-r-ok',
      texto: 'Remarcar e salvar',
      desabilitado: !pronto,
      onClick: () =>
        onConfirmar({ motivo, detalhe: precisaDetalhe ? detalhe.trim() : '' }),
    },
    { id: 'dlg-r-voltar', texto: 'Voltar ao formulário', ghost: true },
  ]

  return (
    <Dialogo aberto={aberto} titulo="Remarcar o início da obra" botoes={botoes} onFechar={onFechar}>
      <p className="m-0">
        Início de <b className="text-[#e8eef7]">{br(de)}</b> para{' '}
        <b className="text-[#e8eef7]">{para ? br(para) : 'sem data'}</b>
        {fimAntes && fimDepois && fimAntes !== fimDepois ? (
          <>
            . Final calculado: <b className="text-[#e8eef7]">{br(fimAntes)}</b> →{' '}
            <b className="text-[#e8eef7]">{br(fimDepois)}</b>
          </>
        ) : null}
        .
      </p>

      <fieldset
        ref={lista}
        className="mt-3 flex flex-col gap-1 rounded-md border border-[#1e3a5f] px-3 py-2.5"
      >
        <legend className="px-1 text-[12px] font-semibold text-[#e8eef7]">
          Motivo da remarcação <span className="font-normal text-[#94a3b8]">(obrigatório)</span>
        </legend>
        {itens.map((m, i) => (
          <label
            key={m.nome}
            htmlFor={`dlg-r-m${i}`}
            className="flex min-h-9 cursor-pointer items-center gap-2 text-[13px] text-[#e8eef7]"
          >
            <input
              type="radio"
              name="dlg-r-mot"
              id={`dlg-r-m${i}`}
              value={m.nome}
              checked={motivo === m.nome}
              onChange={() => escolher(m.nome)}
            />
            {m.nome}
            {m.novo ? (
              <span className="rounded border border-[#f05a28] px-1 py-px text-[10px] text-[#f05a28]">
                cadastrado agora por você
              </span>
            ) : null}
          </label>
        ))}
        {itens.length === 0 ? (
          // Degradação silenciosa que o revisor da ligação pegou: sem a migration
          // `sdd-sql-obras-motivos-remarcacao.sql` aplicada, a lista volta vazia, o
          // botão nunca habilita e a pessoa não descobre por quê. Melhor dizer.
          <p role="alert" className="px-1 text-[12px] leading-relaxed text-[#f4b73f]">
            A lista de motivos não carregou, então não dá para remarcar agora. Recarregue a
            página; se continuar assim, avise o suporte — é configuração do sistema, não erro
            seu.
          </p>
        ) : null}
      </fieldset>

      {precisaDetalhe ? (
        <div className="mt-2">
          <label htmlFor="dlg-r-det" className="block text-[11px] uppercase tracking-wide text-[#94a3b8]">
            Qual é o outro motivo?
          </label>
          <input
            id="dlg-r-det"
            type="text"
            maxLength={120}
            value={detalhe}
            autoFocus
            onChange={(e) => setDetalhe(e.target.value)}
            placeholder="ex.: aguardando laudo do engenheiro"
            className="mt-1 w-full rounded-md border border-[#1e3a5f] bg-[#0a1628] px-2.5 py-2 text-sm text-[#e8eef7] placeholder:text-[#4a6080] outline-none focus:border-[#f05a28]"
          />
          <span className="mt-1 block text-[11px] leading-snug text-[#64748b]">
            Obrigatório com &quot;Outro&quot;. Vale só para esta remarcação. Para o motivo entrar na
            lista, use &quot;Cadastrar novo motivo&quot;.
          </span>
        </div>
      ) : null}

      {cadastrarMotivo ? (
        <div className="mt-3">
          {novoAberto ? null : (
            <button
              type="button"
              id="dlg-r-novo"
              onClick={() => setNovoAberto(true)}
              className="text-[12px] font-medium text-[#f05a28] underline underline-offset-2"
            >
              + Cadastrar novo motivo
            </button>
          )}
          {novoAberto ? (
            <div>
              <label
                htmlFor="dlg-r-novo-in"
                className="block text-[11px] uppercase tracking-wide text-[#94a3b8]"
              >
                Novo motivo
              </label>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <input
                  id="dlg-r-novo-in"
                  type="text"
                  maxLength={60}
                  value={novoNome}
                  autoFocus
                  disabled={cadastrando}
                  onChange={(e) => setNovoNome(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key !== 'Enter') return
                    e.preventDefault()
                    void cadastrar()
                  }}
                  placeholder="ex.: Aguardando laudo técnico"
                  className="min-w-[180px] flex-1 rounded-md border border-[#1e3a5f] bg-[#0a1628] px-2.5 py-2 text-sm text-[#e8eef7] placeholder:text-[#4a6080] outline-none focus:border-[#f05a28]"
                />
                <button
                  type="button"
                  id="dlg-r-novo-ok"
                  disabled={cadastrando}
                  onClick={() => void cadastrar()}
                  className="rounded-md bg-[#f05a28] px-2.5 py-1.5 text-[12px] font-medium text-white disabled:opacity-45"
                >
                  {cadastrando ? 'Cadastrando…' : 'Cadastrar'}
                </button>
                <button
                  type="button"
                  id="dlg-r-novo-x"
                  disabled={cadastrando}
                  onClick={() => {
                    setNovoAberto(false)
                    setNovoNome('')
                    setNovoMsg('')
                  }}
                  className="rounded-md border border-[#1e3a5f] px-2.5 py-1.5 text-[12px] font-medium text-[#e8eef7] disabled:opacity-45"
                >
                  Cancelar
                </button>
              </div>
              {novoMsg ? (
                <span
                  id="dlg-r-novo-msg"
                  role="alert"
                  className="mt-1 block text-[11px] font-semibold text-[#f4b73f]"
                >
                  {novoMsg}
                </span>
              ) : null}
              <span className="mt-1 block text-[11px] leading-snug text-[#64748b]">
                Entra na lista para todas as obras e já fica escolhido aqui. Fica registrado quem
                cadastrou.
              </span>
            </div>
          ) : null}
          {!novoAberto && novoMsg ? (
            <span
              id="dlg-r-novo-msg"
              role="alert"
              className="mt-1 block text-[11px] font-semibold text-[#f4b73f]"
            >
              {novoMsg}
            </span>
          ) : null}
        </div>
      ) : null}

      <p className="mt-3 mb-0">Ao salvar:</p>
      <ul className="mt-1 mb-0 list-disc pl-5">
        <li>
          O início planejado passa a ser{' '}
          <b className="text-[#e8eef7]">{para ? br(para) : 'nenhuma data'}</b>, e o final se
          recalcula.
        </li>
        <li>
          A remarcação entra em <b className="text-[#e8eef7]">Remarcações</b> e no{' '}
          <b className="text-[#e8eef7]">Histórico</b>, com o motivo e o seu nome.
        </li>
        <li>
          Os <b className="text-[#e8eef7]">dias em aberto</b> e os{' '}
          <b className="text-[#e8eef7]">dias esperando a aprovação da OS</b> não mudam: eles contam
          da liberação, da aprovação ou da entrada, nunca do início planejado.
        </li>
        <li>Os outros espaços do cronograma que você alterou salvam junto, sem motivo.</li>
      </ul>

      <p id="dlg-r-falta" aria-live="polite" className="mt-2.5 mb-0 text-[12px] text-[#94a3b8]">
        {falta}
      </p>
    </Dialogo>
  )
}
