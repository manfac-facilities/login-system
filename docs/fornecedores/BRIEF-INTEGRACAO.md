# Brief — fatia de INTEGRAÇÃO (junta tudo na main)

Leia antes `BRIEF-IMPLEMENTACAO.md` (regras gerais), mas trabalhe em **`D:\fornecedores-work\integracao`** (disco C está cheio),
branch `integracao/v1` a partir de `origin/main`. Ao final, push da branch (não da main — o coordenador faz fast-forward depois da revisão).

## Branches a mesclar (todas em origin)
`fatia/f1-banco` (dca5114), `fatia/f3-contratacao-a` (135b153), `fatia/f4-contratacao-b` (8818531), `fatia/f5-medicao` (5567dae),
`fatia/f6b-integracao` (se existir no origin quando você chegar nela — se não existir, avise e siga sem ela). A F2 já está na main.

## Arquivos compartilhados (resolver uma vez)
- `lib/supabase/service.ts`: F3 e F4 têm o mesmo conteúdo; F5 tem `_servico.ts` próprio → trocar pelo compartilhado.
- `package.json`/lock: `zod` (F3, alinhar à versão do Compras `^4.4.3` se compatível) e `@electric-sql/pglite` dev (F1). Um `npm install` só no fim.
- `next.config.ts`: `serverActions.bodySizeLimit: "11mb"` e o equivalente de corpo do proxy (F3/F5 apontaram).
- `.env.example`: acrescentar `SUPABASE_SERVICE_ROLE_KEY`, `FRN_AMBIENTE_CATALOGO`, `FINANCEIRO_URL`, `FORNECEDORES_INTEGRACAO_SECRET` (só nomes).
- Papéis: F4 lê em `aprovacoes/_lib/servidor.ts` (STUB até F0) e F5 faz o mesmo à sua maneira → uma função única em `lib/auth/papeis.ts`, falha = nenhum papel.
- Tipos de linha: trocar os tipos escritos à mão (`aprovacoes/_lib/linhas.ts` etc.) por `lib/tipos-db.ts` (F1) onde for direto; não reescreva telas por isso.

## Trocar stubs pelos reais
- F5 `_stub-integracao.ts` → `lib/integracoes/financeiro.ts` (F6b). Sucesso devolve `{ref, vencimento}`; reenvio após recusa usa a `tentativa`.
- F5 `_stub-anexos.ts`/`_stub-catalogo.ts` → `lib/anexos`/`lib/catalogo` (F3).
- Contadores do menu (F0b aceita prop `contadores`): calcular no layout pelo servidor (aprovações pendentes do papel; medições `solicitada` para o Eduardo).

## Notas da F6b (ca57bef)
- O stub da F5 devolve `{ erro: string }`; o real devolve `{ erro: { codigo, mensagem, passageiro } }` → ajustar `_actions.ts` (`r.erro.mensagem`; só oferecer "tentar de novo" quando `passageiro` ou recusa corrigível).
- `lib/integracoes/financeiro.ts` cria cliente service role local (`STUB até F0`) → usar `lib/supabase/service.ts`.
- **Chave PIX:** o Financeiro ignora a chave enviada quando o fornecedor é do catálogo e usa a do catálogo (sem chave no catálogo → 422). Na tela 5, para forma PIX-chave, mostrar a chave do catálogo só leitura em vez de campo livre; sem chave no catálogo, avisar antes de enviar.
- Vencimento no 200 idempotente pode divergir do gravado se o reenvio for noutro dia → registrar em `docs/DIVIDAS.md` (corrigir depois fazendo a rota do Financeiro devolver `vencimento` e `etapa`).

## Correções decididas pelo cliente / revisão
1. **NF opcional** na medição (evidência continua obrigatória): F5 (form, `_logica.ts`, actions, testes) — o banco (F1) já está assim.
2. **Só as 12 condições**: tirar `SPOT_A_VISTA` e `SPOT_D30` de `lib/regras/condicoes.ts` e o caso `per-07` (e qualquer outro que use essas) de `tests/casos-regras.json`; o teste de paridade da F1 tem de passar sem pular.
3. **Buraco de autorização (crítico)** em `frn_devolver_aditivo` (F1, `005_frn_funcoes.sql`): recusar `parte='contratacao'` para aditivo de `tipo='condicao'` (e o simétrico se existir). Teste PGlite novo.
4. Cor de "atraso" na linha do tempo (`corDoEvento`): vermelho.
5. Criar `docs/DIVIDAS.md` com a spec §10 + backlog da revisão do PR do Financeiro (B1–B5 em `C:\Users\joao-\projeto-01-elite-da-ia\docs\fornecedores\revisao-pr-financeiro-1.md`) + CA-5.2 (concorrência real, testar no banco real antes de liberar) + "remover anexo não existe".

## Pronto =
`npm run lint`, `npx tsc --noEmit`, `npx vitest run --no-file-parallelism` (todos, inclusive paridade sem skip) e `npm run build` (com env falsas na linha de comando) passando.
Máquina com pouca memória: nada em paralelo, nenhum processo em segundo plano. Resposta final até 15 linhas: hash, conflitos resolvidos e como, checks.
