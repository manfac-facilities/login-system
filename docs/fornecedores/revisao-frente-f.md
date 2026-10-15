# Revisão independente — Frente F (PR fornecedores#13)

**Data:** 13/10/2026 · **PR:** https://github.com/manfac-facilities/fornecedores/pull/13
**Branch:** `feat/melhorias-f-modelo` @ `875c329` · **Base:** `feat/melhorias-0-contratos` · CI verde.
**Referências conferidas:** plano §"Frente F", spec §1.6, §1.7, §2.3, CA-E10–E13, Apêndice A; migration
`011_frn_modelo_contrato.sql` de `origin/feat/melhorias-a-banco`; documento antigo (`_documento.tsx` da base).
**Verificação executada no clone novo `D:\fornecedores-work\revisao-f` (só leitura, sem commit):**
`vitest run tests/modelo tests/contratos/documento.test.tsx` = 4 arquivos, 19 testes passando. Render lado a lado do
documento antigo e do novo (v1) com o perfil real do CT-0001 (teste temporário, já apagado).

## Veredito: AJUSTAR

Um bloqueante no escopo do PR (F-1, umas 4 linhas em `campos.ts` mais um teste). Um segundo bloqueante (F-2) é uma
corrida na 1ª impressão que cai em arquivos fora da lista da F. O coordenador decide quem faz. Acesso, conflito de
edição, escape e condição pinada estão corretos.

---

## Bloqueantes

### F-1 — O CT-0001 real não sai com o mesmo texto (CA-E13 e §1.6 item 4 falham)
O CT-0001 de produção é **global/manutenção, `OBRA_MEDICAO_MENSAL`, R$ 200 mil** (spec linha 19). Comparei o
documento antigo com a v1 aplicada a esse perfil. Duas frases de cláusula **somem**:

| Cláusula | Antigo | Novo (v1) |
|---|---|---|
| 1 | "Contrato global (guarda-chuva), sem obra vinculada: **os serviços são pedidos sob demanda**." | "Local de execução: contrato global (guarda-chuva), sem obra vinculada." |
| 2 | "**Valor global (teto), consumido por serviço executado**: R$ 200.000,00." | "Valor: R$ 200.000,00." |

A segunda muda o sentido do contrato: o valor deixa de ser declarado como teto. O "até o limite do valor global" da
Cláusula 3 só cobre parte disso. É o texto que vai ser impresso e assinado assim que o Eduardo aprovar o CT-0001.

**Origem:** `lib/modelo/campos.ts:99-104` (`textoDoValor`, sem o caso global) e `:121-124` (`obra` do global sem
"os serviços são pedidos sob demanda"). O teste do CA-E13 (`tests/modelo/campos.test.ts:95-110`) não pegou porque
usa um CT-0001 **fictício** (específico/obra/`OBRA_RETENCAO_10`) e uma lista de frases escolhida a dedo. Não compara
com o render antigo, como o plano pedia.

**Correção curta (só `campos.ts`, sem mexer no seed da A):**
- `obra` global → `"contrato global (guarda-chuva), sem obra vinculada: os serviços são pedidos sob demanda"`.
- `valor` global → `"R$ X, valor global (teto), consumido por serviço executado"`, ou uma redação equivalente que
  traga a frase inteira.
- Teste com o perfil real do CT-0001 que confira **cada frase** do render antigo.

Atenção: a tabela de campos da spec (§1.6 item 2) define `obra` do global sem o "sob demanda". A spec se contradiz
com o próprio §1.6 item 4 e com o CA-E13. Prevalece "o CT-0001 continua com o mesmo conteúdo".

### F-2 — Corrida na 1ª impressão: a versão gravada pode não ser a que foi impressa
`documento/page.tsx:264-265` renderiza com a versão **atual** (ainda sem `modelo_versao`). "Baixar PDF" chama
`frn_registrar_documento` (`_imprimir.tsx:17` → `_actions.ts:17`), que grava `modelo_versao = max(versao)`
**no momento do clique** (`011:135-136`), e depois imprime o que já está na tela.

