'use server'

/**
 * Server Actions da Ficha da obra.
 *
 * Receita fixa do hub (spec §3), na ordem: `createClient()` → `auth.getUser()`
 * → `hasSystemAccess(..., 'obras')` → query → `revalidatePath` → retorno
 * `{error?}` / `{success?}`. **Nunca `throw`** — erro vira mensagem em
 * português, não stack trace na cara do usuário.
 *
 * Decisão 8 da spec: `null` é o único sentinela de vazio. String vazia nunca é
 * gravada — `""` e `null` convivendo é bug garantido.
 */

import { revalidatePath } from 'next/cache'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { hasSystemAccess } from '@/lib/auth/systemAccess'
import {
  CICLO,
  PRIORIDADES,
  hojeISO,
  posCampo,
  type Etapa,
  type ObraRow,
  type Prioridade,
} from '../../_lib/tipos'
import {
  gravarComHistorico,
  linhasDeAlteracao,
  type CampoHistorico,
  type LinhaHistoricoNova,
} from '../../_lib/historico'
import {
  ehMotivoOutro,
  normalizarMotivo,
  numeroBR,
  precisaRemarcar,
  primeiroErro,
  validarAutorizacao,
  validarCronograma,
  validarDataFechamentoOS,
  validarIdentificacao,
  type DadosAutorizacao,
  type DadosCronograma,
  type DadosIdentificacao,
} from '../../_lib/ficha-campos'

export type EstadoAcao = { error?: string; success?: boolean }

const SEM_ACESSO = 'Sem acesso ao Controle de Obras'
const NAO_AUTENTICADO = 'Não autenticado'
const OBRA_NAO_ENCONTRADA = 'Obra não encontrada'
const CORRIDA_TRIAGEM = 'Esta obra já foi liberada por outra pessoa. Recarregue a página.'

const ETAPAS_VALIDAS = CICLO.map((c) => c.k)

/** Vazio é `null`, sempre. Nunca `""`. */
function nulo(v: string | null | undefined): string | null {
  const t = (v ?? '').trim()
  return t === '' ? null : t
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Cliente = SupabaseClient<any, any, any>

/**
 * A receita fixa do hub, num lugar só (spec §4): client do USUÁRIO →
 * `auth.getUser()` → `hasSystemAccess(..., 'obras')`.
 *
 * A comparação é `!== true`, não `!`, e isso não é preciosismo. A armadilha
 * registrada no AGENTS.md é a guarda que falha ABERTA quando a função de
 * autorização devolve algo que não é booleano. Em PL/pgSQL isso acontece com
 * NULL (`if not f()` não dispara); em JavaScript `!x` fecha com `null` e
 * `undefined`, **mas abre para qualquer truthy que não seja `true`** — uma
 * refatoração que fizesse `hasSystemAccess` devolver `{ has_access: false }`
 * passaria direto por `!x`. `!== true` nega tudo que não é exatamente a
 * permissão. A tela não é fronteira — esta função é.
 */
async function abrirSessao(): Promise<{ supabase?: Cliente; email?: string; error?: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user?.email) return { error: NAO_AUTENTICADO }
  if ((await hasSystemAccess(supabase, user.email, 'obras')) !== true) return { error: SEM_ACESSO }

  return { supabase, email: user.email }
}

/** A obra como está gravada AGORA — o `antes` de todo diff desta ficha. */
async function lerObra(
  supabase: Cliente,
  obraId: string
): Promise<{ obra?: ObraRow; error?: string }> {
  const { data, error } = await supabase.from('obras_obra').select('*').eq('id', obraId).maybeSingle()
  if (error) return { error: 'Erro ao carregar a obra' }
  if (!data) return { error: OBRA_NAO_ENCONTRADA }
  return { obra: data as ObraRow }
}

type ValorCampo = string | number | boolean | null
type Rascunho = Partial<Record<CampoHistorico, ValorCampo>>

/**
 * Um `CampoHistorico` → as COLUNAS de `obras_obra` que ele move.
 *
 * Um para um em todos, menos `os_aprovada_em`: ele é **um campo de tela para
 * três colunas** (R7), e as três nunca podem divergir. Por isso a tradução mora
 * aqui, e não espalhada por cada action — uma action que esquecesse
 * `marco_os_aprov` deixaria o marco mentindo para sempre, sem erro nenhum.
 */
function colunasDoCampo(campo: CampoHistorico, valor: ValorCampo): Record<string, unknown> {
  if (campo === 'os_aprovada_em') {
    const data = (valor as string | null) ?? null
    return { aprovacao: data, os_aprovada: data !== null, marco_os_aprov: data }
  }
  return { [campo]: valor }
}

/**
 * `campos` é montado A PARTIR das linhas de histórico, nunca do formulário
 * inteiro. É o que satisfaz a trava de `gravarComHistorico`, que recusa uma
 * coluna rastreada presente em `campos` sem a linha correspondente — e o que
 * garante que gravação e histórico não têm como divergir: são a mesma lista.
 */
function camposDasLinhas(linhas: LinhaHistoricoNova[], depois: Rascunho): Record<string, unknown> {
  const campos: Record<string, unknown> = {}
  for (const linha of linhas) {
    Object.assign(campos, colunasDoCampo(linha.campo, depois[linha.campo] ?? null))
  }
  return campos
}

