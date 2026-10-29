# SGO MANFAC – Especificação para o sistema de obras (e-mail do Eduardo Maia, 23/10/2026)

Texto literal extraído de "SGO MANFAC – Especificação para o sistema de obras.msg" (Desktop). Anexo xlsx em 2026-10-29-sgo-obras-anexos/.

---

SGO MANFAC – Especificação para o sistema de obras (Next.js)

Obra piloto: DP Macaé 3 – Grupo DPSP (DS 1505) · Rua Maria Francisca Borges Reid, s/nº, Glória, Macaé/RJ Origem: sessão de trabalho de 23/10/2026 (Eduardo Maia, MANFAC Engenharia). Protótipo de referência: SGO_Obra_Macae3_DPSP_MANFAC.xlsx. Este documento descreve o que ele faz, para ser reconstruído como sistema web.

________________________________

0. Prompt para colar no agente de código

Você vai construir o módulo SGO – Sistema de Gestão, Controle e Comunicação de Obras dentro de um sistema de obras em Next.js (App Router, TypeScript). Use este documento como especificação completa. Ele traz o objetivo, as regras de negócio, o modelo de dados, todos os cálculos, as telas, os relatórios e os dados iniciais da obra piloto DP Macaé 3.

Princípio do sistema: registrar uma vez, usar em tudo. O mesmo lançamento alimenta a visão de campo, a visão de gestão MANFAC e a visão do cliente. A visão do cliente nunca mostra custo, margem, fornecedor ou produtividade financeira.

Antes de codar: leia as seções 2 (regras), 4 (modelo de dados) e 5 (cálculos). Depois monte o schema do banco, as rotas de API, o seed da seção 10 e as telas da seção 6, nessa ordem. As decisões em aberto da seção 9 devem virar configuração ou perguntas para o usuário. Não invente valores.

________________________________

1. O que foi pedido nesta sessão, em ordem, e o que foi corrigido

#

Pedido

Resultado

Correções e achados

1

Atualizar o orçamento estrutural "com o maior preço" entre a REV_02 e a REV_03

REV_04 gerada no padrão da REV_03

A REV_03 já tinha o maior preço em todos os itens. A linha 9.4 (imposto) era 17 × R$ 2.500 = R$ 42.500, um número sem base. Passou a ser 17% sobre a base de serviços (R$ 250.400) = R$ 42.568. Total REV_04 = R$ 292.968. A observação do item 7.2 ("mesmo padrão existente, sujeito a disponibilidade") tinha sumido na REV_03.

2

Organizar as fases da obra (lista enviada pelo Eduardo) com base no laudo EGUTI e na Orientação Inicial

Documento "Fases da Obra – Macaé 3" (Word) com 20 atividades em 6 etapas

A lista original demolia o piso antes do escoramento, o que contraria o laudo (itens 7.4.b e 8.3). Havia item duplicado (piso), numeração com 6 repetido e 9 faltando, "nivelamento de piso" quando o laudo pede reconstrução, e macaco hidráulico sendo usado para levantar em vez de só encunhar.

3

"Escoramento já está concluído" → "ainda não escoramos a viga principal"

Atividade 6 marcada como PARCIAL

A viga principal (treliça, vão P3–P4 de 10,00 m) é o elemento crítico do laudo. Enquanto não estiver escorada, nenhuma demolição pode começar. Isso virou a trava central do sistema.

4

Implantar o SGO (texto de referência com relatórios diário, semanal, mensal, por fase e de entrega, papéis e rotina) usando REV_04, LPU, layout, laudo e fases

Planilha SGO com 14 abas

Ao cruzar os documentos: 9 sobreposições de escopo entre REV_04 e LPU (exposição de ≈ R$ 35.900); limpeza final na LPU com 1.200 m² contra ≈ 224 m² do layout; porcelanato com 250 m² contra 142,93 m² de área de vendas + medicamentos; fundo preparador em 400 m² contra 260 m² de massa e pintura; dois itens de retirada de vidro na LPU (5.42 e 48.68); itens da LPU sem código e fechadura sem parcela de mão de obra.

5

Melhorar a planta de faseamento da Fase 1

Prancha A3 paisagem com zonas, legenda, regras e carimbo

No desenho original, o fluxo de clientes atravessava a zona de obra, o drywall e o balcão "fechado de ponta a ponta". Primeira proposta: corredor protegido. Eduardo corrigiu: não existe corredor, o drywall fecha direto. Versão final: drywall contínuo até a fachada, nova porta = acesso exclusivo da obra, clientes pela entrada existente.

________________________________

2. Regras de negócio (domínio)

2.1 Obra e segurança

1.	Trava estrutural: enquanto a atividade "Escoramento provisório" (nº 6) não estiver Concluído, todas as atividades de demolição (nº 11 a 14 e 21) ficam bloqueadas. O sistema deve impedir mudar o status delas para Em andamento e mostrar o alerta no painel e no relatório do cliente.
2.	O escoramento permanece até o reforço estrutural (nº 15) ser executado e conferido pelo RT.
3.	Macaco hidráulico no escoramento serve só para encunhar. Renivelamento dos apoios só com projeto de reforço.
4.	O piso do salão é reconstruído: remoção do solo fofo, base granular compactada em camadas de no máximo 20 cm e nova laje armada. Não é "nivelamento".
5.	Trincas, drywall e cerâmica do mezanino só são recuperados depois do reforço.
6.	Mall, estacionamento e drenagem do centro comercial ficam fora do escopo até confirmação formal de responsabilidade (laudo itens 7.1 e 7.2).

2.2 Faseamento da Fase 1 (planta)

*	Drywall de piso a teto fechando direto a zona de obra, sem corredor e sem frestas, com vedação de poeira.
*	Nova porta = acesso exclusivo da obra (equipe, material, entulho). Material e entulho fora do horário comercial do centro.
*	Clientes e equipe da loja usam só a entrada existente da fachada. Nenhum fluxo da loja atravessa a zona de obra.
*	Balcão fechado de ponta a ponta. Estante de medicamento reposicionada na faixa de atendimento.
*	Rota de fuga do salão pela entrada existente; zona de obra com saída pela nova porta, extintor e luminária de emergência.
*	Mezanino com carga aliviada e circulação restrita até o reforço.
*	Em aberto: com o balcão fechado e o drywall logo abaixo, a faixa de atendimento fica sem acesso para funcionários. Falta definir portinhola no balcão ou abertura na ponta.

2.3 Comunicação com o cliente

*	O cliente não pode precisar perguntar como está a obra.
*	Informe diário em todo dia de execução, validado pelo engenheiro antes do envio, em horário padronizado.
*	Relatório semanal toda sexta. Se a sexta for feriado, antecipa para o dia útil anterior.
*	Relatório mensal no último dia útil do mês.
*	Relatório de fase na conclusão de cada etapa; relatório de entrega no fim.
*	Risco relevante de atraso, custo adicional ou decisão do cliente: comunicação imediata, sem esperar o relatório.
*	Todo envio fica registrado: tipo, período, responsável, data prevista, data real, destinatários, link do PDF, confirmação, comentários e respostas pendentes.

