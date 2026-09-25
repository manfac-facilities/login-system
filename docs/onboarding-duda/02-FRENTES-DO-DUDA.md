# Frentes do Duda — Controle de Obras

> O que fazer, em que ordem, e o que significa "pronto" em cada uma.
> Leia antes: `00-CONTEXTO.md` e `01-REGRAS-DE-TRABALHO.md`.
>
> **Terceira versão, de 23/09/2026.** A segunda (11–14/09) descrevia as frentes D1–D4 e uma
> "restrição de ordem" que fazia do cancelamento de obra a próxima frente do Duda. **Isso não
> vale mais:** em 23/09 o João assumiu o cancelamento, porque ele mexe nos mesmos arquivos da
> ficha (`obra/[id]`, `_lib/tipos.ts`, `base/`) e o cliente pediu agilidade. A divisão nova e o
> porquê dela estão em
> `docs/cliente/2026-08-31-sistema-controle-de-obras/divisao-trabalho-2026-09-23.md`.

**Escopo:** apenas o **Controle de Obras** (`app/obras/` e `app/api/obras/`). Os outros sistemas
do hub e o `manfac-site/` estão fora — mesmo que você encontre algo melhorável neles.

---

## O que você já entregou

Tudo abaixo está mergeado no `master` e no ar:

| Frente | O que entrou | Commit no `master` |
|---|---|---|
| **D1** | Coluna `fonte` (procedência `'field'`), `ts-node` como devDependency (Jest no Node 20) | `1c23dd3` |
| **D2** | Reconciliação de ausências: `field_id` como identidade, suspeita → alerta em duas varreduras completas, disjuntor de ausência em massa, etiqueta e filtro na Base | `b1ef5e9` |
| **D2.1** | Herança conservadora da OS reaberta (só com `archived === true` no GET direto) + N1–N5 | `03e2a83` |
| **D3** | Sincronização sozinha: `obras_sync_execucao`, marca d'água, trava no banco, rota `POST /api/obras/sincronizar` com `OBRAS_CRON_SECRET`, dois jobs de `pg_cron` | `06aefd9` |
| **7 ajustes de 21/09** | OS que volta limpa a ausência; falha ao ler situação não avança a marca; freio de ausência em massa; Retry-After limitado a 30 s; resposta de tarefa não é sobrescrita por outra aba; desfazer do diário atômico (RPC `obras_desfazer_diario`); foto só JPEG até 5 MiB | `2c58c83` |

**A D4 (smoke test contra o banco real) não tem registro de entrega.** Ela não volta como frente
separada: **é absorvida pela D5**, que faz a mesma coisa com mais alcance — agora com dado real
no banco e o sistema em uso pela equipe.

O backlog que a revisão dos 7 ajustes deixou para trás virou a **A14** do `docs/DIVIDAS.md` — e
entra na D7.

---

## Onde você mora, e onde você não entra

**Sua área** (o João não edita sem te avisar antes):

```
app/obras/sincronizar/      ← tela, execução e regra da varredura
app/obras/_lib/field/       ← cliente da API do Field Control
app/api/obras/sincronizar/  ← rota chamada pelo pg_cron
app/obras/diario/           ← o diário do dia
app/obras/tarefas/          ← as tarefas que as faltas geram
```

Mais a **tela nova do dashboard** (D6), numa rota nova que ainda não existe.

**Área do João — não edite:**

- `app/obras/obra/[id]/**` — a ficha. O cancelamento está sendo feito aqui agora.
- `app/obras/_lib/tipos.ts` — **só leitura.** É o arquivo mais importado do módulo e o
  cancelamento acrescenta uma etapa nele.
- `app/obras/base/**` — **só leitura.** Pode importar as regras de lá; não pode mudá-las.

**Exceção única:** na D7, o teste `app/obras/obra/[id]/__tests__/_blocos-editaveis.test.tsx`.
Você mexe **só no timeout** dos testes, nunca no componente nem na asserção.