/** Sempre a ficha e a base; o diário só quando a fila de alguém muda (§4). */
function revalidar(obraId: string, linhas: LinhaHistoricoNova[]) {
  revalidatePath(`/obras/obra/${obraId}`)
  revalidatePath('/obras/base')
  const mexeuNaFila = linhas.some(
    (l) => l.campo === 'pcm' || l.campo === 'equipe' || l.campo === 'etapa' || l.campo === 'inicio_plan'
  )
  if (mexeuNaFila) revalidatePath('/obras/diario')
}

/**
 * O trio da aprovação da OS, como ele é lido da obra: uma data ou `null`.
 * `aprovacao` é a coluna que manda — `os_aprovada` e `marco_os_aprov` são
 * satélites dela (R7).
 */
function aprovacaoAtual(obra: ObraRow): string | null {
  return obra.aprovacao ?? null
}

/** O `antes`/`depois` do bloco Autorização, compartilhado com a Triagem (§4.4). */
function rascunhoAutorizacao(
  obra: ObraRow,
  dados: DadosAutorizacao,
  hoje: string
): { antes: Rascunho; depois: Rascunho } {
  const libPor = nulo(dados.libPor)
  const libEmDigitado = nulo(dados.libEm)
  // R8: a data só existe junto do nome; data sem nome é barrada na validação.
  // Nome sem data assume hoje — MAS só quando não havia liberação registrada
  // antes (a primeira liberação, igual `liberarObraAction`). Item 3 da
  // revisão de 20/09: se JÁ havia `liberado_em` e a pessoa limpou o campo
  // mantendo o nome, é uma edição que apaga a data de propósito — antes isto
  // gravava hoje por cima, perdendo o que ela quis apagar (e reiniciando o
  // contador de "esperando a OS há N dias", sem como desfazer pela tela).
  // Limpar precisa gravar `null`, não hoje.
  //
  // Correção bloqueante de 21/09: a condição de "primeira liberação" olhava
  // `obra.liberado_em`, não `obra.liberado_por`. Depois que alguém limpa a
  // data (liberado_em fica null, liberado_por continua com o nome), o
  // PRÓXIMO salvamento do bloco — mesmo um que só preencha `aprovadaEm` —
  // reavaliava `obra.liberado_em` (null) como "nunca houve liberação" e
  // voltava a gravar hoje por cima, desfazendo a limpeza que a pessoa tinha
  // acabado de fazer. Quem decide se é a primeira liberação é `liberado_por`
  // (havia alguém nomeado antes?), não `liberado_em` (que o item 3 passou a
  // permitir ficar vazio de propósito).
  const liberadoEm = libPor ? (libEmDigitado ?? (obra.liberado_por ? null : hoje)) : null
  return {
    antes: {
      origem: obra.origem,
      liberado_por: obra.liberado_por,
      liberado_em: obra.liberado_em,
      os_aprovada_em: aprovacaoAtual(obra),
    },
    depois: {
      origem: nulo(dados.origem),
      liberado_por: libPor,
      liberado_em: liberadoEm,
      os_aprovada_em: nulo(dados.aprovadaEm),
    },
  }
}

function rascunhoIdentificacao(
  obra: ObraRow,
  dados: DadosIdentificacao
): { antes: Rascunho; depois: Rascunho } {
  return {
    antes: { tipo: obra.tipo, valor: obra.valor, analista_cliente: obra.analista_cliente, mau_uso: obra.mau_uso },
    depois: {
      tipo: nulo(dados.tipo),
      valor: numeroBR(dados.valor) ?? null,
      analista_cliente: nulo(dados.analista),
      mau_uso: dados.mauUso === true,
    },
  }
}

/** Grava pelo mecanismo do histórico e traduz a falha da RPC para a mensagem do bloco. */
async function gravarBloco(
  supabase: Cliente,
  obraId: string,
  campos: Record<string, unknown>,
  linhas: LinhaHistoricoNova[],
  mensagemDeErro: string
): Promise<EstadoAcao> {
  const { error } = await gravarComHistorico(supabase, { obraId, campos, linhas })
  if (error) return { error: mensagemDeErro }
  revalidar(obraId, linhas)
  return { success: true }
}

/**
 * As colunas que registram QUEM mudou a etapa e QUANDO ainda não existem em
 * `sdd-sql-obras-v0.sql` (arquivo da frente A, que esta frente não pode
 * editar). O update tenta gravá-las; se o PostgREST responder que a coluna não
 * existe, refaz sem elas — a troca de etapa continua funcionando e passa a
 * registrar autoria sozinha no dia em que a migration ganhar:
 *
 *   alter table public.obras_obra
 *     add column if not exists etapa_por text,
 *     add column if not exists etapa_em timestamptz;
 */
function colunaInexistente(erro: { code?: string; message?: string } | null): boolean {
  if (!erro) return false
  if (erro.code === 'PGRST204') return true
  return /column .* does not exist|Could not find the '.*' column/i.test(erro.message ?? '')
}

/**
 * Posição de cada etapa em `CICLO` — a ordem que decide "anterior"/"depois"
 * para os marcos da esteira, abaixo.
 */
