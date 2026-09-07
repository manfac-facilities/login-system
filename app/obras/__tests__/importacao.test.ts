/**
 * Testes das funções puras de app/obras/_lib/importacao.ts.
 *
 * Duas camadas:
 *   1. Unitários por função, usando valores LITERAIS copiados do dump real
 *      (docs/cliente/2026-08-31-sistema-controle-de-obras/planilha-dpsp-rev02-dump.txt),
 *      um por armadilha do dicionário.
 *   2. Um teste de ponta a ponta com as 187 linhas da Pipeline DPSP e as 19
 *      (+1 molde vazio) da Planejamento DPSP, transcritas do mesmo dump, para
 *      provar o merge e os totais contra o dado real inteiro.
 */

import {
  paraTexto,
  paraNumero,
  paraDataIso,
  normalizarOs,
  normalizarLoja,
  normalizarEquipe,
  normalizarBloqueio,
  normalizarPrioridade,
  decodificarEntidadesHtml,
  normalizarAvancoFisico,
  combinarAcaoEPrazo,
  etapaDeStatusManfac,
  etapaDePlanejamento,
  mapearLinhaPipeline,
  mapearLinhaPlanejamento,
  montarImportacao,
  camposParaAtualizar,
  type LinhaBrutaObras,
} from '../_lib/importacao'

// ============================================================
// 1. paraTexto / paraNumero / paraDataIso
// ============================================================

describe('paraTexto', () => {
  it('recorta espaço e trata vazio como null', () => {
    expect(paraTexto('  DP BAIRRO DE FATIMA  ')).toBe('DP BAIRRO DE FATIMA')
    expect(paraTexto('')).toBeNull()
    expect(paraTexto('   ')).toBeNull()
    expect(paraTexto(null)).toBeNull()
    expect(paraTexto(undefined)).toBeNull()
  })

  it('lê o cache de uma célula de fórmula', () => {
    expect(paraTexto({ formula: 'IF(...)', result: 'YURI' })).toBe('YURI')
  })

  it('trata fórmula sem cache e fórmula quebrada como null', () => {
    expect(paraTexto({ formula: 'IF(B24="","",...)' })).toBeNull()
    expect(paraTexto({ formula: 'X', error: '#VALUE!' })).toBeNull()
  })
})

describe('paraNumero — sujeira menor: BR e US convivendo na mesma coluna', () => {
  it('lê US direto (68134.9, a maioria da Pipeline)', () => {
    expect(paraNumero('68134.9')).toBeCloseTo(68134.9)
    expect(paraNumero(28520.46)).toBeCloseTo(28520.46)
  })

  it('lê BR (linha 175 do dump: "1.205,50")', () => {
    expect(paraNumero('1.205,50')).toBeCloseTo(1205.5)
  })

  it('vazio e lixo viram null', () => {
    expect(paraNumero('')).toBeNull()
    expect(paraNumero(null)).toBeNull()
    expect(paraNumero('abc')).toBeNull()
  })
})

describe('paraDataIso — armadilha 5: datas de época do Excel', () => {
  it('aceita ISO direto', () => {
    expect(paraDataIso('2026-07-06')).toBe('2026-07-06')
  })

  it('aceita o texto de Date#toString() que o dump grava para o cache de fórmula (linha 5, coluna Q)', () => {
    expect(paraDataIso('Tue Aug 18 2026 21:00:00 GMT-0300 (Horário Padrão de Brasília)')).toBe('2026-08-19')
  })

  it('NUNCA devolve a data de época 1899 (linha 6, colunas Q/R) — vira null', () => {
    expect(paraDataIso('Fri Dec 29 1899 20:53:32 GMT-0306 (Horário Padrão de Brasília)')).toBeNull()
  })

  it('mesmo bug embrulhado em objeto de fórmula (forma real do ExcelJS)', () => {
    expect(
      paraDataIso({
        formula: "IF(B6=\"\",\"\",IFERROR(INDEX(...)))",
        result: new Date(Date.UTC(1899, 11, 30)),
      })
    ).toBeNull()
  })

  it('objeto de fórmula com Date válida no result (forma real do ExcelJS)', () => {
    expect(paraDataIso({ formula: '...', result: new Date(Date.UTC(2026, 7, 19)) })).toBe('2026-08-19')
  })

  it('lixo de fórmula sem cache (armadilha 1, colunas U/V/W) vira null, nunca "Invalid Date"', () => {
    expect(paraDataIso({ formula: 'IF(U14=0,"",IFERROR(_xludf.XLOOKUP(...)))' })).toBeNull()
  })

  it('"Invalid Date" (linha 14/22, coluna V) vira null', () => {
    expect(paraDataIso('Invalid Date')).toBeNull()
  })

  it('resultado que virou objeto aninhado ("[object Object]" no dump, linha 14/22 coluna U/W) vira null', () => {
    expect(paraDataIso({ formula: 'COUNTIF(...)', result: { algumaCoisaInesperada: true } })).toBeNull()
  })

  it('vazio e undefined viram null', () => {
    expect(paraDataIso('')).toBeNull()
    expect(paraDataIso(undefined)).toBeNull()
  })
})

// ============================================================
// 2. Normalizadores de domínio
// ============================================================

describe('normalizarOs — armadilha 4: Nº OS não serve como chave sozinho', () => {
  it('anula os literais que colidem ou não são número', () => {
    expect(normalizarOs('SEM OS')).toBeNull()
    expect(normalizarOs('sem os')).toBeNull()
    expect(normalizarOs('GARANTIA')).toBeNull()
  })

  it('mantém truncados e o de dígito a mais — não colidem entre si', () => {
    expect(normalizarOs('1142')).toBe('1142')
    expect(normalizarOs('17769')).toBe('17769')
    expect(normalizarOs('0826-0011526')).toBe('0826-0011526')
  })

  it('mantém o formato normal', () => {
    expect(normalizarOs('0226-014989')).toBe('0226-014989')
  })

  it('null e vazio viram null', () => {
    expect(normalizarOs(null)).toBeNull()
    expect(normalizarOs('')).toBeNull()
  })
})

describe('normalizarLoja — sujeira menor: DPA vira DP', () => {
  it('corrige o prefixo DPA', () => {
    expect(normalizarLoja('DPA BARRA DA TIJUCA 6')).toBe('DP BARRA DA TIJUCA 6')
    expect(normalizarLoja('DPA PETROPOLIS 6')).toBe('DP PETROPOLIS 6')
  })

  it('não mexe em loja sem o prefixo DP algum (fora de escopo da v0)', () => {
    expect(normalizarLoja('NITEROI 15')).toBe('NITEROI 15')
    expect(normalizarLoja('LEBLON ATAULFO 80')).toBe('LEBLON ATAULFO 80')
    expect(normalizarLoja('PLAZA MACAE')).toBe('PLAZA MACAE')
  })

  it('mantém loja já normal', () => {
    expect(normalizarLoja('DP BAIRRO DE FATIMA')).toBe('DP BAIRRO DE FATIMA')
  })
})

describe('normalizarEquipe — DEFINIR é placeholder, não equipe', () => {
  it('DEFINIR vira null', () => {
    expect(normalizarEquipe('DEFINIR')).toBeNull()
  })

  it('mantém equipe multivalorada com "/" como texto (N:N é v1)', () => {
    expect(normalizarEquipe('MANFAC-4/PARCEIRO')).toBe('MANFAC-4/PARCEIRO')
    expect(normalizarEquipe('MANFAC-4 / MANFAC-7')).toBe('MANFAC-4 / MANFAC-7')
    expect(normalizarEquipe('ERLI/RICARDO')).toBe('ERLI/RICARDO')
  })

  it('mantém nome simples', () => {
    expect(normalizarEquipe('MANFAC-7')).toBe('MANFAC-7')
  })
})

describe('normalizarBloqueio / normalizarPrioridade', () => {
  it('aceita os valores reais da Planejamento', () => {
    expect(normalizarBloqueio('Sem bloqueio')).toBe('Sem bloqueio')
    expect(normalizarBloqueio('Cliente / loja')).toBe('Cliente / loja')
    expect(normalizarBloqueio('Disponibilidade de equipe')).toBe('Disponibilidade de equipe')
    expect(normalizarPrioridade('Urgente')).toBe('Urgente')
    expect(normalizarPrioridade('Normal')).toBe('Normal')
  })

  it('valor fora do enum vira null, não passa sujo', () => {
    expect(normalizarBloqueio('Qualquer coisa')).toBeNull()
    expect(normalizarPrioridade('Média')).toBeNull()
  })
})

describe('decodificarEntidadesHtml — sujeira menor: entidades cruas na descrição (linha 8 do dump)', () => {
  it('decodifica o trecho real da linha 8', () => {
    expect(decodificarEntidadesHtml('infiltra&ccedil;&atilde;o na &aacute;rea de vendas')).toBe(
      'infiltração na área de vendas'
    )
  })

  it('texto sem entidade passa direto', () => {
    expect(decodificarEntidadesHtml('Rolllout do Telhado Geral')).toBe('Rolllout do Telhado Geral')
  })
})

describe('normalizarAvancoFisico — armadilha 2 (escrita e testada, mas NÃO usada pelo import)', () => {
  it('valores em fração (0–1) passam direto', () => {
    expect(normalizarAvancoFisico(0)).toBe(0)
    expect(normalizarAvancoFisico(0.9)).toBe(0.9)
    expect(normalizarAvancoFisico(1)).toBe(1)
  })

  it('o valor solto em 0–100 (linha 17: "95") vira fração', () => {
    expect(normalizarAvancoFisico(95)).toBeCloseTo(0.95)
  })

  it('null passa null', () => {
    expect(normalizarAvancoFisico(null)).toBeNull()
  })
})

