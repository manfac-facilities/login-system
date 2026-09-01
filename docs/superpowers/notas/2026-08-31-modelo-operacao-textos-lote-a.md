# Textos do modelo de operação — Lote A (5 pontos)

**Data:** 2026-08-31
**Entrada:** `docs/cliente/2026-08-31-decisao-modelo-de-operacao.md` (decisão do modelo:
"gestão e núcleo técnico próprios, com parceiros homologados"),
`docs/superpowers/notas/2026-08-29-copy-lista-final-aprovacao.md` (tom aprovado),
`docs/cliente/2026-08-29-auditoria-copy-seo-cro.md` (textos já propostos nos itens 5, 18, 22 e 29
da "Lista mestra de alterações de copy", linhas 2096-2295).

**Nada foi implementado.** Nenhum arquivo de `manfac-site/` foi tocado. Este documento é a
proposta para aprovação do cliente/João, igual ao processo do lote de 29/08.

**Verificação executada:** os 5 "texto ATUAL" abaixo foram lidos nos arquivos, nas linhas citadas,
e conferidos literalmente antes de escrever esta tabela — confirmo que cada um existe exatamente
como transcrito.

---

## Tabela de alterações propostas

| # | Arquivo:linha | Texto ATUAL (literal) | Texto NOVO proposto | Onde aparece | Observação |
|---|---|---|---|---|---|
| 1 | `manfac-site/lib/content.ts:28` | `'Equipe própria treinada, rotina técnica e supervisão operacional.'` | `'Núcleo técnico próprio, rotina técnica e supervisão operacional.'` | Home `/`, seção "O problema que resolvemos" — resposta à dor "Falta de padrão" (array `DORES`) | Texto escrito do zero: a auditoria não cobre esta dor específica (só cobriu "Dificuldade de cobrança", item 10). Troca mínima — só o sujeito muda, o resto da frase (rotina técnica, supervisão operacional) continua verdadeiro no modelo de parceiros homologados, porque é a Manfac quem segue supervisionando. Nenhuma marcação a mexer. |
| 2 | `manfac-site/lib/content.ts:67` | `'Equipe própria treinada'` | `'Núcleo técnico próprio'` | Home `/`, seção "Por que a Manfac" — pílula curta (array `DIFERENCIAIS_HOME`, renderizada em `Diferenciais.tsx`) | Escrito do zero (auditoria não propõe pílula curta equivalente). Mantive o mesmo número de palavras (3) que as outras pílulas da lista ("Gestão ativa com responsável técnico", "Ponto focal único" etc.) para não destoar do selo. |
| 3 | `manfac-site/components/home/Diferenciais.tsx:43` | `Equipe própria. Ponto único de responsabilidade.` | `Gestão própria. Responsabilidade central. Execução com padrão e rastreabilidade.` | Home `/`, H2 da seção "Por que a Manfac", logo acima das pílulas do item 2 | **Reaproveitado literalmente do item 18 da auditoria** (linha 2204 do arquivo de auditoria). É o H2 diretamente acima da pílula do item 2 — as duas trocas juntas ficam coerentes: o H2 fala de "gestão própria", a pílula fala de "núcleo técnico próprio", nenhuma das duas afirma equipe de execução 100% interna. Frase mais longa que a atual (9 palavras contra 5); o H2 já é `leading-snug` e responsivo, cabe sem ajuste de marcação. |
| 4 | `manfac-site/components/home/QuemSomosTeaser.tsx:34` | `A Manfac assume tudo com equipe própria: do diagnóstico à conclusão, com` (parágrafo completo, linhas 34-35: `...responsabilidade total e visibilidade em cada etapa.`) | `A Manfac assume a gestão do início ao fim, com núcleo técnico próprio, parceiros homologados e visibilidade em cada etapa.` | Home `/`, teaser "Como atuamos", 2º parágrafo do bloco de texto ao lado da imagem | Escrito do zero (auditoria não cobre este teaser da Home; cobre um texto parecido só em `/quem-somos`, que é o item 5 desta tabela). Também retirei "responsabilidade total" — é a mesma promessa absoluta que a lista de 29/08 já sinalizou como problema em outro parágrafo de `QuemSomos.tsx` (ver observação do item 5 abaixo) e a regra de redação deste lote proíbe "total"/"sempre"/"garantido". Sem `<br />` no trecho, é texto corrido — nenhuma marcação a mexer. **Atenção ao parágrafo vizinho, que eu não toquei:** a frase anterior no mesmo bloco continua dizendo que problemas "costumam acontecer quando obras, reformas e manutenção ficam com fornecedores diferentes — sem conexão entre pessoas, processos e informações em campo." Isso não contradiz o texto novo (o ponto é gestão centralizada, não ausência de parceiros), mas é o tipo de frase que, lida em sequência com "parceiros homologados", merece uma segunda leitura do cliente para confirmar que o contraste ainda soa correto. |
| 5 | `manfac-site/components/QuemSomos.tsx:59` | `...Atuamos com equipe própria, gestão ativa e visibilidade em campo para empresas que precisam de previsibilidade, padrão técnico e resposta rápida em múltiplas unidades.` (frase completa dentro do parágrafo das linhas 57-62) | `Atuamos com gestão e núcleo técnico próprios, processos definidos e parceiros especializados quando necessário, para entregar previsibilidade, padrão e resposta conforme a criticidade e o SLA acordado.` | `/quem-somos`, hero, bloco "Nossa missão" (rotulado no código, mas a auditoria recomenda renomear o rótulo — fora do escopo deste lote) | **Reaproveitado literalmente do item 22 da auditoria** (linha 2236). Esse item tinha sido bloqueado em 29/08 por duas razões: a decisão de modelo de operação (agora resolvida) e a existência de SLA formal. Não confirmei separadamente se há SLA formal documentado — o texto da auditoria já assume que sim ("SLA acordado", condicionado a contrato, não é promessa absoluta). Se não houver SLA formalizado em todos os contratos, vale ajustar antes de publicar. **Ponto de atenção importante, meu principal achado:** o texto novo troca a menção a "múltiplas unidades" (presente no atual) por "SLA acordado" — perde-se a referência a escala, que o primeiro período do mesmo parágrafo já cobre ("para grandes operações"), então não é uma perda grave. Mais sério: o **parágrafo seguinte, não tocado** (`QuemSomos.tsx:69-70`), continua dizendo *"com responsabilidade total do início ao fim"* — a mesma auditoria já apontava esse trecho (item 23, que fala de "responsabilidades definidas por escopo") como o oposto do absolutismo que este novo texto está justamente abandonando. Depois desta troca, a página vai ter no mesmo bloco institucional um parágrafo qualificado ("resposta conforme a criticidade e o SLA acordado") seguido, duas frases depois, de uma promessa absoluta ("responsabilidade total"). Essa contradição já existia antes (a lista de 29/08 já registrou), mas com a troca do item 5 ela fica mais visível, porque o parágrafo anterior passa a soar mais comedido. Recomendo que a próxima rodada de aprovação inclua o parágrafo das linhas 68-71 inteiro, não só o item 23 já aprovado. |

---

## Resumo para conferência

- **Reaproveitados literalmente da auditoria:** itens 3 (auditoria item 18) e 5 (auditoria item 22).
- **Escritos do zero, porque a auditoria não cobria o ponto exato:** itens 1, 2 e 4.
- **Nenhum arquivo de código foi alterado.** Esta é só a proposta de texto.
- **Nenhuma marcação (`<br />` ou similar) precisa ser tocada** em nenhum dos 5 pontos — todos são
  texto corrido em JSX, sem quebra de linha forçada.
