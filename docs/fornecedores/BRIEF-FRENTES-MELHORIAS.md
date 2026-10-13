# Instrução comum às frentes A–H — melhorias do Fornecedores (13/10/2026)

Leia inteiros antes de começar:
- Plano: `docs/fornecedores/plano-melhorias-2026-10.md` (seções 1, 2, 3 da sua frente, 4 e a ordem de integração).
- Spec: `docs/fornecedores/spec-melhorias-2026-10.md` (as seções e CAs que a sua frente cita).
- Regras: `AGENTS.md` e, se tocar SQL, `.claude/rules/sql.md` (caminhos relativos a `C:\Users\joao-\projeto-01-elite-da-ia\`).
- Esta versão do Next tem APIs diferentes: consulte `node_modules/next/dist/docs/` antes de usar API do Next que o
  código atual não use.

## Onde e como
- Repo `manfac-facilities/fornecedores`. Clone **seu**, novo: `D:\fornecedores-work\melhorias-<letra>` (nunca
  trabalhe no clone de outra frente). Disco C cheio: `npm ci --cache D:\fornecedores-work\npm-cache`.
- Base: **`feat/melhorias-0-contratos`** (Frente 0 pronta, PR #5 aguardando merge). Seu branch:
  `feat/melhorias-<letra>-<nome>` (nomes no plano §2). PR com base `feat/melhorias-0-contratos`.
- Contrato da Frente 0: `lib/regras/etapa.ts`, `lib/regras/condicoes.ts`, `lib/tipos.ts`, `lib/tipos-db.ts`,
  `components/ui/pill.tsx`, `lib/auth/papeis.ts`, `lib/condicoes/servidor.ts`, `_ficha/tipos.ts`. Use, não edite.
  Desvios dela (valem como contrato): `condicaoDoContrato(linha, versoes)` recebe o mapa de `versoesDe`;
  `Papeis.configurador` é opcional (ausente = false); `FichaDados` tem `devolvidoEm`.
- **Cada arquivo tem um dono só.** Mexa só nos arquivos da sua frente no plano. Precisou de outro → pare e reporte.
- TDD: teste falhando → implementação → verde. Máquina com pouca memória: localmente rode só os seus testes
  (`npx vitest run <arquivos>`), lint e `npx tsc --noEmit`; a suíte completa e o build rodam no CI do PR.
- Commits terminam com:
  ```
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_019LdEkxD3Uh3oDKu5PGYvVn
  ```
  Corpo do PR termina com `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.
- Push e PR; espere o CI e conserte até ficar verde. **Não faça merge.**

## Proibido
Banco de produção (nem leitura), deploy, editar spec/plano/este arquivo, mexer em `main` ou em
`feat/melhorias-0-contratos`, instalar coisa fora de `D:`.

## Territórios onde a borda é tratada mesmo sem pedido
RLS/policies, controle de acesso, escrita que apaga/sobrescreve dado de cliente, autenticação, dinheiro
(condição, parcela, prazo, vencimento). Fora deles: menor mudança, sem defesa não pedida.

## Resposta final (até 15 linhas)
Link do PR, status do CI, CAs fechados, arquivos tocados fora da lista (deve ser nenhum), desvios do plano e o que
outra frente precisa saber.