2.4 Comercial

*	Imposto do REV_04: 17% por fora sobre os serviços (base = itens 1.1 a 9.3). Alternativa "por dentro" (base ÷ 0,83 – base ≈ R$ 51.287) ainda não decidida com a DPSP.
*	Na LPU DPSP, a regra do contrato é 40% material e 60% mão de obra, e é proibido alterar fórmulas; só o quantitativo muda.
*	Sobreposição de escopo entre pedidos deve ser resolvida por fronteira de área antes da primeira medição (ver seção 10.3).

________________________________

3. Papéis e responsabilidades

Papel

Obrigação no sistema

Permissões sugeridas

Encarregado

Registra diariamente serviços, equipe, quantidades e fotos (RDO)

Criar/editar RDO do dia

Engenheiro de obras

Valida RDO, cronograma, qualidade e informes ao cliente

Editar cronograma, validar RDO, aprovar envio

Analista de obras / COP

Consolida relatórios, cobra atualizações, controla envios

Gerar e enviar relatórios, registrar comunicação

Compras e Almoxarifado

Atualiza pedidos, entregas e materiais

CRUD compras e locações

Financeiro

Atualiza custos, medições e faturamento

CRUD medições, ver custos

GO (gestor de obras)

Verifica resultados, riscos e desvios

Leitura total, resolver conflitos

CEO

Visualiza todas as obras e atua nas exceções

Leitura total multi-obra

Cliente (DPSP)

Recebe e comenta relatórios

Somente visão do cliente (sem custos)

________________________________

4. Modelo de dados

Nomes sugeridos em inglês para o código; rótulos em português na interface. Todo registro tem id, obraId, createdAt, updatedAt, createdBy.

Obra

nome, cliente, codigoCliente (DS 1505), endereco, dataBase (início do planejamento), dataReferencia (padrão = hoje, pode fixar para fechar relatório), engenheiroResponsavel, rtNome, rtCrea.

Atividade (cronograma)

numero, frente (Estrutural | Reforma light), etapa, descricao, saidaTrava, predecessora1, predecessora2 (números de atividade), duracaoDiasUteis, responsavelFuncao, status (Não iniciado | Em andamento | Concluído | Bloqueado), percentualRealizado, inicioReal, fimReal, bloqueiaPorTrava (boolean: atividades de demolição). Calculados: inicioPrevisto, fimPrevisto, valorVinculado, peso, percentualPrevisto, desvio, situacao.

ItemOrcamento

pedido (Estrutural REV_04 | Reforma light LPU), item (código; itens da LPU sem código recebem S/N-1, S/N-2), descricao, unidade, quantidade, precoUnitario, atividadeNumero (0 = indireto ou imposto, fora do peso), percentualMedido, custoPrevisto. Chave única: pedido + item (no protótipo: REV|1.1, LPU|5.41). Calculados: total, valorMedido, saldoAMedir, custoReal, resultado. Caso especial: item REV|9.4 (imposto) tem quantidade = 0,17 e precoUnitario = soma dos totais dos demais itens do REV_04.

RDO (diário)

data, clima, atividadeNumero, servicosExecutados, quantidade, unidade, efetivo, empresaEquipe, equipamentos, fotos[] (upload, datadas e identificadas), ocorrencias, programacaoAmanha, registradoPor, validadoPor, validadoEm, enviadoAoCliente.

Compra

dataPedido, fornecedor, descricao, itemOrcamentoId, quantidade, valorTotal, previsaoEntrega, entregaReal, status (Cotação | Pedido emitido | Entregue | Cancelado), nf, observacao. Calculado: situacao.

Locacao

equipamento, fornecedor, quantidade, inicio, fimPrevisto, devolucaoReal, valorDiarioUnitario, itemOrcamentoId, observacao. Calculados: diasCobrados, custoAcumulado, situacao.

Medicao

numero, pedido, periodoDe, periodoAte, valorMedido, dataEnvio, aprovadorCliente, dataAprovacao, numeroOsPedido, nfNumero, dataNf, valorNf, dataRecebimento. Calculados: situacao, diasEmAprovacao.

Pendencia

numero, tipo (Trava | Risco | Decisão do cliente | Escopo | Conflito | Quantitativo | Comercial | Dados), descricao, impacto, atividadeNumero, responsavelFuncao, dependeDoCliente, exibirAoCliente, abertura, prazo, status (Aberta | Em tratativa | Concluída), fechamento. Calculados: diasEmAberto, situacao.

ConflitoEscopo

tema, itensRev[], itensLpu[], risco, acaoRecomendada, decisaoRegistrada, status (Aberto | Em negociação | Resolvido). Calculados: valorRev, valorLpu, exposicao.

Comunicacao

tipo (Informe diário | Relatório semanal | Relatório mensal | Relatório de fase | Relatório de entrega | Comunicação imediata), referencia, responsavel, dataPrevista, dataReal, destinatarios[], pdfUrl, confirmacao, comentariosCliente, respostasPendentes. Calculado: situacao.

AvancoSemanal (snapshot)

sexta, previstoAcumulado, realizadoAcumulado. No protótipo o realizado era digitado toda sexta; no sistema, gravar automaticamente por job semanal.

Feriado

data, descricao, abrangencia (nacional | estadual | municipal | facultativo).

________________________________

5. Cálculos (fórmulas do protótipo traduzidas)

Dias úteis: segunda a sexta, excluindo a tabela de feriados. workday(d, n) e networkdays(a, b) como no Excel.

Início previsto:

*	sem predecessoras → primeiro dia útil a partir de dataBase;
*	com predecessoras → workday(max(fimPrevisto(pred1), fimPrevisto(pred2)), 1). Detectar ciclo nas predecessoras e recusar.

Fim previsto: workday(inicioPrevisto, max(duracao, 1) - 1).

Valor vinculado da atividade: soma de ItemOrcamento.total com atividadeNumero = atividade.numero.

Peso: valorVinculado / soma(valorVinculado de todas as atividades). Itens com atividade 0 ficam fora. Atividade sem valor tem peso 0.

% previsto numa data D: 0 se D < início; 1 se D ≥ fim; senão networkdays(início, D) / duração.

Avanço previsto da obra: Σ peso × %previsto(dataReferencia). Avanço realizado: Σ peso × percentualRealizado. Desvio em p.p.: (realizado − previsto) × 100.

Situação da atividade: Concluída se status Concluído; BLOQUEADA se Bloqueado; ATRASADA se dataReferencia > fimPrevisto; INÍCIO ATRASADO se dataReferencia ≥ inicioPrevisto e status Não iniciado; senão No prazo.

Previsão de término: maior fimPrevisto.

Orçamento: total = quantidade × precoUnitario; valorMedido = total × percentualMedido; saldo = total − valorMedido; custoReal = Σ compras do item (exceto Canceladas) + Σ custoAcumulado das locações do item; resultado = valorMedido − custoReal.

Conferência com as fontes: total do REV_04 deve bater com R$ 292.968,00 e total da LPU com R$ 213.372,41. Divergência = alerta.