const ORDEM_ETAPA: Record<Etapa, number> = CICLO.reduce(
  (acc, c, i) => {
    acc[c.k] = i
    return acc
  },
  {} as Record<Etapa, number>
)

/**
 * Passo da ESTEIRA → coluna de marco, na ordem do ciclo. `aprovarOS` fica
 * FORA de propósito: `marco_os_aprov` é satélite do trio da aprovação
 * (`colunasDoCampo`, R7) e é gravado só por `salvarAutorizacaoAction` /
 * `salvarDadosTriagemAction` — decisão do João de 21/09
 * (`docs/cliente/2026-09-21-decisoes-marcos-da-esteira.md`, item 3): esta
 * troca de etapa nunca carimba nem apaga `marco_os_aprov`.
 */
const PASSOS_MARCO: { etapa: Etapa; campo: CampoHistorico }[] = [
  { etapa: 'relatorio', campo: 'marco_relatorio' },
  { etapa: 'fecharOS', campo: 'marco_fechou_os' },
  { etapa: 'pendFat', campo: 'marco_liberou_fat' },
  { etapa: 'faturado', campo: 'marco_faturou' },
]

/**
 * Os marcos da esteira que `mudarEtapaAction` precisa acertar ao trocar de
 * etapa — decisões do João de 21/09 (`docs/cliente/
 * 2026-09-21-decisoes-marcos-da-esteira.md`), calculadas pelo ESTADO FINAL
 * (a posição da NOVA etapa), não pela direção da troca (revisão
 * independente de 21/09).
 *
 * Por quê: a primeira versão comparava índice antigo × novo e só AGIA numa
 * das duas direções — um avanço só carimbava marco `null`, nunca apagava um
 * marco de passo futuro que tivesse sobrado de um estado inconsistente; e
 * "trocar" para a mesma etapa nem entrava no `if`/`else if`, então nunca
 * reconciliava nada. Isso importa porque a chamada que grava os marcos roda
 * numa escrita SEPARADA do update da etapa (ver comentário em
 * `mudarEtapaAction`): se ela falhar depois de uma VOLTA, a obra fica com a
 * etapa nova mas os marcos ainda no estado antigo — inconsistente — e só
 * uma reconciliação por estado final (em vez de "para onde a etapa foi")
 * corrige isso na PRÓXIMA troca, mesmo que a próxima troca seja para a
 * mesma etapa.
 *
 * Regra, para a nova etapa de índice N (posição em `CICLO`):
 *   - cada marco de `PASSOS_MARCO` (exceto `marco_faturou`) com passo de
 *     índice < N → recebe hoje SE estiver `null` (marco com data existente
 *     nunca é sobrescrito); com índice >= N → vira `null` (apagado, com
 *     histórico — `linhasDeAlteracao`, chamada por quem usa este retorno,
 *     transforma isso em linha, o valor antigo nunca se perde).
 *   - `marco_faturou`: recebe hoje se `null` quando a NOVA etapa é
 *     `faturado` (etapa terminal — a esteira só marca como feita com data,
 *     mesmo não havendo passo seguinte que a torne "anterior"); em
 *     qualquer outra etapa nova, vira `null`.
 *   - `marco_exec_fim`: recebe hoje se `null` quando N é pós-campo; vira
 *     `null` quando não é.
 *   - `marco_os_aprov` nunca entra aqui — fora de `PASSOS_MARCO` de
 *     propósito (satélite do trio de aprovação, decisão 3).
 *
 * "Trocar" para a etapa em que a obra já está passa pela MESMA conta: se o
 * estado já é coerente, `depois` sai igual a `antes` e `linhasDeAlteracao`
 * não gera linha (nada é gravado); se não é, esta chamada reconcilia.
 */
function calcularMarcosDaEsteira(
  obra: ObraRow,
  novaEtapa: Etapa,
  hoje: string,
  /** Ajuste 2 de 23/09: a data em que a OS foi fechada no sistema do
   * cliente. Presente, substitui `hoje` só no carimbo de `marco_fechou_os`. */
  dataFechamentoOS?: string
): { antes: Rascunho; depois: Rascunho } {
  const antes: Rascunho = {
    marco_exec_fim: obra.marco_exec_fim,
    marco_relatorio: obra.marco_relatorio,
    marco_fechou_os: obra.marco_fechou_os,
    marco_liberou_fat: obra.marco_liberou_fat,
    marco_faturou: obra.marco_faturou,
  }
  const depois: Rascunho = { ...antes }

  const indiceNovo = ORDEM_ETAPA[novaEtapa]

  for (const { etapa, campo } of PASSOS_MARCO) {
    if (campo === 'marco_faturou') continue // regra própria, abaixo — etapa terminal
    const carimbo = campo === 'marco_fechou_os' ? (dataFechamentoOS ?? hoje) : hoje
    depois[campo] = ORDEM_ETAPA[etapa] < indiceNovo ? (antes[campo] ?? carimbo) : null
  }

  depois.marco_faturou = novaEtapa === 'faturado' ? (antes.marco_faturou ?? hoje) : null

  depois.marco_exec_fim = posCampo({ etapa: novaEtapa }) ? (antes.marco_exec_fim ?? hoje) : null

  return { antes, depois }
}

