/**
 * Lê uma tabela inteira em páginas, porque o PostgREST do Supabase corta a
 * resposta em `max_rows` = 1000 SEM erro: um `select` sem `.range` devolve as
 * primeiras 1000 linhas e mais nada, e a tela mostra uma lista parcial como se
 * fosse completa.
 *
 * Contrato:
 *  - qualquer página com erro derruba a leitura toda (`data: null`); nunca se
 *    devolve lista parcial como se fosse completa;
 *  - `buscar(de, ate, estavel)`: `estavel` é `false` só na PRIMEIRA tentativa.
 *    Se a tabela cabe numa página (o caso de hoje) o resultado é exatamente o
 *    da consulta antiga, sem `order`. Só quando a primeira página vem cheia é
 *    que a leitura recomeça com `estavel = true`, e o chamador deve ordenar por
 *    uma chave única (`id`) — paginar sem ordem fixa pode repetir ou pular linha.
 */

export const TAMANHO_DA_PAGINA = 1000

type Resposta<T> = { data: T[] | null; error: { message: string } | null }

export async function lerTodasAsLinhas<T>(
  buscar: (de: number, ate: number, estavel: boolean) => PromiseLike<Resposta<T>>,
  tamanho = TAMANHO_DA_PAGINA
): Promise<Resposta<T>> {
  const primeira = await buscar(0, tamanho - 1, false)
  if (primeira.error) return { data: null, error: primeira.error }
  const inicio = primeira.data ?? []
  if (inicio.length < tamanho) return { data: inicio, error: null }

  const linhas: T[] = []
  for (let de = 0; ; de += tamanho) {
    const { data, error } = await buscar(de, de + tamanho - 1, true)
    if (error) return { data: null, error }
    const pagina = data ?? []
    linhas.push(...pagina)
    if (pagina.length < tamanho) return { data: linhas, error: null }
  }
}