Locação: diasCobrados = (devolucaoReal ?? dataReferencia) − inicio + 1; custoAcumulado = quantidade × valorDiario × diasCobrados; situação Devolvido | VENCIDA – renovar ou devolver (passou do fim previsto) | Ativa.

Compra: situação Entregue | Cancelado | ATRASADA (passou da previsão) | No prazo.

Medição: situação pela última data preenchida: Recebida → Faturada – a receber → Aprovada – faturar → Em aprovação → Em preparação. diasEmAprovacao = dataReferencia − dataEnvio enquanto não aprovada. Alerta acima de 10 dias.

Pendência: diasEmAberto = (fechamento ?? dataReferencia) − abertura; situação Concluída | VENCIDA (passou do prazo) | Em aberto.

Conflito: exposicao = min(valorRev, valorLpu); quando o conflito é interno à LPU, min entre os itens LPU.

Agenda de comunicação (gerada do cronograma):

*	diários: cada dia útil de dataBase até a previsão de término;
*	semanais: cada sexta a partir da primeira sexta ≥ dataBase, até término + 7 dias, antecipando se for feriado;
*	mensais: último dia útil de cada mês até o mês do término;
*	de fase: maior fimPrevisto de cada etapa;
*	de entrega: previsão de término. Situação: Enviado no prazo | Enviado com atraso | ATRASADO | ENVIAR HOJE | Programado. A agenda se recalcula quando o cronograma muda; envios já feitos não podem ser apagados.

Alertas do painel:

1.	Escoramento da viga principal pendente: nenhuma demolição pode começar.
2.	N atividades atrasadas: comunicar o cliente hoje, sem esperar o semanal.
3.	Desvio acima de 5 p.p.: definir ação de recuperação e registrar no semanal.
4.	N comunicações ao cliente atrasadas.
5.	N decisões aguardando o cliente.
6.	Exposição de R$ X em escopo sobreposto REV_04 × LPU: resolver antes da 1ª medição.
7.	N locações vencidas: custo correndo.
8.	N RDOs sem envio ao cliente.

________________________________

6. Telas

1.	Painel da obra (gestão, interno): parâmetros; avanço previsto, realizado e desvio; atividades atrasadas; trava estrutural; financeiro (pedidos, total contratado R$ 506.340,41, medido, apresentado, aprovado, faturado, recebido, saldo, custo real, resultado, exposição por sobreposição); pendências, decisões do cliente, comunicações atrasadas, próximo envio, RDOs não enviados, locações ativas e vencidas, compras atrasadas; alertas.
2.	Cronograma: tabela editável + Gantt semanal (cor diferente para concluída e atrasada) + bloqueio visual da trava.
3.	Curva S: previsto × realizado por sexta-feira.
4.	Orçamento consolidado: REV_04 + LPU numa tabela, filtros por pedido e atividade, % medido editável.
5.	Conflitos de escopo: os 9 temas, decisão e status.
6.	RDO: formulário de campo para celular (encarregado), com upload de fotos, fila de validação do engenheiro e botão de envio ao cliente.
7.	Compras e Locações.
8.	Medições e faturamento.
9.	Pendências, riscos e decisões do cliente.
10.	Comunicação com o cliente: agenda + histórico + registro de comunicação imediata.
11.	Relatório semanal do cliente (PDF): obra, semana (segunda a sexta), avanço planejado até a sexta, avanço realizado, desvio, atividades concluídas, previsão de entrega, principal impedimento, concluídas, em andamento (% e término), programação da próxima semana, decisões que dependem do cliente (só pendências com dependeDoCliente e exibirAoCliente), fotos da semana e observações da engenharia. Sem custos.
12.	Informe diário (PDF): serviços executados, avanço previsto × realizado, fotos, ocorrências, programação do dia seguinte, previsão de conclusão.
13.	Relatórios mensal, de fase e de entrega: mesma base, com marcos, medições aprovadas, aditivos e comparativo antes/depois.
14.	Planta de faseamento: prancha da fase com zonas, legenda, regras e carimbo (seção 8).
15.	Visão multi-obra (CEO).

________________________________

7. Rotina operacional que o sistema precisa suportar

*	Diariamente, fim do expediente: encarregado registra o RDO → engenheiro valida → COP envia o informe diário e o envio fica registrado. Status e % do cronograma atualizados.
*	Sexta-feira: engenharia atualiza cronograma e pendências → GO avalia desvios → snapshot da curva S → relatório semanal ao cliente.
*	Último dia útil do mês: engenharia e financeiro atualizam % medido e medições → GO valida → relatório mensal.
*	Exceção: comunicação imediata registrada.

________________________________

8. Planta de faseamento – Fase 1 (versão aprovada)

Base: layout aprovado do térreo, sem escala. Prancha A3 paisagem: planta à esquerda; título, legenda, regras e carimbo à direita.

Zonas: zona de obra Fase 1 (toda a área inferior e esquerda, até a parede da fachada); salão em operação (check-out, feirinha, fraldeiro, caixas C, BAL.); faixa de atendimento com estante de medicamento reposicionada; copa 9,97 m² em uso.

Elementos: drywall piso a teto contínuo (vertical ao lado da copa e horizontal até a parede da fachada); balcão fechado de ponta a ponta; nova porta no canto inferior direito, de uso exclusivo da obra; entrada existente da fachada para clientes e equipe da loja.

Legenda: zona de obra; salão em operação; atendimento; drywall; balcão; nova porta (acesso exclusivo da obra); fluxo de clientes e equipe (entrada existente); fluxo da obra (equipe, material, entulho).

Regras impressas:

1.	Nenhuma demolição antes do escoramento da viga principal (treliça P3–P4) concluído e liberado pelo RT.
2.	Clientes e equipe da loja usam só a entrada existente. Nenhum fluxo da loja atravessa a zona de obra.
3.	Drywall fechado direto, do piso ao teto, sem frestas e com vedação de poeira.
4.	Nova porta de uso exclusivo da obra. Material e entulho fora do horário comercial do centro.
5.	Salão com rota de fuga pela entrada existente; zona de obra com saída pela nova porta, extintor e luminária de emergência.
6.	Mezanino com carga aliviada e circulação restrita até o reforço estrutural.

Carimbo: cliente, obra, desenho, base, responsável técnico [NOME / CREA], data, revisão.

Sugestão para o sistema: cada fase é um registro com imagem-base do layout + camadas desenhadas (zonas, drywall, portas, fluxos) e um texto de regras. Gerar PDF da prancha. Faltam as posições de P1 a P4 e do escoramento, que dependem do levantamento.

________________________________

9. Informações que preciso saber (decisões em aberto)

Da obra Macaé 3

1.	Data real de retomada do planejamento (o protótipo usa 26/10/2026).
2.	Status real das atividades 1 a 5 e % já executado do escoramento (nº 6).
3.	Validação das durações em dias úteis pelo engenheiro (são estimativas).
4.	Acesso dos funcionários à faixa de atendimento (portinhola no balcão ou abertura na ponta).
5.	Confirmação de que o vão da fachada ao lado do BAL. é a entrada existente.
6.	Qual banheiro será desmobilizado (térreo ou WC do mezanino).
7.	Critério do imposto no REV_04 (por fora ou por dentro).
8.	Decisão da DPSP sobre as 9 sobreposições e a fronteira por área.
9.	Autorização de baixa de patrimônio (gôndolas e geladeira) e, se o vidro for de fachada, autorização do Best Center / condomínio.
10.	Registro formal de que Mall, estacionamento e drenagem estão fora do escopo.
11.	Feriados municipais de Macaé e recessos do centro comercial.
12.	Responsável técnico e CREA para o carimbo.

