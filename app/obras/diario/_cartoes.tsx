'use client'

/**
 * A fila do dia, na forma CARTÕES — uma obra por vez: responde, salva, ela sai
 * da fila. Dá para parar no meio.
 *
 * A forma "lista única" (planilha) do mockup NÃO entra na v0 (spec §1) — por
 * isso não há seletor de forma aqui. Quando ela entrar, entra ao lado, sem
 * mexer neste componente.
 *
 * Ordenação fixa, sem seletor: decrescente pelo mesmo número que o cartão
 * mostra (`diasAlerta`, desde a âncora — review I3: antes ordenava por `dias`
 * enquanto o cartão já exibia `diasAlerta`, e a fila aparecia fora de ordem
 * do que a tela mostrava). Era `dias` no mockup (`:2971`), de quando `dias` e
 * o número do cartão ainda eram a mesma coisa. A razão continua a mesma: a
 * obra parada há mais tempo é a que precisa da resposta antes de a bateria do
 * celular acabar no meio da fila.
 */

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { br, hojeISO, NAO_FALTOU, pedeFoto, type Obra } from '../_lib/tipos'
import { agendamentoVoltou, ddmm, nomeDeQuemAgendou, textoAgendadas } from '../_lib/agendamento'
import { EstadoVazio } from '../_ui/primitivos'
import Cartao, { type Pessoa } from './_cartao'
import { desfazerDiarioAction, encerrarAgendamentoAction, obterUrlFotoAction } from './_actions'

export type RespostaDeHoje = {
  obra_id: string
  andou: boolean
  motivo: string | null
  item: string
  obs: string | null
  foto_path: string | null
  /** Rótulo de quem respondeu; null = resposta antiga, sem e-mail gravado. */
  autoria?: Autoria | null
}

/** "Respondido por {por} [em nome de {emNomeDe}] às {hora}". */
export type Autoria = { por: string; emNomeDe: string | null; hora: string }

export type TarefaDeHoje = {
  id: string
  item: string
  prazo: string | null
  dono: string
  area: string | null
}

