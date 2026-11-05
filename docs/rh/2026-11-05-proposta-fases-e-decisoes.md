# RH: proposta de fases e decisões para o João (05/11/2026)

**Atualização:** as respostas do cliente mudaram as decisões 1 a 3 e a ordem das fases. Onde houver conflito, vale
`docs/rh/2026-11-05-impacto-respostas-do-cliente.md`.

**Situação:** proposta do coordenador, nada aprovado. Já corrigida após revisão independente
(`docs/rh/revisao-proposta-2026-11-05.md`), que derrubou a primeira versão da recomendação sobre a folha.
Fontes: pedido em `docs/cliente/2026-11-05-rh-atividades-rh-dp.md`, direção em
`docs/cliente/2026-11-05-rh-direcao-do-joao.md`, fatos em `docs/rh/descoberta-estado-atual-2026-11-05.md` e
`docs/rh/descoberta-integracoes-2026-11-05.md`.

## Onde estamos

- O RH hoje é a fase 1: cadastro de 50 colaboradores (24 CLT, 26 PJ), com salário e rateio por percentual. Das 18 áreas
  do documento, nenhuma está completa, 7 têm uma parte e 11 não existem.
- O Orçamento já puxa pessoas, salário e rateio do RH. Esse é o único caminho automático que existe hoje.
- O Financeiro aceita uma solicitação com **um favorecido, um valor, um código de pagamento e várias linhas de rateio**.
  Não tem lote, recorrência nem provisão, e nenhum código dele trata de folha.
- Outro sistema só cria pagamento no Financeiro pela porta usada pelo Fornecedores, hoje restrita a medição.

## A ideia central

**O cadastro de pessoas vira a fonte, e cada mês vira uma "competência" fechada.** O RH reúne quem conta naquele mês,
calcula quanto vai para cada centro de custo e entrega esse rateio pronto, sem digitação.

O caminho depende de quem recebe o dinheiro:

| Pagamento | Quem recebe | Como entra no Financeiro | Situação |
|---|---|---|---|
| VR/VA, VT, seguro, celular | Um fornecedor, por boleto | Uma solicitação com o rateio pronto, formato que já existe | **Desenho fechado** |
| Folha CLT, ajuda de custo | Várias pessoas | Não cabe no formato de hoje. Uma solicitação paga a um favorecido só | **Depende do cliente** (decisão 1) |

## Fases propostas

| Fase | Nome | Áreas do documento | O que entrega | Conversa com |
|---|---|---|---|---|
| 1 | Cadastro | parte de 2, 5, 7, 9, 10, 11, 17 | **No ar** | Orçamento, Financeiro (catálogos) |
| 2A | Base + VR/VA | 5, 15, parte de 17.3 | Competência mensal, ficha ampliada e o primeiro pagamento de ponta a ponta | Financeiro, Orçamento |
| 2B | Outros boletos | 13, 16.4, 18.8 | Seguro, VT e celular com rateio calculado | Financeiro |
| 2C | Folha | 6, 16.1 a 16.3, 16.5 | Valor por pessoa, rateio por centro de custo, conferência da prévia, FOPAG para a diretoria e contracheque. **Só CLT. Desenho depende da decisão 1** | Financeiro, Orçamento, Frotas (descontos) |
| 3 | Jornada da pessoa | 2, 9, 11, 17.1, 17.2, 17.6 | Checklists de admissão, alteração e desligamento, com pedido de acessos e benefícios | Admin do hub, Compras, Obras, Frotas |
| 4 | Prazos e vencimentos | 8, 10, 14 | Férias, ASOs e contratos PJ/MEI, com aviso ao gestor | Fornecedores |
| 5 | Ponto e jornada | 3, 4, 7, 17.5 | Fechamento 25 a 24, banco de horas, horas extras, plantões, escala, atestados | Folha, Cockpit e Obras (hipótese) |
| 6 | Patrimônio | 18 (menos 18.8) | Itens por pessoa, entrega e devolução, termos | Compras (estoque e papel de almoxarifado), Frotas. **Não existe módulo de almoxarifado hoje** |
| 7 | Recrutamento e comunicação | 1, 12 | Vagas e candidatos; campanhas, comunicados e eventos | Comunicados do hub |

**Onde esta proposta entrega menos do que você pediu, para você decidir sabendo:**
- **A folha não vem primeiro.** O VR vem antes porque o desenho dele está fechado e Vale Refeição já está na lista de
  categorias que o Financeiro libera sem obra. A folha é a maior dor e ainda não tem caminho definido.
- **O valor da folha não sairia só do cadastro.** Pela decisão 2, o valor vem de um arquivo mensal da contabilidade. O
  rateio é que sai do cadastro. Some a digitação, mas fica um upload.
