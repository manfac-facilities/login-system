import Link from 'next/link'
import type { ItemAgenda, SituacaoAgenda, TipoAgenda } from '../../_lib/agenda'
import { hrefDoItem } from '../../_lib/alertas'

/** Aba Agenda (Leva 4 §2.2): itens por mês, filtro por tipo, situação em chip colorido COM texto. */

export const SITUACAO: Record<SituacaoAgenda, { rotulo: string; classe: string }> = {
  no_prazo: { rotulo: 'Enviado no prazo', classe: 'border-[#a8d5b5] bg-[#e8f6ec] text-[#14532d]' },
  com_atraso: { rotulo: 'Enviado com atraso', classe: 'border-[#efd77a] bg-[#fdf6d8] text-[#6b4e00]' },
  atrasado: { rotulo: 'ATRASADO', classe: 'border-[#f0c2c2] bg-[#fdeeee] text-[#8a1c1c]' },
  enviar_hoje: { rotulo: 'ENVIAR HOJE', classe: 'border-[#b94606] bg-[#fff1e8] text-[#8a3300]' },
  programado: { rotulo: 'Programado', classe: 'border-[#dadad8] bg-[#f4f4f2] text-[#333336]' },
}

export const TIPOS_AGENDA: { valor: 'todos' | TipoAgenda; rotulo: string }[] = [
  { valor: 'todos', rotulo: 'Todos' },
  { valor: 'diario', rotulo: 'Diários' },
  { valor: 'semanal', rotulo: 'Semanais' },
  { valor: 'mensal', rotulo: 'Mensais' },
  { valor: 'fase', rotulo: 'Fases' },
  { valor: 'entrega', rotulo: 'Entrega' },
]
export const tipoAgendaDe = (v: unknown): 'todos' | TipoAgenda =>
  TIPOS_AGENDA.some((t) => t.valor === v) ? (v as 'todos' | TipoAgenda) : 'todos'

const dmy = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']
const mesTxt = (anoMes: string) => `${MESES[Number(anoMes.slice(5, 7)) - 1]} de ${anoMes.slice(0, 4)}`

/** Nome do item: fase pelo nome atual da etapa (o numero nunca aparece). */
export function nomeDoItem(i: ItemAgenda, fases: ReadonlyMap<string, string>): string {
  switch (i.tipo) {
    case 'diario': return `Diário de ${dmy(i.referencia)}`
    case 'semanal': return `Semanal da semana de ${dmy(i.referencia)}`
    case 'mensal': return `Mensal de ${mesTxt(i.referencia)}`
    case 'fase': return `Relatório de fase — ${fases.get(i.referencia) ?? 'etapa fora do cronograma vigente'}`
    default: return 'Relatório de entrega'
  }
}

/** Agrupa por mês da data prevista, mantendo a ordem. */
export function porMes(itens: ItemAgenda[]): { mes: string; itens: ItemAgenda[] }[] {
  const out: { mes: string; itens: ItemAgenda[] }[] = []
  for (const i of itens) {
    const mes = i.dataPrevista.slice(0, 7)
    const g = out.find((x) => x.mes === mes)
    if (g) g.itens.push(i)
    else out.push({ mes, itens: [i] })
  }
  return out
}

export default function Agenda({
  obraId,
  agenda,
  tipo,
  fases,
  hrefTipo,
}: {
  obraId: string
  agenda: ItemAgenda[] | null
  tipo: 'todos' | TipoAgenda
  /** referencia da fase -> nome atual da etapa. */
  fases: ReadonlyMap<string, string>
  hrefTipo: (t: 'todos' | TipoAgenda) => string
}) {
  const chip = (ativo: boolean) =>
    `flex min-h-11 items-center rounded-full border px-3 text-sm ${
      ativo ? 'border-[#b94606] bg-[#b94606] font-semibold text-white' : 'border-[#dadad8] text-[#333336]'
    }`
  if (!agenda) {
    return <p className="rounded-xl border border-dashed border-[#dadad8] p-6 text-center text-[15px] text-[#555558]">Não foi possível carregar a agenda agora. Recarregue em instantes.</p>
  }
  const itens = agenda.filter((i) => tipo === 'todos' || i.tipo === tipo)
  return (
    <div className="flex flex-col gap-3">
      <nav aria-label="Filtrar agenda por tipo" className="flex flex-wrap gap-2">
        {TIPOS_AGENDA.map((t) => (
          <Link key={t.valor} href={hrefTipo(t.valor)} aria-current={tipo === t.valor ? 'page' : undefined} className={chip(tipo === t.valor)}>
            {t.rotulo}
          </Link>
        ))}
      </nav>
      {itens.length === 0 ? (
        <p className="rounded-xl border border-dashed border-[#dadad8] p-6 text-center text-[15px] text-[#555558]">
          Nada na agenda{agenda.length === 0 ? ' — salve a base do cronograma para calcular as datas' : ' neste filtro'}
        </p>
      ) : (
        porMes(itens).map((g) => (
          <section key={g.mes} aria-label={mesTxt(g.mes)} className="flex flex-col gap-2">
            <h3 className="text-sm font-semibold capitalize text-[#00345e]">{mesTxt(g.mes)}</h3>
            <ul className="flex flex-col gap-2">
              {g.itens.map((i) => {
                const s = SITUACAO[i.situacao]
                return (
                  <li key={`${i.tipo}|${i.referencia}`} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#dadad8] bg-[#ffffff] px-3 py-2">
                    <div className="min-w-0">
                      <p className="text-[15px] font-medium text-[#1a1a1c]">{nomeDoItem(i, fases)}</p>
                      <p className="text-[13px] text-[#555558]">
                        Previsto {dmy(i.dataPrevista)}
                        {i.dataReal ? ` · enviado ${dmy(i.dataReal)}` : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`rounded-full border px-2.5 py-1 text-[12px] font-semibold ${s.classe}`}>{s.rotulo}</span>
                      <Link
                        href={hrefDoItem(obraId, i)}
                        className="inline-flex min-h-11 items-center text-[14px] font-medium text-[#00345e] underline underline-offset-2"
                      >
                        {i.dataReal ? 'Abrir' : 'Abrir rascunho'}
                      </Link>
                    </div>
                  </li>
                )
              })}
            </ul>
          </section>
        ))
      )}
    </div>
  )
}
