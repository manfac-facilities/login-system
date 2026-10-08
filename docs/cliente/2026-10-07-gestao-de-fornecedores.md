# Pedido do João — Gestão de Fornecedores (07/10/2026)

Texto literal, colado no chat:

> precisamos criar um sistema para o cliente chamado gestão de fornecedores, com as opçoes em menu - contratação e outra de medição. Esse app deve ser criado em um projeto proprio no easy panel, fora do login system por exemplo - isso ta causando problema em dar deploy em um sistema e acabadando em outros

---

# Fluxogramas enviados pelo João (08/10/2026)

Originais em `PROJETO GESTAO DE FORNECEDOR/WORKFLOW PROCESSO/` (commitados junto).
Transcrição literal do texto dos PDFs, na ordem do fluxo.

## Contratação de Parceiros.pdf

**1. Contratar Parceiro**
- segue o mesmo principio do cadastro de fornecedores do omie via api
- classificação da contratação: spot, manutenção, obra
- falta criar um template que será o modelo de Contrato do Fornecedor

**2. Criar "contrato" simples com parceiro, ideal é uma "OS" com as condições de pagamento, prazos de obra**
- gerar um numero ficticio de OS para controle interno
- gera um documento de acordo com um template pré-estabelecido
- precisa criar esse modelo de template de formalização da prestação de serviço

**2a. (ramo acima do passo 2) Prever possibilidade de ter aditivo de valor no mesmo contrato**
- gera um CT123-2

**3. Aprovação das condições contratuais**
- as condições de pagamento devem seguir uma padronização mínima estabelecida
- essas condições de pagamento eu já tenho uma base modelo, mas que podemos trabalhar melhor nisso
- Eduardo aprova contratação, Financeiro/José aprova condições de pgto

**4. Cadastrar as informações em uma base para controle**
- aqui devemos controlar saldo do contrato, condição de pgto, medido x pago x saldo, medições em atraso se houver
- deve existir uma base

**5. Gerar Insights**
- criar uma "ficha" do contrato, onde eu sei todo o histórico e timeline ali daquele contrato relacionado àquela obra
- gere outros insights validos para a operação da Manfac

## Medição de Parceiros.pdf

**1. Solicitar Medição de Pagamento**
- o formulario deve dar a opção ao solicitante por exemplo pra medir o CT 123 em x%
- a medição deve ser aberta conforme a condição de pagamento contratada, e cumprindo os requisitos do SLA do financeiro para pagamento
- o sistema não deve permitir abrir uma medição maior que 100% do valor contratado, todas as medições devem somar 100% ao final, importante o sistema controlar esse saldo pra travar o total que pode ser medido
- nos casos de serviços terceiros como caminhão pipa, desentupimento, dedetização, munck precisa ter um contrato global e as medições serão feitas dentro desse contrato.

**2. abrir um processo de pagamento parcial, de acordo coma etapa da condição de pagamento**
- ideal é que esse processo já se conecte com o processo de solicitação de pagamento, gerando assim a solicitação de pagamento conforme as informações do formulário e seguir todo o fluxo de lançar no omie essa parcela a pagar

**3. Aprovação da Medição**
- aqui valida se realmente ta executado até esse % que está acumulado ou que está sendo pago
- a aprovação será feita pelo Eduardo nesse primeiro momento

**4. Registrar esse pagamento na base, de acordo com a data de pagamento real do Omie**

---

# Decisões e falas do João no chat (08/10/2026)

- Medição → pagamento: **opção A** — "A, conecta com o Financeiro" (a medição aprovada cria a solicitação de pagamento no Financeiro, que segue para o Omie).
- Fala literal: "e depois o financeiro conecta com o gestao de obras, mas falamos disso melhor depois, o cliente reclamou que demoramos pra começar ese projeto de gestao de parceiros entao temos que demonstrar progresso"
- Contexto: "esse é o novo projeto apos o gestao de obras, que ainda estou fazendo ajustes finos"
