# Estado da frente — Sistema de Controle de Obras (COP)

Atualizado em 03/09/2026.

## Onde estamos

**Mockup v03 publicado** em 03/09/2026, aplicando o feedback 05 do cliente e os dois
achados da revisão independente.

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

## Processo — onde estamos na régua

```
brainstorming → mockup v02 aprovado ✅ → v03 com o feedback 05 ⬅ AQUI → spec → plano → código → review → deploy
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
- [ ] Confirmar, com digitação humana, se os campos de retorno da página realmente salvam
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
