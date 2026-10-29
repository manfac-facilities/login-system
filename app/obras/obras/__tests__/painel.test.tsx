import { render, screen } from '@testing-library/react'
import PainelObra from '../_ui/painel'
import type { ObraGrande } from '../_lib/leitura'
import type { AtividadeCalculada } from '../_lib/cronograma'

const obra = {
  id: 'o1', os: '0526-1', loja: 'Macaé 3', cliente: 'DPSP', modalidade: 'obra',
  data_base: '2026-10-01', atividade_trava: 6,
} as unknown as ObraGrande['obra']

const base: ObraGrande = {
  obra, versaoBase: null, versaoVigente: null, rascunho: null,
  plano: [], exec: [], impedimentos: [], feriados: new Set(),
  calc: null, terminoBase: null, sinal: null, atraso: null,
}

const ativ = (over: Partial<AtividadeCalculada>): AtividadeCalculada => ({
  numero: 1, etapa: 'Demolição', descricao: 'Demolições', pred1: null, pred2: null, duracao: 2,
  bloqueiaPorTrava: true, pesoValor: 0, status: 'nao_iniciado', percentual: 0, inicioReal: null, fimReal: null,
  inicioPrevisto: '2026-10-01', fimPrevisto: '2026-10-02', inicioProjetado: '2026-10-01', fimProjetado: '2026-10-02',
  peso: 0.1, percentualPrevisto: 0, situacao: 'no_prazo', travada: false, ...over,
})

const comCronograma = (over: Partial<ObraGrande> = {}): ObraGrande => ({
  ...base,
  versaoBase: { id: 'v1', numero: 1, salvaEm: '2026-10-01T10:00:00Z', motivo: null },
  versaoVigente: { id: 'v1', numero: 1, salvaEm: '2026-10-01T10:00:00Z', motivo: null },
  calc: {
    atividades: [
      ativ({ numero: 1, descricao: 'Demolições', travada: true }),
      ativ({ numero: 2, descricao: 'Pintura', situacao: 'atrasada' }),
      ativ({ numero: 3, descricao: 'Piso', situacao: 'aguardando_cliente' }),
    ],
    previsto: 0.4, realizado: 0.3, desvioPP: -10,
    terminoPrevisto: '2026-11-10', terminoProjetado: '2026-11-17',
  },
  terminoBase: '2026-11-10', sinal: 'vermelho',
  atraso: { total: 5, cliente: 4, manfac: 1, terceiro: 0, clima: 0 },
  ...over,
})

describe('PainelObra', () => {
  it('sem cronograma: aviso, link da aba e nenhum botão de diário', () => {
    render(<PainelObra dados={base} hoje="2026-10-29" estadoDiario="nao_iniciado" ultimoEnvio={null} />)
    expect(screen.getByText(/ainda não tem cronograma/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /cronograma/i })).toHaveAttribute('href', '/obras/obras/o1/cronograma')
    expect(screen.queryByText(/diário de hoje/i)).toBeNull()
  })

  it('com atraso: decompõe por responsável', () => {
    render(<PainelObra dados={comCronograma()} hoje="2026-10-29" estadoDiario="nao_iniciado" ultimoEnvio={null} />)
    expect(screen.getByText(/\+5 dias: 4 do cliente, 1 da Manfac/)).toBeInTheDocument()
    expect(screen.getByText('Atrasado')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Preencher diário de hoje/ })).toBeInTheDocument()
    expect(screen.getByText(/Demolições travadas até a atividade 6/)).toBeInTheDocument()
    expect(screen.getByText(/Pintura/)).toBeInTheDocument()
    expect(screen.getByText(/Piso/)).toBeInTheDocument()
  })

  it('só rascunho: mostra "Base ainda não salva" e os números', () => {
    const d = comCronograma({
      versaoBase: null, versaoVigente: null,
      rascunho: { id: 'r', numero: 1, salvaEm: null, motivo: null },
    })
    render(<PainelObra dados={d} hoje="2026-10-29" estadoDiario="nao_iniciado" ultimoEnvio={null} />)
    expect(screen.getByText(/Base ainda não salva/)).toBeInTheDocument()
    expect(screen.getByText(/40%/)).toBeInTheDocument()
    expect(screen.queryByText(/Preencher diário de hoje/)).toBeNull()
  })

  it('agrupa impedimentos abertos por responsável com "há N dias"', () => {
    const d = comCronograma({
      impedimentos: [{
        id: 'i1', obraId: 'o1', categoria: 'impedimento', tipo: null, responsavel: 'cliente', atividadeNumero: 3,
        descricao: 'Acesso negado', pessoaCliente: null, fotoPath: null, travaAtividade: false, impactoDias: null,
        exibirAoCliente: true, abertoEm: '2026-10-26', encerradoEm: null, rdoId: null, orientacaoId: null,
        criadoPor: null, criadoEm: '2026-10-26T10:00:00Z',
      }],
    })
    render(<PainelObra dados={d} hoje="2026-10-29" estadoDiario="rascunho" ultimoEnvio="2026-10-28" />)
    expect(screen.getByText(/Acesso negado/)).toBeInTheDocument()
    expect(screen.getByText(/há 3 dias/)).toBeInTheDocument()
    expect(screen.getByText(/Rascunho/)).toBeInTheDocument()
  })
})
