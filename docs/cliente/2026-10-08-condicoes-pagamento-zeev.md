# 08/10/2026 — Planilhas de condição de pagamento enviadas pelo cliente (Gestão de Fornecedores)

Recebidas do João em 08/10/2026, em resposta à pendência **c** do mockup. Originais versionados em
`2026-10-07-gestao-de-fornecedores/2026-10-08-*.xlsx`.

Conversão literal célula a célula (exceljs). Única mudança de forma: células mescladas, que o
leitor repete em cada coluna, aparecem uma vez só. Fórmulas mostram o valor calculado salvo no arquivo.

**"Condições pagamento zeev.xlsx" contém tudo de "Padronizacao_condicoes_pagamento_Zeev.xlsx"
(conteúdo idêntico nas 5 abas comuns) mais duas abas: Governança e Alçadas Aprovação.**
Por isso abaixo vai só o arquivo maior.

### Arquivo: Condições pagamento zeev.xlsx

#### Aba: Resumo

| 1 | Padronização de Condições de Pagamento - Parceiros / Obras / Serviços Spot |
| 3 | Base analisada | Controle de obras.xlsx |  | Resumo da recomendação |
| 4 | Critério principal | Valor de mão de obra / contratação do parceiro |  | 1 | Obra pequena | Até R$ 1.500 | Pagamento único após execução aprovada | Baixo risco e maioria da base concentrada nessa faixa |
| 5 | Registros com valor de mão de obra | 127 |  | 2 | Obra média | > R$ 1.500 até R$ 5.000 | 50/50 ou 100% pós execução, conforme risco | Faixa intermediária até o P75 da base |
| 6 | Registros de obras/serviços não Spot | 102 |  | 3 | Obra maior | > R$ 5.000 | 30/30/40 por medição/etapa | Top 25% da base; exige maior controle |
| 7 | Mediana não Spot | R$ 1.825 |  | 4 | Obra crítica / exceção | > R$ 8.000 ou escopo sensível | 30/30/30/10 ou aprovação especial | Acima do P90 aproximado; reforçar aceite final |
| 8 | Percentil 75 não Spot | R$ 5.000 |  | 5 | Serviços Spot recorrentes | Contrato guarda-chuva | Mensal consolidado ou tabela fixa | Evita renegociação e retrabalho por atendimento |
| 9 | Percentil 90 não Spot | R$ 7.900 |  |  |  |  |  |  |
| 11 | Leitura executiva |
| 12 | A alçada de pequena obra foi fixada em até R$ 1.500 porque esse valor cobre aproximadamente metade dos registros de obras/serviços não Spot e representa serviços curtos de baixo risco. |
| 13 | A alçada média foi definida até R$ 5.000 porque esse valor coincide com o percentil 75 da base; até esse limite ainda estamos dentro do comportamento mais comum da planilha. |
| 14 | A alçada de obra maior começa acima de R$ 5.000 porque, a partir daí, o contrato entra no grupo de maior exposição financeira e deve ter pagamento por etapas ou medição. |
| 15 | A faixa crítica acima de R$ 8.000 é opcional, mas recomendada, pois fica próxima ao percentil 90 e concentra obras com risco relevante de escopo, retrabalho ou saldo contratual. |
| 16 | No Zeev, a condição deve nascer na contratação/contrato e a medição deve apenas comprovar execução; o Financeiro programa a data efetiva de pagamento depois da aprovação. |

#### Aba: Alcadas de Valor

| 1 | Alçadas sugeridas por valor de obra / contratação |
| 3 | Alçada | Faixa de valor de Mão de Obra | Condição padrão Zeev | Aprovação sugerida | Documentos mínimos | Controle Zeev | Quando usar | Justificativa |
| 4 | Pequena | Até R$ 1.500 | OBRA_PEQUENA_UNICA_D7 | Gestor responsável | NF/recibo válido + evidência simples | Contrato simplificado + medição única | Serviços curtos, reparos simples, apoio pontual | Faixa cobre cerca de metade dos registros não Spot; baixo risco financeiro |
| 5 | Média | > R$ 1.500 até R$ 5.000 | OBRA_MEDIA_50_50 | Gestor + Financeiro | NF + fotos/evidências + aceite do gestor | Contrato específico + medição final | Serviços com alguma mobilização, mas escopo controlado | Até o P75 da base; parcela final reduz risco de pagar sem aceite |
| 6 | Maior | > R$ 5.000 | OBRA_MAIOR_30_30_40 | Gestor + Financeiro + responsável da área | NF + relatório/fotos + medição parcial/final | Contrato específico + saldo contratual + múltiplas medições | Obras, reformas, telhado, AR, elétrica, civil ou escopos relevantes | Acima do P75; top 25% da base merece controle por etapa |
| 7 | Crítica / exceção | > R$ 8.000 ou alto risco | OBRA_RETENCAO_10 ou EXCECAO_APROVACAO | Gestor + Financeiro + Diretoria/Coordenação | Documentação completa + aceite formal final | Contrato + saldo + bloqueio de excesso + aditivo | Obras complexas, novo parceiro, risco técnico, garantia, retrabalho | Próximo ao P90; recomendável segurar retenção/aceite final |

