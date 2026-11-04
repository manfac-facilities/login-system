import { carregarBase } from '@/lib/sofia/bases/leitura'
import { filtrosDaUrl } from '@/lib/sofia/bases/filtro'
import { fmtBrl } from '@/lib/sofia/correcoes'
import { cartoesCorretiva, diasParadosNoMes, type ManutencaoBase } from '@/lib/sofia/manutencoes'
import type { CorrLinha } from '@/lib/sofia/bases/tipos'
import ManutencoesTabela from './_tabela'

function Cartao({ titulo, valor, sub, quente }: { titulo: string; valor: string; sub: string; quente?: boolean }) {
  return (
    <div className={`rounded-xl border border-[#1e3a5f] p-4 ${quente ? 'bg-red-950/30' : 'bg-[#0d2050]'}`}>
      <div className="text-xs uppercase tracking-wide text-[#94a3b8]">{titulo}</div>
      <div className={`mt-1 text-2xl font-bold ${quente ? 'text-red-300' : 'text-white'}`}>{valor}</div>
      <div className="text-xs text-[#4a6080]">{sub}</div>
    </div>
  )
}

export default async function ManutencoesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  const base = await carregarBase('corr')
  const linhas = base.linhas as CorrLinha[]
  const hoje = base.hoje
  const brutas: ManutencaoBase[] = linhas.map((r) => ({
    placa: r.placa, data_entrada: r.data, data_saida: r.saida, custo: r.custo, status: r.status, tirou_da_equipe: r.tirou,
  }))
  const c = cartoesCorretiva(brutas, base.veiculos.filter((v) => v.status === 'manutencao').length, hoje)
  const mes = new Date(`${hoje.slice(0, 7)}-15T12:00:00Z`).toLocaleDateString('pt-BR', { month: 'long', timeZone: 'UTC' })
  const parados = diasParadosNoMes(brutas, hoje.slice(0, 7), hoje)
  const max = Math.max(1, ...parados.map((p) => p.dias))

  const cartoes = (
    <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
      <Cartao titulo="Em aberto" valor={String(c.emAberto)} sub={`${c.comCarroParado} com o carro parado na oficina`} quente={c.emAberto > 0} />
      <Cartao titulo={`Custo de corretiva em ${mes}`} valor={fmtBrl(c.custoMes)} sub={`${c.servicosComValor} ${c.servicosComValor === 1 ? 'serviço' : 'serviços'} com valor lançado`} />
      <Cartao titulo="Carros parados hoje" valor={String(c.carrosParados)} sub="veículos em manutenção (também na Disponibilidade)" />
    </div>
  )

  return (
    <>
      <ManutencoesTabela
        linhas={linhas}
        filtrosIniciais={filtrosDaUrl('corr', params, hoje)}
        hoje={hoje}
        podeGerir={base.podeGerir}
        placas={base.placas}
        motoristas={base.motoristas}
        equipes={base.equipes}
        cabecalhoExtra={cartoes}
      />
      <section className="px-4 pb-8 sm:px-8">
        <h2 className="mb-1 text-sm font-semibold text-white">Impacto na disponibilidade ({mes})</h2>
        <p className="mb-3 text-xs text-[#4a6080]">Dias parados por carro no mês. Só conta a manutenção que tirou o carro da equipe.</p>
        <div className="rounded-xl border border-[#1e3a5f] bg-[#0d2050] p-4">
          {parados.length === 0 ? (
            <p className="text-sm text-[#94a3b8]">Nenhum carro parado em {mes}.</p>
          ) : (
            <ul className="space-y-2">
              {parados.map((p) => (
                <li key={p.placa} className="grid grid-cols-[80px_1fr_64px] items-center gap-3 text-sm">
                  <b className="font-mono text-white">{p.placa}</b>
                  <span className="h-2 overflow-hidden rounded bg-[#1e3a5f]">
                    <span className="block h-full rounded bg-[#f05a28]" style={{ width: `${(p.dias / max) * 100}%` }} />
                  </span>
                  <span className="text-right font-mono text-[#94a3b8]">{p.dias} dia{p.dias > 1 ? 's' : ''}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </>
  )
}