/**
 * TROCA DE ETAPA MANUAL — decisão técnica 6 da spec.
 *
 * O mockup não tem gatilho para `levantamento → andamento` nem para
 * `andamento ↔ paralisado`: sem esta ação o quadro trava no primeiro dia de uso
 * real. **Sem trava por papel** (decisão técnica 1): qualquer usuário com
 * acesso muda a etapa. Travar exige a resposta do cliente (decisão G, aberta);
 * não travar só permite, e é reversível.
 */
export async function mudarEtapaAction(
  obraId: string,
  etapa: string,
  dataFechamentoOS?: string
): Promise<EstadoAcao> {
  const sessao = await abrirSessao()
  if (sessao.error) return { error: sessao.error }
  const supabase = sessao.supabase as Cliente
  const user = { email: sessao.email as string }

  if (!ETAPAS_VALIDAS.includes(etapa as Etapa)) return { error: 'Etapa inválida' }

  const leitura = await lerObra(supabase, obraId)
  if (leitura.error) return { error: leitura.error }
  const obra = leitura.obra as ObraRow

  const hoje = hojeISO()

  // Marcos calculados ANTES do update (função pura): a data de fechamento da
  // OS é validada contra o relatório do estado FINAL, e toda recusa sai antes
  // de qualquer escrita (ajuste 2 de 23/09, spec-ajustes-ficha §5.3).
  const { antes, depois } = calcularMarcosDaEsteira(obra, etapa as Etapa, hoje, dataFechamentoOS)

  if (dataFechamentoOS !== undefined) {
    // Aplicável só quando ESTA troca carimba `marco_fechou_os` a partir de
    // `null` — olhando a obra lida do banco, não a etapa que a tela acha que
    // ela tem. É o que deixa o "Tentar de novo" recuperar a falha parcial.
    const aplicavel =
      obra.marco_fechou_os === null && ORDEM_ETAPA[etapa as Etapa] > ORDEM_ETAPA.fecharOS
    if (!aplicavel) return { error: 'A data de fechamento da OS só vale ao concluir Fechar OS.' }
    const erroData = validarDataFechamentoOS(dataFechamentoOS, {
      hoje,
      relatorio: (depois.marco_relatorio as string | null) ?? null,
      aprovacao: obra.aprovacao,
    })
    if (erroData) return { error: erroData }
  }

  const base = {
    etapa,
    // Quanto tempo a obra está parada NA ETAPA é o número que hoje não existe
    // em lugar nenhum. Ele só continua verdadeiro se zerar a cada troca.
    // Exceção (A4): em Pendente faturamento com data informada, a espera
    // começa na data em que a OS foi fechada.
    desde_etapa: dataFechamentoOS !== undefined && etapa === 'pendFat' ? dataFechamentoOS : hoje,
    atualizacao: hoje,
  }

  let { error } = await supabase
    .from('obras_obra')
    .update({ ...base, etapa_por: user.email, etapa_em: new Date().toISOString() })
    .eq('id', obraId)

  if (colunaInexistente(error)) {
    ;({ error } = await supabase.from('obras_obra').update(base).eq('id', obraId))
  }

  if (error) return { error: 'Erro ao mudar a etapa da obra' }

  // Marcos da esteira (decisões de 21/09, calculadas pelo ESTADO FINAL —
  // ver o comentário de calcularMarcosDaEsteira). Roda numa escrita
  // SEPARADA, DEPOIS da etapa já ter mudado de verdade: as duas não são
  // atômicas entre si (torná-las exigiria mudar a RPC ou o schema, fora do
  // escopo desta troca — registrado em docs/DIVIDAS.md, B1). Se ESTA parte
  // falhar, a obra fica com a etapa nova mas os marcos ainda no estado
  // antigo — inconsistente — até a PRÓXIMA troca de etapa: como o cálculo é
  // por estado final (não por direção), a próxima troca reconcilia sozinha,
  // mesmo que seja outra vez para a mesma etapa. Nada é apagado sem o valor
  // antigo já estar no histórico primeiro, então não há perda de dado — só
  // uma janela de exibição incoerente entre as duas escritas.
  const linhas = linhasDeAlteracao(antes, depois, 'Esteira')
  if (linhas.length > 0) {
    const camposMarco = camposDasLinhas(linhas, depois)
    const { error: erroMarco } = await gravarComHistorico(supabase, {
      obraId,
      campos: camposMarco,
      linhas,
    })
    if (erroMarco) {
      return { error: 'A etapa mudou, mas houve erro ao atualizar os marcos da esteira' }
    }
  }

  revalidatePath(`/obras/obra/${obraId}`)
  revalidatePath('/obras/base')
  return { success: true }
}

export type DadosTriagem = {
  resp: string
  equipe: string
  prioridade: string
  inicio: string
  duracao: string
  libPor?: string
  libEm?: string
  /**
   * §4.6 — o que o bloco "Dados da obra" e a Origem acrescentaram à Triagem.
   * Todos OPCIONAIS, e essa é a garantia que importa: coluna cujo campo veio
   * `undefined` não entra no update e, portanto, não pode ser apagada por uma
   * tela antiga que não conheça o campo.
   */
  origem?: string
  tipo?: string
  valor?: string
  analista?: string
  aprovadaEm?: string
}

