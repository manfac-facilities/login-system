# Pacote de onboarding — Duda

Os três arquivos que o Duda carrega na inteligência dele antes de tocar o projeto.
**A ordem de leitura importa** — o de frentes assume que os outros dois foram lidos.

| Arquivo | O que é |
|---|---|
| `00-CONTEXTO.md` | O produto, o vocabulário, o modelo de dados e o estado real do código |
| `01-REGRAS-DE-TRABALHO.md` | Processo, convenções, armadilhas conhecidas, definição de pronto |
| `02-FRENTES-DO-DUDA.md` | As quatro frentes (D1–D4): escopo, o que não fazer, critério de pronto |

> **Segunda versão do pacote, de 11/09/2026.** A primeira é de 10/09 e descrevia as
> frentes F1, F2 e F3. A F1 (cliente da API do Field) acabou sendo executada pelo João na
> mesma noite, a F3 virou parte de uma frente dele, e a divisão foi refeita em cima do
> fato de que **a base de obras nasce da API do Field Control, não da planilha**. O porquê
> completo está em `../cliente/2026-08-31-sistema-controle-de-obras/divisao-trabalho-joao-duda.md`.

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

A decisão da divisão e o porquê dela estão em
`docs/cliente/2026-08-31-sistema-controle-de-obras/divisao-trabalho-joao-duda.md`.
