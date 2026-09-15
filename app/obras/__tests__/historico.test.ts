import { ROTULO_CAMPO, type CampoHistorico } from '../_lib/historico'

describe('ROTULO_CAMPO', () => {
  it('tem um rótulo para cada CampoHistorico, sem string vazia', () => {
    const campos: CampoHistorico[] = [
      'pcm', 'equipe', 'prioridade', 'inicio_plan', 'duracao',
      'liberado_por', 'liberado_em', 'os_aprovada_em',
      'tipo', 'valor', 'origem', 'analista_cliente', 'mau_uso',
      'etapa',
      'marco_exec_fim', 'marco_relatorio', 'marco_fechou_os',
      'marco_liberou_fat', 'marco_faturou',
    ]
    for (const c of campos) {
      expect(ROTULO_CAMPO[c]).toBeTruthy()
    }
  })

  it('usa os rótulos exatos da spec (amostra)', () => {
    expect(ROTULO_CAMPO.pcm).toBe('Responsável da obra')
    expect(ROTULO_CAMPO.liberado_por).toBe('Liberado por')
    expect(ROTULO_CAMPO.os_aprovada_em).toBe('OS aprovada em')
    expect(ROTULO_CAMPO.etapa).toBe('Etapa')
  })
})