/**
 * TRIAGEM — "Liberar para o diário do dia" (`liberarObra(mockup:3931)`).
 *
 * Os cinco campos obrigatórios são revalidados AQUI, não só na tela: a trava do
 * botão é conforto, a garantia é a Server Action. Liberado por / Data da
 * liberação continuam **opcionais** e fora do checklist — obrigar o campo faria
 * alguém inventar um nome só para destravar a tela, que é exatamente o dado
 * falso que este sistema existe para não ter.
 */
export async function liberarObraAction(
  obraId: string,
  dados: DadosTriagem
): Promise<EstadoAcao> {
  const sessao = await abrirSessao()
  if (sessao.error) return { error: sessao.error }
  const supabase = sessao.supabase as Cliente

  const resp = nulo(dados.resp)
  const equipe = nulo(dados.equipe)
  const prioridade = nulo(dados.prioridade)
  const inicio = nulo(dados.inicio)
  const duracao = Number.parseInt(dados.duracao ?? '', 10)

  if (!resp || !equipe || !prioridade || !inicio || !Number.isFinite(duracao)) {
    return { error: 'Preencha os cinco campos antes de liberar' }
  }
  if (!PRIORIDADES.includes(prioridade as Prioridade)) return { error: 'Prioridade inválida' }
  if (duracao < 1 || duracao > 180) return { error: 'A duração precisa ficar entre 1 e 180 dias' }

  const hoje = hojeISO()
  const libPor = nulo(dados.libPor)

  // §4.6 — o diálogo de liberar promete que "os dados da obra e a autorização
  // preenchidos também são gravados". Só entram no update os campos que a tela
  // realmente mandou: `undefined` significa "esta tela não conhece o campo",
  // e apagar dado do cliente por omissão de formulário seria pior que não gravar.
  const extras: Record<string, unknown> = {}

  if (dados.origem !== undefined) extras.origem = nulo(dados.origem)
  if (dados.analista !== undefined) extras.analista_cliente = nulo(dados.analista)

  if (dados.tipo !== undefined) extras.tipo = nulo(dados.tipo)

  if (dados.valor !== undefined) {
    const valor = numeroBR(dados.valor)
    // `undefined` é o sentinela de INVÁLIDO de numeroBR — distinto de `null`,
    // que é "campo vazio". Confundi-los apagaria o valor por um erro de digitação.
    if (valor === undefined) return { error: 'Valor precisa ser um número em reais, como 18.450,00.' }
    extras.valor = valor
  }

  if (dados.aprovadaEm !== undefined) {
    // R7: as três colunas da aprovação são um campo só de tela. Nunca divergem.
    const aprovadaEm = nulo(dados.aprovadaEm)
    if (aprovadaEm && aprovadaEm > hoje) {
      return { error: 'A data de aprovação não pode ser depois de hoje.' }
    }
    extras.aprovacao = aprovadaEm
    extras.os_aprovada = aprovadaEm !== null
    extras.marco_os_aprov = aprovadaEm
  }

  const { data, error } = await supabase
    .from('obras_obra')
    .update({
      ...extras,
      pcm: resp,
      equipe,
      prioridade,
      inicio_plan: inicio,
      duracao,
      // Sem nome de quem liberou, a data da liberação não significa nada — as
      // duas andam juntas ou nenhuma é gravada.
      liberado_por: libPor,
      liberado_em: libPor ? (nulo(dados.libEm) ?? hoje) : null,
      etapa: 'levantamento',
      desde_etapa: hoje,
      atualizacao: hoje,
      pendencia: 'Finalizar levantamento, confirmar material e programar a equipe',
      pend_resp: resp,
      prox_acao: 'Concluir levantamento',
    })
    .eq('id', obraId)
    .eq('etapa', 'definir')
    .select('id')

  if (error) return { error: 'Erro ao liberar a obra' }
  // Zero linhas afetadas não é erro para o Postgres, mas é para nós: significa
  // que a obra saiu de "Aguardando definição" entre o carregamento da tela e o
  // clique — outra aba, outra pessoa, ou um duplo clique. Sem esta checagem a
  // ação dizia "deu certo" e mandava para a base sem ter mudado nada.
  if (!data || data.length === 0) {
    return { error: 'Esta obra já foi liberada por outra pessoa. Recarregue a página.' }
  }

  revalidatePath(`/obras/obra/${obraId}`)
  revalidatePath('/obras/base')
  revalidatePath('/obras/diario')
  return { success: true }
}

// ============================================================
// FICHA EDITÁVEL — spec-ficha-editavel-2026-09-18.md §4
//
// As quatro actions de bloco abaixo têm o mesmo esqueleto, e ele é a razão de
// existirem os helpers do topo do arquivo:
//
//   sessão → ler a obra → validar com a MESMA função da tela (_lib/ficha-campos)
//   → diff em linhas de histórico → campos derivados das linhas → RPC → revalidar
//
// O diff não é enfeite: `gravarComHistorico` RECUSA (lançando) uma coluna
// rastreada presente em `campos` sem a linha correspondente em `linhas`. Montar
// `campos` a partir do formulário inteiro quebraria essa trava — e é justamente
// o cenário que ela existe para impedir.
// ============================================================