describe('combinarAcaoEPrazo', () => {
  it('junta ação e prazo no texto único que o schema tem espaço para guardar', () => {
    expect(combinarAcaoEPrazo('Cobrar chegada de tinta', '2026-08-24')).toBe('Cobrar chegada de tinta (prazo: 24/08/2026)')
  })

  it('sem prazo, só a ação', () => {
    expect(combinarAcaoEPrazo('Acompanhar liberação', null)).toBe('Acompanhar liberação')
  })

  it('sem ação, null (não inventa texto)', () => {
    expect(combinarAcaoEPrazo(null, '2026-08-24')).toBeNull()
  })
})

// ============================================================
// 3. Etapa — armadilha 3 (MAU USO) e o mapeamento completo
// ============================================================

describe('etapaDeStatusManfac — armadilha 3: MAU USO é etapa + causa fundidas', () => {
  it('separa MAU USO em etapa aprovarOS + mau_uso=true', () => {
    expect(etapaDeStatusManfac('MAU USO - APROVAR OS')).toEqual({ etapa: 'aprovarOS', mauUso: true })
  })

  it('cobre os 7 valores reais de STATUS MANFAC do dump (187/187)', () => {
    expect(etapaDeStatusManfac('EXECUTAR')).toEqual({ etapa: 'levantamento', mauUso: false })
    expect(etapaDeStatusManfac('EXECUTADO - APROVAR OS')).toEqual({ etapa: 'aprovarOS', mauUso: false })
    expect(etapaDeStatusManfac('FECHAR OS')).toEqual({ etapa: 'fecharOS', mauUso: false })
    expect(etapaDeStatusManfac('PENDENTE FATURAMENTO')).toEqual({ etapa: 'pendFat', mauUso: false })
    expect(etapaDeStatusManfac('FATURADO')).toEqual({ etapa: 'faturado', mauUso: false })
  })

  it('"EXECUTAR - APROVAR OS" (9 chamados) é DIFERENTE de "EXECUTADO - APROVAR OS" (31): vira andamento, não aprovarOS — decisão tomada sem confirmação do cliente, ver relatório final', () => {
    expect(etapaDeStatusManfac('EXECUTAR - APROVAR OS')).toEqual({ etapa: 'andamento', mauUso: false })
  })

  it('valor desconhecido cai em definir, nunca quebra', () => {
    expect(etapaDeStatusManfac('ALGO NOVO')).toEqual({ etapa: 'definir', mauUso: false })
    expect(etapaDeStatusManfac(null)).toEqual({ etapa: 'definir', mauUso: false })
  })
})

describe('etapaDePlanejamento — os 3 valores reais de "Etapa da obra" (19/19)', () => {
  it('mapeia os três', () => {
    expect(etapaDePlanejamento('Paralisado')).toBe('paralisado')
    expect(etapaDePlanejamento('Em andamento')).toBe('andamento')
    expect(etapaDePlanejamento('Levantamento / planejamento')).toBe('levantamento')
  })

  it('desconhecido vira null (quem decide o default é quem chama)', () => {
    expect(etapaDePlanejamento('Outra coisa')).toBeNull()
    expect(etapaDePlanejamento(null)).toBeNull()
  })
})

// ============================================================
// 4. Mapeamento de linha inteira — casos pontuais do dump real
// ============================================================

function linhaPipe(numeroLinha: number, texto: string): LinhaBrutaObras {
  return { numeroLinha, valores: texto.split(' | ') }
}

describe('mapearLinhaPipeline — linhas reais do dump', () => {
  it('linha 4 (FATURADO, sem autorização nem farol)', () => {
    const obra = mapearLinhaPipeline(
      linhaPipe(4, '0226-004162 | DP ALCANTARA 5 | Rolllout do Telhado Geral da loja e marquise | CAPEX | 68134.9 | AMANDA | FATURADO | FINALIZADO | Resolvido |  | ')
    )
    expect(obra.os).toBe('0226-004162')
    expect(obra.loja).toBe('DP ALCANTARA 5')
    expect(obra.valor).toBeCloseTo(68134.9)
    expect(obra.etapa).toBe('faturado')
    expect(obra.mau_uso).toBe(false)
    expect(obra.aprovacao).toBeNull()
  })

  it('linha 132 (MAU USO)', () => {
    const obra = mapearLinhaPipeline(
      linhaPipe(132, '0326-008067 | DP BARRA DA TIJUCA 4 | solicito substituição do cadeado porta número 05 | SERRALHERIA | 526.98 | LEANDRO | MAU USO - APROVAR OS | FINALIZADO | Aguardando Aprovação | 2026-03-09 | 169')
    )
    expect(obra.etapa).toBe('aprovarOS')
    expect(obra.mau_uso).toBe(true)
    expect(obra.aprovacao).toBe('2026-03-09')
  })

  it('linha 164 (SEM OS — vira os null, mas a loja segura a linha)', () => {
    const obra = mapearLinhaPipeline(
      linhaPipe(164, 'SEM OS | DP BARRA DA TIJUCA 5 | solicito desentupimento do esgoto da loja | HIDRAULICA |  | LEANDRO | EXECUTADO - APROVAR OS | FINALIZADO | Aguardando Atendimento | 2026-08-14 | 11')
    )
    expect(obra.os).toBeNull()
    expect(obra.loja).toBe('DP BARRA DA TIJUCA 5')
  })

  it('linha 171 (Nº OS truncado, sem hífen — mantido)', () => {
    const obra = mapearLinhaPipeline(linhaPipe(171, '1142 |  | Caminhão Pipa (09/07) | HIDRAULICA |  |  | EXECUTADO - APROVAR OS | FINALIZADO | Aguardando Atendimento | 2026-07-09 | 47'))
    expect(obra.os).toBe('1142')
    expect(obra.loja).toBeNull()
  })

  it('linha 175 (valor em formato BR)', () => {
    const obra = mapearLinhaPipeline(
      linhaPipe(
        175,
        '0826-006580 | DP ICARAI 5 | Boa noite , solicito instalação | ELETRICA | 1.205,50 | AMANDA | EXECUTADO - APROVAR OS | FINALIZADO | Aguardando Aprovação | 2026-08-05 | 20'
      )
    )
    expect(obra.valor).toBeCloseTo(1205.5)
  })

  it('linha 187 (Nº OS com um dígito a mais — mantido)', () => {
    const obra = mapearLinhaPipeline(
      linhaPipe(187, '0826-0011526 | DP BARRA DA TIJUCA 5 | Pintura de Fachada | CIVIL |  | LEANDRO | EXECUTAR - APROVAR OS | NÃO INICIADO | Aguardando Atendimento | 2026-08-21 | 4')
    )
    expect(obra.os).toBe('0826-0011526')
    expect(obra.etapa).toBe('andamento')
  })
})

describe('mapearLinhaPlanejamento — linhas reais da Planejamento', () => {
  it('linha 5 (cronograma completo, sem bug de 1899)', () => {
    const v: LinhaBrutaObras = {
      numeroLinha: 5,
      valores: [
        'Normal',
        '0226-014989',
        'DP BAIRRO DE FATIMA',
        'Boa tarde!Forro do estoque caiu .',
        'TELHADO',
        '28520.46',
        'LEANDRO',
        'YURI',
        'MANFAC-7',
        'Sistema DPSP',
        'Executar',
        'Em andamento',
        'Disponibilidade de equipe',
        '0',
        '2026-07-06',
        '2026-07-20',
        'Tue Aug 18 2026 21:00:00 GMT-0300 (Horário Padrão de Brasília)',
        'Tue Aug 25 2026 21:00:00 GMT-0300 (Horário Padrão de Brasília)',
        '2026-08-19',
        '',
        '',
        '',
        '',
        'Aguardando finalização de serviço TMO 107. Nova posição 24/08',
        'YURI',
        '2026-08-24',
        'Atualzar e desiguinar data para execução',
        '2026-08-24',
        '2026-08-20',
        '',
      ],
    }
    const obra = mapearLinhaPlanejamento(v)!
    expect(obra.os).toBe('0226-014989')
    expect(obra.etapa).toBe('andamento')
    expect(obra.bloqueio).toBe('Disponibilidade de equipe')
    expect(obra.inicio_plan).toBe('2026-08-19') // cache "atual" sobrescreve o original (decisão desta frente)
    expect(obra.duracao).toBe(7) // 19/08 -> 26/08: diasDesde() da 7, e somaDias("2026-08-19", 7) volta em 26/08. A duracao TEM que fechar esse ciclo, senao o fim calculado na ficha nao bate com o da planilha.
    expect(obra.inicio_real).toBe('2026-08-19')
    expect(obra.pend_prazo).toBe('2026-08-24')
    expect(obra.prox_acao).toBe('Atualzar e desiguinar data para execução (prazo: 24/08/2026)')
  })

  it('linha 6 (bug de 1899 na Q/R): cai de volta no Início/Final original, nunca grava a data suja', () => {
    const v: LinhaBrutaObras = {
      numeroLinha: 6,
      valores: [
        'Normal',
        '0526-013745',
        'DP LUCIO COSTA',
        'Caminho Cliente - Pintura Fachada e benfeitorias externas',
        'CIVIL',
        '29795.5',
        'JUAN',
        'YURI',
        'DEFINIR',
        'Sistema DPSP',
        'Executar',
        'Paralisado',
        'Cliente / loja',
        '0',
        '',
        '',
        'Fri Dec 29 1899 20:53:32 GMT-0306 (Horário Padrão de Brasília)',
        'Fri Dec 29 1899 20:53:32 GMT-0306 (Horário Padrão de Brasília)',
        '',
        '',
        '',
        '',
        '',
        'Aguardando chegar tinta',
        'YURI',
        '',
        'Cobrar chegada de tinta',
        '2026-08-24',
        '2026-08-20',
        '',
      ],
    }
    const obra = mapearLinhaPlanejamento(v)!
    // Início/Final original TAMBÉM estão vazios aqui — então o resultado é null,
    // nunca "1899-12-29". É exatamente o caso que a armadilha 5 proíbe.
    expect(obra.inicio_plan).toBeNull()
    expect(obra.duracao).toBeNull()
    expect(obra.equipe).toBeNull() // DEFINIR -> null
  })

  it('linha 9 (GARANTIA): os vira null, a obra continua existindo pela loja', () => {
    const v: LinhaBrutaObras = {
      numeroLinha: 9,
      valores: [
        'Normal',
        'GARANTIA',
        'DP CABO FRIO 4',
        'GARANTIA DE TELHADO',
        'TELHADO',
        '',
        'AMANDA',
        'LUANA',
        'MANFAC-4 / MANFAC-7',
        'Garantia',
        'Executar',
        'Paralisado',
        'Disponibilidade de equipe',
        '0',
        '2026-07-09',
        '2026-07-15',
        'Wed Jul 08 2026 21:00:00 GMT-0300 (Horário Padrão de Brasília)',
        'Tue Jul 14 2026 21:00:00 GMT-0300 (Horário Padrão de Brasília)',
        '',
        '',
        '',
        '',
        '',
        'Pendente liberação do prestador. Outras obras acontecendo',
        'LUANA',
        '',
        'Verificar disponibilidade do prestador',
        '',
        '2026-08-20',
        '',
      ],
    }
    const obra = mapearLinhaPlanejamento(v)!
    expect(obra.os).toBeNull()
    expect(obra.loja).toBe('DP CABO FRIO 4')
    expect(obra.origem).toBe('Garantia')
  })

  it('linha 24 (molde vazio): sem OS e sem loja, devolve null — quem descarta é montarImportacao', () => {
    const vazia: LinhaBrutaObras = { numeroLinha: 24, valores: Array(30).fill('') }
    expect(mapearLinhaPlanejamento(vazia)).toBeNull()
  })
})

