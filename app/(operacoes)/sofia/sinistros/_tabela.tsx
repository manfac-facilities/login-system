'use client'

/**
 * Sinistros em tabela (BaseTabela base="sin"). Autorização por linha e exclusão continuam
 * com as mesmas actions e regras de antes (AutorizacaoActions só com botões para gestor;
 * excluirSinistroAction confere o gestor de novo).
 */
import Link from 'next/link'
import AutorizacaoActions from '@/components/sofia/AutorizacaoActions'
import DeleteConfirmButton from '@/components/sofia/DeleteConfirmButton'
import type { FiltrosBase, Linha, SinLinha } from '@/lib/sofia/bases/tipos'
import BaseTabela from '../_base/BaseTabela'
import { atualizarAutorizacaoSinistroAction, excluirSinistroAction } from './_actions'

export default function SinistrosTabela(props: {
  linhas: SinLinha[]
  filtrosIniciais: FiltrosBase
  hoje: string
  podeGerir: boolean
  equipes: string[]
  placas: string[]
  motoristas: string[]
  subtitulo: string
}) {
  const { podeGerir } = props
  return (
    <BaseTabela
      base="sin"
      nome="Sinistros"
      subtitulo={props.subtitulo}
      linhas={props.linhas as Linha[]}
      filtrosIniciais={props.filtrosIniciais}
      hoje={props.hoje}
      podeGerir={podeGerir}
      equipes={props.equipes}
      placas={props.placas}
      motoristas={props.motoristas}
      novoHref="/sofia/sinistros/novo"
      novoLabel="Registrar sinistro"
      vazio="Nenhum sinistro registrado ainda."
      placeholderBusca="Placa, motorista, descrição…"
      celula={(k, r) => {
        if (k !== 'aut') return undefined
        const s = r as SinLinha
        return (
          <AutorizacaoActions
            status={s.aut}
            solicitadoEm={s.autSolicitadoEm}
            action={atualizarAutorizacaoSinistroAction.bind(null, s.id)}
            showActions={podeGerir}
          />
        )
      }}
      acoesDetalhe={(r) => {
        const s = r as SinLinha
        return (
          <div className="flex flex-wrap items-center gap-4">
            <Link href={`/sofia/sinistros/${s.id}`} className="rounded-lg bg-[#f05a28] px-4 py-2 text-sm font-medium text-white hover:bg-[#d94e22]">
              Abrir sinistro
            </Link>
            {podeGerir && (
              <DeleteConfirmButton action={excluirSinistroAction} id={s.id} label="Excluir" itemLabel={`sinistro de ${s.placa}`} />
            )}
          </div>
        )
      }}
    />
  )
}
