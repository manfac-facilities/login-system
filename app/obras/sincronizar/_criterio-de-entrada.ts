/**
 * QUEM ENTRA NO CONTROLE DE OBRAS — o critério mora aqui, e só aqui.
 *
 * Fala do cliente em 15/09/2026, registrada em
 * `docs/cliente/2026-08-31-sistema-controle-de-obras/feedback-20-criterio-final-da-carga.md`:
 *
 *   "puxar as atividades spot com status pendente, agendado, em andamento"
 *
 * "Status", na fala dele, é a SITUAÇÃO da atividade — o campo estruturado do
 * Field, de valores fixos. NÃO é o campo de texto livre, onde a equipe digita
 * coisas como "Falta de Tempo" ou relatos inteiros de campo; confundir os dois
 * foi o erro registrado no feedback 19.
 *
 * Os oito valores possíveis são publicados pela própria API quando ela recusa
 * um valor inválido: pending, scheduled, in-progress, done, canceled, reported,
 * on-route, paused.
 *
 * ESTE CRITÉRIO MUDOU TRÊS VEZES EM 15/09. Por isso ele vive isolado: mudar de
 * ideia é editar a lista abaixo, não caçar `if` pelo resto do código.
 */

/** As situações que entram. Mudar o critério é mudar esta lista. */
export const SITUACOES_ACEITAS = ['pending', 'scheduled', 'in-progress'] as const

/** Nome de cada situação na língua de quem lê a tela. */
const NOME: Record<string, string> = {
  pending: 'pendente',
  scheduled: 'agendada',
  'in-progress': 'em andamento',
  done: 'concluída',
  canceled: 'cancelada',
  reported: 'reportada',
  'on-route': 'a caminho',
  paused: 'pausada',
}

const ACEITAS_EM_PORTUGUES = SITUACOES_ACEITAS.map((s) => NOME[s]).join(', ')

/**
 * A API já devolveu `status` com espaço e com maiúscula em respostas diferentes.
 * Normalizar aqui evita que a diferença vire uma OS perdida.
 */
function normalizar(situacao: string | null | undefined): string | null {
  if (typeof situacao !== 'string') return null
  const limpa = situacao.trim().toLowerCase()
  return limpa === '' ? null : limpa
}

/** O nome em português, ou o valor cru quando a API inventar um valor novo. */
export function nomeDaSituacao(situacao: string | null | undefined): string {
  const limpa = normalizar(situacao)
  if (!limpa) return 'sem situação'
  return NOME[limpa] ?? limpa
}

/**
 * Entra na carga?
 *
 * Situação ausente, ilegível ou desconhecida **não entra**. É de propósito:
 * o Field pode ganhar um valor novo amanhã, e deixar entrar o que não se
 * entende encheria a base de obra que ninguém pediu — enquanto deixar de fora
 * aparece na lista de ignoradas, com o valor cru, para alguém investigar.
 */
export function entraNaCarga(situacao: string | null | undefined): boolean {
  const limpa = normalizar(situacao)
  if (!limpa) return false
  return (SITUACOES_ACEITAS as readonly string[]).includes(limpa)
}

/** O motivo que vai para a tabela "o que ficou de fora" da tela. */
export function motivoDaRecusa(situacao: string | null | undefined): string {
  const limpa = normalizar(situacao)
  if (!limpa) {
    return `OS sem situação legível na última atividade — só entram ${ACEITAS_EM_PORTUGUES}`
  }
  const conhecida = NOME[limpa]
  if (conhecida) {
    return `OS com a última atividade ${conhecida} — só entram ${ACEITAS_EM_PORTUGUES}`
  }
  return `OS com situação desconhecida no Field ("${limpa}") — só entram ${ACEITAS_EM_PORTUGUES}`
}