// ============================================================
// 5. montarImportacao — ponta a ponta com o dado real completo
//
// As 187 linhas da Pipeline DPSP e as 19 (+1 molde) da Planejamento DPSP,
// transcritas de docs/cliente/2026-08-31-sistema-controle-de-obras/
// planilha-dpsp-rev02-dump.txt (linhas L4–L190 e L5–L24).
// ============================================================

// prettier-ignore
const PIPELINE_TEXTO = `
0226-004162 | DP ALCANTARA 5 | Rolllout do Telhado Geral da loja e marquise | CAPEX | 68134.9 | AMANDA | FATURADO | FINALIZADO | Resolvido |  |
0426-008819 | DP BARRA MANSA | ROLLOUT AC | AR CONDICIONADO | 62591.31 | JUAN | FATURADO | FINALIZADO | Resolvido | 2026-05-22 | 95
0726-015753 | DP COPACABANA 6 | vazamento no subsolo | HIDRAULICA | 44532.15 | LEANDRO | EXECUTADO - APROVAR OS | FINALIZADO | Aguardando Aprovação | 2026-07-26 | 30
0226-014387 | DP BARRA DE SAO JOAO | manutenção do teto balcão | TELHADO | 35706.12 | LEANDRO | FATURADO | EM ANDAMENTO | Resolvido | 2026-05-17 | 100
0426-014237 | DP RECREIO 8 | danos estruturais por vazamento | CIVIL | 35619.91 | JUAN | FATURADO | FINALIZADO | Resolvido | 2026-05-17 | 100
0626-005880 | DP BARRA DA TIJUCA 10 | Mão de obra para pintura da fachada. | CIVIL | 34578.2 | LEANDRO | PENDENTE FATURAMENTO | FINALIZADO | Resolvido | 2026-08-06 | 19
0526-013742 | DP SANTA CRUZ 4 | Caminho Cliente - Pintura Fachada e benfeitorias externas | CIVIL | 32045.55 | JUAN | PENDENTE FATURAMENTO | EM ANDAMENTO | Resolvido | 2026-06-08 | 78
0626-005068 | DP PADRE MIGUEL | CAMINHO DO CLIENTE | CIVIL | 31527.8 | JUAN | EXECUTAR | EM ANDAMENTO | Orçamento Aprovado | 2026-06-05 | 81
0826-004733 | DP CATETE 2 | pintura das fachadas laterais | CIVIL | 30056.94 | LEANDRO | EXECUTADO - APROVAR OS | FINALIZADO | Aguardando Aprovação | 2026-08-04 | 21
0526-013745 | DP LUCIO COSTA | Caminho Cliente - Pintura Fachada e benfeitorias externas | CIVIL | 29795.5 | JUAN | EXECUTAR | NÃO INICIADO | Orçamento Aprovado | 2026-06-08 | 78
0726-011532 | DPA BARRA DA TIJUCA 6 | Mão de obra para pintura da fachada. | CIVIL | 29711.6 | LEANDRO | PENDENTE FATURAMENTO | EM ANDAMENTO | Resolvido | 2026-07-16 | 40
0326-018552 | DP LELBON 3 | Solicito o desvio da exaustão | REFRIGERAÇÃO | 29091.1 | LEANDRO | EXECUTADO - APROVAR OS | FINALIZADO | Aguardando Aprovação | 2026-05-11 | 106
0226-014989 | DP BAIRRO DE FATIMA | Boa tarde! Forro do estoque caiu . | TELHADO | 28520.46 | LEANDRO | FATURADO | EM ANDAMENTO | Resolvido | 2026-04-30 | 117
0526-013743 | DP PEDRA DE GUARATIBA | Caminho Cliente - Pintura Fachada e benfeitorias externas | CIVIL | 28050.15 | JUAN | EXECUTAR | NÃO INICIADO | Orçamento Aprovado | 2026-06-08 | 78
0426-012516 | DP MACAE 2 | Mão de obra para reforma Light | CAPEX | 25523.03 | LEANDRO | FATURADO | FINALIZADO | Resolvido |  |
0226-011320 | DP PRACA DO O | loja com infiltração | TELHADO | 18919.37 | LEANDRO | FATURADO | EM ANDAMENTO | Resolvido | 2026-03-01 | 177
0426-014763 | DP SANTA LUZIA | forro caindo dejetos de pombos | CIVIL | 17982.6 | AMANDA | FATURADO | FINALIZADO | Resolvido |  |
0126-018429 | DP RECREIO 7 | água minando das paredes | CIVIL | 17702.92 | JUAN | FATURADO | EM ANDAMENTO | Orçamento Aprovado | 2026-05-17 | 100
0826-007420 | DP PIABETA | FINALIZAÇÃO DE OBRA | CIVIL | 15700 | AMANDA | EXECUTADO - APROVAR OS | FINALIZADO | Aguardando Atendimento | 2026-05-13 | 104
0826-007423 | DP MAGE 1 | FINALIZAÇÃO DE OBRA | CIVIL | 14300 | AMANDA | EXECUTADO - APROVAR OS | FINALIZADO | Aguardando Atendimento | 2026-05-13 | 104
0326-018578 | DP IPANEMA 8 | Solicito o desvio da exaustão | AR CONDICIONADO | 13561.1 | LEANDRO | FATURADO | FINALIZADO | Resolvido | 2026-05-11 | 106
0826-006388 | DP LEME | bandejamento em vários pontos | TELHADO | 13436.9 | LEANDRO | FECHAR OS | FINALIZADO | Orçamento Aprovado | 2026-08-12 | 13
0426-006754 | DP SHOPPING ITAIPU | MO Escopo Civil - Reforma light | CAPEX | 12065.39 | AMANDA | PENDENTE FATURAMENTO | FINALIZADO | Resolvido | 2026-05-08 | 109
0426-008820 | DP NILOPOLIS | INSTALAÇÃO AR CONDICIONADO 60.000 BTUS | REFRIGERAÇÃO | 11641.39 | JUAN | PENDENTE FATURAMENTO | FINALIZADO | Resolvido | 2026-05-15 | 102
1125-016236 | DP MACAE 3 | Adequação Elétrica para Nobreak | NOBREAK | 8975.81 | LEANDRO | PENDENTE FATURAMENTO | FINALIZADO | Resolvido | 2025-12-10 | 258
1125-016234 | DP CAMPOS 7 | Adequação Elétrica para Nobreak | NOBREAK | 8710.81 | LEANDRO | PENDENTE FATURAMENTO | FINALIZADO | Resolvido | 2025-12-10 | 258
0526-008209 | DP GLORIA | JATEAMENTO - PLANTÃO PEDRO | HIDRAULICA | 8600 | LEANDRO | FECHAR OS | FINALIZADO | Orçamento Aprovado | 2026-05-02 | 115
0726-016096 | DP CATETE 2 | porta principal travando | SERRALHERIA | 8586.1 | LEANDRO | FECHAR OS | EM ANDAMENTO | Orçamento Aprovado | 2026-08-04 | 21
0526-015793 | DP RECREIO 7 | reparo pois esta enferrujada | SERRALHERIA | 8175.26 | JUAN | FATURADO | FINALIZADO | Resolvido |  |
1125-015968 | DP CABO FRIO 2 | Toldo enferrujado e soltando. | CIVIL | 8101 | LEANDRO | PENDENTE FATURAMENTO | FINALIZADO | Resolvido | 2026-01-16 | 221
0326-010522 | DP ICARAI 5 | porta principal danificada | SERRALHERIA | 7893.2 | AMANDA | EXECUTADO - APROVAR OS | FINALIZADO | Aguardando Atendimento | 2026-03-07 | 171
0526-016397 | DP MACAE 2 | Troca do forro da marquise. ( Aditivo) | CAPEX | 7495.93 | LEANDRO | PENDENTE FATURAMENTO | FINALIZADO | Resolvido | 2026-06-22 | 64
0426-016931 | DP SHOPPING BARRA SHOPPING | troca do mobiliário do Dermo. | CIVIL | 6879.4 | LEANDRO | PENDENTE FATURAMENTO | FINALIZADO | Resolvido | 2026-05-05 | 112
0526-016495 | DP SAO PEDRO DA ALDEIA | Aditivo de obra ( Reforma Light) | CAPEX | 6796.09 | LEANDRO | PENDENTE FATURAMENTO | FINALIZADO | Resolvido | 2026-06-22 | 64
0226-013174 | DP COPACABANA 8 | vazamento na área de vendas | HIDRAULICA | 6738.1 | LEANDRO | EXECUTAR | EM ANDAMENTO | Orçamento Aprovado | 2026-04-30 | 117
0426-016925 | DP JARDIM OCEANICO 2 | troca do mobiliário do dermo. | CIVIL | 6289 | LEANDRO | PENDENTE FATURAMENTO | FINALIZADO | Resolvido | 2026-05-05 | 112
0826-007940 | DP SÃO JOSE RJ | visitas em dias alternados | DEDETIZAÇÃO | 5760 | LEANDRO | FECHAR OS | FINALIZADO | Orçamento Aprovado | 2026-08-11 | 14
0226-011338 | DP MARICA 1 | tapagem de buraco | CIVIL | 5687.72 | AMANDA | EXECUTADO - APROVAR OS | FINALIZADO | Aguardando Aprovação | 2026-02-19 | 187
0626-013801 | DP RECREIO 1 | instalação de ar na copa | REFRIGERAÇÃO | 5434.03 | JUAN | FATURADO | EM ANDAMENTO | Resolvido | 2026-06-26 | 60
0326-012374 | DP CAMORIM | TELHADO | TELHADO | 5175.08 | JUAN | PENDENTE FATURAMENTO | FINALIZADO | Resolvido | 2026-04-10 | 137
0626-014568 | DP GILKA MACHADO | descaracterizacao de fachada | CIVIL | 5070.52 | JUAN | EXECUTAR | NÃO INICIADO | Aguardando Aprovação | 2026-08-14 | 11
0726-010993 | DP BUZIOS | FRETE | TRANSPORTE | 5008 | LEANDRO | FECHAR OS | FINALIZADO | Orçamento Aprovado | 2026-08-06 | 19
0526-019295 | DP BARRA DA TIJUCA 5 | desentupimento do esgoto | HIDRAULICA | 4791.2 | LEANDRO | EXECUTADO - APROVAR OS | FINALIZADO | Aguardando Aprovação | 2026-06-28 | 58
0626-005488 | DP BARRA DA TIJUCA 9 | porta automática travou | SERRALHERIA | 4716.06 | LEANDRO | EXECUTADO - APROVAR OS | FINALIZADO | Aguardando Aprovação | 2026-08-12 | 13
0226-009618 | DP MANILHA | porta lateral emperrada | SERRALHERIA | 4552.43 | AMANDA | EXECUTADO - APROVAR OS | FINALIZADO | Aguardando Atendimento | 2026-02-23 | 183
0726-011512 | DP LUCIO COSTA | Esgotamento e limpeza de cisterna | HIDRAULICA | 4503.89 | JUAN | PENDENTE FATURAMENTO | FINALIZADO | Resolvido | 2026-08-08 | 17
0526-016632 | DP BARRA DA TIJUCA 5 | vazamento na copa recorrente | HIDRAULICA | 4417.48 | LEANDRO | FATURADO | FINALIZADO | Resolvido |  |
0726-015601 | DP CASCADURA 2 | compra de geladeira | TRANSPORTE | 4077 | ALINE | PENDENTE FATURAMENTO | FINALIZADO | Resolvido | 2026-08-10 | 15
0726-015605 | DP PENHA 5 | compra de geladeira | EQUIPAMENTO | 4077 | ALINE | PENDENTE FATURAMENTO | FINALIZADO | Resolvido | 2026-08-10 | 15
0726-015603 | DP PENHA 4 | compra de geladeira | EQUIPAMENTO | 4077 | ALINE | PENDENTE FATURAMENTO | FINALIZADO | Resolvido | 2026-08-10 | 15
0726-015606 | DP ABOLIÇÃO | compra de geladeira | EQUIPAMENTO | 4077 | AMANDA | PENDENTE FATURAMENTO | FINALIZADO | Resolvido | 2026-08-10 | 15
0526-017548 | DP RECREIO 8 | cisterna sem agua. | HIDRAULICA | 4000 | JUAN | FECHAR OS | FINALIZADO | Resolvido | 2026-05-25 | 92
0726-009307 | DP RECREIO 8 | caminhão pipa | HIDRAULICA | 4000 | JUAN | PENDENTE FATURAMENTO | FINALIZADO | Resolvido | 2026-08-08 | 17
0726-012314 | DP RECREIO 8 | caminhão pipa | HIDRAULICA | 4000 | JUAN | PENDENTE FATURAMENTO | FINALIZADO | Resolvido | 2026-08-08 | 17
0726-017469 | DP RECREIO 8 | caminhão pipa | HIDRAULICA | 4000 | JUAN | FECHAR OS | FINALIZADO | Resolvido | 2026-08-08 | 17
1225-004482 | DP SAO PEDRO DA ALDEIA | reforço de iluminação | VISA | 3991.49 | LEANDRO | PENDENTE FATURAMENTO | FINALIZADO | Resolvido | 2026-02-13 | 193
0626-008725 | DP ITABORAI | Reparo da parede do vestiário feminino | CIVIL | 3922.64 | AMANDA | EXECUTAR | NÃO INICIADO | Orçamento Aprovado | 2026-08-12 | 13
0126-015288 | DP CABO FRIO 4 | Remoção de raiz de arvore | CIVIL | 3911.99 | LEANDRO | PENDENTE FATURAMENTO | FINALIZADO | Resolvido | 2026-02-25 | 181
0226-011821 | DP RIO DAS OSTRAS 2 | estoque irregular ANVISA | VISA | 3240.55 | LEANDRO | FECHAR OS | FINALIZADO | Orçamento Aprovado | 2026-07-18 | 38
0526-013810 | DP PIRATININGA | esgoto entupido | HIDRAULICA | 3220 | AMANDA | FECHAR OS | FINALIZADO | Orçamento Aprovado | 2026-05-15 | 102
0726-015135 | DP IPANEMA 1 | instalação caixa d'água | HIDRAULICA | 3137.54 | LEANDRO | PENDENTE FATURAMENTO | FINALIZADO | Resolvido | 2026-07-23 | 33
0526-017783 | DP BOTAFOGO 10 | Canteiro destruído | CIVIL | 3089.67 | LEANDRO | FECHAR OS | FINALIZADO | Orçamento Aprovado | 2026-08-06 | 19
0626-014071 | DP MAGE 1 | fossa com cheiro forte | HIDRAULICA | 2924.98 | AMANDA | PENDENTE FATURAMENTO | FINALIZADO | Resolvido | 2026-07-14 | 42
0626-008727 | DP ITABORAI | tela milimétrica e grade | SERRALHERIA | 2922.24 | AMANDA | EXECUTAR | NÃO INICIADO | Orçamento Aprovado | 2026-08-12 | 13
0726-012477 | DP CATETE 5 | remoção de adesivos e pintura | CIVIL | 2891.5 | LEANDRO | FECHAR OS | FINALIZADO | Orçamento Aprovado | 2026-08-06 | 19
0726-018372 | DP RECREIO 10 | Forro medicamentos | CIVIL | 2874.54 | JUAN | FECHAR OS | FINALIZADO | Orçamento Aprovado | 2026-08-17 | 8
0626-011577 | DP IPANEMA 6 | lâmpada queimada por infiltração | ELETRICA | 2871.6 | LEANDRO | FATURADO | FINALIZADO | Resolvido |  |
0626-013824 | DP PEDRA DE GUARATIBA | substituicao de ar condicionado | REFRIGERAÇÃO | 2645 | JUAN | FATURADO | FINALIZADO | Resolvido |  |
0726-012909 | DP PEDRA DE GUARATIBA | Troca de ar condicionado transferido | REFRIGERAÇÃO | 2645 | JUAN | EXECUTADO - APROVAR OS | FINALIZADO | Aguardando Aprovação | 2026-07-30 | 26
0726-012908 | DP VARGEM GRANDE | Instalação Ar Condicionado transferido | REFRIGERAÇÃO | 2645 | JUAN | EXECUTADO - APROVAR OS | FINALIZADO | Aguardando Aprovação | 2026-07-16 | 40
0226-014139 | DP ICARAI 2 | intimação secretaria de ordem publica | CIVIL | 2319 | AMANDA | FATURADO | FINALIZADO | Resolvido |  |
0726-015006 | DP JARDIM BOTANICO | troca do mobiliário e pia | CIVIL | 2301.5 | LEANDRO | FECHAR OS | FINALIZADO | Orçamento Aprovado | 2026-07-23 | 33
0526-008721 | DP RECREIO 1 | jardim quebrado | CIVIL | 2105.62 | JUAN | PENDENTE FATURAMENTO | FINALIZADO | Resolvido | 2026-06-12 | 74
0326-018507 | DP LEBLON 6 | ADICIONAL DE OBRA | HIDRAULICA | 2079 | LEANDRO | FATURADO | FINALIZADO | Resolvido | 2026-03-25 | 153
0726-011427 | DP RECREIO 7 | Filial sem água | HIDRAULICA | 2000 | JUAN | FECHAR OS | FINALIZADO | Resolvido | 2026-08-08 | 17
0726-010965 | DP PEDRA DE GUARATIBA | Filial sem agua, caminhao pipa | HIDRAULICA | 2000 | JUAN | FECHAR OS | FINALIZADO | Orçamento Aprovado | 2026-08-08 | 17
0726-009264 | DP PEDRA DE GUARATIBA | Filial sem agua | HIDRAULICA | 2000 | JUAN | FECHAR OS | FINALIZADO | Orçamento Aprovado | 2026-08-08 | 17
0726-011944 | DP LUCIO COSTA | Caminhão Pipa | HIDRAULICA | 2000 | JUAN | PENDENTE FATURAMENTO | FINALIZADO | Resolvido | 2026-08-17 | 8
0726-017769 | DP RECREIO 7 | Caminhão Pipa | HIDRAULICA | 2000 | JUAN | FECHAR OS | FINALIZADO | Resolvido | 2026-08-17 | 8
0726-019109 | DP RECREIO 4 | Caminhão Pipa | HIDRAULICA | 2000 | JUAN | FECHAR OS | FINALIZADO | Orçamento Aprovado | 2026-08-17 | 8
0626-010339 | NITEROI 15 | A LOJA ESTA SEM AGUA . | HIDRAULICA | 2000 | AMANDA | FECHAR OS | FINALIZADO | Orçamento Aprovado | 2026-08-06 | 19
0826-007417 | DP PIABETA 1 | caminhao pipa pra loja | HIDRAULICA | 2000 | AMANDA | EXECUTADO - APROVAR OS | FINALIZADO | Aguardando Aprovação | 2026-08-14 | 11
0826-008784 | DP PIABETA 1 | sem água, caminhão pipa | HIDRAULICA | 2000 | AMANDA | EXECUTADO - APROVAR OS | FINALIZADO | Aguardando Aprovação | 2026-08-15 | 10
0726-014295 | DP RECREIO 8 | maçaneta e porta danificadas em SINISTRO | CIVIL | 1973 | JUAN | PENDENTE FATURAMENTO | FINALIZADO | Resolvido | 2026-08-08 | 17
1125-010536 | DP BARRA DA TIJUCA 8 | Forro soltando com o vento | TELHADO | 1961.4 | LEANDRO | PENDENTE FATURAMENTO | FINALIZADO | Resolvido | 2026-01-29 | 208
0726-012456 | DP JARDIM BOTANICO | Pintura da fachada | CIVIL | 1957 | LEANDRO | FECHAR OS | FINALIZADO | Orçamento Aprovado | 2026-08-06 | 19
0726-018381 | DP NITEROI 9 | ponto de tomada 110v | ELETRICA | 1941 | AMANDA | EXECUTADO - APROVAR OS | FINALIZADO | Aguardando aprovação | 2026-08-03 | 22
0426-009327 | DP COPACABANA 6 | portais não fecham | CIVIL | 1886.4 | LEANDRO | EXECUTAR | NÃO INICIADO | Orçamento Aprovado | 2026-07-23 | 33
0726-012462 | DP CATETE 5 | cortina de ar | REFRIGERAÇÃO | 1800 | LEANDRO | FECHAR OS | FINALIZADO | Orçamento Aprovado | 2026-08-06 | 19
1125-017864 | DP RIO DAS OSTRAS 2 | Limpeza cisterna | HIDRAULICA | 1797.42 | LEANDRO | FECHAR OS | FINALIZADO | Orçamento Aprovado | 2026-04-17 | 130
0626-004570 | DP CATETE 5 | odor desagradável | DEDETIZAÇÃO | 1754.2 | LEANDRO | FECHAR OS | FINALIZADO | Orçamento Aprovado | 2026-08-06 | 19
0626-004129 | DP RIO DAS OSTRAS | bomba não puxa agua | HIDRAULICA | 1625 | LEANDRO | PENDENTE FATURAMENTO | FINALIZADO | Resolvido | 2026-08-06 | 19
0626-004592 | DP IPANEMA 1 | ponto de tomada geladeira | ELETRICA | 1599.18 | LEANDRO | FECHAR OS | FINALIZADO | Orçamento Aprovado | 2026-08-06 | 19
0726-013344 | DP IPANEMA 6 | cabo de rede impressora | ELETRICA | 1581.27 | LEANDRO | FATURADO | FINALIZADO | Resolvido |  |
0526-018145 | DP PELINCA | Substituição da pia da copa. | CIVIL | 1578.6 | LEANDRO | FECHAR OS | FINALIZADO | Orçamento Aprovado | 2026-08-06 | 19
0626-005012 | LEBLON ATAULFO 80 | portinha para hidrômetro | CIVIL | 1568.93 | ALINE | PENDENTE FATURAMENTO | FINALIZADO | Resolvido | 2026-07-15 | 41
0726-012450 | DP SHOPPING BARRA SHOPPING | pintura do salão | CIVIL | 1524 | LEANDRO | PENDENTE FATURAMENTO | FINALIZADO | Resolvido | 2026-08-06 | 19
0326-012395 | DP SENADOR DANTAS 2 | fixação de projetor e tela | CIVIL | 1519.42 | LEANDRO | PENDENTE FATURAMENTO | FINALIZADO | Resolvido | 2026-05-05 | 112
0626-008826 | DP TIJUCA 8 | Tranferencia tinta Itaperuna | TRANSPORTE | 1450 | JUAN | FECHAR OS | FINALIZADO | Orçamento Aprovado | 2026-08-13 | 12
0826-004183 | DP RECREIO 1 | Forro marquise | CIVIL | 1389.34 | JUAN | FECHAR OS | FINALIZADO | Orçamento Aprovado | 2026-08-17 | 8
0726-009429 | DP COPACABANA BARATA RIBEIRO | vazamento no salão | HIDRAULICA | 1380.2 | LEANDRO | FATURADO | FINALIZADO | Resolvido | 2026-07-20 | 36
0626-004728 | DP RECREIO 1 | mureta estacionamento | CIVIL | 1306.35 | JUAN | PENDENTE FATURAMENTO | FINALIZADO | Resolvido | 2026-06-13 | 73
0626-010287 | DP CATETE 5 | PINTURA PARADE HUB | CIVIL | 1302.6 | LEANDRO | FECHAR OS | FINALIZADO | Orçamento Aprovado | 2026-08-06 | 19
0626-003845 | DP RIO BRANCO 2 | porta 3 desalinhada | SERRALHERIA | 1300.66 | LEANDRO | MAU USO - APROVAR OS | FINALIZADO | Aguardando Aprovação | 2026-06-01 | 85
0626-004183 | DP ICARAI 2 | tomada para projetor | ELETRICA | 1294.18 | AMANDA | PENDENTE FATURAMENTO | FINALIZADO | Resolvido | 2026-08-06 | 19
0126-011045 | DP MEIER 9 | INSTALAÇÃO DE CORTINA DE AR | CLIMATIZAÇÃO | 1278.62 | ALINE | PENDENTE FATURAMENTO | FINALIZADO | Resolvido | 2026-02-11 | 195
0726-010838 | DP IPANEMA 1 | 3 novas cortinas de ar. | REFRIGERAÇÃO | 1080 | LEANDRO | FATURADO | FINALIZADO | Resolvido | 2026-07-15 | 41
0726-009420 | DP RECREIO 1 | RETIRADA ENTULHO | CIVIL | 998.4 | JUAN | PENDENTE FATURAMENTO | FINALIZADO | Resolvido | 2026-08-08 | 17
0626-010067 | DP MARICA 2 | detetizacao no armário | DEDETIZAÇÃO | 960 | AMANDA | PENDENTE FATURAMENTO | FINALIZADO | Resolvido | 2026-07-14 | 42
0526-016210 | DP RIO BRANCO 2 | 2 espelhos convexos | CIVIL | 960 | LEANDRO | FATURADO | FINALIZADO | Resolvido |  |
0726-010576 | DP COPACABANA BARATA RIBEIRO | desratização | DEDETIZAÇÃO | 960 | LEANDRO | PENDENTE FATURAMENTO | FINALIZADO | Resolvido | 2026-07-27 | 29
0626-006804 | DP IPANEMA 8 | dedetização, baratas | DEDETIZAÇÃO | 960 | LEANDRO | FECHAR OS | FINALIZADO | Orçamento Aprovado | 2026-08-06 | 19
0726-015564 | DP BARRA DA TIJUCA 4 | dedetização e desratização | DEDETIZAÇÃO | 960 | LEANDRO | FECHAR OS | FINALIZADO | Orçamento Aprovado | 2026-08-07 | 18
0726-009288 | PLAZA MACAE | dedetização, rato na loja | DEDETIZAÇÃO | 960 | LEANDRO | EXECUTADO - APROVAR OS | FINALIZADO | Aguardando Aprovação | 2026-08-06 | 19
0626-005882 | DP IGUABA | Transporte de geladeira | TRANSPORTE | 900 | LEANDRO | FECHAR OS | FINALIZADO | Orçamento Aprovado | 2026-08-06 | 19
0726-013342 | DP CATETE 5 | cabo de rede impressora | ELETRICA | 871.47 | LEANDRO | FECHAR OS | FINALIZADO | Orçamento Aprovado | 2026-08-06 | 19
0726-015741 | DP CASCADURA 2 | Frete geladeira | TRANSPORTE | 864.5 | ALINE | PENDENTE FATURAMENTO | FINALIZADO | Resolvido | 2026-08-10 | 15
0726-015769 | DP PENHA 5 | Frete geladeira | TRANSPORTE | 864.5 | ALINE | PENDENTE FATURAMENTO | FINALIZADO | Resolvido | 2026-08-10 | 15
0726-015768 | DP PENHA 4 | Frete geladeira | TRANSPORTE | 864.5 | ALINE | PENDENTE FATURAMENTO | FINALIZADO | Resolvido | 2026-08-10 | 15
0726-015770 | DP ABOLIÇÃO | Frete geladeira | TRANSPORTE | 864.5 | AMANDA | PENDENTE FATURAMENTO | FINALIZADO | Resolvido | 2026-08-10 | 15
0326-015760 | DP ROCINHA | placa de sinalização | EQUIPAMENTO | 835.78 | LEANDRO | PENDENTE FATURAMENTO | FINALIZADO | Resolvido | 2026-07-15 | 41
0726-011513 | DP VARGEM GRANDE | armario da cozinha enferrujado | EQUIPAMENTO | 800 | JUAN | FECHAR OS | FINALIZADO | Orçamento Aprovado | 2026-07-16 | 40
0326-009215 | DP GLORIA | tomada 220v na cozinha | ELETRICA | 786.06 | LEANDRO | PENDENTE FATURAMENTO | FINALIZADO | Resolvido | 2026-04-15 | 132
0626-008580 | DP SHOPPING BARRA SHOPPING | pintura da vitrine | CIVIL | 759.5 | LEANDRO | FATURADO | FINALIZADO | Resolvido | 2026-07-15 | 41
0826-004406 | DP LEBLON 4 | bomba de esgoto | CIVIL | 759.5 | LEANDRO | FECHAR OS | FINALIZADO | Orçamento Aprovado | 2026-08-07 | 18
0426-013233 | DP CATETE 5 | remoção de material | CIVIL | 648.8 | LEANDRO | FECHAR OS | FINALIZADO | Orçamento Aprovado | 2026-08-06 | 19
0726-018751 | DP LARGO DA BATALHA | reparo da parede de MDF | CIVIL | 644.46 | AMANDA | FECHAR OS | FINALIZADO | Orçamento Aprovado | 2026-08-11 | 14
0326-014135 | DP RIO BRANCO | tomada da sala não funciona | ELETRICA | 619.42 | LEANDRO | EXECUTADO - APROVAR OS | FINALIZADO | Aguardando Aprovação | 2026-03-22 | 156
0326-008067 | DP BARRA DA TIJUCA 4 | cadeado porta número 05 | SERRALHERIA | 526.98 | LEANDRO | MAU USO - APROVAR OS | FINALIZADO | Aguardando Aprovação | 2026-03-09 | 169
0526-019340 | DP PADRE MIGUEL | 08 BRAÇO DE MONITOR | CIVIL | 500.63 | JUAN | FECHAR OS | FINALIZADO | Orçamento Aprovado | 2026-06-05 | 81
0726-012912 | DP LUCIO COSTA | retirada luminarias | TRANSPORTE | 500 | JUAN | PENDENTE FATURAMENTO | FINALIZADO | Resolvido | 2026-08-08 | 17
0726-012445 | DP ROCINHA | Transporte de longarina | TRANSPORTE | 500 | LEANDRO | PENDENTE FATURAMENTO | FINALIZADO | Resolvido | 2026-07-15 | 41
0626-010405 | DP SHOPPING BARRA SHOPPING | bebedouro da copa | EQUIPAMENTO | 500 | LEANDRO | FATURADO | FINALIZADO | Resolvido | 2026-07-15 | 41
0726-019313 | DP RECREIO 8 | Frete geladeira recreio 6 | TRANSPORTE | 500 | JUAN | FECHAR OS | FINALIZADO | Orçamento Aprovado | 2026-08-13 | 12
0626-012206 | DP SENADOR DANTAS 1 | fechadura de armários do PC | SERRALHERIA | 400 | LEANDRO | FECHAR OS | FINALIZADO | Orçamento Aprovado | 2026-08-07 | 18
0626-010686 | DP ARARUAMA 2 | chave da porta quebrou | SERRALHERIA | 375.66 | LEANDRO | FATURADO | FINALIZADO | Resolvido | 2026-07-16 | 40
0326-009444 | DP PETROPOLIS 2 | tambor da porta de vidro | SERRALHERIA | 351.32 | AMANDA | MAU USO - APROVAR OS | FINALIZADO | Aguardando Aprovação | 2026-03-09 | 169
0226-015820 | DP IPANEMA 3 | chave quebrada dentro do tambor | SERRALHERIA | 351.32 | LEANDRO | MAU USO - APROVAR OS | FINALIZADO | Aguardando Aprovação | 2026-03-04 | 174
0426-013945 | DP COPACABANA 8 | Tambor travado quebrado | SERRALHERIA | 351.32 | LEANDRO | MAU USO - APROVAR OS | FINALIZADO | Aguardando Aprovação | 2026-04-27 | 120
0526-016422 | DP GLORIA | chave do tambor quebrou | SERRALHERIA | 325.66 | LEANDRO | MAU USO - APROVAR OS | FINALIZADO | Aguardando Aprovação | 2026-05-22 | 95
0526-017199 | DP BACAXA | chave da porta quebrada | SERRALHERIA | 325.66 | LEANDRO | MAU USO - APROVAR OS | FINALIZADO | Aguardando Aprovação | 2026-05-24 | 93
0726-019101 | DP RECREIO 7 | Placa estacionamento | CIVIL | 256.23 | JUAN | PENDENTE FATURAMENTO | FINALIZADO | Resolvido | 2026-08-17 | 8
0226-011039 | DP SAO GONCALO 1 | chave quebrada no tambor | SERRALHERIA | 175.66 | AMANDA | MAU USO - APROVAR OS | FINALIZADO | Aguardando Aprovação | 2026-02-26 | 180
0326-018781 | DP SAO GONCALO 1 | Chave tambor 4 quebrada | SERRALHERIA | 175.66 | AMANDA | MAU USO - APROVAR OS | FINALIZADO | Aguardando Aprovação | 2026-03-27 | 151
0426-008162 | DP RECREIO 6 | tambor para as 2 laterais | SERRALHERIA | 175.66 | JUAN | MAU USO - APROVAR OS | FINALIZADO | Aguardando Aprovação | 2026-04-27 | 120
0426-017866 | DP SAO GONCALO 1 | tambor quebrada antes de abrir | SERRALHERIA | 175.66 | AMANDA | MAU USO - APROVAR OS | FINALIZADO | Aguardando Aprovação | 2026-05-12 | 105
0526-008051 | DP SAO GONCALO 3 | porta principal de aço | SERRALHERIA | 175.66 | AMANDA | MAU USO - APROVAR OS | FINALIZADO | Aguardando Aprovação | 2026-05-12 | 105
0526-013041 | DP RIO BONITO | portado meio de loja quebrada | SERRALHERIA | 175.66 | AMANDA | MAU USO - APROVAR OS | FINALIZADO | Aguardando Aprovação | 2026-05-13 | 104
0526-018908 | DP SAO GONCALO 5 | chave da porta 3 quebrou | SERRALHERIA | 175.66 | AMANDA | MAU USO - APROVAR OS | FINALIZADO | Aguardando Aprovação | 2026-05-29 | 88
0526-018202 | DP RECREIO 1 | tambor da porta principal | SERRALHERIA | 175.66 | JUAN | MAU USO - APROVAR OS | FINALIZADO | Aguardando Aprovação | 2026-06-30 | 56
0526-019463 | DP COPACABANA 8 | tambor danificado | SERRALHERIA | 175.66 | LEANDRO | MAU USO - APROVAR OS | FINALIZADO | Aguardando Aprovação | 2026-05-31 | 86
0626-006632 | DP CATETE 3 | chave quebrou dentro do tambor | SERRALHERIA | 175.66 | LEANDRO | MAU USO - APROVAR OS | FINALIZADO | Aguardando Aprovação | 2026-06-28 | 58
0526-019250 | DP BOTAFOGO 7 | Chave quebrada no Tambor | SERRALHERIA | 175.66 | LEANDRO | MAU USO - APROVAR OS | FINALIZADO | Aguardando Aprovação | 2026-06-28 | 58
0126-020540 | DP RECREIO 1 | Chave do estoque quebrou | SERRALHERIA | 165.89 | JUAN | MAU USO - APROVAR OS | FINALIZADO | Aguardando Aprovação | 2026-02-12 | 194
0826-005453 | DP LUCIO COSTA | manobras hidraulicas | HIDRAULICA |  | JUAN | EXECUTADO - APROVAR OS | FINALIZADO | Aguardando Atendimento | 2026-08-14 | 11
0626-006359 | DP ICARAI 13 | TROCA DE BOMBA | HIDRAULICA |  | AMANDA | FECHAR OS | FINALIZADO | Aguardando Atendimento | 2026-08-10 | 15
0826-007431 | DP PETROPOLIS 4 | pintura da retaguarda visita Presidente | CIVIL |  | AMANDA | EXECUTAR | FINALIZADO | Aguardando Atendimento | 2026-08-14 | 11
0826-008617 | DP RECREIO 8 | caminhão pipa falta de água | HIDRAULICA | 4000 | JUAN | FECHAR OS | FINALIZADO | Orçamento Aprovado | 2026-08-14 | 11
0826-007222 | DP ICARAI 13 | caminhão pipa falta de água | HIDRAULICA | 2000 | AMANDA | EXECUTADO - APROVAR OS | FINALIZADO | Aguardando Atendimento | 2026-08-14 | 11
0826-005884 | DP BARRA DA TIJUCA 5 | desentupimento do esgoto | HIDRAULICA |  | LEANDRO | EXECUTADO - APROVAR OS | FINALIZADO | Aguardando Atendimento | 2026-08-14 | 11
SEM OS | DP BARRA DA TIJUCA 5 | desentupimento do esgoto | HIDRAULICA |  | LEANDRO | EXECUTADO - APROVAR OS | FINALIZADO | Aguardando Atendimento | 2026-08-14 | 11
0826-006643 | DP TIJUCA 8 | limpeza de cx agua emergencial | HIDRAULICA |  | JUAN | EXECUTADO - APROVAR OS | FINALIZADO | Aguardando Atendimento | 2026-08-14 | 11
0826-009258 | DP RECREIO 7 | Filial sem agua | HIDRAULICA | 2000 | JUAN | FECHAR OS | FINALIZADO | Orçamento Aprovado | 2026-08-17 | 8
0826-009507 | DP GILKA MACHADO | Tentativa de invasão | CIVIL | 845.7 | JUAN | EXECUTADO - APROVAR OS | FINALIZADO | Aguardando Aprovação | 2026-08-14 | 11
0726-010193 | DPA PETROPOLIS 6 | parede danificada | CIVIL |  | AMANDA | EXECUTAR - APROVAR OS | EM ANDAMENTO | Aguardando Atendimento | 2026-08-17 | 8
0826-004428 | DP PETROPOLIS 5 | Mão de obra para pintura da fachada | CIVIL |  | AMANDA | EXECUTAR - APROVAR OS | EM ANDAMENTO | Aguardando Atendimento | 2026-08-17 | 8
0826-004429 | DP PETROPOLIS 6 | Mão de obra para pintura da fachada | CIVIL |  | AMANDA | EXECUTAR - APROVAR OS | EM ANDAMENTO | Aguardando Atendimento | 2026-08-17 | 8
1142 |  | Caminhão Pipa (09/07) | HIDRAULICA |  |  | EXECUTADO - APROVAR OS | FINALIZADO | Aguardando Atendimento | 2026-07-09 | 47
17769 |  | Caminhão Pipa (28/7) | HIDRAULICA |  |  | EXECUTADO - APROVAR OS | FINALIZADO | Aguardando Atendimento | 2026-07-28 | 28
SEM OS | DP NITEROI | mau uso constatado, OS 0826-011696 |  |  | AMANDA | MAU USO - APROVAR OS | FINALIZADO |  | 2026-08-22 | 3
SEM OS | DP BOTAFOGO 8 | mau uso constatado, OS 0826-011837 |  |  | LEANDRO | MAU USO - APROVAR OS | FINALIZADO |  | 2026-08-23 | 2
0826-006580 | DP ICARAI 5 | instalação de tomadas 220 | ELETRICA | 1.205,50 | AMANDA | EXECUTADO - APROVAR OS | FINALIZADO | Aguardando Aprovação | 2026-08-05 | 20
0826-004503 | DP MARICA 2 | ponto 110v geladeira | ELETRICA | 1726.48 | AMANDA | EXECUTADO - APROVAR OS | FINALIZADO | Aguardando Aprovação | 2026-08-04 | 21
0826-008374 | DP RECREIO 7 | dedetização e limpeza caixa d'água | DEDETIZAÇÃO | 1959.86 | JUAN | EXECUTAR | NÃO INICIADO | Aguardando Aprovação | 2026-08-17 | 8
0826-006878 | DP TERESOPOLIS 1 | tomada 220v na cozinha | ELETRICA | 1663.4 | AMANDA | EXECUTADO - APROVAR OS | FINALIZADO | Aguardando Aprovação | 2026-07-30 | 26
0826-008478 | DP COPACABANA 12 | porta de aço, chave quebrou | SERRALHERIA | 570.91 | LEANDRO | EXECUTADO - APROVAR OS | FINALIZADO | Aguardando Aprovação | 2026-08-14 | 11
0826-008471 | DP CURICICA | chave quebrou dentro do tambor | SERRALHERIA | 653.8 | JUAN | EXECUTAR - APROVAR OS | NÃO INICIADO | Aguardando Aprovação | 2026-08-13 | 12
0826-007943 | DP NITEROI 4 | tomada para geladeira | ELETRICA | 1422.8 | AMANDA | EXECUTADO - APROVAR OS | FINALIZADO | Aguardando Aprovação | 2026-08-01 | 24
0826-007936 | DP BACAXA 2 | tomada 127 volts geladeira | ELETRICA | 1648.8 | LEANDRO | EXECUTAR - APROVAR OS | NÃO INICIADO | Aguardando Aprovação | 2026-08-01 | 24
0826-007682 | DP CABO FRIO 4 | tomada para geladeira extra | ELETRICA | 1648.8 | LEANDRO | EXECUTAR - APROVAR OS | NÃO INICIADO | Aguardando Aprovação | 2026-08-13 | 12
0826-007642 | DP BUZIOS 2 | tomada para geladeira 110v. | ELETRICA | 1648.8 | LEANDRO | EXECUTAR - APROVAR OS | NÃO INICIADO | Aguardando Aprovação | 2026-08-04 | 21
0826-007499 | DP SAO GONCALO 5 | tomada geladeira 110v/220v | ELETRICA | 1648.8 | AMANDA | EXECUTAR - APROVAR OS | NÃO INICIADO | Aguardando Aprovação | 2026-08-03 | 22
0826-006948 | DP PETROPOLIS 5 | novo ponto de tomada geladeira | ELETRICA | 1663.4 | AMANDA | EXECUTADO - APROVAR OS | FINALIZADO | Aguardando Aprovação | 2026-07-30 | 26
0826-0011526 | DP BARRA DA TIJUCA 5 | Pintura de Fachada | CIVIL |  | LEANDRO | EXECUTAR - APROVAR OS | NÃO INICIADO | Aguardando Atendimento | 2026-08-21 | 4
SEM OS | DP BACAXÁ 01 | mau uso constatado, OS 0826-011936 |  |  | LEANDRO | MAU USO - APROVAR OS | FINALIZADO |  | 2026-08-23 | 2
0726-009318 | DP CURICICA |  |  |  | JUAN | EXECUTAR | NÃO INICIADO | Aguardando Atendimento |  |
0826-011838 | DP ALCÂNTARA 3 |  |  |  | AMANDA | EXECUTAR | NÃO INICIADO | Aguardando Aprovação |  |
`
  .trim()
  .split('\n')