Do sistema 13. Banco e ORM (sugestão: PostgreSQL + Prisma ou Supabase) e onde guardar fotos e PDFs. 14. Autenticação e perfis (seção 3); o cliente terá login próprio ou só recebe PDF/link? 15. Envio dos relatórios: e-mail, link público com prazo, WhatsApp? 16. Geração de PDF (ex.: React-PDF ou Playwright no servidor). 17. Multi-obra e multi-cliente desde o início (Profarma/D1000 também usa?). 18. Integração com o fluxo de aprovação de OS e liberação de faturamento da DPSP. 19. Importação de orçamento: aceitar LPU DPSP em .xlsx (formato padrão, quantidade na coluna I, preço unitário na G) e o orçamento MANFAC. 20. Uso offline do RDO no celular em campo.

________________________________

10. Dados iniciais (seed) da obra piloto

10.1 Atividades (28)

Nº

Frente

Etapa

Atividade

Saída / trava

Pred. 1

Pred. 2

Dias úteis

Status inicial

1

Estrutural

1 – Mobilização e isolamento

Reunião de partida no local: identificar P1–P4, treliça e faixa de piso afetada

Mapa de frentes validado pelo RT

		1

Não iniciado

2

Estrutural

1 – Mobilização e isolamento

Pontos de acompanhamento fotográfico, relatório "antes da obra" e marcos de nível

Registro-base para medição e comparação

1

	2

Não iniciado

3

Estrutural

1 – Mobilização e isolamento

Instalar divisória de fechamento da área

Área isolada e sinalizada

1

	2

Não iniciado

4

Estrutural

1 – Mobilização e isolamento

Remover produtos, virar o balcão e mudar o mobiliário da área afetada

Frente de trabalho livre

3

	3

Não iniciado

5

Estrutural

1 – Mobilização e isolamento

Aliviar a carga do mezanino (retirar estoque do depósito)

Mezanino descarregado

3

	1

Não iniciado

6

Estrutural

2 – Estabilização

Escoramento provisório sob a treliça (P2/P3 e vão P3–P4); macaco só para encunhar

PARCIAL – falta a viga principal. Libera demolições. Manter até o nº 15

5

	3

Em andamento

7

Estrutural

3 – Investigação e projeto

Levantamento topográfico de níveis e medição dos m² da faixa afetada

Croqui com m² e cotas

6

	2

Não iniciado

8

Estrutural

3 – Investigação e projeto

Estudo de solo: SPT e poço de inspeção com abertura localizada do piso

Laudo de sondagem

6

	5

Não iniciado

9

Estrutural

3 – Investigação e projeto

Projeto estrutural de reforço (treliça, apoios e fundações) + ART

Projeto executivo aprovado

8

7

10

Não iniciado

10

Estrutural

3 – Investigação e projeto

Fechar quantitativos e revisar o orçamento da Fase 2

Escopo e valor aprovados pela DPSP

9

	5

Não iniciado

11

Estrutural

4 – Desmobilização e demolição

Abertura de porta com retirada de vidro (logística de entulho e materiais)

Acesso liberado

10

	1

Não iniciado

12

Estrutural

4 – Desmobilização e demolição

Descarte de gôndolas e geladeira

Termo de baixa de patrimônio DPSP

10

	2

Não iniciado

13

Estrutural

4 – Desmobilização e demolição

Desmobilização do banheiro

Banheiro liberado para obra

10

	2

Não iniciado

14

Estrutural

4 – Desmobilização e demolição

Demolição do piso (revestimento, contrapiso e laje) + descarte com CTR

Solo exposto na área delimitada

12

13

5

Não iniciado

15

Estrutural

5 – Reforço e reconstrução

Reforço das fundações de P2/P3 e da treliça, conforme projeto

Estrutura reforçada e conferida pelo RT

14

	10

Não iniciado

16

Estrutural

5 – Reforço e reconstrução

Remoção do solo inadequado, base de brita e compactação em camadas (máx. 20 cm)

Base aprovada

14

	5

Não iniciado

17

Estrutural

5 – Reforço e reconstrução

Nova laje de piso armada com nível final (inclui cura)

Laje curada e nivelada

16

15

10

Não iniciado

18

Estrutural

5 – Reforço e reconstrução

Piso do banheiro e revestimento do salão

Piso entregue

17

	8

Não iniciado

19

Estrutural

6 – Acabamentos e entrega

Recuperação do mezanino: drywall, piso cerâmico, copa e WCs

Mezanino recuperado

15

	8

Não iniciado

20

Estrutural

6 – Acabamentos e entrega

Retirada do escoramento, conferência final de níveis, limpeza e liberação

Loja liberada; relatório "depois"

18

27

3

Não iniciado

21

Reforma light

R – Reforma light

Demolição de forro (250 m²) e drywall (100 m²)

Somente após nº 6 concluído

6

	4

Não iniciado

22

Reforma light

R – Reforma light

Infraestrutura elétrica, rede, iluminação e ativações

Circuitos testados

21

	10

Não iniciado

23

Reforma light

R – Reforma light

Ar-condicionado: retirada, reinstalação de splits e drenos

Equipamentos operando

21

	5

Não iniciado

24

Reforma light

R – Reforma light

Drywall novo (190 m²) com reforço em MDF

No mezanino, só após nº 15

22

	6

Não iniciado

25

Reforma light

R – Reforma light

Forro mineral (250 m²) e abertura de luminárias

Forro fechado

24

23

6

Não iniciado

26

Reforma light

R – Reforma light

Portas, molas, grelhas, guia de porta de enrolar e fechadura

Esquadrias instaladas

24

	4

Não iniciado

27

Reforma light

R – Reforma light

Pintura (fundo, massa e acabamento)

Pintura concluída

25

19

6

Não iniciado

28

Reforma light

R – Reforma light

Fachada: fixação de vidros e pintura

Fachada entregue

11

	3

Não iniciado

Atividades com trava estrutural (bloqueadas até nº 6 concluído): 11, 12, 13, 14, 21.

10.2 Orçamento consolidado (106 itens)

Totais: REV_04 = R$ 292.968,00 · LPU = R$ 213.372,41 · total contratado = R$ 506.340,41.

Origem

Item

Descrição

Un.

Qtd.

Preço unit. (R$)

Total (R$)

Ativ. nº

Estrutural REV_04

1.1

Isolamento e sinalização da área (salão e mezanino)

vb

1

9.500,00

9.500,00

3

Estrutural REV_04

1.2

Mobilização e desmobilização de equipe/ferramentas

vb

1

4.500,00

4.500,00

1

Estrutural REV_04

1.3

Proteções provisórias e contenção de poeira/entulho

