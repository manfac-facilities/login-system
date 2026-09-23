# Pacote de onboarding — Duda

Os três arquivos que o Duda carrega na inteligência dele antes de tocar o projeto.
**A ordem de leitura importa** — o de frentes assume que os outros dois foram lidos.

| Arquivo | O que é |
|---|---|
| `00-CONTEXTO.md` | O produto, o vocabulário, o modelo de dados e o estado real do código |
| `01-REGRAS-DE-TRABALHO.md` | Processo, régua de escopo da fase de entrega, convenções, armadilhas conhecidas, definição de pronto |
| `02-FRENTES-DO-DUDA.md` | O que ele já entregou (D1–D3 e os 7 ajustes de 21/09) e as frentes D5–D7: escopo, o que não fazer, critério de pronto |
| `_template.html` + `gerar.mjs` | A página que o João manda ao Duda (ver abaixo) |
| `entregas/` | Mensagens de entrega do Duda, literais |
| `revisoes/` | Revisões das entregas dele |
| `2026-09-*-mensagem-whatsapp-duda.md` | Mensagens enviadas a ele, literais |

> **Terceira versão do pacote, de 23/09/2026** — a divisão de trabalho de 23/09: D5 (validar o
> operacional), D6 (dashboard de saúde da operação, mockup primeiro) e D7 (dívidas da área dele).
> O cancelamento de obra, que a segunda versão (11/09) dava como próxima frente do Duda, ficou com o
> João. A decisão está em
> `../cliente/2026-08-31-sistema-controle-de-obras/divisao-trabalho-2026-09-23.md`.
>
> Histórico: a primeira versão (10/09) tinha F1–F3; a segunda (11/09) refez tudo porque a base de
> obras nasce da API do Field Control, não da planilha
> (`../cliente/2026-08-31-sistema-controle-de-obras/divisao-trabalho-joao-duda.md`).

## A página

`_template.html` é o esqueleto da página que o João manda ao Duda. Os três `.md` são
**injetados dentro dela** — o Duda copia o conteúdo direto da tela, porque o sandbox do
artifact bloqueia download de arquivo.

**Se qualquer `.md` mudar, regere a página** (não edite o HTML publicado à mão, ou as
duas fontes divergem):

```bash
node docs/onboarding-duda/gerar.mjs           # regera a página
node docs/onboarding-duda/gerar.mjs --check   # confere sem escrever
```

⚠️ **Rode o `--check` antes de regerar.** Ele responde se a página em disco ainda é
exatamente o que o template produz. Se disser `DIVERGENTE`, alguém editou o HTML à mão:
**porte a edição para o `_template.html` primeiro**, senão regerar apaga o trabalho dela.

Isso não é hipótese. Em 11/09/2026 a página foi editada direto no HTML gerado, e o
template ficou para trás. Deu para reconciliar — o gerador é determinístico, então bastou
trocar os três blocos `<pre>` de volta pelos marcadores — mas só porque alguém percebeu a
tempo.

Depois republique `frentes-joao-duda.html` no mesmo artifact, para manter a URL:
https://claude.ai/code/artifact/03377e53-2156-4ae1-8257-4e844e28fc54

A divisão vigente e o porquê dela estão em
`docs/cliente/2026-08-31-sistema-controle-de-obras/divisao-trabalho-2026-09-23.md`.