export default function Cartoes({
  obras,
  agendadas,
  pessoasPorEmail,
  respostas,
  tarefas,
  pessoas,
  hoje,
  admin,
  responsaveis,
  analistaSelecionado,
  minhaChave,
}: {
  obras: Obra[]
  agendadas: Obra[]
  pessoasPorEmail: { email: string; nome: string }[]
  respostas: Record<string, RespostaDeHoje>
  tarefas: Record<string, TarefaDeHoje[]>
  pessoas: Record<string, Pessoa>
  hoje: string
  admin: boolean
  responsaveis: string[]
  analistaSelecionado: string
  /** Chave da pessoa logada (`resolverChave`); '' quando não há. */
  minhaChave: string
}) {
  const router = useRouter()
  const [aviso, setAviso] = useState<string | null>(null)
  const [agendadasAbertas, setAgendadasAbertas] = useState(false)
  // Mesma regra de `podeMexerNoAgendamento` (_actions.ts): pcm da obra ou
  // admin. Quem não pode não vê o botão — botão que só devolve erro não fica.
  const podeAgendar = (o: Obra) => admin || (!!minhaChave && minhaChave === o.pcm)

  // Quem voltou de agendamento vai primeiro; depois a ordem de sempre.
  const pendentes = obras
    .filter((o) => !respostas[o.id])
    .sort(
      (a, b) =>
        Number(agendamentoVoltou(b, hoje)) - Number(agendamentoVoltou(a, hoje)) ||
        (b.diasAlerta ?? 0) - (a.diasAlerta ?? 0)
    )
  const feitas = obras.filter((o) => respostas[o.id])
  const blocoAgendadas = agendadasAbertas ? (
    <Agendadas
      obras={agendadas}
      pessoasPorEmail={pessoasPorEmail}
      podeTrazer={podeAgendar}
      aoVoltar={(o) => {
        setAviso(`${o.loja ?? 'Obra sem loja'} voltou para o diário.`)
        router.refresh()
      }}
    />
  ) : null
  const alternarAgendadas = () => setAgendadasAbertas((a) => !a)

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
      <div className="mb-4">
        <h1 className="text-xl font-semibold text-[#e8eef7]">Diário do dia</h1>
        <p className="mt-1 text-sm text-[#94a3b8]">
          Uma obra por vez: responde, salva, ela sai da fila. Dá para parar no meio — hoje é{' '}
          {br(hoje)}.
        </p>
      </div>

      <SeletorAnalista responsaveis={responsaveis} selecionado={analistaSelecionado} admin={admin} />

      {aviso ? (
        <p role="status" className="mb-3 rounded-md border border-[#35c98a] bg-[#35c98a14] px-3 py-2 text-sm text-[#35c98a]">
          {aviso}
        </p>
      ) : null}

      {obras.length === 0 && agendadas.length === 0 ? (
        <EstadoVazio>Nenhuma obra em campo para responder hoje.</EstadoVazio>
      ) : obras.length === 0 ? (
        <>
          <div className="rounded-lg border border-[#1e3a5f] bg-[#0d2050] px-4 py-5 text-center">
            <h2 className="text-base font-semibold text-[#e8eef7]">Nenhuma obra para responder hoje</h2>
            <p className="mt-1 text-sm text-[#94a3b8]">
              Todas as obras deste diário estão agendadas. Elas voltam sozinhas nas datas marcadas.
            </p>
            <BotaoAgendadas n={agendadas.length} aberto={agendadasAbertas} onClick={alternarAgendadas} />
          </div>
          {blocoAgendadas}
        </>
      ) : (
        <>
          <Barra
            pendentes={pendentes.length}
            feitas={feitas.length}
            total={obras.length}
            agendadas={agendadas.length}
            agendadasAbertas={agendadasAbertas}
            onAgendadas={alternarAgendadas}
          />
          {blocoAgendadas}

          {pendentes.length === 0 ? (
            <Sucesso obras={feitas} respostas={respostas} agendadas={agendadas.length} />
          ) : (
            <div className="mt-4 flex flex-col gap-4">
              {pendentes.map((o) => (
                <Cartao
                  key={o.id}
                  obra={o}
                  hoje={hoje}
                  pessoas={pessoas}
                  mostrarResponsavel={!analistaSelecionado}
                  admin={admin}
                  podeAgendar={podeAgendar(o)}
                  pessoasPorEmail={pessoasPorEmail}
                  aoSalvar={() => router.refresh()}
                  aoAgendar={(ate) => {
                    setAviso(`Obra agendada. Sai do diário até ${ddmm(ate)} e volta sozinha nesse dia.`)
                    router.refresh()
                  }}
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
 * Seletor "Diário de quem", para todos (spec 27/10/2026). "Todos os
 * responsáveis" vai como `?analista=todos` — sem parâmetro, o servidor aplica
 * o padrão da pessoa (o pcm abre nas suas), e aí o pcm não conseguiria ver todas.
 */
function SeletorAnalista({
  responsaveis,
  selecionado,
  admin,
}: {
  responsaveis: string[]
  selecionado: string
  admin: boolean
}) {
  const router = useRouter()
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2 rounded-lg border border-[#1e3a5f] bg-[#0d2050] px-3 py-2.5">
      <label htmlFor="analista" className="text-[12px] text-[#94a3b8]">
        Diário de quem
      </label>
      <select
        id="analista"
        value={selecionado || 'todos'}
        onChange={(e) => router.push(`/obras/diario?analista=${encodeURIComponent(e.target.value)}`)}
        className="min-h-11 rounded-md border border-[#1e3a5f] bg-[#0f1f3d] px-3 py-2 text-sm text-[#e8eef7] focus:border-[#f05a28] focus:outline-none"
      >
        <option value="todos">Todos os responsáveis</option>
        {responsaveis.map((r) => (
          <option key={r} value={r}>
            {r}
          </option>
        ))}
      </select>
      <span className="text-[11px] text-[#64748b]">
        {admin
          ? 'Você é administrador do hub: vê tudo e pode trazer de volta qualquer agendada.'
          : 'Você vê as obras de todos os responsáveis e pode responder no lugar deles. Fica registrado quem respondeu.'}
      </span>
    </div>
  )
}

/** `barraHTML(mockup:2824)`. */
function BotaoAgendadas({ n, aberto, onClick }: { n: number; aberto: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={aberto}
      className="min-h-9 rounded-md px-2 py-1 text-sm text-[#94a3b8] underline-offset-4 hover:text-[#e8eef7] hover:underline"
    >
      {`· ${textoAgendadas(n)} ${aberto ? '▴' : '▾'}`}
    </button>
  )
}

/** Bloco "Agendadas — fora do diário até a data" (spec §4.3). */
function Agendadas({
  obras,
  pessoasPorEmail,
  podeTrazer,
  aoVoltar,
}: {
  obras: Obra[]
  pessoasPorEmail: { email: string; nome: string }[]
  podeTrazer: (o: Obra) => boolean
  aoVoltar: (o: Obra) => void
}) {
  const [pendente, iniciar] = useTransition()
  const [erro, setErro] = useState<string | null>(null)

  function trazer(o: Obra) {
    setErro(null)
    iniciar(async () => {
      const r = await encerrarAgendamentoAction(o.id, 'volta')
      if (r.error) {
        setErro(r.error)
        return
      }
      aoVoltar(o)
    })
  }

  return (
    <section className="mt-3 rounded-lg border border-[#1e3a5f] bg-[#0d2050] px-4 py-3">
      <h2 className="text-sm font-semibold text-[#e8eef7]">
        Agendadas — fora do diário até a data{' '}
        <span className="text-[12px] font-normal text-[#94a3b8]">voltam sozinhas no dia</span>
      </h2>
      {obras.length === 0 ? (
        <p className="mt-2 text-sm text-[#94a3b8]">
          Nenhuma obra agendada. Quando alguém tirar uma obra do diário por causa de um levantamento, ela aparece
          aqui.
        </p>
      ) : (
        <ul className="mt-2 flex flex-col gap-2">
          {obras.map((o) => (
            <li key={o.id} className="flex flex-wrap items-start gap-x-3 gap-y-1 border-t border-[#1e3a5f] pt-2 first:border-t-0 first:pt-0">
              <div className="min-w-0 flex-1 text-[12px] text-[#94a3b8]">
                <div>
                  <b className="text-sm text-[#e8eef7]">{o.loja ?? 'Obra sem loja'}</b> · OS {o.os ?? '—'} ·{' '}
                  <span>{`volta em ${ddmm(o.diario_agendado_ate!)}`}</span>
                </div>
                <div className="text-[#e8eef7]">{o.diario_agendado_oque}</div>
                <div>
                  {`Motivo: ${o.diario_agendado_motivo} · agendou ${nomeDeQuemAgendou(
                    o.diario_agendado_por ?? '',
                    pessoasPorEmail
                  )} em ${o.diario_agendado_em ? ddmm(hojeISO(new Date(o.diario_agendado_em))) : '—'}`}
                </div>
              </div>
              {podeTrazer(o) ? (
                <button
                  type="button"
                  disabled={pendente}
                  onClick={() => trazer(o)}
                  className="min-h-9 rounded-md border border-[#1e3a5f] px-2.5 py-1.5 text-[12px] text-[#e8eef7] hover:border-[#f05a28] disabled:opacity-45"
                >
                  Trazer de volta agora
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
      {erro ? <p className="mt-2 text-[12px] text-[#ff4d6d]">{erro}</p> : null}
    </section>
  )
}

function Barra({
  pendentes,
  feitas,
  total,
  agendadas,
  agendadasAbertas,
  onAgendadas,
}: {
  pendentes: number
  feitas: number
  total: number
  agendadas: number
  agendadasAbertas: boolean
  onAgendadas: () => void
}) {
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
      <BotaoAgendadas n={agendadas} aberto={agendadasAbertas} onClick={onAgendadas} />
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
  agendadas,
}: {
  obras: Obra[]
  respostas: Record<string, RespostaDeHoje>
  agendadas: number
}) {
  const total = obras.length
  const andaram = obras.filter((o) => respostas[o.id]?.andou).length
  const paradas = obras.filter((o) => o.nao_andou_seguidos >= 3).length
  return (
    <div className="mt-4 rounded-lg border border-[#35c98a] bg-[#35c98a14] px-4 py-5 text-center">
      <div className="text-2xl text-[#35c98a]">✓</div>
      <h2 className="mt-1 text-base font-semibold text-[#e8eef7]">Diário de hoje fechado</h2>
      <p className="mt-1 text-sm text-[#94a3b8]">
        As {total} obras foram respondidas.
        {agendadas > 0
          ? ` ${textoAgendadas(agendadas)} ${agendadas === 1 ? 'não conta' : 'não contam'} até a data de volta.`
          : ''}{' '}
        A base de obras já está atualizada e quem precisa cobrar alguma coisa hoje sabe o que é.
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
      {resposta.autoria ? (
        <p className="mt-1 text-[12px] text-[#94a3b8]">
          Respondido por <b className="text-[#e8eef7]">{resposta.autoria.por}</b>
          {resposta.autoria.emNomeDe ? (
            <>
              {' '}
              em nome de <b className="text-[#f05a28]">{resposta.autoria.emNomeDe}</b>
            </>
          ) : null}{' '}
          às {resposta.autoria.hora}
        </p>
      ) : null}
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
  const [url, setUrl] = useState<string | null>(null)

  // Por que dois passos, e não um `window.open` depois do await: Safari e
  // Firefox soltam a associação com o gesto do usuário quando a chamada
  // atravessa um await, e o bloqueador de popup mata a janela — sem erro
  // nenhum na tela, o botão simplesmente não faz nada. Buscar a URL e depois
  // oferecer um link de verdade é o que funciona em todo navegador. E o link
  // é assinado e curto, então não vira endereço permanente de foto de obra.
  if (url) {
    return (
      <p className="mt-1 text-[12px]">
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[#f05a28] underline underline-offset-2"
        >
          abrir a foto do dia ↗
        </a>
      </p>
    )
  }

  return (
    <p className="mt-1 text-[12px]">
      <button
        type="button"
        disabled={pendente}
        onClick={() =>
          iniciar(async () => {
            const r = await obterUrlFotoAction(path)
            if (r.url) setUrl(r.url)
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
