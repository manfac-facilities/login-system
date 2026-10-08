/**
 * `lerEntradaDoPainel` pede as mesmas colunas de sempre em cada tabela e, se
 * qualquer leitura falhar, devolve `ok: false` dizendo qual tabela quebrou.
 */
import { lerEntradaDoPainel } from '../_leitura'

type Falha = { message: string } | null

function fakeSupabase(falhas: Record<string, Falha> = {}) {
  const colunasPedidas: Record<string, string> = {}
  const supabase = {
    from(tabela: string) {
      return {
        select(colunas: string) {
          colunasPedidas[tabela] = colunas
          return {
            order: () => ({
              range: async () => ({
                data: falhas[tabela] ? null : [{ tabela }],
                error: falhas[tabela] ?? null,
              }),
            }),
          }
        },
      }
    },
  }
  return { supabase: supabase as never, colunasPedidas }
}

describe('lerEntradaDoPainel', () => {
  it('pede as colunas de cada tabela, com select(*) nas obras', async () => {
    const { supabase, colunasPedidas } = fakeSupabase()
    const r = await lerEntradaDoPainel(supabase)
    expect(colunasPedidas).toEqual({
      obras_obra: '*',
      obras_diario: 'obra_id, data, andou, motivo, foto_path',
      obras_tarefa: 'obra_id, situacao, prazo, resposta_em',
      obras_remarcacao: 'obra_id, data, de, para, created_at',
    })
    expect(r).toEqual({
      ok: true,
      obras: [{ tabela: 'obras_obra' }],
      diario: [{ tabela: 'obras_diario' }],
      tarefas: [{ tabela: 'obras_tarefa' }],
      remarcacoes: [{ tabela: 'obras_remarcacao' }],
    })
  })

  it.each(['obras_obra', 'obras_diario', 'obras_tarefa', 'obras_remarcacao'])(
    'erro em %s devolve ok:false com o nome da tabela e a mensagem',
    async (tabela) => {
      const { supabase } = fakeSupabase({ [tabela]: { message: 'boom' } })
      const r = await lerEntradaDoPainel(supabase)
      expect(r.ok).toBe(false)
      if (!r.ok) {
        expect(r.erro).toContain(tabela)
        expect(r.erro).toContain('boom')
      }
    }
  )
})