const linhasPipelineReais: LinhaBrutaObras[] = PIPELINE_TEXTO.map((texto, idx) => ({
  numeroLinha: idx + 4,
  valores: texto.split(' | '),
}))

// As 19 obras ativas + a linha 24 (molde vazio). Datas de cronograma usam o
// texto exatamente como ele aparece no cache de fórmula do dump (ver seção 4
// acima para a prova de que paraDataIso entende esse formato).
const PLANEJAMENTO_ROWS: string[][] = [
  ['Normal','0226-014989','DP BAIRRO DE FATIMA','Boa tarde!Forro do estoque caiu .','TELHADO','28520.46','LEANDRO','YURI','MANFAC-7','Sistema DPSP','Executar','Em andamento','Disponibilidade de equipe','0','2026-07-06','2026-07-20','Tue Aug 18 2026 21:00:00 GMT-0300 (Horário Padrão de Brasília)','Tue Aug 25 2026 21:00:00 GMT-0300 (Horário Padrão de Brasília)','2026-08-19','','','','','Aguardando finalização de serviço TMO 107. Nova posição 24/08','YURI','2026-08-24','Atualzar e desiguinar data para execução','2026-08-24','2026-08-20',''],
  ['Normal','0526-013745','DP LUCIO COSTA','Caminho Cliente - Pintura Fachada e benfeitorias externas','CIVIL','29795.5','JUAN','YURI','DEFINIR','Sistema DPSP','Executar','Paralisado','Cliente / loja','0','','','Fri Dec 29 1899 20:53:32 GMT-0306 (Horário Padrão de Brasília)','Fri Dec 29 1899 20:53:32 GMT-0306 (Horário Padrão de Brasília)','','','','','','Aguardando chegar tinta','YURI','','Cobrar chegada de tinta','2026-08-24','2026-08-20',''],
  ['Normal','0526-013743','DP PEDRA DE GUARATIBA','Caminho Cliente - Pintura Fachada e benfeitorias externas','CIVIL','28050.15','JUAN','YURI','DEFINIR','Sistema DPSP','Executar','Paralisado','Clima','0','2026-08-18','2026-09-01','Mon Aug 17 2026 21:00:00 GMT-0300 (Horário Padrão de Brasília)','Mon Aug 31 2026 21:00:00 GMT-0300 (Horário Padrão de Brasília)','','','','','','Aguardando estabilidade de clima. Projetar data de início e final','YURI','2026-08-24','','',''],
  ['Normal','0226-005730','DP BARRA DE SAO JOAO','infiltração na área de vendas','TELHADO','35706.12','LEANDRO','YURI','ERLI/RICARDO','Sistema DPSP','Executar','Em andamento','Clima','0.9','2026-07-13','2026-07-17','Sun Aug 02 2026 21:00:00 GMT-0300 (Horário Padrão de Brasília)','Sun Aug 16 2026 21:00:00 GMT-0300 (Horário Padrão de Brasília)','','','','','','','','','','',''],
  ['Normal','GARANTIA','DP CABO FRIO 4','GARANTIA DE TELHADO','TELHADO','','AMANDA','LUANA','MANFAC-4 / MANFAC-7','Garantia','Executar','Paralisado','Disponibilidade de equipe','0','2026-07-09','2026-07-15','Wed Jul 08 2026 21:00:00 GMT-0300 (Horário Padrão de Brasília)','Tue Jul 14 2026 21:00:00 GMT-0300 (Horário Padrão de Brasília)','','','','','','Pendente liberação do prestador. Outras obras acontecendo','LUANA','','Verificar disponibilidade do prestador','','2026-08-20',''],
  ['Normal','0226-011320','DP PRACA DO O','loja com infiltração','TELHADO','18919.37','LEANDRO','YURI','ALEX','Sistema DPSP','Executar','Paralisado','Disponibilidade de equipe','0.2','2026-07-20','2026-08-10','Sun Aug 23 2026 21:00:00 GMT-0300 (Horário Padrão de Brasília)','Sun Aug 30 2026 21:00:00 GMT-0300 (Horário Padrão de Brasília)','','','','','','Necessário trocar prestador. Alex irá pegar obra PLK','YURI','2026-08-25','','',''],
  ['Normal','0526-013772','DP NILOPOLIS 4','Caminho Cliente - Pintura fachada e benfeitorias externas','CIVIL','33356.92','JUAN','YURI','MANFAC-19','Sistema DPSP','Executar','Paralisado','Cliente / loja','0.1','2026-07-10','2026-07-23','Fri Dec 29 1899 20:53:32 GMT-0306 (Horário Padrão de Brasília)','Fri Dec 29 1899 20:53:32 GMT-0306 (Horário Padrão de Brasília)','','','','','','Juan solicitou paralisaçõa','DPSP','','Acompanhar liberação','2026-08-27',''],
  ['Normal','0526-013724','DP NILOPOLIS 5','Caminho Cliente - Pintura fachada e benfeitorias externas','CIVIL','35399.8','JUAN','YURI','ALEXANDRE','Sistema DPSP','Executar','Em andamento','Sem bloqueio','0.5','2026-07-24','2026-08-08','Wed Aug 12 2026 21:00:00 GMT-0300 (Horário Padrão de Brasília)','Sun Aug 30 2026 21:00:00 GMT-0300 (Horário Padrão de Brasília)','','','','','','PAGAMENTO ART e ANDAIME 8M','FINANCEIRO','2026-08-18','','',''],
  ['Normal','0226-013174','DP COPACABANA 8','vazamento na área de vendas','HIDRAULICA','6738.1','LEANDRO','AMANDA','MANFAC-6','Sistema DPSP','Executar','Paralisado','Cliente / loja','0','2026-07-13','2026-07-15','Sun Jul 12 2026 21:00:00 GMT-0300 (Horário Padrão de Brasília)','Tue Jul 14 2026 21:00:00 GMT-0300 (Horário Padrão de Brasília)','','','','','','Aguardando liberação da gerente para escolha de data','AMANDA','','','',''],
  ['Normal','0626-014071','DP MAGE 1','fossa com cheiro forte','HIDRAULICA','2924.98','AMANDA','AMANDA','MANFAC-4/PARCEIRO','Sistema DPSP','Executar','Paralisado','Contratação de prestador','0','2026-07-27','2026-07-31','Sun Jul 26 2026 21:00:00 GMT-0300 (Horário Padrão de Brasília)','Thu Jul 30 2026 21:00:00 GMT-0300 (Horário Padrão de Brasília)','','','','','','Aguardando escolha de novo prestador','AMANDA','','','',''],
  ['Normal','0426-009327','DP COPACABANA 6','portais não fecham','CIVIL','1886.4','LEANDRO','AMANDA','MANFAC-6','Sistema DPSP','Executar','Levantamento / planejamento','Sem bloqueio','','2026-08-12','2026-08-14','Tue Aug 11 2026 21:00:00 GMT-0300 (Horário Padrão de Brasília)','Thu Aug 13 2026 21:00:00 GMT-0300 (Horário Padrão de Brasília)','','','','','','Finalizar levantamento, solicitar orçamento, programar data','AMANDA','','','',''],
  ['Normal','0526-019295','DP BARRA DA TIJUCA 5','desentupimento do esgoto','HIDRAULICA','4791.2','LEANDRO','AMANDA','MANFAC-6','Sistema DPSP','Executar','Levantamento / planejamento','Sem bloqueio','','2026-08-03','2026-08-07','Sun Aug 02 2026 21:00:00 GMT-0300 (Horário Padrão de Brasília)','Thu Aug 06 2026 21:00:00 GMT-0300 (Horário Padrão de Brasília)','','','','','','Finalizar levantamento, solicitar orçamento, programar data','AMANDA','','','',''],
  ['Urgente','0826-004428','DP PETROPOLIS 5','Mão de obra para pintura da fachada','CIVIL','','AMANDA','YURI','MANFAC-27','Sistema DPSP','Executar','Em andamento','Sem bloqueio','95','2026-08-17','2026-08-24','Sun Aug 16 2026 21:00:00 GMT-0300 (Horário Padrão de Brasília)','Sun Aug 23 2026 21:00:00 GMT-0300 (Horário Padrão de Brasília)','','','','','','','','','','',''],
  ['Urgente','0826-004429','DP PETROPOLIS 6','Mão de obra para pintura da fachada','CIVIL','','AMANDA','YURI','MANFAC-19','Sistema DPSP','Executar','Em andamento','Sem bloqueio','1','2026-08-17','2026-08-24','Sun Aug 16 2026 21:00:00 GMT-0300 (Horário Padrão de Brasília)','Sun Aug 23 2026 21:00:00 GMT-0300 (Horário Padrão de Brasília)','','','','','','','','','','',''],
  ['Urgente','0826-007431','DP PETROPOLIS 4','pintura da retaguarda visita Presidente','CIVIL','','AMANDA','YURI','MANFAC-26','Sistema DPSP','Executar','Em andamento','Sem bloqueio','0.9','2026-08-17','2026-08-24','Sun Aug 16 2026 21:00:00 GMT-0300 (Horário Padrão de Brasília)','Sun Aug 23 2026 21:00:00 GMT-0300 (Horário Padrão de Brasília)','','','','','','','','','','',''],
  ['Normal','0626-008727','DP ITABORAI','tela milimétrica e grade','SERRALHERIA','2922.24','AMANDA','AMANDA','DEFINIR','Sistema DPSP','Executar','Levantamento / planejamento','Sem bloqueio','','','','Fri Dec 29 1899 20:53:32 GMT-0306 (Horário Padrão de Brasília)','Fri Dec 29 1899 20:53:32 GMT-0306 (Horário Padrão de Brasília)','','','','','','Finalizar levantamento, solicitar orçamento, programar data','AMANDA','','','',''],
  ['Normal','0626-008725','DP ITABORAI','Reparo da parede do vestiário feminino','CIVIL','3922.64','AMANDA','AMANDA','DEFINIR','Sistema DPSP','Executar','Levantamento / planejamento','Sem bloqueio','','','','Fri Dec 29 1899 20:53:32 GMT-0306 (Horário Padrão de Brasília)','Fri Dec 29 1899 20:53:32 GMT-0306 (Horário Padrão de Brasília)','','','','','','Finalizar levantamento, solicitar orçamento, programar data','AMANDA','','','',''],
  ['Normal','0126-018429','DP RECREIO 7','água minando das paredes','CIVIL','17702.92','JUAN','YURI','ALEX','Garantia','Executar','Levantamento / planejamento','Sem bloqueio','','','','Fri Dec 29 1899 20:53:32 GMT-0306 (Horário Padrão de Brasília)','Fri Dec 29 1899 20:53:32 GMT-0306 (Horário Padrão de Brasília)','','','','','','','','','','',''],
  ['Normal','0626-014568','DP GILKA MACHADO','descaracterizacao de fachada','CIVIL','5070.52','JUAN','AMANDA','DEFINIR','Sistema DPSP','Executar','Levantamento / planejamento','Sem bloqueio','','','','Fri Dec 29 1899 20:53:32 GMT-0306 (Horário Padrão de Brasília)','Fri Dec 29 1899 20:53:32 GMT-0306 (Horário Padrão de Brasília)','','','','','','Finalizar levantamento, solicitar orçamento, programar data','AMANDA','','','',''],
  Array(30).fill(''), // linha 24 — molde vazio
]