vb

1

1.000,00

1.000,00

3

Estrutural REV_04

1.4

Remanejamento de gôndolas, estoque e mobiliário da área de intervenção (térreo e mezanino)

vb

1

2.500,00

2.500,00

4

Estrutural REV_04

1.5

Adicional para trabalho fora do horário comercial (noturno/fim de semana)

vb

1

1.200,00

1.200,00

14

Estrutural REV_04

2.1

Escoramento provisório sob a treliça principal – apoios P2/P3 e vão livre P3–P4 (10,00 m)

vb

1

5.000,00

5.000,00

6

Estrutural REV_04

2.2

Materiais para escoramento e travamento (escoras metálicas, vigas de distribuição, calços)

vb

1

7.000,00

7.000,00

6

Estrutural REV_04

2.3

Mão de obra especializada para montagem e desmontagem

vb

1

3.200,00

3.200,00

6

Estrutural REV_04

2.4

Monitoramento de recalque (marcos + leituras topográficas periódicas) durante a obra

vb

1

4.500,00

4.500,00

2

Estrutural REV_04

3.1

Corte e abertura localizada do piso junto às bases de P2 e P3

vb

1

8.000,00

8.000,00

8

Estrutural REV_04

3.2

Retirada de revestimento, contrapiso e laje de piso danificada

vb

1

6.500,00

6.500,00

14

Estrutural REV_04

3.3

Carga, transporte e descarte de entulho (com CTR)

vb

1

4.500,00

4.500,00

14

Estrutural REV_04

4.1

Inspeção das bases, ligações, apoios e geometria da treliça

vb

1

8.000,00

8.000,00

7

Estrutural REV_04

4.2

Verificação do solo/base sob o piso (poço de inspeção) e registro fotográfico

vb

1

14.000,00

14.000,00

8

Estrutural REV_04

4.3

Levantamento topográfico de níveis/recalque (salão, mezanino e treliça)

vb

1

3.500,00

3.500,00

7

Estrutural REV_04

4.4

Sondagem à percussão SPT com laudo (NBR 6484) – mín. furos a definir com projetista

vb

1

16.000,00

16.000,00

8

Estrutural REV_04

4.5

Projeto estrutural de reforço (treliça, apoios e fundações dos pilares metálicos) + ART

vb

1

9.500,00

9.500,00

9

Estrutural REV_04

4.6

ART de execução / responsável técnico da obra

vb

1

1.500,00

1.500,00

9

Estrutural REV_04

5.1

Remoção de solo inadequado (fofo/colapsível)

vb

1

5.000,00

5.000,00

16

Estrutural REV_04

5.2

Fornecimento de material granular (brita graduada/rachão)

vb

1

6.000,00

6.000,00

16

Estrutural REV_04

5.3

Compactação mecânica em camadas (máx. 20 cm) com controle

vb

1

4.500,00

4.500,00

16

Estrutural REV_04

5.4

Lastro de brita

vb

1

4.000,00

4.000,00

16

Estrutural REV_04

6.1

Concreto estrutural (base/lajão/blocos)

vb

1

9.000,00

9.000,00

15

Estrutural REV_04

6.2

Aço para armadura

vb

1

8.000,00

8.000,00

15

Estrutural REV_04

6.3

Formas, espaçadores, arame recozido e consumíveis

vb

1

5.000,00

5.000,00

15

Estrutural REV_04

6.4

Chumbadores / elementos de fixação (inclui chumbamento químico)

vb

1

3.000,00

3.000,00

15

Estrutural REV_04

6.5

Reforço de fundações dos pilares P2/P3 (ex.: microestaca/estaca mega)

vb

1

10.000,00

10.000,00

15

Estrutural REV_04

6.6

Reforço, realinhamento e reaperto da treliça metálica e ligações; pintura anticorrosiva

vb

1

10.000,00

10.000,00

15

Estrutural REV_04

6.7

Macaqueamento controlado e renivelamento dos apoios

vb

1

4.000,00

4.000,00

15

Estrutural REV_04

7.1

Nova laje de piso em concreto armado / contrapiso

vb

1

8.000,00

8.000,00

17

Estrutural REV_04

7.2

Recomposição de piso/revestimento (porcelanato do salão)

vb

1

5.000,00

5.000,00

18

Estrutural REV_04

7.3

Acabamentos e arremates finais (rodapés, soleiras, juntas)

vb

1

7.000,00

7.000,00

18

Estrutural REV_04

7.4

Limpeza final e liberação da área

vb

1

6.000,00

6.000,00

20

Estrutural REV_04

8.1

Recuperação de divisórias em drywall (copa, DML, vestiário, WCs) – trincas e deslocamentos

vb

1

7.000,00

7.000,00

19

Estrutural REV_04

8.2

Recomposição de piso cerâmico sobre painel wall (copa, WCs, vestiário)

vb

1

8.000,00

8.000,00

19

Estrutural REV_04

8.3

Reposicionamento de bancada/pia da copa e revisão hidráulica/infiltrações

vb

1

3.000,00

3.000,00

19

Estrutural REV_04

8.4

Pintura das áreas recuperadas

vb

1

2.000,00

2.000,00

19

Estrutural REV_04

9.1

Locação de equipamentos e ferramentas especiais

vb

1

9.000,00

9.000,00

0

Estrutural REV_04

9.2

Frete / transporte de materiais

vb

1

8.000,00

8.000,00

0

Estrutural REV_04

9.3

Outros custos operacionais (hospedagem/alimentação equipe – Macaé)

vb

1

9.000,00

9.000,00

0

Estrutural REV_04

9.4

Alíquota de imposto sobre os serviços (base = itens 1.1 a 9.3)

%

17%

base = soma itens 1.1 a 9.3

42.568,00

0

Reforma light LPU

1.4

LAUDO TÉCNICO ESTRUTURAL

unit.

2

2.000,00

4.000,00

9

Reforma light LPU

2.1

MOBILIZAÇÃO DE OBRA

unit.

1

500,00

500,00

1

Reforma light LPU

2.2

DESMOBILIZAÇÃO DE OBRA

unit.

1

400,00

400,00

1

Reforma light LPU

2.3

DESLOCAMENTO DE EQUIPE - SOMENTE ACIMA DE 50 KM DA BASE.

km

500

2,50

1.250,00

1

Reforma light LPU

3.40

LOCAÇÃO DE ANDAIME METÁLICO TUBULAR DE ENCAIXE, TIPO DE TORRE, COM LARGURA DE 1 ATÉ 1,5 M E ALTURA DE 1,00 M, INCLUSIVE MONTAGEM

M²/MÊS

25

33,72

843,00

25

Reforma light LPU

4.6

PINTURA - FACHADA

m²

30

26,40

792,00

28

Reforma light LPU

5.1

DEMOLIÇÃO DE FORRO DE ESTUQUE OU GESSO EM PLACAS (COM BOTA FORA E TRANSPORTE)

m²

250

4,23

1.057,50

21

Reforma light LPU

5.22

DEMOLIÇÃO DE PAREDES EM DRYWALL E DIVISÓRIAS (COM BOTA FORA E TRANSPORTE)

