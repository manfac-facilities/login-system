/**
 * Histórico de alterações da obra — J4, seção D do mockup (aprovada).
 * Ver docs/cliente/2026-08-31-sistema-controle-de-obras/spec-historico-alteracoes-2026-09-15.md
 *
 * Convenção deste arquivo: `campo` grava uma CHAVE ESTÁVEL (nunca o texto de
 * tela) — o rótulo se traduz na leitura, via ROTULO_CAMPO, do mesmo jeito que
 * `nomeEtapa()` traduz `etapa` em tipos.ts. Se o rótulo mudar (ex.: a decisão
 * 8 ainda pendente do cliente sobre o nome de marco_liberou_fat), as linhas
 * já gravadas continuam corretas sem backfill.
 */

import { br, moeda, nomeEtapa, type Etapa, type ObraRow } from './tipos'
import type { SupabaseClient } from '@supabase/supabase-js'

export type BlocoHistorico =
  | 'Triagem'
  | 'Autorização'
  | 'Identificação'
  | 'Cronograma'
  | 'Esteira'
  | 'Cancelamento'

export type CampoHistorico =
  | 'pcm'
  | 'equipe'
  | 'prioridade'
  | 'inicio_plan'
  | 'duracao'
  | 'liberado_por'
  | 'liberado_em'
  | 'os_aprovada_em'
  | 'tipo'
  | 'valor'
  | 'origem'
  | 'analista_cliente'
  | 'mau_uso'
  | 'etapa'
  | 'marco_exec_fim'
  | 'marco_relatorio'
  | 'marco_fechou_os'
  | 'marco_liberou_fat'
  | 'marco_faturou'

/** Rótulo de tela para cada campo rastreado. Ver spec §7. */
export const ROTULO_CAMPO: Record<CampoHistorico, string> = {
  pcm: 'Responsável da obra',
  equipe: 'Equipe / prestador',
  prioridade: 'Prioridade',
  inicio_plan: 'Início planejado',
  duracao: 'Duração em dias',
  liberado_por: 'Liberado por',
  liberado_em: 'Data da liberação',
  os_aprovada_em: 'OS aprovada em',
  tipo: 'Tipo',
  valor: 'Valor',
  origem: 'Origem',
  analista_cliente: 'Analista do cliente',
  mau_uso: 'Classificação',
  etapa: 'Etapa',
  marco_exec_fim: 'Data de fim da execução em campo',
  marco_relatorio: 'Data do relatório de entrega',
  marco_fechou_os: 'Data de fechamento da OS',
  marco_liberou_fat: 'Data do faturamento liberado',
  marco_faturou: 'Data de faturamento',
}

/** Uma linha ainda não gravada — o formato que a RPC espera em `p_linhas`. */
export type LinhaHistoricoNova = {
  bloco: BlocoHistorico
  campo: CampoHistorico
  de: string | null
  para: string | null
  motivo?: string | null
}

/** Uma linha já gravada, lida de volta do banco. */
export type LinhaHistorico = LinhaHistoricoNova & {
  id: string
  obra_id: string
  quem: string
  created_at: string
}

const CAMPOS_DATA: ReadonlySet<CampoHistorico> = new Set([
  'inicio_plan', 'liberado_em', 'os_aprovada_em',
  'marco_exec_fim', 'marco_relatorio', 'marco_fechou_os',
  'marco_liberou_fat', 'marco_faturou',
])

function formatarValor(campo: CampoHistorico, v: string | number | boolean | null): string | null {
  if (v === null || v === undefined || v === '') return null
  if (campo === 'valor') {
    // M2: Number('abc') é NaN, e moeda() não trata NaN — sem a guarda, ia
    // pro banco como o texto "R$ NaN".
    const n = Number(v)
    return Number.isFinite(n) ? moeda(n) : String(v)
  }
  if (campo === 'duracao') return `${v} dias`
  if (campo === 'mau_uso') return v ? 'Mau uso' : 'normal'
  if (campo === 'etapa') return nomeEtapa(v as Etapa)
  if (CAMPOS_DATA.has(campo)) {
    // M1: br() devolve o literal '—' para qualquer string que não tenha 3
    // partes separadas por '-' — inclusive lixo que não é null/''. Sem a
    // guarda, um valor malformado (não vazio) virava indistinguível do
    // sentinela de vazio, e ficava gravado assim para sempre (tabela sem
    // update).
    const partesData = String(v).split('-')
    return partesData.length === 3 ? br(String(v)) : String(v)
  }
  return String(v)
}

/** Compara valor "cru" (não formatado) para decidir se algo realmente mudou. */
function iguais(a: string | number | boolean | null | undefined, b: string | number | boolean | null | undefined): boolean {
  const na = a === undefined || a === '' ? null : a
  const nb = b === undefined || b === '' ? null : b
  if (na === null && nb === null) return true
  if (na === null || nb === null) return false
  if (typeof na === 'number' || typeof nb === 'number') return Number(na) === Number(nb)
  return String(na) === String(nb)
}

