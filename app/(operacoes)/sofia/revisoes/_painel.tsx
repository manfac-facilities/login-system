/**
 * Tela 1 do mockup de 03/11/2026: "Revisão a cada 10 mil km", um carro por linha, do mais urgente.
 * Componente de servidor; só o diálogo de importação é client.
 */
import Link from 'next/link'
import { dataBR, diaMes, fmtKm } from '@/lib/sofia/correcoes'
import { INTERVALO_REVISAO_KM_PADRAO, textoPendencia, type SituacaoCarro } from '@/lib/sofia/revisaoPrevisao'
import { MARGEM_AVISO_KM } from '@/lib/sofia/revisaoStatus'
import type { ItemPainel, PainelRevisoes } from '@/lib/sofia/revisaoLeitura'
import ImportarRevisoes from './_importar'

export const FILTROS_PAINEL = ['', 'atrasada', 'breve', 'd30', 'sp'] as const
export type FiltroPainel = (typeof FILTROS_PAINEL)[number]

const SIT: Record<SituacaoCarro, [string, string]> = {
  atrasada: ['Atrasada', 'bg-red-900 text-red-300'],
  breve: ['Vence em breve', 'bg-amber-900 text-amber-300'],
  dia: ['Em dia', 'bg-green-900 text-green-300'],
  semprev: ['Sem previsão automática', 'bg-[#1e3a5f] text-[#94a3b8]'],
  sembase: ['Sem revisão registrada', 'bg-[#1e3a5f] text-[#94a3b8]'],
}
const CHIP = 'px-1.5 py-0.5 rounded text-[11px] font-medium whitespace-nowrap'
const BTN = 'px-4 py-2 rounded-lg text-sm font-medium transition-colors'

function SitChip({ s }: { s: SituacaoCarro }) {
  return <span className={`${CHIP} ${SIT[s][1]}`}>{SIT[s][0]}</span>
}

function passa(i: ItemPainel, f: FiltroPainel): boolean {
  if (!f) return true
  if (f === 'd30') return i.s === 'dia' && i.dias != null && i.dias <= 30
  if (f === 'sp') return i.s === 'semprev' || i.s === 'sembase'
  return i.s === f
}

function Cartao({ k, ativo, titulo, n, sub, quente }: { k: FiltroPainel; ativo: FiltroPainel; titulo: string; n: number; sub: string; quente?: boolean }) {
  const on = ativo === k
  return (
    <Link
      href={on ? '/sofia/revisoes' : `/sofia/revisoes?sit=${k}`}
      className={`block rounded-xl border p-4 transition-colors ${on ? 'border-[#f05a28]' : 'border-[#1e3a5f] hover:border-[#94a3b8]'} ${quente && n > 0 ? 'bg-red-950/30' : 'bg-[#0d2050]'}`}
    >
      <div className="text-xs uppercase tracking-wide text-[#94a3b8]">{titulo}</div>
      <div className={`mt-1 text-2xl font-bold ${quente && n > 0 ? 'text-red-300' : 'text-white'}`}>{n}</div>
      <div className="text-xs text-[#4a6080]">{sub}</div>
    </Link>
  )
}