m²

100

10,65

1.065,00

21

Reforma light LPU

5.32

DESMONTAGEM DE MOBILIÁRIO

m²

250

10,00

2.500,00

4

Reforma light LPU

5.33

RETIRADA DE LOUÇAS E METAIS - CONSIDERANDO 2 PROFISSIONAIS

diária

1

424,76

424,76

13

Reforma light LPU

5.34

RETIRADA DE APARELHOS SANITÁRIOS

unit.

1

13,92

13,92

13

Reforma light LPU

5.41

RETIRADA DE PISOS DE MADEIRA, CERÂMICO, PORCELANATO, VINÍLICO, FORMICA COM BOTA FORA

m²

200

13,00

2.600,00

14

Reforma light LPU

5.42

RETIRADA DE PORTAS, JANELAS, PORTÕES E ACESSÓRIOS DE MADEIRA, VIDRO, METÁLICOS (SE NECESSÁRIO COM BOTA FORA)

m²

20

25,00

500,00

11

Reforma light LPU

5.47

LOCAÇÃO DE CAÇAMBA ESTACIONÁRIA 4M³ (ENTULHO MISTO)

unit.

12

500,00

6.000,00

14

Reforma light LPU

6.11

DESMONTAGEM E MONTAGEM DO MOBILIÁRIO (MARCENEIRO E MONTADOR)

CJ

100

8,51

851,00

4

Reforma light LPU

6.16

CARGA MANUAL DE ENTULHO EM CAÇAMBA

m³

26

100,61

2.615,86

14

Reforma light LPU

6.18

RETIRADA DE CLIMATIZADORA E CONDENSADORA DE AR E TODA INFRA - 4 PROFISSIONAIS (SE NECESSÁRIO COM DESCARTE)

diária

4

880,00

3.520,00

23

Reforma light LPU

6.19

CARREGAMENTO E TRANSPORTE DE MOBILIÁRIO (CAMINHÃO 3/4 COM CAPACIDADE DE 21M³ E AJUDANTE PARA CARREGAMENTO)

vb

2

864,50

1.729,00

12

Reforma light LPU

7.5

FORNECIMENTO E INSTALAÇÃO LONA PLASTICA PRETA, PARA IMPERMEABILIZAÇÃO, ESPESSURA 150 MICRAS.

m²

200

7,13

1.426,00

17

Reforma light LPU

12.6

DRY ST/MDF/ST - PAREDE DE DRYWALL COM REFORÇO EM MDF EM 1 LADO - COMPOSTA POR PERFIS GUIAS E MONTANTES EM AÇO GALVANIZADO, COM UMA CHAPA DE GESSO STANDARD EM CADA FACE, UMA CHAPA DE MDF NA PARTE INTERNA E MONTANTES SIMPLES A CADA 500 MM.

m²

190

125,41

23.827,90

24

Reforma light LPU

12.13

CANTONEIRA DE ABAS IGUAIS 5,8" EM ALUMÍNIO NA COR BRANCA COM H=2,00M PARA PROTEÇÃO DE QUINAS VIVAS DE PAREDES E PILARES

unit.

16

56,50

904,00

24

Reforma light LPU

15.01

PLACA MINERAL MODULAR 625X1250MM COR BRANCA COM PERFIL EM AÇO NAVAL COM PINTURA BRANCA

m²

250

124,19

31.046,81

25

Reforma light LPU

18.4

MÃO DE OBRA PARA INSTALAÇÃO DE PORCELANATO ESMALTADO ELIANE MUNARI CONCRETO OU PORTINARI URBAN CONCRETO OU PORTOBELLO SAMPA PACAEMBU NAT 90X90 RET E FORNECIMENTO DE ARGAMASSA E REJUNTE (PISO DE FORNECIMENTO DA DPSP)

m²

220

50,00

11.000,00

18

Reforma light LPU

18.5

MÃO DE OBRA PARA INSTALAÇÃO E CORTE DE RODAPÉ H= 10CM ESMALTADO ELIANE MUNARI CONCRETO OU PORTINARI URBAN CONCRETO OU PORTOBELLO SAMPA PACAEMBU NAT 90X90 RET E FORNECIMENTO DE ARGAMASSA E REJUNTE (PISO DE FORNECIMENTO DA DPSP)

m²

70

50,00

3.500,00

18

Reforma light LPU

18.6

MÃO DE OBRA PARA INSTALAÇÃO DE PORCELANATO ESMALTADO ELAINE AMAZONIA AMENDOA OU PORCELANATO ESMALTADO PORTINARI ABITARE AC 19X90 RET (PISO DE FORNECIMENTO DA DPSP)

m²

30

50,00

1.500,00

18

Reforma light LPU

20.10

ABERTURA DE LUMINÁRIAS

m²

120

31,32

3.758,27

25

Reforma light LPU

21.1

FUNDO PREPARADOR PARA PINTURA EM PAREDE DE ALVENARIA/GESSO

m²

400

10,00

4.000,00

27

Reforma light LPU

21.4

MASSA CORRIDA (SUVINIL/ CORAL) SOBRE PAREDE/FORRO

m²

260

15,00

3.900,00

27

Reforma light LPU

21.7

PINTURA ACRÍLICO FOSCO SUAVE (SUVINIL) BRANCO NEVE / PAPEL DE PRESENTE - PARA USO INTERNO

m²

260

22,00

5.720,00

27

Reforma light LPU

24.2

MOLA PARA PORTA (DORMA)

unit.

6

300,00

1.800,00

26

Reforma light LPU

24.3

GRELHA EM ALUMÍNIO PARA PORTA, COM PINTURA ELETROSTÁTICA BRANCA

unit.

6

90,00

540,00

26

Reforma light LPU

25.3

PORTA DE ABRIR UMA FOLHA DE MADEIRA SÓLIDA 0,80 X 2,10M COM BATENTE E GUARNIÇÕES, FUNDO SELADOR E PINTURA COM ESMALTE SINTÉTICO BRANCO BRILHO. INCLUSO DOBRADIÇAS REF.: 1535 CR - PAPAIZ, MOLA AÉREA REF.: 200/3 - DORMA, FECHADURA COMPLETA REF.: 271 R61 CR 340MZ - PAPAIZ, CHAPA EM ALUMÍNIO FOSCO E=1,5MM NA ÁREA DO PUXADOR MEDINDO 40X20CM NOS DOIS LADOS E SEM GRELHA

unit.

6

1.308,20

7.849,20

26

Reforma light LPU

25.96

GUIA DA PORTA DE ENROLAR COM REFORÇO EM AÇO OU FERRO CONFORME PADRÃO DE LOJA RUA E SHOPPING

KG

30

106,90

3.207,00

26

Reforma light LPU

27.168

TUBO PVC SOLDÁVEL Ø 100 MM, SÉRIE REFORÇADA PARA ÁGUA PLUVIAL

Mt.

30

33,44

1.003,20

22

Reforma light LPU

27.207

TROCA DE DRENO PARA AR CONDICIONADO - TUBULAÇÕES, CONEXÕES (AMANCO/ TIGRE, COM ISOLAMENTO TÉRMICO) - NÃO INTERLIGAR NO ESGOTO