#### Aba: Condicoes de Pagamento

| 1 | Condições de pagamento padronizadas para cadastro no Zeev |
| 3 | Código Zeev | Tipo | Faixa / Critério | Parcelas | Percentuais | Gatilho da Parcela 1 | Gatilho da Parcela 2 | Gatilho da Parcela 3 / Final | Como será na prática | Observações |
| 4 | OBRA_PEQUENA_UNICA_D7 | Obra pequena | Até R$ 1.500 | 1 | 100% | Não aplicável | Não aplicável | Após execução aprovada + documentação mínima | Solicitante abre contrato simplificado; mede uma vez; Financeiro programa D+7 ou calendário financeiro | Não permitir pagamento antes da execução, salvo exceção |
| 5 | OBRA_MEDIA_50_50 | Obra média | > R$ 1.500 até R$ 5.000 | 2 | 50% / 50% | Contrato aprovado + início/mobilização autorizada | Conclusão aprovada + NF + evidências | Não aplicável | Contrato nasce com 2 parcelas; medição final libera a segunda parcela | Usar quando há custo de mobilização, mas escopo é controlado |
| 6 | OBRA_MEDIA_UNICA_D15 | Obra média baixo risco | > R$ 1.500 até R$ 5.000 e baixo risco | 1 | 100% | Não aplicável | Não aplicável | Após conclusão aprovada + NF | Contrato com medição única; Financeiro programa D+15 | Alternativa ao 50/50 para parceiros confiáveis e serviços rápidos |
| 7 | OBRA_MAIOR_30_30_40 | Obra maior | > R$ 5.000 | 3 | 30% / 30% / 40% | Contrato aprovado + início/mobilização | Medição parcial aprovada | Conclusão + aceite final + NF | Zeev controla saldo; cada medição fica vinculada ao contrato | Condição principal para obras maiores |
| 8 | OBRA_RETENCAO_10 | Obra crítica / garantia | > R$ 8.000 ou risco técnico | 4 | 30% / 30% / 30% / 10% | Início/mobilização | Medição parcial | Conclusão aprovada; retenção após aceite/garantia | Últimos 10% só após aceite final ou prazo acordado | Usar com cautela para não gerar excesso de controle em serviços simples |
| 9 | OBRA_MEDICAO_MENSAL | Obra contínua | Contrato com medições recorrentes | Mensal | 100% do valor medido | Não aplicável | Não aplicável | Medição mensal aprovada + NF | Contrato tem valor total/estimado; medição mensal gera pagamento | Ideal para contratos contínuos ou guarda-chuva de manutenção |
| 10 | SPOT_UNICO_D7 | Serviço Spot simples | Atendimento avulso até R$ 1.500 | 1 | 100% | Não aplicável | Não aplicável | Atendimento concluído + evidência + NF | Solicitante vincula ao contrato spot; Financeiro programa D+7 | Caminhão pipa avulso, desentupidora, dedetização simples |
| 11 | SPOT_UNICO_D15 | Serviço Spot padrão | Atendimento avulso acima de R$ 1.500 ou fornecedor com prazo | 1 | 100% | Não aplicável | Não aplicável | Atendimento concluído + NF aprovada | Financeiro programa D+15 ou calendário financeiro | Melhor para melhorar prazo de caixa |
| 12 | SPOT_MENSAL_CONSOLIDADO | Spot recorrente | Múltiplos atendimentos no mês | 1 | 100% do consolidado | Não aplicável | Não aplicável | Fechamento mensal aprovado + NF consolidada | Atendimentos são acumulados; fechamento mensal gera pagamento | Reduz retrabalho e volume de solicitações de pagamento |
| 13 | SPOT_TABELA_FIXA | Spot recorrente com preço fixo | Contrato guarda-chuva com tabela | 1 | 100% conforme tabela | Não aplicável | Não aplicável | Serviço selecionado + evidência + NF | Solicitante escolhe serviço da tabela; Zeev puxa valor e condição | Recomendado para caminhão pipa, dedetização, desentupidoras |
| 14 | MATERIAL_MEDIANTE_NF | Material | Compra/entrega de material | 1 | 100% | Não aplicável | Não aplicável | Entrega comprovada + NF aprovada | Separar material da mão de obra no contrato/medição | Evita misturar lógica de empreiteiro com compra de material |
| 15 | EXCECAO_APROVACAO | Exceção comercial | Fora do padrão | 0 | A definir | Justificativa obrigatória | Aprovação adicional | Conforme aprovação | Fluxo exige justificativa e aprovação superior antes de liberar | Usar para antecipação, condição especial, aditivo ou urgência |

