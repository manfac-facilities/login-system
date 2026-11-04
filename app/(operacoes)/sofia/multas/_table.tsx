'use client'

/**
 * Multas em tabela (BaseTabela base="multa"). Mesmas actions de antes: exclusão unitária
 * (excluirMultaAction) e em massa só da página visível (excluirMultasEmMassaAction, RPC que confere
 * o gestor). Etapa, desconto e autorização só mudam no fluxo da multa (/sofia/multas/[id]).
 */
import { useState, useTransition } from 'react'
import Link from 'next/link'
import DeleteConfirmButton from '@/components/sofia/DeleteConfirmButton'
import { classePrazo } from '@/lib/sofia/multaEtapas'
import type { FiltrosBase, Linha, MultaLinha } from '@/lib/sofia/bases/tipos'
import BaseTabela from '../_base/BaseTabela'
import PillPrazo from './_pill'
import { excluirMultaAction, excluirMultasEmMassaAction } from './_actions'

export default function MultasTable(props: {
  linhas: MultaLinha[]
  filtrosIniciais: FiltrosBase
  hoje: string
  podeGerir: boolean
  equipes: string[]
  placas: string[]
  motoristas: string[]
  subtitulo: string
}) {
  const { podeGerir, hoje } = props
  const [marcados, setMarcados] = useState<string[]>([])
  const [isPending, startTransition] = useTransition()
  const [erro, setErro] = useState<string | null>(null)

  function excluirSelecionadas() {
    if (!window.confirm(`Excluir ${marcados.length} multa(s) selecionada(s)? Essa ação não pode ser desfeita.`)) return
    setErro(null)
    startTransition(async () => {
      try {
        await excluirMultasEmMassaAction(marcados)
        setMarcados([])
      } catch {
        setErro('Erro ao excluir as multas selecionadas')
      }
    })
  }

  const barra =
    podeGerir && (marcados.length > 0 || erro) ? (
      <div className="mb-3 flex flex-wrap items-center gap-3 rounded-lg border border-[#1e3a5f] bg-[#0d2050] px-4 py-2">
        {marcados.length > 0 && (
          <>
            <span className="text-sm text-[#94a3b8]">{marcados.length} selecionada(s)</span>
            <button
              type="button"
              onClick={excluirSelecionadas}
              disabled={isPending}
              className="text-sm text-red-400 hover:underline disabled:opacity-50 disabled:no-underline"
            >
              Excluir selecionadas
            </button>
          </>
        )}
        {erro && <span className="text-sm text-red-400">{erro}</span>}
      </div>
    ) : null

  return (
    <BaseTabela
      base="multa"
      nome="Multas"
      subtitulo={props.subtitulo}
      linhas={props.linhas as Linha[]}
      filtrosIniciais={props.filtrosIniciais}
      hoje={hoje}
      podeGerir={podeGerir}
      equipes={props.equipes}
      placas={props.placas}
      motoristas={props.motoristas}
      novoHref="/sofia/multas/nova"
      novoLabel="Registrar multa"
      vazio="Nenhuma multa registrada."
      placeholderBusca="Placa, motorista, infração…"
      cabecalhoExtra={barra}
      selecao={podeGerir ? { marcados, onChange: setMarcados } : undefined}
      celula={(k, r) => {
        if (k !== 'prazo') return undefined
        const m = r as MultaLinha
        return <PillPrazo prazo={classePrazo(m.prazo, m.sit, hoje)} />
      }}
      acoesDetalhe={(r) => {
        const m = r as MultaLinha
        return (
          <div className="flex flex-wrap items-center gap-4">
            <Link
              href={`/sofia/multas/${m.id}`}
              className="rounded-lg bg-[#f05a28] px-4 py-2 text-sm font-medium text-white hover:bg-[#d94e22]"
            >
              Abrir no fluxo da multa
            </Link>
            {podeGerir && (
              <DeleteConfirmButton
                action={excluirMultaAction}
                id={m.id}
                label="Excluir"
                itemLabel={`multa de ${m.placa} — R$ ${m.valor.toFixed(2)}`}
              />
            )}
          </div>
        )
      }}
    />
  )
}
