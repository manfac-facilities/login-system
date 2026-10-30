import Link from 'next/link'
import type { SupabaseClient } from '@supabase/supabase-js'
import { EstadoVazio } from '../../../_ui/primitivos'
import { CAUSA } from '../../_lib/causas'
import { avaliarItem, dataEnvioSemanal, lookahead, ppc, segundaDaSemana } from '../../_lib/last-planner'
import type { ObraGrande } from '../../_lib/leitura'
import { feriadosDaObra, lerPlano, lerPlanos, lerRestricoes } from '../../_lib/leitura'
import { codigosDeAtividades } from '../../_lib/cronograma'
import { FormAvaliarPlano, FormFecharPlano, type CausaOpcao } from './_plano-form'
import { segundaValida, semanaAlvo, somarDias } from './_plano-tipos'

const dm = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`
const pct = (v: number) => `${Math.round(v * 100)}%`
const CAUSAS: CausaOpcao[] = Object.entries(CAUSA).map(([valor, c]) => ({ valor, rotulo: c.rotulo }))

/** Aba "Plano da semana": monta, mostra o plano fechado e avalia. */
export default async function PlanoDaSemana({
  supabase,
  obraId,
  dados,
  hoje,
  semanaParam,
  podeEditar,
  base,
}: {
  supabase: SupabaseClient
  obraId: string
  dados: ObraGrande
  hoje: string
  semanaParam: string | undefined
  podeEditar: boolean
  base: string
}) {
  const { calc, feriados } = dados
  if (!calc) return <EstadoVazio>A obra ainda não tem cronograma.</EstadoVazio>
  const todos = await lerPlanos(supabase, obraId)
  if (!todos.ok) return <EstadoVazio>{todos.erro}</EstadoVazio>

  const atual = segundaDaSemana(hoje)
  const existentes = new Set(todos.planos.map((p) => p.semanaInicio))
  const pedida = segundaValida(semanaParam)
  const semana = pedida ?? semanaAlvo(hoje, existentes)

  const nav = (
    <nav aria-label="Escolher a semana do plano" className="flex flex-wrap items-center gap-2 text-sm">
      {[
        { rotulo: 'Semana anterior', s: somarDias(semana, -7) },
        { rotulo: 'Semana atual', s: atual },
        { rotulo: 'Próxima semana', s: somarDias(atual, 7) },
      ].map((x) => (
        <Link
          key={x.rotulo}
          href={`${base}?aba=plano&semana=${x.s}`}
          className="flex min-h-11 items-center rounded-full border border-[#dadad8] px-3 text-[#333336]"
        >
          {x.rotulo}
        </Link>
      ))}
    </nav>
  )

  const pl = await lerPlano(supabase, obraId, semana)
  if (!pl.ok) return <EstadoVazio>{pl.erro}</EstadoVazio>
  const titulo = (
    <h3 className="text-sm font-semibold text-[#00345e]">
      Semana de {dm(semana)} a {dm(somarDias(semana, 4))}
    </h3>
  )

  const codigos = codigosDeAtividades(calc.atividades, feriados)
  const rotulo = (n: number) => {
    const a = calc.atividades.find((x) => x.numero === n)
    return `${codigos.get(n) ?? ''} ${a?.descricao ?? 'Atividade removida do cronograma'}`.trim()
  }

  // ---- Plano ainda não existe ------------------------------------------
  if (!pl.plano) {
    if (semana < atual) {
      return (
        <div className="flex flex-col gap-3">
          {nav}
          {titulo}
          <EstadoVazio>Não houve plano fechado nesta semana.</EstadoVazio>
        </div>
      )
    }
    if (!podeEditar) {
      return (
        <div className="flex flex-col gap-3">
          {nav}
          {titulo}
          <EstadoVazio>O plano desta semana ainda não foi fechado pelo engenheiro da obra.</EstadoVazio>
        </div>
      )
    }
    const rr = await lerRestricoes(supabase, obraId)
    if (!rr.ok) return <EstadoVazio>{rr.erro}</EstadoVazio>
    const janela = lookahead(calc.atividades, rr.restricoes, hoje, 6, codigos)
    const candidatos = (janela.find((s) => s.segunda === semana)?.itens ?? []).map((it) => ({
      numero: it.numero,
      rotulo: `${it.codigo} ${it.nome}`.trim(),
      periodo: `${dm(it.inicio)} a ${dm(it.termino)}`,
      pronta: it.pronta,
      restricoes: it.restricoesAbertas.map((x) => x.descricao),
    }))
    return (
      <div className="flex flex-col gap-3">
        {nav}
        {titulo}
        <FormFecharPlano key={semana} obraId={obraId} semana={semana} candidatos={candidatos} />
      </div>
    )
  }

  // ---- Plano fechado ------------------------------------------------------
  const plano = pl.plano
  const fer = await feriadosDaObra(supabase, obraId)
  const envio = dataEnvioSemanal(semana, fer.ok ? fer.feriados : feriados)
  const liberada = hoje >= envio
  const execPor = new Map(dados.exec.map((e) => [e.numero, e.status === 'concluido' ? 1 : e.percentual]))
  const pendentes = plano.itens.filter((i) => i.cumprido === null)
  const avaliados = plano.itens.filter((i) => i.cumprido !== null)
  const resultado = ppc(plano.itens)

  return (
    <div className="flex flex-col gap-3">
      {nav}
      {titulo}
      <p className="text-sm text-[#5a7380]">
        Plano fechado{plano.fechadoEm ? ` em ${plano.fechadoEm.slice(8, 10)}/${plano.fechadoEm.slice(5, 7)}` : ''} · PPC da semana:{' '}
        <strong className="text-[#00345e]">{resultado === null ? '—' : pct(resultado)}</strong>
      </p>

      {avaliados.length ? (
        <ul className="flex flex-col gap-2" aria-label="Itens avaliados">
          {avaliados.map((i) => (
            <li key={i.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-[#dadad8] bg-white p-3 text-sm text-[#333336]">
              <span className="min-w-0 flex-1">
                <span className="block font-semibold text-[#00345e]">{rotulo(i.numero)}</span>
                <span className="block text-xs text-[#5a7380]">
                  Meta {pct(i.metaPercentual)} · realizado {pct(i.percentualFinal ?? 0)}
                  {i.cumprido === false && i.causa ? ` · causa: ${CAUSA[i.causa].rotulo}` : ''}
                </span>
              </span>
              <span
                className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${
                  i.cumprido ? 'border-[#136c38] text-[#136c38]' : 'border-[#b23232] text-[#b23232]'
                }`}
              >
                {i.cumprido ? 'Cumprido' : 'Não cumprido'}
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      {pendentes.length === 0 ? null : liberada && podeEditar ? (
        <FormAvaliarPlano
          key={`${semana}-${pendentes.length}`}
          obraId={obraId}
          semana={semana}
          causas={CAUSAS}
          itens={pendentes.map((i) => {
            const realizado = execPor.get(i.numero) ?? 0
            return {
              numero: i.numero,
              rotulo: rotulo(i.numero),
              meta: i.metaPercentual,
              realizado,
              cumprido: avaliarItem(i.metaPercentual, realizado),
            }
          })}
        />
      ) : (
        <>
          <ul className="flex flex-col gap-2" aria-label="Itens do plano">
            {pendentes.map((i) => (
              <li key={i.id} className="rounded-xl border border-[#dadad8] bg-white p-3 text-sm text-[#333336]">
                <span className="block font-semibold text-[#00345e]">{rotulo(i.numero)}</span>
                <span className="block text-xs text-[#5a7380]">Meta {pct(i.metaPercentual)}</span>
              </li>
            ))}
          </ul>
          <p className="text-xs text-[#5a7380]">
            {liberada
              ? 'A avaliação é feita pelo engenheiro da obra.'
              : `A avaliação abre em ${dm(envio)} (data de envio do semanal).`}
          </p>
        </>
      )}
    </div>
  )
}
