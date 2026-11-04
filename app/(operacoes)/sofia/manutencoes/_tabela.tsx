'use client'

/**
 * Base "Manutenção corretiva" com as ações da gaveta (spec 2026-11-03 §3.1):
 * gestor avança status, conclui e anexa; todos com Sofia veem o anexo.
 */
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { proximoStatus } from '@/lib/sofia/manutencoes'
import type { CorrLinha, FiltrosBase, Linha } from '@/lib/sofia/bases/tipos'
import BaseTabela from '../_base/BaseTabela'
import { AbrirArquivo } from '../_base/DetalheNovas'
import { avancarStatusManutencaoAction, verAnexoManutencaoAction } from './_actions'
import ConcluirManutencao from './_concluir'
import AnexoManutencao from './_anexo'

const BTN = 'px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-40'

function Acoes({ r, podeGerir, hoje }: { r: CorrLinha; podeGerir: boolean; hoje: string }) {
  const router = useRouter()
  const [pendente, iniciar] = useTransition()
  const [erro, setErro] = useState<string | null>(null)
  const prox = proximoStatus(r.status)
  const aberta = r.status !== 'concluida'

  const avancar = () => {
    if (!prox) return
    setErro(null)
    iniciar(async () => {
      const res = await avancarStatusManutencaoAction(r.id, prox.para)
      if (res.error) setErro(res.error)
      else router.refresh()
    })
  }

  return (
    <div className="flex flex-col gap-3">
      {podeGerir && aberta && (
        <>
          <div className="flex flex-wrap gap-2">
            {prox && (
              <button type="button" className={`${BTN} border border-[#1e3a5f] text-[#e8eef7] hover:border-[#94a3b8]`} disabled={pendente} onClick={avancar}>
                {pendente ? 'Salvando…' : prox.rotulo}
              </button>
            )}
            <ConcluirManutencao linha={r} hoje={hoje} />
          </div>
          <p className="text-xs text-[#4a6080]">
            Concluir pede a saída real, o custo e quem arca{r.tirou ? '; o veículo volta a Ativo' : ''}.
          </p>
        </>
      )}
      {erro && <p className="rounded-lg border border-red-600 bg-red-950 px-3 py-2 text-sm text-red-300">{erro}</p>}
      <div className="flex flex-wrap items-center gap-4">
        {r.temArquivo && <AbrirArquivo rotulo="Ver anexo" obter={() => verAnexoManutencaoAction(r.id)} />}
        {podeGerir && <AnexoManutencao id={r.id} temArquivo={r.temArquivo} />}
      </div>
      {!podeGerir && aberta && (
        <p className="rounded-lg border border-[#1e3a5f] bg-[#0d2050] px-3 py-2 text-sm text-[#94a3b8]">
          Só gestores de frotas registram e mudam o status de uma manutenção.
        </p>
      )}
    </div>
  )
}

export default function ManutencoesTabela(props: {
  linhas: CorrLinha[]
  filtrosIniciais: FiltrosBase
  hoje: string
  podeGerir: boolean
  equipes: string[]
  placas: string[]
  motoristas: string[]
  cabecalhoExtra: React.ReactNode
}) {
  return (
    <BaseTabela
      base="corr"
      nome="Manutenção corretiva"
      subtitulo="conserto que não é revisão: o carro quebra, vai à oficina, volta"
      linhas={props.linhas as Linha[]}
      filtrosIniciais={props.filtrosIniciais}
      hoje={props.hoje}
      podeGerir={props.podeGerir}
      equipes={props.equipes}
      placas={props.placas}
      motoristas={props.motoristas}
      novoHref={props.podeGerir ? '/sofia/manutencoes/nova' : undefined}
      novoLabel="Registrar manutenção corretiva"
      vazio="Nenhuma manutenção corretiva registrada ainda."
      placeholderBusca="Placa, defeito, oficina, texto…"
      cabecalhoExtra={props.cabecalhoExtra}
      acoesDetalhe={(r) => <Acoes r={r as CorrLinha} podeGerir={props.podeGerir} hoje={props.hoje} />}
    />
  )
}