- **Os 26 PJ ficam fora do pagamento nesta fase** (decisão 3). A folha da 2C cobre 24 de 50 pessoas.

**Dependências entre fases:** a fase 2 precisa saber quem está de férias ou afastado, e isso só nasce nas fases 4 e 5. Até
lá, o RH marca à mão, na competência, quem fica de fora e o motivo. Na fase 3, itens de checklist sobre ASO, patrimônio,
comunicado e banco de horas começam como marcação manual e se ligam quando a fase deles chegar.

## O que a fase 2 precisa no banco (schema: sua aprovação)

Tudo aditivo: o Orçamento lê `rh_colaboradores` e `rh_colaborador_rateios` direto, por colunas nomeadas.

1. No colaborador: e-mail corporativo, subtipo MEI, benefícios (VR/VA/VT e valor), se é segurado, linha de celular, chave PIX.
2. Salário com vigência. Hoje reprocessar um mês antigo usaria o salário de hoje. **`salario_centavos` continua sendo
   sempre o valor vigente**, porque o Orçamento o lê; se parasse de ser atualizado, ele leria salário velho sem dar erro.
3. Competência mensal com foto dos dados, incluindo quem fica de fora e por quê. **`status` e `tipo_contratacao` não ganham
   valores novos**, pois mudariam a contagem do Orçamento sem erro.
4. No Financeiro: nova `origem` na integração (a trava no banco só aceita medição), segredo próprio e uma conta de
   solicitante do hub.
5. **Pré-requisito de dados:** José inclui as categorias de pessoal que faltam na lista de fixas (hoje estão de fora folha
   CLT, VT, ajuda de custo e celular; VR e seguro já estão). Sem isso, qualquer rateio com centro de custo de OBRAS ou SPOT
   fica preso em "Sem obra", e a saída fácil seria ligar a uma obra qualquer, jogando o custo de pessoal na obra errada.

**Regras de dinheiro que entram no desenho:**
- **Boleto manda no total.** O cadastro dá só os pesos do rateio. Diferença acima de uma tolerância bloqueia o envio.
- **A linha digitável é obrigatória para boleto,** e anexar o PDF não a substitui. Sem ler o código do PDF, alguém digita
  um campo por mês.
- **Centro de custo inativo bloqueia o fechamento** e aparece para correção. Nada é redistribuído em silêncio.
- **Colaborador sem salário bloqueia o que depende do salário** (2 de 50 hoje). Nunca é tratado como zero.
- **Correção depois do envio gera nova revisão.** A porta devolve a primeira solicitação quando a chave se repete, então
  o RH consulta o estado e mostra devolvida, recusada ou lançada. "Enviado" não significa pago.
- **Último centavo:** vai para uma linha definida, e a soma tem de fechar. O Financeiro recusa diferença, linha zerada e,
  pela tela e pela porta, mais de 20 linhas de rateio.
- **Prazo curto:** vencimento antes da primeira janela do Financeiro vira emergencial e cai no diretor.

## Decisões suas (recomendação primeiro)

### 1. Como a folha entra no Financeiro (só decide depois da pergunta 1 ao cliente)
Uma solicitação tem um favorecido só. Sem resposta, lançar a folha pode gerar dois erros: pagar o total a uma única conta,
ou lançar no Financeiro e também pagar por fora.

| Caminho | Quando serve | Custo |
|---|---|---|
| **Regularização**, que já existe para saída do banco que não está no Omie | Se o dinheiro sai do banco primeiro e o lançamento vem depois | Menor. O RH entrega o rateio, o Financeiro regulariza. **Não verifiquei se esse fluxo se aplica à folha** |
| **Tipo novo de solicitação** para folha | Se o Financeiro precisa programar a saída | Maior, altera o coração do Financeiro |
| **O RH só gera o rateio pronto** para lançar | Se a folha é lançada direto no Omie e não quiserem mudar isso | Menor, mas não elimina o passo de lançar |
| **Uma solicitação por pessoa** | Se cada pessoa é paga individualmente pelo Financeiro | 0 de 50 ligados a fornecedor no Omie, muitos itens para validar, e salário visível a toda a equipe financeira, diretores e admins do hub |

**Recomendação provisória: regularização, se a resposta confirmar o encaixe.** Mesmo na forma consolidada, centro de custo
com uma só pessoa revela o salário dela a quem vê a solicitação. Precisa do seu aval.

### 2. De onde vem o valor da folha
- **Recomendo: importar o valor por pessoa do arquivo da contabilidade** e aplicar o rateio do cadastro. O valor real
  inclui horas extras, faltas e descontos.
