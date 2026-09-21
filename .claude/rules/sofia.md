---
paths:
  - "app/(operacoes)/sofia/**"
  - "lib/sofia/**"
---

# Sofia (Gestão de Frotas)

O código diz "sofia" em todo lugar (rotas, `lib/sofia/`, funções SQL `sofia_*`); o
cliente e a UI dizem **Gestão de Frotas**. É o mesmo sistema — já causou confusão.

## Onde fica o quê

- `app/(operacoes)/sofia/` — 15 subrotas, dentro do route group `(operacoes)` cujo
  `layout.tsx` exige sessão e monta `components/sofia/Sidebar.tsx`.
- `lib/sofia/` — domínio: `queries.ts` (leituras `get*`), `types.ts`, `enums.ts`,
  `auditLog.ts`, `autorizacao.ts`, `kmValidation.ts`, `veiculos.ts`, `pendencias.ts`,
  `uploadFotos.ts`, `useVeiculoMotoristaCascade.ts` (hook client que chama
  `app/api/sofia/veiculo-motorista/route.ts`). Testes em `lib/sofia/__tests__/`.
- `components/sofia/` — Sidebar e componentes de UI (câmera, galeria, formulários).
- Server Actions ficam em `_actions.ts` ao lado de cada subrota; testes em `__tests__/`
  ao lado do código testado, nome = arquivo testado + `.test.ts` (ou
  `.<recorte>.test.ts` quando há mais de um teste para o mesmo arquivo, ex.:
  `_actions.criar.test.ts` em sinistros).
- **Subrotas sem teste de `_actions.ts`:** `documentos`, `motoristas`, `pendencias`,
  `revisoes`, `disponibilidade`, `audit`. São as ações escritas antes do
  `v04-seguranca` (anterior a 2026-08) — não há garantia de cobertura indireta via
  outro teste.

## A pegadinha do re-export

`app/(operacoes)/sofia/km/_validation.ts` é só:
```ts
export { validateKmAtual } from '@/lib/sofia/kmValidation'
```
Quem procurar a validação de KM pelo nome do arquivo acha uma casca vazia. A lógica de
verdade (checar `NaN` e valor negativo) está em `lib/sofia/kmValidation.ts`. Ao mexer em
validação de KM, edite lá — o arquivo em `km/` não deve ganhar lógica própria.

## Autorização e os triggers que bloqueiam escrita

As 18 tabelas do Sofia têm policy `sofia access` (`using (sofia_has_access())`), lida
por `lib/auth/roles.ts`. Além da RLS, há **triggers `before` que rodam para qualquer
role**, inclusive `service_role`/`postgres` — porque são `security definer` e leem
`auth.jwt()`, que é NULL fora de uma sessão de usuário real. Editar as colunas abaixo
pelo SQL Editor ou pela Management API **falha** com "Apenas administradores...".
Contorno documentado: `alter table ... disable trigger ...`, corrigir, reabilitar.

- `sofia_bloquear_autorizacao_nao_admin` (definida em `sdd-sql-v04-seguranca.sql`):
  - `multas`: `autorizacao_status`, `valor_descontado`, `status`.
  - `sinistros`: `autorizacao_status`, `valor_descontado`, `status_desconto`.
  - `km_excedido_desconto`: `autorizacao_status`.
  - Bloqueia também **DELETE** direto em `multas`, `sinistros`, `km_excedido_desconto`
    (achado da security review "Vuln 2" — sem isto, RLS sozinha deixava apagar
    contornando `excluirMultaAction`/`excluirSinistroAction`).
- `sofia_bloquear_escrita_nao_admin` (mesmo arquivo, achado "Vuln 1"):
  - `equipes.ativo` (UPDATE), `veiculos.valor_locacao_mensal` (UPDATE).
  - `centro_custo_historico` (bloqueia INSERT inteiro).
  - `abastecimentos` e `km_diario` (bloqueiam DELETE inteiro).

**Armadilha de PL/pgSQL nessas duas functions:** o `if` de tabela é sempre **externo**
(`if TG_TABLE_NAME = 'equipes' then ... new.ativo ...`), nunca
`if TG_TABLE_NAME = 'x' and new.coluna...` — porque `veiculos` não tem `ativo` e
`equipes` não tem `valor_locacao_mensal`; um `and` na mesma expressão resolve
`new.coluna` mesmo na tabela errada e explode com `42703 record "new" has no field`.
Esse bug passou por dois code reviews e um `/security-review` e só apareceu na
primeira escrita real — ao adicionar uma tabela/coluna nova a uma trigger
compartilhada, replique o `if` externo.

## Functions security definer (Track C)

Em `sdd-sql-track-c-integridade.sql`, todas guardadas com `is not true` (nunca `not`,
porque `sofia_has_access()`/`sofia_is_admin()` podem devolver NULL e `not null` é NULL,
o que deixaria a guarda falhar aberta):

- `lancar_km_atomico(...)` — guardada por `sofia_has_access() is not true`.
- `atribuir_responsabilidade_veiculo(...)` — mesma guarda.
- `excluir_multas_em_massa(uuid[])` — guardada por `sofia_is_admin() is not true`; usa
  `auth.uid()` do JWT internamente, não parâmetro (é `security definer`, então ignora
  RLS por definição — a guarda dentro da function é a única proteção).

`execute` foi **revogado de `public` e `anon`** nas três, no fim do arquivo — só
`authenticated` chama.
