import { badgeChecklist } from '../checklistBadge'
import { CHECKLIST_TIPOS } from '../enums'

describe('badgeChecklist', () => {
  it('gives every checklist tipo its own label', () => {
    const labels = CHECKLIST_TIPOS.map((tipo) => badgeChecklist(tipo).label)

    expect(new Set(labels).size).toBe(CHECKLIST_TIPOS.length)
  })

  it('labels the three tipos added in v04 as themselves, not as retorno', () => {
    // Regressão: o mapa de badges cobria só saida/retorno/troca e caía num
    // fallback de 'retorno', então recebimento, devolução e finalização de
    // contrato apareciam todos rotulados "RETORNO" na listagem.
    expect(badgeChecklist('recebimento').label).toMatch(/RECEBIMENTO/)
    expect(badgeChecklist('devolucao').label).toMatch(/DEVOLU/)
    expect(badgeChecklist('finalizacao_contrato').label).toMatch(/CONTRATO/)
  })

  it('distinguishes devolução from finalização de contrato', () => {
    // O cliente pediu os dois justamente porque significam coisas diferentes:
    // devolução o carro fica na empresa, finalização ele volta pra locadora.
    expect(badgeChecklist('devolucao').label).not.toBe(
      badgeChecklist('finalizacao_contrato').label
    )
  })

  it('shows an unknown tipo as itself instead of claiming it is a retorno', () => {
    const badge = badgeChecklist('tipo_que_nao_existe')

    expect(badge.label).toBe('TIPO QUE NAO EXISTE')
    expect(badge.label).not.toMatch(/RETORNO/)
  })
})
