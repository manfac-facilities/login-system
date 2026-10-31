import { montarEmailAta, montarEmailImediata, vinculoImediata } from '../_email'
import type { ImpedimentoRow } from '../../../_lib/leitura'

const imp = (over: Partial<ImpedimentoRow> = {}): ImpedimentoRow => ({
  id: 'i1', obraId: 'o1', categoria: 'impedimento', tipo: 'Material Manfac', responsavel: 'manfac', atividadeNumero: 3,
  descricao: 'Atraso no perfil', pessoaCliente: null, fotoPath: null, travaAtividade: false, impactoDias: null,
  exibirAoCliente: true, abertoEm: '2026-10-28', encerradoEm: null, rdoId: null, orientacaoId: null,
  criadoPor: null, criadoEm: '2026-10-28T10:00:00Z', ...over,
})

describe('vínculo da imediata', () => {
  it('cliente: Manfac sem a área (tipo); interno: com tipo', () => {
    const c = vinculoImediata({ lado: 'cliente', impedimento: imp(), atividade: { codigo: '1.3', descricao: 'Forro' } })
    expect(c).toEqual(['Atividade 1.3 · Forro', 'Impedimento: Atraso no perfil (responsável: Manfac)'])
    const i = vinculoImediata({ lado: 'interno', impedimento: imp(), atividade: null })
    expect(i[0]).toContain('Material Manfac')
  })
  it('impedimento oculto não vai ao cliente; ao interno vai marcado', () => {
    expect(vinculoImediata({ lado: 'cliente', impedimento: imp({ exibirAoCliente: false }), atividade: null })).toEqual([])
    expect(vinculoImediata({ lado: 'interno', impedimento: imp({ exibirAoCliente: false }), atividade: null })[0]).toContain(
      'não exibido ao cliente',
    )
  })
  it('tipo do cliente aparece ao cliente', () => {
    const c = vinculoImediata({ lado: 'cliente', impedimento: imp({ responsavel: 'cliente', tipo: 'Liberação de área' }), atividade: null })
    expect(c[0]).toContain('Liberação de área')
  })
})

describe('e-mail da imediata', () => {
  const p = {
    loja: 'DP Macaé 3', data: '2026-10-30', assunto: 'Falta de energia', texto: 'Sem energia <hoje>', nivel: 'urgente' as const,
    vinculo: [], enviadoPor: 'eng@manfac.com.br',
  }
  it('cliente sem INTERNO, com nível em texto e escape', () => {
    const e = montarEmailImediata({ ...p, lado: 'cliente' })
    expect(e.assunto).toBe('[URGENTE] DP Macaé 3 · Falta de energia')
    expect(e.html).toContain('URGENTE')
    expect(e.html).not.toContain('INTERNO')
    expect(e.html).toContain('Sem energia &lt;hoje&gt;')
    expect(e.texto).toContain('URGENTE — Falta de energia')
    expect(e.html).not.toContain('R$')
  })
  it('interno marcado', () => {
    const e = montarEmailImediata({ ...p, lado: 'interno', nivel: 'atencao' })
    expect(e.assunto).toBe('[Atenção] DP Macaé 3 · Falta de energia · interno')
    expect(e.html).toContain('COMUNICAÇÃO IMEDIATA · INTERNO')
  })
})

describe('e-mail da ata', () => {
  it('pauta, decisões e pendências, avisa do PDF', () => {
    const e = montarEmailAta({
      loja: 'DP Macaé 3',
      data: '2026-10-29',
      participantes: 'Ana (cliente)\nBeto (Manfac)',
      texto: null,
      ata: { pauta: 'Andamento', decisoes: ['Liberar área'], pendencias: [{ oque: 'Enviar projeto', responsavel: 'Ana', prazo: '2026-11-05' }] },
      enviadoPor: 'eng@manfac.com.br',
    })
    expect(e.assunto).toBe('Ata de reunião · DP Macaé 3 · 29/10/2026')
    expect(e.texto).toContain('1. Liberar área')
    expect(e.texto).toContain('1. Enviar projeto — Ana · até 05/11/2026')
    expect(e.html).toContain('Ana (cliente), Beto (Manfac)')
    expect(e.html).toContain('PDF anexo')
  })
})