ponto

5

350,00

1.750,00

23

Reforma light LPU

28.75

CANALETA EM PVC SEMI ABERTA 50X80X2.000MM, RÍGIDO, RESISTENTE AO IMPACTO 2,1-100KG.CM/CM, RESISTÊNCIA TÉRMICA MÁXIMA 70°C, PARA ORGANIZAÇÃO DOS CABOS ELÉTRICOS, NO INTERIOR DO QUADRO ELÉTRICO

unit.

20

47,71

954,20

22

Reforma light LPU

28.84

ELETRODUTO DE AÇO GALVANIZAÇÃO ELETROLÍTICA LEVE INCLUSIVE CONEXÕES Ø 32 MM 1 1/4"

Mt.

55

20,91

1.150,05

22

Reforma light LPU

28.94

CONDULETE EM LIGA DE ALUMÍNIO FUNDIDO COM OU SEM ROSCA TIPO "T" Ø 3/4" E TAMPA CEGA

unit.

15

25,57

383,55

22

Reforma light LPU

28.309

PARAFUSO CABEÇA LENTILHA 1/4" X 3/4"

unit.

500

2,56

1.280,00

22

Reforma light LPU

28.339

PONTO DE REDE COM INSTALAÇÃO DE CABO DE REDE U/UTP CAT.6, 4 PARES TRANÇADOS EM INFRAESTRUTURA EXISTENTE, DISTÂNCIA MÁXIMA DE 10,00M

ponto

10

117,45

1.174,50

22

Reforma light LPU

28.340

PONTO DE REDE COM INSTALAÇÃO DE CABO DE REDE U/UTP CAT.6, 4 PARES TRANÇADOS EM INFRAESTRUTURA EXISTENTE, DISTÂNCIA MÁXIMA DE 30,00M

ponto

25

313,35

7.833,75

22

Reforma light LPU

29.19

CABO ISOLADO EM EPR 2,50 MM² - 0,6/1 KV - 90°C - FLEXÍVEL

Mt.

650

4,50

2.925,00

22

Reforma light LPU

29.41

PLUG FEMEA 2P+T -AXIAL 10A - 250V - PARA RABICHO LUMINARIA

unit.

125

10,00

1.250,00

22

Reforma light LPU

29.42

PLUG MACHO 2P+T - AXIAL 10A - 250V - PARA RABICHO LUMINARIA

unit.

125

10,00

1.250,00

22

Reforma light LPU

29.47

TOMADA ELÉTRICA NO MÓVEL OU PAREDE COM 1 PLUG 2P+T 10A, MONTADA EM CONDULETE DE ALUMÍNIO TIPO "E" DE Ø 3/4" E TAMPA PARA CONDULETE COM 1 POSTO

unit.

25

55,72

1.393,00

22

Reforma light LPU

29.69

UNIDUT RETO Ø 3/4"

unit.

30

7,40

222,00

22

Reforma light LPU

29.122

CABO ISOLADO EM PVC 6,00 MM² - 750 V - 70°C - FLEXÍVEL AFUMEX OU EQUIVALENTE

Mt.

300

6,20

1.860,00

22

Reforma light LPU

29.140

MÃO DE OBRA PARA MONTAGEM E INSTALAÇÃO DE LUMINÁRIAS LED COM RABICHOS (MACHO/FÊMEA) DE EMBUTIR EM FORROS DE DRYWALL/ MINERAL/ PVC - (LUMINÁRIAS DE FORNECIMENTO DA DPSP)

unit.

125

35,00

4.375,00

22

Reforma light LPU

29.158

LUMINÁRIA DE LED COMPLETA PARA EMERGÊNCIA DE 15 W - TIPO ROTA DE FUGA.

unit.

5

80,00

400,00

22

Reforma light LPU

29.160

REMANEJAMENTO DE CABEAMENTOS (CIRCUITOS ELÉTRICOS)

m²

60

30,00

1.800,00

22

Reforma light LPU

35.30

INSTALAÇÕES ELÉTRICAS - DESATIVAÇÃO OU ATIVAÇÃO DAS INSTALAÇÕES EXISTENTES (SE ATIVAÇÃO E DESATIVAÇÃO CONSIDERAR 2 UNIDADES)

unit.

15

600,00

9.000,00

22

Reforma light LPU

36.4

INSTALAÇÃO DE SPLIT - 18.000 BTUS (EQUIPAMENTO FORNECIDO PELA DPSP) (MATERIAL + MÃO DE OBRA)

unit.

1

1.300,00

1.300,00

23

Reforma light LPU

36.7

INSTALAÇÃO DE SPLIT - ACIMA DE 24 .000 BTUS (EQUIPAMENTO FORNECIDO PELA DPSP) (MATERIAL + MÃO DE OBRA)

unit.

4

3.000,00

12.000,00

23

Reforma light LPU

36.9

CARGA FREON R-410 DUPONT

unit.

2

900,00

1.800,00

23

Reforma light LPU

36.12

CARGA DE NITROGÊNIO

unit.

2

90,00

180,00

23

Reforma light LPU

36.13

CARGA OXIACETILENO

unit.

2

90,00

180,00

23

Reforma light LPU

36.19

CABO ISOLADO EM EPR 4,00 MM² - 0,6/1 KV - 90°C - FLEXÍVEL

Mt.

100

5,59

559,00

23

Reforma light LPU

38.1

LIMPEZA FINAL PARA ENTREGA DA OBRA - MÃO DE OBRA

m²

1200

6,38

7.656,00

20

Reforma light LPU

41.4

ART DE PROJETO DEVIDAMENTE QUITADA COM ART PARA OBRA OU SERVIÇO COM CONTRATOS ACIMA DE R$15.000,00 - ART. 2º § 1º DA RESOLUÇÃO Nº 1.067/15 E ANEXO DA DECISÃO PLENÁRIA (PL) Nº 1.759/17, REGISTRO PRINCIPAL (MATRIZ) OU REGISTRO SECUNDÁRIO, EMISSÃO DE CERTIDÃO DE REGISTRO E QUITAÇÃO DE PESSOA JURÍDICA OU PESSOA FÍSICA, REQUERIMENTO DE REGISTRO DE OBRA INTELECTUAL E VISTO DE REGISTRO

vb

1

1.293,44

1.293,44

9

Reforma light LPU

46.57

TUBO ESPONJOSO DE AR CONDICIONADO

ml

80

9,42

753,60

23

Reforma light LPU

48.31

FITA TELADA PARA DRYWALL

m²

15

12,38

185,70

24

Reforma light LPU

48.67

FIXAÇÃO DE VIDROS DE FACHADA ESP 8MM COM COLA PROPRIA MÃO DE OBRA E APLICAÇÃO

m²

20

150,00

3.000,00

28

Reforma light LPU

48.68

REMOÇÃO DE VIDRO DE VITRINE

m²

20

80,00

1.600,00

11

Reforma light LPU

S/N-1

Fornecimento e instalaçao de Malha Lycra para faseamento de obra

m²

120

61,41

7.369,20

3

Reforma light LPU

