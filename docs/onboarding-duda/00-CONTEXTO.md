# Contexto do projeto — Controle de Obras (Manfac)

> **Para que serve este arquivo.** É o contexto que um agente de IA precisa carregar
> antes de escrever qualquer linha neste projeto. Ele descreve o produto, o vocabulário,
> o modelo de dados e o estado real do código. Tudo aqui foi **verificado no repositório
> em 10/09/2026**, não é suposição.
>
> Leia junto: `01-REGRAS-DE-TRABALHO.md` (como se trabalha aqui) e
> `02-FRENTES-DO-DUDA.md` (o que fazer).

---

## 1. O que é o produto, e por que ele existe

A **Manfac Facilities** faz manutenção e obras em lojas de uma rede de farmácias (DPSP).
Cada trabalho nasce como uma **OS (ordem de serviço)** no **Field Control**, o sistema de
campo que a operação já usa. A partir daí, a obra vira responsabilidade de um analista da
Manfac, uma equipe vai a campo, e alguém precisa saber todo dia se aquilo andou.

Hoje esse controle vive numa planilha. O problema que originou o projeto é concreto:
**uma obra ficou 123 dias parada sem ninguém notar.** Numa planilha com 187 linhas, obra
parada não grita — ela só afunda.

**O sistema existe para que obra parada apareça.** Todo o resto — cadastro, tabela,
kanban, fotos — é meio. Se uma decisão de implementação enfraquecer o mecanismo de
"acusar obra parada", ela está errada, por mais elegante que pareça.

Isso tem uma consequência que já mordeu: a data de aprovação da OS (`aprovacao`) é o que
faz a obra virar **crítica**. Uma obra com esse campo nulo **nunca dispara alerta
nenhum** — que é exatamente o problema original, reencenado dentro do sistema novo.

---

## 2. Onde este módulo vive

O repositório hospeda um único app **Next.js** que serve de **hub** para quatro sistemas
da Manfac, atrás de um login compartilhado:

| Sistema | Rota | Nome na UI |
|---|---|---|
| Sofia | `/sofia` | Gestão de Frotas |
| Conversor de OS | `/conversor-os` | Conversor OS |
| Admin | `/admin/acessos` | Admin |
| **Controle de Obras** | **`/obras`** | **Controle de Obras** |

**O Duda atua apenas no Controle de Obras (`app/obras/`).** Os outros três sistemas estão
fora de escopo — não os altere, mesmo que encontre algo melhorável neles.

⚠️ **Duas armadilhas de nome que já custaram tempo neste projeto:**

- O repositório se chama **`login-system`** por herança de quando era só a tela de login.
  Hoje ele é o hub inteiro. "Sistema de login", na fala do dono do projeto, quer dizer a
  tela `/admin/acessos` — não a tela de entrada.
- Existe um diretório **`manfac-site/`** na mesma árvore. É o **site institucional**, com
  deploy próprio e independente. **Não faz parte do hub e está fora do escopo.** Sete
  suites de teste dele não carregam por dependência não instalada; isso é conhecido,
  esperado, e **não é para consertar**.

---

## 3. Vocabulário

Termos que aparecem no código e em toda conversa do projeto:

| Termo | O que é |
|---|---|
| **Obra** | A unidade central. Nasce de uma OS no Field Control |
| **OS** | Ordem de serviço, criada no Field Control pelo cliente |
| **Field Control** | Sistema de campo de terceiro, onde a OS nasce. Tem API pública |
| **PCM** | O analista da Manfac responsável pela obra (o campo é texto: `YURI`, `AMANDA`…) |
| **Etapa** | Onde a obra está no ciclo. Nove valores, ver abaixo |
| **Triagem** | O modo da ficha quando a etapa é `definir` — onde a obra é distribuída |
| **Diário** | O registro do dia: andou ou não andou, motivo, foto |
| **Bloqueio** | O motivo de não ter andado. Também é o "estado travado" da obra |
| **Mau uso** | Classificação da obra (dano por uso indevido da loja), não é etapa |
| **Equipe / prestador** | Quem executa em campo (`MANFAC-7`, `ALEX`…) |

**As nove etapas**, na ordem do ciclo:

```
definir → levantamento → andamento → paralisado → relatorio
        → aprovarOS → fecharOS → pendFat → faturado
```

`aprovarOS` é um **desvio**, não um passo normal: só existe quando a obra saiu de campo
sem OS aprovada no sistema do cliente.

**Os seis bloqueios** (também são os motivos de "não andou"): Clima, Cliente / loja,
Disponibilidade de equipe, Contratação de prestador, Falta de material, Sem bloqueio.

---

## 4. As cinco telas

| Rota | O que faz |
|---|---|
| `/obras/base` | Base de obras: tabela + kanban por fase, 4 filtros, ordenação |
| `/obras/obra/[id]` | Ficha da obra — **e a Triagem**, quando `etapa = 'definir'` |
| `/obras/diario` | O diário do dia, em cartões |
| `/obras/tarefas` | As tarefas que as faltas geraram |
| `/obras/importar` | Carga da planilha, com relatório do que ficou de fora |

**A ficha e a Triagem são a mesma rota**, em modos diferentes (`page.tsx:103`). Isso
importa: quando a obra sai de `definir`, a Triagem **desaparece para sempre**.