Se descobrir que uma frente sua precisa mudar arquivo do João, **pare e avise** — não contorne
copiando a regra para dentro da sua pasta. Regra duplicada diverge em silêncio.

---

## A ordem, e por que ela é essa

```
D5 · validar o operacional  →  D6 · mockup do dashboard  →  (aprovação)  →  D6 · código
                    D7 · dívidas  encaixa enquanto o mockup espera aprovação
```

É a ordem que o **cliente** deu em 22/09, literal:

> a ordem dele foi: finalizar o operaional validado pelo time > faz o dash > faz o agente

"Agente" (a cobrança por WhatsApp) **está fora da divisão** e parado até o sistema estar 100%
testado. A D5 é o item 1 dessa ordem; a D6 é o item 2. A D7 não tem prazo próprio — ela preenche
o tempo em que o mockup da D6 está esperando o João e o cliente.

**Prazo da entrega final: 28/09.**

---

## D5 · Validar o operacional

**Estimativa: 4–8 h.** Já combinado com você por mensagem em 23/09
(`docs/onboarding-duda/2026-09-23-mensagem-whatsapp-duda.md`).

### Por que existe

Todo teste do módulo usa mock. O sistema está em produção com obra real, equipe usando e
sincronização rodando a cada 5 minutos — e ninguém percorreu o caminho inteiro na tela, de ponta
a ponta, com dado de verdade. O cliente chamou isso de "operacional validado pelo time", e é a
condição para qualquer coisa nova entrar.

### O roteiro — em produção, na sua área

**Sincronização**

1. OS nova no Field entra no hub (incremental e botão "Puxar do Field").
2. OS que some do Field vira **suspeita** na primeira varredura completa e **alerta** na
   segunda, respeitando o intervalo mínimo — sem apagar nada.
3. Obra que volta a aparecer no Field **limpa** o alerta sozinha.
4. Cada execução aparece em `/obras/sincronizar` com status, contagens e marca d'água.

**Diário**

5. Registrar "andou" e "não andou" (com motivo); a falta gera tarefa.
6. Foto: JPEG sobe, aparece na ficha em "Evolução em fotos"; formato inválido é recusado com
   mensagem clara.
7. Desfazer: apaga o registro **e** as tarefas abertas dele, na mesma transação.

**Tarefas**

8. A cobrança aparece para o dono certo.
9. A resposta grava, e outra aba aberta não a sobrescreve.
10. A tarefa sai da lista de abertas quando é resolvida.

**Cuidado com dado de cliente:** é produção. Use uma obra combinada com o João para os testes de
escrita, e desfaça o que criou. Nada de apagar ou sobrescrever dado que não foi você que gerou.

### O que fazer com o que quebrar

- **Na sua área:** você corrige, com teste, em branch, e passa pela revisão normal.
- **Em `obra/[id]/` ou `base/`:** você **relata** ao João com o passo a passo para reproduzir
  (tela, obra, clique, o que esperava, o que aconteceu). **Não corrige.**

### Pronto quando

- [ ] Os 10 passos percorridos em produção, cada um com resultado registrado (passou / falhou /
      não deu para testar, e por quê)
- [ ] Roteiro e resultado num `.md` em `docs/` — ele vira o **checklist da entrega de 28/09**
- [ ] Tudo o que quebrou na sua área corrigido e mergeado; o que quebrou fora dela relatado
- [ ] Nenhum dado de cliente alterado além do combinado

---

> **Estado em 25/09/2026:** roteiro operacional passou (`entregas/2026-09-24-D5-resultado-mensagem-do-duda.md`),
> limpeza conferida no banco pelo Claude. Faltam: (1) push do commit `1e6cfd9`; (2) tela de
> sincronização — status, contagens, marca d'água; (3) foto em "Evolução em fotos" na ficha usando
> a TESTE D5: Desfazer cancelamento → diário com foto → conferir na ficha → Desfazer o diário →
> cancelar de novo como Manfac, obs "OS de teste da D5" (registre se o Desfazer cancelamento
> funcionou). O teste da OS sumindo em duas varreduras completas **fica para depois de 28/09**.