const linhasPlanejamentoReais: LinhaBrutaObras[] = PLANEJAMENTO_ROWS.map((valores, idx) => ({
  numeroLinha: idx + 5,
  valores,
}))

describe('montarImportacao — ponta a ponta com o dado real completo (187 + 20)', () => {
  const resultado = montarImportacao(linhasPipelineReais, linhasPlanejamentoReais)

  it('lê as 187 linhas da Pipeline e as 20 da Planejamento (19 obras + molde)', () => {
    expect(resultado.linhasLidasPipeline).toBe(187)
    expect(resultado.linhasLidasPlanejamento).toBe(20)
  })

  it('descarta só a linha-molde da Planejamento (linha 24)', () => {
    expect(resultado.descartadas).toEqual([{ origem: 'planejamento', linha: 24, motivo: 'sem Nº OS e sem Loja' }])
  })

  it('as 22 obras MAU USO seguem marcadas depois do merge com a Planejamento', () => {
    expect(resultado.obras.filter((o) => o.mau_uso).length).toBe(22)
  })

  it('a obra GARANTIA existe mesmo sem Nº OS — só ela veio pela Planejamento', () => {
    const garantia = resultado.obras.find((o) => o.loja === 'DP CABO FRIO 4' && o.descricao === 'GARANTIA DE TELHADO')
    expect(garantia).toBeDefined()
    expect(garantia?.os).toBeNull()
  })

  it('a Planejamento sobrescreve a etapa da Pipeline na obra que aparece nas duas (0226-014989: FATURADO na Pipeline, "Em andamento" na Planejamento)', () => {
    const obra = resultado.obras.find((o) => o.os === '0226-014989')
    expect(obra).toBeDefined()
    expect(obra?.etapa).toBe('andamento')
    expect(obra?.pcm).toBe('YURI') // só a Planejamento tem PCM — prova que o merge aconteceu
  })

  it('as 4 obras "SEM OS" da Pipeline não colidem entre si — todas presentes', () => {
    const semOs = resultado.obras.filter((o) => o.os === null)
    const lojasSemOs = semOs.map((o) => o.loja)
    expect(lojasSemOs).toEqual(
      expect.arrayContaining(['DP BARRA DA TIJUCA 5', 'DP NITEROI', 'DP BOTAFOGO 8', 'DP BACAXÁ 01', 'DP CABO FRIO 4'])
    )
  })

  it('não sobra nenhuma obra sem etapa (default definir aplicado)', () => {
    expect(resultado.obras.every((o) => typeof o.etapa === 'string' && o.etapa.length > 0)).toBe(true)
  })
})

