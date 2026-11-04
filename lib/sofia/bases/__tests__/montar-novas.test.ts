import { EXCEL, linhasParaExcel, nomeArquivoExcel, rodapeDa } from '../colunas'
import { descreverFiltros, filtrarLinhas, filtrosDaUrl } from '../filtro'
import type { MotoristaBruto, VeiculoBruto } from '../montar'
import {
  montarCorretivas, montarDocumentos, montarMultas, montarRevisoes, montarSinistros,
  type CorrBruta, type DocBruto, type MultaBruta, type RevBruta, type SinBruto,
} from '../montar-novas'
import { BASES_NOVAS, FILTROS_DA_BASE, FILTROS_VAZIOS, type Linha } from '../tipos'

const HOJE = '2026-11-03'
const veic = (p: Partial<VeiculoBruto>): VeiculoBruto => ({
  id: 'v1', placa: 'AAA1A11', modelo: 'HB20', ano: 2024, km_atual: 35000, km_contratual_mensal: null, valor_locacao_mensal: null,
  status: 'ativo', equipe_id: null, previsao_retorno_oficina: null, substituto_id: null, intervalo_revisao_km: null, ...p,
})
const VEICS = [veic({}), veic({ id: 'v2', placa: 'BBB2B22', km_atual: 50000 })]
const MOTS: MotoristaBruto[] = [{ id: 'm1', nome: 'Ana', cnh: null, cnh_vencimento: null, contato: null, equipe_id: null, ativo: true }]

const rev = (p: Partial<RevBruta>): RevBruta => ({
  id: 'r1', veiculo_id: 'v1', motorista_id: null, tipo: 'preventiva', fornecedor: 'Oficina X', valor: 500,
  data_realizada: '2026-09-01', km_realizada: 30000, proxima_km: null, proxima_data: null, prever_proxima: true,
  origem: 'manual', observacoes: null, pecas_trocadas: 'óleo', created_at: '2026-09-01T10:00:00Z', ...p,
})
const corr = (p: Partial<CorrBruta>): CorrBruta => ({
  id: 'c1', veiculo_id: 'v1', defeito: 'Embreagem', oficina: 'Beta', data_entrada: '2026-10-27', saida_prevista: '2026-11-06',
  data_saida: null, custo: null, quem_arca: 'locadora', status: 'aguardando_aprovacao', tirou_da_equipe: true,
  anexo_storage_path: 'manutencoes/c1/123-nota.pdf', observacoes: null, created_at: '2026-10-27T10:00:00Z', ...p,
})
const multa = (p: Partial<MultaBruta>): MultaBruta => ({
  id: 'mu1', veiculo_id: 'v1', motorista_id: 'm1', data: '2026-10-10', tipo_infracao: null, descricao: 'Velocidade',
  valor: 130.16, valor_descontado: null, status: 'pendente', autorizacao_status: 'solicitado', autorizacao_solicitado_em: null,
  created_at: '2026-10-10T10:00:00Z', etapa: 'solicitado', prazo_indicacao: '2026-11-09', ...p,
})
const sin = (p: Partial<SinBruto>): SinBruto => ({
  id: 's1', veiculo_id: 'v2', motorista_id: null, data: '2026-10-29', tipo: 'colisao', descricao: 'Colisão traseira',
  valor_dano: 4800, valor_descontado: 0, tipo_desconto: 'nenhum', status: 'em_tratativa', autorizacao_status: null,
  autorizacao_solicitado_em: null, created_at: '2026-10-29T10:00:00Z', ...p,
})
const doc = (p: Partial<DocBruto>): DocBruto => ({
  id: 'd1', veiculo_id: 'v1', tipo: 'seguro', numero: 'AP-1', vencimento: '2026-11-20', storage_path: 'documentos/x.pdf', ...p,
})

