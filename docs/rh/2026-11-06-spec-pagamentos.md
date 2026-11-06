# RH: spec dos pagamentos via Financeiro (06/11/2026)

**Fontes:** `docs/cliente/2026-11-05-rh-respostas-do-cliente.md`, `docs/cliente/2026-11-05-rh-direcao-do-joao.md`,
`docs/rh/2026-11-05-impacto-respostas-do-cliente.md`, `docs/rh/levantamento-implementacao-pagamentos-2026-11-06.md`.
Mockup: https://claude.ai/artifact/9v9QS6z3F7sveGy992sCZL (`docs/rh/mockups/2026-11-05-rh-fase2.html`).

**Situação da aprovação:** em 06/11 o João mandou prosseguir e fazer tudo por aqui, inclusive a mudança no Financeiro. **Não há
veredito por seção do mockup.** As suposições abaixo são do coordenador e ficam abertas a veto.

## Objetivo

O RH deixa de abrir à mão as solicitações de pessoal no Financeiro. O sistema monta cada pagamento com valor conferido e rateio do
cadastro, e cria a solicitação pela porta de integração. **O dinheiro continua saindo só depois que o Financeiro valida e paga.**

## Escopo de hoje

Competência mensal, folha CLT, FGTS e consignado, VR e crédito à parte, VT e ajuda de custo, PJ com e sem nota, situação dos
pagamentos, e os campos novos da ficha.

**Fora:** INSS, IRRF e PIS (ficam com o Financeiro); API do VR Ponto (não contratada); portal do prestador; provisão; movimentações,
prazos, ponto, patrimônio, recrutamento e comunicação.

## Suposições do coordenador (veto do João)

1. **Folha entra colando o relatório** (`nome;cpf;valor`, uma linha por pessoa) com o total do relatório digitado. Upload de PDF só
   depois de ver um PDF real.
2. **Nota do PJ:** o RH anexa, digita valor e número. Leitura automática depois, porque exige chave de IA no RH.
3. **Nenhum dado de folha vai a serviço de IA.**
4. **QR Code:** colado como copia e cola. PDF é só anexo.
5. **Consignado:** categoria FGTS, como no histórico.
6. **Rateio de guias e VR:** pesos pelos CLT da competência. FGTS e consignado pelo salário do cadastro; VR pelo valor de cada pessoa.
7. **O solicitante é a pessoa do RH logada**, para que ela possa cancelar ou reenviar pela tela do Financeiro.
8. **Limites provisórios, em constante única:** VR, tolerância de R$ 10,00; folha, aviso acima de 20%.
9. **Primeiro uso real é a próxima competência.** A folha de 10/2026 já está lançada.

## Contrato RH para Financeiro

`POST /financeiro/api/integracoes/rh/pagamentos`, header `Authorization: Bearer <RH_INTEGRACAO_SECRET>`, comparado em tempo constante.
Sem segredo configurado, ninguém passa.

**Corpo para criar:**

```json
{
  "chave": "rh:salario:2026-11:<id>:t1",
  "tipo": "salario",
  "competencia": "2026-11",
  "solicitanteEmail": "pessoa@manfac.com.br",
  "documentoEsperado": "00000000000",
  "liberarDuplicidade": null,
  "solicitacao": { }
}
```

- `solicitacao` segue o `solicitacaoFormSchema` do Financeiro, com `fornecedor.origem = "catalogo"` e rateio em modo valor.
- `tipo`: `salario`, `fgts`, `consignado`, `vr`, `vr_adicional`, `vt`, `ajuda_custo`, `pj`.
- `chave`: até 100 caracteres, determinística, gravada no RH **antes** da chamada.
- **Corpo só com `chave` é consulta.**

**Respostas:**

| Código | Quando | Corpo |
|---|---|---|
| 201 | Criada | `numero, id, etapa, vencimento, motivo, valorCentavos, etiquetas, emergencial, codigoLancamentoOmie` |
| 200 | Chave já existe, em qualquer etapa; nada é alterado | O mesmo corpo |
| 400 | Corpo inválido, ou consulta de chave inexistente | `erro` |
| 401 | Segredo errado | `erro` |
| 409 | Duplicidade bloqueada | `erro, numeroExistente` |
| 422 | Regra recusada | `erro` |

**Lista permitida (fora dela, 422):**

| Tipo | Categoria | Formas |
|---|---|---|
| `salario` | 2.03.01 | `pix_chave` |
| `fgts`, `consignado` | 2.03.07 | `pix_qrcode`, `guia` |
| `vr`, `vr_adicional` | 2.03.12 | `pix_qrcode`, `pix_chave`, `boleto` |
| `vt` | 2.03.11 | `pix_qrcode`, `boleto`, `pix_chave` |
| `ajuda_custo` | 2.04.96 | `pix_chave` |
| `pj` | 2.03.99 | `pix_chave` |

**Guardas da porta, todas com teste:**

