/**
 * Ficha da obra — `/obras/obra/[id]`.
 *
 * A Ficha **é** a Triagem quando a etapa é `definir`: mesma rota, mesmo link,
 * modo diferente (`renderFicha` → `renderTriagem`, mockup:3399). Não existe
 * `/obras/triagem`, e é de propósito — quem abre a obra pela base cai no que
 * ela precisa agora.
 *
 * Server Component fino: busca, deriva e entrega. As duas escritas desta tela
 * (liberar a obra e trocar de etapa) vivem em `_actions.ts`.
 */

import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { hasSystemAccess } from '@/lib/auth/systemAccess'
import { EstadoVazio } from '../../_ui/primitivos'
import {
  derivar,
  hojeISO,
  type DiarioRow,
  type ObraRow,
  type PessoaRow,
  type RemarcacaoRow,
  type TarefaRow,
} from '../../_lib/tipos'
import Ficha from './_ficha'
import Triagem from './_triagem'

export const dynamic = 'force-dynamic'

/**
 * Listas de apoio da triagem.
 *
 * DECISÃO DESTA FRENTE: o mockup traz `RESPONSAVEIS_OBRA`, `EQUIPES` e
 * `ANALISTAS_CLIENTE` cravados no JS (:1960-1965). Em produção eles vêm do
 * banco — `obras_pessoa` para os responsáveis, os valores que já existem na
 * base para equipes e analistas do cliente. As constantes do mockup ficam como
 * **piso**, unidas ao que o banco tem: antes da importação a base está vazia, e
 * um `select` vazio impediria liberar qualquer obra no treinamento de terça.
 */
const RESPONSAVEIS_PISO = ['YURI', 'AMANDA', 'LUANA']
const ANALISTAS_PISO = ['AMANDA', 'LEANDRO', 'JUAN']
const EQUIPES_PISO = [
  'MANFAC-4',
  'MANFAC-6',
  'MANFAC-7',
  'MANFAC-19',
  'MANFAC-26',
  'MANFAC-27',
  'ALEX',
  'ALEXANDRE',
  'ERLI / RICARDO',
  'Prestador a contratar',
]

function unir(piso: string[], doBanco: (string | null)[]): string[] {
  const set = new Set(piso)
  doBanco.forEach((v) => {
    const t = (v ?? '').trim()
    if (t && t !== 'DEFINIR') set.add(t)
  })
  return [...set].sort((a, b) => a.localeCompare(b, 'pt-BR'))
}

export default async function FichaDaObraPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user?.email || !(await hasSystemAccess(supabase, user.email, 'obras'))) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        <EstadoVazio>Esta tela é de quem é responsável pelas obras</EstadoVazio>
      </div>
    )
  }

  const [{ data: linha }, { data: diario }, { data: remarcacoes }, { data: tarefas }, { data: pessoas }] =
    await Promise.all([
      supabase.from('obras_obra').select('*').eq('id', id).maybeSingle(),
      supabase.from('obras_diario').select('*').eq('obra_id', id).order('data', { ascending: true }),
      supabase.from('obras_remarcacao').select('*').eq('obra_id', id).order('data', { ascending: true }),
      supabase.from('obras_tarefa').select('*').eq('obra_id', id),
      supabase.from('obras_pessoa').select('*'),
    ])

  if (!linha) notFound()

  const obra = derivar(linha as ObraRow, hojeISO())
  const linhasDiario = (diario ?? []) as DiarioRow[]
  const listaPessoas = (pessoas ?? []) as PessoaRow[]

  const voltar = (
    <Link href="/obras/base" className="text-sm text-[#94a3b8] hover:text-[#f05a28]">
      ← Voltar para a base de obras
    </Link>
  )

  /* ---------- modo Triagem ---------- */
  if (obra.etapa === 'definir') {
    const { data: outras } = await supabase.from('obras_obra').select('equipe, analista_cliente')
    const equipesDaBase = (outras ?? []).map((o) => (o as { equipe: string | null }).equipe)
    const analistasDaBase = (outras ?? []).map(
      (o) => (o as { analista_cliente: string | null }).analista_cliente
    )

    return (
      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-6 sm:px-6">
        {voltar}
        <Triagem
          obra={obra}
          responsaveis={unir(
            RESPONSAVEIS_PISO,
            listaPessoas.filter((p) => p.area === 'Obras').map((p) => p.chave)
          )}
          equipes={unir(EQUIPES_PISO, equipesDaBase)}
          analistasCliente={unir(ANALISTAS_PISO, analistasDaBase)}
        />
      </div>
    )
  }

  /* ---------- fotos: bucket privado, signed URL curta ---------- */
  const caminhos = linhasDiario
    .slice(-8)
    .map((d) => d.foto_path)
    .filter((p): p is string => !!p)

  const fotos: Record<string, string> = {}
  if (caminhos.length > 0) {
    const { data: assinadas } = await supabase.storage
      .from('obras-fotos')
      .createSignedUrls(caminhos, 60)
    ;(assinadas ?? []).forEach((a) => {
      if (a.path && a.signedUrl) fotos[a.path] = a.signedUrl
    })
  }

  const mapaPessoas: Record<string, PessoaRow> = {}
  listaPessoas.forEach((p) => {
    mapaPessoas[p.chave] = p
  })

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-6 sm:px-6">
      {voltar}
      <Ficha
        obra={obra}
        diario={linhasDiario}
        remarcacoes={(remarcacoes ?? []) as RemarcacaoRow[]}
        tarefas={(tarefas ?? []) as TarefaRow[]}
        pessoas={mapaPessoas}
        fotos={fotos}
      />
    </div>
  )
}
