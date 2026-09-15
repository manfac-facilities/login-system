# Conselho: as 4 perguntas ao João são realmente relevantes?

## Por que este conselho existe

Em 15/09/2026 o coordenador (Claude) fez 4 perguntas ao dono do projeto (João), dizendo que
sem elas o mockup v02 da J4 e o "pronto de 21/09" não andavam. O João não entendeu as perguntas
na primeira redação; elas foram reescritas em linguagem simples (texto abaixo). Pedido dele,
literal: **"rode o llm council para ver se essas 4 respostas sao realmente relevantes"**.

Queremos saber, para cada pergunta: **ela bloqueia algo real? Quando precisa estar respondida?
Dá para seguir com uma suposição declarada? Quem deveria responder (João, cliente, ninguém
agora)?** E se falta uma pergunta mais importante que essas.

Você é um membro independente. **Não edite nada além do seu próprio arquivo de parecer**, não
faça checkout, não acesse banco, produção nem API externa. Só leitura.

## Contexto (fatos verificados)

- Repositório `C:\Users\joao-\projeto-01-elite-da-ia`, módulo `app/obras/` (Next.js +
  Supabase), sistema de Controle de Obras da Manfac Facilities (manutenção em lojas; cliente
  principal DPSP). A obra nasce de uma OS no Field Control, que traz só nº da OS, loja e
  descrição. O resto a equipe completa na tela (a J4: Triagem e ficha editáveis).
- No ar desde 10/09, **0 obras no banco**. 175 OS "Atividade Spot" no Field. Primeira carga
  liberada pelo cliente (6A), mas ele pediu um Excel das 175 OS para conferir se todas são obra
  (7C). Ver `feedback-16-respostas-perguntas-08-e-06.md`.
- **Prazo:** o cliente disse que em **21/09 (segunda)** vai dispensar um funcionário "por causa
  do sistema". O João interpretou: **o sistema substitui o trabalho dele** e precisa estar
  operando com obras reais antes da saída (`feedback-15-prazo-21-09-funcionario.md`,
  `decisoes-joao-2026-09-15.md`). O cronograma de 14/09 (`cronograma-2026-09-14.html`) previa
  fim em 28/09 (faixa 25/09–01/10).
- Mockup J4 v01 revisado pelo cliente (`feedback-14-mockup-j4-v01.md`): D aprovada; A, B, C, E
  e F para ajustar. Decisões já fechadas: `j4-decisoes-2026-09-14.md` e
  `decisoes-joao-2026-09-15.md` (nome da etapa "Executado - pendente aprovação OS"; "Relatório
  de entrega" continua). O feedback de mockup volta pelo WhatsApp.
- **Já rodando em paralelo, sem depender das 4:** spec+plano da regra da obra crítica (seção E),
  spec+plano do histórico de alterações (seção D), geração do Excel das OS.
- Processo do projeto: brainstorming → mockup aprovado → spec → plano → código → review →
  deploy. A skill de mockup permite, sob prazo externo, **seguir com suposição declarada dentro
  do próprio mockup**, em seção própria.

## As 4 perguntas, como foram feitas ao João

**1. O que faz hoje o funcionário que vai sair?** O sistema precisa, em 21/09, fazer o que ele
faz (ex.: atualiza a planilha, liga para as equipes, cobra aprovação de OS, monta números da
reunião semanal). Serve para decidir o que entra primeiro no "pronto de 21/09" e o que fica
para depois. Sugestão dada: perguntar ao cliente.

**2. Motivos de remarcação iniciais.** Seção B do feedback 14: o cliente quer motivo
padronizado numa lista, com opção de cadastrar novo, "mas de início já ter um cadastro".
Sugestão dada: Loja não liberou acesso · Falta de material · Equipe indisponível · Cliente
pediu para mudar · Chuva/clima · Outro.

**3. O SLA 2 para quando?** Seção F: dois contadores — (SLA 1) obra sem OS aprovada: dias desde
a autorização de início; (SLA 2) OS já aprovada no sistema do cliente: dias desde o fechamento
da OS no sistema do cliente. O cliente não disse o fim do SLA 2. Sugestão dada: para quando
"Fechar OS" é concluído.

**4. Metas dos SLAs (amarelo/vermelho).** A regra da obra crítica já é >20 atenção, >30
crítico. Os SLAs usam os mesmos números? Sugestão dada: sim, 20/30, editável no sistema.

## O que ler (mínimo)

- este briefing; `feedback-14-mockup-j4-v01.md`; `feedback-15-...`; `feedback-16-...`;
  `decisoes-joao-2026-09-15.md`; `j4-decisoes-2026-09-14.md`; `cronograma-2026-09-14.html`
- se precisar do código: `app/obras/base/_regras.ts`, `app/obras/_lib/tipos.ts`,
  `app/obras/obra/[id]/`
- **A pergunta 3 depende de um fato do fluxo:** existe no sistema uma etapa/data de "Fechar OS",
  "faturamento", "fechamento da OS no sistema do cliente"? Verifique em `_lib/tipos.ts` e nos
  feedbacks 02 e 09 antes de opinar.

## Formato do parecer

Grave em `conselho-4-perguntas-<sua-lente>.md` nesta pasta, no máximo ~60 linhas:

1. Tabela: pergunta · relevante? (sim / sim, mas não agora / não) · bloqueia o quê, concretamente
   · pode seguir com suposição? · quem responde · custo se a suposição estiver errada
2. A pergunta que está faltando, se houver (só se for mais importante que as 4)
3. Recomendação em 3 linhas: o que perguntar ao João hoje, o que perguntar ao cliente, o que
   assumir e declarar