/**
 * §4.1 — bloco **Autorização** da ficha: origem, liberado por, data da
 * liberação e "OS aprovada em".
 *
 * `avancou` (R16/E8) é o único retorno extra do módulo: quando a obra estava
 * parada em `aprovarOS` sem aprovação e passa a ter uma, ela anda sozinha para
 * `fecharOS`. A DECISÃO de avançar é do servidor; o diálogo que anuncia isso é
 * da tela, e é por isso que a action precisa contar que avançou.
 */
export async function salvarAutorizacaoAction(
  obraId: string,
  dados: DadosAutorizacao
): Promise<EstadoAcao & { avancou?: boolean }> {
  const sessao = await abrirSessao()
  if (sessao.error) return { error: sessao.error }
  const supabase = sessao.supabase as Cliente

  const leitura = await lerObra(supabase, obraId)
  if (leitura.error) return { error: leitura.error }
  const obra = leitura.obra as ObraRow

  const hoje = hojeISO()

  const erro = primeiroErro(validarAutorizacao(dados, { hoje, origemAtual: obra.origem }))
  if (erro) return { error: erro }

  const { antes, depois } = rascunhoAutorizacao(obra, dados, hoje)

  // R16 — só avança quando a obra está EM `aprovarOS` e não tinha aprovação.
  // Em qualquer outra etapa (R17), ou quando a aprovação só foi corrigida,
  // `etapa` sequer entra no objeto de campos.
  const avancou =
    obra.etapa === 'aprovarOS' && depois.os_aprovada_em !== null && aprovacaoAtual(obra) === null

  if (avancou) {
    antes.etapa = obra.etapa
    depois.etapa = 'fecharOS'
  }

  const linhas = linhasDeAlteracao(antes, depois, 'Autorização')
  const campos: Record<string, unknown> = { ...camposDasLinhas(linhas, depois), atualizacao: hoje }

  if (avancou) {
    // O contador de dias parados na etapa só continua verdadeiro se zerar aqui,
    // igual a `mudarEtapaAction`.
    campos.desde_etapa = hoje
    campos.etapa_por = sessao.email
    campos.etapa_em = new Date().toISOString()
  }

  const r = await gravarBloco(supabase, obraId, campos, linhas, 'Erro ao salvar a autorização')
  if (r.error) return r
  return avancou ? { success: true, avancou: true } : { success: true }
}

/**
 * §4.2 — bloco **Identificação**: tipo, valor, analista do cliente e mau uso.
 *
 * Nº OS, loja e chamado NÃO passam por aqui (R19): eles vêm do Field, e a
 * sincronização de 5 minutos os corrigiria por cima sem avisar ninguém da
 * divergência. As duas listas de colunas — a que esta ficha grava e a que o
 * Field escreve — são disjuntas de propósito (R20).
 */
export async function salvarIdentificacaoAction(
  obraId: string,
  dados: DadosIdentificacao
): Promise<EstadoAcao> {
  const sessao = await abrirSessao()
  if (sessao.error) return { error: sessao.error }
  const supabase = sessao.supabase as Cliente

  const leitura = await lerObra(supabase, obraId)
  if (leitura.error) return { error: leitura.error }
  const obra = leitura.obra as ObraRow

  const erro = primeiroErro(validarIdentificacao(dados, { tipoAtual: obra.tipo }))
  if (erro) return { error: erro }

  const { antes, depois } = rascunhoIdentificacao(obra, dados)
  const linhas = linhasDeAlteracao(antes, depois, 'Identificação')
  const campos = { ...camposDasLinhas(linhas, depois), atualizacao: hojeISO() }

  return gravarBloco(supabase, obraId, campos, linhas, 'Erro ao salvar a identificação')
}

const MOTIVO_DESCONHECIDO = 'Motivo de remarcação desconhecido. Recarregue a página.'

/**
 * O motivo é conferido contra a TABELA, não contra constante de código: a lista
 * é dado, para o cliente poder cadastrar um motivo novo sem deploy (R15).
 *
 * Devolve o nome CANÔNICO — o que está gravado na lista, com acento e caixa —
 * porque é ele que a RPC procura em `chave = lower(btrim(nome))`. Mandar o que
 * o usuário digitou ("contratacao de prestador") faria a RPC recusar um motivo
 * que existe, já que o índice do banco não tira acento (só o app tira).
 */
async function motivoCanonico(
  supabase: Cliente,
  motivo: string
): Promise<{ nome?: string; error?: string }> {
  const { data, error } = await supabase
    .from('obras_motivo_remarcacao')
    .select('nome')
    .eq('ativo', true)

  if (error) return { error: 'Erro ao carregar os motivos de remarcação' }

  const alvo = normalizarMotivo(motivo)
  const achado = ((data ?? []) as { nome: string }[]).find((m) => normalizarMotivo(m.nome) === alvo)
  if (!achado) return { error: MOTIVO_DESCONHECIDO }
  return { nome: achado.nome }
}

