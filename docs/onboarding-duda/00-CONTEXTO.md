# Contexto do projeto — Controle de Obras (Manfac)

> **Para que serve este arquivo.** É o contexto que um agente de IA precisa carregar
> antes de escrever qualquer linha neste projeto. Ele descreve o produto, o vocabulário,
> o modelo de dados e o estado real do código. Escrito em 11/09/2026 e **atualizado em
> 23/09/2026** (seções 2, 4 a 8 e a nova seção 10), verificado no repositório.
>
> ⚠️ **Este arquivo envelhece rápido.** A versão de 10/09 dizia que a migration nunca
> tinha rodado e que a base viria de uma planilha — as duas coisas deixaram de ser
> verdade em menos de 24 horas. Antes de confiar num número daqui, confirme no
> repositório. O mapa detalhado de cada pasta do módulo está em `.claude/rules/obras.md`,
> que carrega sozinho quando o agente abre um arquivo de `app/obras/`.
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

Isso tem uma consequência que já mordeu: até 14/09 a contagem que faz a obra virar
**crítica** dependia só da data de aprovação da OS (`aprovacao`), e uma obra com esse
campo nulo **nunca disparava alerta** — o problema original, reencenado dentro do sistema
novo. Desde 15/09 a contagem corre da data **mais antiga** entre aprovação, liberação e
entrada da obra (`ancoraDias`, `_lib/tipos.ts:542`): atenção acima de 20 dias, crítica
acima de 30 (números do cliente). Mudar essa âncora é mudar o produto.

---

## 2. Onde este módulo vive

O repositório hospeda um app **Next.js** que serve de **hub** para os sistemas da Manfac,
atrás de um login compartilhado. A tabela completa (inclusive CRM, Cockpit e Financeiro,
que são apps separadas servidas no mesmo domínio) está no `AGENTS.md` da raiz. Os que
moram neste app:

| Sistema | Rota | Nome na UI |
|---|---|---|
| Sofia | `/sofia` | Gestão de Frotas |
| Conversor de OS | `/conversor-os` | Conversor OS |
| Admin | `/admin/acessos` | Admin |
| CRM | `/crm` | CRM |
| **Controle de Obras** | **`/obras`** | **Controle de Obras** |

**O Duda atua apenas no Controle de Obras (`app/obras/` e `app/api/obras/`).** Os outros
sistemas estão fora de escopo — não os altere, mesmo que encontre algo melhorável neles.

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
sem OS aprovada no sistema do cliente. **Na tela ela se chama "Executado - pendente
aprovação OS"** desde 23/09 (antes, "Pendente fechamento"; `_lib/tipos.ts:165`). A chave no
banco continua `aprovarOS`.

**Os seis bloqueios** (também são os motivos de "não andou"): Clima, Cliente / loja,
Disponibilidade de equipe, Contratação de prestador, Falta de material, Sem bloqueio.

---

## 4. As telas

| Rota | O que faz |
|---|---|
| `/obras/base` | Base de obras: tabela + kanban por fase, filtros, ordenação, indicadores do topo |
| `/obras/obra/[id]` | Ficha da obra — **e a Triagem**, quando `etapa = 'definir'` |
| `/obras/diario` | O diário do dia, em cartões |
| `/obras/tarefas` | As tarefas que as faltas geraram |
| `/obras/sincronizar` | Botão "Puxar do Field" e as últimas execuções da sincronização |
| `/obras/importar` | Carga da planilha — legado, não é mais a fonte da base |

No topo das telas de `/obras` aparece a **faixa "Novidade"** (`_ui/faixa-comunicados.tsx`),
que mostra os comunicados de atualização ainda não lidos (tabelas `hub_comunicados` e
`hub_comunicados_lidos`). O primeiro foi publicado em 23/09.

**A ficha e a Triagem são a mesma rota**, em modos diferentes (`page.tsx:103`). Isso
importa: quando a obra sai de `definir`, a Triagem **desaparece para sempre**.

---

## 5. Modelo de dados

Oito tabelas com prefixo `obras_`. As cinco originais estão em `sdd-sql-obras-v0.sql`; as
outras vieram em migrations próprias (`sdd-sql-obras-*.sql` na raiz), todas aplicadas:

| Tabela | O que guarda |
|---|---|
| `obras_obra` | A obra. Nasce do Field Control, não da planilha (seção 6) |
| `obras_diario` | Um registro por obra por dia |
| `obras_tarefa` | A falta virando tarefa, com dono e prazo |
| `obras_pessoa` | Quem pode ser dono de tarefa — e a ponte entre a conta do hub e a planilha |
| `obras_remarcacao` | Remarcações de início, com motivo |
| `obras_motivo_remarcacao` | Os motivos de remarcação (6 de fábrica) |
| `obras_historico` | Histórico de alterações da ficha: bloco, campo, de, para, motivo, quem |
| `obras_sync_execucao` | Cada execução da sincronização: tipo, origem, status, contagens, marca d'água |

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

**A base nasce da API do Field Control — a planilha não entra mais no jogo.** Decisão do
cliente em 10/09/2026: a planilha de 187 linhas **não será importada**. A tela
`/obras/importar` continua existindo no código, com o relatório do que ficou de fora,
mas deixou de ser o caminho de entrada da base.

O cliente já tinha confirmado em 08/09/2026 que a obra **vem sempre do Field** — não
existe, nem vai existir, tela de criar obra do zero.

