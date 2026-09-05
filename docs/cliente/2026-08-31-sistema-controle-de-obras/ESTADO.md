# Estado da frente — Sistema de Controle de Obras (COP)

Atualizado em 05/09/2026.

## Onde estamos

**MOCKUP v03 APROVADO PELO CLIENTE em 05/09/2026.** O João comunicou a aprovação; o
cliente pontuou algumas coisas "para termos atenção", enviadas por **áudio**. O João
está transcrevendo e vai mandar o texto.

**Aguardando o texto dos áudios** — ele vira `feedback-06-audios-aprovacao.md` nesta
pasta, literal, antes de qualquer interpretação. Só depois disso a spec começa: os
pontos de atenção podem mexer no escopo da v1, e spec escrita antes deles nasce contra
suposição.

O retorno **não veio pelos campos da página nem por comentário no artifact** (conferido
em 05/09: nenhuma thread). Veio por áudio, fora da ferramenta — mais uma evidência de
que o canal confiável é o cliente falando com o João, não a página.

**Artifact da v03 (link novo, para o cliente):**
https://claude.ai/code/artifact/63b26e3e-5e69-45db-b242-c00955e0d202

Publicado como artifact **novo**, de propósito: republicar sobre o link da v02 faria o
cliente continuar vendo a versão antiga até alguém mover a versão compartilhada à mão.
Link novo abre direto na v03.

> ⚠️ **O canal de retorno da página não foi confirmado por teste completo.** Os campos
> aparecem (sinal de que a capability `artifact` foi concedida), e cliques funcionam,
> mas a extensão do Chrome não consegue digitar dentro do iframe do artifact — o teste
> de "digitar, recarregar, conferir" ficou pela metade. Confirmar com uma digitação
> humana antes de confiar nele. O canal que nunca falhou continua sendo o cliente colar
> o retorno no chat.

> ⚠️ **Quem publica o artifact é a sessão principal, nunca um subagente.** Artifact
> publicado por subagente aceita digitação e não salva nada — o canal de retorno só
> existe para a sessão interativa.

> ⚠️ O link compartilhado fica **fixado** na versão compartilhada. Republicar não
> atualiza o que o cliente vê — é preciso mover a versão compartilhada no menu da
> própria página. Isso já causou confusão uma vez.

Artifact da v02: https://claude.ai/code/artifact/258d0a1e-a44a-4d6f-9463-6990f85923be

## Mockup reenviado ao cliente em 05/09

O João mandou o mockup ao cliente de novo em 05/09, depois da aprovação. Provável
motivo: dar à equipe que será treinada na terça a chance de ver a tela antes.

**Consequência de escopo, e é a que importa:** feedback que chegar agora concorre com
uma construção de três dias. O mockup já foi aprovado (feedback 06) — retorno novo entra
como backlog da v1, NÃO como escopo da v0, salvo se apontar algo que impeça o
treinamento de acontecer. Quem decide isso é o João, mas o default é esse.

## Processo — onde estamos na régua

```
brainstorming → mockup v02 ✅ → mockup v03 APROVADO ✅ → pontos de atenção do cliente ⬅ AQUI → spec → plano → código → review → deploy
```

## O que entrou na v03 (feedback 05, recebido em 03/09)

| Decisão | O que é |
|---|---|
| **I** | "Liberado por" + data de liberação, separados da aprovação da OS. Nasce o estado **sem cobertura** — obra executando sem OS e sem ninguém que tenha liberado |
| **J** | Mau uso vira **classificação**, sai de dentro do status e volta para o funil normal |
| **K** | Relatório **deduzido** do Field; "Cobrar aprovação da OS" vira **Pendente fechamento** |
| **L** | Foto de evolução por dia na linha do tempo. **Tela na v1, agente de WhatsApp depois** |

## Decisões do cliente — situação

| # | Assunto | Situação |
|---|---|---|
| 01 | Quem preenche o diário | Opção D — tela como fonte da verdade |
| A | Tabela ou Kanban | as duas |
| B | Formato do diário | as duas |
| C | Travar no 3º "não andou" | sem trava; motivo obrigatório |
| D | Quem define a obra que chega | o Yuri, e ele direciona |
| E | O que perguntar às 9h | dissolvida — ciclo às 18h |
| F | Falta repetida | o aviso não escala, só atualiza |
| G | Quem marca "faturado" | **fechada** — financeiro |
| H | Porte da obra | descartada |
| I | Liberado por + data | fechada — na v03 |
| J | Mau uso como etiqueta | fechada — na v03 |
| K | Relatório derivado | fechada — na v03 |
| L | Foto diária | fechada — tela na v1, agente depois |

## Perguntas em aberto COM O CLIENTE

- **Pergunta 03 — "como calcula esse avanço %?"** Ele perguntou no `.docx` de 31/08 e
  **nunca foi respondida**. Ver `pergunta-03-como-calcula-o-avanco.md`. Hoje o avanço é
  digitado à mão sem regra — a planilha tem `0.9` numa linha e `95` em outra querendo
  dizer a mesma coisa. Proposta: declarado no diário em passos de 10%, com a foto do dia
  como evidência.

## Pendências

- [x] Revisão independente da v03 e publicação do artifact (feita da sessão principal)
- [x] ~~Confirmar se os campos de retorno da página salvam~~ — dispensado na prática: o
      cliente respondeu por áudio ao João. O canal da página nunca foi usado por ele
- [ ] **Receber e versionar a transcrição dos áudios de aprovação** (`feedback-06`)
- [ ] Responder a pergunta 03 ao cliente
- [ ] **Cadastro de telefone das equipes / prestadores** — trabalho de operação do João.
      Trava o agente de WhatsApp, não trava a v1
- [ ] Campo de liberação na tela de Triagem — citado nas decisões, não estava no brief
- [ ] Link da planilha viva, que o José ficou de mandar por e-mail
- [ ] Só então: spec → plano → código

## Ordem de construção definida pelo cliente na reunião

1. Base de obras (entrada via Field) ⬅ camada 1
2. Dia a dia das obras / diário ⬅ camada 2, é o coração
3. Agente de IA cobrador ⬅ camada 3
4. Dashboard e apresentação para reunião ⬅ camada 4

Zeev fica em **standby**, decisão dele (minuto 38 da reunião).

## Arquivos desta pasta

| Arquivo | O que é |
|---|---|
| `originais/` | Os arquivos como o cliente mandou, incluindo o `.docx` de feedback e suas imagens |
| `transcricao-reuniao-2026-08-31.md` | Transcrição literal da reunião |
| `planilha-dpsp-rev02-dump.txt` | A planilha inteira, célula a célula |
| `feedback-01-docx-cliente-literal.md` | O `.docx` do cliente em texto — fonte da v02 |
| `feedback-01` … `feedback-05` | Os retornos, literais e traduzidos |
| `decisoes-para-ir-ao-ar.md` | As decisões A–H |
| `feedback-05-leitura-e-decisoes.md` | As decisões I–L |
| `pergunta-03-como-calcula-o-avanco.md` | Pergunta do cliente ainda sem resposta |
| `brief-mockup-v03.md` | A especificação da v03 |
| `mockup-obras.html` | **A v03** |
| `mockup-v02-BACKUP-antes-do-feedback-05.html` | A v02 aprovada — baseline |
| `mockup-01-v05-BACKUP-aprovado.html` | Backup anterior |
| `mockup-01-v01-publicada.html` | A v01, recuperada do artifact |