1. Só `fornecedor.origem = catalogo`.
2. `documentoEsperado` igual ao documento do catálogo. Diferente: 422.
3. **Bloqueio duro de duplicidade em `salario`, `vt`, `ajuda_custo` e `pj`:** solicitação em etapa diferente de `recusada` e `cancelada`,
   mesmo documento, mesma categoria, mesmo mês de vencimento, **inclusive lançada à mão**: 409. `liberarDuplicidade` com motivo de 10 ou
   mais caracteres libera e fica registrado no evento.
4. Em `fgts`, `consignado`, `vr` e `vr_adicional`, o mesmo fornecedor pode ter vários no mês. Vale a chave e a etiqueta `possivel_duplicidade`.
5. Solicitante precisa ser conta do hub.
6. Trava de obra como em medições: cria como `pendente`, sem recusar.

**Anexos:** `POST /financeiro/api/integracoes/rh/anexos` (multipart: `chave`, `arquivo`), mesmo segredo. PDF, JPG ou PNG conferidos pelo
conteúdo, 10 MB, 10 por solicitação. Autor é o solicitante. Só com solicitação em etapa aberta.

**O que não muda:** `lib/integracoes/medicoes.ts`, a rota de medições e o comportamento do Fornecedores. A única mudança de banco é ampliar
o CHECK de `origem` com `rh_pagamento`.

## RH

**Banco, só aditivo.** Respeitar `CLAUDE.md` do RH e do Orçamento:

- `rh_competencias`: `mes` único, situação, total do relatório.
- `rh_pagamentos`: competência, tipo, colaborador (nulo em guia e VR), nome, fornecedor, documento esperado, valor em centavos, vencimento,
  forma, código de pagamento, cópia do rateio em jsonb, chave, tentativa, situação local (`rascunho, enviando, criada, erro`), retorno do
  Financeiro, última leitura. Único por competência + colaborador + tipo + tentativa.
- `rh_pagamento_padroes`: tipo, fornecedor de guia ou de VR, vencimento padrão.
- `rh_colaboradores`, colunas novas: `email`, `emite_nota`, `recebe_vr`, `ajuda_tipo`, `ajuda_centavos`, `ajuda_forma`.
- Função que liga fornecedor por CPF só quando 1:1. PJ pode ser ligado a CNPJ, manualmente, com nome à vista.
- RLS, `revoke`, auditoria e máscara iguais às de salário: valor só para `rh` e `diretoria`.

**Não pode:** gravar líquido em `salario_centavos`; renomear colunas lidas pelo Orçamento; dar valor novo a `status` ou `tipo_contratacao`;
escrever em `fin_*`; chamar o Omie; guardar chave PIX; pôr CPF em `descricao`.

**Telas, conforme o mockup, seções 2 a 8.** Nada de jargão técnico. `rh` edita, `diretoria` lê, admin só consulta sem valor, sem papel vai para `/sem-acesso`.

**Regras de dinheiro, todas com teste:**

1. Tudo em centavos inteiros.
2. **Rateio por maiores sobras:** soma fecha no centavo e nenhuma linha zerada é enviada. Máximo de 20 linhas, acima disso bloqueia.
3. **Folha:** soma das linhas diferente do total digitado bloqueia tudo. Casa por CPF. Sem CPF: só nome normalizado exato e único, com
   confirmação do RH. CLT ativo sem linha e linha sem cadastro precisam ser resolvidos por escrito antes de criar.
4. **Chave PIX:** só mostra tipo e final lidos de `fin_catalogo_fornecedores`. Sem chave no catálogo bloqueia a pessoa.
5. **Envio:** grava a chave antes de chamar. Erro ou resposta incerta ficam como `erro`, e "enviar de novo" usa **a mesma chave**. Recusada ou
   cancelada abre tentativa seguinte, com chave nova. Valor mudado com chave já usada nunca sobrescreve.
6. **Prazo:** a tela calcula como `lib/solicitacoes/prazos.ts` do Financeiro e avisa antes de enviar quais viram emergenciais.
7. **Centro de custo inativo bloqueia.** Nada é redistribuído em silêncio.
8. **VR:** dias úteis menos ausências x R$ 30, só CLT com `recebe_vr`. O valor da cobrança manda, e diferença acima da tolerância bloqueia. Quem
   entra no mês vai como crédito à parte.
9. **PJ:** sem valor ou sem chave bloqueia. Quem emite nota precisa de nota confirmada. Quem não emite vai com "(sem nota)" na descrição.

**Situação:** relê pelo corpo só com `chave` ao abrir a tela. Mostra situação, número e link. "Enviado" nunca é mostrado como pago.

## Publicação

Ordem: migration do Financeiro; segredo nos dois apps e `FINANCEIRO_URL` no RH; deploy do Financeiro; conferir chunks; migrations do RH; deploy
do RH; teste de fumaça com descrição `TESTE - APAGAR`, que nunca vai ao Omie, e cancelar. **Nenhum título real é criado no teste.** Conforme
`F/CLAUDE.md` regra 4, escrita real no Omie pede autorização do José.
