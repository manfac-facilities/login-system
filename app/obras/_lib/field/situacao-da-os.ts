/**
 * A situação da ÚLTIMA atividade de uma OS do Field.
 *
 * Por que isso existe: o Field guarda o andamento nas ATIVIDADES da OS, não na
 * OS. O critério de entrada do Controle de Obras (feedback 20, 15/09/2026) fala
 * da situação da última atividade — "pendente, agendado, em andamento" —, então
 * é ela que a varredura precisa ler.
 *
 * Duas decisões que a medição de 15/09 sustenta:
 *
 * 1. **Lê `status`, o campo estruturado.** O `statusDescription` é texto livre
 *    digitado pela equipe (aparecem "Falta de Tempo" e relatos inteiros de
 *    campo), e o `statusClassification` só existe em 84 das 210 atividades
 *    medidas — um critério apoiado nele deixaria a maioria das OS sem resposta.
 *    Quando existe, ele nunca contradiz o `status`: carrega o mesmo estado
 *    dentro de `statusClassification.status`.
 * 2. **Falha nunca derruba a varredura.** Mesma escolha de `consulta-ordem.ts`:
 *    sem resposta legível, a OS fica sem situação e é ignorada com motivo. Uma
 *    OS que não se conseguiu ler nunca vira obra e nunca altera obra existente.
 *
 * Custo: uma requisição por OS, no ritmo de 1 por segundo que o limitador impõe.
 */

import type { HttpField } from './http'

export type SituacaoDaUltimaAtividade = {
  /** O `status` cru da última atividade, ou `null` quando não deu para saber. */
  situacao: string | null
  motivo?: string
}

type AtividadeField = {
  id?: string | null
  position?: number | null
  status?: string | null
  updatedAt?: string | null
}

type ListaDeAtividades = {
  items?: AtividadeField[] | null
}

/**
 * Teto de atividades lidas por OS. A medição de 15/09 encontrou no máximo 4
 * atividades numa OS, e 21 das 185 tinham mais de uma — 100 é folga larga sem
 * pagar uma segunda requisição.
 */
const LIMITE_DE_ATIVIDADES = 100

function posicao(atividade: AtividadeField): number {
  return typeof atividade.position === 'number' ? atividade.position : -1
}

function quando(atividade: AtividadeField): number {
  if (typeof atividade.updatedAt !== 'string') return 0
  const ms = Date.parse(atividade.updatedAt)
  return Number.isNaN(ms) ? 0 : ms
}

/**
 * A última é a de maior `position`. Empate resolve pela atualização mais
 * recente — é o que separa a atividade nova da antiga quando o Field repete a
 * posição, caso visto na medição.
 */
function ultimaAtividade(atividades: AtividadeField[]): AtividadeField | null {
  let ultima: AtividadeField | null = null
  for (const atual of atividades) {
    if (!ultima) {
      ultima = atual
      continue
    }
    const pAtual = posicao(atual)
    const pUltima = posicao(ultima)
    if (pAtual > pUltima || (pAtual === pUltima && quando(atual) > quando(ultima))) {
      ultima = atual
    }
  }
  return ultima
}

export async function consultarSituacaoDaUltimaAtividade(
  http: HttpField,
  idField: string,
): Promise<SituacaoDaUltimaAtividade> {
  try {
    const lista = await http.get<ListaDeAtividades>(
      `/orders/${encodeURIComponent(idField)}/tasks`,
      { limit: LIMITE_DE_ATIVIDADES },
    )

    if (!lista || !Array.isArray(lista.items)) {
      return {
        situacao: null,
        motivo: 'a resposta das atividades da OS não trouxe a lista items',
      }
    }

    if (lista.items.length === 0) {
      return { situacao: null, motivo: 'a OS não tem nenhuma atividade no Field' }
    }

    const ultima = ultimaAtividade(lista.items)
    const situacao = typeof ultima?.status === 'string' ? ultima.status.trim() : ''

    if (situacao === '') {
      return {
        situacao: null,
        motivo: 'a última atividade da OS veio sem situação no Field',
      }
    }

    return { situacao }
  } catch (erro) {
    return {
      situacao: null,
      motivo:
        erro instanceof Error
          ? `falha ao ler as atividades da OS: ${erro.message}`
          : 'falha desconhecida ao ler as atividades da OS',
    }
  }
}