---

## 5. Modelo de dados

Cinco tabelas, todas com prefixo `obras_`, definidas em `sdd-sql-obras-v0.sql` na raiz:

| Tabela | O que guarda |
|---|---|
| `obras_obra` | A obra. 187 linhas na carga inicial |
| `obras_diario` | Um registro por obra por dia |
| `obras_tarefa` | A falta virando tarefa, com dono e prazo |
| `obras_pessoa` | Quem pode ser dono de tarefa — e a ponte entre a conta do hub e a planilha |
| `obras_remarcacao` | Só leitura na v0, vem da importação |

O tipo `ObraRow` em `app/obras/_lib/tipos.ts` espelha `obras_obra` 1:1 — é o melhor lugar
para entender as colunas sem abrir o SQL.

**Storage:** bucket privado `obras-fotos`, caminho determinístico
`{obra_id}/{data}.jpg`. Leitura só por signed URL curta gerada em Server Action. O bucket
e suas policies são criados pela própria migration — não é passo manual.

**`obras_pessoa` é a peça que costura duas realidades:** a planilha diz `YURI`, mas quem
entra no hub entra por e-mail. A coluna `email` liga os dois. Sem ela preenchida, o
sistema tenta adivinhar a chave pelo e-mail (`amanda.ribeiro@` → `AMANDA`) e, quando
erra, a pessoa vê **"sem permissão"** em vez de uma lista vazia.

---

## 6. Como a obra entra no sistema

**Hoje:** por importação de planilha (`/obras/importar`). Toda a base de 187 obras vem daí.

**A partir da v1:** pela **API do Field Control**. O cliente confirmou em 08/09/2026 que
a obra **vem sempre do Field** — não existe, nem vai existir, tela de criar obra do zero.

**E aqui está o fato que molda a v1 inteira:** o Field entrega apenas **três** campos —
número da OS (`identifier`), loja e descrição do chamado (`description`). Os outros
cinco de `obras_obra` — `tipo`, `valor`, `analista_cliente`, `origem` e `aprovacao` —
**precisam ser digitados à mão**.

O levantamento completo da API (autenticação, filtros, paginação, rate limit de 1 req/s,
webhooks) está em
`docs/cliente/2026-08-31-sistema-controle-de-obras/api-field-control-levantamento.md`.

---

## 7. Estado real do código — verificado em 10/09/2026

| | |
|---|---|
| **Código da v0** | Pronto. 5 telas, 6.638 linhas em 30 arquivos sob `app/obras/` |
| **Testes** | **204/204 passando** em `app/obras` (2.508 linhas de teste, 6 suites) |
| **Build e lint** | Limpos |
| **Banco** | **A migration nunca rodou.** Nenhuma tabela `obras_*` existe em lugar nenhum |
| **Produção** | Build de 26/08. A rota `/obras` devolve **404** |
| **Git** | O `master` local está **78 commits à frente** do remoto |

⚠️ **Nada jamais tocou um Supabase real.** Toda a cobertura é de unidade com mock. O
primeiro contato com o banco de verdade vai revelar coisa — é esperado, não é sinal de
código ruim.

---

## 8. O que a v0 não faz, e é de propósito

- **Não existe tela de criar obra do zero**, e não vai existir. A obra vem do Field.
- **"Relatório de entrega" não é deduzido do Field automaticamente**, embora o texto da
  ficha (`_ficha.tsx:213-220`) prometa isso. Hoje a etapa é movida à mão. **O texto da
  tela é que está errado**, não o comportamento.
- **Quatro colunas do banco nunca são escritas por ninguém**: `os_aprovada`,
  `marco_exec_fim`, `marco_relatorio`, `marco_os_aprov`. Elas só existem como campo de
  tipo em `_lib/tipos.ts:222,238-240`. A esteira de etapas lê `marco_exec_fim` para
  decidir se "Execução em campo" está feita — ou seja, fica congelada para sempre.
- **Os cinco campos que o Field não traz não têm onde ser digitados.** A Triagem os mostra
  como somente leitura (`_triagem.tsx:158-180`), e ela some quando a obra sai de
  `definir`.

Os três últimos são trabalho da v1, não bugs a corrigir por conta própria.

---

## 9. O que JÁ está pronto e não é para refazer

Isto está aqui porque uma estimativa deste projeto já errou por assumir que era pendência:

- **A foto diária está completa.** Captura no celular com redução para ~200 KB
  (`diario/_foto.tsx`), upload direto ao Storage antes de gravar o diário, coluna
  `foto_path`, signed URL de 60 s (`diario/_actions.ts:257`), bloco **"Evolução em fotos"**
  na ficha (`_ficha.tsx:627`) e o aviso *"A foto deste dia não veio"* na linha do tempo
  (`_ficha.tsx:702`). Bucket e policies na migration.
- **Contadores do diário** (`nao_andou_seguidos`, `bloqueada_dias`) são recalculados a
  cada resposta e a cada desfazer.
- **Reimportar a planilha não apaga o que foi digitado no app** — campo vazio da planilha
  nunca sobrescreve, e `etapa` e `mau_uso` nunca são reescritos.

**Antes de construir qualquer coisa, verifique se ela já existe.** Este módulo é maior do
que parece, e a documentação de estado nem sempre acompanhou o código.
