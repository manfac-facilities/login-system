'use client'

/** "Concluir e retornar o carro" (mockup, modal corrfim): saída real, custo final e quem arca. */
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Dialogo, { Consequencias } from '@/components/sofia/Dialogo'
import { ARCA_LBL, QUEM_ARCA, validarConclusao } from '@/lib/sofia/manutencoes'
import type { CorrLinha } from '@/lib/sofia/bases/tipos'
import { concluirManutencaoAction } from './_actions'

const CAMPO = 'w-full rounded-lg border border-[#1e3a5f] bg-[#0f1f3d] px-3 py-2 text-sm text-white focus:border-[#f05a28] focus:outline-none [color-scheme:dark]'

export default function ConcluirManutencao({ linha, hoje }: { linha: CorrLinha; hoje: string }) {
  const [aberto, setAberto] = useState(false)
  return (
    <>
      <button type="button" onClick={() => setAberto(true)} className="rounded-lg bg-[#f05a28] px-4 py-2 text-sm font-medium text-white hover:bg-[#d94e22]">
        Concluir e retornar o carro
      </button>
      {aberto && <Formulario linha={linha} hoje={hoje} onFechar={() => setAberto(false)} />}
    </>
  )
}

function Formulario({ linha, hoje, onFechar }: { linha: CorrLinha; hoje: string; onFechar: () => void }) {
  const router = useRouter()
  const [pendente, iniciar] = useTransition()
  const [saida, setSaida] = useState(hoje)
  const [custo, setCusto] = useState(linha.custo == null ? '' : String(linha.custo))
  const [arca, setArca] = useState<string>(linha.arca ?? '')
  const [erro, setErro] = useState<string | null>(null)

  const salvar = () => {
    const f = { data_saida: saida, custo, quem_arca: arca }
    const invalido = validarConclusao(f, { data_entrada: linha.data })
    if (invalido) return setErro(invalido)
    setErro(null)
    iniciar(async () => {
      const r = await concluirManutencaoAction(linha.id, f)
      if (r.error) return setErro(r.error)
      onFechar()
      router.refresh()
    })
  }

  return (
    <Dialogo titulo={`Concluir manutenção · ${linha.placa}`} onFechar={onFechar}>
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm text-[#94a3b8]">
          Saída real *
          <input type="date" className={CAMPO} value={saida} min={linha.data} onChange={(e) => setSaida(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1 text-sm text-[#94a3b8]">
          Custo final (R$) *
          <input type="number" step="0.01" min={0} className={CAMPO} value={custo} onChange={(e) => setCusto(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1 text-sm text-[#94a3b8] sm:col-span-2">
          Quem arca *
          <select className={CAMPO} value={arca} onChange={(e) => setArca(e.target.value)}>
            <option value="">Selecione</option>
            {QUEM_ARCA.map((k) => <option key={k} value={k}>{ARCA_LBL[k]}</option>)}
          </select>
        </label>
      </div>
      {linha.tirou && (
        <Consequencias titulo="O que acontece ao salvar">
          O veículo <b className="text-white">{linha.placa}</b> volta para <b className="text-white">Ativo</b> (igual ao
          &quot;Retornar da oficina&quot;). A equipe é escolhida depois, no checklist.
        </Consequencias>
      )}
      {erro && <p className="mt-3 rounded-lg border border-red-600 bg-red-950 px-3 py-2 text-sm text-red-300">{erro}</p>}
      <div className="mt-4 flex flex-wrap justify-end gap-2">
        <button type="button" onClick={onFechar} className="rounded-lg border border-[#1e3a5f] px-4 py-2 text-sm text-[#94a3b8] hover:border-[#94a3b8]">Cancelar</button>
        <button type="button" onClick={salvar} disabled={pendente} className="rounded-lg bg-[#f05a28] px-4 py-2 text-sm font-medium text-white hover:bg-[#d94e22] disabled:opacity-50">
          {pendente ? 'Salvando…' : 'Concluir'}
        </button>
      </div>
    </Dialogo>
  )
}