/**
 * §4.3 — bloco **Cronograma**: responsável, equipe, prioridade, início
 * planejado e duração.
 *
 * Mudar o INÍCIO quando já havia um é remarcação (R9) e exige motivo da lista.
 * Mudar duração, responsável, equipe ou prioridade não pede nada (R12). A
 * remarcação grava pela RPC `obras_remarcar_inicio`, que põe a data nova e a
 * linha de `obras_remarcacao` na MESMA transação (R11) — se as duas escritas
 * fossem separadas, uma falha no meio gravaria a data e perderia o motivo, que é
 * exatamente o dado que esta entrega existe para capturar.
 *
 * `pend_resp` NÃO é tocado aqui: é o dono da pendência, conceito separado do
 * responsável da obra.
 */
export async function salvarCronogramaAction(
  obraId: string,
  dados: DadosCronograma
): Promise<EstadoAcao> {
  const sessao = await abrirSessao()
  if (sessao.error) return { error: sessao.error }
  const supabase = sessao.supabase as Cliente

  const leitura = await lerObra(supabase, obraId)
  if (leitura.error) return { error: leitura.error }
  const obra = leitura.obra as ObraRow

  const erro = primeiroErro(validarCronograma(dados, { inicioAtual: obra.inicio_plan }))
  if (erro) return { error: erro }

  const inicio = nulo(dados.inicio)
  const duracaoTexto = nulo(dados.duracao)
  const remarcando = precisaRemarcar(obra.inicio_plan, dados.inicio)

  let motivo: string | null = null
  let detalhe: string | null = null

  if (remarcando) {
    // Apagar um início que existia É remarcação — a data combinada deixou de
    // valer, e é isso que a remarcação registra. `precisaRemarcar` decide assim,
    // e a RPC passou a aceitar `p_para` nulo na revisão de 18/09 (bloqueador B1
    // da review da migration). Não há o que barrar aqui.

    const canonico = await motivoCanonico(supabase, dados.motivo ?? '')
    if (canonico.error) return { error: canonico.error }
    motivo = canonico.nome as string
    // A descrição só vale para "Outro". Com outro motivo qualquer ela é sobra
    // de tela e é descartada — a RPC e o check do banco fazem o mesmo.
    detalhe = ehMotivoOutro(motivo) ? nulo(dados.detalhe) : null
  }

  const antes: Rascunho = {
    pcm: obra.pcm,
    equipe: obra.equipe,
    prioridade: obra.prioridade,
    inicio_plan: obra.inicio_plan,
    duracao: obra.duracao,
  }
  const depois: Rascunho = {
    pcm: nulo(dados.resp),
    equipe: nulo(dados.equipe),
    prioridade: nulo(dados.prioridade),
    inicio_plan: inicio,
    duracao: duracaoTexto === null ? null : Number(duracaoTexto),
  }

  const linhas = linhasDeAlteracao(
    antes,
    depois,
    'Cronograma',
    remarcando ? { motivoRemarcacao: motivo, exigirMotivoRemarcacao: true } : undefined
  )
  const campos = { ...camposDasLinhas(linhas, depois), atualizacao: hojeISO() }

  if (!remarcando) {
    return gravarBloco(supabase, obraId, campos, linhas, 'Erro ao salvar o cronograma')
  }

  const { error } = await supabase.rpc('obras_remarcar_inicio', {
    p_obra_id: obraId,
    p_campos: campos,
    p_linhas: linhas,
    p_de: obra.inicio_plan,
    p_para: inicio,
    p_motivo: motivo,
    p_detalhe: detalhe,
  })

  if (error) return { error: 'Erro ao salvar o cronograma' }

  revalidar(obraId, linhas)
  return { success: true }
}

export type DadosTriagemOpcionais = {
  tipo: string
  valor: string
  analista: string
  aprovadaEm: string
  origem: string
  libPor: string
  libEm: string
}

/**
 * §4.4 — o **Salvar dados** da Triagem: grava tipo, valor, analista e a
 * autorização inteira SEM liberar a obra.
 *
 * A trava de etapa é um read-then-write, não o `.eq('etapa','definir')` do
 * update de `liberarObraAction`: a gravação passa por RPC, que não aceita
 * filtro de linha. A janela de corrida que sobra é a mesma que a spec já aceita
 * em R22 ("a última gravação vence"), e o histórico registra as duas.
 */
export async function salvarDadosTriagemAction(
  obraId: string,
  dados: DadosTriagemOpcionais
): Promise<EstadoAcao> {
  const sessao = await abrirSessao()
  if (sessao.error) return { error: sessao.error }
  const supabase = sessao.supabase as Cliente

  const leitura = await lerObra(supabase, obraId)
  if (leitura.error) return { error: leitura.error }
  const obra = leitura.obra as ObraRow

  if (obra.etapa !== 'definir') return { error: CORRIDA_TRIAGEM }

  const hoje = hojeISO()
  const autorizacao: DadosAutorizacao = {
    origem: dados.origem,
    libPor: dados.libPor,
    libEm: dados.libEm,
    aprovadaEm: dados.aprovadaEm,
  }
  // `mauUso` não existe na Triagem: ele é etiqueta da ficha. Passar o valor já
  // gravado mantém a mesma função de validação sem inventar uma mudança.
  const identificacao: DadosIdentificacao = {
    tipo: dados.tipo,
    valor: dados.valor,
    analista: dados.analista,
    mauUso: obra.mau_uso,
  }

  const erro =
    primeiroErro(validarAutorizacao(autorizacao, { hoje, origemAtual: obra.origem })) ??
    primeiroErro(validarIdentificacao(identificacao, { tipoAtual: obra.tipo }))
  if (erro) return { error: erro }

  const aut = rascunhoAutorizacao(obra, autorizacao, hoje)
  const ident = rascunhoIdentificacao(obra, identificacao)

  const antes: Rascunho = { ...aut.antes, ...ident.antes }
  const depois: Rascunho = { ...aut.depois, ...ident.depois }

  // R18 — nenhum bloco editável muda `etapa` fora do caso R16. Aqui, nunca.
  const linhas = linhasDeAlteracao(antes, depois, 'Triagem')
  const campos = { ...camposDasLinhas(linhas, depois), atualizacao: hoje }

  return gravarBloco(supabase, obraId, campos, linhas, 'Erro ao salvar os dados da obra')
}

