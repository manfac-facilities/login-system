# Estado da frente — Sistema de Controle de Obras (COP)

Atualizado em 01/09/2026.

## Onde estamos

**Mockup v02 APROVADO pelo cliente**, com alterações pedidas. O João recebe os
detalhes do José e repassa em 02/09/2026, junto com os próximos passos.

Artifact: https://claude.ai/code/artifact/258d0a1e-a44a-4d6f-9463-6990f85923be

> ⚠️ O link compartilhado fica **fixado** na versão que foi compartilhada.
> Republicar não atualiza o que o cliente vê — é preciso mover a versão
> compartilhada no menu da própria página. Isso já causou confusão uma vez.

## Processo — onde estamos na régua

```
brainstorming → MOCKUP APROVADO ✅ → spec ⬅ PRÓXIMO → plano → código → review → deploy
```

**Não começar a spec antes do feedback de 02/09.** As alterações pedidas podem
mudar telas, e spec escrita contra a v02 vira retrabalho.

## Decisões já tomadas pelo cliente

| # | Decisão | Resposta |
|---|---|---|
| 01 | Quem preenche o diário e por onde | **Opção D** — tela primeiro como fonte da verdade; agente de IA no WhatsApp numa 2ª etapa, conversacional e não bot de formulário |
| — | Rótulo | "PCM responsável" → **"Responsável da obra"** |
| — | Obra que chega do Field sem responsável | Precisa de um momento de definição — virou o estado "Aguardando definição" + tela de triagem |

## Decisões ABERTAS, propostas dentro do mockup

O cliente responde por WhatsApp citando a letra — formato que tem funcionado.

- **A** — base de obras em tabela ou Kanban
- **B** — diário uma obra por vez ou lista única
- **C** — 3º "não andou" seguido trava o salvamento até dizer quem resolve e até quando
- **D** — quem completa a obra crua do Field (padrão adotado: fila aberta, sem dono fixo)

## Ordem de construção definida pelo cliente na reunião

1. Base de obras (entrada via Field) ⬅ camada 1
2. Dia a dia das obras / diário ⬅ camada 2, é o coração
3. Agente de IA cobrador ⬅ camada 3
4. Dashboard e apresentação para reunião ⬅ camada 4

Zeev fica em **standby**, decisão dele (minuto 38 da reunião).

## Arquivos desta pasta

| Arquivo | O que é |
|---|---|
| `originais/` | Os três arquivos como o cliente mandou |
| `transcricao-reuniao-2026-08-31.md` | Transcrição literal da reunião |
| `framework-transcricao.md` | O diagrama do cliente transcrito |
| `planilha-dpsp-rev02-dump.txt` | A planilha inteira, célula a célula |
| `pergunta-01-*.txt` / `decisao-01-*.md` | A decisão 01, pergunta e resposta |
| `feedback-01-mockup-v01.md` | Retorno do cliente na v01 |
| `brief-mockup-01.md` | Especificação do mockup |
| `mockup-01.html` | **A v02, publicada** |
| `mockup-01-v01-publicada.html` | A v01 aprovada, recuperada do artifact — baseline |
| `mockup-01-PARCIAL-INTERROMPIDO.html` | Descartável. Sobra de um agente que caiu por erro de API |

## Pendências

- [ ] Receber o feedback detalhado do cliente (João traz em 02/09)
- [ ] Respostas das decisões A, B, C e D
- [ ] Link da planilha viva, que o José ficou de mandar por e-mail (combinado no fim da reunião)
- [ ] Só então: spec → plano → código
