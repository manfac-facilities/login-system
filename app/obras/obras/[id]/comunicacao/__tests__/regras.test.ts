import { montarLinhaDoTempo, podeEditar, quandoRegistro, validarAta, validarImediata, validarRegistro } from '../_regras'
import type { Envio, Registro } from '../_tipos'

const HOJE = '2026-10-30'

describe('validarRegistro', () => {
  const base = { tipo: 'ligacao' as const, data: HOJE, participantes: ' Ana\nBeto ', texto: ' combinado ', ata: null }

  it('limpa e aceita ligação', () => {
    const r = validarRegistro(base, HOJE)
    expect(r).toEqual({ ok: true, valor: { tipo: 'ligacao', data: HOJE, participantes: 'Ana\nBeto', texto: 'combinado', ata: null } })
  })
  it('recusa tipo imediata (só nasce pelo envio) e tipo desconhecido', () => {
    expect(validarRegistro({ ...base, tipo: 'imediata' }, HOJE).ok).toBe(false)
    expect(validarRegistro({ ...base, tipo: 'x' }, HOJE).ok).toBe(false)
  })
  it('recusa data inválida e futura', () => {
    expect(validarRegistro({ ...base, data: '2026-02-30' }, HOJE).ok).toBe(false)
    expect(validarRegistro({ ...base, data: '2026-10-31' }, HOJE).ok).toBe(false)
  })
  it('sem texto fora da reunião → erro', () => {
    expect(validarRegistro({ ...base, texto: '  ' }, HOJE).ok).toBe(false)
  })
  it('reunião exige pauta; ata vai limpa; ata em outro tipo é descartada', () => {
    expect(validarRegistro({ ...base, tipo: 'reuniao', texto: '', ata: { pauta: '', decisoes: [], pendencias: [] } }, HOJE).ok).toBe(false)
    const r = validarRegistro(
      {
        ...base,
        tipo: 'reuniao',
        texto: '',
        ata: { pauta: ' Andamento ', decisoes: [' A ', ''], pendencias: [{ oque: '', responsavel: '', prazo: '' }] },
      },
      HOJE,
    )
    expect(r).toMatchObject({ ok: true, valor: { texto: null, ata: { pauta: 'Andamento', decisoes: ['A'], pendencias: [] } } })
    const outro = validarRegistro({ ...base, ata: { pauta: 'x', decisoes: [], pendencias: [] } }, HOJE)
    expect(outro).toMatchObject({ ok: true, valor: { ata: null } })
  })
})

describe('validarAta', () => {
  it('pendência precisa do quê e prazo válido', () => {
    expect(validarAta({ pauta: 'p', decisoes: [], pendencias: [{ oque: '', responsavel: 'Ana', prazo: null }] }).ok).toBe(false)
    expect(validarAta({ pauta: 'p', decisoes: [], pendencias: [{ oque: 'x', responsavel: '', prazo: '30/10' }] }).ok).toBe(false)
    expect(validarAta({ pauta: 'p', decisoes: [], pendencias: [{ oque: 'x', responsavel: ' Ana ', prazo: '2026-11-05' }] })).toEqual({
      ok: true,
      valor: { pauta: 'p', decisoes: [], pendencias: [{ oque: 'x', responsavel: 'Ana', prazo: '2026-11-05' }] },
    })
  })
})

describe('validarImediata', () => {
  const ok = { assunto: 'Falta de energia', texto: 'Sem energia na loja', nivel: 'urgente' as const, impedimentoId: null, atividadeNumero: null }
  it('aceita e recusa nível/assunto/texto/atividade inválidos', () => {
    expect(validarImediata(ok).ok).toBe(true)
    expect(validarImediata({ ...ok, nivel: 'alto' }).ok).toBe(false)
    expect(validarImediata({ ...ok, assunto: 'a' }).ok).toBe(false)
    expect(validarImediata({ ...ok, texto: '' }).ok).toBe(false)
    expect(validarImediata({ ...ok, atividadeNumero: 1.5 }).ok).toBe(false)
  })
})