const TAMANHO_MOTIVO = 'O motivo precisa ter entre 3 e 60 caracteres.'

/** Como o motivo é GRAVADO: sem espaço sobrando, sem espaço duplo, inicial maiúscula. */
function nomeParaGravar(nome: string): string {
  const limpo = String(nome ?? '').replace(/\s+/g, ' ').trim()
  if (limpo === '') return ''
  return limpo.charAt(0).toUpperCase() + limpo.slice(1)
}

/**
 * A lista inteira, inclusive inativos: o índice único do banco não os ignora.
 *
 * Item 5a da revisão de 20/09: um motivo achado mas INATIVO não pode virar
 * `jaExistia` como se fosse igual a um ativo — `motivoCanonico` (usado por
 * `salvarCronogramaAction`) só aceita motivo `ativo = true`, então oferecer o
 * inativo como "escolhido" levava a janela a fechar com um motivo que a
 * gravação sempre recusaria depois, sem saída na tela.
 */
async function procurarMotivo(
  supabase: Cliente,
  nome: string
): Promise<{ motivo?: { id: string; nome: string }; inativo?: string; error?: string }> {
  const { data, error } = await supabase.from('obras_motivo_remarcacao').select('id, nome, ativo')
  if (error) return { error: 'Erro ao carregar os motivos de remarcação' }

  const alvo = normalizarMotivo(nome)
  const achado = ((data ?? []) as { id: string; nome: string; ativo?: boolean }[]).find(
    (m) => normalizarMotivo(m.nome) === alvo
  )
  if (achado && achado.ativo === false) return { inativo: achado.nome }
  return { motivo: achado }
}

/**
 * §4.5 — **Cadastrar novo motivo** de dentro da janela de remarcação.
 *
 * Três camadas contra duplicata, e as três são necessárias (R15):
 *   1. a comparação SEM ACENTO e sem caixa daqui — "Contratação" e "contratacao"
 *      são o mesmo motivo para quem cadastra;
 *   2. o índice único `chave` do banco, que a normalização do app não alcança
 *      (lá é só `lower(btrim(nome))`, porque `unaccent` exigiria extensão nova);
 *   3. o tratamento de `23505` aqui embaixo: duas pessoas cadastrando o mesmo
 *      motivo ao mesmo tempo não é erro do usuário, é o mesmo resultado — o
 *      motivo existe. Relê e devolve `jaExistia`.
 *
 * `criado_por` é OBRIGATÓRIO, e não por capricho: a policy de insert da tabela
 * exige `lower(btrim(criado_por)) = lower(btrim(auth.jwt() ->> 'email'))`. Sem
 * ele, a RLS recusa a linha — a autoria não é forjável.
 */
export async function cadastrarMotivoRemarcacaoAction(
  nome: string
): Promise<{ error?: string; motivo?: { id: string; nome: string }; jaExistia?: boolean }> {
  const sessao = await abrirSessao()
  if (sessao.error) return { error: sessao.error }
  const supabase = sessao.supabase as Cliente

  const limpo = nomeParaGravar(nome)
  if (limpo.length < 3 || limpo.length > 60) return { error: TAMANHO_MOTIVO }

  const existente = await procurarMotivo(supabase, limpo)
  if (existente.error) return { error: existente.error }
  if (existente.inativo) {
    return {
      error: `"${existente.inativo}" já existe na lista, mas está desativado. Escolha outro nome — não é possível reativar por aqui.`,
    }
  }
  if (existente.motivo) return { motivo: existente.motivo, jaExistia: true }

  const { data, error } = await supabase
    .from('obras_motivo_remarcacao')
    .insert({ nome: limpo, criado_por: sessao.email })
    .select('id, nome')
    .single()

  if (error) {
    // 23505 = violação do índice único. Outra pessoa cadastrou o mesmo motivo
    // entre a leitura e o insert: o resultado desejado ACONTECEU, só não por
    // nós. Devolver erro aqui faria a tela acusar quem não errou.
    if ((error as { code?: string }).code === '23505') {
      const relido = await procurarMotivo(supabase, limpo)
      if (relido.motivo) return { motivo: relido.motivo, jaExistia: true }
    }
    return { error: 'Erro ao cadastrar o motivo' }
  }

  return { motivo: data as { id: string; nome: string }, jaExistia: false }
}
