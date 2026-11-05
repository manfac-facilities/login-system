# RH: o que as respostas do cliente mudam (05/11/2026)

**Situação:** análise do coordenador, nada aprovado. Atualiza `2026-11-05-proposta-fases-e-decisoes.md` onde houver conflito.
Respostas literais em `docs/cliente/2026-11-05-rh-respostas-do-cliente.md`.

**Fontes:** respostas do cliente; e-mail "ENC: Folha de pagamento 10/2026 - MANFAC" no Gmail do João (thread
`1a1ad0ad9c051571`, 05/11); coleção pública da API do VR Ponto; consultas agregadas e só de leitura em produção
(`iyytcavcgukfjnjjrerx`), sem nome ou valor por pessoa.

**De propósito fora do repositório:** o corpo do e-mail e os PDFs, porque trazem nome, CPF, salário e desconto de pessoas.

## O que o banco mostrou

| Fato | Medição |
|---|---|
| Folha lançada hoje | Categoria "Salários", `pix_chave`, fornecedor de catálogo, uma solicitação por pessoa |
| Vínculo com o RH | 24 de 24 CLT ativos têm solicitação em "Salários", achados pelo CPF. 24 de 26 PJ estão no catálogo. O campo `fornecedor_omie_codigo` vazio não impede ligar pelo CPF |
| Folha de outubro | 24 solicitações, enviadas no dia do vencimento (06/10), **todas emergenciais**, indo para o diretor |
| Folha de novembro | 23 solicitações enviadas em 27/10, um dia depois da folha definitiva, vencimento 09/11, nenhuma emergencial |
| Rateio da folha | Sempre 1 linha: DPSP 26, Profarma 23. Nenhuma em OBRAS ou SPOT |
| Rateio no cadastro | 47 pessoas com 1 centro de custo, 2 com 2 e 1 com 4 (6 centros de custo distintos) |
| FGTS | 8 solicitações, sempre `pix_qrcode` |
| VR | 5 por `pix_qrcode` e 2 por `pix_chave`; nenhuma por boleto |
| VT e parecidos | Vale Transporte: 1 boleto e 1 QR. Transporte Urbano: 3 por `pix_chave`, 2 pessoas |
| INSS, IRRF, PIS | As categorias existem no catálogo, com **zero solicitações** |
| Remuneração PJ | 61 solicitações, `pix_chave`: 55 em CPF (30 documentos) e 6 em CNPJ (3 documentos). 1 tem anexo |
| Categorias fixas | Já estão: Vale Refeição, Seguro de Vida, Remuneração PJ, Prêmios, Comissões. Faltam: Salários, FGTS, Vale Transporte, Transporte Urbano, celular |

## O que o e-mail mostrou

Processo da contabilidade (Grupo Bansemer, por ticket):

1. O RH envia a folha de ponto.
2. A contabilidade devolve a prévia.
3. O RH envia os descontos, entre eles **multa de trânsito e avaria de carro**, e pedidos de ajuste.
4. Sai a prévia retificada e depois a folha definitiva. **Depois do envio ao eSocial, a folha não reabre:** correção só no fechamento seguinte.

Em 10/2026, o ciclo começou e terminou em 26/10; a data de pagamento é 07/11 e o FGTS vence em 19/11, incluindo a parte do
empréstimo. A contabilidade avisa que atraso nessa guia impede recalcular a parcela do consignado. INSS, IRRF e PIS têm
"envio posterior".

São 8 PDFs: Relatório de Líquidos, Folha de pagamento, Contracheque, Guia FGTS, Relatório FGTS, Guia Consignado, Relatório
consignado e Encargos de INSS. **O conector do Gmail não baixa anexos, então ainda não li nenhum.** Sem isso, não sei se o
PDF traz texto legível, CPF ou matrícula.

## O que a API do VR Ponto oferece

O sistema é o Pontomais (`app.pontomais.com.br`), com 154 operações documentadas e autenticação pelo header `access-token`.
Li só a documentação; **não testei com token**. Ela diz que a API precisa estar contratada para o token aparecer, em
Marketplace, com credencial de administrador.

| Serve para | Operação | Dados |
|---|---|---|
| Ligar as pessoas | `GET employees`, `reports/employees` | **CPF**, e-mail, matrícula, centro de custo, é CLT |
| VR | `reports/benefits` | Dias previstos, descontados, trabalhados e total |
| Quem fica de fora | `reports/absences`, `employees/{id}/absences` | Férias e afastamentos com datas |
| Horas extras | `reports/extra_times` | Por dia: marcações, horas normais, extras e motivo |
| Banco de horas e jornada | `reports/time_balances`, `reports/period_summaries` | Saldos, faltas, ajustes |
| Enviar à contabilidade | `custom_exports`, `reports/closing_mirrors` | Exportação da folha e fechamento |
| Aviso em tempo real | Webhooks | Registro de ponto, criação de colaborador e outros eventos |

