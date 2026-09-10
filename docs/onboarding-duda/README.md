# Pacote de onboarding — Duda

Os três arquivos que o Duda carrega na inteligência dele antes de tocar o projeto.
**A ordem de leitura importa** — o de frentes assume que os outros dois foram lidos.

| Arquivo | O que é |
|---|---|
| `00-CONTEXTO.md` | O produto, o vocabulário, o modelo de dados e o estado real do código |
| `01-REGRAS-DE-TRABALHO.md` | Processo, convenções, armadilhas conhecidas, definição de pronto |
| `02-FRENTES-DO-DUDA.md` | As três frentes: escopo, o que não fazer, critério de pronto |

## A página

`_template.html` é o esqueleto da página que o João manda ao Duda. Os três `.md` são
**injetados dentro dela** — o Duda copia o conteúdo direto da tela, porque o sandbox do
artifact bloqueia download de arquivo.

**Se qualquer `.md` mudar, regere a página** (não edite o HTML publicado à mão, ou as
duas fontes divergem):

```bash
cd docs/onboarding-duda
node -e "
const fs=require('fs');
const esc=s=>s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
let t=fs.readFileSync('_template.html','utf8');
const map={'__MD_00__':'00-CONTEXTO.md','__MD_01__':'01-REGRAS-DE-TRABALHO.md','__MD_02__':'02-FRENTES-DO-DUDA.md'};
for(const [ph,f] of Object.entries(map)) t=t.replace(ph, esc(fs.readFileSync(f,'utf8')));
fs.writeFileSync('../cliente/2026-08-31-sistema-controle-de-obras/frentes-joao-duda.html',t);
"
```

Depois republique `frentes-joao-duda.html` no mesmo artifact, para manter a URL:
https://claude.ai/code/artifact/03377e53-2156-4ae1-8257-4e844e28fc54

A decisão da divisão e o porquê dela estão em
`docs/cliente/2026-08-31-sistema-controle-de-obras/divisao-trabalho-joao-duda.md`.
