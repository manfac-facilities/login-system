# Sistema Sofia — Prompt Stitch (rodada 2, pós-feedback do cliente)

> Cole este conteúdo no Stitch para gerar o protótipo clicável completo, mantendo a identidade visual já aprovada na rodada 1. Estruturado em ordem de jornada do usuário. Cada bloco "TELA" pode ser gerado como uma tela individual referenciando o mesmo design system.

## Design system (manter da rodada 1)

- Fundo geral: `#0a1628` (navy quase preto)
- Painéis / sidebar / cards: `#0d2050`
- Acento (CTA, badges de destaque, ícone ativo): `#f05a28` (laranja)
- Bordas: `#1e3a5f`
- Texto secundário/muted: `#94a3b8` / `#4a6080`
- Texto principal: branco
- Tipografia: sans-serif moderna, títulos bold, corpo regular, uppercase tracking-wide para labels de seção
- Componentes recorrentes: cards de KPI com número grande, badges arredondados coloridos por status (verde=ok, amarelo=atenção, vermelho=crítico/vencido, cinza=inativo/neutro), tabelas com header em `#0d2050`, formulários com inputs escuros (`#0f1f3d`) e borda que vira laranja no foco
- Layout: sidebar fixa à esquerda com navegação agrupada por seção, conteúdo principal com padding generoso (p-8), título de página + subtítulo descritivo no topo

## Navegação (sidebar atualizada)

Reorganizar em 4 grupos (hoje é uma lista única, ficou grande):

**OPERAÇÃO**
- Visão Geral
- Equipes
- Veículos
- Motoristas
- KM Diário
- Checklist

**OCORRÊNCIAS**
- Multas
- Sinistros

**MANUTENÇÃO & DOCUMENTOS**
- Revisões
- Documentos (seguro/licenciamento)
- Abastecimento

**GESTÃO**
- Custos
- Disponibilidade da Frota
- Pendências & Plano de Ação

---

## TELA 1 — Visão Geral (Dashboard) [atualizar]

Manter KPIs existentes (equipes ativas, veículos ativos, motoristas ativos, multas pendentes) e **adicionar**:
- KPI "Disponibilidade da frota" — percentual grande (ex: 87%) com sub-texto "21 de 24 veículos disponíveis"
- KPI "Custo do mês" — valor agregado (locação + manutenção + multas + sinistros + abastecimento)
- KPI "Sinistros abertos" — contagem, destaque vermelho se > 0
- KPI "Pendências críticas" — contagem vinda do painel de Pendências & Plano de Ação
- Banner de alerta para documentos (seguro/licenciamento) vencendo em 30 dias, no mesmo estilo dos banners de CNH vencendo

## TELA 2 — Equipes [sem mudança visual, ajuste de dado]

Mesma lista atual (código, centro de custo, veículo vinculado, status). Observação para o dev: centro de custo passa a ser histórico mensal nos bastidores, mas a tela continua mostrando o vigente.

## TELA 3 — Veículos [adicionar à navegação + criar tela de Detalhe]

Lista já existe (placa, modelo, KM atual, equipe, status) — **adicionar item no menu lateral** (hoje a tela existe mas não aparece no menu).

**Nova: Veículo — Detalhe** (clicar numa linha da lista abre):
- Cabeçalho com placa, modelo, ano, status badge
- Seção "Responsável atual": equipe + motorista + desde quando
- Seção "Histórico de responsabilidade" — timeline vertical: cada item mostra período (de/até), equipe, motorista, e o tipo de evento que originou a troca (ex: "Troca de equipe via checklist em 15/04/2026")
- Seção "Custo acumulado do mês": locação, manutenção, multas, sinistros, abastecimento, total
- Tabs ou seções rápidas linkando para Documentos, Revisões e Sinistros filtrados por este veículo

## TELA 4 — Motoristas [criar tela de Detalhe]

Lista já existe (nome, CNH, vencimento, equipe, contato) — **manter**.

**Nova: Motorista — Detalhe** (clicar numa linha abre):
- Dados cadastrais + CNH + equipe
- Seção "Documentos assinados":
  - Card "Termo de Uso de Veículo" — badge Assinado (verde, com data) / Pendente (vermelho), botão para anexar/upload do documento assinado
  - Lista "Autorizações de desconto assinadas" — uma linha por multa/sinistro que teve autorização, com data, valor, link pro registro de origem (multa ou sinistro), badge Assinada/Pendente

## TELA 5 — KM Diário [sem mudança]

Mantém como está: form de lançamento + lista do dia.

## TELA 6 — Checklist [expandir]

Adicionar um terceiro tipo ao seletor existente (hoje é Saída/Retorno):
- **Saída** | **Retorno** | **Troca de Responsável**

No fluxo "Troca de Responsável": formulário pede "De: Equipe/Motorista atual" e "Para: Equipe/Motorista novo", mais os mesmos 8 itens de vistoria + fotos + km no momento da troca. Ao salvar, isso é o que alimenta a timeline de "Histórico de responsabilidade" do veículo (Tela 3).