const REVS = montarRevisoes({
  hoje: HOJE, veiculos: VEICS, motoristas: MOTS, kmRecentes: [],
  revisoes: [
    rev({}),
    rev({ id: 'r0', km_realizada: 20000, data_realizada: '2026-06-01', origem: 'importacao', created_at: '2026-11-02T00:00:00Z' }),
    rev({ id: 'r2', veiculo_id: 'v2', tipo: 'corretiva', prever_proxima: false, km_realizada: 49000, data_realizada: '2026-10-01' }),
  ],
})
const CORRS = montarCorretivas({
  hoje: HOJE, veiculos: VEICS, motoristas: MOTS,
  responsabilidade: [{ veiculo_id: 'v1', equipe_id: 'e1', motorista_id: 'm1', inicio: '2026-01-01', fim: '2026-11-03', created_at: '2026-01-01T00:00:00Z' }],
  manutencoes: [corr({}), corr({ id: 'c2', tirou_da_equipe: false, status: 'concluida', data_entrada: '2026-09-22', data_saida: '2026-09-22', custo: 1180, quem_arca: 'motorista', anexo_storage_path: null })],
})
const MULTAS = montarMultas({ veiculos: VEICS, motoristas: MOTS, multas: [multa({}), multa({ id: 'mu2', tipo_infracao: 'Sinal vermelho', status: 'descontada', etapa: 'descontada', valor_descontado: 293.47, valor: 293.47 })] })
const SINS = montarSinistros({ veiculos: VEICS, motoristas: MOTS, sinistros: [sin({})] })
const DOCS = montarDocumentos({ hoje: HOJE, veiculos: VEICS, documentos: [doc({}), doc({ id: 'd2', vencimento: '2026-10-01', storage_path: null }), doc({ id: 'd3', vencimento: '2027-05-01' })] })

describe('montar', () => {
  it('revisões: situação só na vigente; a importada antiga é histórico; corretiva vigente sem previsão', () => {
    const por = Object.fromEntries(REVS.map((r) => [r.id, r]))
    expect(por.r1).toMatchObject({ sit: 'dia', proxKm: 40000, proxAuto: true, origem: 'manual' })
    expect(por.r0).toMatchObject({ sit: 'hist', origem: 'importacao' })
    expect(por.r2).toMatchObject({ sit: 'semprev', proxKm: null })
    expect(REVS.map((r) => r.id)).toEqual(['r2', 'r1', 'r0'])
  })
  it('corretiva: dias só se tirou, motorista pelo histórico, temArquivo', () => {
    expect(CORRS[0]).toMatchObject({ id: 'c1', dias: 8, motorista: 'Ana', temArquivo: true, placa: 'AAA1A11' })
    expect(CORRS[1]).toMatchObject({ id: 'c2', dias: null, temArquivo: false })
  })
  it('multa: infração = tipo_infracao ?? descricao', () => {
    expect(MULTAS.map((m) => m.infracao).sort()).toEqual(['Sinal vermelho', 'Velocidade'])
    expect(SINS[0]).toMatchObject({ placa: 'BBB2B22', aut: 'sem_solicitacao' })
  })
  it('documentos: vencido / vence em 30 / em dia, ordenado por vencimento', () => {
    expect(DOCS.map((d) => [d.id, d.sit, d.dias])).toEqual([['d2', 'vencido', -33], ['d1', 'vence30', 17], ['d3', 'dia', 179]])
  })
})

