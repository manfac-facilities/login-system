# Mensagem do Duda — 24/09/2026 — pergunta antes da D5

Repassada pelo João no chat, literal:

> Atualização concluída com segurança:
> - Branch duda/field-api-client avançou de 42e40d4 para 2df7d65.
> - Árvore de trabalho limpa, sem conflitos ou divergência.
> - Mudanças de cancelamento em tarefas/ e no tipo Etapa incorporadas.
> - Divisão atualizada lida: D5 → mockup D6 → aprovação → código D6, com D7 durante a espera.
> Para executar a D5 em produção falta apenas o João indicar qual obra/OS está autorizada para os testes, pois o roteiro cria diário, tarefa e foto antes de desfazer os dados gerados. Qual obra devemos usar?

## Decisão do João — 24/09

**OS de teste criada no Field**, não obra real. Consulta ao banco em 24/09: nenhuma obra de teste
existe em `obras_obra` (as OS "TESTE SPOT"/"teste4"/"testeheleno" de 15/09 não estão lá). A OS nova
entra pela sincronização (testa o passo 1 da D5), o Duda roda diário/tarefa/foto nela, e no fim ela
é cancelada no hub pelo botão "Cancelar obra" (pela Manfac, observação "OS de teste da D5").