describe('camposParaAtualizar — reimportar não pode desfazer o que foi digitado no app', () => {
  it('não sobrescreve com null o que a aba não tem', () => {
    // A Pipeline não tem pcm, equipe, bloqueio, pendência: manda null em todos.
    // Um update cru apagaria a triagem inteira da obra.
    const saida = camposParaAtualizar({
      os: '3762',
      loja: 'DP NILOPOLIS 5',
      pcm: null,
      equipe: null,
      bloqueio: null,
      pendencia: undefined,
    })

    expect(saida).toEqual({ os: '3762', loja: 'DP NILOPOLIS 5' })
  })

  it('deixa a planilha corrigir o que ela realmente tem', () => {
    const saida = camposParaAtualizar({ loja: 'DP PETROPOLIS 5', valor: 48000, duracao: 12 })

    expect(saida).toEqual({ loja: 'DP PETROPOLIS 5', valor: 48000, duracao: 12 })
  })

  it('nunca reescreve etapa nem mau_uso — quem move a obra é a tela', () => {
    // Status em branco na planilha vira etapa 'definir'. Sem esta regra, reimportar
    // devolveria para a fila do Yuri toda obra que a equipe já tinha triado.
    const saida = camposParaAtualizar({ os: '3762', etapa: 'definir', mau_uso: false })

    expect(saida).toEqual({ os: '3762' })
  })

  it('valor falso que não é null continua passando (0, string vazia não existe aqui)', () => {
    const saida = camposParaAtualizar({ valor: 0, duracao: 0 })

    expect(saida).toEqual({ valor: 0, duracao: 0 })
  })
})