describe('planilhas das 5 bases = mockup', () => {
  it('títulos e ordem', () => {
    expect(EXCEL.rev.colunas.map((c) => c.t)).toEqual([
      'Data feita', 'Placa', 'Modelo', 'Tipo', 'Oficina', 'KM feita', 'Valor', 'Peças trocadas', 'Observações', 'Próxima (KM)',
      'Próxima (data)', 'Situação', 'Origem (manual / importada)',
    ])
    expect(EXCEL.corr.colunas.map((c) => c.t)).toEqual([
      'Entrada', 'Saída prevista', 'Saída real', 'Placa', 'Modelo', 'Motorista', 'Defeito', 'Oficina', 'Dias parado', 'Custo',
      'Quem arca', 'Status', 'Carro saiu da equipe (sim/não)', 'Observações',
    ])
    expect(EXCEL.multa.colunas.map((c) => c.t)).toEqual([
      'Data da infração', 'Placa', 'Motorista', 'Infração', 'Valor', 'Valor descontado', 'Etapa', 'Autorização', 'Prazo de indicação',
    ])
    expect(EXCEL.sin.colunas.map((c) => c.t)).toEqual([
      'Data', 'Placa', 'Motorista', 'Tipo', 'Descrição', 'Valor do dano', 'Valor descontado', 'Situação', 'Desconto (tipo)',
    ])
    expect(EXCEL.doc.colunas.map((c) => c.t)).toEqual(['Placa', 'Modelo', 'Tipo', 'Número', 'Vencimento', 'Situação', 'Dias para vencer'])
  })
  it('nomes de arquivo', () => {
    expect(nomeArquivoExcel('rev', HOJE)).toBe('frotas-revisoes-2026-11-03.xlsx')
    expect(nomeArquivoExcel('corr', HOJE)).toBe('frotas-manutencao-corretiva-2026-11-03.xlsx')
    expect(nomeArquivoExcel('multa', HOJE)).toBe('frotas-multas-2026-11-03.xlsx')
    expect(nomeArquivoExcel('sin', HOJE)).toBe('frotas-sinistros-2026-11-03.xlsx')
    expect(nomeArquivoExcel('doc', HOJE)).toBe('frotas-documentos-2026-11-03.xlsx')
  })
  it('nenhum valor de planilha é caminho de arquivo; dinheiro é número; autorização em texto', () => {
    const todas: [string, Linha[]][] = [['rev', REVS], ['corr', CORRS], ['multa', MULTAS], ['sin', SINS], ['doc', DOCS]]
    for (const [b, rows] of todas) {
      for (const linha of linhasParaExcel(b as 'rev', rows)) {
        expect(linha).toHaveLength(EXCEL[b as 'rev'].colunas.length)
        for (const v of linha) {
          if (typeof v === 'string') {
            expect(v).not.toMatch(/storage|manutencoes\/|documentos\/|\.pdf/)
          }
        }
      }
    }
    const m = linhasParaExcel('multa', MULTAS)[0]
    expect(typeof m[4]).toBe('number')
    expect(m[6]).toBe('Solicitar desconto')
    expect(m[7]).toBe('Pedida')
    expect(m[8]).toBeInstanceOf(Date) // prazo de indicação
    const c = linhasParaExcel('corr', CORRS)[0]
    expect(c[9]).toBeNull() // custo a definir
    expect(c[12]).toBe('sim')
  })
  it('rodapés', () => {
    expect(rodapeDa('rev', REVS)).toEqual({ resumo: '3 revisões', colunas: { valor: 'R$ 1.500,00' } })
    expect(rodapeDa('corr', CORRS).colunas).toEqual({ dias: '8', custo: 'R$ 1.180,00' })
    expect(rodapeDa('doc', DOCS).resumo).toBe('3 documentos')
  })
})

describe('filtros das 5 bases', () => {
  it('rev: situação "hist"', () => {
    expect(filtrarLinhas('rev', REVS, { ...FILTROS_VAZIOS, sit: 'hist' }).map((r) => r.id)).toEqual(['r0'])
    expect(filtrarLinhas('rev', REVS, { ...FILTROS_VAZIOS, tipo: 'corretiva' }).map((r) => r.id)).toEqual(['r2'])
  })
  it('período exclui linha sem data; corr por status e quem arca; multa por autorização', () => {
    expect(filtrarLinhas('rev', REVS, { ...FILTROS_VAZIOS, de: '2026-08-01' }).map((r) => r.id)).toEqual(['r2', 'r1'])
    expect(filtrarLinhas('corr', CORRS, { ...FILTROS_VAZIOS, arca: 'motorista' }).map((r) => r.id)).toEqual(['c2'])
    expect(filtrarLinhas('multa', MULTAS, { ...FILTROS_VAZIOS, sit: 'descontada' }).map((r) => r.id)).toEqual(['mu2'])
    expect(filtrarLinhas('multa', MULTAS, { ...FILTROS_VAZIOS, motorista: 'Ana', aut: 'solicitado' })).toHaveLength(2)
  })
  it('doc não tem período', () => {
    expect(FILTROS_DA_BASE.doc.some((c) => c.k === 'periodo')).toBe(false)
    expect(filtrarLinhas('doc', DOCS, { ...FILTROS_VAZIOS, de: '2027-01-01' })).toHaveLength(3)
    expect(descreverFiltros('doc', FILTROS_VAZIOS)).toBe('sem filtro (tudo)')
  })
  it('URL sem filtro nas novas = sem período; valor fora da lista é ignorado', () => {
    for (const b of BASES_NOVAS) expect(filtrosDaUrl(b, {}, HOJE)).toEqual(FILTROS_VAZIOS)
    expect(filtrosDaUrl('corr', { status: 'em_conserto', arca: 'xyz' }, HOJE)).toMatchObject({ status: 'em_conserto', arca: '' })
    expect(filtrosDaUrl('rev', { sit: 'hist', placa: 'AAA1A11' }, HOJE)).toMatchObject({ sit: 'hist', placa: 'AAA1A11', de: '' })
  })
  it('descreve', () => {
    expect(descreverFiltros('corr', { ...FILTROS_VAZIOS, status: 'em_conserto', placa: 'X' })).toBe('período início a hoje · placa X · status: em conserto')
  })
})