describe('podeEditar', () => {
  const agora = new Date('2026-10-30T15:00:00Z')
  const r = { criadoPor: 'ana@manfac.com.br', criadoEm: '2026-10-29T16:00:00Z' }
  it('autor dentro de 24 h sim; depois não; outro não; admin sempre', () => {
    expect(podeEditar(r, 'Ana@Manfac.com.br', false, agora)).toBe(true)
    expect(podeEditar(r, 'ana@manfac.com.br', false, new Date('2026-10-30T16:00:00Z'))).toBe(false)
    expect(podeEditar(r, 'beto@manfac.com.br', false, agora)).toBe(false)
    expect(podeEditar({ criadoPor: null, criadoEm: r.criadoEm }, 'ana@manfac.com.br', false, agora)).toBe(false)
    expect(podeEditar(r, 'beto@manfac.com.br', true, new Date('2027-01-01T00:00:00Z'))).toBe(true)
  })
})

const envio = (over: Partial<Envio>): Envio => ({
  id: 'e', tipo: 'diario', referencia: '2026-10-29', lado: 'cliente', enviadoPor: 'eng@manfac.com.br',
  enviadoEm: '2026-10-29T21:00:00Z', destinatarios: ['c@cli.com'], resultado: 'ok', detalhe: null, registroId: null, ...over,
})
const registro = (over: Partial<Registro>): Registro => ({
  id: 'r', tipo: 'ligacao', data: '2026-10-30', participantes: null, texto: 't', ata: null, nivel: null,
  impedimentoId: null, atividadeNumero: null, criadoPor: 'ana@manfac.com.br', criadoEm: '2026-10-30T13:00:00Z', editadoEm: null, ...over,
})

describe('linha do tempo', () => {
  const agora = new Date('2026-10-30T15:00:00Z')
  const envios = [
    envio({ id: 'd1', enviadoEm: '2026-10-29T21:00:00Z' }),
    envio({ id: 'a1', tipo: 'ata', registroId: 'r2', enviadoEm: '2026-10-30T14:00:00Z' }),
    envio({ id: 'orf', tipo: 'imediata', registroId: null, enviadoEm: '2026-10-28T10:00:00Z' }),
  ]
  const registros = [
    registro({ id: 'r1' }),
    // Reunião de ontem lançada hoje: entra no meio-dia de ontem.
    registro({ id: 'r2', tipo: 'reuniao', data: '2026-10-29', criadoEm: '2026-10-30T12:00:00Z', criadoPor: 'beto@manfac.com.br' }),
  ]
  const montar = (filtro: Parameters<typeof montarLinhaDoTempo>[0]['filtro']) =>
    montarLinhaDoTempo({ envios, registros, filtro, email: 'ana@manfac.com.br', admin: false, agora })

  it('mais recente primeiro; envio de ata vai dentro do registro; janela por autor', () => {
    const l = montar('todos')
    expect(l.map((i) => i.chave)).toEqual(['r-r1', 'e-d1', 'r-r2', 'e-orf'])
    const r2 = l.find((i) => i.chave === 'r-r2')
    expect(r2?.tipo === 'registro' && r2.envios.map((e) => e.id)).toEqual(['a1'])
    expect(r2?.tipo === 'registro' && r2.podeEditar).toBe(false)
    const r1 = l.find((i) => i.chave === 'r-r1')
    expect(r1?.tipo === 'registro' && r1.podeEditar).toBe(true)
  })

  it('semanal enviado aparece em Tudo e no filtro Semanais', () => {
    const l = montarLinhaDoTempo({
      envios: [...envios, envio({ id: 's1', tipo: 'semanal', referencia: '2026-10-26', enviadoEm: '2026-10-30T20:00:00Z' })],
      registros, filtro: 'semanal', email: 'ana@manfac.com.br', admin: false, agora,
    })
    expect(l.map((i) => i.chave)).toEqual(['e-s1'])
    expect(montar('diario').map((i) => i.chave)).not.toContain('e-s1')
  })

  it('filtros por tipo', () => {
    expect(montar('diario').map((i) => i.chave)).toEqual(['e-d1'])
    expect(montar('reuniao').map((i) => i.chave)).toEqual(['r-r2'])
    expect(montar('imediata').map((i) => i.chave)).toEqual(['e-orf'])
    expect(montar('ligacao').map((i) => i.chave)).toEqual(['r-r1'])
  })

  it('quandoRegistro: mesmo dia usa criado_em; outro dia, meio-dia da data', () => {
    expect(quandoRegistro({ data: '2026-10-30', criadoEm: '2026-10-30T13:00:00Z' })).toBe('2026-10-30T13:00:00.000Z')
    expect(quandoRegistro({ data: '2026-10-29', criadoEm: '2026-10-30T13:00:00Z' })).toBe('2026-10-29T15:00:00.000Z')
  })
})