**Cuidado:** a documentação também tem operações de escrita (criar, editar e inativar). A integração deve só ler, e o token
fica guardado como segredo. A documentação não diz se dá para restringir o token a leitura.

## O que muda na proposta

**Decisão 1 (folha no Financeiro): o cliente respondeu.** Uma solicitação por pessoa, igual a hoje, criada pelo sistema a
partir dos arquivos. Isso derruba minha recomendação de regularização. Os motivos que eu tinha contra esse caminho também caem:

- "0 de 50 ligados ao Omie": o CPF liga 24 de 24 CLT.
- "Muitos itens para validar": o RH já faz os 24 à mão.
- "Salário visível à equipe financeira": já acontece hoje. A automação não abre exposição nova, mas também não a resolve.

**Decisão 2 (valor da folha):** confirmada. O valor vem do arquivo da contabilidade, e o Relatório de Líquidos é o candidato
a fonte. Depende de ler o PDF.

**Decisão 3 (PJ): o cliente pediu mais do que eu propus.** Quer um módulo em que se anexa a nota, o sistema lê e lança o
pagamento. Falta a regra para quem não emite nota. Vale notar que 55 de 61 pagamentos estão em CPF.

**Ordem das fases: recomendo inverter e fazer a folha antes do VR.** O VR vinha primeiro porque a folha não tinha caminho. Agora
tem, e o volume mudou o peso: a folha são 24 lançamentos à mão por mês; o VR é poucos QR Codes.

| Fase | Entrega | Situação |
|---|---|---|
| 2A | Competência + **folha CLT** pelo Relatório de Líquidos, com rateio do cadastro | Depende de ler o PDF |
| 2B | **Guias** (FGTS e consignado) com QR Code, rateadas | Depende de ler o PDF |
| 2C | **VR**: dias úteis x R$ 30 com dias da API; crédito à parte para quem entra no meio do mês | Falta confirmar a regra |
| 2D | VT e ajuda de custo: valor recorrente de 3 pessoas | Baixo volume |
| 2E | **Portal PJ:** nota anexada, leitura e lançamento | Falta regra de quem não emite nota |
| 5 | Ponto: lê a API, e cruza horas extras com atendimentos do Cockpit | Depende do token |

**Dependência que caiu:** "marcar à mão quem fica de fora" pode vir da API de afastamentos, em vez de esperar as fases 4 e 5.

**Integrações novas ou confirmadas:**
- **Frotas para a folha:** multa e avaria são descontos reais, enviados por e-mail. Vale subir a prioridade de ligar motorista a colaborador.
- **Cockpit para horas extras:** cruzar com atendimentos do dia. O Cockpit identifica por e-mail, a API traz e-mail e CPF, e o
  RH não tem e-mail: é mais um motivo para a decisão 4.

**Pré-requisito do José ficou menor:** a folha lançada hoje só usa DPSP e Profarma, que a trava de obra não alcança. Ele só
precisa incluir as categorias para centro de custo com OBRAS ou SPOT no nome. Não medi quantos CLT têm esse rateio no cadastro.

## O que o mockup precisa corrigir (ainda não alterado)

- **VR e guias saem por PIX QR Code, não por boleto.** A regra "linha digitável obrigatória" vira "código de pagamento
  obrigatório", com boleto sendo só um caso.
- **Seção 4.5 (4 caminhos da folha)** sai, e entra a criação de uma solicitação por pessoa, com a chave PIX de cada um.
- **Nova tela:** upload dos PDFs, com a conferência do que foi lido.
- **Novo:** FGTS e consignado, com o aviso do vencimento.
- **Novo:** "folha não reabre". Correção depois do envio ao eSocial vai para a competência seguinte.
- **VR:** crédito à parte para quem entra no meio do mês.
- **Novo:** portal PJ.

## O que falta verificar

- Layout dos PDFs, e se dá para extrair o valor e o CPF de cada pessoa.
- De onde sai a chave PIX: a integração a lê do catálogo ou o RH precisa guardá-la.
- A porta de integração do Financeiro para `Salários`, com muitas solicitações de uma vez.
- Por que há 23 solicitações de salário para novembro e 24 CLT ativos. Pode ter explicação; falta comparar com o Relatório de Líquidos.
- Como INSS, IRRF e PIS são pagos, já que não aparecem no Financeiro nessas categorias.
- Se a API está contratada e se o token permite leitura.
