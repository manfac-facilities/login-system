export type ServicoData = {
  slug: string
  nome: string
  headline: string
  sub: string
  paraQuem: string
  dores: string
  escopo: string[]
  comoExecutamos: string
  indicadores: { value: string; label: string }[]
  recorrente: string
  spot: string
  foto: string
  fotoAlt: string
  metaTitle: string
  metaDescription: string
}

export const SERVICOS_DATA: ServicoData[] = [
  {
    slug: 'obras-e-reformas',
    nome: 'Obras e Reformas Corporativas',
    headline: 'Obras e reformas corporativas com escopo, cronograma, equipe própria e acompanhamento de ponta a ponta.',
    sub: 'Reformas corporativas de diferentes portes, com planejamento, equipe técnica e gestão próxima — sem paralisar a operação do cliente.',
    paraQuem: 'Empresas com unidades corporativas, redes de varejo, escritórios, galpões e hospitais que precisam reformar, adequar ou expandir sem interromper a operação.',
    dores: 'Obra atrasada sem explicação · custo que estoura sem aviso · operação paralisada durante a execução · vários responsáveis e nenhum dono do resultado.',
    escopo: [
      'Reformas de layout, fachada e adequação civil',
      'Expansão de unidades e retrofit predial',
      'Cumprimento de normas técnicas e exigências legais',
      'Relatório semanal de andamento — sem precisar pedir',
      'Um ponto de contato responsável do início à entrega',
    ],
    comoExecutamos: 'Planejamento com escopo fechado, cronograma real e orçamento definido; execução com equipe própria e supervisão técnica; comunicação recorrente com registro fotográfico até a entrega.',
    indicadores: [
      { value: '+R$800 mil', label: 'em obras e reformas por mês' },
      { value: '400+', label: 'unidades atendidas no RJ' },
    ],
    recorrente: 'Pequenas adequações e reparos contínuos podem entrar na rotina do contrato mensal de manutenção.',
    spot: 'Reformas, expansões e adequações maiores viram proposta técnica avulsa, com escopo, cronograma e orçamento fechados.',
    foto: '/media/v03-obra-corporativa.jpg',
    fotoAlt: 'Obra corporativa em execução com estrutura e andaimes',
    metaTitle: 'Obras e Reformas Corporativas — Manfac Engenharia',
    metaDescription: 'Obras e reformas corporativas com escopo fechado, cronograma, equipe própria e acompanhamento de ponta a ponta, sem paralisar sua operação.',
  },
  {
    slug: 'novas-construcoes',
    nome: 'Novas Construções',
    headline: 'Do zero à entrega das chaves — prazo e custo sob controle.',
    sub: 'Gestão completa de novas construções: do planejamento à entrega, com equipe técnica própria em campo, cronograma real e comunicação recorrente.',
    paraQuem: 'Empresas que precisam construir novas unidades, centros de distribuição ou instalações corporativas com um único responsável técnico do projeto à entrega.',
    dores: 'Projetos que mudam de mão no meio do caminho · orçamento sem dono · cronograma que ninguém audita · entrega sem documentação.',
    escopo: [
      'Gestão completa do projeto de engenharia',
      'Equipe técnica própria com gestão centralizada',
      'Controle rigoroso de cronograma e custo',
      'Visibilidade do andamento em tempo real',
      'Entrega com documentação e comissionamento',
    ],
    comoExecutamos: 'Planejamento executivo com marcos de entrega; execução com equipe própria e supervisão de engenharia; reuniões de status, cronograma atualizado e evidências de campo em cada fase.',
    indicadores: [
      { value: '+R$800 mil', label: 'em obras executadas por mês' },
      { value: '100%', label: 'das demandas concluídas no mês' },
    ],
    recorrente: 'Após a entrega, a manutenção preventiva da nova unidade pode entrar direto no contrato mensal.',
    spot: 'A construção em si é sempre um projeto spot: escopo fechado, cronograma, orçamento e entrega técnica documentada.',
    foto: '/media/v03-equipe-obra.jpg',
    fotoAlt: 'Equipe de construção trabalhando em estrutura de edifício',
    metaTitle: 'Novas Construções — Manfac Engenharia',
    metaDescription: 'Gestão e execução de novas construções do planejamento à entrega das chaves, com equipe própria, cronograma real e custo sob controle.',
  },
  {
    slug: 'manutencao-predial',
    nome: 'Manutenção Predial Preventiva e Corretiva',
    headline: 'Manutenção predial para redes e grandes operações, com SLA, equipe técnica e visibilidade mensal dos chamados.',
    sub: 'Menos emergências, mais previsibilidade — equipe técnica própria, rotina de chamados e relatório mensal de cada demanda.',
    paraQuem: 'Redes varejistas, operações corporativas e ambientes críticos com múltiplas unidades que precisam de previsibilidade, padrão técnico e um único responsável pela manutenção.',
    dores: 'Emergências recorrentes · fornecedores sem padrão · falta de visibilidade sobre chamados · custo imprevisível mês a mês.',
    escopo: [
      'Plano de manutenção preventiva customizado',
      'Atendimento corretivo com SLA definido em contrato',
      'Cobertura de elétrica, hidráulica, civil e pequenos reparos',
      'Registro fotográfico e evidência por chamado',
      'Relatório mensal de demandas e status de cada chamado',
    ],
    comoExecutamos: 'Mapeamento das unidades e histórico; rotina preventiva programada; corretiva com SLA e priorização por criticidade; relatório mensal com análise de recorrência para reduzir emergências.',
    indicadores: [
      { value: '+1.000', label: 'ordens de serviço por mês' },
      { value: '100%', label: 'das demandas concluídas no mês' },
      { value: '400+', label: 'unidades sob gestão no RJ' },
    ],
    recorrente: 'É o coração do contrato mensal: preventiva, corretiva e emergencial com SLA, equipe e relatórios.',
    spot: 'Intervenções fora do escopo contratual — trocas de grande porte, adequações — viram proposta técnica específica.',
    foto: '/media/v03-tecnico-campo.jpg',
    fotoAlt: 'Técnico de manutenção uniformizado trabalhando em campo',
    metaTitle: 'Manutenção Predial para Redes e Grandes Operações — Manfac Engenharia',
    metaDescription: 'Manutenção predial preventiva e corretiva com SLA, equipe técnica própria e visibilidade mensal dos chamados para redes e grandes operações.',
  },
  {
    slug: 'hvac',
    nome: 'Sistemas de Climatização (HVAC)',
    headline: 'Climatização funcionando. Energia dentro do orçamento.',
    sub: 'Instalação, manutenção e gestão de sistemas HVAC com plano preventivo dedicado e técnicos especializados.',
    paraQuem: 'Operações onde climatização parada significa perda direta: lojas, escritórios, ambientes técnicos e áreas de atendimento ao público.',
    dores: 'Sistema parado em horário de pico · conta de energia fora do controle · manutenção só quando quebra · fornecedor sem especialização.',
    escopo: [
      'Instalação de sistemas split, VRF e centrais de ar',
      'Manutenção preventiva com periodicidade definida',
      'Higienização e limpeza técnica',
      'Monitoramento de performance e consumo',
      'Atendimento de urgência com SLA garantido',
    ],
    comoExecutamos: 'Diagnóstico do parque instalado; plano preventivo com periodicidade por equipamento; execução por técnicos especializados com registro por visita; acompanhamento de consumo e performance.',
    indicadores: [
      { value: '400+', label: 'unidades atendidas no RJ' },
      { value: '100%', label: 'das demandas concluídas no mês' },
    ],
    recorrente: 'Plano preventivo de HVAC entra no contrato mensal com periodicidade e SLA definidos.',
    spot: 'Instalações novas, substituição de equipamentos e retrofits de climatização viram proposta técnica avulsa.',
    foto: '/media/v03-hvac.jpg',
    fotoAlt: 'Equipamentos de climatização em casa de máquinas',
    metaTitle: 'Sistemas de Climatização HVAC — Manfac Engenharia',
    metaDescription: 'Instalação, manutenção e gestão de sistemas de climatização HVAC com plano preventivo dedicado, técnicos especializados e SLA garantido.',
  },
]

export function getServico(slug: string): ServicoData | undefined {
  return SERVICOS_DATA.find((s) => s.slug === slug)
}
