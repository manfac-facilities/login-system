'use client'

/**
 * A fila do dia, na forma CARTÕES — uma obra por vez: responde, salva, ela sai
 * da fila. Dá para parar no meio.
 *
 * A forma "lista única" (planilha) do mockup NÃO entra na v0 (spec §1) — por
 * isso não há seletor de forma aqui. Quando ela entrar, entra ao lado, sem
 * mexer neste componente.
 *
 * Ordenação fixa, sem seletor: `dias` decrescente. É a do mockup (`:2971`), e
 * a razão é que a obra parada há mais tempo é a que precisa da resposta antes
 * de a bateria do celular acabar no meio da fila.
 */

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { br, NAO_FALTOU, pedeFoto, type Obra } from '../_lib/tipos'
import { EstadoVazio } from '../_ui/primitivos'
import Cartao, { type Pessoa } from './_cartao'
import { desfazerDiarioAction, obterUrlFotoAction } from './_actions'

export type RespostaDeHoje = {
  obra_id: string
  andou: boolean
  motivo: string | null
  item: string
  obs: string | null
  foto_path: string | null
}

export type TarefaDeHoje = {
  id: string
  item: string
  prazo: string | null
  dono: string
  area: string | null
}

export default function Cartoes({
  obras,
  respostas,
  tarefas,
  pessoas,
  hoje,
  admin,
  responsaveis,
  analistaSelecionado,
}: {
  obras: Obra[]
  respostas: Record<string, RespostaDeHoje>
  tarefas: Record<string, TarefaDeHoje[]>
  pessoas: Record<string, Pessoa>
  hoje: string
  admin: boolean
  responsaveis: string[]
  analistaSelecionado: string
}) {
  const router = useRouter()

  const pendentes = obras
    .filter((o) => !respostas[o.id])
    .sort((a, b) => (b.dias ?? 0) - (a.dias ?? 0))
  const feitas = obras.filter((o) => respostas[o.id])

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
      <div className="mb-4">
        <h1 className="text-xl font-semibold text-[#e8eef7]">Diário do dia</h1>
        <p className="mt-1 text-sm text-[#94a3b8]">
          Uma obra por vez: responde, salva, ela sai da fila. Dá para parar no meio — hoje é{' '}
          {br(hoje)}.
        </p>
      </div>

      {admin ? (
        <SeletorAnalista responsaveis={responsaveis} selecionado={analistaSelecionado} />
      ) : null}

      {obras.length === 0 ? (
        <EstadoVazio>Nenhuma obra em campo para responder hoje.</EstadoVazio>
      ) : (
        <>
          <Barra pendentes={pendentes.length} feitas={feitas.length} total={obras.length} />

          {pendentes.length === 0 ? (
            <Sucesso obras={feitas} respostas={respostas} />
          ) : (
            <div className="mt-4 flex flex-col gap-4">
              {pendentes.map((o) => (
                <Cartao
                  key={o.id}
                  obra={o}
                  hoje={hoje}
                  pessoas={pessoas}
                  mostrarResponsavel={admin && !analistaSelecionado}
                  aoSalvar={() => router.refresh()}
                />
              ))}
            </div>
          )}

          <Feitas obras={feitas} respostas={respostas} tarefas={tarefas} />
        </>
      )}
    </div>
  )
}

/**
 * Decisão técnica 7 da spec: o diário é de cada analista, e o administrador vê
 * todas com um seletor. Sem isso, terça treinaria só o Yuri.
 */
