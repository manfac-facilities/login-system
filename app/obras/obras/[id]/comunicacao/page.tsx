import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { hasSystemAccess } from '@/lib/auth/systemAccess'
import { isAdmin } from '@/lib/auth/roles'
import { EstadoVazio } from '../../../_ui/primitivos'
import { hojeISO } from '../../../_lib/tipos'
import { etapasDaObra } from '../../_lib/relatorio-periodo'
import { obraConcluida, relatorioValido, ultimoMesDoMensal } from '../../_pdf/carregar-periodo'
import { lerObraDaRequisicao } from '../_obra-da-requisicao'
import FormImediata from './_imediata-form'
import LinhaDoTempo from './_linha-do-tempo'
import FormRegistro, { botaoSecundario } from './_registro-form'
import { FILTROS, filtroDe, montarLinhaDoTempo } from './_regras'
import type { DestinatarioOpcao, Envio, Registro } from './_tipos'

export const dynamic = 'force-dynamic'

type Linha = Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any

/**
 * Comunicação = histórico (Leva 2 §3.1): linha do tempo única, mais recente
 * primeiro, com filtro por tipo; Novo registro (qualquer acesso obras) e
 * Comunicação imediata (engenheiro/admin). Destinatários moram em /configuracoes.
 */
export default async function ComunicacaoPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ tipo?: string }>
}) {
  const { id } = await params
  const { tipo } = await searchParams
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const email = user?.email?.trim().toLowerCase() ?? ''
  const admin = !!email && (await isAdmin(supabase, email))
  const permitido = !!email && (admin || (await hasSystemAccess(supabase, email, 'obras')))
  if (!permitido) return <EstadoVazio>Esta tela é de quem é responsável pelas obras</EstadoVazio>

  const hoje = hojeISO()
  const lida = await lerObraDaRequisicao(id, hoje)
  if (!lida.ok) return <EstadoVazio>{lida.erro}</EstadoVazio>
  const { obra, plano, impedimentos } = lida.dados
  const engenheiro = obra.engenheiro_email?.trim().toLowerCase() ?? ''
  const podeEnviar = admin || (engenheiro !== '' && engenheiro === email)

  const [envR, regR, destR, relR] = await Promise.all([
    supabase
      .from('obras_envio')
      .select('id, tipo, referencia, lado, enviado_por, enviado_em, destinatarios, resultado, detalhe, registro_id, relatorio_id')
      .eq('obra_id', id)
      .order('enviado_em', { ascending: false })
      .limit(150),
    supabase
      .from('obras_registro')
      .select('*')
      .eq('obra_id', id)
      .order('data', { ascending: false })
      .order('criado_em', { ascending: false })
      .limit(100),
    supabase.from('obras_destinatario').select('email, nome, lado, tipos').eq('obra_id', id).eq('ativo', true).order('email'),
    supabase.from('obras_relatorio').select('id, tipo, referencia').eq('obra_id', id),
  ])
  if (envR.error || regR.error || destR.error) {
    return <EstadoVazio>Não foi possível carregar a comunicação desta obra</EstadoVazio>
  }

  // Relatórios de período: o envio casa pelo relatorio_id; a fase aparece pelo nome atual da etapa (nunca o numero).
  const etapas = etapasDaObra(lida.dados)
  // Só rótulo e link do PDF: falha nesta leitura não derruba a página (o envio aparece sem o link).
  const relatorios = new Map((relR.error ? [] : ((relR.data ?? []) as Linha[])).map((r) => [String(r.id), r]))
  const relatorioDe = (relatorioId: unknown): Envio['relatorio'] => {
    const r = relatorioId ? relatorios.get(String(relatorioId)) : undefined
    if (!r || !relatorioValido(r.tipo, r.referencia)) return null
    const referencia = String(r.referencia)
    const e = r.tipo === 'fase' ? etapas.find((x) => x.referencia === referencia) : undefined
    const rotulo =
      r.tipo === 'mensal'
        ? `mês ${referencia.slice(5, 7)}/${referencia.slice(0, 4)}`
        : r.tipo === 'fase'
          ? e ? `etapa ${e.ordem} — ${e.nome}` : 'etapa fora do cronograma vigente'
          : 'entrega da obra'
    return { tipo: r.tipo, referencia, rotulo }
  }
  const envios: Envio[] = ((envR.data ?? []) as Linha[]).map((e) => ({
    id: String(e.id),
    tipo: e.tipo ?? null,
    referencia: e.referencia ?? null,
    lado: e.lado ?? null,
    enviadoPor: e.enviado_por ?? null,
    enviadoEm: String(e.enviado_em),
    destinatarios: e.destinatarios ?? [],
    resultado: e.resultado ?? null,
    detalhe: e.detalhe ?? null,
    registroId: e.registro_id ?? null,
    relatorio: relatorioDe(e.relatorio_id),
  }))
  const registros: Registro[] = ((regR.data ?? []) as Linha[]).map((r) => ({
    id: String(r.id),
    tipo: r.tipo,
    data: String(r.data),
    participantes: r.participantes ?? null,
    texto: r.texto ?? null,
    ata: r.ata ?? null,
    nivel: r.nivel ?? null,
    impedimentoId: r.impedimento_id ?? null,
    atividadeNumero: r.atividade_numero ?? null,
    criadoPor: r.criado_por ?? null,
    criadoEm: String(r.criado_em),
    editadoEm: r.editado_em ?? null,
  }))
  const destinatarios: DestinatarioOpcao[] = ((destR.data ?? []) as Linha[]).map((d) => ({
    email: String(d.email),
    nome: d.nome ?? null,
    lado: d.lado === 'interno' ? 'interno' : 'cliente',
    tipos: d.tipos ?? [],
  }))

  // Botões só dos relatórios disponíveis: mensal do mês da data-base ao mês do término; fase com etapa concluída
  // (a mais recente; a tela lista as outras); entrega com a obra concluída.
  const mesAtual = hoje.slice(0, 7)
  const dataBase = (obra.data_base as string | null | undefined) ?? null
  const ultimoMes = ultimoMesDoMensal(lida.dados)
  const mensalDisponivel = !!dataBase && dataBase.slice(0, 7) <= mesAtual && (!ultimoMes || mesAtual <= ultimoMes)
  const ultimaFase = etapas
    .filter((e) => e.concluida && e.fimReal)
    .sort((a, b) => b.fimReal!.localeCompare(a.fimReal!) || b.ordem - a.ordem)[0]

  const filtro = filtroDe(tipo)
  const itens = montarLinhaDoTempo({ envios, registros, filtro, email, admin })
  const base = `/obras/obras/${id}/comunicacao`
  const chip = (ativo: boolean) =>
    `flex min-h-11 items-center rounded-full border px-3 text-sm ${
      ativo ? 'border-[#b94606] bg-[#b94606] font-semibold text-white' : 'border-[#dadad8] text-[#333336]'
    }`

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_24rem]">
      <section className="flex min-w-0 flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-bold text-[#00345e]">Comunicação</h2>
          <nav aria-label="Relatórios" className="flex flex-wrap gap-2">
            <Link href={`${base}/semanal`} className={botaoSecundario}>
              Semanal
            </Link>
            {mensalDisponivel ? (
              <Link href={`${base}/relatorio/mensal/${mesAtual}`} className={botaoSecundario}>
                Mensal
              </Link>
            ) : null}
            {ultimaFase ? (
              <Link href={`${base}/relatorio/fase/${ultimaFase.referencia}`} className={botaoSecundario}>
                Fase
              </Link>
            ) : null}
            {obraConcluida(lida.dados) ? (
              <Link href={`${base}/relatorio/entrega/entrega`} className={botaoSecundario}>
                Entrega
              </Link>
            ) : null}
          </nav>
        </div>
        <nav aria-label="Filtrar por tipo" className="flex flex-wrap gap-2">
          {FILTROS.map((f) => (
            <Link
              key={f.valor}
              href={f.valor === 'todos' ? base : `${base}?tipo=${f.valor}`}
              aria-current={filtro === f.valor ? 'page' : undefined}
              className={chip(filtro === f.valor)}
            >
              {f.rotulo}
            </Link>
          ))}
        </nav>
        {itens.length === 0 ? (
          <EstadoVazio>Nada registrado ainda</EstadoVazio>
        ) : (
          <LinhaDoTempo itens={itens} obraId={id} hoje={hoje} podeEnviar={podeEnviar} destinatarios={destinatarios} />
        )}
      </section>
      <aside className="flex flex-col gap-4">
        <section className="flex flex-col gap-3 rounded-xl border border-[#dadad8] bg-[#ffffff] p-3">
          <h3 className="text-sm font-semibold text-[#00345e]">Novo registro</h3>
          <FormRegistro obraId={id} hoje={hoje} />
        </section>
        {podeEnviar ? (
          <section className="flex flex-col gap-3 rounded-xl border border-[#dadad8] bg-[#ffffff] p-3">
            <h3 className="text-sm font-semibold text-[#00345e]">Comunicação imediata</h3>
            <FormImediata
              obraId={id}
              destinatarios={destinatarios.filter((d) => d.tipos.includes('imediato'))}
              impedimentos={impedimentos.filter((i) => !i.encerradoEm).map((i) => ({ id: i.id, descricao: i.descricao }))}
              atividades={plano.map((a) => ({ numero: a.numero, descricao: a.descricao }))}
            />
          </section>
        ) : null}
      </aside>
    </div>
  )
}
