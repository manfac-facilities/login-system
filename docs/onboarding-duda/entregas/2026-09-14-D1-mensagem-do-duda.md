# D1 — mensagem de entrega do Duda, e pergunta do agente da D2

**Recebido em 14/09/2026**, colado no chat pelo João. Texto literal, sem edição.

## Mensagem do Duda

> João, concluí a D1 na branch duda/field-api-client.
>
> Commit publicado: 1c23dd3 — feat(obras): marca a procedencia das obras vindas do Field
>
> O que foi entregue:
>
> - criada a migration sdd-sql-obras-fonte.sql;
> - coluna fonte nullable e sem default;
> - constraint nomeada obras_obra_fonte_check, permitindo somente 'field';
> - fonte adicionada ao ObraRow;
> - obra nova sincronizada do Field nasce com fonte: 'field';
> - obra existente com fonte nula recebe 'field' quando for encontrada pelo Field;
> - fonte já preenchida nunca é sobrescrita;
> - a leitura do banco passou a selecionar fonte;
> - adicionado ts-node como devDependency, corrigindo o Jest no Node 20;
> - a importação da planilha não foi alterada.
>
> Validações executadas:
>
> - npm ci: passou;
> - testes de Obras: 297/297, 13 suites;
> - TypeScript: passou;
> - build: passou;
> - lint: zero erros, com os mesmos 3 avisos preexistentes fora de Obras.
>
> Não fiz chamadas ao Field, não usei credenciais e não escrevi no banco.
>
> A migration ainda NÃO foi aplicada. Conforme combinado, o próximo passo dela é seu:
> executar sdd-sql-obras-fonte.sql no Supabase.
>
> A branch já está no GitHub para sua revisão.

## Fala do João

> precisamos aqui dessa aprovação da D1 e do merge antes de começar a d2
> já pedi aqui tbm pro agente preparar a D2, ele só tem uma pergunta:

## Pergunta do agente que prepara a D2

> podemos incluir field_id na migration da D2 para reconciliar pela identidade estável do
> Field? Sem isso, ainda é possível implementar, mas aceitando o risco de falso
> desaparecimento quando o número da OS for corrigido.
