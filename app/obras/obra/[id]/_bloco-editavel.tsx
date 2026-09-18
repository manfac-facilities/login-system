'use client'

/**
 * A CASCA COMPARTILHADA DOS TRÊS BLOCOS EDITÁVEIS da ficha da obra.
 * J4, seção B do `mockup-j4-v03.html` (`blocoB()`, :857-866).
 * Ver spec-ficha-editavel-2026-09-18.md §5.1 e §5.3.
 *
 * Um bloco tem sempre o mesmo esqueleto: cabeçalho com **Editar** (ou o selo
 * "editando"), corpo em leitura OU formulário, a barra **Salvar / Cancelar /
 * hint**, a caixa de erro de gravação, e o rodapé de autoria. Só o miolo muda
 * de um bloco para o outro — por isso ele entra por prop (`leitura`,
 * `formulario`) e não por herança de componente.
 *
 * CADA BLOCO SALVA SOZINHO (§5.3, passo 1). Os três podem estar em edição ao
 * mesmo tempo: são conjuntos de campos disjuntos, e é assim que o mockup se
 * comporta (`B.edit` é um mapa, não um valor). Salvar um não mexe nos outros.
 *
 * O QUE ESTA CASCA GARANTE, e por isso não se reimplementa em cada bloco:
 *   • Enquanto grava, **Salvar** vira "Salvando…" e os dois botões ficam
 *     desabilitados — o hint `aria-live` anuncia "Gravando no sistema".
 *     A janela nunca mostra "Salvando…": ela já fechou (contrato de
 *     `_ui/dialogo.tsx`), então quem mostra é o bloco.
 *   • Falha de gravação NÃO tira o bloco do modo edição e NÃO limpa nada
 *     (R21). A caixa de erro diz, literalmente, que nada foi gravado e que o
 *     que foi preenchido continua abaixo.
 *   • O foco: ao entrar em edição vai para o primeiro campo habilitado; ao sair
 *     — por Cancelar ou por gravação bem-sucedida — volta para o **Editar**.
 *     Quem usa teclado não é largado no fim da página.
 *
 * Os controles de formulário (`CampoForm`, `Selecao`, `Entrada`) moram aqui, e
 * não em `_ui/primitivos.tsx`, porque aquele arquivo não tem `'use client'` e o
 * comentário do topo dele proíbe estado — é o que permite que Server Components
 * usem os mesmos primitivos.
 */

import { useEffect, useRef, type ReactNode } from 'react'
import { Botao, Box, BoxB, BoxH, Pill } from '../../_ui/primitivos'

/* -------------------------------------------------------------------------- */
/* Controles de formulário                                                    */
/* -------------------------------------------------------------------------- */

const CLASSE_CONTROLE =
  'mt-1 w-full rounded-md border bg-[#0a1628] px-2.5 py-2 text-sm text-[#e8eef7] outline-none focus:border-[#f05a28] disabled:opacity-50'

function borda(invalido: boolean) {
  return invalido ? 'border-[#ff4d6d]' : 'border-[#1e3a5f]'
}

/**
 * Um campo do formulário: rótulo, controle, dica e mensagem de erro.
 * `campoF(mockup:681)`. A mensagem tem `role="alert"` — é a exigência de
 * acessibilidade da validação (o pedido 4 do briefing): quem usa leitor de tela
 * ouve o problema sem precisar caçar a caixa vermelha.
 */
export function CampoForm({
  id,
  rotulo,
  dica,
  erro,
  larga,
  children,
}: {
  id: string
  rotulo: ReactNode
  dica?: ReactNode
  erro?: string
  /** Ocupa a linha inteira da grade. */
  larga?: boolean
  children: ReactNode
}) {
  return (
    <div className={`min-w-0 ${larga ? 'sm:col-span-2' : ''}`}>
      <label htmlFor={id} className="block text-[11px] uppercase tracking-wide text-[#94a3b8]">
        {rotulo}
      </label>
      {children}
      {dica ? <span className="mt-1 block text-[11px] leading-snug text-[#64748b]">{dica}</span> : null}
      {erro ? (
        <span role="alert" className="mt-1 block text-[11px] font-semibold text-[#ff4d6d]">
          {erro}
        </span>
      ) : null}
    </div>
  )
}

