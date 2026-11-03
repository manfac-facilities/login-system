/** M4: relatório validado/enviado com conteúdo congelado inválido NÃO é remontado com os dados de hoje. */
jest.mock('@react-pdf/renderer', () => ({
  Document: 'd', Page: 'p', View: 'v', Text: 't', Svg: 's', Polyline: 'l', Line: 'l', Image: 'i',
  StyleSheet: { create: <T,>(x: T) => x },
  Font: { register: jest.fn(), registerHyphenationCallback: jest.fn() },
}))
jest.mock('@/lib/supabase/admin', () => ({ createAdminClient: jest.fn() }))
jest.mock('../../_lib/leitura', () => ({
  lerObraGrande: jest.fn(),
  lerPlanos: jest.fn().mockResolvedValue({ ok: true, planos: [] }),
  lerRestricoes: jest.fn().mockResolvedValue({ ok: true, restricoes: [] }),
}))
import type { SupabaseClient } from '@supabase/supabase-js'
import { lerObraGrande } from '../../_lib/leitura'
import { lerDadosPeriodo } from '../carregar-periodo'
import { obraPeriodo } from './fixtures/periodo'

const cliente = (estado: string, conteudo: unknown) =>
  ({
    from: () => {
      const q: Record<string, unknown> = {}
      q.select = () => q
      q.eq = () => q
      q.maybeSingle = async () => ({
        error: null,
        data: { id: 'r1', estado, periodo_inicio: '2026-10-26', periodo_fim: '2026-11-06', conteudo, highlights: null, observacoes: null },
      })
      return q
    },
  }) as unknown as SupabaseClient

describe('lerDadosPeriodo com congelado inválido', () => {
  it.each(['validado', 'enviado'])('%s com conteúdo fora do esquema: erro claro, sem remontar', async (estado) => {
    const r = await lerDadosPeriodo(cliente(estado, { lixo: true }), 'o1', 'fase', '10', '2026-11-10', obraPeriodo())
    expect(r).toEqual({ ok: false, status: 500, erro: 'Conteúdo do relatório inválido; fale com o administrador.' })
  })

  it('rascunho sem conteúdo continua montando dos dados de hoje', async () => {
    ;(lerObraGrande as jest.Mock).mockResolvedValue({ ok: true, dados: obraPeriodo() })
    const r = await lerDadosPeriodo(cliente('rascunho', null), 'o1', 'fase', '10', '2026-11-10', obraPeriodo())
    expect(r.ok).toBe(true)
  })
})
