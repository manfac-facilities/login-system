/**
 * Ficha da obra — `/obras/obra/[id]`.
 *
 * A Ficha **é** a Triagem quando a etapa é `definir`: mesma rota, mesmo link,
 * modo diferente (`renderFicha` → `renderTriagem`, mockup:3399). Não existe
 * `/obras/triagem`, e é de propósito — quem abre a obra pela base cai no que
 * ela precisa agora.
 *
 * Server Component fino: busca, deriva e entrega. As escritas desta tela
 * (liberar a obra, trocar de etapa e, desde a ficha editável, os três blocos)
 * vivem em `_actions.ts`.
 */

import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { hasSystemAccess } from '@/lib/auth/systemAccess'
import { EstadoVazio } from '../../_ui/primitivos'
import {
  dataSP,
  derivar,
  hojeISO,
  type DiarioRow,
  type ObraRow,
  type PessoaRow,
  type TarefaRow,
} from '../../_lib/tipos'
import Ficha, { type EdicoesPorBloco, type RemarcacaoNaFicha } from './_ficha'
import Triagem from './_triagem'
import type { LinhaHistorico } from '../../_lib/historico'

export const dynamic = 'force-dynamic'

/**
 * Listas de apoio da triagem — e, desde a ficha editável, também dos blocos
 * Autorização, Identificação e Cronograma. Por isso elas são montadas ANTES do
 * desvio da triagem: os dois modos da tela precisam das mesmas listas.
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

/** Os blocos que têm rodapé de autoria na ficha. */
const BLOCOS_COM_RODAPE = ['Autorização', 'Identificação', 'Cronograma'] as const

/**
 * A ÚLTIMA alteração de cada bloco (spec §5.2), para o rodapé "Editado por X em
 * DD/MM". A consulta já vem do mais novo para o mais velho, então a primeira
 * linha de cada bloco é a que vale.
 *
 * Recebe `LinhaHistorico[]` inteiro (o mesmo array que alimenta o bloco
 * Histórico de alterações, item 1 da revisão de 20/09) — só usa três dos
 * campos, mas é o mesmo dado, buscado uma vez só.
 */
function ultimasEdicoes(linhas: LinhaHistorico[]): EdicoesPorBloco {
  const edicoes: EdicoesPorBloco = {}
  for (const l of linhas) {
    const bloco = BLOCOS_COM_RODAPE.find((b) => b === l.bloco)
    if (!bloco || edicoes[bloco]) continue
    edicoes[bloco] = { quem: l.quem ?? '—', quando: dataSP(l.created_at) ?? '' }
  }
  return edicoes
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

  const [
    { data: linha },
    { data: diario },
    { data: remarcacoes },
    { data: tarefas },
    { data: pessoas },
    { data: outras },
    { data: motivos },
    { data: historico },
  ] = await Promise.all([
    supabase.from('obras_obra').select('*').eq('id', id).maybeSingle(),
    supabase.from('obras_diario').select('*').eq('obra_id', id).order('data', { ascending: true }),
    supabase.from('obras_remarcacao').select('*').eq('obra_id', id).order('data', { ascending: true }),
    supabase.from('obras_tarefa').select('*').eq('obra_id', id),
    supabase.from('obras_pessoa').select('*'),
    supabase.from('obras_obra').select('equipe, analista_cliente'),
    // A lista padronizada de motivos de remarcação. A ORDEM É DO SERVIDOR
    // (`ordem, nome`): a janela de remarcação renderiza na ordem em que recebe,
    // e "Outro" tem ordem 900 justamente para ficar no fim.
    supabase
      .from('obras_motivo_remarcacao')
      .select('nome')
      .eq('ativo', true)
      .order('ordem', { ascending: true })
      .order('nome', { ascending: true }),
    // Colunas completas: item 1 da revisão de 20/09 liga o bloco Histórico de
    // alterações, que precisa de `campo`/`de`/`para`/`motivo` além do trio
    // (`bloco`, `quem`, `created_at`) que já servia só ao rodapé.
    supabase
      .from('obras_historico')
      .select('id, obra_id, bloco, campo, de, para, motivo, quem, created_at')
      .eq('obra_id', id)
      .order('created_at', { ascending: false }),
  ])

  if (!linha) notFound()

  const obra = derivar(linha as ObraRow, hojeISO())
  const linhasDiario = (diario ?? []) as DiarioRow[]
  const listaPessoas = (pessoas ?? []) as PessoaRow[]

  const equipesDaBase = (outras ?? []).map((o) => (o as { equipe: string | null }).equipe)
  const analistasDaBase = (outras ?? []).map(
    (o) => (o as { analista_cliente: string | null }).analista_cliente
  )

  const responsaveis = unir(
    RESPONSAVEIS_PISO,
    listaPessoas.filter((p) => p.area === 'Obras').map((p) => p.chave)
  )
  const equipes = unir(EQUIPES_PISO, equipesDaBase)
  const analistasCliente = unir(ANALISTAS_PISO, analistasDaBase)

  const voltar = (
    <Link href="/obras/base" className="text-sm text-[#94a3b8] hover:text-[#f05a28]">
      ← Voltar para a base de obras
    </Link>
  )

  /* ---------- modo Triagem ---------- */
  if (obra.etapa === 'definir') {
    return (
      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-6 sm:px-6">
        {voltar}
        <Triagem
          obra={obra}
          responsaveis={responsaveis}
          equipes={equipes}
          analistasCliente={analistasCliente}
          hoje={hojeISO()}
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
        remarcacoes={(remarcacoes ?? []) as RemarcacaoNaFicha[]}
        tarefas={(tarefas ?? []) as TarefaRow[]}
        pessoas={mapaPessoas}
        fotos={fotos}
        responsaveis={responsaveis}
        equipes={equipes}
        analistasCliente={analistasCliente}
        motivos={((motivos ?? []) as { nome: string }[]).map((m) => m.nome)}
        hoje={hojeISO()}
        edicoes={ultimasEdicoes((historico ?? []) as LinhaHistorico[])}
        historico={(historico ?? []) as LinhaHistorico[]}
      />
    </div>
  )
}