function SeletorAnalista({
  responsaveis,
  selecionado,
}: {
  responsaveis: string[]
  selecionado: string
}) {
  const router = useRouter()
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2 rounded-lg border border-[#1e3a5f] bg-[#0d2050] px-3 py-2.5">
      <label htmlFor="analista" className="text-[12px] text-[#94a3b8]">
        Diário de quem
      </label>
      <select
        id="analista"
        value={selecionado}
        onChange={(e) => {
          const v = e.target.value
          router.push(v ? `/obras/diario?analista=${encodeURIComponent(v)}` : '/obras/diario')
        }}
        className="min-h-11 rounded-md border border-[#1e3a5f] bg-[#0f1f3d] px-3 py-2 text-sm text-[#e8eef7] focus:border-[#f05a28] focus:outline-none"
      >
        <option value="">Todos os responsáveis</option>
        {responsaveis.map((r) => (
          <option key={r} value={r}>
            {r}
          </option>
        ))}
      </select>
      <span className="text-[11px] text-[#64748b]">
        Você é administrador do hub — cada analista vê só as obras dele.
      </span>
    </div>
  )
}

/** `barraHTML(mockup:2824)`. */
function Barra({ pendentes, feitas, total }: { pendentes: number; feitas: number; total: number }) {
  const pct = total ? Math.round((feitas / total) * 100) : 0
  const zerado = pendentes === 0
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border border-[#1e3a5f] bg-[#0d2050] px-4 py-3">
      <span
        className="text-2xl font-semibold leading-none"
        style={{ color: zerado ? '#35c98a' : '#e8eef7' }}
      >
        {pendentes}
      </span>
      <span className="text-sm text-[#94a3b8]">
        {pendentes === 1 ? 'obra para responder hoje' : 'obras para responder hoje'}
      </span>
      <span className="h-1.5 min-w-24 flex-1 overflow-hidden rounded-full bg-[#0a1628]">
        <i
          className="block h-full rounded-full"
          style={{ width: `${pct}%`, backgroundColor: zerado ? '#35c98a' : '#f05a28' }}
        />
      </span>
      <span className="text-sm text-[#94a3b8]">
        {feitas} de {total} respondidas
      </span>
    </div>
  )
}

/** `sucessoHTML(mockup:2851)`. O placar é o que fecha o dia. */
function Sucesso({
  obras,
  respostas,
}: {
  obras: Obra[]
  respostas: Record<string, RespostaDeHoje>
}) {
  const total = obras.length
  const andaram = obras.filter((o) => respostas[o.id]?.andou).length
  const paradas = obras.filter((o) => o.nao_andou_seguidos >= 3).length
  return (
    <div className="mt-4 rounded-lg border border-[#35c98a] bg-[#35c98a14] px-4 py-5 text-center">
      <div className="text-2xl text-[#35c98a]">✓</div>
      <h2 className="mt-1 text-base font-semibold text-[#e8eef7]">Diário de hoje fechado</h2>
      <p className="mt-1 text-sm text-[#94a3b8]">
        As {total} obras foram respondidas. A base de obras já está atualizada e quem precisa cobrar
        alguma coisa hoje sabe o que é.
      </p>
      <div className="mt-3 flex flex-wrap justify-center gap-x-5 gap-y-1 text-sm text-[#94a3b8]">
        <span>
          <b className="text-[#e8eef7]">{andaram}</b> andaram
        </span>
        <span>
          <b className="text-[#e8eef7]">{total - andaram}</b> não andaram
        </span>
        <span>
          <b className="text-[#e8eef7]">{paradas}</b> paradas há 3 dias ou mais
        </span>
      </div>
    </div>
  )
}

/**
 * `feitasHTML(mockup:2837)`. Errar a última obra não pode deixar ninguém sem
 * como desfazer — por isso a lista continua embaixo mesmo com a fila zerada.
 */
function Feitas({
  obras,
  respostas,
  tarefas,
}: {
  obras: Obra[]
  respostas: Record<string, RespostaDeHoje>
  tarefas: Record<string, TarefaDeHoje[]>
}) {
  if (!obras.length) return null
  return (
    <section className="mt-6">
      <h2 className="text-sm font-semibold text-[#e8eef7]">Já respondidas</h2>
      <div className="mt-2 flex flex-col gap-2">
        {obras.map((o) => (
          <Feita key={o.id} obra={o} resposta={respostas[o.id]} tarefas={tarefas[o.id] ?? []} />
        ))}
      </div>
    </section>
  )
}