/** Grade de campos do formulário. `fgrid` do mockup. */
export function GradeForm({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">{children}</div>
}

/**
 * `select` do formulário.
 *
 * O VALOR JÁ GRAVADO ENTRA NA LISTA MESMO FORA DELA (risco 6 da spec). `origem`
 * e `tipo` são texto livre no banco, herdados da importação de planilha: uma
 * lista fechada exibiria o valor antigo em branco e salvar o apagaria sem
 * ninguém notar.
 */
export function Selecao({
  id,
  opcoes,
  valor,
  vazio,
  desabilitado,
  invalido,
  onChange,
}: {
  id: string
  opcoes: readonly string[]
  valor: string
  /** O texto da opção vazia: "— não sei ainda —". */
  vazio: string
  desabilitado?: boolean
  invalido?: boolean
  onChange: (v: string) => void
}) {
  const lista = valor && !opcoes.includes(valor) ? [valor, ...opcoes] : opcoes
  return (
    <select
      id={id}
      value={valor}
      disabled={desabilitado}
      aria-invalid={invalido || undefined}
      onChange={(e) => onChange(e.target.value)}
      className={`${CLASSE_CONTROLE} ${borda(!!invalido)}`}
    >
      <option value="">{vazio}</option>
      {lista.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  )
}

/** `input` do formulário. */
export function Entrada({
  id,
  tipo = 'text',
  valor,
  desabilitado,
  invalido,
  onChange,
  ...resto
}: {
  id: string
  tipo?: 'text' | 'date' | 'number'
  valor: string
  desabilitado?: boolean
  invalido?: boolean
  onChange: (v: string) => void
} & Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  'id' | 'type' | 'value' | 'disabled' | 'onChange' | 'className'
>) {
  return (
    <input
      id={id}
      type={tipo}
      value={valor}
      disabled={desabilitado}
      aria-invalid={invalido || undefined}
      onChange={(e) => onChange(e.target.value)}
      className={`${CLASSE_CONTROLE} ${borda(!!invalido)}`}
      {...resto}
    />
  )
}

/** Bloco de campos que vêm do Field e não se editam aqui (R19). */
export function SoLeitura({ children }: { children: ReactNode }) {
  return (
    <div className="mt-1 rounded-md border border-dashed border-[#1e3a5f] bg-[#0a1628] px-2.5 py-2 text-sm text-[#94a3b8]">
      {children}
    </div>
  )
}

/** A etiqueta "vem do Field". */
export function EtiquetaField() {
  return (
    <span className="ml-1 rounded border border-[#1e3a5f] px-1 py-px text-[10px] uppercase tracking-wide text-[#64748b]">
      vem do Field
    </span>
  )
}

/**
 * Manda o foco para o primeiro campo inválido (`focarInvalido(mockup:683)`).
 * A ordem é a da tela, não a do objeto de erros: quem corrige começa de cima.
 */
export function focarPrimeiroInvalido(
  /** Pares `[campo do rascunho, id do controle]`, na ordem em que aparecem. */
  campos: readonly (readonly [string, string])[],
  erros: Record<string, unknown>
) {
  const par = campos.find(([campo]) => erros[campo])
  if (!par) return
  const el = document.getElementById(par[1])
  if (el && typeof el.focus === 'function') el.focus()
}

/* -------------------------------------------------------------------------- */
/* A casca                                                                     */
/* -------------------------------------------------------------------------- */

/** Texto da barra de ações enquanto a gravação está em voo (`blocoB`). */
export const HINT_SALVANDO = 'Gravando no sistema. Não feche a página.'

/** O hint padrão dos blocos que não pedem motivo nenhum. */
export const HINT_SEM_MOTIVO = 'Motivo não é obrigatório. Fica no histórico quem salvou.'

export default function BlocoEditavel({
  id,
  titulo,
  editando,
  salvando,
  erro,
  oQueNaoSalvou,
  complementoErro,
  hint,
  leitura,
  formulario,
  rodape,
  onEditar,
  onSalvar,
  onCancelar,
}: {
  /** `aut` | `ide` | `cro`. Só compõe os ids dos botões, como no mockup. */
  id: string
  titulo: string
  editando: boolean
  salvando: boolean
  /** A mensagem que o servidor devolveu. `null` = nenhuma falha. */
  erro: string | null
  /** "a autorização", "a identificação", "o cronograma". */
  oQueNaoSalvou: string
  /** Complemento do erro; só o cronograma usa, para citar o motivo escolhido. */
  complementoErro?: ReactNode
  hint: ReactNode
  leitura: ReactNode
  formulario: ReactNode
  rodape: ReactNode
  onEditar: () => void
  onSalvar: () => void
  onCancelar: () => void
}) {
  const botaoEditar = useRef<HTMLButtonElement>(null)
  const corpo = useRef<HTMLDivElement>(null)
  const estavaEditando = useRef(false)

  useEffect(() => {
    if (editando && !estavaEditando.current) {
      const primeiro = corpo.current?.querySelector<HTMLElement>(
        'select:not([disabled]), input:not([disabled]), textarea:not([disabled])'
      )
      primeiro?.focus()
    } else if (!editando && estavaEditando.current) {
      botaoEditar.current?.focus()
    }
    estavaEditando.current = editando
  }, [editando])

  return (
    <Box>
      <BoxH
        extra={
          editando ? (
            <Pill cor="#f4b73f">editando</Pill>
          ) : (
            <button
              ref={botaoEditar}
              id={`b-editar-${id}`}
              type="button"
              onClick={onEditar}
              aria-label={`Editar ${titulo}`}
              className="rounded-md border border-[#1e3a5f] px-2.5 py-1 text-[12px] font-medium text-[#e8eef7] transition hover:border-[#f05a28]"
            >
              Editar
            </button>
          )
        }
      >
        {titulo}
      </BoxH>

      <BoxB>
        <div ref={corpo}>
          {!editando ? (
            leitura
          ) : (
            <>
              {formulario}

              {erro ? (
                <div
                  role="alert"
                  className="mt-3 rounded-md border border-[#ff4d6d66] bg-[#ff4d6d14] px-3 py-2 text-[12px] leading-relaxed text-[#cbd5e1]"
                >
                  <strong className="block text-[#ff4d6d]">Não salvou {oQueNaoSalvou}</strong>
                  <p className="mt-1">
                    O sistema não confirmou, então <b className="text-[#e8eef7]">nada foi gravado</b>
                    {complementoErro}. O que você preencheu continua abaixo. Clique em Salvar de
                    novo. Se a mensagem disser que outra pessoa alterou esta obra, recarregue a
                    página e refaça a alteração.
                  </p>
                  <p className="mt-1 text-[#94a3b8]">O sistema respondeu: {erro}</p>
                </div>
              ) : null}

              <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
                <div className="flex gap-2">
                  <Botao
                    id={`b-salvar-${id}`}
                    type="button"
                    onClick={onSalvar}
                    disabled={salvando}
                  >
                    {salvando ? 'Salvando…' : 'Salvar'}
                  </Botao>
                  <Botao
                    id={`b-cancelar-${id}`}
                    type="button"
                    tipo="secundario"
                    onClick={onCancelar}
                    disabled={salvando}
                  >
                    Cancelar
                  </Botao>
                </div>
                <span
                  id={`b-hint-${id}`}
                  aria-live="polite"
                  className="text-[11px] leading-snug text-[#94a3b8]"
                >
                  {salvando ? HINT_SALVANDO : hint}
                </span>
              </div>
            </>
          )}
        </div>
      </BoxB>

      <footer className="border-t border-[#1e3a5f] px-4 py-2 text-[11px] text-[#64748b]">
        {rodape}
      </footer>
    </Box>
  )
}
