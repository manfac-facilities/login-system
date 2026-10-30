/**
 * Lista de impedimentos: abertos primeiro ("aguardando cliente há N dias
 * úteis"), encerrados depois. Server component (sem estado).
 */
import { diasUteisEntre } from '../../_lib/calendario'
import type { ImpedimentoRow } from '../../_lib/leitura'
import BotaoEncerrar from './_encerrar'
import { rotuloResponsavel } from './_tipos'

const dataBR = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`

export function textoTempo(i: ImpedimentoRow, hoje: string, feriados: ReadonlySet<string>): string {
  const fim = i.encerradoEm ?? hoje
  const n = diasUteisEntre(i.abertoEm, fim, feriados)
  const dias = `${n} ${n === 1 ? 'dia útil' : 'dias úteis'}`
  if (i.encerradoEm) return `${dataBR(i.abertoEm)} a ${dataBR(i.encerradoEm)} · ${dias}`
  const quem = i.responsavel === 'cliente' ? 'aguardando cliente' : `aberto (${rotuloResponsavel(i.responsavel).toLowerCase()})`
  return `${quem} desde ${dataBR(i.abertoEm)} · há ${dias}`
}

export default function ListaImpedimentos({
  itens,
  hoje,
  feriados,
  somenteAbertos = false,
}: {
  itens: ImpedimentoRow[]
  hoje: string
  feriados: ReadonlySet<string>
  somenteAbertos?: boolean
}) {
  const abertos = itens.filter((i) => i.categoria === 'impedimento' && !i.encerradoEm)
  const encerrados = somenteAbertos ? [] : itens.filter((i) => i.categoria === 'impedimento' && i.encerradoEm)
  const ordem = [...abertos, ...encerrados]
  if (!ordem.length) return <p className="text-sm text-[#5a7380]">Nenhum impedimento.</p>
  return (
    <ul className="flex flex-col gap-2">
      {ordem.map((i) => (
        <li key={i.id} className={`rounded-xl border border-[#dadad8] bg-[#f6f6f5] p-3 ${i.encerradoEm ? 'opacity-70' : ''}`}>
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-[#333336]">
                {i.tipo ?? 'Impedimento'} · {rotuloResponsavel(i.responsavel)}
                {i.travaAtividade ? ' · trava a atividade' : ''}
              </p>
              <p className="text-xs text-[#5a7380]">
                {textoTempo(i, hoje, feriados)}
                {i.atividadeNumero ? ` · atividade ${i.atividadeNumero}` : ''}
                {i.exibirAoCliente ? '' : ' · interno'}
              </p>
              <p className="mt-1 text-sm text-[#333336]">{i.descricao}</p>
            </div>
            {!i.encerradoEm ? <BotaoEncerrar id={i.id} hoje={hoje} /> : null}
          </div>
        </li>
      ))}
    </ul>
  )
}