export default function Painel({ painel, filtro }: { painel: PainelRevisoes; filtro: FiltroPainel }) {
  const { lista, cartoes, podeGerir, hoje } = painel
  const visiveis = lista.filter((i) => passa(i, filtro))
  const pendencias = lista.filter((i) => i.s === 'atrasada' || i.s === 'breve')
  const importar = podeGerir && painel.contextoImportacao
    ? <ImportarRevisoes contexto={painel.contextoImportacao} hoje={hoje} />
    : null

  return (
    <div className="p-4 sm:p-8">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-white">Revisões</h1>
          <p className="mt-1 max-w-2xl text-sm text-[#4a6080]">
            O sistema usa o KM diário para prever a próxima revisão de cada carro, mostra quando ela deve chegar e avisa antes de passar.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/sofia/revisoes/nova" className={`${BTN} bg-[#f05a28] text-white hover:bg-[#d94e22]`}>+ Registrar revisão</Link>
          {importar}
          <Link href="/sofia/revisoes/historico" className={`${BTN} border border-[#1e3a5f] text-[#e8eef7] hover:border-[#94a3b8]`}>Histórico de revisões</Link>
        </div>
      </div>

      <div className="mb-4 rounded-xl border border-[#1e3a5f] bg-[#0d2050] px-4 py-3 text-sm text-[#94a3b8]">
        <b className="text-white">Intervalo entre revisões: {fmtKm(INTERVALO_REVISAO_KM_PADRAO)} km</b> (padrão)
        {painel.comIntervaloProprio > 0 && ` · ${painel.comIntervaloProprio} ${painel.comIntervaloProprio === 1 ? 'carro com intervalo próprio' : 'carros com intervalo próprio'}`}
        <span className="block text-xs text-[#4a6080]">
          O aviso começa {fmtKm(MARGEM_AVISO_KM)} km antes. O intervalo próprio de um carro se muda na ficha do veículo (gestor).
        </span>
      </div>

      {painel.totalRevisoes === 0 ? (
        <div className="rounded-xl border border-dashed border-[#1e3a5f] px-4 py-12 text-center text-[#94a3b8]">
          <p className="mb-3">Nenhuma revisão registrada ainda.</p>
          {importar && <p className="mb-4 text-sm text-[#4a6080]">Importe a planilha de revisões para o sistema já começar a prever.</p>}
          {importar}
        </div>
      ) : (
        <>
          <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Cartao k="atrasada" ativo={filtro} titulo="Atrasadas" n={cartoes.atrasada} sub="passaram do KM previsto" quente />
            <Cartao k="breve" ativo={filtro} titulo={`Vencem em até ${fmtKm(MARGEM_AVISO_KM)} km`} n={cartoes.breve} sub="hora de agendar" quente />
            <Cartao k="d30" ativo={filtro} titulo="Chegam em até 30 dias" n={cartoes.d30} sub="pela média de km/dia" />
            <Cartao k="sp" ativo={filtro} titulo="Sem previsão automática" n={cartoes.sp} sub="corretiva recente ou sem histórico" />
          </div>

          <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs text-[#4a6080]">
            <span>{visiveis.length} de {lista.length} carros · ordenado do mais urgente · clique na linha para registrar a revisão</span>
            {filtro && <Link href="/sofia/revisoes" className="text-[#f05a28] hover:underline">Limpar filtro</Link>}
          </div>
          <div className="overflow-x-auto rounded-xl border border-[#1e3a5f]">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#1e3a5f] bg-[#0d2050] text-[#94a3b8]">
                  {['Placa', 'Modelo', 'Equipe'].map((t) => <th key={t} className="px-4 py-3 text-left font-medium">{t}</th>)}
                  {['KM atual', 'Última revisão', 'Próxima (KM)', 'Faltam', 'Média km/dia'].map((t) => (
                    <th key={t} className="whitespace-nowrap px-4 py-3 text-right font-medium">{t}</th>
                  ))}
                  <th className="whitespace-nowrap px-4 py-3 text-left font-medium">Chega em</th>
                  <th className="px-4 py-3 text-left font-medium">Situação</th>
                </tr>
              </thead>
              <tbody>
                {visiveis.map((i) => {
                  const v = i.vigente
                  return (
                    <tr key={i.veiculo.id} className="relative border-b border-[#1e3a5f] transition-colors hover:bg-[#0d2050]">
                      <td className="px-4 py-3 font-mono font-medium text-white">
                        <Link href={`/sofia/revisoes/nova?veiculo=${i.veiculo.id}`} className="after:absolute after:inset-0 after:content-['']">
                          {i.veiculo.placa}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-[#94a3b8]">{i.veiculo.modelo}</td>
                      <td className="px-4 py-3 text-[#94a3b8]">
                        {i.veiculo.status === 'manutencao' ? <span className={`${CHIP} bg-amber-900 text-amber-300`}>na oficina</span> : i.veiculo.equipe ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-[#94a3b8]">{fmtKm(i.veiculo.km_atual)}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-right font-mono text-[#94a3b8]">
                        {v ? (
                          <>
                            {v.km_realizada == null ? '—' : fmtKm(Number(v.km_realizada))}{' '}
                            <span className="text-xs text-[#4a6080]">
                              {v.data_realizada ? diaMes(v.data_realizada) : ''}{v.tipo === 'corretiva' ? ' · corretiva' : ''}
                            </span>
                          </>
                        ) : '—'}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right font-mono text-[#94a3b8]">
                        {i.proxima != null ? (
                          <>{fmtKm(i.proxima)}{i.auto && <span className={`${CHIP} ml-1 bg-blue-900 text-blue-300`}>auto</span>}</>
                        ) : '—'}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right font-mono">
                        {i.s === 'atrasada'
                          ? <b className="text-[#f05a28]">{i.passou != null ? `passou ${fmtKm(i.passou)}` : 'data passou'}</b>
                          : <span className="text-[#94a3b8]">{i.falta != null ? fmtKm(i.falta) : '—'}</span>}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-[#94a3b8]">{i.media != null ? fmtKm(i.media) : '—'}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-[#94a3b8]">
                        {i.quando && i.dias != null
                          ? `~${i.dias} dia${i.dias === 1 ? '' : 's'} (${diaMes(i.quando)})`
                          : i.s === 'atrasada' ? <span className="text-[#f05a28]">já passou</span> : '—'}
                      </td>
                      <td className="px-4 py-3"><SitChip s={i.s} /></td>
                    </tr>
                  )
                })}
                {visiveis.length === 0 && (
                  <tr><td colSpan={10} className="px-4 py-10 text-center text-[#4a6080]">Nenhum carro nesta situação.</td></tr>
                )}
              </tbody>
            </table>
          </div>

          <h2 className="mb-2 mt-8 text-sm font-semibold text-white">O aviso: o que o sistema faz sozinho</h2>
          <div className="rounded-xl border border-[#1e3a5f] bg-[#0d2050] p-4">
            {pendencias.length ? (
              <>
                <p className="mb-2 text-sm font-medium text-white">
                  {pendencias.length} pendência{pendencias.length > 1 ? 's' : ''} de revisão aberta{pendencias.length > 1 ? 's' : ''}
                </p>
                <ul className="divide-y divide-[#1e3a5f]">
                  {pendencias.map((i) => {
                    const t = textoPendencia(i)
                    return (
                      <li key={i.veiculo.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                        <span className="min-w-0">
                          <span className="block text-sm text-white">{t.titulo}</span>
                          <span className="block text-xs text-[#94a3b8]">{t.detalhe}</span>
                        </span>
                        <SitChip s={i.s} />
                      </li>
                    )
                  })}
                </ul>
              </>
            ) : (
              <p className="text-sm text-[#94a3b8]">Nenhum carro perto da revisão.</p>
            )}
            <p className="mt-3 text-xs text-[#4a6080]">
              Uma pendência por carro; some sozinha quando a revisão é registrada. O mesmo carro entra no bloco de revisões do e-mail diário.
              {' '}Hoje: {dataBR(hoje)}.
            </p>
          </div>
        </>
      )}
    </div>
  )
}