#### Aba: Fluxo Zeev

| 1 | Fluxo prático no Zeev |
| 3 | Etapa | Responsável | O que acontece | Campos/controles necessários | Regra de negócio | Saída esperada |
| 4 | 1. Cadastro da contratação | Solicitante | Abre a contratação/contrato no Zeev | Fornecedor, escopo, local, valor, condição padrão, documentos, centro de custo | Condição de pagamento nasce aqui e não na medição | Contrato CT aprovado ou devolvido |
| 5 | 2. Aprovação da contratação | Gestor / Financeiro | Valida escopo, valor e condição comercial | Alçada de valor, orçamento, documentos obrigatórios | Condição fora do padrão exige exceção/aditivo | Contrato aprovado e ativo |
| 6 | 3. Execução do serviço | Parceiro | Executa conforme escopo contratado | Contrato ativo e escopo aprovado | Não deve haver pagamento sem evidência de execução, salvo exceção | Serviço pronto para medição |
| 7 | 4. Medição | Solicitante / Gestor | Registra valor medido e evidências | Contrato vinculado, NF, fotos, relatório, saldo disponível | Medição não pode alterar condição comercial | Medição aprovada ou pendente de correção |
| 8 | 5. Programação financeira | Financeiro | Programa parcelas/datas efetivas | Dados puxados do contrato e da medição | Financeiro define datas, mas não muda condição aprovada sem aditivo | Solicitação de pagamento criada |
| 9 | 6. Pagamento e baixa | Financeiro | Executa pagamento e baixa status | Data de pagamento, valor pago, comprovante | Controlar pago x aprovado x saldo | Contrato/medição atualizados |

#### Aba: Simulador

| 1 | Simulador simples de classificação e condição sugerida |
| 3 | Valor Mão de Obra | Tipo | Risco/Observação | Alçada sugerida | Condição Zeev | Parcelas | Percentuais | Observação prática |
| 4 | 1000 | Obra | Baixo risco | Pequena | OBRA_PEQUENA_UNICA_D7 | 1 | 100% | Pagar após execução aprovada |
| 5 | 3500 | Obra | Médio risco | Média | OBRA_MEDIA_50_50 | 2 | 50% / 50% | Pode ter 50% início e 50% final |
| 6 | 6500 | Obra | Maior controle | Maior | OBRA_MAIOR_30_30_40 | 3 | 30% / 30% / 40% | Usar medição parcial e saldo contratual |
| 7 | 12000 | Obra | Crítico | Crítica / exceção | OBRA_RETENCAO_10 | 4 | 30% / 30% / 30% / 10% | Exigir aprovação reforçada/retenção |
| 9 | Como usar: altere os valores da coluna A e veja a alçada e a condição sugerida. Para serviços Spot, prefira as condições SPOT_UNICO_D7, SPOT_UNICO_D15, SPOT_MENSAL_CONSOLIDADO ou SPOT_TABELA_FIXA conforme recorrência e contrato guarda-chuva. |

#### Aba: Governança

| 1 | Governança e Regras Complementares |
| 3 | Tema | Regra |
| 4 | Classificação | Spot, Manutenção, Obra, Material ou Emergencial |
| 5 | Prazo Padrão | Spot D+15 / Recorrente D+28 / Emergencial por exceção |
| 6 | Emergencial | Justificativa obrigatória e aprovação adicional |
| 7 | Documentação | CNPJ, dados bancários, proposta, NF, evidência e certidões quando aplicável |
| 8 | Homologação | Fornecedor novo exige validação cadastral |
| 9 | Centro de Custo | Obrigatório em toda contratação |
| 10 | Aceite | Nenhum pagamento final sem aceite operacional |
| 11 | Retenção | 5% a 10% para obras críticas quando aplicável |

#### Aba: Alçadas Aprovação

| 1 | Alçadas de Aprovação |
| 3 | Valor | Aprovador |
| 4 | Até R$ 1.500 | Coordenador/Gestor |
| 5 | Até R$ 5.000 | Gerente |
| 6 | Acima de R$ 5.000 | Diretor |
| 7 | Acima de R$ 10.000 | Diretor + Financeiro |