## D6 · Dashboard de saúde da operação

**Estimativa: 13–19 h.** Item 2 da ordem do cliente.

### O pedido, literal

De `docs/cliente/2026-09-22-feedback-esteira-e-equipes.md`:

> o cliente pediu para adicionar uma tela de dashboard da saúde da operaçao no lugar dos agentes
> e só fazer os agentes quando finalizar o sistema

**É tudo o que o cliente disse.** Não há lista de indicadores, nem público, nem periodicidade.
Quem responde isso é o mockup — não você, e não o código.

### Mockup primeiro, e o caminho dele é fixo

> **Atualizado em 25/09/2026 — fim de semana 25–27/09.** O João não trabalha sábado nem domingo,
> e o dashboard tem entrega prevista para **quarta/quinta (30/09–01/10)**. Por isso, **nesta
> rodada você mesmo publica o mockup** como artifact da sua sessão do Claude e manda o link ao
> João pelo WhatsApp até **domingo à noite**. O João revisa na segunda e repassa ao cliente.
> O motivo antigo para não publicar (mockup de subagente não salvava os campos de revisão) não
> se aplica mais: não há campos, o retorno vem pelo WhatsApp. Publique pela sua sessão
> principal, não por subagente, e compartilhe o link para o João conseguir abrir.

```
você desenha e publica o mockup  →  link ao João (WhatsApp, até domingo)  →  João revisa (segunda)
→  cliente aprova  →  spec  →  plano  →  código (terça a quinta)
```

- Salve também o `.html` no repositório (`docs/onboarding-duda/entregas/`), com push.
- O feedback do cliente volta pelo WhatsApp, por seção, colado pelo João. Não ponha campos de
  revisão dentro do mockup.
- **Nenhuma linha de código de tela antes do "aprovado" do cliente.**

### O que já existe e pode alimentar o dashboard

Verificado no código em 23/09. **Leia e importe; não copie a regra para a sua pasta.**

| Dado | Onde | O que dá |
|---|---|---|
| Limiares de atenção e crítica | `app/obras/_lib/tipos.ts:537-538` (`LIMIAR_ATENCAO = 20`, `LIMIAR_CRITICO = 30`) | Números do cliente (feedback 14) |
| Âncora da contagem | `tipos.ts:542` (`ancoraDias`) | A data mais antiga entre aprovação, liberação e entrada |
| Obra crítica | `tipos.ts:570` (`critico`) | Em aberto há mais de 30 dias desde a âncora |
| Estourou / travada | `tipos.ts:580` (`estourou`), `tipos.ts:592` (`travado`) | Passou muito da duração; parada no mesmo bloqueio há 3+ dias |
| Encalhada | `tipos.ts:606` (`encalhada`) | Já saiu de campo e está 15+ dias numa etapa de papel |
| Sem cobertura | `tipos.ts:624` (`semCobertura`) | Nem OS aprovada nem liberação nomeada |
| Severidade | `tipos.ts:657` (`sev`), cores em `tipos.ts:672` (`COR_SEV`) | O token único por obra, na ordem de prioridade aprovada |
| Obra derivada | `tipos.ts:461` (`derivar`) | `diasAlerta`, `paradaEtapa`, `atraso` etc. a partir da linha do banco |
| Indicadores da Base | `app/obras/base/_regras.ts:321` (`kpisDaBase`) | Os 8 números do topo da Base, sempre sobre a base inteira |
| Alerta de ausência no Field | `base/_regras.ts:124` (`temAlertaDeAusenciaField`); colunas `field_ausente_desde`/`field_ausente_em` em `tipos.ts:278-280` | Obra que sumiu do Field |
| Execuções da sincronização | tabela `obras_sync_execucao` (`sdd-sql-obras-sync-execucao.sql:10-37`); leitura atual em `app/obras/sincronizar/page.tsx:39` | Status, erro, contagens (novas, suspeitas, alertas), marca d'água, hora |
| Diário | tabela `obras_diario` (`sdd-sql-obras-v0.sql:140`); fila do diário em `app/obras/diario/page.tsx:31` (`ETAPAS_FILA`) | Andou / não andou, motivo, foto, quem registrou |
| Contadores do diário | `nao_andou_seguidos` e `bloqueada_dias` em `obras_obra` (`tipos.ts:315-316`) | Dias seguidos sem andar; dias no mesmo bloqueio |
| Tarefas | tabela `obras_tarefa` (`sdd-sql-obras-v0.sql:164`); situação em `tipos.ts:779` (`sitTarefa`) | Aberta / respondida / vencida (vencida é calculada, nunca gravada) |