function Feita({
  obra,
  resposta,
  tarefas,
}: {
  obra: Obra
  resposta: RespostaDeHoje
  tarefas: TarefaDeHoje[]
}) {
  const router = useRouter()
  const [pendente, iniciar] = useTransition()
  const [erro, setErro] = useState<string | null>(null)

  let resumo = resposta.andou ? 'Andou hoje' : `Não andou hoje · ${resposta.motivo ?? ''}`
  if (resposta.item && resposta.item !== NAO_FALTOU) resumo += ` · faltou ${resposta.item.toLowerCase()}`
  if (pedeFoto(obra) && !resposta.foto_path) resumo += ' · sem foto'

  function desfazer() {
    setErro(null)
    iniciar(async () => {
      const r = await desfazerDiarioAction(obra.id)
      if (r.error) {
        setErro(r.error)
        return
      }
      router.refresh()
    })
  }

  return (
    <div className="rounded-lg border border-[#1e3a5f] bg-[#0d2050] px-3 py-2.5">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="text-[#35c98a]">✓</span>
        <Link
          href={`/obras/obra/${obra.id}`}
          className="text-sm font-medium text-[#e8eef7] underline-offset-4 hover:text-[#f05a28] hover:underline"
        >
          {obra.loja ?? 'Obra sem loja'}
        </Link>
        <span className="text-[12px] text-[#94a3b8]">{resumo}</span>
        <button
          type="button"
          onClick={desfazer}
          disabled={pendente}
          className="ml-auto min-h-9 rounded-md border border-[#1e3a5f] px-2.5 py-1.5 text-[12px] text-[#94a3b8] hover:border-[#f05a28] hover:text-[#e8eef7] disabled:opacity-45"
        >
          {pendente ? 'desfazendo…' : 'Desfazer'}
        </button>
      </div>
      {resposta.obs ? <p className="mt-1 text-[12px] text-[#64748b]">{resposta.obs}</p> : null}
      {resposta.foto_path ? <VerFoto path={resposta.foto_path} /> : null}
      {tarefas.map((t) => (
        <p key={t.id} className="mt-1 text-[12px] text-[#35c98a]">
          ✓ Tarefa aberta para{' '}
          <b>
            {t.area ? `${t.area} · ` : ''}
            {t.dono}
          </b>{' '}
          {t.item === 'Foto' ? '(a foto do dia não veio) ' : ''}— prazo até o fim do dia{' '}
          {t.prazo ? br(t.prazo).slice(0, 5) : 'de hoje'}.
        </p>
      ))}
      {erro ? <p className="mt-1 text-[12px] text-[#ff4d6d]">{erro}</p> : null}
    </div>
  )
}

/**
 * O bucket é privado: a foto só aparece por URL assinada e curta, gerada na
 * server action. Nada de link permanente de foto de obra circulando por aí.
 */
function VerFoto({ path }: { path: string }) {
  const [pendente, iniciar] = useTransition()
  const [erro, setErro] = useState<string | null>(null)
  return (
    <p className="mt-1 text-[12px]">
      <button
        type="button"
        disabled={pendente}
        onClick={() =>
          iniciar(async () => {
            const r = await obterUrlFotoAction(path)
            if (r.url) window.open(r.url, '_blank', 'noopener,noreferrer')
            else setErro(r.error ?? 'Não deu para abrir a foto')
          })
        }
        className="text-[#94a3b8] underline underline-offset-2 hover:text-[#e8eef7] disabled:opacity-45"
      >
        {pendente ? 'abrindo a foto…' : 'ver a foto do dia'}
      </button>
      {erro ? <span className="ml-2 text-[#ff4d6d]">{erro}</span> : null}
    </p>
  )
}