export function linhasDeAlteracao(
  antes: Partial<Record<CampoHistorico, string | number | boolean | null>>,
  depois: Partial<Record<CampoHistorico, string | number | boolean | null>>,
  bloco: BlocoHistorico,
  opts?: { motivoRemarcacao?: string | null; exigirMotivoRemarcacao?: boolean }
): LinhaHistoricoNova[] {
  const linhas: LinhaHistoricoNova[] = []
  // M3: motivo é validado com .trim() mas era gravado cru — agora os dois
  // usam a MESMA variável, então não têm como divergir.
  const motivoTrim = opts?.motivoRemarcacao ? opts.motivoRemarcacao.trim() : null

  for (const campo of Object.keys(depois) as CampoHistorico[]) {
    const antigo = antes[campo] ?? null
    const novo = depois[campo] ?? null
    if (iguais(antigo, novo)) continue

    if (campo === 'inicio_plan' && opts?.exigirMotivoRemarcacao) {
      if (!motivoTrim) {
        throw new Error(
          'linhasDeAlteracao: início mudou com exigirMotivoRemarcacao=true e sem motivoRemarcacao — quem chamou esqueceu de validar antes.'
        )
      }
    }

    linhas.push({
      bloco,
      campo,
      de: formatarValor(campo, antigo),
      para: formatarValor(campo, novo),
      motivo: campo === 'inicio_plan' ? motivoTrim : null,
    })
  }

  return linhas
}

/**
 * Coluna crua de `obras_obra` -> CampoHistorico correspondente — usado só
 * pela trava de amarração de `gravarComHistorico` (I2 da review de
 * 2026-09-15), não pelo dicionário de rótulos nem pela migration.
 * `os_aprovada` e `marco_os_aprov` MAPEIAM para `os_aprovada_em`, igual
 * `aprovacao` — os três são satélites que mudam juntos, pelo mesmo clique
 * (spec §7), e por isso geram a MESMA linha sob o rótulo "OS aprovada em".
 * Reconferência de 2026-09-15: na primeira versão desta trava, os dois
 * ficaram de fora "porque nunca mudam sozinhos" — mas isso descreve o uso
 * esperado, não impede um payload que só mande `os_aprovada`/
 * `marco_os_aprov` (sem `aprovacao`) de escapar da trava por completo. Os
 * três precisam estar mapeados para a mesma trava pegar qualquer um deles.
 */
const COLUNA_PARA_CAMPO: Partial<Record<string, CampoHistorico>> = {
  pcm: 'pcm',
  equipe: 'equipe',
  prioridade: 'prioridade',
  inicio_plan: 'inicio_plan',
  duracao: 'duracao',
  liberado_por: 'liberado_por',
  liberado_em: 'liberado_em',
  aprovacao: 'os_aprovada_em',
  os_aprovada: 'os_aprovada_em',
  marco_os_aprov: 'os_aprovada_em',
  tipo: 'tipo',
  valor: 'valor',
  origem: 'origem',
  analista_cliente: 'analista_cliente',
  mau_uso: 'mau_uso',
  etapa: 'etapa',
  marco_exec_fim: 'marco_exec_fim',
  marco_relatorio: 'marco_relatorio',
  marco_fechou_os: 'marco_fechou_os',
  marco_liberou_fat: 'marco_liberou_fat',
  marco_faturou: 'marco_faturou',
}

/**
 * Chama a RPC `obras_aplicar_alteracao`. Duas famílias de falha, tratadas
 * diferente por design:
 *
 * 1. Falha da RPC (rede, RLS, coluna desconhecida em `p_campos` — ver B1 da
 *    migration —, obra não encontrada) — NUNCA lança, devolve
 *    `{ error: string }` (convenção `EstadoAcao` de `_actions.ts`).
 * 2. Precondição do CHAMADOR quebrada — um campo rastreado (CampoHistorico)
 *    PRESENTE em `campos` sem a linha correspondente em `linhas` (I2 da
 *    review de 2026-09-15) — LANÇA, síncrono, ANTES de qualquer chamada de
 *    rede.
 *
 * IMPORTANTE sobre o que a trava (2) realmente verifica: ela olha
 * PRESENÇA da coluna em `campos`, não se o valor MUDOU. Isso significa duas
 * coisas para quem monta `campos` na Parte 2: (a) se um campo rastreado
 * muda e ninguém gerou a linha correspondente (esqueceu de chamar
 * `linhasDeAlteracao`, ou chamou e a linha se perdeu no caminho), a trava
 * pega — esse é o caso que ela existe para pegar; (b) se `campos` incluir
 * uma coluna rastreada que NÃO mudou (ex.: mandar o formulário inteiro em
 * vez de só o diff), a trava ACUSA DO MESMO JEITO, porque não tem como
 * distinguir os dois casos só olhando `campos`/`linhas` — a correção nesse
 * cenário é a Parte 2 não incluir em `campos` uma coluna rastreada que não
 * mudou, não remover a trava.
 */
export async function gravarComHistorico(
  supabase: SupabaseClient,
  params: { obraId: string; campos: Record<string, unknown>; linhas: LinhaHistoricoNova[] }
): Promise<{ data?: ObraRow; error?: string }> {
  const camposComLinha = new Set(params.linhas.map((l) => l.campo))
  const faltando = [
    ...new Set(
      Object.keys(params.campos)
        .map((coluna) => COLUNA_PARA_CAMPO[coluna])
        .filter((campo): campo is CampoHistorico => campo !== undefined && !camposComLinha.has(campo))
    ),
  ]

  if (faltando.length > 0) {
    throw new Error(
      `gravarComHistorico: ${faltando.join(', ')} está(ão) presente(s) em "campos" sem a linha de histórico correspondente em "linhas". Isto significa uma das duas coisas: (1) o campo mudou e a linha não foi gerada — chame linhasDeAlteracao antes de gravarComHistorico; ou (2) "campos" inclui uma coluna que NÃO mudou — esta trava olha presença em "campos", não mudança de valor, então não inclua colunas inalteradas em "campos".`
    )
  }

  const { data, error } = await supabase.rpc('obras_aplicar_alteracao', {
    p_obra_id: params.obraId,
    p_campos: params.campos,
    p_linhas: params.linhas,
  })

  if (error) return { error: 'Erro ao salvar a alteração da obra' }
  return { data: data as ObraRow }
}