⚠️ **Um fato que o mockup precisa enfrentar:** a RLS de `obras_sync_execucao` só deixa
**administrador** ler (conferido em produção em 24/09 — para tela de admin não há o que decidir) (`sdd-sql-obras-sync-execucao.sql:53-56`, `obras_is_admin()`). Um bloco de
"saúde da sincronização" mostrado a quem não é admin chega **vazio**, sem erro. Mudar isso é
mudar policy — território de exceção do `AGENTS.md`, decisão do João, não sua.

### Perguntas que ficam abertas — o mockup é que responde

Não decida sozinho. Desenhe opções e deixe o João e o cliente escolherem:

1. **Para quem é a tela?** Dono da operação, PCM, analista do cliente? Isso decide o resto.
2. **Quais números entram?** O cliente não listou nenhum. Não invente indicador que ele não pediu —
   parta do que já existe na tabela acima.
3. **Hoje ou tendência?** Foto do momento, ou evolução por dia/semana?
4. **Recorte:** por PCM, por equipe, por etapa?
5. **A saúde da sincronização entra?** E, se entrar, para quem (ver o aviso da RLS)?
6. **Onde a tela mora:** aba nova ao lado de Base/Diário/Tarefas, ou só um link?

### Regras de arquivo

Tela nova, **rota nova**. Não toque `obra/[id]/**`; `_lib/tipos.ts` e `base/**` são só leitura.
Se a tela precisar de algo que não existe nessas regras, **avise** — não reescreva a regra no seu
arquivo.

### Pronto quando

**Mockup:**

- [ ] HTML no repositório, com as perguntas acima respondidas como opções visíveis
- [ ] Publicado por você (rodada de 25–27/09), revisado pelo João, **aprovado pelo cliente**

**Código (só depois):**

- [ ] Spec e plano escritos a partir do mockup aprovado
- [ ] A tela reproduz o mockup aprovado; números vêm das funções existentes, com teste
- [ ] Nenhum arquivo da área do João alterado
- [ ] Definição de pronto do `01-REGRAS-DE-TRABALHO.md`, seção 10

---

## D7 · Dívidas da sua área

**Estimativa: 3–5 h.** Encaixa enquanto o mockup da D6 espera aprovação.

### A14 — backlog da revisão dos seus 7 ajustes

De `docs/DIVIDAS.md` (linha A14) e `docs/onboarding-duda/revisoes/2026-09-21-revisao-ajustes-field-api.md`, seção 4:

1. Uma OS com `/tasks` quebrado de forma persistente faz **toda** a varredura terminar em `falhou`,
   e nenhuma OS nova entra até resolver.
2. Duplo clique em "Desfazer" do diário mostra erro em vez de sucesso.
3. Foto HEIC/PNG é recusada quando a redução no aparelho falha.
4. Foto tirada perto da meia-noite pode ser recusada (data do cliente × `hojeISO()` do servidor).

Nenhuma é perda de dado — todas aparecem como erro visível. O item 1 é o que mais pesa: ele
bloqueia a entrada de obra nova.