**Cenário:** o contrato é aprovado e o dono abre o documento (v1 na tela). O José salva a v2, por exemplo
preenchendo o "[CNPJ da Manfac]", que é o primeiro uso previsto da tela. O dono clica em "Baixar PDF": o papel sai
na v1, e o contrato fica pinado na **v2**. Daí em diante, o sistema mostra como "documento gerado" um texto
diferente do que foi impresso.

**Correção sugerida:** a action recebe a versão renderizada. Se, depois do registro, `modelo_versao` do contrato
for diferente dela, a action devolve "recarregar" e o cliente faz `router.refresh()` em vez de `window.print()`.
O ideal é o SQL gravar a versão recebida, mas isso muda assinatura e passa pelo João. Os arquivos `_imprimir.tsx` e
`documento/_actions.ts` estão **fora da lista da F**, então o coordenador atribui (cabe na integração).

---

## Conferido e correto

- **Contrato gerado mantém o texto da versão pinada:** `textoDoModelo(supabase, modeloVersao)` usa `eq("versao", …)`
  quando o contrato já tem `modelo_versao`. Só cai para a atual com `null`, ou seja, antes da 1ª geração, como manda
  §1.6 item 5. Versão inexistente **lança** e não cai na atual (`lib/modelo/dados.ts:83-97`). As versões são
  imutáveis (trigger da 011) ✔.
- **Condição pinada no documento:** `dadosDoDocumento` lê `condicao_codigo/versao/parcelas_ajustadas` e monta pela
  `frn_condicoes_versoes` (`condicaoDoContrato`). Se a versão não for carregada, lança (`dados.ts:23-47`). O teste
  `pino.test.ts` cobre catálogo editado contra a versão pinada. Com isso, **a parte `documento/*` do I-1 está
  resolvida** neste PR ✔.
- **Quem salva o modelo:** `salvarModeloAction` faz sessão → `lerPapeis`, que fecha em qualquer erro
  (`SEM_PAPEL`) → `podeConfigurar` (José ou `configurador`) → RPC com chave de serviço e `p_ator` da sessão. O SQL
  revalida com `frn_pode_configurar(...) is not true`, e a função só é executável por `service_role` (011:106,
  119-120). O admin vê a tela em leitura (`veConfiguracoes`), sem botões e com `textarea readOnly`, e a action o
  recusa (teste cobre sem sessão, solicitante e admin). Quem não tem papel recebe a tela de sem acesso ✔.
- **Conflito de edição:** `p_versao_base` vem da versão que a página abriu e é atualizada com a versão devolvida
  depois de salvar (`_editor.tsx:52-55`). O SQL usa advisory lock e `max(versao) <> p_versao_base` → recusa
  (`011:110-114`). Ninguém sobrescreve a versão de outra pessoa, e o erro P0001 chega ao usuário ✔.
- **Sem injeção de HTML:** `aplicarModelo` devolve só trechos de texto. Documento e prévia renderizam com
  `{t.texto}` (o React escapa). Não há `dangerouslySetInnerHTML` em `app/` nem em `lib/`. Um valor que contenha
  `{{numero}}` não é substituído de novo. Os testes de escape existem nos dois níveis ✔.
- **Seed × fixture:** `tests/modelo/modelo-v1.ts` é igual ao seed da 011, a menos do `\n` final, o que é inofensivo ✔.
- **13 campos, desconhecido literal e listado, vazio → "[a preencher]"** (CA-E10) ✔.

---

## Melhorias (não bloqueiam)

1. **Material separado perde uma frase** (`campos.ts:101-102`). O antigo dizia "Material, separado da mão de obra:
   R$ B, **pago mediante entrega comprovada e nota fiscal**". O novo `valor` segue a spec ("R$ T (mão de obra A +
   material B)"), mas a condição de pagamento do material sai do texto. Não afeta o CT-0001. Sugiro incluir a frase
   no mesmo ajuste da F-1.
2. **Prévia derruba a tela:** se `dadosDoDocumento` do CT-0001 lançar (`page.tsx:110`), a tela do modelo inteira
   cai. Poderia cair para `EXEMPLO`.
