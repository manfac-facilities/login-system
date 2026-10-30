import { createClient } from '@/lib/supabase/server'
import { carregarBase } from '@/lib/sofia/bases/leitura'
import { filtrosDaUrl } from '@/lib/sofia/bases/filtro'
import type { AbastLinha } from '@/lib/sofia/bases/tipos'
import BaseTabela from '../_base/BaseTabela'

export default async function AbastecimentoPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  const base = await carregarBase('abast')
  const linhas = base.linhas as AbastLinha[]

  const inicioMes = `${base.hoje.slice(0, 7)}-01`
  const supabase = await createClient()
  const { data: kmMes } = await supabase
    .from('km_diario')
    .select('km_atual, veiculos(placa)')
    .gte('data', inicioMes)

  // km rodados no mês = MAX(km_atual) - MIN(km_atual) por veículo
  const kmRange = new Map<string, { min: number; max: number }>()
  for (const k of (kmMes ?? []) as unknown as { km_atual: number; veiculos: { placa: string } | null }[]) {
    const placa = k.veiculos?.placa
    if (!placa) continue
    const c = kmRange.get(placa)
    kmRange.set(placa, c ? { min: Math.min(c.min, k.km_atual), max: Math.max(c.max, k.km_atual) } : { min: k.km_atual, max: k.km_atual })
  }
  const porPlaca = new Map<string, { litros: number; valor: number }>()
  for (const a of linhas.filter((l) => l.data >= inicioMes)) {
    const c = porPlaca.get(a.placa) ?? { litros: 0, valor: 0 }
    c.litros += a.litros ?? 0
    c.valor += a.valor
    porPlaca.set(a.placa, c)
  }
  const relatorio = Array.from(porPlaca.entries()).map(([placa, r]) => {
    const range = kmRange.get(placa)
    const km = range ? range.max - range.min : 0
    return { placa, ...r, valorPorKm: km > 0 ? r.valor / km : null, kmPorLitro: r.litros > 0 && km > 0 ? km / r.litros : null }
  })

  const corrigido = params.corrigido === '1'

  return (
    <>
      {corrigido && (
        <div className="mx-4 mt-4 sm:mx-8 sm:mt-8 px-4 py-3 rounded-lg border border-green-600 bg-green-950 text-green-300 text-sm">
          Abastecimento corrigido. A correção foi para o histórico.
        </div>
      )}
      <BaseTabela
        base="abast"
        nome="Abastecimentos"
        linhas={linhas}
        filtrosIniciais={filtrosDaUrl('abast', params, base.hoje)}
        hoje={base.hoje}
        podeGerir={base.podeGerir}
        equipes={base.equipes}
        placas={base.placas}
        motoristas={base.motoristas}
        novoHref="/sofia/abastecimento/novo"
        novoLabel="Registrar novo abastecimento"
        vazio="Nenhum abastecimento registrado ainda."
        placeholderBusca="Placa, posto, motorista…"
      />
      <div className="px-4 pb-8 sm:px-8">
        <h2 className="text-sm font-medium text-[#4a6080] uppercase tracking-wider mb-3">Consumo do mês</h2>
        {relatorio.length === 0 ? (
          <p className="text-[#4a6080] text-sm">Nenhum abastecimento lançado neste mês.</p>
        ) : (
          <div className="rounded-xl border border-[#1e3a5f] overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#1e3a5f] bg-[#0d2050]">
                  <th className="text-left px-4 py-3 text-[#4a6080] font-medium">Placa</th>
                  <th className="text-right px-4 py-3 text-[#4a6080] font-medium">Litros</th>
                  <th className="text-right px-4 py-3 text-[#4a6080] font-medium">Valor</th>
                  <th className="text-right px-4 py-3 text-[#4a6080] font-medium">R$/km</th>
                  <th className="text-right px-4 py-3 text-[#4a6080] font-medium">Km/litro</th>
                </tr>
              </thead>
              <tbody>
                {relatorio.map((r) => (
                  <tr key={r.placa} className="border-b border-[#1e3a5f] hover:bg-[#0d2050] transition-colors">
                    <td className="px-4 py-3 text-white font-mono">{r.placa}</td>
                    <td className="px-4 py-3 text-[#94a3b8] text-right">{r.litros > 0 ? r.litros.toFixed(1) : '—'}</td>
                    <td className="px-4 py-3 text-white text-right font-medium">R$ {r.valor.toFixed(2)}</td>
                    <td className="px-4 py-3 text-[#94a3b8] text-right">{r.valorPorKm != null ? `R$ ${r.valorPorKm.toFixed(2)}` : '—'}</td>
                    <td className="px-4 py-3 text-[#94a3b8] text-right">{r.kmPorLitro != null ? r.kmPorLitro.toFixed(1) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  )
}
