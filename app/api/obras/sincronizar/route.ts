import { createHash, timingSafeEqual } from 'node:crypto'
import { after, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  executarExecucaoPreparada,
  prepararExecucao,
  type TipoDeSincronizacao,
} from '@/app/obras/sincronizar/_execucao'

export const runtime = 'nodejs'
export const maxDuration = 300

function resumo(valor: string): Buffer {
  return createHash('sha256').update(valor, 'utf8').digest()
}

export function autorizacaoDoCronValida(cabecalho: string | null, segredo: string): boolean {
  const prefixo = 'Bearer '
  const recebido = cabecalho?.startsWith(prefixo) ? cabecalho.slice(prefixo.length) : ''
  // Hashes têm sempre o mesmo tamanho; assim até segredo ou cabeçalho vazios
  // passam pela comparação constante sem o atalho de comparar comprimentos.
  return timingSafeEqual(resumo(recebido), resumo(segredo)) && recebido.length > 0
}

export async function POST(request: Request) {
  const segredo = process.env.OBRAS_CRON_SECRET ?? ''
  if (!segredo.trim()) {
    return NextResponse.json({ error: 'OBRAS_CRON_SECRET não configurado' }, { status: 503 })
  }
  if (!autorizacaoDoCronValida(request.headers.get('authorization'), segredo)) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  let tipo: TipoDeSincronizacao
  try {
    const corpo = (await request.json()) as { tipo?: unknown }
    if (corpo.tipo !== 'completa' && corpo.tipo !== 'incremental') throw new Error()
    tipo = corpo.tipo
  } catch {
    return NextResponse.json(
      { error: 'Corpo inválido; tipo deve ser completa ou incremental' },
      { status: 400 },
    )
  }

  try {
    // A service role é restrita a esta rota sem sessão. O segredo autentica o
    // chamador; a linha de execução registra origem agendada e autoria nula.
    const admin = createAdminClient()
    const preparacao = await prepararExecucao(admin, {
      tipo,
      origem: 'agendada',
      criadoPor: null,
    })
    if (preparacao.jaEstavaRodando) {
      return NextResponse.json({ status: 'ja_estava_rodando' }, { status: 409 })
    }

    // pg_net tem timeout curto. A resposta apenas confirma que a execução foi
    // aceita; sucesso ou falha são os valores persistidos na tabela, depois.
    after(async () => {
      await executarExecucaoPreparada(admin, preparacao.execucao)
    })
    return NextResponse.json(
      { status: 'rodando', execucaoId: preparacao.execucao.id },
      { status: 202 },
    )
  } catch (erro) {
    return NextResponse.json(
      { error: erro instanceof Error ? erro.message : 'Não foi possível iniciar a sincronização' },
      { status: 500 },
    )
  }
}
