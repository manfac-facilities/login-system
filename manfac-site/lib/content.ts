// manfac-site/lib/content.ts

export const NAV_ITEMS = [
  { href: '/', label: 'Início' },
  { href: '/quem-somos', label: 'Quem somos' },
  { href: '/servicos', label: 'Serviços' },
  { href: '/resultados', label: 'Resultados' },
  { href: '/contato', label: 'Contato' },
]

export const STATS = [
  { value: '400+', label: 'unidades sob gestão no RJ' },
  { value: '+1.000', label: 'ordens de serviço/mês' },
  { value: '100%', label: 'das demandas concluídas no mês' },
  { value: '+R$800 mil', label: 'em obras e reformas/mês' },
]

export const PROBLEMAS = [
  'Falta de visibilidade sobre o andamento das demandas',
  'Dificuldade de controle de prazos e custos',
  'Comunicação descentralizada',
  'Atuação reativa e sem padronização',
]

// Home v03 — seção "O problema que resolvemos" (tabela 2.2-B do relatório)
export const DORES = [
  { dor: 'Muitos fornecedores', resposta: 'Ponto único de responsabilidade e comunicação.' },
  { dor: 'Falta de padrão', resposta: 'Equipe própria treinada, rotina técnica e supervisão operacional.' },
  { dor: 'Baixa visibilidade', resposta: 'Relatórios, cronogramas, status recorrente e evidências em campo.' },
  { dor: 'Chamados recorrentes', resposta: 'Análise de causa, priorização e plano de redução de reincidência.' },
  { dor: 'Dificuldade de cobrança', resposta: 'Gestão ativa com responsável técnico e acompanhamento de ponta a ponta.' },
]

// Home v03 — seção "Como funciona na prática" (seção 3.2-D do relatório)
export const COMO_FUNCIONA = [
  { n: '01', title: 'Mapeamento inicial', description: 'Unidades, histórico, volume, SLA, criticidade e prioridades.' },
  { n: '02', title: 'Plano operacional', description: 'Equipe, rotina, fluxo de chamados, relatórios e indicadores.' },
  { n: '03', title: 'Execução em campo', description: 'Técnicos, supervisão, materiais, fotos, evidências e qualidade.' },
  { n: '04', title: 'Gestão e comunicação', description: 'Status recorrente, cronograma, dashboard, reuniões e pendências.' },
  { n: '05', title: 'Melhoria contínua', description: 'Recorrências, redução de emergências e plano de evolução.' },
]

// Home v03 — contrato recorrente vs. demandas spot (seção 4.3 do relatório)
export const RECORRENTE_SPOT = {
  recorrente: {
    tagline: 'Contrato recorrente',
    title: 'Sua operação, sob gestão contínua',
    items: [
      'Manutenção preventiva, corretiva e emergencial',
      'SLA, equipe dedicada, rotina de chamados e relatórios',
      'Gestão mensal, redução de emergências e padronização',
    ],
  },
  spot: {
    tagline: 'Demandas spot',
    title: 'Projetos pontuais, entrega técnica',
    items: [
      'Reformas, adequações e obras pontuais',
      'Escopo fechado, cronograma e orçamento definidos',
      'Expansões, retrofit, obras em loja e melhorias estruturais',
    ],
  },
}

// Home v03 — seção "Por que a Manfac"
export const DIFERENCIAIS_HOME = [
  'Equipe própria treinada',
  'Gestão ativa com responsável técnico',
  'Relatórios e evidências em campo',
  'Ponto focal único',
  'Capacidade de escala comprovada',
]

export const PILARES = [
  {
    title: 'Gestão ativa, não reativa',
    description:
      'Cada obra e chamado fazem parte de um plano maior. Acompanhamos de perto, ajustamos quando necessário e respondemos por tudo.',
  },
  {
    title: 'Você sabe o que acontece antes de precisar perguntar',
    description:
      'Relatórios claros, cronogramas atualizados e comunicação recorrente — para reduzir desvios e antecipar decisões.',
  },
]

export const PASSOS = [
  { n: '01', title: 'Diagnóstico e priorização' },
  { n: '02', title: 'Estruturação da operação' },
  { n: '03', title: 'Execução com alto padrão técnico' },
  { n: '04', title: 'Comunicação e visibilidade contínua' },
  { n: '05', title: 'Evolução constante da operação' },
]

export const BANNERS = ['Simples na execução', 'Forte na gestão', 'Consistente no resultado']

export const SERVICOS = [
  {
    title: 'Obras e reformas corporativas',
    description:
      'Execução de obras e reformas em unidades corporativas com padrão técnico, cronograma definido e acompanhamento contínuo — sem paralisar a operação do cliente durante a obra.',
  },
  {
    title: 'Novas construções',
    description:
      'Gestão e execução de novas construções do planejamento à entrega, com um único ponto de contato responsável por prazo, custo e qualidade em cada etapa.',
  },
  {
    title: 'Manutenção predial preventiva e corretiva',
    description:
      'Rotinas programadas que evitam falhas antes que aconteçam, reduzindo custo recorrente e chamados de emergência ao longo do tempo.',
  },
  {
    title: 'Sistemas de Climatização (HVAC)',
    description:
      'Instalação, manutenção e gestão de sistemas de climatização, com monitoramento de desempenho e plano de manutenção preventiva dedicado.',
  },
]

export const RESULTADOS = [
  { value: '+1.000', label: 'ordens de serviço por mês' },
  { value: '100%', label: 'das demandas concluídas mensalmente' },
  { value: '400+', label: 'unidades sob gestão da Manfac no RJ' },
  { value: '+R$800 mil', label: 'em obras e reformas por mês' },
]

export const DIFERENCIAIS = [
  'Gestão ativa e estruturada',
  'Transparência total',
  'Comunicação clara e recorrente',
  'Uso de tecnologia e dados',
  'Proatividade na resolução de problemas',
]

export const IMPACTO = [
  'Prazo e custo sob controle, com comunicação recorrente',
  'Todo chamado com registro, prazo e responsável definidos',
  'Visibilidade sem precisar pedir',
  'Menos emergências, mais planejamento',
  'Decisões baseadas em dados reais',
]