**Desde 14–16/09 a sincronização roda sozinha, em produção, com a chave real.** O
cliente do Field (`app/obras/_lib/field/`), a tela `/obras/sincronizar` e a rota
`POST /api/obras/sincronizar` (chamada pelo `pg_cron`) formam um executor só: incremental
a cada 5 minutos e varredura completa diária às 06:02 UTC (03:02 de Brasília) — só a
completa detecta OS que sumiu do Field. A regra de gravação continua a mesma: o Field só
preenche o que está **vazio** no banco; o que foi digitado no hub nunca é sobrescrito.
Obra que some do Field vira **alerta**, nunca exclusão. Em 20/09 a base tinha 77 obras.

**E aqui está o fato que molda o produto:** o Field entrega apenas **três** campos —
número da OS (`identifier`), loja e descrição do chamado (`description`). As outras
cerca de **30 colunas** de `obras_obra` chegam vazias — entre elas `tipo`, `valor`,
`analista_cliente`, `origem` e `aprovacao` — e **são digitadas à mão na ficha**
(seção 10). Sem `aprovacao` preenchida, a contagem de atenção/crítica corre pela data de
entrada da obra — a ideia é que nenhuma obra fique sem contagem.

O levantamento completo da API (autenticação, filtros, paginação, rate limit de 1 req/s,
webhooks) está em
`docs/cliente/2026-08-31-sistema-controle-de-obras/api-field-control-levantamento.md`.

---

## 7. Estado real do código — verificado em 23/09/2026

| | |
|---|---|
| **Código** | 59 arquivos, 13.760 linhas sob `app/obras/` (sem contar teste), mais a rota `app/api/obras/sincronizar/` |
| **Testes** | `npx jest app/obras`: **716 passando + 1 `todo`**, 34 suites |
| **Banco** | Todas as migrations `sdd-sql-obras-*.sql` aplicadas em produção; 8 tabelas `obras_*` com RLS; bucket `obras-fotos` só aceita JPEG até 5 MiB |
| **Produção** | **No ar e em uso pela equipe.** Último deploy em 23/09 (19:38 UTC), com os ajustes da ficha |
| **Sincronização** | Rodando sozinha pelo `pg_cron`, com a chave real do Field |

⚠️ **Os testes continuam 100% mock.** O que prova que o caminho funciona com dado real é
a validação ponta a ponta em produção — a frente D5.

---

## 8. O que o sistema não faz, e é de propósito

- **Não existe tela de criar obra do zero**, e não vai existir. A obra vem do Field.
- **Cancelamento de obra ainda não existe.** Está com o João (mockup aguardando aprovação
  do cliente em 23/09). Não é para fazer por conta própria.
- **Agente e cobrança por WhatsApp estão parados** por decisão do cliente: só depois de o
  sistema estar validado. A cobrança das tarefas hoje é feita na tela.
- **"Pendente faturamento ainda na esteira"** foi pedido em 22/09 e **adiado** pelo João.

---

## 9. O que JÁ está pronto e não é para refazer

Isto está aqui porque uma estimativa deste projeto já errou por assumir que era pendência:

- **A foto diária está completa.** Captura no celular com redução para ~200 KB
  (`diario/_foto.tsx`), upload direto ao Storage antes de gravar o diário, coluna
  `foto_path`, signed URL de 60 s (`diario/_actions.ts:266`), bloco **"Evolução em fotos"**
  na ficha (`_ficha.tsx:768`) e o aviso *"A foto deste dia não veio"* na linha do tempo
  (`_ficha.tsx:845`). Só JPEG até 5 MiB, validado no navegador, no servidor e no bucket.
- **Contadores do diário** (`nao_andou_seguidos`, `bloqueada_dias`) são recalculados a
  cada resposta e a cada desfazer. O desfazer é atômico: apaga o registro e as tarefas
  abertas dele numa transação só (RPC `obras_desfazer_diario`).
- **Reimportar a planilha não apaga o que foi digitado no app** — campo vazio da planilha
  nunca sobrescreve, e `etapa` e `mau_uso` nunca são reescritos.
- **A ficha é editável e os marcos da esteira são gravados** (seção 10).

**Antes de construir qualquer coisa, verifique se ela já existe.** Este módulo é maior do
que parece, e a documentação de estado nem sempre acompanhou o código.

---

## 10. A ficha editável e o que mudou até 23/09

- **Ficha editável no ar desde 20/09.** Os blocos Autorização, Identificação e Cronograma
  são editáveis, com remarcação de início (motivo obrigatório). É a porta de entrada dos
  campos que o Field não traz.
- **Histórico de alterações ligado.** Toda edição passa pela RPC `obras_aplicar_alteracao`
  e grava em `obras_historico` quem mudou, o quê, de quanto para quanto e por quê.
- **Marcos da esteira gravados.** Desde 21/09 a troca de etapa (`mudarEtapaAction`) grava
  os marcos (`marco_exec_fim`, `marco_relatorio`, `marco_os_aprov`, `marco_fechou_os`…)
  calculados pelo estado final — a esteira deixou de ficar congelada.
- **Ajustes da ficha de 23/09**, no ar: a etapa `aprovarOS` passou a se chamar
  **"Executado - pendente aprovação OS"**; ao concluir **Fechar OS** a ficha pede a **data
  de fechamento da OS** (vem com hoje, corrigível depois, com histórico); **equipe/prestador
  virou texto livre**, com sugestões das equipes já usadas.
- **Faixa "Novidade"** no topo de `/obras` (seção 4): comunicado de atualização para a
  equipe. O envio por e-mail ainda depende de configuração do João.

Tudo isso vive em `obra/[id]/`, `_lib/` e `base/` — **área do João** (ver
`02-FRENTES-DO-DUDA.md`).
