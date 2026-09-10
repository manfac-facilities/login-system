# Frentes do Duda — Controle de Obras

> O que fazer, em que ordem, e o que significa "pronto" em cada uma.
> Leia antes: `00-CONTEXTO.md` e `01-REGRAS-DE-TRABALHO.md`.

**Escopo:** apenas o **Controle de Obras** (`app/obras/`). Os outros três sistemas do hub
e o `manfac-site/` estão fora — mesmo que você encontre algo melhorável neles.

---

## A ordem, e por que ela é essa

```
F1  Cliente da API do Field Control   ──────────────────────►   começa já
F2  Smoke test contra o banco real         ───────►   quando a migration rodar
F3  Colunas mortas                              ───────►   quando a F-Triagem mergear
```

**F1 começa imediatamente** porque é código novo em pasta própria: não depende de banco,
de credencial, de deploy nem de decisão do cliente, e não colide com nada que o João
esteja tocando.

**F3 é a única com restrição de ordem, e ela é dura** — está explicada no fim.

---

## F1 · Cliente da API do Field Control

**Onde:** `app/obras/_lib/field/` (pasta nova)
**Tempo estimado:** 6–10 h
**Depende de:** nada

### O que é

A camada que **fala com a API do Field Control e devolve dados normalizados**. Só isso.
Ela não escreve no banco, não desenha tela e não decide nada de negócio — quem consome o
que ela devolve é outra frente, do João.

Toda a documentação já levantada está em
`docs/cliente/2026-08-31-sistema-controle-de-obras/api-field-control-levantamento.md`.
**Leia esse arquivo inteiro antes de começar** — ele já resolveu as dúvidas de
autenticação, filtros, paginação e limites, com citação literal da documentação oficial.

### O que a camada precisa fazer

1. **Autenticar.** Header `X-Api-Key` (chave estática, não OAuth). A documentação também
   exige `User-Agent` em toda requisição — sem ele, a chamada pode bater em regra de
   bloqueio de bot.

2. **Resolver o tipo de OS por nome.** Só interessam as OS do tipo **"Atividade Spot"**.
   O filtro de `/orders` aceita `service_id` (o **id**), não o nome — então são **duas
   chamadas**: primeiro `/services` para achar o id pelo nome, depois `/orders` filtrando
   por ele. O id não muda com frequência: **guarde em cache**, não resolva a cada varredura.

3. **Listar as ordens, paginando.** `limit` vai até **100** por página, `offset` até
   200000, e `totalCount` vem no corpo. Use `sort` para que a paginação seja estável — sem
   ordenação definida, varrer muitas páginas pode repetir ou pular registros.

4. **Respeitar o rate limit: 1 requisição por segundo.** Isso não é sugestão — é o limite
   documentado, e passar dele devolve `429`. A camada precisa **serializar as chamadas com
   espaçamento**, não disparar em paralelo. Não há `Retry-After` documentado, então o
   backoff é decisão sua: implemente um, e deixe comentado por que escolheu aquele.

5. **Suportar varredura incremental.** O filtro `updated_at` aceita `>=`, `<=`, `>`, `<`.
   A camada deve aceitar um "desde quando" e devolver só o que mudou depois disso.

6. **Normalizar a OS** para uma forma que o resto do sistema entenda:

   | Campo nosso | Campo do Field |
   |---|---|
   | `os` | `identifier` |
   | `descricao` | `description` (pode vir `null`, máx. 2000 caracteres) |
   | `loja` | ⚠️ **decisão em aberto — leia abaixo** |

### ⚠️ A decisão de negócio que ainda não existe, e como não travar por causa dela

"Localização da loja" tem **dois caminhos possíveis** na API, e o cliente ainda não disse
qual quer:

- **`address`** — objeto estruturado que já vem embutido na resposta de `/orders`
  (`city`, `street`, `number`, `neighborhood`…). **Custo zero**, nenhuma chamada extra.
- **`location.name`** — o nome da loja cadastrada como "Localização" do cliente. Na
  listagem vem só o `id`; pegar o nome exige **uma chamada adicional por OS** — o que,
  contra o limite de 1 req/s, é caro.

**Não escolha por conta própria e não espere a resposta.** Implemente o mapeamento da loja
**atrás de uma função isolada**, com as duas estratégias prontas e uma escolhida por
configuração. Quando o cliente responder, a mudança é de uma linha — não da arquitetura.

Isso vale como princípio geral aqui: **onde falta decisão de negócio, isole o ponto de
variação em vez de parar.**

### O que NÃO fazer nesta frente

- ❌ Não escreva no banco. Nem uma linha de `insert`/`update`.
- ❌ Não crie tela nem rota.
- ❌ Não configure webhook — a decisão entre webhook e varredura é do João.
- ❌ Não use credencial real. **Você não precisa dela**, e não deve pedi-la.

### Pronto quando

- [ ] Função exportada que devolve OS normalizadas, com paginação resolvida por dentro
- [ ] Tipos TypeScript do recurso, escritos a partir do schema documentado
- [ ] Espaçamento de 1 req/s garantido e **coberto por teste**
- [ ] Testes com mock cobrindo: página única, múltiplas páginas, lista vazia, `429`,
      `422` (parâmetro inválido), campo `null`, e resposta com `description` ausente