### A15 — bordas da incremental por `created_at>=`

De `docs/DIVIDAS.md` (linha A15), sobre a correção de 21/09 das OS com `updatedAt` nulo:
publicação atrasada além da margem de 10 min; as duas consultas lidas em momentos diferentes; o
teto `OFFSET_MAXIMO` por consulta. Âncoras: `app/obras/_lib/field/cliente.ts`
(`listarOsNormalizadas`, bloco "DUAS CONSULTAS") e `app/obras/sincronizar/_execucao.ts`
(`maiorMarcaDagua`). A varredura completa da madrugada já recolhe o que escapa — decida com o
João se vale fechar ou só documentar melhor.

### O teste instável de `_blocos-editaveis.test.tsx`

`app/obras/obra/[id]/__tests__/_blocos-editaveis.test.tsx` falha às vezes sob carga. A revisão de
23/09 (`docs/cliente/2026-08-31-sistema-controle-de-obras/review-ajustes-ficha-2026-09-23.md`,
seção "Teste instável") **não reproduziu**, mas suspeita dos testes antigos: os das linhas 11 e
134 já têm timeout de 20 s; os outros quatro (linhas 39, 64, 87, 110) usam o padrão de 5 s com
`userEvent`.

**Este arquivo fica em `obra/[id]`.** Você pode mexer **só no timeout** — nada no componente,
nada na asserção. Se o timeout não resolver, relate ao João.

### Pronto quando

- [ ] Cada item da A14 e da A15: corrigido com teste **ou** decidido com o João que fica — e a
      linha em `docs/DIVIDAS.md` marcada com ✅ e a data, sem apagar (regra do próprio arquivo)
- [ ] O teste instável: timeouts ajustados e a suíte `app/obras` rodada algumas vezes em paralelo
      sem falha
- [ ] Definição de pronto do `01-REGRAS-DE-TRABALHO.md`, seção 10

---

## Pontos de contato com o João

- **O cancelamento vai tocar a sua área:** a obra cancelada sai de `tarefas/page.tsx` com uma
  linha de filtro, feita pelo João — **que te avisa antes**. Se você estiver mexendo em
  `tarefas/` nessa hora, combine a ordem.
- **Mockup do dashboard:** você desenha; a sessão principal do Claude publica; o João revisa
  antes; o cliente aprova.
- **Revisão cruzada:** uma rodada, lista fechada. **Só bloqueia dano de dado alcançável** — o
  resto vai para `docs/DIVIDAS.md` e não volta para você.
- **Bug fora da sua área:** relato com passo a passo, nunca correção.

---

## O que NÃO fazer

- **Não toque no cancelamento de obra.** Nem regra, nem etapa, nem filtro. É do João.
- **Não toque na visão do dono da Pacheco nem em agente/cobrança por WhatsApp.** Estão fora da
  divisão de trabalho atual.
- **Não edite `app/obras/obra/[id]/**`** — a única exceção é o timeout do teste da D7.
- **Não edite `_lib/tipos.ts` nem `base/**`.** Leia e importe.
- **Não publique mockup.** Não escreva código de tela antes da aprovação do cliente.
- **Não altere RLS, policy nem as tabelas de acesso** sem decisão do João.
- **Não use a chave do Field nem escreva em produção fora do roteiro da D5.**

---

## Resumo

| Frente | O quê | Horas | Pronto quando |
|---|---|---|---|
| **D5** | Validar o operacional em produção (sync, diário, tarefas) | 4–8 h | Roteiro + resultado em `docs/`, falhas da sua área corrigidas, as outras relatadas |
| **D6** | Dashboard de saúde da operação — **mockup primeiro** | 13–19 h | Mockup aprovado pelo cliente; depois spec → plano → código |
| **D7** | A14, A15 e o teste instável | 3–5 h | Cada item corrigido ou decidido, `DIVIDAS.md` atualizado |
| | **Total** | **20–32 h** | |