3. **Depois da recusa por conflito**, o editor só mostra o erro. Um botão "Abrir versão atual" evitaria que a
   pessoa recarregue a página e perca o texto.
4. `Number(r.data)` (`_actions.ts:36`): resposta nula vira `NaN` como base, e o próximo salvar é recusado com
   "Pedido inválido". Isso não grava nada.
5. Desvio declarado: `lib/modelo/dados.ts` e os testes extras estão fora da lista do plano. É apoio da própria F,
   ninguém mais é dono deles. **Aceito.**

---

## Rerrevisão (1173e5f)

**Head:** `1173e5f`, que traz F-1 em `8e5a6d1` e F-2 em `1173e5f`. Mesmo clone, sem commit.
**Verificação:** `vitest run tests/modelo tests/contratos` = 74 testes passando; `tsc --noEmit` = 0 erros. Refiz o
render lado a lado com o perfil real do CT-0001 (teste temporário, já apagado).

### Veredito: APROVAR

**F-1 — resolvido.** As duas frases que faltavam agora saem na v1, junto com a do material:

| Antigo | Novo (v1) |
|---|---|
| Contrato global (guarda-chuva), sem obra vinculada: os serviços são pedidos sob demanda. | Local de execução: contrato global (guarda-chuva), sem obra vinculada: os serviços são pedidos sob demanda. |
| Valor global (teto), consumido por serviço executado: R$ 200.000,00. | Valor: R$ 200.000,00, valor global (teto), consumido por serviço executado. |

Os rótulos "Local de execução:" e "Valor:" **não violam o CA-E13**. O critério pede que o texto *contenha* todas as
frases das cláusulas, e contém. O sentido também não muda: continua dizendo que não há obra vinculada, que o
serviço é sob demanda e que o valor é teto. A redação sai diferente porque o seed da Frente A reestruturou o texto
(títulos em caixa alta, "Valor:"), e isso a spec já aceitou no Apêndice A. Não há o que corrigir. Se o João
quisesse o texto idêntico byte a byte, a mudança seria no seed (`011`, Frente A) e no Apêndice A da spec, não na F.

**F-2 — resolvido, sem buraco que cause dano.** Fazer a checagem só quando `modelo_versao` é nulo está certo pelos
motivos abaixo:
- Contrato **já pinado**: a página renderiza a versão pinada, e o SQL não grava de novo, porque exige
  `documento_gerado_em is null` (`011:134`). Não há divergência possível.
- Contrato **não pinado**: a versão exibida é comparada com a atual. Se forem diferentes, a impressão é recusada e a
  página recarrega. Sobra a janela de milissegundos entre a checagem e o `max(versao)` do SQL; está declarada e é
  aceitável.
- Contrato **em rascunho ou aguardando**: o SQL não pina nada, mas a checagem roda igual. O efeito é só uma recusa
  desnecessária seguida de recarregar a página. É inofensivo.
- Se o registro falhar sem ser recusa, a página imprime sem pinar, como antes. A próxima impressão pina a versão
  que estiver na tela naquele momento.

**Regressões:** nenhuma. O acesso continua passando pelo `frn_registrar_documento`, que revalida com
`frn__pode_operar`. A versão exibida é validada com zod, o escape não mudou e a condição continua pinada.

### Não bloqueantes novos
1. **Global com material separado perde o "teto"** (`campos.ts:101-102`): o ramo `mat > 0` vem antes do ramo do
   global. No render com R$ 5 mil de material, o novo omite "valor global (teto), consumido por serviço executado".
   Pelas telas e pelo mockup, o CT-0001 não tem material (R$ 200.000,00). Não conferi no banco.
2. **Leitura antes da autorização** (`documento/_actions.ts`): a chave de serviço lê `frn_contratos.modelo_versao`
   pelo id antes de o SQL checar o acesso. O dado não volta para o usuário, só a recusa. Para usar isso, alguém
   precisaria conhecer o UUID de um contrato alheio.