- [ ] **Nenhum teste faz chamada real de rede**
- [ ] O ponto de variação da "loja" está isolado e documentado no código

---

## F2 · Smoke test contra o Supabase real

**Onde:** roteiro executado nas telas, mais um documento de achados
**Tempo estimado:** 2–3 h
**Depende de:** a migration ter rodado e o deploy ter subido (trabalho do João)

### Por que esta frente existe

**Nada deste módulo jamais tocou um banco real.** Os 204 testes são todos de unidade com
mock. O primeiro contato com o Supabase de verdade vai revelar coisa — e é muito melhor
que revele para você, num roteiro, do que para a equipe do cliente numa sala de
treinamento.

### O roteiro, na ordem

1. Importar a planilha e **ler o relatório do que ficou de fora** — é o primeiro contato
   do parser com dados reais.
2. Abrir a base: tabela e kanban, os 4 filtros, a ordenação.
3. Triar uma obra: distribuir para um responsável, definir prioridade, início e duração.
4. Responder o diário de uma obra: andou.
5. Responder outra: não andou, com motivo — e confirmar que o contador de dias parados sobe.
6. **Desfazer** uma resposta e confirmar que o contador volta.
7. Anexar foto no diário e conferir que ela aparece em "Evolução em fotos" na ficha.
8. Conferir que a falta virou tarefa em `/obras/tarefas`.
9. Mover etapas na ficha até `faturado`.

### Pronto quando

- [ ] Os nove passos executados, cada um com resultado anotado
- [ ] Documento em `docs/cliente/2026-08-31-sistema-controle-de-obras/` com o que
      funcionou, o que quebrou e o que ficou estranho mas não quebrou
- [ ] Cada defeito encontrado com **passo de reprodução**, não só descrição

⚠️ **Não conserte o que encontrar durante o teste.** Registre tudo primeiro. Consertar no
meio do roteiro perde o resto dos achados, e a prioridade do conserto é decisão do João.

---

## F3 · Colunas mortas

**Onde:** `app/obras/obra/[id]/_actions.ts` e `_ficha.tsx`
**Tempo estimado:** 2–4 h
**Depende de:** ⚠️ **a frente de campos editáveis (do João) estar mergeada** — leia o fim

### O problema, verificado

Quatro colunas de `obras_obra` **não são escritas por lugar nenhum do código**:

| Coluna | Para que serve | Quem escreve hoje |
|---|---|---|
| `os_aprovada` | alimenta a etiqueta "OS do cliente" na ficha | **ninguém** |
| `marco_exec_fim` | a esteira lê para decidir se "Execução em campo" está feita | **ninguém** |
| `marco_relatorio` | marco da etapa "Relatório de entrega" | **ninguém** |
| `marco_os_aprov` | marco de "Pendente fechamento" | **ninguém** |

Elas só aparecem como campo de tipo em `_lib/tipos.ts:222,238-240`. Confirme você mesmo:
`grep -rn "marco_exec_fim" app/obras --include='*.ts*'` — só o tipo responde.

**Consequência:** a esteira de etapas da ficha fica congelada para sempre, e a etiqueta de
OS do cliente nunca muda de estado.

### O que fazer

1. Definir **quando cada marco é gravado**. O lugar natural é a troca de etapa, em
   `mudarEtapaAction` — quando a obra sai de campo, `marco_exec_fim` recebe a data; e
   assim por diante. **Leia a esteira em `_ficha.tsx` antes de decidir**: ela já expressa
   a intenção de como esses marcos deveriam se comportar.
2. Implementar a gravação, com teste para cada marco.
3. Corrigir o texto de `_ficha.tsx:213-220`, que promete que o relatório é deduzido
   automaticamente do Field Control. **Isso não existe na v0**, e a etapa é movida à mão.
   O comportamento está certo; é o texto que mente.

### ⚠️ A restrição de ordem, e ela é dura

**Esta frente edita `app/obras/obra/[id]/_actions.ts` — o mesmo arquivo da frente de
campos editáveis, que é do João.** A Triagem grava nesse arquivo, e os marcos precisam ser
gravados na troca de etapa, que mora nele também.

Tocar os dois ao mesmo tempo garante conflito de merge no arquivo mais delicado do módulo.

**Não comece a F3 antes de confirmar que a frente do João foi mergeada.** É por isso que a
F1 vem primeiro: ela não depende de nada nem colide com nada.

### Pronto quando

- [ ] As quatro colunas passam a ser escritas, cada uma com teste
- [ ] A esteira da ficha reflete o estado real da obra
- [ ] O texto sobre dedução do Field corrigido
- [ ] Os 204 testes anteriores continuam passando

---

## Resumo

| | Frente | Tempo | Começa quando |
|---|---|---|---|
| **F1** | Cliente da API do Field Control | 6–10 h | **agora** |
| **F2** | Smoke test contra o banco real | 2–3 h | migration + deploy prontos |
| **F3** | Colunas mortas | 2–4 h | frente do João mergeada |

**Total: 10–17 h.**
