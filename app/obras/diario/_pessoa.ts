/**
 * Quem é o usuário logado dentro do Controle de Obras.
 *
 * LACUNA CONHECIDA DO SCHEMA, e ela é real: `obras_obra.pcm` guarda a chave da
 * pessoa em texto (YURI, AMANDA, LUANA) e `obras_pessoa.chave` é a mesma coisa
 * — mas NENHUMA das duas tabelas guarda e-mail. Não existe, em lugar nenhum do
 * banco, a ligação entre a conta do hub e a pessoa da planilha.
 *
 * Enquanto essa coluna não existir, a ligação é derivada do e-mail:
 *   yuri.nascimento@manfac.com.br  →  YURI
 *   amanda@manfac.com.br           →  AMANDA
 * Primeiro pedaço do local-part, sem acento, em maiúsculas — que é exatamente
 * a forma das chaves semeadas em `sdd-sql-obras-v0.sql` §8.
 *
 * Isso é uma CONVENÇÃO, não uma garantia: um e-mail fora do padrão (apelido,
 * sobrenome primeiro, homônimo) devolve uma chave que não casa com nenhuma
 * obra, e a pessoa vê o diário vazio com a mensagem de "esta tela é de quem é
 * responsável pelas obras". O conserto de verdade é uma coluna `email` em
 * `obras_pessoa` — está reportado, e não cabe nesta frente porque a migration
 * não é editável aqui.
 *
 * Este arquivo é módulo comum de propósito: `_actions.ts` é `'use server'` e só
 * pode exportar função async, então a função síncrona precisa morar fora dele.
 */

import type { createClient } from '@/lib/supabase/server'

type Cliente = Awaited<ReturnType<typeof createClient>>

/**
 * A chave da pessoa logada, do jeito confiável primeiro.
 *
 * 1. `obras_pessoa.email` — o cadastro explícito. É a verdade.
 * 2. Se não houver linha, cai na convenção do e-mail (`chaveDoUsuario`).
 *
 * A ordem importa: enquanto os e-mails reais não estiverem cadastrados, a
 * convenção mantém o sistema de pé; assim que estiverem, ela para de ser
 * consultada e o apelido/homônimo deixa de ser um problema.
 */
export async function resolverChave(
  supabase: Cliente,
  email: string | null | undefined
): Promise<string> {
  if (!email) return ''
  // O try/catch não é paranoia: a coluna `email` entrou depois na migration, e
  // quem tiver rodado uma versão anterior do arquivo tem a tabela sem ela. Aqui
  // a consulta falhar é um caso previsto — cair na convenção mantém o diário de
  // pé em vez de derrubar a tela inteira por causa de uma coluna ausente.
  try {
    // `.eq` com o e-mail em minúsculas, não `.ilike`: em ILIKE o `_` e o `%` do
    // endereço viram curinga, e `ana_paula@` casaria com a linha de outra
    // pessoa — prendendo o diário à fila errada. O índice único da tabela é
    // sobre `lower(email)`, então a comparação em minúsculas é a que ele serve.
    const { data } = await supabase
      .from('obras_pessoa')
      .select('chave')
      .eq('email', email.toLowerCase())
      .maybeSingle()
    if (data?.chave) return data.chave
  } catch {
    // segue para a convenção
  }
  return chaveDoUsuario(email)
}

/** `yuri.nascimento@manfac.com.br` → `YURI`. String vazia quando não dá. */
export function chaveDoUsuario(email: string | null | undefined): string {
  if (!email) return ''
  const local = email.split('@')[0] ?? ''
  const primeiro = local.split(/[.\-_+]/)[0] ?? ''
  return primeiro
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9]/g, '')
    .toUpperCase()
}