- **Salário do cadastro x percentual:** é o que mais se parece com o que você falou e dispensa arquivo, mas não bate com o
  pago. O custo por centro de custo fica errado sempre que houver variável. Serve como conferência.

### 3. Os 26 PJ
- **Recomendo: ficam no cadastro para rateio e orçamento, e o pagamento segue como está nesta fase.** Depende de confirmar
  como são pagos (pergunta 5).
- **Onde mora o contrato PJ/MEI (área 10):** decidir na fase 4, depois de ler a fundo os contratos do Fornecedores, que têm
  sobreposição com esse domínio.

### 4. Quem é "a pessoa" entre os sistemas
- **Recomendo: o RH é a fonte; e-mail entra agora, e CPF segue como chave forte.** Hub, Obras, Cockpit, Compras e Financeiro
  identificam por e-mail, e o RH não tem esse campo. Custa uma coluna e o preenchimento dos 50.
- **Fica para depois:** ligar o motorista da Frotas (só tem nome) ao colaborador. Sem isso, o desconto de multa não chega
  sozinho à folha. Se for indispensável agora, entra na 2C.

### 5. Repositórios separados x tudo junto
Você apontou a separação como o lado ruim, e **minha recomendação contraria a ideia de juntar tudo**.
- **Recomendo: manter separados e criar um mapa de integrações único** (`docs/integracoes/`), com quem lê o quê, as portas
  e os contratos, citado no `CLAUDE.md` de cada repositório, mais uma pasta local com cópia de leitura de cada sistema.
  Toda frente passa a rodar um agente que lê os vizinhos, como fiz esta noite. Foi esse levantamento que achou o bloqueio da folha.
- **Por quê:** resolve a sessão não enxergar o resto e custa pouco. Juntar daria a visão completa, mas é uma migração grande
  e colide com sua decisão de que o deploy de um sistema não atualiza outro.
- **O que o mapa não resolve:** o contrato continua implícito, e renomear coluna do RH ainda quebraria o Orçamento. Um teste
  em cada lado reduz esse risco a baixo custo.

### 6. Dados sensíveis citados no documento
- **Senhas de portão (17.4): recomendo não guardar no sistema.** O vazamento tem efeito físico, e um gerenciador de senhas
  faz isso melhor. O sistema só lembraria de revisar todo mês.
- **Chaves PIX (17.3):** recomendo acesso só para `rh` e `diretoria`, no mesmo tratamento do salário, sem aparecer em lista.

### 7. Autorização para mexer no Financeiro
A fase 2 altera o Financeiro. Precisa de **sua decisão sobre quem autoriza e aplica** (o Orçamento registra que migrations
são aplicadas pelo Jose Guilherme) e da ordem dos deploys: **Financeiro primeiro, RH depois**, para o RH nunca chamar uma
porta que ainda não existe. Escrita no Omie de produção exige autorização do Jose Guilherme.

### 8. Aprovar o mockup
Link e o que julgar estão em `docs/rh/2026-11-05-resumo-da-manha.md`. Só depois disso vêm spec, plano e código.

## Perguntas para o cliente (prontas para colar no WhatsApp)

> Pessoal, pra gente seguir com o sistema de RH, preciso de 6 respostas rápidas:
>
> 1. Como o dinheiro da folha sai hoje? Vocês pagam pelo banco com arquivo, a contabilidade paga, ou é pessoa por pessoa? E quem lança depois no Omie?
> 2. A contabilidade manda a folha em algum arquivo com o valor de cada pessoa? Consegue me mandar um exemplo?
> 3. Como vocês calculam o vale-refeição? Valor por dia vezes dias úteis, ou valor fixo? Em que dia sai o crédito? E quem entra no meio do mês ou está de férias?
> 4. Qual sistema vocês usam para o ponto? Dá para exportar as marcações?
> 5. Os prestadores PJ recebem como? Cada um manda nota e entra como pagamento separado?
> 6. Quando o documento fala em "provisionar a ajuda de custo no Hub", o que é feito hoje? Quem recebe esse valor, a pessoa direto?

## O que não foi possível verificar

- Como a folha e o VR entram hoje no Omie, e se a regularização serve para a folha.
- Quantos centros de custo distintos há no rateio de produção (o limite é 20 linhas por solicitação) e quais são as
  categorias reais de pessoal no Omie.
- Se o app de RH publicado é o mesmo da `main` (de 21/10). Não conferi o `Last-Modified`.
- As funções `rh_*` e suas permissões em produção (só tabelas, policies e contagens foram consultadas).
- Testes e build do RH não foram rodados, por limite de RAM e disco desta máquina.

## Fora do escopo desta madrugada

Código de produto, migrations e qualquer escrita em produção.
