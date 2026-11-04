'use client'
/** "Registrar manutenção corretiva" (spec 2026-11-03 §3.1; textos do mockup). Só gestor chega aqui. */
import { useActionState, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { dataBR } from '@/lib/sofia/correcoes'
import { ARCA_LBL, QUEM_ARCA, STATUS_ABERTURA, STATUS_LBL } from '@/lib/sofia/manutencoes'
import { somarDias } from '@/lib/sofia/revisaoPrevisao'
import { abrirManutencaoAction } from '../_actions'

interface VeiculoOpcao { id: string; placa: string; modelo: string; naOficina: boolean; equipe: string | null }
const CAMPO = 'px-3 py-2.5 rounded-lg bg-[#0f1f3d] border border-[#1e3a5f] text-white placeholder-[#4a6080] focus:outline-none focus:border-[#f05a28] text-sm [color-scheme:dark]'
const ROTULO = 'text-sm text-[#94a3b8]'

export default function NovaManutencaoForm({ veiculos, veiculoInicial, hoje }: { veiculos: VeiculoOpcao[]; veiculoInicial: string; hoje: string }) {
  const [state, action, isPending] = useActionState(abrirManutencaoAction, {})
  const router = useRouter()
  const [veiculoId, setVeiculoId] = useState(veiculoInicial)
  const [saidaPrev, setSaidaPrev] = useState(somarDias(hoje, 3))
  const [tirar, setTirar] = useState(true)

  useEffect(() => {
    if (state.success) router.push('/sofia/manutencoes')
  }, [state.success, router])

  const v = veiculos.find((x) => x.id === veiculoId)
  const efeito = !tirar
    ? 'O carro continua com a equipe; só o registro e o custo ficam guardados (reparo de um dia).'
    : v?.equipe
      ? `${v.equipe} fica sem carro${saidaPrev ? ` até ${dataBR(saidaPrev)}` : ''}; o veículo vira "Em manutenção".`
      : v
        ? 'O veículo vira "Em manutenção".'
        : 'O veículo vira "Em manutenção" e a equipe fica sem carro até a saída prevista.'

  return (
    <div className="p-4 sm:p-8 max-w-md">
      <h1 className="text-2xl font-bold text-white mb-2">Registrar manutenção corretiva</h1>
      <p className="text-[#4a6080] text-sm mb-8">Conserto que não é revisão: o carro quebra, vai à oficina, volta.</p>

      <form action={action} className="flex flex-col gap-4">
        {state.error && (
          <div className="px-4 py-3 rounded-lg border border-red-600 bg-red-950 text-red-300 text-sm">{state.error}</div>
        )}

        <label className="flex flex-col gap-1.5">
          <span className={ROTULO}>Veículo *</span>
          <select name="veiculo_id" value={veiculoId} onChange={(e) => setVeiculoId(e.target.value)} className={CAMPO}>
            <option value="">Selecione…</option>
            {veiculos.map((x) => (
              <option key={x.id} value={x.id}>{x.placa} · {x.modelo}{x.naOficina ? ' (já na oficina)' : ''}</option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className={ROTULO}>Defeito *</span>
          <input name="defeito" placeholder="Ex.: embreagem patinando" className={CAMPO} />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className={ROTULO}>Oficina</span>
          <input name="oficina" placeholder="Nome da oficina" className={CAMPO} />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1.5">
            <span className={ROTULO}>Data de entrada *</span>
            <input name="data_entrada" type="date" defaultValue={hoje} className={CAMPO} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={ROTULO}>Saída prevista</span>
            <input name="saida_prevista" type="date" value={saidaPrev} onChange={(e) => setSaidaPrev(e.target.value)} className={CAMPO} />
          </label>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1.5">
            <span className={ROTULO}>Custo (R$) — pode vir depois</span>
            <input name="custo" type="number" step="0.01" min={0} placeholder="a definir" className={CAMPO} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={ROTULO}>Quem arca</span>
            <select name="quem_arca" defaultValue="" className={CAMPO}>
              <option value="">A definir</option>
              {QUEM_ARCA.map((k) => <option key={k} value={k}>{ARCA_LBL[k]}</option>)}
            </select>
          </label>
        </div>

        <label className="flex flex-col gap-1.5">
          <span className={ROTULO}>Status</span>
          <select name="status" defaultValue="aguardando_orcamento" className={CAMPO}>
            {STATUS_ABERTURA.map((k) => <option key={k} value={k}>{STATUS_LBL[k]}</option>)}
          </select>
        </label>

        <label className={`flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2.5 ${tirar ? 'border-[#f05a28] bg-[#0d2050]' : 'border-[#1e3a5f]'}`}>
          <input type="checkbox" name="tirar_da_equipe" checked={tirar} onChange={(e) => setTirar(e.target.checked)} className="mt-1" />
          <span className="text-sm">
            <b className="text-white">Tirar o carro da equipe (enviar para a oficina)</b>
            <span className="block text-xs text-[#4a6080]">{efeito}</span>
          </span>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className={ROTULO}>Observações</span>
          <textarea name="observacoes" rows={3} placeholder="Itens do orçamento, contato da oficina…" className={`${CAMPO} resize-none`} />
        </label>

        <div className="flex gap-3 mt-2">
          <button type="button" onClick={() => router.back()} className="flex-1 py-2.5 rounded-lg border border-[#1e3a5f] text-[#94a3b8] text-sm hover:border-[#94a3b8]">
            Cancelar
          </button>
          <button type="submit" disabled={isPending} className="flex-1 py-2.5 rounded-lg bg-[#f05a28] text-white text-sm font-medium hover:bg-[#d94e22] disabled:opacity-50">
            {isPending ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </form>
    </div>
  )
}