Adicionar também ao checklist (todos os tipos):
- Campo "Avaria identificada?" (Sim/Não) — se sim, abre descrição + foto da avaria (reaproveitar componente de câmera) — isso alimenta o módulo de Sinistros como rascunho
- Checkboxes: Chave entregue / Cartão combustível entregue
- Campo de assinatura/ciência do motorista (pode ser um canvas de assinatura simples ou um checkbox "Motorista confirma recebimento nas condições descritas")

## TELA 7 — Multas [expandir]

Lista mantém colunas atuais (data, placa, motorista, descrição, valor, status). Ao abrir/editar uma multa, adicionar:
- Campo "Valor descontado" (R$)
- Seletor "Tipo de desconto": Nenhum / Parcial / Total
- Card "Autorização de desconto": badge Assinada (verde) / Pendente (vermelho) + upload do anexo
- Total pendente no topo da lista já existe — manter, mas separar visualmente "pendente de validação" vs "validada mas não descontada" vs "descontada"

## TELA 8 — Sinistros [nova]

Lista no mesmo padrão visual de Multas:
- Colunas: Data, Placa, Motorista, Tipo (Colisão / Furto / Avaria / Outro), Valor do dano, Desconto (Nenhum / Parcial R$X / Total R$X), Status (Aberto / Em tratativa / Encerrado)
- Badge de status colorido: Aberto = vermelho, Em tratativa = amarelo, Encerrado = verde
- Card de total: "R$ X em sinistros abertos"

**Form "Novo Sinistro"**:
- Veículo, Motorista, Data, Tipo, Descrição
- Fotos do dano (reaproveitar câmera ao vivo, múltiplas fotos)
- Valor estimado do dano
- Seção de tratativa (preenchida depois): Valor descontado, Tipo de desconto, Autorização assinada (upload), Status

## TELA 9 — Revisões [reestruturar de card único para histórico]

Hoje é 1 card fixo por veículo (km/data da última revisão). Trocar por:
- Lista histórica por veículo: Tipo (Preventiva / Corretiva), Fornecedor, Valor, Nota fiscal (upload), Data realizada, Próxima prevista (km ou data), Status (Em dia = verde / Agendada = azul / Atrasada = vermelho)
- Filtro por veículo no topo
- KPI no topo da própria tela: "X manutenções atrasadas"

## TELA 10 — Documentos [nova]

Lista por veículo, agrupável:
- Colunas: Placa, Tipo de documento (Seguro / Licenciamento-CRLV / IPVA / Outro), Número/apólice, Vencimento, Status (Válido = verde / Vence em 30d = amarelo / Vencido = vermelho), ação de upload/anexo
- Filtro por status e por veículo

## TELA 11 — Abastecimento [nova]

Duas partes na mesma tela (split, como KM Diário):
- Esquerda: form de lançamento manual — Data, Veículo, Litros, Valor (R$), KM no momento, Posto
- Direita: relatório do mês — tabela por veículo com Litros totais, Valor total, R$/km, Km/litro (média), comparando com mês anterior (seta de variação)

## TELA 12 — Custos [nova]

Tabela principal por veículo (mês selecionável no topo):
- Colunas: Placa, Centro de custo vigente, Locação, Manutenção, Multas, Sinistros, Abastecimento, Total do mês
- Linha de total geral no final
- Botão "Atualizar centro de custo" por veículo — abre modal pedindo novo centro de custo + data de vigência (gera histórico, não sobrescreve)

## TELA 13 — Disponibilidade da Frota [nova]

Painel visual, menos tabela e mais "dashboard":
- Gráfico/anel grande mostrando % disponível vs parado
- Lista de veículos parados com motivo (Em manutenção / Sem motorista / Outro) e desde quando
- KPI histórico: comparação com mês anterior

## TELA 14 — Pendências & Plano de Ação [nova]

Painel unificado cross-módulo, espelhando o checklist mensal do manual da Manfac:
- Lista de pendências vindas de: multas sem tratativa, sinistros sem tratativa, manutenções atrasadas, documentos vencendo, termos de uso não assinados
- Cada linha: Descrição, Origem (módulo), Responsável (dono), Prazo, Próxima ação, Status (Aberta / Em andamento / Concluída)
- Botão "Adicionar item de plano de ação" manual (pendências que não vêm de nenhum módulo automático)
- Agrupamento visual por urgência (atrasado em vermelho no topo)

---

## Observação para quem for aprovar

Cada tela acima corresponde 1:1 a um ponto que o cliente levantou. Nenhum comentário dele ficou sem uma tela ou campo correspondente:

| Pedido do cliente | Tela/campo que resolve |
|---|---|
| Relatório de abastecimento | Tela 11 |
| Saber o que foi descontado / não descontado nas multas | Tela 7 (campo valor descontado + tipo) |
| Sinistros com batidas, custo, desconto total/parcial | Tela 8 |
| Saber se motorista assinou termo de uso | Tela 4 (seção Documentos assinados) |
| Saber se assinou autorização de desconto | Tela 4 + card na Tela 7/8 |
| Checklist na troca de carro entre equipes | Tela 6 (tipo "Troca de Responsável") |
| Histórico do responsável do carro por data | Tela 3 (timeline) |
| Centro de custo do veículo por mês (rateio pro Financeiro) | Tela 12 |