S/N-2

FORNECIMENTO E INSTALAÇÃO DE FECHADURA ELETRONICA

unit.

1

850,00

850,00

26

10.3 Conflitos de escopo REV_04 × LPU

Tema

Itens REV_04

Valor REV_04

Itens LPU

Valor LPU

Exposição (menor)

Ação recomendada

Isolamento da área

1.1

9.500,00

S/N-1

7.369,20

7.369,20

Separar: LPU para a loja inteira, REV_04 só para a faixa estrutural e o mezanino.

Mobilização

1.2

4.500,00

2.1, 2.2, 2.3

2.150,00

2.150,00

Manter uma só por pedido e declarar qual cobre o deslocamento para Macaé.

Mobiliário

1.4

2.500,00

5.32, 6.11, 6.19

5.080,00

2.500,00

Vincular cada pedido a ambientes distintos no layout.

Demolição de piso

3.2

6.500,00

5.41

2.600,00

2.600,00

REV_04 = faixa da divisa esquerda (fig. B do laudo); LPU = restante.

Entulho e caçambas

3.3

4.500,00

5.47, 6.16

8.615,86

4.500,00

Ratear caçambas por frente e registrar CTR por pedido.

Porcelanato do salão

7.2

5.000,00

18.4

11.000,00

5.000,00

REV_04 só na faixa reconstruída; LPU no restante. Conferir m² com o layout.

Projeto, ART e laudo

4.5, 4.6

11.000,00

1.4, 41.4

5.293,44

5.293,44

Confirmar se o laudo EGUTI foi pago pela LPU 1.4 e não repetir ART.

Limpeza final

7.4

6.000,00

38.1

7.656,00

6.000,00

Manter só a LPU 38.1, com m² corrigido.

Retirada de vidro (interno à LPU)

—

0,00

5.42, 48.68

2.100,00

500,00

Confirmar com a DPSP se são vidros diferentes; senão excluir um.

10.4 Pendências iniciais (abertura 23/10/2026)

Nº

Tipo

Descrição

Impacto

Ativ.

Responsável

Depende do cliente

Exibir ao cliente

1

Trava

Escorar a viga principal (treliça P3–P4, 10,00 m) conforme definição do RT

Bloqueia todas as demolições (nº 11 a 14 e 21)

6

Engenheiro de obras

Não

Não

2

Risco

Iniciar leituras periódicas dos marcos de nível para confirmar que o escoramento estabilizou os recalques

Recalque ativo = risco de colapso localizado (laudo 7.4.a)

2

Engenheiro de obras

Não

Não

3

Decisão do cliente

Autorização formal de baixa de patrimônio para descarte de gôndolas e geladeira

Sem autorização, nº 12 não pode ser executada

12

Analista de obras / COP

Sim

Sim

4

Decisão do cliente

Confirmar se o vidro a retirar é de fachada; se for, obter autorização do Best Center / condomínio

Bloqueia nº 11 e 28

11

Analista de obras / COP

Sim

Sim

5

Decisão do cliente

Registrar formalmente que Mall, estacionamento e drenagem do centro comercial estão fora do escopo

Evita assumir passivo classificado como alto risco (laudo 7.2)

	GO

Sim

Sim

6

Decisão do cliente

Definir qual banheiro será desmobilizado: térreo ou WC do mezanino

Define escopo de nº 13 e 18

13

Engenheiro de obras

Sim

Sim

7

Escopo

Precificar itens sem cobertura: descarte de gôndolas/geladeira, reexecução do banheiro e relatório fotográfico. Retirada de louças e de vidro já consta na LPU (5.33, 5.34, 5.42, 48.68)

Execução sem receita

	Orçamentos

Não

Não

8

Conflito

Resolver as 9 sobreposições REV_04 x LPU (aba CONFLITOS) e registrar a fronteira por área

Glosa na medição ou cobrança em duplicidade

	GO

Sim

Não

9

Quantitativo

LPU 38.1 – limpeza final de 1.200 m², contra ≈ 224 m² somando as áreas do layout aprovado

Glosa provável de ≈ R$ 6.200 na conferência DPSP

20

Orçamentos

Não

Não

10

Quantitativo

LPU 18.4 + 18.6 – porcelanato de 250 m², contra 142,93 m² de área de vendas + medicamentos no térreo

Compra ou medição acima do real

18

Orçamentos

Não

Não

11

Quantitativo

LPU 21.1 – fundo preparador em 400 m², enquanto massa e pintura somam 260 m²

Ajustar quantidade ou justificar

27

Orçamentos

Não

Não

12

Comercial

Definir com a DPSP o critério do imposto no REV_04: 17% por fora (R$ 42.568) ou por dentro (≈ R$ 51.287)

Diferença de ≈ R$ 8.700 na margem

	Financeiro

Sim

Não

13

Comercial

Recolocar no REV_04 a observação do item 7.2: "mesmo padrão existente, sujeito a disponibilidade"

Proteção caso o porcelanato esteja fora de linha

18

Orçamentos

Não

Não

14

Dados

LPU: dois itens sem código (malha lycra e fechadura) e fechadura sem parcela de mão de obra (regra 40/60)

Questionamento na conferência DPSP

	Orçamentos

Não

Não

10.5 Feriados considerados

*	02/11/2026 – Finados
*	15/11/2026 – Proclamação da República
*	20/11/2026 – Consciência Negra
*	25/12/2026 – Natal
*	01/01/2027 – Confraternização Universal
*	08/02/2027 – Carnaval (ponto facultativo – ajustar)
*	09/02/2027 – Carnaval (ponto facultativo – ajustar)
*	26/03/2027 – Sexta-feira Santa
*	21/04/2027 – Tiradentes
*	23/04/2027 – São Jorge (estadual RJ)

10.6 Referências de área do layout aprovado

Área de vendas 104,41 m² · medicamentos 38,52 m² · copa 9,37 m² · DML 1,11 m² · gerências 6,25 e 6,62 m² · WC fem. e masc. 1,60 m² cada · estoque 34,20 m² · áreas 5,72 m² (×2) · plataforma da caixa d'água 8,46 m². Soma ≈ 223,6 m².

________________________________

11. Documentos-fonte

*	Orçamento Intervenção Estrutural DP Macaé 3 – MANFAC – REV_04 (.xlsx)
*	DSP – LPU Padrão – Reforma Light – DP Macaé 3 – rev 2 (.xlsx)
*	Laudo Técnico Estrutural EGUTI – Rev.00 (09/06/2026)
*	Layout aprovado – Macaé RJ (.pdf)
*	Orientação Inicial Obra Macaé 3 – MANFAC (.docx)
*	Fases da Obra – Macaé 3 (.docx)
*	SGO_Obra_Macae3_DPSP_MANFAC.xlsx (protótipo)
*	Prancha "Faseamento Fase 1 – DP Macaé 3" (canvas)

 

 

Atenciosamente,

 

 

Eduardo Maia





Manutenção e Facilities



+55 21 9 7112-7588



eduardo.maia@manfac.com.br <mailto:eduardo.maia@manfac.com.br> 

 

Aqui, excelência não se negocia.

 

