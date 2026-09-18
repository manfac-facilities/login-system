'use client'

/**
 * A janela (diálogo modal) do Controle de Obras.
 *
 * POR QUE UM ARQUIVO NOVO: `_ui/primitivos.tsx` não tem `'use client'` e o
 * comentário do topo dele diz "Não acrescente estado aqui" — é o que permite que
 * Server e Client Components usem os mesmos primitivos. Diálogo tem foco, Esc e
 * ciclo de vida: não cabe lá. Ver §5.1 da spec da ficha editável.
 *
 * Reproduz `abrirDlg()` do mockup aprovado (`mockup-j4-v02.html:660-673`) sobre
 * o `<dialog>` NATIVO, e é dele que vêm de graça as coisas que uma div fingindo
 * de modal erra: backdrop, `aria-modal`, prender o foco dentro da janela,
 * fechar no Esc e ficar por cima de tudo (top layer), sem `z-index` nem
 * biblioteca.
 *
 * CONTRATO COM QUEM USA — o mesmo do mockup, e ele importa:
 *   • `aberto` é a fonte da verdade. O componente é controlado: ele não abre
 *     nem fecha sozinho.
 *   • CLICAR EM QUALQUER BOTÃO FECHA A JANELA e só depois roda o `onClick`,
 *     exatamente como o mockup (`fecharDlg(); if(b.fn) b.fn();`). Quem precisa
 *     mostrar "Salvando…" mostra no bloco, não aqui.
 *   • Esc fecha e chama `onFechar` sem rodar `onClick` nenhum — fechar não
 *     confirma nada.
 *   • O foco volta para o elemento que abriu a janela, sempre. Quem clicou em
 *     "Salvar" continua com o teclado no "Salvar".
 *
 * O CAMINHO DE RESERVA NÃO É ZELO EXCESSIVO — é o que roda no teste. VERIFICADO
 * em 18/09/2026: o jsdom desta versão (jest-environment-jsdom 30) **não
 * implementa `HTMLDialogElement`**: `showModal`, `close` e o fechar-no-Esc
 * simplesmente não existem, e `typeof d.showModal` é `undefined`. Por isso
 * cada passo tem o equivalente manual — `open` como atributo, foco devolvido à
 * mão, Esc por `keydown` — e por isso a devolução de foco não pode depender do
 * evento `close`, que lá nunca é disparado. Em navegador de verdade o nativo
 * faz tudo e o reserva fica desligado (o `keydown` só é registrado quando
 * `showModal` não existe, senão o Esc fecharia duas vezes).
 */

import { useCallback, useEffect, useId, useRef, type ReactNode } from 'react'
import { Botao } from './primitivos'

export type BotaoDialogo = {
  id: string
  texto: string
  /** Botão secundário. O PRIMEIRO `ghost` habilitado é quem recebe o foco. */
  ghost?: boolean
  desabilitado?: boolean
  onClick?: () => void
}

export default function Dialogo({
  aberto,
  titulo,
  children,
  botoes,
  onFechar,
}: {
  aberto: boolean
  titulo: string
  children: ReactNode
  botoes: BotaoDialogo[]
  onFechar: () => void
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const rodape = useRef<HTMLDivElement>(null)
  /** Quem abriu a janela, para devolver o foco no fim. */
  const gatilho = useRef<HTMLElement | null>(null)
  /** Fechamento pedido pelo pai (`aberto: false`) não deve ecoar `onFechar`. */
  const fechandoPorProps = useRef(false)
  const tituloId = useId()

  /**
   * Quem recebe o foco ao abrir: o primeiro `ghost` habilitado — no mockup é o
   * "Cancelar" —, senão o primeiro botão habilitado. O foco nasce na saída, não
   * na ação destrutiva: Enter sem ler não pode gravar nada.
   */
  const alvoFoco = (() => {
    const i = botoes.findIndex((b) => b.ghost && !b.desabilitado)
    if (i >= 0) return i
    const j = botoes.findIndex((b) => !b.desabilitado)
    return j >= 0 ? j : 0
  })()

  const devolverFoco = useCallback(() => {
    const quem = gatilho.current
    gatilho.current = null
    if (quem && typeof quem.focus === 'function' && document.contains(quem)) quem.focus()
  }, [])

  /**
   * `ecoar` diz se o pai precisa ser avisado: botão e Esc avisam (é o pai que
   * guarda `aberto`); o fechamento que o próprio pai pediu, não — senão
   * `onFechar` voltaria como eco do que ele acabou de mandar.
   */
  const encerrar = useCallback(
    (ecoar: boolean) => {
      const d = ref.current
      if (!d || !d.open) {
        if (ecoar) onFechar()
        return
      }
      if (typeof d.close === 'function') {
        fechandoPorProps.current = !ecoar
        d.close() // dispara `close`: é lá que o foco volta e o pai é avisado
      } else {
        d.removeAttribute('open')
        devolverFoco()
        if (ecoar) onFechar()
      }
    },
    [onFechar, devolverFoco]
  )

  // Abrir e fechar seguem `aberto`, sempre.
  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (aberto && !d.open) {
      gatilho.current = document.activeElement as HTMLElement | null
      if (typeof d.showModal === 'function') d.showModal()
      else d.setAttribute('open', '')
      rodape.current?.querySelectorAll('button')[alvoFoco]?.focus()
    } else if (!aberto && d.open) {
      encerrar(false)
    }
  }, [aberto, alvoFoco, encerrar])

  // O `close` nativo: Esc do navegador, `close()` nosso, ou o botão.
  // `addEventListener` direto, e não `onClose`, porque `close` não borbulha.
  useEffect(() => {
    const d = ref.current
    if (!d) return
    function aoFechar() {
      devolverFoco()
      if (fechandoPorProps.current) {
        fechandoPorProps.current = false
        return
      }
      onFechar()
    }
    d.addEventListener('close', aoFechar)
    return () => d.removeEventListener('close', aoFechar)
  }, [onFechar, devolverFoco])

  // Esc — só onde o `<dialog>` nativo não o trata.
  useEffect(() => {
    const d = ref.current
    if (!aberto || !d || typeof d.showModal === 'function') return
    function aoTeclar(ev: KeyboardEvent) {
      if (ev.key !== 'Escape') return
      ev.preventDefault()
      encerrar(true)
    }
    document.addEventListener('keydown', aoTeclar)
    return () => document.removeEventListener('keydown', aoTeclar)
  }, [aberto, encerrar])

  return (
    <dialog
      ref={ref}
      aria-labelledby={tituloId}
      className="w-[calc(100%-32px)] max-w-[580px] rounded-lg border border-[#1e3a5f] bg-[#0d2050] p-0 text-[#e8eef7] backdrop:bg-[#030812b8]"
    >
      {aberto ? (
        <>
          <h2
            id={tituloId}
            className="border-b border-[#1e3a5f] bg-[#0f1f3d] px-4 py-3 text-sm font-semibold text-[#e8eef7]"
          >
            {titulo}
          </h2>
          <div className="max-h-[70vh] overflow-auto px-4 py-3.5 text-[13px] text-[#94a3b8]">
            {children}
          </div>
          <div ref={rodape} className="flex flex-wrap gap-2.5 px-4 pb-3.5">
            {botoes.map((b) => (
              <Botao
                key={b.id}
                id={b.id}
                type="button"
                tipo={b.ghost ? 'secundario' : 'principal'}
                disabled={b.desabilitado}
                onClick={() => {
                  encerrar(true)
                  b.onClick?.()
                }}
              >
                {b.texto}
              </Botao>
            ))}
          </div>
        </>
      ) : null}
    </dialog>
  )
}
