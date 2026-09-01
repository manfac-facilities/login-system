# Modelo de operação — lote C (o ponto que faltou)

**Data:** 2026-08-31

Os lotes A e B cobriram 15 pontos. O levantamento original dizia 14 e estava errado por
duas razões, ambas de método: a busca foi feita **por linha** (e a frase de
`components/Servicos.tsx` está quebrada em duas linhas no JSX) e **sem case-insensitive**
(perdendo as ocorrências com "Equipe" maiúsculo). A busca multilinha e case-insensitive
devolve **16 ocorrências**.

| Arquivo:linha | Texto ATUAL (literal) | Texto NOVO proposto | Onde aparece |
|---|---|---|---|
| `manfac-site/components/Servicos.tsx:38-39` | `Obras, reformas, novas construções, manutenção predial e climatização — com equipe técnica própria e responsabilidade total do início ao fim.` | `Integramos manutenção, obras, reformas, construções corporativas e climatização com gestão central, núcleo técnico próprio e especialistas complementares conforme o escopo.` | `/servicos`, parágrafo abaixo do H1 |

Texto reaproveitado literalmente do **item 29** da auditoria (linha 2292 de
`docs/cliente/2026-08-29-auditoria-copy-seo-cro.md`).

**Observação de marcação:** o texto atual está quebrado em duas linhas de JSX, sem `<br />`.
É quebra de código, não de renderização — a troca não mexe em marcação.

**Por que este ponto importa mais que os outros:** o lote B corrigiu a `metaDescription`
de `/servicos`, que é o que o Google mostra. Sem corrigir também este parágrafo, o snippet
da busca diria uma coisa e a primeira dobra da página diria outra.

## Pendência editorial que atravessa os 16 textos

Os textos propostos usam **quatro vocabulários diferentes** para a mesma coisa:

| Expressão | Onde aparece |
|---|---|
| "parceiros homologados" | lote A, ponto 4 (`QuemSomosTeaser.tsx`) |
| "parceiros especializados quando necessário" | lote A, ponto 5 (`QuemSomos.tsx`) — texto do item 22 da auditoria |
| "especialistas" | lote B, ponto 6 (`servicos.ts:62`) — texto do item 41 da auditoria |
| "especialistas complementares conforme o escopo" | lote C (`Servicos.tsx`) — texto do item 29 da auditoria |

O objetivo da rodada é declarar **um** modelo de operação com clareza. Quatro nomes para
a mesma coisa desfazem parte do ganho. **Recomendação: padronizar em "parceiros
homologados"** — é a expressão que o dono do projeto usou, e "homologado" carrega o
processo de qualificação, que é justamente o argumento de venda; "complementares" e
"especializados" não carregam nada.

Isso significa editar os textos reaproveitados da auditoria em 3 pontos. Decisão do João.
